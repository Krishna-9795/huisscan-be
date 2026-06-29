import { Prisma, PrismaClient, UserRole } from "@prisma/client";

import {
  PdokAddressCandidate,
  PdokAddressService,
} from "./pdok-address.service";
import { SavedReportsRepository } from "../repositories/saved-reports.repository";

type CurrentUser = {
  userId: string;
  role: UserRole;
};

type JsonObject = Record<string, unknown>;

type Coordinates = {
  latitude: number;
  longitude: number;
};

type TargetAddress = {
  display: string;
  propertyId: string;
  postcode: string | null;
  city: string | null;
  coordinates: Coordinates | null;
};

export type SoldHomeBenchmarkReport = {
  target: {
    address: TargetAddress;
    livingArea: number | null;
    buildYear: number | null;
    propertyType: string | null;
    energyLabel: string | null;
  };
  nearbyHomes: Array<{
    id: string;
    address: string;
    bagId: string | null;
    distanceMeters: number;
  }>;
};

const LIVING_AREA_KEYS = [
  "livingArea",
  "livingAreaM2",
  "living_area",
  "woonoppervlakte",
  "oppervlakteWonen",
  "gebruiksoppervlakteWonen",
  "gebruiksoppervlakte",
  "surfaceArea",
  "surface_area",
  "area",
];

const BUILD_YEAR_KEYS = ["buildYear", "bouwjaar", "yearBuilt"];
const PROPERTY_TYPE_KEYS = ["propertyType", "property_type", "gebruiksdoel", "type"];
const ENERGY_LABEL_KEYS = ["energyLabel", "energy_label", "energielabel", "label"];
const POSTCODE_KEYS = ["postcode", "postalCode", "postal_code"];
const CITY_KEYS = ["city", "plaats", "woonplaats", "woonplaatsnaam"];
const HOUSE_NUMBER_KEYS = ["houseNumber", "huisnummer"];
const TARGET_ID_KEYS = [
  "bagId",
  "bag_id",
  "adresseerbaarobject_id",
  "adresseerbaarobjectId",
  "nummeraanduiding_id",
  "nummeraanduidingId",
  "vboId",
  "objectId",
];

export class SoldHomeBenchmarkReportService {
  private readonly savedReportsRepository: SavedReportsRepository;
  private readonly pdokAddressService: PdokAddressService;

  constructor(prisma: PrismaClient, pdokAddressService = new PdokAddressService()) {
    this.savedReportsRepository = new SavedReportsRepository(prisma);
    this.pdokAddressService = pdokAddressService;
  }

  async getByReportId(reportId: string, currentUser: CurrentUser) {
    const savedReport = await this.savedReportsRepository.findById(reportId);

    if (!savedReport || !canAccessUserResource(currentUser, savedReport.userId)) {
      return null;
    }

    const reportData = asObject(savedReport.reportData) ?? {};
    const targetAddress = buildTargetAddress({
      address: savedReport.address,
      propertyId: savedReport.propertyId,
      reportData,
    });

    const target = {
      address: targetAddress,
      livingArea: getTargetLivingArea(reportData),
      buildYear: getNumberFromKeys(reportData, BUILD_YEAR_KEYS),
      propertyType: getStringFromKeys(reportData, PROPERTY_TYPE_KEYS),
      energyLabel: getStringFromKeys(reportData, ENERGY_LABEL_KEYS),
    };

    const nearbyHomes =
      targetAddress.postcode && targetAddress.coordinates
        ? await this.getNearbyHomes({
            reportData,
            targetAddress,
          })
        : [];

    return {
      target,
      nearbyHomes,
    } satisfies SoldHomeBenchmarkReport;
  }

  private async getNearbyHomes({
    reportData,
    targetAddress,
  }: {
    reportData: JsonObject;
    targetAddress: TargetAddress;
  }) {
    if (!targetAddress.postcode || !targetAddress.coordinates) {
      return [];
    }

    const targetIds = new Set([
      targetAddress.propertyId,
      ...getStringsFromKeys(reportData, TARGET_ID_KEYS),
    ]);
    const targetHouseNumber =
      getStringFromKeys(reportData, HOUSE_NUMBER_KEYS) ||
      parseHouseNumber(targetAddress.display);
    const targetAddressKey = normalizeComparableAddress(targetAddress.display);

    const candidates = await this.pdokAddressService.findAddressCandidates({
      postcode: targetAddress.postcode,
      latitude: targetAddress.coordinates.latitude,
      longitude: targetAddress.coordinates.longitude,
    });

    return candidates
      .map((candidate) =>
        toNearbyHome(candidate, targetAddress.coordinates as Coordinates),
      )
      .filter((candidate) => !isTargetAddress(candidate.source, targetAddressKey, targetHouseNumber, targetIds))
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, 7)
      .map(({ source: _source, ...nearbyHome }) => nearbyHome);
  }
}

function buildTargetAddress({
  address,
  propertyId,
  reportData,
}: {
  address: string;
  propertyId: string;
  reportData: JsonObject;
}): TargetAddress {
  return {
    display: address,
    propertyId,
    postcode: getStringFromKeys(reportData, POSTCODE_KEYS) || parsePostcode(address),
    city: getStringFromKeys(reportData, CITY_KEYS),
    coordinates: getCoordinates(reportData),
  };
}

function getTargetLivingArea(reportData: JsonObject) {
  const cachedKadasterLivingArea = getNumberFromKeys(reportData, LIVING_AREA_KEYS, {
    includePath: /kadaster|cache/i,
  });

  if (cachedKadasterLivingArea !== null) {
    return cachedKadasterLivingArea;
  }

  return getNumberFromKeys(reportData, LIVING_AREA_KEYS, {
    excludePath: /kadaster|koopsom|sale|sold|price|waarde/i,
  });
}

