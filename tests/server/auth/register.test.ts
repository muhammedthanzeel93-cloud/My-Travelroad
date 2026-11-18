/**
 * Tests for Secure Tourist Account Registration API
 * Endpoint: POST /api/v1/auth/register
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { PrismaClient, Prisma } from "@prisma/client";
import { createApp } from "../../../src/server/app";
import { verifyPassword } from "../../../src/server/auth/password";
import { createRateLimiter, registrationRateLimiter } from "../../../src/server/middleware/rate-limiter";
import { createAuthRouter } from "../../../src/server/routes/auth.routes";
import express, { Express } from "express";
import { errorHandler } from "../../../src/server/middleware/error-handler";

const VALID_REGISTRATION_PAYLOAD = {
  email: "amina.rahman@example.com",
  password: "Password123!",
  displayName: "Amina Rahman",
  handle: "amina_explorer",
  preferredLanguage: "en",
};

describe("POST /api/v1/auth/register", () => {
  let createdAccountData: any = null;
  let createdCredentialData: any = null;
  let createdProfileData: any = null;
  const passthroughLimiter = (_req: any, _res: any, next: any) => next();

  beforeEach(() => {
    registrationRateLimiter.reset();
  });

  function createMockPrisma(overrides: {
    accountCreate?: () => Promise<any>;
    credentialCreate?: () => Promise<any>;
    profileCreate?: () => Promise<any>;
    transactionThrows?: Error;
  } = {}) {
    createdAccountData = null;
    createdCredentialData = null;
    createdProfileData = null;

    const mockAccount = {
      id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
      email: "amina.rahman@example.com",
      role: "traveler",
      type: "individual",
      status: "pending_verification",
      emailVerified: false,
      phoneVerified: false,
      createdAt: new Date("2026-11-18T12:00:00.000Z"),
    };

    const mockProfile = {
      id: "f8c1b991-033d-58c3-ab68-1c2b89f8a202",
      accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
      displayName: "Amina Rahman",
      handle: "amina_explorer",
      preferredLanguage: "en",
      travelPreferences: [],
      isPublic: true,
      createdAt: new Date("2026-11-18T12:00:00.000Z"),
    };

    const txMock = {
      account: {
        create: vi.fn().mockImplementation(async (args: any) => {
          createdAccountData = args.data;
          if (overrides.accountCreate) return overrides.accountCreate();
          return {
            ...mockAccount,
            ...args.data,
            createdAt: mockAccount.createdAt,
          };
        }),
      },
      accountSecurityCredential: {
        create: vi.fn().mockImplementation(async (args: any) => {
          createdCredentialData = args.data;
          if (overrides.credentialCreate) return overrides.credentialCreate();
          return { ...args.data, createdAt: new Date() };
        }),
      },
      touristProfile: {
        create: vi.fn().mockImplementation(async (args: any) => {
          createdProfileData = args.data;
          if (overrides.profileCreate) return overrides.profileCreate();
          return {
            ...mockProfile,
            ...args.data,
            createdAt: mockProfile.createdAt,
          };
        }),
      },
    };

    return {
      $transaction: vi.fn().mockImplementation(async (callback: any) => {
        if (overrides.transactionThrows) {
          throw overrides.transactionThrows;
        }
        return await callback(txMock);
      }),
      account: txMock.account,
      accountSecurityCredential: txMock.accountSecurityCredential,
      touristProfile: txMock.touristProfile,
    } as unknown as PrismaClient;
  }

  describe("Validation Requirements", () => {
    it("successfully validates and creates an account with valid payload", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(VALID_REGISTRATION_PAYLOAD);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account).toEqual({
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        status: "pending_verification",
        emailVerified: false,
        createdAt: "2026-11-18T12:00:00.000Z",
      });
      expect(res.body.data.profile).toEqual({
        id: "f8c1b991-033d-58c3-ab68-1c2b89f8a202",
        displayName: "Amina Rahman",
        handle: "amina_explorer",
        preferredLanguage: "en",
        travelPreferences: [],
        isPublic: true,
      });
    });

    it("normalizes email to lowercase", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          ...VALID_REGISTRATION_PAYLOAD,
          email: "AMINA.RAHMAN@EXAMPLE.COM",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.account.email).toBe("amina.rahman@example.com");
      expect(createdAccountData.email).toBe("amina.rahman@example.com");
    });

    it("rejects invalid email formats", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const invalidEmails = ["notanemail", "missing@domain", "@missinguser.com", "spaces in@email.com"];
      for (const email of invalidEmails) {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .send({ ...VALID_REGISTRATION_PAYLOAD, email });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("rejects email exceeding 255 characters", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const longEmail = "a".repeat(250) + "@example.com";
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, email: longEmail });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("preserves exact password without trimming whitespace", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const passwordWithSpaces = " Password123! ";
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, password: passwordWithSpaces });

      expect(res.status).toBe(201);
      // Verify Argon2id hash matches the EXACT untrimmed password
      const hash = createdCredentialData.passwordHash;
      expect(await verifyPassword(passwordWithSpaces, hash)).toBe(true);
      expect(await verifyPassword("Password123!", hash)).toBe(false);
    });

    it("rejects password with fewer than 8 Unicode code points", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, password: "Pass1!" });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects password with more than 72 Unicode code points", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const pass73 = "Password123!" + "a".repeat(61);
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, password: pass73 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("accepts password at exact 8 and 72 Unicode code point boundaries with supplementary characters (emojis)", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      // 8 code points: 7 ASCII + 1 emoji (2 UTF-16 code units) = 8 Unicode code points
      const pass8 = "Passw1!🌴";
      const res8 = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, password: pass8 });
      expect(res8.status).toBe(201);

      // 72 code points with emojis
      const pass72 = "Password123!" + "🌴".repeat(60);
      const res72 = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, password: pass72 });
      expect(res72.status).toBe(201);
    });

    it("rejects passwords lacking required complexity (uppercase, lowercase, digit)", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      // Missing uppercase
      const resNoUpper = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, password: "password123!" });
      expect(resNoUpper.status).toBe(422);

      // Missing lowercase
      const resNoLower = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, password: "PASSWORD123!" });
      expect(resNoLower.status).toBe(422);

      // Missing digit
      const resNoDigit = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, password: "Password!Special" });
      expect(resNoDigit.status).toBe(422);
    });

    it("trims surrounding whitespace from display name and rejects invalid lengths", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      // Trimmed correctly
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, displayName: "  Amina Rahman  " });
      expect(res.status).toBe(201);
      expect(createdProfileData.displayName).toBe("Amina Rahman");

      // Too short (< 2 chars)
      const resShort = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, displayName: "A" });
      expect(resShort.status).toBe(422);

      // Whitespace only (< 2 chars after trim)
      const resWhitespace = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, displayName: "   " });
      expect(resWhitespace.status).toBe(422);

      // Too long (> 120 chars)
      const resLong = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, displayName: "A".repeat(121) });
      expect(resLong.status).toBe(422);
    });

    it("strictly validates handle regex ^[a-z0-9_]+$ without silent conversion", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      // Valid handles
      const validHandles = ["amina_explorer", "user123", "a_b_c_42", "wanderer_99"];
      for (const handle of validHandles) {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .send({ ...VALID_REGISTRATION_PAYLOAD, handle });
        expect(res.status).toBe(201);
      }

      // Rejects uppercase letters (must NOT silently convert)
      const resUpper = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, handle: "Amina_Explorer" });
      expect(resUpper.status).toBe(422);

      // Rejects special characters or hyphens
      const invalidHandles = ["@amina", "amina-explorer", "amina.rahman", "amina explorer", "ab"];
      for (const handle of invalidHandles) {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .send({ ...VALID_REGISTRATION_PAYLOAD, handle });
        expect(res.status).toBe(422);
      }
    });

    it("validates preferred language allowlist ('en', 'ml') and defaults to 'en'", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      // 'ml' accepted
      const resMl = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, preferredLanguage: "ml" });
      expect(resMl.status).toBe(201);
      expect(createdProfileData.preferredLanguage).toBe("ml");

      // Omitted preferredLanguage defaults to 'en'
      const { preferredLanguage: _, ...withoutLang } = VALID_REGISTRATION_PAYLOAD;
      const resDefault = await request(app)
        .post("/api/v1/auth/register")
        .send(withoutLang);
      expect(resDefault.status).toBe(201);
      expect(createdProfileData.preferredLanguage).toBe("en");

      // Unsupported languages rejected
      const resUnsupported = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...VALID_REGISTRATION_PAYLOAD, preferredLanguage: "fr" });
      expect(resUnsupported.status).toBe(422);
    });

    it("strictly rejects unknown/injected properties (preventing client privilege elevation)", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const injectedPayloads = [
        { ...VALID_REGISTRATION_PAYLOAD, role: "super_admin" },
        { ...VALID_REGISTRATION_PAYLOAD, status: "active" },
        { ...VALID_REGISTRATION_PAYLOAD, emailVerified: true },
        { ...VALID_REGISTRATION_PAYLOAD, type: "system" },
        { ...VALID_REGISTRATION_PAYLOAD, id: "00000000-0000-4000-8000-000000000099" },
        { ...VALID_REGISTRATION_PAYLOAD, passwordHash: "argon2id_hash" },
        { ...VALID_REGISTRATION_PAYLOAD, travelPreferences: ["ecotourism_nature"] },
      ];

      for (const payload of injectedPayloads) {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .send(payload);

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("Persistence & Atomic Transaction Guarantees", () => {
    it("creates account, credentials, and profile with authoritative Stage A defaults", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(VALID_REGISTRATION_PAYLOAD);

      expect(res.status).toBe(201);

      // Verify Account defaults
      expect(createdAccountData.type).toBe("individual");
      expect(createdAccountData.role).toBe("traveler");
      expect(createdAccountData.status).toBe("pending_verification");
      expect(createdAccountData.emailVerified).toBe(false);
      expect(createdAccountData.phoneVerified).toBe(false);

      // Verify Security Credential defaults & Argon2id hash
      expect(createdCredentialData.accountId).toBe("e7b0a880-922c-47b2-9a57-0b1a78e7f101");
      expect(createdCredentialData.mfaEnabled).toBe(false);
      expect(createdCredentialData.failedLoginAttempts).toBe(0);
      expect(createdCredentialData.passwordHash).toMatch(/^\$argon2id\$/);

      // Verify TouristProfile defaults
      expect(createdProfileData.accountId).toBe("e7b0a880-922c-47b2-9a57-0b1a78e7f101");
      expect(createdProfileData.isPublic).toBe(true);
      expect(createdProfileData.travelPreferences).toEqual([]);
    });

    it("rolls back the entire transaction if credential creation fails", async () => {
      const mockPrisma = createMockPrisma({
        credentialCreate: async () => {
          throw new Error("Simulated database failure during credential insert");
        },
      });
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(VALID_REGISTRATION_PAYLOAD);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("rolls back the entire transaction if profile creation fails", async () => {
      const mockPrisma = createMockPrisma({
        profileCreate: async () => {
          throw new Error("Simulated database failure during profile insert");
        },
      });
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(VALID_REGISTRATION_PAYLOAD);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("Duplicate Handling & Concurrency Safety", () => {
    it("safely maps Prisma P2002 email uniqueness violation to 409 DUPLICATE_RESOURCE without exposing database internals", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`email`)",
        {
          code: "P2002",
          clientVersion: "5.22.0",
          meta: { target: ["email"] },
        }
      );

      const mockPrisma = createMockPrisma({ transactionThrows: p2002Error });
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(VALID_REGISTRATION_PAYLOAD);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("DUPLICATE_RESOURCE");
      expect(res.body.error.message).toBe("An account with the provided email or handle already exists.");
      // Ensure no raw SQL, constraint name, or stack trace leaked
      expect(JSON.stringify(res.body)).not.toContain("uq_accounts_email");
      expect(JSON.stringify(res.body)).not.toContain("PrismaClientKnownRequestError");
    });

    it("safely maps Prisma P2002 handle uniqueness violation to 409 DUPLICATE_RESOURCE without exposing database internals", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`handle`)",
        {
          code: "P2002",
          clientVersion: "5.22.0",
          meta: { target: ["handle"] },
        }
      );

      const mockPrisma = createMockPrisma({ transactionThrows: p2002Error });
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(VALID_REGISTRATION_PAYLOAD);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("DUPLICATE_RESOURCE");
      expect(res.body.error.message).toBe("An account with the provided email or handle already exists.");
      expect(JSON.stringify(res.body)).not.toContain("uq_profiles_handle");
    });
  });

  describe("Security, Credential Non-Leakage & Rate Limiting", () => {
    it("never returns credentials, password hashes, or internal database fields in the response", async () => {
      const mockPrisma = createMockPrisma();
      const app = createApp({ prismaClient: mockPrisma, rateLimiter: passthroughLimiter });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(VALID_REGISTRATION_PAYLOAD);

      expect(res.status).toBe(201);
      const resBodyStr = JSON.stringify(res.body);
      expect(resBodyStr).not.toContain("password");
      expect(resBodyStr).not.toContain("passwordHash");
      expect(resBodyStr).not.toContain("argon2");
      expect(resBodyStr).not.toContain("mfa");
      expect(resBodyStr).not.toContain("failedLoginAttempts");
      expect(resBodyStr).not.toContain("accessToken");
      expect(resBodyStr).not.toContain("refreshToken");
    });

    it("enforces rate limit of 5 requests per minute per IP and returns 429 RATE_LIMIT_EXCEEDED with Retry-After", async () => {
      const testLimiter = createRateLimiter({
        windowMs: 60_000,
        max: 5,
        message: "Too many registration attempts. Please try again later.",
      });

      const mockPrisma = createMockPrisma();
      const app = express();
      app.use(express.json());
      app.use(
        "/api/v1/auth",
        createAuthRouter({
          prismaClient: mockPrisma,
          rateLimiter: testLimiter.middleware,
        })
      );
      app.use(errorHandler);

      // First 5 requests succeed
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .send({
            ...VALID_REGISTRATION_PAYLOAD,
            email: `user${i}@example.com`,
            handle: `user_${i}_ok`,
          });
        expect(res.status).toBe(201);
        expect(res.headers["x-ratelimit-remaining"]).toBe(String(5 - i));
      }

      // 6th request is throttled
      const res6 = await request(app)
        .post("/api/v1/auth/register")
        .send({
          ...VALID_REGISTRATION_PAYLOAD,
          email: "user6@example.com",
          handle: "user_6_blocked",
        });

      expect(res6.status).toBe(429);
      expect(res6.body.success).toBe(false);
      expect(res6.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(res6.headers["retry-after"]).toBeDefined();
      expect(Number(res6.headers["retry-after"])).toBeGreaterThanOrEqual(1);
      expect(res6.headers["x-ratelimit-remaining"]).toBe("0");
    });

    it("does not trust spoofed X-Forwarded-For headers when trust proxy is false", async () => {
      const testLimiter = createRateLimiter({
        windowMs: 60_000,
        max: 2,
      });

      const mockPrisma = createMockPrisma();
      const app = express();
      app.set("trust proxy", false); // Default untrusted proxy mode
      app.use(express.json());
      app.use(
        "/api/v1/auth",
        createAuthRouter({
          prismaClient: mockPrisma,
          rateLimiter: testLimiter.middleware,
        })
      );
      app.use(errorHandler);

      // Attempt 1 with spoofed header
      const res1 = await request(app)
        .post("/api/v1/auth/register")
        .set("X-Forwarded-For", "198.51.100.1")
        .send({
          ...VALID_REGISTRATION_PAYLOAD,
          email: "spoof1@example.com",
          handle: "spoof_1",
        });
      expect(res1.status).toBe(201);

      // Attempt 2 with another spoofed header
      const res2 = await request(app)
        .post("/api/v1/auth/register")
        .set("X-Forwarded-For", "198.51.100.2")
        .send({
          ...VALID_REGISTRATION_PAYLOAD,
          email: "spoof2@example.com",
          handle: "spoof_2",
        });
      expect(res2.status).toBe(201);

      // Attempt 3 with a third spoofed header — should be throttled because both arrived from the same client socket IP
      const res3 = await request(app)
        .post("/api/v1/auth/register")
        .set("X-Forwarded-For", "198.51.100.3")
        .send({
          ...VALID_REGISTRATION_PAYLOAD,
          email: "spoof3@example.com",
          handle: "spoof_3",
        });
      expect(res3.status).toBe(429);
      expect(res3.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });
});
