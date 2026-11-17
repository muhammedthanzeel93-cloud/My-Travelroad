/**
 * My Travelroad — Opaque Refresh Token Security Module
 * Implements high-entropy CSPRNG token generation, parsing, SHA-256 hashing,
 * and constant-time verification.
 * References: docs/architecture/api-architecture.md Section 6.3
 */

import crypto from "node:crypto";
import { RefreshTokenGenerated, RefreshTokenParsed } from "./token.types";
import { UnauthorizedError } from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";

/**
 * Strict regex for canonical refresh token format:
 * rt_<familyId>_<64hex>
 * - familyId: UUIDv4 format
 * - rawEntropy: 64 hexadecimal characters (256-bit CSPRNG)
 */
export const REFRESH_TOKEN_REGEX =
  /^rt_([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})_([0-9a-f]{64})$/i;

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Computes the cryptographic SHA-256 hex digest of a raw refresh token.
 * Raw refresh tokens are never persisted in plaintext.
 *
 * @param rawToken Full opaque refresh token string
 * @returns 64-character lowercase SHA-256 hexadecimal hash
 */
export function hashRefreshToken(rawToken: string): string {
  if (typeof rawToken !== "string" || rawToken.length === 0) {
    throw new Error("Cannot hash an empty or non-string refresh token");
  }
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Verifies a candidate raw refresh token against a stored SHA-256 hash in constant time.
 * Defeats timing-attack side channels using crypto.timingSafeEqual.
 *
 * @param rawToken Candidate raw refresh token from client cookie
 * @param expectedHash Stored SHA-256 hex digest from Redis or database
 * @returns true if hashes match, false otherwise
 */
export function verifyRefreshTokenHash(
  rawToken: string,
  expectedHash: string
): boolean {
  if (
    typeof rawToken !== "string" ||
    typeof expectedHash !== "string" ||
    rawToken.length === 0 ||
    expectedHash.length !== 64
  ) {
    return false;
  }

  try {
    const candidateHash = hashRefreshToken(rawToken);
    const candidateBuffer = Buffer.from(candidateHash, "hex");
    const expectedBuffer = Buffer.from(expectedHash, "hex");

    if (candidateBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure, high-entropy opaque refresh token.
 * Provides 256 bits of CSPRNG entropy with isolated familyId shard routing.
 *
 * @param familyId Optional UUIDv4 family lineage identifier. If omitted, a new UUIDv4 is generated.
 * @returns Generated raw token, familyId, and SHA-256 hash digest
 */
export function generateRefreshToken(familyId?: string): RefreshTokenGenerated {
  let lineageId = familyId;

  if (lineageId) {
    if (!UUID_V4_REGEX.test(lineageId)) {
      throw new Error(`Invalid familyId: '${lineageId}' must be a valid UUIDv4 identifier`);
    }
  } else {
    lineageId = crypto.randomUUID();
  }

  // 256 bits of CSPRNG entropy (32 bytes -> 64 hex characters)
  const entropy = crypto.randomBytes(32).toString("hex");
  const rawToken = `rt_${lineageId}_${entropy}`;
  const tokenHash = hashRefreshToken(rawToken);

  return {
    rawToken,
    familyId: lineageId,
    tokenHash,
  };
}

/**
 * Parses, validates, and extracts routing metadata from a raw refresh token cookie.
 * Treats all parts of the cookie as untrusted input.
 *
 * @param rawCookie Value extracted from req.cookies.refreshToken
 * @returns Parsed familyId, rawEntropy, and computed tokenHash
 * @throws UnauthorizedError if token format is malformed or invalid
 */
export function parseRefreshToken(rawCookie: string): RefreshTokenParsed {
  if (typeof rawCookie !== "string" || rawCookie.trim().length === 0) {
    throw new UnauthorizedError(
      "Refresh token cookie is missing or empty",
      ErrorCode.AUTHENTICATION_REQUIRED
    );
  }

  const match = rawCookie.match(REFRESH_TOKEN_REGEX);
  if (!match) {
    throw new UnauthorizedError(
      "Refresh token format is malformed",
      ErrorCode.TOKEN_INVALID
    );
  }

  const [, familyId, rawEntropy] = match;
  const tokenHash = hashRefreshToken(rawCookie);

  return {
    familyId,
    rawEntropy,
    tokenHash,
  };
}
