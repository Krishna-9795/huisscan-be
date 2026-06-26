import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import {
  createSavedReportSchema,
  savedReportIdParamsSchema,
} from "../schemas/saved-reports.schema";
import { SavedReportsService } from "../services/saved-reports.service";

export async function createSavedReport(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = createSavedReportSchema.parse(request.body);
  const savedReportsService = new SavedReportsService(request.server.prisma);
  const savedReport = await savedReportsService.create(request.user.userId, body);

  return reply
    .status(201)
    .send(successResponse(savedReport, "Saved report created successfully"));
}

export async function getSavedReports(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const savedReportsService = new SavedReportsService(request.server.prisma);
  const savedReports = await savedReportsService.getAllForUser(request.user);

  return reply.send(successResponse(savedReports));
}

export async function getSavedReportById(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = savedReportIdParamsSchema.parse(request.params);
  const savedReportsService = new SavedReportsService(request.server.prisma);
  const savedReport = await savedReportsService.getById(id, request.user);

  if (!savedReport) {
    throw request.server.httpErrors.notFound("Saved report not found");
  }

  return reply.send(successResponse(savedReport));
}

export async function deleteSavedReport(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = savedReportIdParamsSchema.parse(request.params);
  const savedReportsService = new SavedReportsService(request.server.prisma);
  const deleted = await savedReportsService.deleteById(id, request.user);

  if (!deleted) {
    throw request.server.httpErrors.notFound("Saved report not found");
  }

  return reply.send(successResponse(null, "Saved report deleted successfully"));
}
