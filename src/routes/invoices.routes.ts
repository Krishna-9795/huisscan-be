import { FastifyInstance } from "fastify";

import {
  getInvoiceById,
  getInvoices,
} from "../controllers/invoices.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export default async function invoicesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/", getInvoices);
  app.get("/:id", getInvoiceById);
}
