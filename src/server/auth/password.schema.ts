/**
 * My Travelroad — Password Validation Schemas
 * Reusable Zod schemas enforcing approved API contract password policies.
 * Reference: docs/architecture/api-contracts.md (Module A) & docs/architecture/openapi.yaml
 */

import { z } from "zod";
import { countCodePoints } from "./password";

/**
 * Approved API contract password length boundaries measured in Unicode code points.
 * Note: 72 characters is an application-level policy established for request bounding
 * and DoS mitigation, distinct from Argon2id's maximum supported input length (2^32 - 1 bytes).
 */
export const MIN_PASSWORD_CODE_POINTS = 8;
export const MAX_PASSWORD_CODE_POINTS = 72;

/**
 * Password complexity schema for account registration and password reset.
 * Approved Policy Requirements:
 * - Minimum 8 Unicode code points
 * - Maximum 72 Unicode code points (application-level policy)
 * - Must include at least 1 uppercase letter
 * - Must include at least 1 lowercase letter
 * - Must include at least 1 numeric digit
 * - Strictly preserves user-submitted whitespace (no silent trimming)
 */
export const passwordCreationSchema = z
  .string()
  .refine((val) => countCodePoints(val) >= MIN_PASSWORD_CODE_POINTS, {
    message: "Password must be at least 8 characters long",
  })
  .refine((val) => countCodePoints(val) <= MAX_PASSWORD_CODE_POINTS, {
    message: "Password must not exceed 72 characters",
  })
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit");

export type PasswordCreationInput = z.infer<typeof passwordCreationSchema>;

/**
 * Password validation schema for interactive user authentication (login).
 * Requires a non-empty string bounded by the 72 Unicode code points maximum threshold.
 * Does not impose registration complexity checks on login to allow legacy credentials to authenticate.
 */
export const loginPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .refine((val) => countCodePoints(val) <= MAX_PASSWORD_CODE_POINTS, {
    message: "Password must not exceed 72 characters",
  });

export type LoginPasswordInput = z.infer<typeof loginPasswordSchema>;
