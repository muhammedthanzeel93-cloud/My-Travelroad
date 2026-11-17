/**
 * My Travelroad — JWT Access Token Signing & Verification Module
 * Strictly implements HMAC-SHA256 (HS256) signing with 256-bit entropy keys.
 * Enforces algorithm pinning to defeat algorithm-confusion and signature-stripping attacks.
 * Reference: docs/architecture/api-architecture.md Section 6.2
 */

import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { env } from "../../config/env";
import { AccessTokenPayload, AccessTokenClaims } from "./token.types";
import { UserRole, AccountType, AccountStatus } from "../../types/domain/account.types";
import { UnauthorizedError } from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";

/** Access token lifespan in seconds (15 minutes). */
export const ACCESS_TOKEN_EXPIRATION_SECONDS = 900;

/** Approved cryptographic signing algorithm for access tokens. */
export const JWT_ALGORITHM = "HS256";

/** Maximum permitted clock skew / drift in seconds for issued-at (iat) timestamps. */
export const CLOCK_TOLERANCE_SECONDS = 60;

/** Authoritative domain roles allowed in access tokens. */
export const VALID_USER_ROLES = new Set<UserRole>([
  "traveler",
  "contributor",
  "curator",
  "moderator",
  "super_admin",
]);

/** Authoritative domain account types allowed in access tokens. */
export const VALID_ACCOUNT_TYPES = new Set<AccountType>([
  "individual",
  "business",
  "system",
]);

/** Authoritative domain account lifecycle statuses allowed in access tokens. */
export const VALID_ACCOUNT_STATUSES = new Set<AccountStatus>([
  "active",
  "suspended",
  "pending_verification",
  "deactivated",
]);

/**
 * Strict UUIDv4 format regular expression.
 * Enforces version digit strictly equal to 4 and variant strictly equal to 8, 9, a, or b.
 */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Backward-compatible alias for UUIDv4 regex. */
export const UUID_REGEX = UUID_V4_REGEX;

/** RFC 5322-compliant simple email regex pattern. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Runtime type guard for UserRole.
 */
export function isValidUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_USER_ROLES.has(value as UserRole);
}

/**
 * Runtime type guard for AccountType.
 */
export function isValidAccountType(value: unknown): value is AccountType {
  return typeof value === "string" && VALID_ACCOUNT_TYPES.has(value as AccountType);
}

/**
 * Runtime type guard for AccountStatus.
 */
export function isValidAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === "string" && VALID_ACCOUNT_STATUSES.has(value as AccountStatus);
}

export interface SignTokenOptions {
  secret?: string;
  expiresInSeconds?: number;
  issuer?: string;
  audience?: string;
}

export interface VerifyTokenOptions {
  secret?: string;
  issuer?: string;
  audience?: string;
}

/**
 * Converts a raw string secret into an encoded Uint8Array key for jose.
 * Validates that the secret satisfies the 256-bit entropy threshold (minimum 32 characters).
 */
