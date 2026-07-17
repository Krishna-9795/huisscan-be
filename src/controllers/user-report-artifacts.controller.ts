import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import { createUserReportArtifactSchema } from "../schemas/user-report-artifacts.schema";
import { UserReportArtifactsService } from "../services/user-report-artifacts.service";

export async function createUserReportArtifact(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = createUserReportArtifactSchema.parse(request.body);
  const userReportArtifactsService = new UserReportArtifactsService(
    request.server.prisma,
  );
  const artifact = await userReportArtifactsService.createForPaidReport(
    request.user,
    body,
  );

  return reply.status(201).send(successResponse(artifact));
}
