import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z
    .string()
    .trim()
    .regex(/^$|^\/[a-zA-Z0-9/_-]*$/, "API_PREFIX must be empty or start with /")
    .transform((value) => value.replace(/\/$/, ""))
    .default(""),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errors = parsedEnv.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(errors)}`);
}

export const env = parsedEnv.data;
