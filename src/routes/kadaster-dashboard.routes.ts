import { FastifyInstance } from "fastify";

import {
  archiveKadasterDashboard,
  getKadasterDashboard,
} from "../controllers/kadaster-dashboard.controller";

export default async function kadasterDashboardRoutes(app: FastifyInstance) {
  app.get("/", getKadasterDashboard);
  app.post("/archive", archiveKadasterDashboard);
}
