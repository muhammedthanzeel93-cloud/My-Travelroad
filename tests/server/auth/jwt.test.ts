/**
 * Tests for JWT Access Token Signing & Verification (src/server/auth/jwt.ts)
 */

import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import {
  signAccessToken,
  verifyAccessToken,
  ACCESS_TOKEN_EXPIRATION_SECONDS,
  JWT_ALGORITHM,
  UUID_V4_REGEX,
  isValidUserRole,
  isValidAccountType,
  isValidAccountStatus,
  AccessTokenPayload,
} from "../../../src/server/auth";
import { UnauthorizedError } from "../../../src/server/errors/app-error";
import { ErrorCode } from "../../../src/server/errors/error-codes";

describe("JWT Access Token Security Module", () => {
  const TEST_SECRET = "super-confidential-test-secret-key-32-bytes!";
  const ALT_SECRET = "alternative-test-secret-key-also-32-bytes-long!";
  const TEST_ISSUER = "https://mytravelroad.com";
  const TEST_AUDIENCE = "https://mytravelroad.com";

  const validPayload: AccessTokenPayload = {
    sub: "550e8400-e29b-41d4-a716-446655440001",
    role: "traveler",
    email: "traveler@example.com",
    emailVerified: true,
    type: "individual",
    status: "active",
    gen: 1,
  };

  it("successfully signs and verifies an access token with valid claims", async () => {
    const token = await signAccessToken(validPayload, { secret: TEST_SECRET });
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // Header.Payload.Signature

    const claims = await verifyAccessToken(token, { secret: TEST_SECRET });

    expect(claims.sub).toBe(validPayload.sub);
    expect(claims.role).toBe(validPayload.role);
    expect(claims.email).toBe(validPayload.email);
    expect(claims.emailVerified).toBe(true);
    expect(claims.type).toBe("individual");
    expect(claims.status).toBe("active");
    expect(claims.gen).toBe(1);

    // Standard registered claims
    expect(claims.iss).toBe("https://mytravelroad.com");
    expect(claims.aud).toBe("https://mytravelroad.com");
    expect(typeof claims.iat).toBe("number");
    expect(typeof claims.exp).toBe("number");
    expect(claims.exp - claims.iat).toBe(ACCESS_TOKEN_EXPIRATION_SECONDS);
  });

  it("rejects an access token with missing, zero, negative, or non-integer generation (gen) claim", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);

    // 1. Missing gen claim
    const tokenNoGen = await new SignJWT({
      role: validPayload.role,
      email: validPayload.email,
      emailVerified: validPayload.emailVerified,
      type: validPayload.type,
      status: validPayload.status,
    })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(tokenNoGen, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Token missing valid generation (gen) claim", ErrorCode.TOKEN_INVALID)
    );

    // 2. gen: 0
    const tokenGenZero = await new SignJWT({ ...validPayload, gen: 0 })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(tokenGenZero, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Token missing valid generation (gen) claim", ErrorCode.TOKEN_INVALID)
    );

    // 3. gen: -1
    const tokenGenNegative = await new SignJWT({ ...validPayload, gen: -1 })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(tokenGenNegative, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Token missing valid generation (gen) claim", ErrorCode.TOKEN_INVALID)
    );

    // 4. gen: float (1.5)
    const tokenGenFloat = await new SignJWT({ ...validPayload, gen: 1.5 })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(tokenGenFloat, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Token missing valid generation (gen) claim", ErrorCode.TOKEN_INVALID)
    );
  });

  it("rejects an expired access token with TOKEN_EXPIRED error code", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);
    // Create an expired token directly using jose SignJWT with negative expiration
    const expiredToken = await new SignJWT({ ...validPayload })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 100)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    let error: any = null;
    try {
      await verifyAccessToken(expiredToken, { secret: TEST_SECRET });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.code).toBe(ErrorCode.TOKEN_EXPIRED);
    expect(error.statusCode).toBe(401);
  });

  it("defensively validates expiresInSeconds during signing", async () => {
    // Rejects zero
    await expect(
      signAccessToken(validPayload, { secret: TEST_SECRET, expiresInSeconds: 0 })
    ).rejects.toThrow("must be a positive integer between 1 and 86400 seconds");

    // Rejects negative
    await expect(
      signAccessToken(validPayload, { secret: TEST_SECRET, expiresInSeconds: -10 })
    ).rejects.toThrow("must be a positive integer between 1 and 86400 seconds");

    // Rejects non-integer float
    await expect(
      signAccessToken(validPayload, { secret: TEST_SECRET, expiresInSeconds: 12.5 })
    ).rejects.toThrow("must be a positive integer between 1 and 86400 seconds");

    // Rejects unreasonable values (> 86400 seconds / 24 hours)
    await expect(
      signAccessToken(validPayload, { secret: TEST_SECRET, expiresInSeconds: 100000 })
    ).rejects.toThrow("must be a positive integer between 1 and 86400 seconds");

    // Accepts valid override
    const token = await signAccessToken(validPayload, {
      secret: TEST_SECRET,
      expiresInSeconds: 300,
    });
    const claims = await verifyAccessToken(token, { secret: TEST_SECRET });
    expect(claims.exp - claims.iat).toBe(300);
  });

  it("rejects access tokens containing unapproved or forged user roles", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);

    const forgedRoles = ["agency_admin", "agency_agent", "admin", "guest", "root", ""];

    for (const badRole of forgedRoles) {
      const token = await new SignJWT({ ...validPayload, role: badRole })
        .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
        .setSubject(validPayload.sub)
        .setIssuedAt()
        .setExpirationTime("15m")
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_AUDIENCE)
        .sign(key);

      await expect(verifyAccessToken(token, { secret: TEST_SECRET })).rejects.toThrow(
        new UnauthorizedError("Token contains invalid or unsupported role claim", ErrorCode.TOKEN_INVALID)
      );
    }
  });

  it("rejects access tokens containing unapproved account types", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);

    const forgedTypes = ["enterprise", "operator", "custom", ""];

    for (const badType of forgedTypes) {
      const token = await new SignJWT({ ...validPayload, type: badType })
        .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
        .setSubject(validPayload.sub)
        .setIssuedAt()
        .setExpirationTime("15m")
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_AUDIENCE)
        .sign(key);

      await expect(verifyAccessToken(token, { secret: TEST_SECRET })).rejects.toThrow(
        new UnauthorizedError("Token contains invalid or unsupported type claim", ErrorCode.TOKEN_INVALID)
      );
    }
  });

  it("rejects access tokens containing unapproved account statuses", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);

    const forgedStatuses = ["archived", "banned", "deleted", "locked", ""];

    for (const badStatus of forgedStatuses) {
      const token = await new SignJWT({ ...validPayload, status: badStatus })
        .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
        .setSubject(validPayload.sub)
        .setIssuedAt()
        .setExpirationTime("15m")
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_AUDIENCE)
        .sign(key);

      await expect(verifyAccessToken(token, { secret: TEST_SECRET })).rejects.toThrow(
        new UnauthorizedError("Token contains invalid or unsupported status claim", ErrorCode.TOKEN_INVALID)
      );
    }
  });

  it("rejects access tokens containing malformed, non-UUID, or non-v4 UUID subject (sub)", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);

    // Includes malformed strings, non-UUIDs, and valid UUIDs of versions other than 4 (v1, v3, v5)
    const badSubs = [
      "not-a-uuid",
      "12345",
      "550e8400-e29b-41d4-a716",
      "user_123456789",
      "",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8", // UUIDv1
      "6ba7b811-9dad-31d1-80b4-00c04fd430c8", // UUIDv3
      "6ba7b814-9dad-51d1-80b4-00c04fd430c8", // UUIDv5
    ];

    for (const badSub of badSubs) {
      const token = await new SignJWT({ ...validPayload, sub: badSub })
        .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_AUDIENCE)
        .sign(key);

      await expect(verifyAccessToken(token, { secret: TEST_SECRET })).rejects.toThrow(
        new UnauthorizedError("Token missing valid account UUIDv4 subject (sub) claim", ErrorCode.TOKEN_INVALID)
      );
    }
  });

  it("extracts and verifies the expected audience from multiple audiences in aud array", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);

    // aud is an array where the expected audience is at index 1 (not index 0)
    const token = await new SignJWT({ ...validPayload })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .setIssuer(TEST_ISSUER)
      .setAudience(["https://other-service.example.com", TEST_AUDIENCE])
      .sign(key);

    const claims = await verifyAccessToken(token, {
      secret: TEST_SECRET,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
    });

    // Returned claim MUST be the verified expected audience, NOT the first element
    expect(claims.aud).toBe(TEST_AUDIENCE);
  });

  it("rejects access tokens containing invalid email or non-boolean emailVerified", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);

    // Bad email
    const badEmailToken = await new SignJWT({ ...validPayload, email: "invalid-email-string" })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(badEmailToken, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Token missing valid email claim", ErrorCode.TOKEN_INVALID)
    );

    // Non-boolean emailVerified
    const nonBoolToken = await new SignJWT({ ...validPayload, emailVerified: "true" as any })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(nonBoolToken, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Token missing valid emailVerified claim", ErrorCode.TOKEN_INVALID)
    );
  });

  it("rejects access tokens with missing exp, exp <= iat, or future iat", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);
    const now = Math.floor(Date.now() / 1000);

    // 1. Missing iat
    const tokenNoIat = await new SignJWT({ ...validPayload })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setExpirationTime("15m")
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(tokenNoIat, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Token missing valid issued-at (iat) timestamp claim", ErrorCode.TOKEN_INVALID)
    );

    // 2. Missing exp claim
    const tokenNoExp = await new SignJWT({ ...validPayload })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt(now)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(tokenNoExp, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Token missing valid expiration (exp) timestamp claim", ErrorCode.TOKEN_INVALID)
    );

    // 3. exp === iat
    const tokenExpEqualIat = await new SignJWT({ ...validPayload })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt(now)
      .setExpirationTime(now)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(tokenExpEqualIat, { secret: TEST_SECRET })).rejects.toThrow(
      UnauthorizedError
    );

    // 4. exp < iat
    const tokenExpLessThanIat = await new SignJWT({ ...validPayload })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt(now)
      .setExpirationTime(now - 100)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(tokenExpLessThanIat, { secret: TEST_SECRET })).rejects.toThrow(
      UnauthorizedError
    );

    // 5. iat 2 hours in the future (unreasonable future beyond CLOCK_TOLERANCE_SECONDS)
    const tokenFutureIat = await new SignJWT({ ...validPayload })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt(now + 7200)
      .setExpirationTime(now + 8100)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    await expect(verifyAccessToken(tokenFutureIat, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Token issued-at (iat) timestamp is unreasonably in the future", ErrorCode.TOKEN_INVALID)
    );

    // 6. iat within 30 seconds into the future (within CLOCK_TOLERANCE_SECONDS = 60s)
    const tokenPermittedDrift = await new SignJWT({ ...validPayload })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setSubject(validPayload.sub)
      .setIssuedAt(now + 30)
      .setExpirationTime(now + 930)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .sign(key);

    const verifiedDrift = await verifyAccessToken(tokenPermittedDrift, { secret: TEST_SECRET });
    expect(verifiedDrift.iat).toBe(now + 30);
  });

  it("verifies runtime type guards correctly identify valid and invalid values", () => {
    // UserRole
    expect(isValidUserRole("traveler")).toBe(true);
    expect(isValidUserRole("super_admin")).toBe(true);
    expect(isValidUserRole("agency_admin")).toBe(false);
    expect(isValidUserRole("")).toBe(false);
    expect(isValidUserRole(null)).toBe(false);
    expect(isValidUserRole(123)).toBe(false);

    // AccountType
    expect(isValidAccountType("individual")).toBe(true);
    expect(isValidAccountType("business")).toBe(true);
    expect(isValidAccountType("system")).toBe(true);
    expect(isValidAccountType("enterprise")).toBe(false);
    expect(isValidAccountType(undefined)).toBe(false);

    // AccountStatus
    expect(isValidAccountStatus("active")).toBe(true);
    expect(isValidAccountStatus("suspended")).toBe(true);
    expect(isValidAccountStatus("pending_verification")).toBe(true);
    expect(isValidAccountStatus("deactivated")).toBe(true);
    expect(isValidAccountStatus("archived")).toBe(false);
    expect(isValidAccountStatus(false)).toBe(false);
  });

  it("rejects an access token with a tampered signature", async () => {
    const token = await signAccessToken(validPayload, { secret: TEST_SECRET });
    const parts = token.split(".");
    // Corrupt the signature segment
    const tamperedToken = `${parts[0]}.${parts[1]}.tamperedSignatureCharacters`;

    await expect(verifyAccessToken(tamperedToken, { secret: TEST_SECRET })).rejects.toThrow(
      UnauthorizedError
    );

    try {
      await verifyAccessToken(tamperedToken, { secret: TEST_SECRET });
    } catch (err: any) {
      expect(err.code).toBe(ErrorCode.TOKEN_INVALID);
    }
  });

  it("rejects an access token with tampered payload claims", async () => {
    const token = await signAccessToken(validPayload, { secret: TEST_SECRET });
    const parts = token.split(".");

    // Decode, tamper role to super_admin, and re-encode payload
    const decodedPayload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    decodedPayload.role = "super_admin";
    const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    try {
      await verifyAccessToken(tamperedToken, { secret: TEST_SECRET });
      expect.fail("Should have thrown UnauthorizedError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.code).toBe(ErrorCode.TOKEN_INVALID);
    }
  });

  it("rejects an access token signed with an unauthorized secret key", async () => {
    const token = await signAccessToken(validPayload, { secret: ALT_SECRET });

    try {
      await verifyAccessToken(token, { secret: TEST_SECRET });
      expect.fail("Should have thrown UnauthorizedError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.code).toBe(ErrorCode.TOKEN_INVALID);
    }
  });

  it("defeats algorithm-confusion attacks by rejecting tokens with unsupported algorithms", async () => {
    const key = new TextEncoder().encode(TEST_SECRET);

    // 1. Attack vector: 'none' algorithm (manually constructed unsigned JWT)
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        ...validPayload,
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 900,
        iat: Math.floor(Date.now() / 1000),
      })
    ).toString("base64url");
    const noneToken = `${header}.${payload}.`;

    await expect(verifyAccessToken(noneToken, { secret: TEST_SECRET })).rejects.toThrow(
      UnauthorizedError
    );

    // 2. Attack vector: 'HS512' when pinned to 'HS256'
    const hs512Token = await new SignJWT({ ...validPayload })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(validPayload.sub)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key);

    await expect(verifyAccessToken(hs512Token, { secret: TEST_SECRET })).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("rejects access tokens with mismatched issuer or audience", async () => {
    const token = await signAccessToken(validPayload, {
      secret: TEST_SECRET,
      issuer: "https://attacker.example.com",
    });

    try {
      await verifyAccessToken(token, {
        secret: TEST_SECRET,
        issuer: "https://mytravelroad.com",
      });
      expect.fail("Should have thrown on mismatched issuer");
    } catch (err: any) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.code).toBe(ErrorCode.TOKEN_INVALID);
    }
  });

  it("rejects empty, whitespace, or non-string tokens with AUTHENTICATION_REQUIRED", async () => {
    await expect(verifyAccessToken("", { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Access token is required", ErrorCode.AUTHENTICATION_REQUIRED)
    );
    await expect(verifyAccessToken("   ", { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Access token is required", ErrorCode.AUTHENTICATION_REQUIRED)
    );
    await expect(verifyAccessToken(null as any, { secret: TEST_SECRET })).rejects.toThrow(
      new UnauthorizedError("Access token is required", ErrorCode.AUTHENTICATION_REQUIRED)
    );
  });

  it("validates required payload properties during signing", async () => {
    // sub: empty or non-UUID
    await expect(
      signAccessToken({ ...validPayload, sub: "" }, { secret: TEST_SECRET })
    ).rejects.toThrow("sub must be a valid account UUIDv4 string");
    await expect(
      signAccessToken({ ...validPayload, sub: "not-a-uuid" }, { secret: TEST_SECRET })
    ).rejects.toThrow("sub must be a valid account UUIDv4 string");

    // role: empty or invalid
    await expect(
      signAccessToken({ ...validPayload, role: "" as any }, { secret: TEST_SECRET })
    ).rejects.toThrow("role must be one of");
    await expect(
      signAccessToken({ ...validPayload, role: "agency_admin" as any }, { secret: TEST_SECRET })
    ).rejects.toThrow("role must be one of");

    // email: empty or invalid format
    await expect(
      signAccessToken({ ...validPayload, email: "" }, { secret: TEST_SECRET })
    ).rejects.toThrow("email must be a valid non-empty email string");
    await expect(
      signAccessToken({ ...validPayload, email: "invalid-email" }, { secret: TEST_SECRET })
    ).rejects.toThrow("email must be a valid non-empty email string");

    // emailVerified: non-boolean
    await expect(
      signAccessToken({ ...validPayload, emailVerified: "yes" as any }, { secret: TEST_SECRET })
    ).rejects.toThrow("emailVerified must be a boolean");

    // type: invalid
    await expect(
      signAccessToken({ ...validPayload, type: "enterprise" as any }, { secret: TEST_SECRET })
    ).rejects.toThrow("type must be one of");

    // status: invalid
    await expect(
      signAccessToken({ ...validPayload, status: "archived" as any }, { secret: TEST_SECRET })
    ).rejects.toThrow("status must be one of");

    // gen: missing, zero, or negative
    await expect(
      signAccessToken({ ...validPayload, gen: 0 }, { secret: TEST_SECRET })
    ).rejects.toThrow("gen must be a positive integer >= 1");
    await expect(
      signAccessToken({ ...validPayload, gen: -1 }, { secret: TEST_SECRET })
    ).rejects.toThrow("gen must be a positive integer >= 1");
    await expect(
      signAccessToken({ ...validPayload, gen: 1.5 }, { secret: TEST_SECRET })
    ).rejects.toThrow("gen must be a positive integer >= 1");
  });

  it("produces sanitized error responses without leaking secret keys or tokens", async () => {
    let capturedError: any = null;
    try {
      await verifyAccessToken("invalid.malformed.token", { secret: TEST_SECRET });
    } catch (err) {
      capturedError = err;
    }

    expect(capturedError).toBeInstanceOf(UnauthorizedError);
    expect(capturedError.code).toBe(ErrorCode.TOKEN_INVALID);
    // Explicitly verify secret and internal tokens are not leaked
    expect(capturedError.message).not.toContain(TEST_SECRET);
    expect(capturedError.message).not.toContain("invalid.malformed.token");
  });

  it("rejects secrets containing fewer than 32 characters (256 bits)", async () => {
    const shortSecret = "short-secret-only-24-chars";
    await expect(signAccessToken(validPayload, { secret: shortSecret })).rejects.toThrow(
      "JWT secret must be a string containing at least 32 characters"
    );
    await expect(verifyAccessToken("dummy.token.string", { secret: shortSecret })).rejects.toThrow(
      "JWT secret must be a string containing at least 32 characters"
    );
  });
});
