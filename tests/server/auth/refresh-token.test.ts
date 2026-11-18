/**
 * Tests for Opaque Refresh Token Security & Cookie Configuration
 * (src/server/auth/refresh-token.ts & src/server/auth/cookie.ts)
 */

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  generateRefreshToken,
  parseRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
  REFRESH_TOKEN_REGEX,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_MAX_AGE_MS,
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from "../../../src/server/auth";
import { UnauthorizedError } from "../../../src/server/errors/app-error";
import { ErrorCode } from "../../../src/server/errors/error-codes";

describe("Opaque Refresh Token Security Module", () => {
  it("generates a high-entropy opaque token matching rt_<familyId>_<64hex>", () => {
    const creds = generateRefreshToken();

    expect(creds.rawToken).toMatch(REFRESH_TOKEN_REGEX);
    expect(creds.familyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(creds.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    // Verify tokenHash equals SHA-256 of rawToken
    const expectedHash = crypto.createHash("sha256").update(creds.rawToken).digest("hex");
    expect(creds.tokenHash).toBe(expectedHash);
  });

  it("generates unique tokens on subsequent calls due to 256-bit CSPRNG entropy", () => {
    const credsA = generateRefreshToken();
    const credsB = generateRefreshToken();

    expect(credsA.rawToken).not.toBe(credsB.rawToken);
    expect(credsA.familyId).not.toBe(credsB.familyId);
    expect(credsA.tokenHash).not.toBe(credsB.tokenHash);
  });

  it("preserves existing familyId lineage across token rotations", () => {
    const existingFamilyId = "550e8400-e29b-41d4-a716-446655440099";
    const creds = generateRefreshToken(existingFamilyId);

    expect(creds.familyId).toBe(existingFamilyId);
    expect(creds.rawToken.startsWith(`rt_${existingFamilyId}_`)).toBe(true);
  });

  it("rejects invalid or malformed familyId when supplied", () => {
    expect(() => generateRefreshToken("not-a-uuid")).toThrow(
      "must be a valid UUIDv4 identifier"
    );
    expect(() => generateRefreshToken("12345")).toThrow(
      "must be a valid UUIDv4 identifier"
    );
  });

  it("correctly hashes raw tokens using SHA-256", () => {
    const raw = "rt_550e8400-e29b-41d4-a716-446655440001_" + "a".repeat(64);
    const hash = hashRefreshToken(raw);

    expect(hash).toBe(crypto.createHash("sha256").update(raw).digest("hex"));
    expect(hash.length).toBe(64);
  });

  it("rejects non-string or empty inputs during hashing", () => {
    expect(() => hashRefreshToken("")).toThrow("Cannot hash an empty or non-string refresh token");
    expect(() => hashRefreshToken(null as any)).toThrow(
      "Cannot hash an empty or non-string refresh token"
    );
  });

  it("verifies raw tokens against expected hashes in constant time", () => {
    const creds = generateRefreshToken();

    // Matching token and hash
    expect(verifyRefreshTokenHash(creds.rawToken, creds.tokenHash)).toBe(true);

    // Mismatched token
    const otherCreds = generateRefreshToken();
    expect(verifyRefreshTokenHash(otherCreds.rawToken, creds.tokenHash)).toBe(false);

    // Tampered token (guaranteeing different character)
    const lastChar = creds.rawToken.slice(-1);
    const replacement = lastChar === "a" ? "b" : "a";
    const tamperedRaw = creds.rawToken.slice(0, -1) + replacement;
    expect(verifyRefreshTokenHash(tamperedRaw, creds.tokenHash)).toBe(false);

    // Empty or non-string inputs
    expect(verifyRefreshTokenHash("", creds.tokenHash)).toBe(false);
    expect(verifyRefreshTokenHash(creds.rawToken, "")).toBe(false);
    expect(verifyRefreshTokenHash(null as any, creds.tokenHash)).toBe(false);
    expect(verifyRefreshTokenHash(creds.rawToken, "invalid-short-hash")).toBe(false);
  });

  it("successfully parses valid client refresh token cookies", () => {
    const creds = generateRefreshToken();
    const parsed = parseRefreshToken(creds.rawToken);

    expect(parsed.familyId).toBe(creds.familyId);
    expect(parsed.rawEntropy.length).toBe(64);
    expect(parsed.tokenHash).toBe(creds.tokenHash);
  });

  it("rejects missing, empty, or whitespace cookie values with AUTHENTICATION_REQUIRED", () => {
    try {
      parseRefreshToken("");
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
    }

    try {
      parseRefreshToken("   ");
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
    }
  });

  it("rejects malformed refresh token formats with TOKEN_INVALID", () => {
    // 1. Missing prefix
    expect(() =>
      parseRefreshToken("550e8400-e29b-41d4-a716-446655440001_" + "a".repeat(64))
    ).toThrow(new UnauthorizedError("Refresh token format is malformed", ErrorCode.TOKEN_INVALID));

    // 2. Invalid familyId (not UUIDv4)
    expect(() =>
      parseRefreshToken("rt_invalid-family-uuid_" + "a".repeat(64))
    ).toThrow(new UnauthorizedError("Refresh token format is malformed", ErrorCode.TOKEN_INVALID));

    // 3. Invalid entropy length (too short)
    expect(() =>
      parseRefreshToken("rt_550e8400-e29b-41d4-a716-446655440001_abc123")
    ).toThrow(new UnauthorizedError("Refresh token format is malformed", ErrorCode.TOKEN_INVALID));

    // 4. Non-hex characters in entropy
    expect(() =>
      parseRefreshToken(
        "rt_550e8400-e29b-41d4-a716-446655440001_" + "z".repeat(64)
      )
    ).toThrow(new UnauthorizedError("Refresh token format is malformed", ErrorCode.TOKEN_INVALID));
  });
});

describe("Authentication Cookie Configuration Module", () => {
  it("exports correct cookie constants", () => {
    expect(REFRESH_COOKIE_NAME).toBe("refreshToken");
    expect(REFRESH_COOKIE_PATH).toBe("/api/v1/auth");
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(2592000); // 30 days
    expect(REFRESH_TOKEN_MAX_AGE_MS).toBe(2592000000);
  });

  it("generates production cookie options with secure flag enabled", () => {
    const opts = getRefreshTokenCookieOptions(true);

    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe("strict");
    expect(opts.path).toBe("/api/v1/auth");
    expect(opts.maxAge).toBe(2592000000);
  });

  it("generates development cookie options with secure flag disabled", () => {
    const opts = getRefreshTokenCookieOptions(false);

    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe("strict");
    expect(opts.path).toBe("/api/v1/auth");
    expect(opts.maxAge).toBe(2592000000);
  });

  it("generates clear cookie options with maxAge: 0", () => {
    const opts = getClearRefreshTokenCookieOptions(true);

    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe("strict");
    expect(opts.path).toBe("/api/v1/auth");
    expect(opts.maxAge).toBe(0);
  });
});
