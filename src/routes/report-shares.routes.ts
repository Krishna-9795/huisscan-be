import { FastifyInstance } from "fastify";

import { shareReport } from "../controllers/report-shares.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function reportSharesRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: authMiddleware }, shareReport);
}
