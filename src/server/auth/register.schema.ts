/**
 * My Travelroad — Tourist Account Registration Validation Schema
 * Enforces strict API contract validation rules for tourist account registration.
 * Reference: docs/architecture/api-contracts.md (Module A) & docs/architecture/openapi.yaml
 */

import { z } from "zod";
import { passwordCreationSchema } from "./password.schema";

/**
 * Supported UI preference languages per domain-model.md Section 1.2 ('en', 'ml').
 */
export const SUPPORTED_LANGUAGES = ["en", "ml"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Handle regex strictly requiring 3 to 50 lowercase ASCII characters, digits, or underscores.
 * Disallows uppercase letters, whitespace, or special characters.
 */
export const HANDLE_REGEX = /^[a-z0-9_]+$/;

/**
 * Request validation schema for POST /api/v1/auth/register.
 * Enforces:
 * - email: Valid RFC 5322 format, max 255 chars, lowercased.
 * - password: Validated via passwordCreationSchema (8-72 code points, complexity, exact preservation).
 * - displayName: 2-120 chars, surrounding whitespace trimmed.
 * - handle: 3-50 chars, strictly matching ^[a-z0-9_]+$.
 * - preferredLanguage: Allowlisted enum ('en', 'ml'), default 'en'.
 * - strict(): Reject unknown/injected properties with 422 VALIDATION_FAILED.
 */
export const registerRequestSchema = z
  .object({
    email: z
      .string()
      .email("Invalid email format")
      .max(255, "Email must not exceed 255 characters")
      .transform((val) => val.toLowerCase()),
    password: passwordCreationSchema,
    displayName: z
      .string()
      .transform((val) => val.trim())
      .pipe(
        z
          .string()
          .min(2, "Display name must be at least 2 characters")
          .max(120, "Display name must not exceed 120 characters")
      ),
    handle: z
      .string()
      .min(3, "Handle must be at least 3 characters")
      .max(50, "Handle must not exceed 50 characters")
      .regex(
        HANDLE_REGEX,
        "Handle must contain only lowercase ASCII letters, digits, and underscores"
      ),
    preferredLanguage: z.enum(SUPPORTED_LANGUAGES).default("en"),
  })
  .strict();

export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