function getSigningKey(rawSecret?: string): Uint8Array {
  const secret = rawSecret ?? env.JWT_SECRET;
  if (!secret || typeof secret !== "string" || secret.length < 32) {
    throw new Error(
      "JWT secret must be a string containing at least 32 characters (256 bits of entropy)"
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signs a short-lived access token JWT using HMAC-SHA256 (HS256).
 * Strictly validates all payload fields and signing options defensively.
 *
 * @param payload Caller account attributes and token generation
 * @param options Optional overrides for secret, TTL, issuer, or audience (primarily for testing)
 * @returns Encoded JWT access token string
 */
export async function signAccessToken(
  payload: AccessTokenPayload,
  options?: SignTokenOptions
): Promise<string> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload: AccessTokenPayload must be an object");
  }

  if (!payload.sub || typeof payload.sub !== "string" || !UUID_V4_REGEX.test(payload.sub)) {
    throw new Error("Invalid payload: sub must be a valid account UUIDv4 string");
  }

  if (!isValidUserRole(payload.role)) {
    throw new Error(
      `Invalid payload: role must be one of ${Array.from(VALID_USER_ROLES).join(", ")}`
    );
  }

  if (!payload.email || typeof payload.email !== "string" || !EMAIL_REGEX.test(payload.email)) {
    throw new Error("Invalid payload: email must be a valid non-empty email string");
  }

  if (typeof payload.emailVerified !== "boolean") {
    throw new Error("Invalid payload: emailVerified must be a boolean");
  }

  if (!isValidAccountType(payload.type)) {
    throw new Error(
      `Invalid payload: type must be one of ${Array.from(VALID_ACCOUNT_TYPES).join(", ")}`
    );
  }

  if (!isValidAccountStatus(payload.status)) {
    throw new Error(
      `Invalid payload: status must be one of ${Array.from(VALID_ACCOUNT_STATUSES).join(", ")}`
    );
  }

  if (
    typeof payload.gen !== "number" ||
    !Number.isInteger(payload.gen) ||
    payload.gen < 1
  ) {
    throw new Error("Invalid payload: gen must be a positive integer >= 1");
  }

  // Defensive validation of optional signing overrides
  if (options?.expiresInSeconds !== undefined) {
    if (
      typeof options.expiresInSeconds !== "number" ||
      !Number.isInteger(options.expiresInSeconds) ||
      options.expiresInSeconds < 1 ||
      options.expiresInSeconds > 86400
    ) {
      throw new Error(
        "Invalid expiresInSeconds: must be a positive integer between 1 and 86400 seconds"
      );
    }
  }

  if (
    options?.issuer !== undefined &&
    (typeof options.issuer !== "string" || options.issuer.trim().length === 0)
  ) {
    throw new Error("Invalid issuer: must be a non-empty string");
  }

  if (
    options?.audience !== undefined &&
    (typeof options.audience !== "string" || options.audience.trim().length === 0)
  ) {
    throw new Error("Invalid audience: must be a non-empty string");
  }

  const key = getSigningKey(options?.secret);
  const ttl = options?.expiresInSeconds ?? ACCESS_TOKEN_EXPIRATION_SECONDS;
  const issuer = options?.issuer ?? env.JWT_ISSUER;
  const audience = options?.audience ?? env.JWT_AUDIENCE;

  return await new SignJWT({
    role: payload.role,
    email: payload.email,
    emailVerified: payload.emailVerified,
    type: payload.type,
    status: payload.status,
    gen: payload.gen,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .setIssuer(issuer)
    .setAudience(audience)
    .sign(key);
}

/**
 * Verifies and decodes an access token JWT.
 * Strict Algorithm Pinning: Enforces algorithms: ["HS256"] to eliminate algorithm-confusion attacks.
 * Fails closed on expired tokens, invalid signatures, malformed tokens, or mismatched claims.
 * Performs strict runtime validation on all domain and standard claims without unsafe casting.
 *
 * @param token Raw JWT access token string from Authorization header
 * @param options Optional overrides for secret, issuer, or audience
 * @returns Fully validated AccessTokenClaims object
 * @throws UnauthorizedError if token is expired, invalid, malformed, or missing required claims
 */
export async function verifyAccessToken(
  token: string,
  options?: VerifyTokenOptions
): Promise<AccessTokenClaims> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new UnauthorizedError("Access token is required", ErrorCode.AUTHENTICATION_REQUIRED);
  }

  const key = getSigningKey(options?.secret);
  const issuer = options?.issuer ?? env.JWT_ISSUER;
  const audience = options?.audience ?? env.JWT_AUDIENCE;

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [JWT_ALGORITHM],
      issuer,
      audience,
    });

    // 1. sub claim: must strictly be a valid account UUIDv4
    if (!payload.sub || typeof payload.sub !== "string" || !UUID_V4_REGEX.test(payload.sub)) {
      throw new UnauthorizedError(
        "Token missing valid account UUIDv4 subject (sub) claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    const sub: string = payload.sub;

    // 2. role claim: must strictly be one of the approved UserRole enums established via type guard
    if (!isValidUserRole(payload.role)) {
      throw new UnauthorizedError(
        "Token contains invalid or unsupported role claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    const role: UserRole = payload.role;

    // 3. email claim: must be a valid non-empty email string
    if (!payload.email || typeof payload.email !== "string" || !EMAIL_REGEX.test(payload.email)) {
      throw new UnauthorizedError(
        "Token missing valid email claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    const email: string = payload.email;

    // 4. emailVerified claim: must be a strict boolean
    if (typeof payload.emailVerified !== "boolean") {
      throw new UnauthorizedError(
        "Token missing valid emailVerified claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    const emailVerified: boolean = payload.emailVerified;

    // 5. type claim: must strictly be one of the approved AccountType enums established via type guard
    if (!isValidAccountType(payload.type)) {
      throw new UnauthorizedError(
        "Token contains invalid or unsupported type claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    const type: AccountType = payload.type;

    // 6. status claim: must strictly be one of the approved AccountStatus enums established via type guard
    if (!isValidAccountStatus(payload.status)) {
      throw new UnauthorizedError(
        "Token contains invalid or unsupported status claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    const status: AccountStatus = payload.status;

    // 7. gen claim: must strictly be a positive integer; NEVER defaulted
    if (
      typeof payload.gen !== "number" ||
      !Number.isInteger(payload.gen) ||
      payload.gen < 1
    ) {
      throw new UnauthorizedError(
        "Token missing valid generation (gen) claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    const gen: number = payload.gen;

    // 8. iat claim: must strictly be a positive integer Unix timestamp and not unreasonably in the future
    if (
      typeof payload.iat !== "number" ||
      !Number.isInteger(payload.iat) ||
      payload.iat <= 0
    ) {
      throw new UnauthorizedError(
        "Token missing valid issued-at (iat) timestamp claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    const currentUnixTime = Math.floor(Date.now() / 1000);
    if (payload.iat > currentUnixTime + CLOCK_TOLERANCE_SECONDS) {
      throw new UnauthorizedError(
        "Token issued-at (iat) timestamp is unreasonably in the future",
        ErrorCode.TOKEN_INVALID
      );
    }
    const iat: number = payload.iat;

    // 9. exp claim: must strictly be a positive integer Unix timestamp strictly greater than iat
    if (
      typeof payload.exp !== "number" ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= 0
    ) {
      throw new UnauthorizedError(
        "Token missing valid expiration (exp) timestamp claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    if (payload.exp <= payload.iat) {
      throw new UnauthorizedError(
        "Token expiration (exp) timestamp must be strictly later than issued-at (iat) timestamp",
        ErrorCode.TOKEN_INVALID
      );
    }
    const exp: number = payload.exp;

    // 10. iss claim: must match configured issuer
    if (typeof payload.iss !== "string" || payload.iss !== issuer) {
      throw new UnauthorizedError(
        "Token issuer claim does not match expected issuer",
        ErrorCode.TOKEN_INVALID
      );
    }
    const iss: string = payload.iss;

    // 11. aud claim: must match configured expected audience string or contain it within an audience array
    if (typeof payload.aud === "string") {
      if (payload.aud !== audience) {
        throw new UnauthorizedError(
          "Token audience claim does not match expected audience",
          ErrorCode.TOKEN_INVALID
        );
      }
    } else if (Array.isArray(payload.aud)) {
      const hasAudience = payload.aud.some(
        (entry) => typeof entry === "string" && entry === audience
      );
      if (!hasAudience) {
        throw new UnauthorizedError(
          "Token audience array does not contain expected audience",
          ErrorCode.TOKEN_INVALID
        );
      }
    } else {
      throw new UnauthorizedError(
        "Token missing valid audience (aud) claim",
        ErrorCode.TOKEN_INVALID
      );
    }
    const aud: string = audience;

    const claims: AccessTokenClaims = {
      sub,
      role,
      email,
      emailVerified,
      type,
      status,
      gen,
      iat,
      exp,
      iss,
      aud,
    };

    return claims;
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }

    if (err instanceof joseErrors.JWTExpired) {
      throw new UnauthorizedError("Access token has expired", ErrorCode.TOKEN_EXPIRED);
    }

    if (
      err instanceof joseErrors.JWSSignatureVerificationFailed ||
      err instanceof joseErrors.JWTClaimValidationFailed ||
      err instanceof joseErrors.JOSEError
    ) {
      throw new UnauthorizedError("Invalid or tampered access token", ErrorCode.TOKEN_INVALID);
    }

    // Default fail-closed for any other token verification failure
    throw new UnauthorizedError("Invalid access token", ErrorCode.TOKEN_INVALID);
  }
}
