import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  redisCacheKey,
  redisGetJson,
  redisScanKeys,
  redisSetJson,
} from "../cache/redis";
import { env } from "../config/env";

type DashboardCacheWrapper = {
  data?: unknown;
  expiresAt?: unknown;
};

type DashboardCacheCandidate = {
  cacheKey: string;
  data: unknown;
  expiresAt: number | null;
  mtimeMs: number;
  stale: boolean;
  source: "redis" | "legacy-file";
};

export type CachedKadasterDashboard = {
  cacheKey: string;
  data: unknown;
  expiresAt: number | null;
  stale: boolean;
  source: "redis" | "legacy-file";
  migratedToRedis: boolean;
};

export type KadasterDashboardAccessPolicy = {
  addressAllowed: boolean;
  liveCallsEnabled: boolean;
  allowedAddressMode: "one" | "list" | "all";
  allowedAddresses: string[];
  reason: string | null;
};

const DASHBOARD_CACHE_SUBDIR = "dashboard";
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DASHBOARD_CACHE_DAYS = 30;

function normalizeAddressKey(address: string) {
  return address.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseAllowedAddresses() {
  return env.KADASTER_ALLOWED_ADDRESSES.split(/[;\n]/)
    .map((address) => address.trim())
    .filter(Boolean);
}

function addressAllowedByEnv(address: string) {
  const mode = env.KADASTER_ALLOWED_ADDRESS_MODE;
  const allowedAddresses = parseAllowedAddresses();

  if (mode === "all") {
    return true;
  }

  const normalizedAddress = normalizeAddressKey(address);
  const normalizedAllowedAddresses = allowedAddresses.map(normalizeAddressKey);

  if (mode === "one") {
    return normalizedAllowedAddresses[0] === normalizedAddress;
  }

  return normalizedAllowedAddresses.includes(normalizedAddress);
}

function dashboardCacheTtlMs() {
  const parsed = Number(process.env.KADASTER_DASHBOARD_CACHE_DAYS || DEFAULT_DASHBOARD_CACHE_DAYS);
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DASHBOARD_CACHE_DAYS;
  return days * DAY_MS;
}

function ttlSecondsForCacheEntry(expiresAt: number | null) {
  const ttlMs =
    expiresAt !== null && expiresAt > Date.now()
      ? expiresAt - Date.now()
      : dashboardCacheTtlMs();

  return Math.max(1, Math.ceil(ttlMs / 1000));
}

function configuredCacheRoots() {
  const roots = [
    env.KADASTER_DASHBOARD_CACHE_DIR,
    path.resolve(process.cwd(), ".cache", "kadaster-dashboard"),
    path.resolve(process.cwd(), "..", "huisscan-1", ".cache", "kadaster-dashboard"),
  ];

  return roots.filter((root): root is string => Boolean(root));
}

function unwrapDashboardCache(raw: unknown): { data: unknown; expiresAt: number | null } | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const wrapper = raw as DashboardCacheWrapper;
  if (!("data" in wrapper)) {
    return null;
  }

  const expiresAt = typeof wrapper.expiresAt === "number" ? wrapper.expiresAt : null;
  return {
    data: wrapper.data,
    expiresAt,
  };
}

export class KadasterDashboardCacheService {
  getAccessPolicy(address: string): KadasterDashboardAccessPolicy {
    const addressAllowed = addressAllowedByEnv(address);
    const allowedAddressMode = env.KADASTER_ALLOWED_ADDRESS_MODE;
    const allowedAddresses = parseAllowedAddresses();
    const liveCallsEnabled = env.KADASTER_LIVE_CALLS_ENABLED;

    return {
      addressAllowed,
      liveCallsEnabled,
      allowedAddressMode,
      allowedAddresses,
      reason: !addressAllowed
        ? "Address is not allowed by KADASTER_ALLOWED_ADDRESS_MODE/KADASTER_ALLOWED_ADDRESSES."
        : !liveCallsEnabled
          ? "Live Kadaster calls are disabled by KADASTER_LIVE_CALLS_ENABLED."
          : null,
    };
  }

