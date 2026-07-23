import { FastifyInstance } from "fastify";

import {
  createAdmin,
  getAdminById,
  getAdmins,
  updateAdmin,
  updateAdminPassword,
} from "../controllers/admins.controller";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function adminsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", adminMiddleware);

  app.get("/", getAdmins);
  app.post("/", createAdmin);
  app.get("/:id", getAdminById);
  app.patch("/:id", updateAdmin);
  app.patch("/:id/password", updateAdminPassword);
}
