import { PrismaClient, UserRole } from "@prisma/client";

import { ReportType } from "../schemas/payments.schema";
import {
  ReportPriceSettingRow,
  ReportPriceSettingsRepository,
} from "../repositories/report-price-settings.repository";

type CurrentUser = {
  userId: number;
  role: UserRole;
};

type UpdateReportPriceInput = {
  reportType: ReportType;
  amountCents: number;
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

  constructor(prisma: PrismaClient) {
    this.reportPriceSettingsRepository = new ReportPriceSettingsRepository(prisma);
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
    return setting.amountCents;
  }

  async update(input: UpdateReportPriceInput, currentUser: CurrentUser) {
    const fallback = DEFAULT_REPORT_PRICE_SETTINGS[input.reportType];
    const row = await this.reportPriceSettingsRepository.upsert({
      reportType: input.reportType,
      label: input.label ?? fallback.label,
      amountCents: input.amountCents,
      currency: input.currency ?? fallback.currency,
      isActive: true,
      updatedByUserId: currentUser.userId,
    });

    return toPublicReportPriceSetting(row);
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
    return this.reportPriceSettingsRepository.upsert({
      reportType,
      label: fallback.label,
      amountCents: fallback.amountCents,
      currency: fallback.currency,
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
    is_active: true,
    updated_by_user_id: null,
    created_at: now,
    updated_at: now,
  };
}

function toPublicReportPriceSetting(row: ReportPriceSettingRow) {
  const reportType = row.report_type as ReportType;

  return {
    id: row.id,
    reportType,
    label: row.label,
    amountCents: row.amount_cents,
    currency: row.currency,
    isActive: row.is_active,
    updatedByUserId: row.updated_by_user_id,
    sortOrder: DEFAULT_REPORT_PRICE_SETTINGS[reportType]?.order ?? 99,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
