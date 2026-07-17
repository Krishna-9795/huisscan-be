import { FastifyInstance } from "fastify";

import {
  getReportPriceSetting,
  getReportPriceSettings,
  updateReportPriceSetting,
} from "../controllers/report-price-settings.controller";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function reportPriceSettingsRoutes(app: FastifyInstance) {
  app.get("/", getReportPriceSettings);
  app.get("/:reportType", getReportPriceSetting);
  app.patch("/:reportType", {
    preHandler: [authMiddleware, adminMiddleware],
  }, updateReportPriceSetting);
}