function toNearbyHome(candidate: PdokAddressCandidate, targetCoordinates: Coordinates) {
  const distanceMeters =
    candidate.latitude !== null && candidate.longitude !== null
      ? Math.round(
          getDistanceMeters(targetCoordinates, {
            latitude: candidate.latitude,
            longitude: candidate.longitude,
          }),
        )
      : Number.MAX_SAFE_INTEGER;

  return {
    id: candidate.id,
    address: candidate.address,
    bagId: candidate.bagId,
    distanceMeters,
    source: candidate,
  };
}

function isTargetAddress(
  candidate: PdokAddressCandidate,
  targetAddressKey: string,
  targetHouseNumber: string | null,
  targetIds: Set<string>,
) {
  const candidateIds = [candidate.id, candidate.bagId].filter(
    (value): value is string => Boolean(value),
  );

  if (candidateIds.some((id) => targetIds.has(id))) {
    return true;
  }

  if (normalizeComparableAddress(candidate.address) === targetAddressKey) {
    return true;
  }

  return Boolean(
    targetHouseNumber &&
      candidate.houseNumber &&
      normalizeComparableAddress(candidate.houseNumber) ===
        normalizeComparableAddress(targetHouseNumber),
  );
}

function getCoordinates(value: unknown): Coordinates | null {
  const object = asObject(value);

  if (!object) {
    return null;
  }

  const direct = getCoordinatePair(object);

  if (direct) {
    return direct;
  }

  for (const child of Object.values(object)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const coordinates = getCoordinates(item);

        if (coordinates) {
          return coordinates;
        }
      }

      continue;
    }

    const coordinates = getCoordinates(child);

    if (coordinates) {
      return coordinates;
    }
  }

  return null;
}

function getCoordinatePair(object: JsonObject): Coordinates | null {
  const latitude = getNumericProperty(object, ["latitude", "lat"]);
  const longitude = getNumericProperty(object, ["longitude", "lng", "lon"]);

  if (latitude === null || longitude === null) {
    return null;
  }

  if (latitude < 50 || latitude > 54 || longitude < 3 || longitude > 8) {
    return null;
  }

  return { latitude, longitude };
}

function getNumericProperty(object: JsonObject, keys: string[]) {
  for (const [key, value] of Object.entries(object)) {
    if (keys.includes(key)) {
      const number = toPositiveNumber(value);

      if (number !== null) {
        return number;
      }
    }
  }

  return null;
}

function getNumberFromKeys(
  value: unknown,
  keys: string[],
  options: {
    includePath?: RegExp;
    excludePath?: RegExp;
  } = {},
) {
  return walkValue(value, (candidate, path) => {
    const key = path.at(-1);
    const pathText = path.join(".");

    if (!key || !keys.includes(key)) {
      return null;
    }

    if (options.includePath && !options.includePath.test(pathText)) {
      return null;
    }

    if (options.excludePath?.test(pathText)) {
      return null;
    }

    return toPositiveNumber(candidate);
  });
}

function getStringFromKeys(value: unknown, keys: string[]) {
  return walkValue(value, (candidate, path) => {
    const key = path.at(-1);

    if (!key || !keys.includes(key) || typeof candidate !== "string") {
      return null;
    }

    const trimmed = candidate.trim();
    return trimmed && trimmed !== "-" ? trimmed : null;
  });
}

function getStringsFromKeys(value: unknown, keys: string[]) {
  const values = new Set<string>();

  walkValue(value, (candidate, path) => {
    const key = path.at(-1);

    if (!key || !keys.includes(key)) {
      return null;
    }

    if (typeof candidate === "string" && candidate.trim()) {
      values.add(candidate.trim());
    }

    return null;
  });

  return values;
}

function walkValue<T>(
  value: unknown,
  visitor: (candidate: unknown, path: string[]) => T | null,
  path: string[] = [],
): T | null {
  const result = visitor(value, path);

  if (result !== null) {
    return result;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const childResult = walkValue(value[index], visitor, [...path, String(index)]);

      if (childResult !== null) {
        return childResult;
      }
    }

    return null;
  }

  const object = asObject(value);

  if (!object) {
    return null;
  }

  for (const [key, child] of Object.entries(object)) {
    const childResult = walkValue(child, visitor, [...path, key]);

    if (childResult !== null) {
      return childResult;
    }
  }

  return null;
}

function toPositiveNumber(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[^\d.,-]/g, "").replace(",", "."))
        : NaN;

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return Math.round(number);
}

function parsePostcode(value: string) {
  return value.match(/\b\d{4}\s?[A-Z]{2}\b/i)?.[0].replace(/\s+/g, "").toUpperCase() ?? null;
}

function parseHouseNumber(value: string) {
  const postcodeMatch = value.match(/\b\d{4}\s?[A-Z]{2}\b/i);
  const addressBeforePostcode = postcodeMatch
    ? value.slice(0, postcodeMatch.index)
    : value;

  return addressBeforePostcode.match(/\b\d+\s?[A-Z]?(?:\s?[-/]\s?\w+)?\b/i)?.[0].trim() ?? null;
}

function normalizeComparableAddress(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function asObject(value: Prisma.JsonValue | unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonObject;
}

function getDistanceMeters(from: Coordinates, to: Coordinates) {
  const earthRadiusMeters = 6371000;
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return (
    earthRadiusMeters *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function canAccessUserResource(currentUser: CurrentUser, resourceUserId: string) {
  return currentUser.role === "ADMIN" || currentUser.userId === resourceUserId;
}
