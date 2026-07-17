import { FastifyInstance } from "fastify";

import { createUserReportArtifact } from "../controllers/user-report-artifacts.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function userReportArtifactsRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: authMiddleware }, createUserReportArtifact);
}
