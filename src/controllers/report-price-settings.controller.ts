import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import {
  reportPriceSettingParamsSchema,
  updateReportPriceSettingBodySchema,
} from "../schemas/report-price-settings.schema";
import { ReportPriceSettingsService } from "../services/report-price-settings.service";

export async function getReportPriceSettings(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const reportPriceSettingsService = new ReportPriceSettingsService(
    request.server.prisma,
  );
  const prices = await reportPriceSettingsService.getAll();

  return reply.send(successResponse({ prices }));
}

export async function getReportPriceSetting(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { reportType } = reportPriceSettingParamsSchema.parse(request.params);
  const reportPriceSettingsService = new ReportPriceSettingsService(
    request.server.prisma,
  );
  const price = await reportPriceSettingsService.getByReportType(reportType);

  return reply.send(successResponse({ price }));
}

export async function updateReportPriceSetting(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { reportType } = reportPriceSettingParamsSchema.parse(request.params);
  const body = updateReportPriceSettingBodySchema.parse(request.body);
  const reportPriceSettingsService = new ReportPriceSettingsService(
    request.server.prisma,
  );
  const price = await reportPriceSettingsService.update(
    {
      reportType,
      amountCents: body.amountCents,
      label: body.label,
      currency: body.currency,
    },
    request.user,
  );

  return reply.send(successResponse({ price }));
}
