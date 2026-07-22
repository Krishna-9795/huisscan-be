import { PrismaClient } from "@prisma/client";

export type ReportPriceSettingRow = {
  id: number;
  report_type: string;
  label: string;
  amount_cents: number;
  currency: string;
  vat_slab_id: number;
  vat_type: "ZERO" | "INCLUSIVE" | "EXCLUSIVE";
  vat_slab_code: string;
  vat_slab_name: string;
  vat_rate_bps: number;
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
  vatSlabId: number;
  vatType: "ZERO" | "INCLUSIVE" | "EXCLUSIVE";
  isActive: boolean;
  updatedByUserId?: number;
};

export class ReportPriceSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAll() {
    return this.prisma.$queryRaw<ReportPriceSettingRow[]>`
      SELECT
        rps.id,
        rps.report_type,
        rps.label,
        rps.amount_cents,
        rps.currency,
        rps.vat_slab_id,
        vs.vat_type,
        vs.code AS vat_slab_code,
        vs.name AS vat_slab_name,
        vs.rate_bps AS vat_rate_bps,
        rps.is_active,
        rps.updated_by_user_id,
        rps.created_at,
        rps.updated_at
      FROM report_price_settings rps
      INNER JOIN vat_slabs vs ON vs.id = rps.vat_slab_id
      ORDER BY rps.report_type ASC
    `;
  }

  async findByReportType(reportType: string) {
    const rows = await this.prisma.$queryRaw<ReportPriceSettingRow[]>`
      SELECT
        rps.id,
        rps.report_type,
        rps.label,
        rps.amount_cents,
        rps.currency,
        rps.vat_slab_id,
        vs.vat_type,
        vs.code AS vat_slab_code,
        vs.name AS vat_slab_name,
        vs.rate_bps AS vat_rate_bps,
        rps.is_active,
        rps.updated_by_user_id,
        rps.created_at,
        rps.updated_at
      FROM report_price_settings rps
      INNER JOIN vat_slabs vs ON vs.id = rps.vat_slab_id
      WHERE rps.report_type = ${reportType}
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
          vat_slab_id,
          vat_type,
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
          ${input.vatSlabId},
          ${input.vatType}::"VatPriceType",
          ${input.isActive},
          ${input.updatedByUserId ?? null},
          NOW()
        )
      ON CONFLICT (report_type) DO UPDATE SET
        label = EXCLUDED.label,
        amount_cents = EXCLUDED.amount_cents,
        currency = EXCLUDED.currency,
        vat_slab_id = EXCLUDED.vat_slab_id,
        vat_type = EXCLUDED.vat_type,
        is_active = EXCLUDED.is_active,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING
        report_price_settings.id,
        report_price_settings.report_type,
        report_price_settings.label,
        report_price_settings.amount_cents,
        report_price_settings.currency,
        report_price_settings.vat_slab_id,
        (
          SELECT vat_type FROM vat_slabs WHERE id = report_price_settings.vat_slab_id
        ) AS vat_type,
        (
          SELECT code FROM vat_slabs WHERE id = report_price_settings.vat_slab_id
        ) AS vat_slab_code,
        (
          SELECT name FROM vat_slabs WHERE id = report_price_settings.vat_slab_id
        ) AS vat_slab_name,
        (
          SELECT rate_bps FROM vat_slabs WHERE id = report_price_settings.vat_slab_id
        ) AS vat_rate_bps,
        report_price_settings.is_active,
        report_price_settings.updated_by_user_id,
        report_price_settings.created_at,
        report_price_settings.updated_at
    `;

    return rows[0];
  }
}
