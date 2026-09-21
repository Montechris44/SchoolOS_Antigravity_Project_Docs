import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  // Short-lived access token; the browser renews it silently with a refresh token.
  JWT_EXPIRES_IN: z.string().default("30m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  STUDENT_EMAIL_FALLBACK_DOMAIN: z.string().default("students.schoolos.app"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("SchoolOS <onboarding@resend.dev>"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid backend environment: ${details}`);
}

export const env = {
  ...parsed.data,
  CORS_ORIGINS: parsed.data.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
};

export type Env = typeof env;
