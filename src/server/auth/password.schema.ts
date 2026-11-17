/**
 * My Travelroad — Password Validation Schemas
 * Reusable Zod schemas enforcing approved API contract password policies.
 * Reference: docs/architecture/api-contracts.md (Module A) & docs/architecture/openapi.yaml
 */

import { z } from "zod";

/**
 * Password complexity schema for account registration and password reset.
 * Approved Policy Requirements:
 * - Minimum 8 characters
 * - Maximum 72 characters (Argon2id standard byte limit)
 * - Must include at least 1 uppercase letter
 * - Must include at least 1 lowercase letter
 * - Must include at least 1 numeric digit
 * - Strictly preserves user-submitted whitespace (no silent trimming)
 */
export const passwordCreationSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(72, "Password must not exceed 72 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit");

export type PasswordCreationInput = z.infer<typeof passwordCreationSchema>;

/**
 * Password validation schema for interactive user authentication (login).
 * Requires a non-empty string bounded by the 72-character maximum input threshold.
 * Does not impose registration complexity checks on login to allow legacy credentials to authenticate.
 */
export const loginPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .max(72, "Password must not exceed 72 characters");

export type LoginPasswordInput = z.infer<typeof loginPasswordSchema>;
