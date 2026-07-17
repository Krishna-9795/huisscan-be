import { FastifyInstance } from "fastify";

import {
  createFunnelEvent,
  getFunnelEvents,
} from "../controllers/funnel-events.controller";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function funnelEventsRoutes(app: FastifyInstance) {
  app.post("/", createFunnelEvent);
  app.get("/", { preHandler: [authMiddleware, adminMiddleware] }, getFunnelEvents);
}
