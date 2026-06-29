import Fastify, { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { env } from "./config/env";
import corsPlugin from "./plugins/cors";
import jwtPlugin from "./plugins/jwt";
import prismaPlugin from "./plugins/prisma";
import sensiblePlugin from "./plugins/sensible";
import routes from "./routes";
import paymentsRoutes from "./routes/payments.routes";
import { getPaymentsApiPrefix } from "./helpers/payments-api-prefix";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  await app.register(corsPlugin);
  await app.register(sensiblePlugin);
  await app.register(jwtPlugin);
  await app.register(prismaPlugin);
  await app.register(routes, { prefix: env.API_PREFIX });

  const paymentsApiPrefix = getPaymentsApiPrefix();

  if (paymentsApiPrefix !== env.API_PREFIX) {
    await app.register(paymentsRoutes, { prefix: `${paymentsApiPrefix}/payments` });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        message: "Validation failed",
        errors: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    const statusCode = getStatusCode(error);

    requestLogError(app, normalizedError);

    return reply.status(statusCode).send({
      success: false,
      message:
        statusCode >= 500 ? "Internal server error" : normalizedError.message,
    });
  });

  return app;
}

function requestLogError(app: FastifyInstance, error: Error) {
  app.log.error(error);
}

function getStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return 500;
}
