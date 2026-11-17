/**
 * My Travelroad — Environment Configuration & Validation
 * Validates process.env using Zod schemas with fail-fast startup semantics.
 */

import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL must be provided"),
  DIRECT_URL: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((val) =>
      val
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates arbitrary environment variables against the schema.
 * Throws a formatted Error if validation fails.
 */
export function validateEnv(
  rawEnv: Record<string, string | undefined> = process.env
): Env {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues || (result.error as any).errors || [];
    const formattedIssues = issues
      .map((issue: any) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `[Configuration Error] Invalid environment configuration:\n${formattedIssues}`
    );
  }
  return result.data;
}

/**
 * Singleton parsed environment configuration.
 * In test mode without DATABASE_URL set, a fallback is provided so tests can run offline.
 */
function getActiveEnv(): Env {
  const isTest = process.env.NODE_ENV === "test";
  const sourceEnv = { ...process.env };
  if (isTest && !sourceEnv.DATABASE_URL) {
    sourceEnv.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/mytravelroad_test?schema=public";
  }
  return validateEnv(sourceEnv);
}

export const env = getActiveEnv();
