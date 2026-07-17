import { FastifyInstance } from "fastify";

import { uploadFile } from "../controllers/uploads.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function uploadsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", uploadFile);
}