  async getCachedDashboard(address: string): Promise<CachedKadasterDashboard | null> {
    const addressKey = normalizeAddressKey(address);
    const redisCandidates = await this.readRedisCandidates(addressKey);
    const bestRedisCandidate = this.pickBestCandidate(redisCandidates);

    if (bestRedisCandidate) {
      return {
        cacheKey: bestRedisCandidate.cacheKey,
        data: bestRedisCandidate.data,
        expiresAt: bestRedisCandidate.expiresAt,
        stale: bestRedisCandidate.stale,
        source: "redis",
        migratedToRedis: false,
      };
    }

    const legacyCandidates: DashboardCacheCandidate[] = [];

    // Cost guard: this service is intentionally cache-only. Do not add a
    // Kadaster fetch fallback here; live paid calls need a separate explicit flow.
    for (const cacheRoot of configuredCacheRoots()) {
      const dashboardDir = path.join(cacheRoot, DASHBOARD_CACHE_SUBDIR);
      const fileNames = await this.safeReadDir(dashboardDir);

      for (const fileName of fileNames) {
        if (!fileName.startsWith(`${addressKey}:`) || !fileName.endsWith(".json")) {
          continue;
        }

        const candidate = await this.readCandidate(path.join(dashboardDir, fileName), fileName);
        if (candidate) {
          legacyCandidates.push(candidate);
        }
      }
    }

    const bestLegacyCandidate = this.pickBestCandidate(legacyCandidates);
    if (!bestLegacyCandidate) {
      return null;
    }

    const migratedToRedis = await this.tryWriteRedisCandidate(bestLegacyCandidate);
    return {
      cacheKey: bestLegacyCandidate.cacheKey,
      data: bestLegacyCandidate.data,
      expiresAt: bestLegacyCandidate.expiresAt,
      stale: bestLegacyCandidate.stale,
      source: "legacy-file",
      migratedToRedis,
    };
  }

  private pickBestCandidate(
    candidates: DashboardCacheCandidate[],
  ): DashboardCacheCandidate | null {
    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((left, right) => {
      const expiryDelta = (right.expiresAt ?? 0) - (left.expiresAt ?? 0);
      return expiryDelta !== 0 ? expiryDelta : right.mtimeMs - left.mtimeMs;
    });

    return candidates[0];
  }

  private async readRedisCandidates(addressKey: string): Promise<DashboardCacheCandidate[]> {
    try {
      const prefix = redisCacheKey("dashboard", "");
      const keys = await redisScanKeys(`${prefix}${addressKey}:*`);

      const candidates: Array<DashboardCacheCandidate | null> = await Promise.all(
        keys.map(async (fullKey) => {
          const cacheKey = fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
          const entry = await redisGetJson<DashboardCacheWrapper>("dashboard", cacheKey);
          const unwrapped = unwrapDashboardCache(entry);
          if (!unwrapped) return null;

          return {
            cacheKey,
            data: unwrapped.data,
            expiresAt: unwrapped.expiresAt,
            mtimeMs: 0,
            stale: unwrapped.expiresAt !== null && unwrapped.expiresAt <= Date.now(),
            source: "redis" as const,
          };
        }),
      );

      return candidates.filter(
        (candidate): candidate is DashboardCacheCandidate => candidate !== null,
      );
    } catch (error) {
      console.warn("Redis Kadaster dashboard cache read failed; falling back to legacy file cache.", error);
      return [];
    }
  }

  private async tryWriteRedisCandidate(candidate: DashboardCacheCandidate): Promise<boolean> {
    try {
      await redisSetJson(
        "dashboard",
        candidate.cacheKey,
        {
          data: candidate.data,
          expiresAt: candidate.expiresAt ?? Date.now() + dashboardCacheTtlMs(),
        },
        ttlSecondsForCacheEntry(candidate.expiresAt),
      );

      return true;
    } catch (error) {
      console.warn("Legacy Kadaster dashboard cache was read but Redis migration failed.", error);
      return false;
    }
  }

  private async safeReadDir(directory: string) {
    try {
      return await readdir(directory);
    } catch (error) {
      if (this.isMissingPathError(error)) {
        return [];
      }

      throw error;
    }
  }

  private async readCandidate(
    filePath: string,
    fileName: string,
  ): Promise<DashboardCacheCandidate | null> {
    const [fileContent, fileStats] = await Promise.all([
      readFile(filePath, "utf8"),
      stat(filePath),
    ]);

    const parsed = JSON.parse(fileContent) as unknown;
    const unwrapped = unwrapDashboardCache(parsed);
    if (!unwrapped) {
      return null;
    }

    return {
      cacheKey: fileName.replace(/\.json$/, ""),
      data: unwrapped.data,
      expiresAt: unwrapped.expiresAt,
      mtimeMs: fileStats.mtimeMs,
      stale: unwrapped.expiresAt !== null && unwrapped.expiresAt <= Date.now(),
      source: "legacy-file",
    };
  }

  private isMissingPathError(error: unknown) {
    return Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT",
    );
  }
}
