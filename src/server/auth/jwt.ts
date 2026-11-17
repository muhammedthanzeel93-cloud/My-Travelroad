/**
 * My Travelroad — JWT Access Token Signing & Verification Module
 * Strictly implements HMAC-SHA256 (HS256) signing with 256-bit entropy keys.
 * Enforces algorithm pinning to defeat algorithm-confusion and signature-stripping attacks.
 * Reference: docs/architecture/api-architecture.md Section 6.2
 */

import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { env } from "../../config/env";
import { AccessTokenPayload, AccessTokenClaims } from "./token.types";
import { UnauthorizedError } from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";

/** Access token lifespan in seconds (15 minutes). */
export const ACCESS_TOKEN_EXPIRATION_SECONDS = 900;

/** Approved cryptographic signing algorithm for access tokens. */
export const JWT_ALGORITHM = "HS256";

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
 *
 * @param payload Caller account attributes and durable generation
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

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Invalid payload: sub (account ID) must be a non-empty string");
  }

  if (!payload.role || typeof payload.role !== "string") {
    throw new Error("Invalid payload: role must be a non-empty string");
  }

  if (!payload.email || typeof payload.email !== "string") {
    throw new Error("Invalid payload: email must be a non-empty string");
  }

  if (typeof payload.emailVerified !== "boolean") {
    throw new Error("Invalid payload: emailVerified must be a boolean");
  }

  if (!payload.type || typeof payload.type !== "string") {
    throw new Error("Invalid payload: type must be a non-empty string");
  }

  if (!payload.status || typeof payload.status !== "string") {
    throw new Error("Invalid payload: status must be a non-empty string");
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
    gen: payload.gen ?? 1,
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
 *
 * @param token Raw JWT access token string from Authorization header
 * @param options Optional overrides for secret, issuer, or audience
 * @returns Fully validated AccessTokenClaims object
 * @throws UnauthorizedError if token is expired, invalid, or malformed
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

    // Validate presence and types of critical claims
    if (!payload.sub || typeof payload.sub !== "string") {
      throw new UnauthorizedError("Token missing valid subject (sub) claim", ErrorCode.TOKEN_INVALID);
    }

    if (!payload.role || typeof payload.role !== "string") {
      throw new UnauthorizedError("Token missing valid role claim", ErrorCode.TOKEN_INVALID);
    }

    if (!payload.email || typeof payload.email !== "string") {
      throw new UnauthorizedError("Token missing valid email claim", ErrorCode.TOKEN_INVALID);
    }

    if (typeof payload.emailVerified !== "boolean") {
      throw new UnauthorizedError("Token missing valid emailVerified claim", ErrorCode.TOKEN_INVALID);
    }

    if (!payload.type || typeof payload.type !== "string") {
      throw new UnauthorizedError("Token missing valid type claim", ErrorCode.TOKEN_INVALID);
    }

    if (!payload.status || typeof payload.status !== "string") {
      throw new UnauthorizedError("Token missing valid status claim", ErrorCode.TOKEN_INVALID);
    }

    const claims: AccessTokenClaims = {
      sub: payload.sub,
      role: payload.role as AccessTokenClaims["role"],
      email: payload.email,
      emailVerified: payload.emailVerified,
      type: payload.type as AccessTokenClaims["type"],
      status: payload.status as AccessTokenClaims["status"],
      gen: typeof payload.gen === "number" ? payload.gen : 1,
      iat: payload.iat as number,
      exp: payload.exp as number,
      iss: payload.iss as string,
      aud: typeof payload.aud === "string" ? payload.aud : (payload.aud as string[])[0],
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
