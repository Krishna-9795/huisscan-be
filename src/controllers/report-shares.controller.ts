import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import { shareReportSchema } from "../schemas/report-shares.schema";
import { ReportSharesService } from "../services/report-shares.service";

export async function shareReport(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = shareReportSchema.parse(request.body);
  const reportSharesService = new ReportSharesService(request.server.prisma);
  const result = await reportSharesService.sharePaidReport(request.user, body);

  return reply.send(successResponse(result, "Report shared"));
}
