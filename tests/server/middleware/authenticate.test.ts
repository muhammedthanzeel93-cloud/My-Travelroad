/**
 * Tests for Authentication Middleware (src/server/middleware/authenticate.ts)
 */

import { describe, it, expect, vi } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createAuthenticateMiddleware } from "../../../src/server/middleware/authenticate";
import { errorHandler } from "../../../src/server/middleware/error-handler";
import { signAccessToken, AccessTokenPayload } from "../../../src/server/auth";

const TEST_SECRET = "test-secret-at-least-32-characters-long-entropy-key!";
const TEST_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";

const basePayload: AccessTokenPayload = {
  sub: TEST_ACCOUNT_ID,
  role: "traveler",
  email: "traveler@mytravelroad.com",
  emailVerified: true,
  type: "individual",
  status: "active",
  gen: 1,
};

function createTestApp(prismaMock: unknown): Express {
  const app = express();
  app.use(express.json());

  const authMiddleware = createAuthenticateMiddleware(
    prismaMock as PrismaClient,
    { secret: TEST_SECRET }
  );

  app.get("/protected", authMiddleware, (req, res) => {
    res.status(200).json({
      success: true,
      auth: req.auth,
      user: req.user,
    });
  });

  app.use(errorHandler);
  return app;
}

describe("Authentication Middleware", () => {
  it("rejects request when Authorization header is missing", async () => {
    const app = createTestApp({});

    const res = await request(app).get("/protected");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(res.body.error.message).toContain("missing Authorization header");
  });

  it("rejects request when Authorization header is malformed (no Bearer prefix)", async () => {
    const app = createTestApp({});

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Basic dXNlcjpwYXNz");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(res.body.error.message).toContain("malformed Authorization header");
  });

  it("rejects request when Bearer token is empty or whitespace", async () => {
    const app = createTestApp({});

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer    ");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(res.body.error.message).toContain("empty token");
  });

  it("rejects request when JWT has an invalid signature", async () => {
    const app = createTestApp({});
    const token = await signAccessToken(basePayload, { secret: TEST_SECRET });
    const tampered = `${token.slice(0, -5)}abcde`;

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${tampered}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });

  it("rejects request when JWT is expired", async () => {
    const app = createTestApp({});
    // Generate token that expires in 1 second
    const token = await signAccessToken(basePayload, {
      secret: TEST_SECRET,
      expiresInSeconds: 1,
    });

    // Wait 1.1s for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("rejects request when account does not exist in PostgreSQL", async () => {
    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    const app = createTestApp(mockPrisma);
    const token = await signAccessToken(basePayload, { secret: TEST_SECRET });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(res.body.error.message).toContain("Account not found or no longer active");
    expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
      where: { id: TEST_ACCOUNT_ID },
      select: expect.objectContaining({ id: true, email: true }),
    });
  });

  it("rejects request when account type is 'system'", async () => {
    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: TEST_ACCOUNT_ID,
          email: "system@mytravelroad.com",
          emailVerified: true,
          status: "active",
          type: "system",
          role: "traveler",
          securityCredentials: null,
        }),
      },
    };

    const app = createTestApp(mockPrisma);
    const token = await signAccessToken(
      { ...basePayload, type: "system" },
      { secret: TEST_SECRET }
    );

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
    expect(res.body.error.message).toContain("System accounts cannot authenticate");
  });

  it("rejects request when account status is 'suspended'", async () => {
    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: TEST_ACCOUNT_ID,
          email: "suspended@mytravelroad.com",
          emailVerified: true,
          status: "suspended",
          type: "individual",
          role: "traveler",
          securityCredentials: null,
        }),
      },
    };

    const app = createTestApp(mockPrisma);
    const token = await signAccessToken(basePayload, { secret: TEST_SECRET });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
    expect(res.body.error.message).toContain("Account has been suspended");
  });

  it("rejects request when account status is 'deactivated'", async () => {
    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: TEST_ACCOUNT_ID,
          email: "deactivated@mytravelroad.com",
          emailVerified: true,
          status: "deactivated",
          type: "individual",
          role: "traveler",
          securityCredentials: null,
        }),
      },
    };

    const app = createTestApp(mockPrisma);
    const token = await signAccessToken(basePayload, { secret: TEST_SECRET });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
    expect(res.body.error.message).toContain("Account has been deactivated");
  });

  it("rejects request when token was issued prior to password change (Stage A invalidation)", async () => {
    const token = await signAccessToken(basePayload, { secret: TEST_SECRET });

    // Simulate password changed 100 seconds in the future relative to token iat
    const futureDate = new Date(Date.now() + 100000);

    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: TEST_ACCOUNT_ID,
          email: "traveler@mytravelroad.com",
          emailVerified: true,
          status: "active",
          type: "individual",
          role: "traveler",
          securityCredentials: {
            passwordChangedAt: futureDate,
          },
        }),
      },
    };

    const app = createTestApp(mockPrisma);

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
    expect(res.body.error.message).toContain("Session has been invalidated due to password change");
  });

  it("accepts request when token was issued after password change", async () => {
    // Password changed in the past (10 minutes ago)
    const pastDate = new Date(Date.now() - 600000);

    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: TEST_ACCOUNT_ID,
          email: "traveler@mytravelroad.com",
          emailVerified: true,
          status: "active",
          type: "individual",
          role: "traveler",
          securityCredentials: {
            passwordChangedAt: pastDate,
          },
        }),
      },
    };

    const app = createTestApp(mockPrisma);
    const token = await signAccessToken(basePayload, { secret: TEST_SECRET });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.auth.accountId).toBe(TEST_ACCOUNT_ID);
  });

  it("fails closed with 503 SERVICE_UNAVAILABLE when database throws an error without leaking secrets", async () => {
    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockRejectedValue(new Error("FATAL: password authentication failed for postgresql://secret:pass@10.0.0.1:5432")),
      },
    };

    const app = createTestApp(mockPrisma);
    const token = await signAccessToken(basePayload, { secret: TEST_SECRET });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.body.error.message).toBe("Authentication service temporarily unavailable");
    // Verify secret is not reflected
    expect(JSON.stringify(res.body)).not.toContain("password authentication failed");
    expect(JSON.stringify(res.body)).not.toContain("10.0.0.1");
  });

  it("attaches authoritative principal taking role and status from database over stale JWT claims", async () => {
    // JWT claims state traveler, but PostgreSQL has curator
    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: TEST_ACCOUNT_ID,
          email: "curator@mytravelroad.com",
          emailVerified: true,
          status: "active",
          type: "individual",
          role: "curator",
          securityCredentials: null,
        }),
      },
    };

    const app = createTestApp(mockPrisma);
    const token = await signAccessToken(
      { ...basePayload, role: "traveler" },
      { secret: TEST_SECRET }
    );

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.auth).toEqual({
      accountId: TEST_ACCOUNT_ID,
      email: "curator@mytravelroad.com",
      role: "curator",
      accountType: "individual",
      accountStatus: "active",
      emailVerified: true,
    });
    expect(res.body.user).toEqual(res.body.auth);
  });

  it("permits pending_verification account to authenticate and attaches accurate status", async () => {
    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: TEST_ACCOUNT_ID,
          email: "pending@mytravelroad.com",
          emailVerified: false,
          status: "pending_verification",
          type: "individual",
          role: "traveler",
          securityCredentials: null,
        }),
      },
    };

    const app = createTestApp(mockPrisma);
    const token = await signAccessToken(
      { ...basePayload, status: "pending_verification", emailVerified: false },
      { secret: TEST_SECRET }
    );

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.auth.accountStatus).toBe("pending_verification");
    expect(res.body.auth.emailVerified).toBe(false);
  });

  it("rejects account when database contains corrupted/unrecognized role", async () => {
    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: TEST_ACCOUNT_ID,
          email: "corrupt@mytravelroad.com",
          emailVerified: true,
          status: "active",
          type: "individual",
          role: "invalid_hacked_role",
          securityCredentials: null,
        }),
      },
    };

    const app = createTestApp(mockPrisma);
    const token = await signAccessToken(basePayload, { secret: TEST_SECRET });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
    expect(res.body.error.message).toContain("Corrupted account authorization attributes");
  });
});
