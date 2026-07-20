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

type MutableRecord = Record<string, unknown>;

function normalizeAddressKey(address: string) {
  return address.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function asRecord(value: unknown): MutableRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MutableRecord)
    : null;
}

function asPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function dateToYearPeriod(date: unknown): string | null {
  if (typeof date !== "string" || !date.trim()) return null;

  const text = date.trim();
  const bareYear = text.match(/^\d{4}$/);
  if (bareYear) return `${bareYear[0]}JJ00`;

  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}JJ00`;

  const iso = text.match(/^(\d{4})-\d{2}-\d{2}/);
  if (iso) return `${iso[1]}JJ00`;

  const dutchDate = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dutchDate) return `${dutchDate[3]}JJ00`;

  const yearInText = text.match(/\b(19|20)\d{2}\b/);
  if (yearInText) return `${yearInText[0]}JJ00`;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  return `${parsed.getFullYear()}JJ00`;
}

function completedAnnualTargetYear(now = new Date()) {
  return now.getFullYear() - 1;
}

function shouldUseRecentSaleBaseline(latestPurchaseDate: unknown) {
  const salePeriod = dateToYearPeriod(latestPurchaseDate);
  if (!salePeriod) return false;

  const saleYear = Number(salePeriod.slice(0, 4));
  return Number.isFinite(saleYear) && saleYear >= completedAnnualTargetYear();
}

function buildRecentSaleBaselineIndex(
  latestPurchasePrice: number,
  latestPurchaseDate: unknown,
  address: MutableRecord,
) {
  const salePeriod = dateToYearPeriod(latestPurchaseDate) ?? `${completedAnnualTargetYear()}JJ00`;
  const regionName =
    typeof address.municipality === "string" && address.municipality.trim()
      ? address.municipality
      : "recent sale";

  return {
    salePeriod,
    saleIndex: 1,
    currentPeriod: salePeriod,
    currentIndex: 1,
    factor: 1,
    indexedValue: latestPurchasePrice,
    growthPercentage: 0,
    purchasePrice: latestPurchasePrice,
    sourceTable: "83625ENG",
    sourceTitle: "CBS existing own homes; recent-sale baseline",
    sourceUrl: "https://opendata.cbs.nl/ODataApi/OData/83625ENG",
    regionCode:
      typeof address.municipalityCode === "string" && address.municipalityCode.trim()
        ? address.municipalityCode
        : "RECENT",
    regionName,
    regionLevel:
      typeof address.municipalityCode === "string" && address.municipalityCode.trim()
        ? "municipality"
        : "national",
    periodFrequency: "yearly",
    metricLabel: "Recent sale baseline",
    metricValueKind: "index",
    formula: `${latestPurchasePrice} × (1 ÷ 1) = ${latestPurchasePrice}`,
    explanation:
      `The Kadaster sale is in ${salePeriod.slice(0, 4)}, and there is no completed CBS annual period after that sale year yet. ` +
      `Until a newer completed CBS period exists for ${regionName}, the indexed sale price stays equal to the latest Kadaster sale price: €${latestPurchasePrice.toLocaleString("nl-NL")}.`,
  };
}

function withRecentSaleIndexedMarket(data: unknown): unknown {
  const root = asRecord(data);
  const cards = asRecord(root?.cards);
  const market = asRecord(cards?.market);
  const property = asRecord(cards?.property);
  const address = asRecord(root?.address) ?? {};

  if (!root || !cards || !market) return data;
  if (market.cbsPriceIndex || asPositiveNumber(market.estimatedValue)) return data;

  const latestPurchasePrice = asPositiveNumber(market.latestPurchasePrice);
  if (!latestPurchasePrice || !shouldUseRecentSaleBaseline(market.latestPurchaseDate)) {
    return data;
  }

  const livingArea = asPositiveNumber(property?.livingArea);
  const pricePerSqm = livingArea
    ? Math.round(latestPurchasePrice / livingArea)
    : market.pricePerSqm;

  return {
    ...root,
    cards: {
      ...cards,
      market: {
        ...market,
        estimatedValue: latestPurchasePrice,
        valueLow: Math.round(latestPurchasePrice * 0.95),
        valueHigh: Math.round(latestPurchasePrice * 1.05),
        pricePerSqm,
        confidence: livingArea ? "Medium" : "Low",
        cbsPriceIndex: buildRecentSaleBaselineIndex(
          latestPurchasePrice,
          market.latestPurchaseDate,
          address,
        ),
      },
    },
  };
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
        data: withRecentSaleIndexedMarket(bestRedisCandidate.data),
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
      data: withRecentSaleIndexedMarket(bestLegacyCandidate.data),
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
