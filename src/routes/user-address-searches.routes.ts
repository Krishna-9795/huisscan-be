import { FastifyInstance } from "fastify";

import {
  checkAddressAccess,
  getAddressSearches,
  recordAddressSearch,
} from "../controllers/user-address-searches.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function userAddressSearchesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/", getAddressSearches);
  app.post("/", recordAddressSearch);
  app.get("/access", checkAddressAccess);
}
