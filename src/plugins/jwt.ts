import jwt from "@fastify/jwt";
import fp from "fastify-plugin";

import { env } from "../config/env";

export default fp(async (fastify) => {
  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
  });
});
