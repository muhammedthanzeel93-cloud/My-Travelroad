/**
 * My Travelroad — User Login Validation Schema
 * Enforces strict API contract validation rules for interactive account login.
 * Reference: docs/architecture/api-contracts.md (Module A) & docs/architecture/openapi.yaml
 */

import { z } from "zod";
import { loginPasswordSchema } from "./password.schema";

/**
 * Request validation schema for POST /api/v1/auth/login.
 * Enforces:
 * - email: Valid RFC 5322 format, max 255 characters, lowercase normalized.
 * - password: loginPasswordSchema (1-72 Unicode code points, exact whitespace preservation).
 * - strict(): Rejects unknown or injected request properties with 422 VALIDATION_FAILED.
 */
export const loginRequestSchema = z
  .object({
    email: z
      .string()
      .email("Invalid email format")
      .max(255, "Email must not exceed 255 characters")
      .transform((val) => val.toLowerCase()),
    password: loginPasswordSchema,
  })
  .strict();

export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
