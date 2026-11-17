/**
 * My Travelroad — Authentication Security Foundation
 * Re-exports password hashing, verification, re-hash detection, and validation schemas.
 */

export {
  DEFAULT_ARGON2_OPTIONS,
  type Argon2CustomOptions,
  hashPassword,
  verifyPassword,
  needsRehash,
} from "./password";

export {
  passwordCreationSchema,
  loginPasswordSchema,
  type PasswordCreationInput,
  type LoginPasswordInput,
} from "./password.schema";
