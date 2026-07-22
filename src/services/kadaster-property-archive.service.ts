import crypto from "node:crypto";

import {
  Prisma,
  PrismaClient,
  PropertyDataSource,
  PropertySourceCallStatus,
  PropertySourceCallType,
  ValuationConfidence,
} from "@prisma/client";

import { ArchiveKadasterDashboardInput } from "../schemas/kadaster-dashboard.schema";

type JsonRecord = Record<string, unknown>;

type ArchiveResult = {
  propertyId: number;
  sourceCallId: number;
  inserted: {
    sourceSnapshot: boolean;
    factSnapshot: boolean;
    saleSnapshot: boolean;
    ownershipSnapshot: boolean;
    energyLabelSnapshot: boolean;
    wozValueSnapshot: boolean;
    valuationSnapshot: boolean;
  };
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  }

  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function asDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) return null;

  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  const normalized = compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : text;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeAddressKey(address: string): string {
  return address.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashJson(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function confidence(value: unknown): ValuationConfidence | null {
  const normalized = asString(value)?.toUpperCase();
  if (normalized === "HIGH") return ValuationConfidence.HIGH;
  if (normalized === "MEDIUM") return ValuationConfidence.MEDIUM;
  if (normalized === "LOW") return ValuationConfidence.LOW;
  return null;
}

async function createIfMissing<T>(
  findExisting: () => Promise<T | null>,
  create: () => Promise<T>,
): Promise<boolean> {
  const existing = await findExisting();
  if (existing) return false;

  await create();
  return true;
}

export class KadasterPropertyArchiveService {
  constructor(private readonly prisma: PrismaClient) {}

  async archiveDashboard(input: ArchiveKadasterDashboardInput): Promise<ArchiveResult> {
    const root = asRecord(input.dashboard) ?? {};
    const data = asRecord(root.data) ?? root;
    const cards = asRecord(data.cards) ?? {};
    const address = asRecord(data.address) ?? {};
    const property = asRecord(cards.property) ?? {};
    const market = asRecord(cards.market) ?? {};
    const parcelInsight = asRecord(cards.parcelInsight) ?? {};
    const energyLabel = asRecord(cards.energyLabel) ?? {};
    const ownership = asRecord(cards.ownership) ?? {};
    const legalRegistry = asRecord(cards.legalRegistry) ?? {};
    const objectinformatie = asRecord(cards.objectinformatie) ?? {};

    const displayAddress =
      asString(address.display) ||
      asString(property.address) ||
      input.address;
    const addressKey = normalizeAddressKey(displayAddress);
    const bagVboId =
      asString(property.id) ||
      asString(property.bagVboId) ||
      asString(property.bag_vbo_id);
    const bagPandId =
      asString(property.pandId) ||
      asString(property.bagPandId) ||
      asString(property.bag_pand_id);
    const latestPurchasePrice = asPositiveInt(market.latestPurchasePrice);
    const latestPurchaseDate = asDate(market.latestPurchaseDate);
    const livingAreaM2 = asPositiveInt(property.livingArea);
    const plotAreaM2 = asPositiveInt(parcelInsight.parcelSize);
    const buildYear = asPositiveInt(property.buildYear);
    const estimatedValueEur = asPositiveInt(market.estimatedValue);
    const valueLowEur = asPositiveInt(market.valueLow);
    const valueHighEur = asPositiveInt(market.valueHigh);
    const pricePerSqmEur = asPositiveInt(market.pricePerSqm);
    const label = asString(energyLabel.label);
    const ownerType = asString(ownership.ownerType);
    const ownerShareCount = asPositiveInt(parcelInsight.rightHolderCount);
    const hasActiveMortgage = Array.isArray(legalRegistry.mortgageRecords)
      ? legalRegistry.mortgageRecords.length > 0
      : null;
    const hasLegalEncumbrance = Boolean(
      asString(ownership.legalRight) ||
        (Array.isArray(legalRegistry.currentRightHolders) &&
          legalRegistry.currentRightHolders.length > 0),
    );
    const wozValueEur = asPositiveInt(objectinformatie.wozValue);

    const existingProperty = await this.prisma.property.findFirst({
      where: {
        OR: [
          { addressKey },
          ...(bagVboId ? [{ bagVboId }] : []),
        ],
      },
    });
    const propertyData = {
      displayAddress,
      street: asString(address.street),
      houseNumber: asString(address.houseNumber),
      houseLetter: asString(address.houseLetter),
      houseNumberAddition: asString(address.houseNumberAddition),
      postcode: asString(address.postalCode) || asString(address.postcode),
      city: asString(address.city),
      municipality: asString(address.municipality),
      bagVboId,
      bagPandId,
      kadasterNumber: asString(parcelInsight.cadastralDesignation),
      latitude: asNumber(address.latitude),
      longitude: asNumber(address.longitude),
    };
    const archivedProperty = existingProperty
      ? await this.prisma.property.update({
          where: { id: existingProperty.id },
          data: {
            ...propertyData,
            addressKey: existingProperty.addressKey || addressKey,
          },
        })
      : await this.prisma.property.create({
          data: {
            addressKey,
            ...propertyData,
          },
        });

    const rawPayload = {
      dashboard: input.dashboard,
      reportId: input.reportId ?? null,
      cacheKey: input.cacheKey ?? null,
    };
    const normalizedPayload = {
      displayAddress,
      livingAreaM2,
      plotAreaM2,
      buildYear,
      energyLabel: label,
      latestPurchasePrice,
      latestPurchaseDate: latestPurchaseDate?.toISOString() ?? null,
      ownerType,
      ownerShareCount,
      hasActiveMortgage,
      hasLegalEncumbrance,
      wozValueEur,
      estimatedValueEur,
      valueLowEur,
      valueHighEur,
      pricePerSqmEur,
    };
    const responseHash = hashJson(rawPayload);
    const normalizedHash = hashJson(normalizedPayload);

    const sourceCall = await this.prisma.propertySourceCall.create({
      data: {
        propertyId: archivedProperty.id,
        source: PropertyDataSource.KADASTER,
        sourceProduct: "kadaster-dashboard",
        callType: PropertySourceCallType.LIVE_PAID,
        status: PropertySourceCallStatus.SUCCESS,
        completedAt: new Date(),
        responseHash,
        metadata: jsonInput({
          reportId: input.reportId ?? null,
          cacheKey: input.cacheKey ?? null,
        }),
      },
    });

    await this.prisma.propertyCurrentFact.upsert({
      where: { propertyId: archivedProperty.id },
      update: {
        lastSourceCallId: sourceCall.id,
        livingAreaM2,
        plotAreaM2,
        buildYear,
        propertyType: asString(property.type),
        usagePurpose: asString(property.usagePurpose),
        energyLabel: label,
        lastSalePriceEur: latestPurchasePrice,
        lastSaleDate: latestPurchaseDate,
        ownershipOwnerType: ownerType,
        ownerShareCount,
        hasActiveMortgage,
        hasLegalEncumbrance,
        kadasterNumber: asString(parcelInsight.cadastralDesignation),
        estimatedValueEur,
        valuationConfidence: confidence(market.confidence),
        dataHash: normalizedHash,
        lastRefreshedAt: new Date(),
      },
      create: {
        propertyId: archivedProperty.id,
        lastSourceCallId: sourceCall.id,
        livingAreaM2,
        plotAreaM2,
        buildYear,
        propertyType: asString(property.type),
        usagePurpose: asString(property.usagePurpose),
        energyLabel: label,
        lastSalePriceEur: latestPurchasePrice,
        lastSaleDate: latestPurchaseDate,
        ownershipOwnerType: ownerType,
        ownerShareCount,
        hasActiveMortgage,
        hasLegalEncumbrance,
        kadasterNumber: asString(parcelInsight.cadastralDesignation),
        estimatedValueEur,
        valuationConfidence: confidence(market.confidence),
        dataHash: normalizedHash,
        lastRefreshedAt: new Date(),
      },
    });

    const sourceSnapshotInserted = await createIfMissing(
      () =>
        this.prisma.propertySourceSnapshot.findFirst({
          where: { propertyId: archivedProperty.id, responseHash },
        }),
      () =>
        this.prisma.propertySourceSnapshot.create({
          data: {
            propertyId: archivedProperty.id,
            sourceCallId: sourceCall.id,
            source: PropertyDataSource.KADASTER,
            sourceProduct: "kadaster-dashboard",
            rawPayload: jsonInput(rawPayload),
            normalizedPayload: jsonInput(normalizedPayload),
            responseHash,
            normalizedHash,
          },
        }),
    );

    const factSnapshotInserted = await createIfMissing(
      () =>
        this.prisma.propertyFactSnapshot.findFirst({
          where: { propertyId: archivedProperty.id, normalizedHash },
        }),
      () =>
        this.prisma.propertyFactSnapshot.create({
          data: {
            propertyId: archivedProperty.id,
            sourceCallId: sourceCall.id,
            livingAreaM2,
            plotAreaM2,
            buildYear,
            propertyType: asString(property.type),
            usagePurpose: asString(property.usagePurpose),
            bagVboStatus: asString(property.status),
            normalizedHash,
          },
        }),
    );

    const saleHash = hashJson({
      latestPurchasePrice,
      latestPurchaseDate: latestPurchaseDate?.toISOString() ?? null,
      livingAreaM2,
    });
    const saleSnapshotInserted =
      latestPurchasePrice || latestPurchaseDate
        ? await createIfMissing(
            () =>
              this.prisma.propertySaleSnapshot.findFirst({
                where: { propertyId: archivedProperty.id, normalizedHash: saleHash },
              }),
            () =>
              this.prisma.propertySaleSnapshot.create({
                data: {
                  propertyId: archivedProperty.id,
                  sourceCallId: sourceCall.id,
                  saleDate: latestPurchaseDate,
                  saleYear: latestPurchaseDate?.getFullYear() ?? null,
                  salePriceEur: latestPurchasePrice,
                  pricePerSqmEur:
                    latestPurchasePrice && livingAreaM2
                      ? Math.round(latestPurchasePrice / livingAreaM2)
                      : null,
                  surfaceAreaM2: livingAreaM2,
                  normalizedHash: saleHash,
                },
              }),
          )
        : false;

    const energyHash = hashJson({
      label,
      energyIndex: asNumber(energyLabel.energyIndex),
      registrationDate: energyLabel.registrationDate,
      validUntil: energyLabel.validUntil,
    });
    const energyLabelSnapshotInserted = label
      ? await createIfMissing(
          () =>
            this.prisma.propertyEnergyLabelSnapshot.findFirst({
              where: { propertyId: archivedProperty.id, normalizedHash: energyHash },
            }),
          () =>
            this.prisma.propertyEnergyLabelSnapshot.create({
              data: {
                propertyId: archivedProperty.id,
                sourceCallId: sourceCall.id,
                label,
                energyIndex: asNumber(energyLabel.energyIndex),
                issuedAt: asDate(energyLabel.registrationDate),
                validUntil: asDate(energyLabel.validUntil),
                sourceBagId: bagVboId,
                normalizedHash: energyHash,
              },
            }),
        )
      : false;

    const ownershipHash = hashJson({
      ownerType,
      ownerShareCount,
      hasActiveMortgage,
      hasLegalEncumbrance,
      legalRight: ownership.legalRight,
      registrationDate: ownership.registrationDate,
      cadastralDesignation: parcelInsight.cadastralDesignation,
    });
    const ownershipSnapshotInserted =
      ownerType || ownerShareCount || hasActiveMortgage || hasLegalEncumbrance
        ? await createIfMissing(
            () =>
              this.prisma.propertyOwnershipSnapshot.findFirst({
                where: { propertyId: archivedProperty.id, normalizedHash: ownershipHash },
              }),
            () =>
              this.prisma.propertyOwnershipSnapshot.create({
                data: {
                  propertyId: archivedProperty.id,
                  sourceCallId: sourceCall.id,
                  ownerType,
                  ownerShareCount,
                  hasActiveMortgage: Boolean(hasActiveMortgage),
                  hasLegalEncumbrance,
                  kadasterNumber: asString(parcelInsight.cadastralDesignation),
                  normalizedHash: ownershipHash,
                },
              }),
          )
        : false;

    const wozHash = hashJson({
      wozValueEur,
      addressKey,
    });
    const wozValueSnapshotInserted = wozValueEur
      ? await createIfMissing(
          () =>
            this.prisma.propertyWozValueSnapshot.findFirst({
              where: { propertyId: archivedProperty.id, normalizedHash: wozHash },
            }),
          () =>
            this.prisma.propertyWozValueSnapshot.create({
              data: {
                propertyId: archivedProperty.id,
                sourceCallId: sourceCall.id,
                valueYear: new Date().getFullYear(),
                valueEur: wozValueEur,
                normalizedHash: wozHash,
              },
            }),
        )
      : false;

    const valuationHash = hashJson({
      estimatedValueEur,
      valueLowEur,
      valueHighEur,
      confidence: market.confidence,
      pricePerSqmEur,
      latestPurchasePrice,
      latestPurchaseDate: latestPurchaseDate?.toISOString() ?? null,
    });
    const valuationSnapshotInserted =
      estimatedValueEur && valueLowEur && valueHighEur && pricePerSqmEur
        ? await createIfMissing(
            () =>
              this.prisma.propertyValuationSnapshot.findFirst({
                where: { propertyId: archivedProperty.id, normalizedHash: valuationHash },
              }),
            () =>
              this.prisma.propertyValuationSnapshot.create({
                data: {
                  propertyId: archivedProperty.id,
                  sourceCallId: sourceCall.id,
                  estimatedValueEur,
                  valueLowEur,
                  valueHighEur,
                  confidence: confidence(market.confidence) ?? ValuationConfidence.LOW,
                  pricePerSqmEur,
                  lastSalePriceEur: latestPurchasePrice,
                  lastSaleDate: latestPurchaseDate,
                  methodology: "Kadaster dashboard archive",
                  modelVersion: asString(market.modelVersion),
                  normalizedHash: valuationHash,
                },
              }),
          )
        : false;

    return {
      propertyId: archivedProperty.id,
      sourceCallId: sourceCall.id,
      inserted: {
        sourceSnapshot: sourceSnapshotInserted,
        factSnapshot: factSnapshotInserted,
        saleSnapshot: saleSnapshotInserted,
        ownershipSnapshot: ownershipSnapshotInserted,
        energyLabelSnapshot: energyLabelSnapshotInserted,
        wozValueSnapshot: wozValueSnapshotInserted,
        valuationSnapshot: valuationSnapshotInserted,
      },
    };
  }
}
