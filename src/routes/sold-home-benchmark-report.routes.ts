import { FastifyInstance } from "fastify";

import { getSoldHomeBenchmarkReport } from "../controllers/sold-home-benchmark-report.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function soldHomeBenchmarkReportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/sold-home-benchmark-report", getSoldHomeBenchmarkReport);
}
