import { FastifyInstance } from "fastify";

import {
  createMolliePayment,
  handleMollieReturn,
  handleMollieWebhook,
} from "../controllers/payments.controller";

export default async function paymentsRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(String(body))));
    },
  );

  app.post("/mollie/create", createMolliePayment);
  app.get("/mollie/return", handleMollieReturn);
  app.post("/mollie/webhook", handleMollieWebhook);
}
