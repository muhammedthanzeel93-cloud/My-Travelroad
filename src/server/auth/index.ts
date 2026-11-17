/**
 * My Travelroad — Authentication Security Foundation
 * Re-exports password security, JWT access tokens, opaque refresh tokens, and cookie configurations.
 */

// Password Security & Validation (Task 10.1)
export {
  DEFAULT_ARGON2_OPTIONS,
  type Argon2CustomOptions,
  countCodePoints,
  hashPassword,
  verifyPassword,
  needsRehash,
} from "./password";

export {
  MIN_PASSWORD_CODE_POINTS,
  MAX_PASSWORD_CODE_POINTS,
  passwordCreationSchema,
  loginPasswordSchema,
  type PasswordCreationInput,
  type LoginPasswordInput,
} from "./password.schema";

// Token & Session Primitives (Task 10.2)
export {
  type AccessTokenPayload,
  type AccessTokenClaims,
  type RefreshTokenParsed,
  type RefreshTokenGenerated,
  type SessionMetadata,
  type AuthCookieOptions,
} from "./token.types";

export {
  ACCESS_TOKEN_EXPIRATION_SECONDS,
  JWT_ALGORITHM,
  CLOCK_TOLERANCE_SECONDS,
  UUID_V4_REGEX,
  UUID_REGEX,
  VALID_USER_ROLES,
  VALID_ACCOUNT_TYPES,
  VALID_ACCOUNT_STATUSES,
  isValidUserRole,
  isValidAccountType,
  isValidAccountStatus,
  type SignTokenOptions,
  type VerifyTokenOptions,
  signAccessToken,
  verifyAccessToken,
} from "./jwt";

export {
  REFRESH_TOKEN_REGEX,
  hashRefreshToken,
  verifyRefreshTokenHash,
  generateRefreshToken,
  parseRefreshToken,
} from "./refresh-token";

export {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_MAX_AGE_MS,
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from "./cookie";
