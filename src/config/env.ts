import { config as loadEnv } from "dotenv";

import { z } from "zod";

loadEnv({ path: ".env.local" });
loadEnv();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off", ""].includes(normalized)) return false;

  return value;
}, z.boolean());

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    PORT: z.coerce.number().default(4000),
    API_PREFIX: z
      .string()
      .trim()
      .regex(/^$|^\/[a-zA-Z0-9/_-]*$/, "API_PREFIX must be empty or start with /")
      .transform((value) => value.replace(/\/$/, ""))
      .default("/api/v1"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    PUBLIC_APP_URL: z.string().url().optional(),
    PUBLIC_API_URL: z.string().url().optional(),
    KADASTER_DASHBOARD_CACHE_DIR: z.string().min(1).optional(),
    KADASTER_ARCHIVE_TOKEN: z.string().min(1).optional(),
    KADASTER_LIVE_CALLS_ENABLED: booleanFromEnv.default(false),
    KADASTER_ALLOWED_ADDRESS_MODE: z.enum(["one", "list", "all"]).default("one"),
    KADASTER_ALLOWED_ADDRESSES: z
      .string()
      .default("Muiderbos 1, 2134 SM, Hoofddorp"),
    MOLLIE_API_KEY: z.string().min(1).optional(),
    MOLLIE_TEST_API_KEY: z.string().min(1).optional(),
    AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
    AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    AWS_SESSION_TOKEN: z.string().min(1).optional(),
    AWS_USER_REGION: z.string().min(1).optional(),
    AWS_STORAGE_BUCKET_NAME: z.string().min(1).optional(),
    AWS_S3_PUBLIC_BASE_URL: z.string().url().optional(),
    SENDER_EMAIL: z.string().email().optional(),
  })
  .superRefine((env, context) => {
    const hasMollieKey = Boolean(env.MOLLIE_API_KEY || env.MOLLIE_TEST_API_KEY);

    if (hasMollieKey && !env.PUBLIC_API_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PUBLIC_API_URL"],
        message: "PUBLIC_API_URL is required when Mollie payments are enabled",
      });
    }

    if (
      env.PUBLIC_API_URL &&
      env.NODE_ENV !== "development" &&
      isLocalhostUrl(env.PUBLIC_API_URL)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PUBLIC_API_URL"],
        message: "PUBLIC_API_URL cannot be localhost outside development",
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errors = parsedEnv.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(errors)}`);
}

export const env = parsedEnv.data;

function isLocalhostUrl(value: string) {
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
