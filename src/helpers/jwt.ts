import { FastifyInstance } from "fastify";

import { AuthTokenPayload } from "../models/auth.model";

export function signAuthToken(app: FastifyInstance, payload: AuthTokenPayload) {
  return app.jwt.sign(payload, {
    expiresIn: "7d",
  });
}

export function getTokenExpiryDate(daysFromNow = 7) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysFromNow);
  return expiresAt;
}

export function getBearerToken(authorizationHeader?: string) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
}
