import { FastifyInstance } from "fastify";

import { getSoldHomeBenchmarkReport } from "../controllers/sold-home-benchmark-report.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { paidReportAccessMiddleware } from "../middlewares/paid-report-access.middleware";

export default async function soldHomeBenchmarkReportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get(
    "/sold-home-benchmark-report",
    {
      preHandler: paidReportAccessMiddleware({
        reportType: "sold-home-benchmark-report",
      }),
    },
    getSoldHomeBenchmarkReport,
  );
}
