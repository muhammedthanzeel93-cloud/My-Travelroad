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

  it("enforces default generation claim (gen: 1) when omitted", async () => {
    const { gen, ...payloadWithoutGen } = validPayload;
    const token = await signAccessToken(payloadWithoutGen as AccessTokenPayload, {
      secret: TEST_SECRET,
    });
    const claims = await verifyAccessToken(token, { secret: TEST_SECRET });
    expect(claims.gen).toBe(1);
  });

  it("rejects an expired access token with TOKEN_EXPIRED error code", async () => {
    // Sign token with -10 second expiration (already expired)
    const expiredToken = await signAccessToken(validPayload, {
      secret: TEST_SECRET,
      expiresInSeconds: -10,
    });

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
    await expect(
      signAccessToken({ ...validPayload, sub: "" }, { secret: TEST_SECRET })
    ).rejects.toThrow("sub (account ID) must be a non-empty string");

    await expect(
      signAccessToken({ ...validPayload, role: "" as any }, { secret: TEST_SECRET })
    ).rejects.toThrow("role must be a non-empty string");

    await expect(
      signAccessToken({ ...validPayload, email: "" }, { secret: TEST_SECRET })
    ).rejects.toThrow("email must be a non-empty string");

    await expect(
      signAccessToken({ ...validPayload, emailVerified: "yes" as any }, { secret: TEST_SECRET })
    ).rejects.toThrow("emailVerified must be a boolean");

    await expect(
      signAccessToken({ ...validPayload, type: "" as any }, { secret: TEST_SECRET })
    ).rejects.toThrow("type must be a non-empty string");

    await expect(
      signAccessToken({ ...validPayload, status: "" as any }, { secret: TEST_SECRET })
    ).rejects.toThrow("status must be a non-empty string");
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
