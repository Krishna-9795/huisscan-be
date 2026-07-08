import { FastifyInstance } from "fastify";

import { getKadasterDashboard } from "../controllers/kadaster-dashboard.controller";

export default async function kadasterDashboardRoutes(app: FastifyInstance) {
  app.get("/", getKadasterDashboard);
}
