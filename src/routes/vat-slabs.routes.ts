import { FastifyInstance } from "fastify";

import {
  createVatSlab,
  getVatSlabs,
  updateVatSlab,
} from "../controllers/vat-slabs.controller";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function vatSlabsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authMiddleware, adminMiddleware] }, getVatSlabs);
  app.post("/", { preHandler: [authMiddleware, adminMiddleware] }, createVatSlab);
  app.patch(
    "/:id",
    { preHandler: [authMiddleware, adminMiddleware] },
    updateVatSlab,
  );
}
