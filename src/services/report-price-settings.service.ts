import { PrismaClient, UserRole } from "@prisma/client";

import { ReportType } from "../schemas/payments.schema";
import { calculateVatBreakdown, VatPriceType } from "../helpers/vat";
import {
  ReportPriceSettingRow,
  ReportPriceSettingsRepository,
} from "../repositories/report-price-settings.repository";
import { VatSlabsRepository } from "../repositories/vat-slabs.repository";

type CurrentUser = {
  userId: number;
  role: UserRole;
};

type UpdateReportPriceInput = {
  reportType: ReportType;
  amountCents: number;
  vatSlabId?: number;
  vatType?: VatPriceType;
  label?: string;
  currency?: string;
};

const DEFAULT_REPORT_PRICE_SETTINGS: Record<
  ReportType,
  { label: string; amountCents: number; currency: string; order: number }
> = {
  "property-report": {
    label: "HuisValue property report",
    amountCents: 495,
    currency: "EUR",
    order: 1,
  },
  "last-sale-report": {
    label: "Last sale report",
    amountCents: 999,
    currency: "EUR",
    order: 2,
  },
  "sold-home-benchmark-report": {
    label: "Sold Home Benchmark Report",
    amountCents: 999,
    currency: "EUR",
    order: 3,
  },
};

export class ReportPriceSettingsService {
  private readonly reportPriceSettingsRepository: ReportPriceSettingsRepository;
  private readonly vatSlabsRepository: VatSlabsRepository;

  constructor(prisma: PrismaClient) {
    this.reportPriceSettingsRepository = new ReportPriceSettingsRepository(prisma);
    this.vatSlabsRepository = new VatSlabsRepository(prisma);
  }

  async getAll() {
    await this.ensureDefaults();
    const settings = await this.reportPriceSettingsRepository.findAll();

    return settings
      .map(toPublicReportPriceSetting)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getByReportType(reportType: ReportType) {
    await this.ensureDefault(reportType);
    const setting =
      await this.reportPriceSettingsRepository.findByReportType(reportType);

    return toPublicReportPriceSetting(setting ?? defaultRow(reportType));
  }

  async getAmountCents(reportType: ReportType) {
    const setting = await this.getByReportType(reportType);
    return setting.totalAmountCents;
  }

  async update(input: UpdateReportPriceInput, currentUser: CurrentUser) {
    const fallback = DEFAULT_REPORT_PRICE_SETTINGS[input.reportType];
    const fallbackVatSlab = await this.getDefaultVatSlab();
    const existing =
      await this.reportPriceSettingsRepository.findByReportType(input.reportType);
    const vatSlab =
      input.vatSlabId === undefined && existing
        ? await this.vatSlabsRepository.findById(existing.vat_slab_id)
        : input.vatSlabId === undefined
        ? fallbackVatSlab
        : await this.vatSlabsRepository.findById(input.vatSlabId);

    if (!vatSlab) {
      return {
        status: "vat_slab_not_found" as const,
      };
    }
    const vatType = vatSlab.vatType;

    const row = await this.reportPriceSettingsRepository.upsert({
      reportType: input.reportType,
      label: input.label ?? fallback.label,
      amountCents: input.amountCents,
      currency: input.currency ?? fallback.currency,
      vatSlabId: vatSlab.id,
      vatType,
      isActive: true,
      updatedByUserId: currentUser.userId,
    });

    return {
      status: "ok" as const,
      price: toPublicReportPriceSetting(row),
    };
  }

  private async ensureDefaults() {
    await Promise.all(
      Object.keys(DEFAULT_REPORT_PRICE_SETTINGS).map((reportType) =>
        this.ensureDefault(reportType as ReportType),
      ),
    );
  }

  private async ensureDefault(reportType: ReportType) {
    const existing =
      await this.reportPriceSettingsRepository.findByReportType(reportType);
    if (existing) return existing;

    const fallback = DEFAULT_REPORT_PRICE_SETTINGS[reportType];
    const vatSlab = await this.getDefaultVatSlab();
    return this.reportPriceSettingsRepository.upsert({
      reportType,
      label: fallback.label,
      amountCents: fallback.amountCents,
      currency: fallback.currency,
      vatSlabId: vatSlab.id,
      vatType: vatSlab.vatType,
      isActive: true,
    });
  }

  private async getDefaultVatSlab() {
    const existing = await this.vatSlabsRepository.findByCode("VAT_0");
    if (existing) {
      return existing;
    }

    return this.vatSlabsRepository.create({
      code: "VAT_0",
      name: "0% VAT",
      rateBps: 0,
      vatType: "ZERO",
      isActive: true,
    });
  }
}

export function getDefaultReportPriceSetting(reportType: ReportType) {
  return toPublicReportPriceSetting(defaultRow(reportType));
}

function defaultRow(reportType: ReportType): ReportPriceSettingRow {
  const fallback = DEFAULT_REPORT_PRICE_SETTINGS[reportType];
  const now = new Date();

  return {
    id: 0,
    report_type: reportType,
    label: fallback.label,
    amount_cents: fallback.amountCents,
    currency: fallback.currency,
    vat_slab_id: 0,
    vat_type: "ZERO",
    vat_slab_code: "VAT_0",
    vat_slab_name: "0% VAT",
    vat_rate_bps: 0,
    is_active: true,
    updated_by_user_id: null,
    created_at: now,
    updated_at: now,
  };
}

function toPublicReportPriceSetting(row: ReportPriceSettingRow) {
  const reportType = row.report_type as ReportType;
  const breakdown = calculateVatBreakdown({
    amountCents: row.amount_cents,
    vatRateBps: row.vat_rate_bps,
    vatType: row.vat_type,
  });

  return {
    id: row.id,
    reportType,
    label: row.label,
    amountCents: row.amount_cents,
    netAmountCents: breakdown.netAmountCents,
    vatAmountCents: breakdown.vatAmountCents,
    totalAmountCents: breakdown.totalAmountCents,
    vatType: row.vat_type,
    currency: row.currency,
    vatSlabId: row.vat_slab_id,
    vatSlab: {
      id: row.vat_slab_id,
      code: row.vat_slab_code,
      name: row.vat_slab_name,
      rateBps: row.vat_rate_bps,
      ratePercent: row.vat_rate_bps / 100,
      vatType: row.vat_type,
    },
    isActive: row.is_active,
    updatedByUserId: row.updated_by_user_id,
    sortOrder: DEFAULT_REPORT_PRICE_SETTINGS[reportType]?.order ?? 99,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
