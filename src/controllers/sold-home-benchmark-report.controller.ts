import { FastifyReply, FastifyRequest } from "fastify";

import { soldHomeBenchmarkReportQuerySchema } from "../schemas/sold-home-benchmark-report.schema";
import { SoldHomeBenchmarkReportService } from "../services/sold-home-benchmark-report.service";

export async function getSoldHomeBenchmarkReport(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { reportId } = soldHomeBenchmarkReportQuerySchema.parse(request.query);
  const reportService = new SoldHomeBenchmarkReportService(request.server.prisma);
  const report = await reportService.getByReportId(reportId, request.user);

  if (!report) {
    throw request.server.httpErrors.notFound("Saved report not found");
  }

  return reply.send(report);
}
