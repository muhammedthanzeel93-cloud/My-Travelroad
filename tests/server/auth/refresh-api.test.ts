/**
 * HTTP Integration Tests for Refresh, Logout, Cookie Dispatch, and CSRF Protection
 * (POST /api/v1/auth/login, POST /api/v1/auth/refresh, POST /api/v1/auth/logout)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import RedisMock from "ioredis-mock";
import { setupRedisMock } from "../helpers/redis-mock.helper";
import { createApp } from "../../../src/server/app";
import { RedisSessionStore } from "../../../src/server/redis/session.store";
import { hashPassword } from "../../../src/server/auth/password";
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "../../../src/server/auth/cookie";
import { loginRateLimiter } from "../../../src/server/middleware/rate-limiter";
import { ServiceUnavailableError } from "../../../src/server/errors/app-error";

describe("Authentication Session Endpoints (Login, Refresh, Logout)", () => {
  let redis: any;
  let sessionStore: RedisSessionStore;
  let mockPrisma: any;
  let app: any;

  const validPassword = "Password123!";
  let validPasswordHash: string;
  const validAccountId = "550e8400-e29b-41d4-a716-446655440001";

  beforeEach(async () => {
    loginRateLimiter.reset();
    validPasswordHash = await hashPassword(validPassword);
    redis = new RedisMock();
    setupRedisMock(redis);
    sessionStore = new RedisSessionStore(redis);

    mockPrisma = {
      account: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          if (where.email === "amina.rahman@example.com" || where.id === validAccountId) {
            return Promise.resolve({
              id: validAccountId,
              email: "amina.rahman@example.com",
              role: "traveler",
              status: "active",
              type: "individual",
              emailVerified: true,
              securityCredentials: {
                passwordHash: validPasswordHash,
                failedLoginAttempts: 0,
                lockedUntil: null,
                passwordChangedAt: null,
              },
            });
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      accountSecurityCredential: {
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (callback: any) => {
        return callback({
          $queryRaw: vi.fn().mockResolvedValue([
            {
              failed_login_attempts: 0,
              locked_until: null,
            },
          ]),
          accountSecurityCredential: {
            update: vi.fn().mockResolvedValue({}),
          },
          account: {
            update: vi.fn().mockResolvedValue({}),
          },
        });
      }),
    };

    app = createApp({
      prismaClient: mockPrisma,
      sessionStore,
      corsOrigins: ["http://localhost:3000"],
    });
  });

  describe("POST /api/v1/auth/login Cookie Dispatch", () => {
    it("dispatches HttpOnly, SameSite=Strict refresh cookie on successful login without leaking token in JSON", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: validPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.tokenType).toBe("Bearer");

      // Verify rawRefreshToken is NOT in the JSON body
      expect(res.body.data.rawRefreshToken).toBeUndefined();

      // Verify Set-Cookie header contains refreshToken
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const refreshCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith(`${REFRESH_COOKIE_NAME}=`))
        : cookies;

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain("HttpOnly");
      expect(refreshCookie).toContain("SameSite=Strict");
      expect(refreshCookie).toContain(`Path=${REFRESH_COOKIE_PATH}`);
      expect(refreshCookie).toContain("Max-Age=");
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("rejects request missing mandatory X-Requested-With header with 400 Bad Request", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`${REFRESH_COOKIE_NAME}=rt_550e8400-e29b-41d4-a716-446655440001_${'a'.repeat(64)}`]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.message).toContain("X-Requested-With: XMLHttpRequest is required");
    });

    it("rejects request missing refreshToken cookie with 401 AUTHENTICATION_REQUIRED", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects request with malformed refreshToken cookie with 401 TOKEN_INVALID", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [`${REFRESH_COOKIE_NAME}=not-a-valid-token`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("TOKEN_INVALID");
    });

    it("successfully rotates refresh token and returns new access token with new cookie", async () => {
      // 1. Log in to acquire initial cookie
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: validPassword,
        });

      const initialCookies = loginRes.headers["set-cookie"];
      const initialCookieStr = Array.isArray(initialCookies) ? initialCookies[0] : initialCookies;
      const initialCookieVal = initialCookieStr.split(";")[0]; // "refreshToken=rt_..."

      // 2. Perform refresh
      const refreshRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [initialCookieVal]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.body.data.tokenType).toBe("Bearer");
      expect(refreshRes.body.data.expiresIn).toBe(900);

      // Verify replacement cookie is dispatched
      const rotatedCookies = refreshRes.headers["set-cookie"];
      const rotatedCookieStr = Array.isArray(rotatedCookies) ? rotatedCookies[0] : rotatedCookies;
      const rotatedCookieVal = rotatedCookieStr.split(";")[0];

      expect(rotatedCookieVal).not.toBe(initialCookieVal);
      expect(rotatedCookieVal).toMatch(new RegExp(`^${REFRESH_COOKIE_NAME}=rt_`));

      // 3. Presenting the old initial cookie again immediately triggers replay detection
      const replayRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [initialCookieVal]);

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.success).toBe(false);
      expect(replayRes.body.error.code).toBe("TOKEN_REPLAY_DETECTED");

      // 4. Once family is compromised, the replacement cookie is also rejected fail-closed
      const compromisedRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [rotatedCookieVal]);

      expect(compromisedRes.status).toBe(401);
      expect(compromisedRes.body.success).toBe(false);
      expect(compromisedRes.body.error.code).toBe("TOKEN_REPLAY_DETECTED");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("rejects logout request with cookie missing X-Requested-With header", async () => {
      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", [`${REFRESH_COOKIE_NAME}=rt_550e8400-e29b-41d4-a716-446655440001_${'a'.repeat(64)}`]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    it("revokes session, clears cookie with Max-Age=0, and prevents subsequent refresh", async () => {
      // 1. Log in
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: validPassword,
        });

      const initialCookies = loginRes.headers["set-cookie"];
      const initialCookieStr = Array.isArray(initialCookies) ? initialCookies[0] : initialCookies;
      const initialCookieVal = initialCookieStr.split(";")[0];

      // 2. Log out
      const logoutRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [initialCookieVal]);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
      expect(logoutRes.body.data.message).toBe("Successfully logged out and session revoked.");

      // Check cookie cleared
      const clearedCookies = logoutRes.headers["set-cookie"];
      const clearedCookieStr = Array.isArray(clearedCookies) ? clearedCookies[0] : clearedCookies;
      expect(clearedCookieStr).toContain("Max-Age=0");

      // 3. Subsequent refresh with the revoked cookie must fail
      const refreshRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [initialCookieVal]);

      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.success).toBe(false);
    });

    it("is safe and idempotent when invoked repeatedly or without a cookie", async () => {
      const res1 = await request(app).post("/api/v1/auth/logout");
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      const res2 = await request(app).post("/api/v1/auth/logout");
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
    });

    it("returns 503 SERVICE_UNAVAILABLE when Redis fails during logout", async () => {
      vi.spyOn(sessionStore, "getTokenLookup").mockRejectedValueOnce(
        new ServiceUnavailableError("Session persistence service temporarily unavailable")
      );

      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [`${REFRESH_COOKIE_NAME}=rt_550e8400-e29b-41d4-a716-446655440001_${'a'.repeat(64)}`]);

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    });

    it("returns 503 SERVICE_UNAVAILABLE when Redis fails during refresh", async () => {
      vi.spyOn(sessionStore, "getFamily").mockRejectedValueOnce(
        new ServiceUnavailableError("Session persistence service temporarily unavailable")
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [`${REFRESH_COOKIE_NAME}=rt_550e8400-e29b-41d4-a716-446655440001_${'a'.repeat(64)}`]);

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    });
  });
});
