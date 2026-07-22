import cors from "@fastify/cors";
import fp from "fastify-plugin";

import { env } from "../config/env";

export default fp(async (fastify) => {
  await fastify.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
});
