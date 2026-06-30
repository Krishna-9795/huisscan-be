import { FastifyInstance } from "fastify";

import {
  checkAddressAccess,
  getAddressSearches,
} from "../controllers/user-address-searches.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function userAddressSearchesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/", getAddressSearches);
  app.get("/access", checkAddressAccess);
}
