import { FastifyInstance } from "fastify";

import {
  createSavedReport,
  deleteSavedReport,
  getSavedReportById,
  getSavedReports,
} from "../controllers/saved-reports.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function savedReportsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", createSavedReport);
  app.get("/", getSavedReports);
  app.get("/:id", getSavedReportById);
  app.delete("/:id", deleteSavedReport);
}
