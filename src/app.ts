import Fastify, { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { env } from "./config/env";
import corsPlugin from "./plugins/cors";
import jwtPlugin from "./plugins/jwt";
import multipartPlugin from "./plugins/multipart";
import prismaPlugin from "./plugins/prisma";
import sensiblePlugin from "./plugins/sensible";
import routes from "./routes";
import kadasterDashboardRoutes from "./routes/kadaster-dashboard.routes";
import paymentsRoutes from "./routes/payments.routes";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  await app.register(corsPlugin);
  await app.register(sensiblePlugin);
  await app.register(jwtPlugin);
  await app.register(multipartPlugin);
  await app.register(prismaPlugin);
  app.addHook("onRequest", async (request, reply) => {
    const normalizedUrl = normalizeDuplicateApiPrefix(request.url);

    if (normalizedUrl) {
      return reply.redirect(normalizedUrl, 308);
    }
  });
  await app.register(routes, { prefix: env.API_PREFIX });
  await registerLegacyApiAliases(app);

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

async function registerLegacyApiAliases(app: FastifyInstance) {
  if (env.API_PREFIX === "/api") {
    return;
  }

  await app.register(paymentsRoutes, { prefix: "/api/payments" });
  await app.register(kadasterDashboardRoutes, { prefix: "/api/kadaster-dashboard" });
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

function normalizeDuplicateApiPrefix(url: string) {
  const apiPrefix = env.API_PREFIX.replace(/\/$/, "");

  if (!apiPrefix) {
    return undefined;
  }

  const duplicatePrefix = `${apiPrefix}${apiPrefix}/`;

  if (!url.startsWith(duplicatePrefix)) {
    return undefined;
  }

  return `${apiPrefix}/${url.slice(duplicatePrefix.length)}`;
}
