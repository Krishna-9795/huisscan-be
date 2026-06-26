import { FastifyInstance } from "fastify";

import { login, logout, register } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/register", register);
  app.post("/login", login);
  app.post("/logout", { preHandler: authMiddleware }, logout);
}
