/**
 * My Travelroad — Environment Configuration & Validation
 * Validates process.env using Zod schemas with fail-fast startup semantics.
 */

import { z } from "zod";

/**
 * Validates that an origin string complies strictly with RFC 6454 serialized origin rules:
 * - Scheme must strictly be http: or https:
 * - Must contain a valid hostname (IP or domain name)
 * - Optional port
 * - NO wildcards (*)
 * - NO user credentials (user:pass@)
 * - NO URL paths (e.g. /path)
 * - NO query strings (?query)
 * - NO fragments (#hash)
 */
export function isValidHttpOrigin(origin: string): boolean {
  if (!origin || typeof origin !== "string") {
    return false;
  }

  // Reject wildcards anywhere in origin
  if (origin.includes("*")) {
    return false;
  }

  // Reject credentials / userinfo
  if (origin.includes("@")) {
    return false;
  }

  // Reject query strings or fragments
  if (origin.includes("?") || origin.includes("#")) {
    return false;
  }

  try {
    const url = new URL(origin);

    // Protocol must strictly be http: or https:
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    // Must have a valid non-empty hostname
    if (!url.hostname) {
      return false;
    }

    // Must not contain credentials
    if (url.username || url.password) {
      return false;
    }

    // Must not contain any path beyond empty or "/"
    if (url.pathname && url.pathname !== "/") {
      return false;
    }

    // Ensure raw origin strictly matches serialized origin (without trailing slash)
    const normalizedRaw = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    if (normalizedRaw !== url.origin) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

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
    .transform((val, ctx) => {
      const rawEntries = val.split(",").map((origin) => origin.trim());

      if (
        rawEntries.length === 0 ||
        (rawEntries.length === 1 && rawEntries[0] === "")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "CORS_ALLOWED_ORIGINS must contain at least one valid HTTP(S) origin.",
        });
        return [];
      }

      if (rawEntries.some((entry) => entry.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CORS_ALLOWED_ORIGINS contains an empty origin entry.",
        });
        return [];
      }

      const validatedOrigins: string[] = [];

      for (const origin of rawEntries) {
        if (!isValidHttpOrigin(origin)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "CORS_ALLOWED_ORIGINS contains an invalid HTTP(S) origin entry.",
          });
          return [];
        }
        validatedOrigins.push(
          origin.endsWith("/") ? origin.slice(0, -1) : origin
        );
      }

      return validatedOrigins;
    }),
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
