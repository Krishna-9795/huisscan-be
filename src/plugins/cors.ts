import cors from "@fastify/cors";
import fp from "fastify-plugin";

import { env } from "../config/env";

export default fp(async (fastify) => {
  const allowedOrigins = [
    env.FRONTEND_URL,
    env.ADMIN_FRONTEND_URL,
    ...(env.FRONTEND_URLS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ].filter((origin): origin is string => Boolean(origin));
  const configuredOrigins = new Set(allowedOrigins);

  await fastify.register(cors, {
    origin(origin, callback) {
      if (!origin || configuredOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (env.NODE_ENV === "development" && isLocalViteOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
});

function isLocalViteOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const port = Number(url.port);

    return (
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
      Number.isInteger(port) &&
      port >= 5173 &&
      port <= 5179
    );
  } catch {
    return false;
  }
}
