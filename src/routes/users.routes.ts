import { FastifyInstance } from "fastify";

import { adminMiddleware } from "../middlewares/admin.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  createUserProfile,
  getMe,
  getUserById,
  getUsers,
  updateMe,
} from "../controllers/users.controller";

export default async function usersRoutes(app: FastifyInstance) {
  app.post("/", createUserProfile);

  app.get("/me", { preHandler: authMiddleware }, getMe);
  app.patch("/me", { preHandler: authMiddleware }, updateMe);
  app.get("/", { preHandler: [authMiddleware, adminMiddleware] }, getUsers);
  app.get(
    "/:id",
    { preHandler: [authMiddleware, adminMiddleware] },
    getUserById,
  );
}
