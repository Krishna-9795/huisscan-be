import { PrismaClient } from "@prisma/client";

export type ReportPriceSettingRow = {
  id: number;
  report_type: string;
  label: string;
  amount_cents: number;
  currency: string;
  is_active: boolean;
  updated_by_user_id: number | null;
  created_at: Date;
  updated_at: Date;
};

export type UpsertReportPriceSettingInput = {
  reportType: string;
  label: string;
  amountCents: number;
  currency: string;
  isActive: boolean;
  updatedByUserId?: number;
};

export class ReportPriceSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAll() {
    return this.prisma.$queryRaw<ReportPriceSettingRow[]>`
      SELECT
        id,
        report_type,
        label,
        amount_cents,
        currency,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      FROM report_price_settings
      ORDER BY report_type ASC
    `;
  }

  async findByReportType(reportType: string) {
    const rows = await this.prisma.$queryRaw<ReportPriceSettingRow[]>`
      SELECT
        id,
        report_type,
        label,
        amount_cents,
        currency,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      FROM report_price_settings
      WHERE report_type = ${reportType}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async upsert(input: UpsertReportPriceSettingInput) {
    const rows = await this.prisma.$queryRaw<ReportPriceSettingRow[]>`
      INSERT INTO report_price_settings
        (
          report_type,
          label,
          amount_cents,
          currency,
          is_active,
          updated_by_user_id,
          updated_at
        )
      VALUES
        (
          ${input.reportType},
          ${input.label},
          ${input.amountCents},
          ${input.currency},
          ${input.isActive},
          ${input.updatedByUserId ?? null},
          NOW()
        )
      ON CONFLICT (report_type) DO UPDATE SET
        label = EXCLUDED.label,
        amount_cents = EXCLUDED.amount_cents,
        currency = EXCLUDED.currency,
        is_active = EXCLUDED.is_active,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING
        id,
        report_type,
        label,
        amount_cents,
        currency,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
    `;

    return rows[0];
  }
}
