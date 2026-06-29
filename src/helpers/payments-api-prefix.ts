import { env } from "../config/env";

export function getPaymentsApiPrefix() {
  return env.API_PREFIX === "/api/v1" ? "/api" : env.API_PREFIX;
}
