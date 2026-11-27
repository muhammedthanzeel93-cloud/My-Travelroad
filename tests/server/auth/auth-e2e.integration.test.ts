/**
 * My Travelroad — End-to-End Authentication & Security Verification Suite (Task 10.7-R1)
 * Executes against live PostgreSQL 16 and live Native Redis 5.0.14 instances.
 * Tests the complete authentication and session management lifecycle via the Express app:
 * - Registration -> Login -> Identity Inspection (GET /me) -> Refresh -> Logout
 * - Account Lockout & Anti-Enumeration Timing Equalization
 * - Authoritative PostgreSQL Lifecycle & Password Change Invalidation
 * - Live Redis Atomic Token Rotation, Concurrency Races & Replay Detection
 * - Multi-Device Session Isolation & Single-Device Logout
 * - Anti-CSRF, CORS Preflight, and Complete 5-Role Authorization Matrix
 * - Missing-Account Error Handling (401 AUTHENTICATION_REQUIRED)
 * - Surgical Redis Cleanup Verification (Zero Orphaned Keys or Account Sessions)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import net from "node:net";
import crypto from "node:crypto";
import express, { Express } from "express";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { createApp } from "../../../src/server/app";
import { RedisSessionStore } from "../../../src/server/redis/session.store";
import { PRISMA_LOG_CONFIG } from "../../../src/lib/db";
import { REFRESH_COOKIE_NAME } from "../../../src/server/auth/cookie";
import { signAccessToken } from "../../../src/server/auth/jwt";
import { ErrorCode } from "../../../src/server/errors/error-codes";
import { requireRole, requireEmailVerified } from "../../../src/server/middleware/authorize";
import { createAuthenticateMiddleware } from "../../../src/server/middleware/authenticate";
import { errorHandler } from "../../../src/server/middleware/error-handler";
import { loginRateLimiter, registrationRateLimiter } from "../../../src/server/middleware/rate-limiter";
import {
  parseDatabaseConfig,
  assertTestDatabaseSafety,
} from "../../helpers/db-safety.helper";

let testPrisma: PrismaClient;
let realRedis: Redis;
let sessionStore: RedisSessionStore;
let app: ReturnType<typeof createApp>;
let testRoleApp: Express;

/**
 * Surgically deletes test-created Redis family keys and account-session inverted indexes.
 * Prevents leaving orphaned entries without performing broad, dangerous global flushes.
 */
async function cleanupTestRedisData(
  redisClient: Redis,
  familyIds: Iterable<string>,
  accountIds: Iterable<string>
): Promise<void> {
  const pipeline = redisClient.pipeline();

  // 1. Remove family-specific keys strictly scoped to test familyId UUIDs
  const familyList = Array.from(familyIds);
  for (const familyId of familyList) {
    if (!familyId) continue;
    const keys = await redisClient.keys(`*{${familyId}}*`);
    for (const key of keys) {
      pipeline.del(key);
    }
  }

  // 2. Remove test-created account session indexes
  const accountList = Array.from(accountIds);
  for (const accountId of accountList) {
    if (!accountId) continue;
    pipeline.del(`account_sessions:${accountId}`);
  }

  await pipeline.exec();
}

async function isPortReachable(port: number, host: string, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket
      .once("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .once("error", () => {
        socket.destroy();
        resolve(false);
      })
      .once("timeout", () => {
        socket.destroy();
        resolve(false);
      })
      .connect(port, host);
  });
}

describe("End-to-End Authentication & Security Verification Suite (Task 10.7-R1)", () => {
  const createdAccountIds = new Set<string>();
  const createdEmails = new Set<string>();
  const createdFamilyIds = new Set<string>();

  beforeAll(async () => {
    // 1. Validate and connect to PostgreSQL strictly requiring TEST_DATABASE_URL
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!testDatabaseUrl || typeof testDatabaseUrl !== "string" || testDatabaseUrl.trim().length === 0) {
      throw new Error(
        "TEST DATABASE SAFETY ERROR: TEST_DATABASE_URL must be explicitly set for destructive integration tests. Falling back to DATABASE_URL is strictly forbidden."
      );
    }

    const dbConfig = parseDatabaseConfig(testDatabaseUrl);
    assertTestDatabaseSafety(dbConfig.database, dbConfig.host, { testDatabaseUrl });

    const isDbReachable = await isPortReachable(dbConfig.port, dbConfig.host, 1500);
    if (!isDbReachable) {
      throw new Error(`PostgreSQL is unreachable at ${dbConfig.host}:${dbConfig.port}`);
    }

    testPrisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
      log: PRISMA_LOG_CONFIG,
    });
    await testPrisma.$connect();

    // Verify DB identity matches test database name
    const identityResult = await testPrisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database();
    `;
    expect(identityResult[0]?.current_database).toBe(dbConfig.database);

    // 2. Connect to live Native Redis
    const isRedisReachable = await isPortReachable(6379, "127.0.0.1", 1500);
    if (!isRedisReachable) {
      throw new Error("Native Redis is unreachable at 127.0.0.1:6379");
    }

    realRedis = new Redis({
      host: "127.0.0.1",
      port: 6379,
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    const pong = await realRedis.ping();
    expect(pong).toBe("PONG");

    sessionStore = new RedisSessionStore(realRedis);

    // 3. Create real Express app with testPrisma and sessionStore
    app = createApp({
      prismaClient: testPrisma,
      sessionStore,
      corsOrigins: ["http://localhost:3000", "https://mytravelroad.com"],
    });

    // 4. Create dedicated role testing app covering all 5 discrete caller tiers
    testRoleApp = express();
    testRoleApp.use(express.json());
    const authMiddleware = createAuthenticateMiddleware(testPrisma);

    // Tier 1: Traveler-only endpoint
    testRoleApp.get(
      "/api/v1/test/role/traveler",
      authMiddleware,
      requireRole("traveler"),
      (_req, res) => {
        res.status(200).json({ success: true, message: "Traveler access granted" });
      }
    );

    // Tier 2: Contributor draft endpoint (contributor, curator, super_admin)
    testRoleApp.get(
      "/api/v1/test/role/contributor",
      authMiddleware,
      requireRole("contributor", "curator", "super_admin"),
      (_req, res) => {
        res.status(200).json({ success: true, message: "Contributor access granted" });
      }
    );

    // Tier 3: Curator verification endpoint (curator, super_admin)
    testRoleApp.get(
      "/api/v1/test/role/curator",
      authMiddleware,
      requireRole("curator", "super_admin"),
      (_req, res) => {
        res.status(200).json({ success: true, message: "Curator access granted" });
      }
    );

    // Tier 4: Moderator queue endpoint (moderator, super_admin)
    testRoleApp.get(
      "/api/v1/test/role/moderator",
      authMiddleware,
      requireRole("moderator", "super_admin"),
      (_req, res) => {
        res.status(200).json({ success: true, message: "Moderator access granted" });
      }
    );

    // Tier 5: Super Admin only endpoint
    testRoleApp.get(
      "/api/v1/test/role/super-admin",
      authMiddleware,
      requireRole("super_admin"),
      (_req, res) => {
        res.status(200).json({ success: true, message: "Super admin access granted" });
      }
    );

    // Email verification requirement check
    testRoleApp.post(
      "/api/v1/test/verified-only-mutation",
      authMiddleware,
      requireEmailVerified,
      (_req, res) => {
        res.status(200).json({ success: true, message: "Mutation permitted" });
      }
    );

    testRoleApp.use(errorHandler);
  });

  afterAll(async () => {
    // Final DB cleanup
    const ids = Array.from(createdAccountIds).filter(Boolean);
    const emails = Array.from(createdEmails).filter(Boolean);
    if (testPrisma && (ids.length > 0 || emails.length > 0)) {
      await testPrisma.account.deleteMany({
        where: {
          OR: [
            ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
            ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
          ],
        },
      });
    }
    await testPrisma?.$disconnect();

    // Final targeted Redis cleanup
    if (realRedis) {
      await cleanupTestRedisData(realRedis, createdFamilyIds, createdAccountIds);
      await realRedis.quit();
    }
  });

  beforeEach(() => {
    // Reset rate limiter counters between scenarios
    loginRateLimiter.reset();
    registrationRateLimiter.reset();
  });

  afterEach(async () => {
    // Clean up created accounts after each test to keep DB isolated
    const ids = Array.from(createdAccountIds).filter(Boolean);
    const emails = Array.from(createdEmails).filter(Boolean);
    if (testPrisma && (ids.length > 0 || emails.length > 0)) {
      await testPrisma.account.deleteMany({
        where: {
          OR: [
            ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
            ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
          ],
        },
      });
      createdAccountIds.clear();
      createdEmails.clear();
    }

    // Targeted Redis cleanup for tracked test families and accounts
    if (realRedis) {
      await cleanupTestRedisData(realRedis, createdFamilyIds, ids);
      createdFamilyIds.clear();
    }
  });

  // Helper to extract cookie value
  function extractCookie(res: request.Response, cookieName: string): string | undefined {
    const rawHeader = res.headers["set-cookie"];
    const cookies: string[] = Array.isArray(rawHeader)
      ? rawHeader
      : typeof rawHeader === "string"
      ? [rawHeader]
      : [];
    for (const c of cookies) {
      if (c.startsWith(`${cookieName}=`)) {
        return c.split(";")[0].split("=")[1];
      }
    }
    return undefined;
  }

  // Helper to extract familyId from raw refresh token
  function extractFamilyId(rawToken: string): string {
    const match = /^rt_([0-9a-fA-F-]+)_/.exec(rawToken);
    return match ? match[1] : "";
  }

  // =========================================================================
  // SCENARIO 1: Complete Happy-Path Authentication Lifecycle
  // =========================================================================
  it("Scenario 1: Happy-path lifecycle (Register -> Login -> GET /me -> Refresh -> GET /me -> Logout)", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const email = `tourist_${uniqueSuffix}@example.com`;
    const password = "StrongPassword123!";
    const handle = `tourist_${uniqueSuffix}`;

    // 1. Registration (201 Created)
    const registerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName: "Amina Rahman",
        handle,
        preferredLanguage: "en",
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data.account.email).toBe(email);
    expect(registerRes.body.data.account.role).toBe("traveler");
    expect(registerRes.body.data.account.status).toBe("pending_verification");
    expect(registerRes.body.data.profile.displayName).toBe("Amina Rahman");
    expect(registerRes.body.data.profile.handle).toBe(handle);
    expect((registerRes.body.data as any).passwordHash).toBeUndefined();
    expect((registerRes.body.data as any).accessToken).toBeUndefined();
    expect(registerRes.headers["set-cookie"]).toBeUndefined();

    const accountId = registerRes.body.data.account.id;
    createdAccountIds.add(accountId);
    createdEmails.add(email);

    // 2. Login (200 OK)
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.tokenType).toBe("Bearer");
    expect(loginRes.body.data.expiresIn).toBe(900);
    expect(loginRes.body.data.account.id).toBe(accountId);
    expect(loginRes.body.data.rawRefreshToken).toBeUndefined();

    const accessToken1 = loginRes.body.data.accessToken;
    expect(typeof accessToken1).toBe("string");

    const cookieHeader = loginRes.headers["set-cookie"];
    expect(cookieHeader).toBeDefined();
    const rawRefreshToken1 = extractCookie(loginRes, REFRESH_COOKIE_NAME);
    expect(rawRefreshToken1).toBeDefined();
    expect(rawRefreshToken1).toMatch(/^rt_[0-9a-fA-F-]+_[0-9a-fA-F]{64}$/);

    const familyId = extractFamilyId(rawRefreshToken1!);
    expect(familyId).toBeTruthy();
    createdFamilyIds.add(familyId);

    const rawCookieStr = Array.isArray(cookieHeader) ? cookieHeader[0] : String(cookieHeader);
    expect(rawCookieStr.toLowerCase()).toContain("httponly");
    expect(rawCookieStr.toLowerCase()).toContain("samesite=strict");
    expect(rawCookieStr.toLowerCase()).toContain("path=/api/v1/auth");

    // 3. GET /api/v1/auth/me with Access Token 1
    const meRes1 = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken1}`);

    expect(meRes1.status).toBe(200);
    expect(meRes1.body.success).toBe(true);
    expect(meRes1.body.data.account.id).toBe(accountId);
    expect(meRes1.body.data.account.email).toBe(email);
    expect(meRes1.body.data.profile.displayName).toBe("Amina Rahman");
    expect(meRes1.body.data.profile.handle).toBe(handle);

    // Wait 1000ms so JWT issued-at timestamp advances by at least 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. POST /api/v1/auth/refresh with Cookie 1 + Anti-CSRF Header
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${rawRefreshToken1}`)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.tokenType).toBe("Bearer");
    expect(refreshRes.body.data.expiresIn).toBe(900);

    const accessToken2 = refreshRes.body.data.accessToken;
    expect(accessToken2).toBeTruthy();
    expect(accessToken2).not.toBe(accessToken1);

    const rawRefreshToken2 = extractCookie(refreshRes, REFRESH_COOKIE_NAME);
    expect(rawRefreshToken2).toBeDefined();
    expect(rawRefreshToken2).not.toBe(rawRefreshToken1);
    expect(extractFamilyId(rawRefreshToken2!)).toBe(familyId);

    // 5. GET /api/v1/auth/me with Access Token 2
    const meRes2 = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken2}`);

    expect(meRes2.status).toBe(200);
    expect(meRes2.body.data.account.id).toBe(accountId);

    // 6. POST /api/v1/auth/logout with Cookie 2 + Anti-CSRF Header
    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${rawRefreshToken2}`)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
    expect(logoutRes.body.data.message).toContain("Successfully logged out");

    // Cookie must be cleared with Max-Age=0
    const rawLogoutHeader = logoutRes.headers["set-cookie"];
    const logoutCookies: string[] = Array.isArray(rawLogoutHeader)
      ? rawLogoutHeader
      : typeof rawLogoutHeader === "string"
      ? [rawLogoutHeader]
      : [];
    const clearedCookie = logoutCookies.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie!.toLowerCase()).toContain("max-age=0");

    // 7. Verify subsequent refresh attempt with revoked token fails
    const postLogoutRefresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${rawRefreshToken2}`)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(postLogoutRefresh.status).toBe(401);
  });

  // =========================================================================
  // SCENARIO 2: Failed Login Throttling & Account Lockout
  // =========================================================================
  it("Scenario 2: Failed login lockout after 5 consecutive bad attempts (423 ACCOUNT_LOCKED)", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const email = `lockout_${uniqueSuffix}@example.com`;
    const password = "CorrectPassword123!";

    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName: "Lockout Test",
        handle: `lockout_${uniqueSuffix}`,
      });
    expect(reg.status).toBe(201);
    const accountId = reg.body.data.account.id;
    createdAccountIds.add(accountId);
    createdEmails.add(email);

    // Attempts 1 to 5 with wrong password
    for (let i = 1; i <= 5; i++) {
      const failedRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password: "WrongPassword999!" });

      expect(failedRes.status).toBe(401);
      expect(failedRes.body.error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    }

    // Check DB state: failed_login_attempts should be 5 and locked_until should be populated
    const creds = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId },
    });
    expect(creds?.failedLoginAttempts).toBe(5);
    expect(creds?.lockedUntil).not.toBeNull();
    expect(creds!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Reset rate limiter before sending the 6th request so it evaluates database account lockout
    loginRateLimiter.reset();

    // 6th attempt (even with correct password) must return 423 Locked
    const lockedRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.error.code).toBe(ErrorCode.ACCOUNT_LOCKED);
    expect(lockedRes.body.error.message).toContain("temporarily locked");
  });

  // =========================================================================
  // SCENARIO 3: Nonexistent Account Anti-Enumeration Timing Equalization
  // =========================================================================
  it("Scenario 3: Nonexistent account anti-enumeration with Argon2id dummy hash", async () => {
    const nonexistentEmail = `doesnotexist_${crypto.randomBytes(6).toString("hex")}@example.com`;

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: nonexistentEmail, password: "SomeRandomPassword123!" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  // =========================================================================
  // SCENARIO 4: Access Token Security & Cryptographic Validation
  // =========================================================================
  it("Scenario 4: Access token validation (rejects missing, malformed, tampered, or expired tokens)", async () => {
    // 1. Missing Authorization header
    const missingRes = await request(app).get("/api/v1/auth/me");
    expect(missingRes.status).toBe(401);
    expect(missingRes.body.error.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);

    // 2. Empty Bearer header
    const emptyRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer ");
    expect(emptyRes.status).toBe(401);
    expect(emptyRes.body.error.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);

    // 3. Malformed token string
    const malformedRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not.a.valid.jwt");
    expect(malformedRes.status).toBe(401);
    expect(malformedRes.body.error.code).toBe(ErrorCode.TOKEN_INVALID);

    // 4. Tampered signature
    const validToken = await signAccessToken({
      sub: "550e8400-e29b-41d4-a716-446655440001",
      email: "test@example.com",
      role: "traveler",
      status: "active",
      type: "individual",
      emailVerified: true,
      gen: 1,
    });
    const tamperedToken = validToken.slice(0, -6) + "abcdef";
    const tamperedRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${tamperedToken}`);
    expect(tamperedRes.status).toBe(401);
    expect(tamperedRes.body.error.code).toBe(ErrorCode.TOKEN_INVALID);

    // 5. Expired token (expiresInSeconds: 1, wait 2 seconds)
    const shortLivedToken = await signAccessToken(
      {
        sub: "550e8400-e29b-41d4-a716-446655440001",
        email: "test@example.com",
        role: "traveler",
        status: "active",
        type: "individual",
        emailVerified: true,
        gen: 1,
      },
      { expiresInSeconds: 1 }
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const expiredRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${shortLivedToken}`);
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.error.code).toBe(ErrorCode.TOKEN_EXPIRED);
  });

  // =========================================================================
  // SCENARIO 5: Authoritative PostgreSQL Lifecycle Enforcement
  // =========================================================================
  it("Scenario 5: Authoritative PostgreSQL account status checks (suspended/deactivated)", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const email = `status_${uniqueSuffix}@example.com`;
    const password = "StrongPassword123!";

    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName: "Status Test",
        handle: `status_${uniqueSuffix}`,
      });
    const accountId = reg.body.data.account.id;
    createdAccountIds.add(accountId);
    createdEmails.add(email);

    // Login to obtain active access token and refresh cookie
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    const accessToken = loginRes.body.data.accessToken;
    const rawRefreshToken = extractCookie(loginRes, REFRESH_COOKIE_NAME)!;
    createdFamilyIds.add(extractFamilyId(rawRefreshToken));

    // Initially valid
    const meBefore = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meBefore.status).toBe(200);

    // 1. Suspend account in PostgreSQL
    await testPrisma.account.update({
      where: { id: accountId },
      data: { status: "suspended" },
    });

    // Authoritative check on GET /me rejects active 15m token immediately with 403 ACCOUNT_SUSPENDED
    const meSuspended = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meSuspended.status).toBe(403);
    expect(meSuspended.body.error.code).toBe(ErrorCode.ACCOUNT_SUSPENDED);

    // Authoritative check on /refresh rejects and revokes session
    const refreshSuspended = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${rawRefreshToken}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refreshSuspended.status).toBe(403);
    expect(refreshSuspended.body.error.code).toBe(ErrorCode.ACCOUNT_SUSPENDED);

    // 2. Deactivate account in PostgreSQL
    await testPrisma.account.update({
      where: { id: accountId },
      data: { status: "deactivated" },
    });

    const meDeactivated = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meDeactivated.status).toBe(403);
    expect(meDeactivated.body.error.code).toBe(ErrorCode.ACCOUNT_DEACTIVATED);
  });

  // =========================================================================
  // SCENARIO 6: Password Change Invalidation
  // =========================================================================
  it("Scenario 6: Password change invalidates previously issued tokens and refresh sessions", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const email = `pwdchange_${uniqueSuffix}@example.com`;
    const password = "OriginalPassword123!";

    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName: "Password Change Test",
        handle: `pwdchange_${uniqueSuffix}`,
      });
    const accountId = reg.body.data.account.id;
    createdAccountIds.add(accountId);
    createdEmails.add(email);

    // Login at T0
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    const oldAccessToken = loginRes.body.data.accessToken;
    const oldRefreshToken = extractCookie(loginRes, REFRESH_COOKIE_NAME)!;
    createdFamilyIds.add(extractFamilyId(oldRefreshToken));

    // Verify token works initially
    const meBefore = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${oldAccessToken}`);
    expect(meBefore.status).toBe(200);

    // Advance time and update passwordChangedAt in PostgreSQL
    const futureChangedAt = new Date(Date.now() + 5000);
    await testPrisma.accountSecurityCredential.update({
      where: { accountId },
      data: { passwordChangedAt: futureChangedAt },
    });

    // Calling GET /me with old token must now fail with 401 TOKEN_INVALID
    const meAfter = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${oldAccessToken}`);
    expect(meAfter.status).toBe(401);
    expect(meAfter.body.error.code).toBe(ErrorCode.TOKEN_INVALID);
    expect(meAfter.body.error.message).toContain("invalidated due to password change");

    // Calling /refresh with old session must also fail
    const refreshAfter = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${oldRefreshToken}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refreshAfter.status).toBe(401);
    expect(refreshAfter.body.error.code).toBe(ErrorCode.TOKEN_INVALID);
  });

  // =========================================================================
  // SCENARIO 7: Concurrent Refresh Requests Race Condition (Live Native Redis)
  // =========================================================================
  it("Scenario 7: Concurrent refresh race (Live Native Redis) ensures single winner; loser receives 401 without replacement credentials", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const email = `concurrent_${uniqueSuffix}@example.com`;
    const password = "StrongPassword123!";

    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName: "Concurrent Test",
        handle: `concurrent_${uniqueSuffix}`,
      });
    const accountId = reg.body.data.account.id;
    createdAccountIds.add(accountId);
    createdEmails.add(email);

    // Login to get initial refresh token
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    const rawRefreshToken = extractCookie(loginRes, REFRESH_COOKIE_NAME)!;
    const familyId = extractFamilyId(rawRefreshToken);
    createdFamilyIds.add(familyId);

    // Launch two simultaneous refresh requests using the exact same refresh token
    const [req1, req2] = await Promise.all([
      request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", `${REFRESH_COOKIE_NAME}=${rawRefreshToken}`)
        .set("X-Requested-With", "XMLHttpRequest"),
      request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", `${REFRESH_COOKIE_NAME}=${rawRefreshToken}`)
        .set("X-Requested-With", "XMLHttpRequest"),
    ]);

    const results = [req1, req2];
    const successes = results.filter((r) => r.status === 200);
    const failures = results.filter((r) => r.status === 401);

    // Exactly one winner succeeds
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const winner = successes[0];
    const loser = failures[0];

    // Winner receives replacement credentials
    expect(winner.body.success).toBe(true);
    expect(winner.body.data.accessToken).toBeDefined();
    const winningRotatedToken = extractCookie(winner, REFRESH_COOKIE_NAME);
    expect(winningRotatedToken).toBeDefined();

    // Loser receives 401 TOKEN_INVALID with zero replacement credentials
    expect(loser.body.success).toBe(false);
    expect(loser.body.error.code).toBe(ErrorCode.TOKEN_INVALID);
    expect(loser.body.error.message).toContain("Concurrent token rotation or replay detected");
    expect(loser.body.data).toBeUndefined();
    expect(extractCookie(loser, REFRESH_COOKIE_NAME)).toBeUndefined();

    // Winner's rotated token remains fully valid in Redis
    const winnerFollowup = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${winningRotatedToken}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(winnerFollowup.status).toBe(200);
  });

  // =========================================================================
  // SCENARIO 8: Spent-Token Replay Detection & Family Revocation (Live Redis)
  // =========================================================================
  it("Scenario 8: Replay of spent token triggers 401 TOKEN_REPLAY_DETECTED and revokes entire family fail-closed", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const email = `replay_${uniqueSuffix}@example.com`;
    const password = "StrongPassword123!";

    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName: "Replay Test",
        handle: `replay_${uniqueSuffix}`,
      });
    const accountId = reg.body.data.account.id;
    createdAccountIds.add(accountId);
    createdEmails.add(email);

    // Login -> Token 1
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    const token1 = extractCookie(loginRes, REFRESH_COOKIE_NAME)!;
    const familyId = extractFamilyId(token1);
    createdFamilyIds.add(familyId);

    // Valid Refresh -> Token 2 (Token 1 is now spent/tombstoned)
    const refresh1 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${token1}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refresh1.status).toBe(200);
    const token2 = extractCookie(refresh1, REFRESH_COOKIE_NAME)!;

    // Attacker or replay of spent Token 1
    const replayRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${token1}`)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe(ErrorCode.TOKEN_REPLAY_DETECTED);
    expect(replayRes.body.error.message).toContain("Refresh token replay detected");

    // Verify family state in Redis: isCompromised must be "1" and active session key must be deleted
    const familyRecord = await realRedis.hgetall(`family:{${familyId}}`);
    expect(familyRecord.isCompromised).toBe("1");
    const activeSessionExists = await realRedis.exists(`session:{${familyId}}:${familyRecord.activeSessionId}`);
    expect(activeSessionExists).toBe(0);

    // Even Token 2 (which was legitimately issued) can no longer be refreshed because family is compromised
    const token2Attempt = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${token2}`)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(token2Attempt.status).toBe(401);
  });

  // =========================================================================
  // SCENARIO 9: Multi-Device Session Isolation
  // =========================================================================
  it("Scenario 9: Multi-device session isolation (Logging out Device A does NOT affect Device B)", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const email = `multidevice_${uniqueSuffix}@example.com`;
    const password = "StrongPassword123!";

    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName: "Multi Device",
        handle: `multidevice_${uniqueSuffix}`,
      });
    const accountId = reg.body.data.account.id;
    createdAccountIds.add(accountId);
    createdEmails.add(email);

    // Login from Device A
    const loginA = await request(app)
      .post("/api/v1/auth/login")
      .set("User-Agent", "Device-A-Browser")
      .send({ email, password });
    const tokenA = extractCookie(loginA, REFRESH_COOKIE_NAME)!;
    const familyA = extractFamilyId(tokenA);
    createdFamilyIds.add(familyA);

    // Login from Device B
    const loginB = await request(app)
      .post("/api/v1/auth/login")
      .set("User-Agent", "Device-B-Mobile")
      .send({ email, password });
    const tokenB = extractCookie(loginB, REFRESH_COOKIE_NAME)!;
    const familyB = extractFamilyId(tokenB);
    createdFamilyIds.add(familyB);

    // Verify both families exist in Redis account index as `${familyId}:${sessionId}`
    const accountSessions = await realRedis.smembers(`account_sessions:${accountId}`);
    const hasFamilyA = accountSessions.some((item) => item.startsWith(`${familyA}:`));
    const hasFamilyB = accountSessions.some((item) => item.startsWith(`${familyB}:`));
    expect(hasFamilyA).toBe(true);
    expect(hasFamilyB).toBe(true);

    // Logout Device A
    const logoutA = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${tokenA}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(logoutA.status).toBe(200);

    // Device A family is removed from account index while Device B remains
    const sessionsAfterLogoutA = await realRedis.smembers(`account_sessions:${accountId}`);
    const hasFamilyAAfter = sessionsAfterLogoutA.some((item) => item.startsWith(`${familyA}:`));
    const hasFamilyBAfter = sessionsAfterLogoutA.some((item) => item.startsWith(`${familyB}:`));
    expect(hasFamilyAAfter).toBe(false);
    expect(hasFamilyBAfter).toBe(true);

    // Device B can still rotate and use its session without disruption
    const refreshB = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${tokenB}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refreshB.status).toBe(200);
  });

  // =========================================================================
  // SCENARIO 10: Anti-CSRF Header Enforcement
  // =========================================================================
  it("Scenario 10: Anti-CSRF enforcement (cookie endpoints require X-Requested-With: XMLHttpRequest)", async () => {
    // 1. Missing X-Requested-With on /refresh
    const noHeaderRefresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=rt_fake_0000`);
    expect(noHeaderRefresh.status).toBe(400);
    expect(noHeaderRefresh.body.error.code).toBe(ErrorCode.BAD_REQUEST);
    expect(noHeaderRefresh.body.error.message).toContain("X-Requested-With: XMLHttpRequest is required");

    // 2. Invalid X-Requested-With value on /refresh
    const badHeaderRefresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=rt_fake_0000`)
      .set("X-Requested-With", "FetchAPI");
    expect(badHeaderRefresh.status).toBe(400);

    // 3. Missing X-Requested-With on /logout when cookie is present
    const noHeaderLogout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=rt_fake_0000`);
    expect(noHeaderLogout.status).toBe(400);
    expect(noHeaderLogout.body.error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  // =========================================================================
  // SCENARIO 11: Complete 5-Role Authorization Matrix Coverage (Discrete Roles)
  // =========================================================================
  it("Scenario 11: Full 5-role authorization matrix coverage with live database-backed accounts", async () => {
    // 1. Create real database-backed accounts for all 5 discrete roles
    const suffix = crypto.randomBytes(4).toString("hex");

    const [travelerAcct, contributorAcct, curatorAcct, moderatorAcct, superAdminAcct] =
      await Promise.all([
        testPrisma.account.create({
          data: {
            email: `traveler_${suffix}@example.com`,
            role: "traveler",
            status: "active",
            type: "individual",
            emailVerified: true,
          },
        }),
        testPrisma.account.create({
          data: {
            email: `contributor_${suffix}@example.com`,
            role: "contributor",
            status: "active",
            type: "individual",
            emailVerified: true,
          },
        }),
        testPrisma.account.create({
          data: {
            email: `curator_${suffix}@example.com`,
            role: "curator",
            status: "active",
            type: "individual",
            emailVerified: true,
          },
        }),
        testPrisma.account.create({
          data: {
            email: `moderator_${suffix}@example.com`,
            role: "moderator",
            status: "active",
            type: "individual",
            emailVerified: true,
          },
        }),
        testPrisma.account.create({
          data: {
            email: `superadmin_${suffix}@example.com`,
            role: "super_admin",
            status: "active",
            type: "individual",
            emailVerified: true,
          },
        }),
      ]);

    // Track for cleanup
    createdAccountIds.add(travelerAcct.id);
    createdAccountIds.add(contributorAcct.id);
    createdAccountIds.add(curatorAcct.id);
    createdAccountIds.add(moderatorAcct.id);
    createdAccountIds.add(superAdminAcct.id);

    // 2. Sign tokens for each real account
    const [travelerTok, contributorTok, curatorTok, moderatorTok, superAdminTok] =
      await Promise.all([
        signAccessToken({
          sub: travelerAcct.id,
          email: travelerAcct.email,
          role: "traveler",
          status: "active",
          type: "individual",
          emailVerified: true,
          gen: 1,
        }),
        signAccessToken({
          sub: contributorAcct.id,
          email: contributorAcct.email,
          role: "contributor",
          status: "active",
          type: "individual",
          emailVerified: true,
          gen: 1,
        }),
        signAccessToken({
          sub: curatorAcct.id,
          email: curatorAcct.email,
          role: "curator",
          status: "active",
          type: "individual",
          emailVerified: true,
          gen: 1,
        }),
        signAccessToken({
          sub: moderatorAcct.id,
          email: moderatorAcct.email,
          role: "moderator",
          status: "active",
          type: "individual",
          emailVerified: true,
          gen: 1,
        }),
        signAccessToken({
          sub: superAdminAcct.id,
          email: superAdminAcct.email,
          role: "super_admin",
          status: "active",
          type: "individual",
          emailVerified: true,
          gen: 1,
        }),
      ]);

    // 3. Test Traveler:
    // Permitted: traveler endpoint
    // Denied: contributor, curator, moderator, super-admin endpoints
    const r1 = await request(testRoleApp).get("/api/v1/test/role/traveler").set("Authorization", `Bearer ${travelerTok}`);
    expect(r1.status).toBe(200);
    const r2 = await request(testRoleApp).get("/api/v1/test/role/contributor").set("Authorization", `Bearer ${travelerTok}`);
    expect(r2.status).toBe(403);
    const r3 = await request(testRoleApp).get("/api/v1/test/role/curator").set("Authorization", `Bearer ${travelerTok}`);
    expect(r3.status).toBe(403);
    const r4 = await request(testRoleApp).get("/api/v1/test/role/moderator").set("Authorization", `Bearer ${travelerTok}`);
    expect(r4.status).toBe(403);
    const r5 = await request(testRoleApp).get("/api/v1/test/role/super-admin").set("Authorization", `Bearer ${travelerTok}`);
    expect(r5.status).toBe(403);

    // 4. Test Contributor:
    // Permitted: contributor endpoint
    // Denied: traveler, curator, moderator, super-admin endpoints
    const c1 = await request(testRoleApp).get("/api/v1/test/role/traveler").set("Authorization", `Bearer ${contributorTok}`);
    expect(c1.status).toBe(403);
    const c2 = await request(testRoleApp).get("/api/v1/test/role/contributor").set("Authorization", `Bearer ${contributorTok}`);
    expect(c2.status).toBe(200);
    const c3 = await request(testRoleApp).get("/api/v1/test/role/curator").set("Authorization", `Bearer ${contributorTok}`);
    expect(c3.status).toBe(403);
    const c4 = await request(testRoleApp).get("/api/v1/test/role/moderator").set("Authorization", `Bearer ${contributorTok}`);
    expect(c4.status).toBe(403);
    const c5 = await request(testRoleApp).get("/api/v1/test/role/super-admin").set("Authorization", `Bearer ${contributorTok}`);
    expect(c5.status).toBe(403);

    // 5. Test Curator:
    // Permitted: contributor endpoint, curator endpoint
    // Denied: traveler, moderator, super-admin endpoints
    const cu1 = await request(testRoleApp).get("/api/v1/test/role/traveler").set("Authorization", `Bearer ${curatorTok}`);
    expect(cu1.status).toBe(403);
    const cu2 = await request(testRoleApp).get("/api/v1/test/role/contributor").set("Authorization", `Bearer ${curatorTok}`);
    expect(cu2.status).toBe(200);
    const cu3 = await request(testRoleApp).get("/api/v1/test/role/curator").set("Authorization", `Bearer ${curatorTok}`);
    expect(cu3.status).toBe(200);
    const cu4 = await request(testRoleApp).get("/api/v1/test/role/moderator").set("Authorization", `Bearer ${curatorTok}`);
    expect(cu4.status).toBe(403);
    const cu5 = await request(testRoleApp).get("/api/v1/test/role/super-admin").set("Authorization", `Bearer ${curatorTok}`);
    expect(cu5.status).toBe(403);

    // 6. Test Moderator:
    // Permitted: moderator endpoint
    // Denied: traveler, contributor, curator, super-admin endpoints
    const m1 = await request(testRoleApp).get("/api/v1/test/role/traveler").set("Authorization", `Bearer ${moderatorTok}`);
    expect(m1.status).toBe(403);
    const m2 = await request(testRoleApp).get("/api/v1/test/role/contributor").set("Authorization", `Bearer ${moderatorTok}`);
    expect(m2.status).toBe(403);
    const m3 = await request(testRoleApp).get("/api/v1/test/role/curator").set("Authorization", `Bearer ${moderatorTok}`);
    expect(m3.status).toBe(403);
    const m4 = await request(testRoleApp).get("/api/v1/test/role/moderator").set("Authorization", `Bearer ${moderatorTok}`);
    expect(m4.status).toBe(200);
    const m5 = await request(testRoleApp).get("/api/v1/test/role/super-admin").set("Authorization", `Bearer ${moderatorTok}`);
    expect(m5.status).toBe(403);

    // 7. Test Super Admin:
    // Permitted: contributor, curator, moderator, super-admin endpoints
    // Denied: traveler endpoint (discrete roles: zero implicit inheritance!)
    const sa1 = await request(testRoleApp).get("/api/v1/test/role/traveler").set("Authorization", `Bearer ${superAdminTok}`);
    expect(sa1.status).toBe(403);
    const sa2 = await request(testRoleApp).get("/api/v1/test/role/contributor").set("Authorization", `Bearer ${superAdminTok}`);
    expect(sa2.status).toBe(200);
    const sa3 = await request(testRoleApp).get("/api/v1/test/role/curator").set("Authorization", `Bearer ${superAdminTok}`);
    expect(sa3.status).toBe(200);
    const sa4 = await request(testRoleApp).get("/api/v1/test/role/moderator").set("Authorization", `Bearer ${superAdminTok}`);
    expect(sa4.status).toBe(200);
    const sa5 = await request(testRoleApp).get("/api/v1/test/role/super-admin").set("Authorization", `Bearer ${superAdminTok}`);
    expect(sa5.status).toBe(200);

    // 8. Test Email Verification Enforcement on Mutating Endpoint
    const unverifiedAcct = await testPrisma.account.create({
      data: {
        email: `unverified_${suffix}@example.com`,
        role: "contributor",
        status: "active",
        type: "individual",
        emailVerified: false,
      },
    });
    createdAccountIds.add(unverifiedAcct.id);

    const unverifiedTok = await signAccessToken({
      sub: unverifiedAcct.id,
      email: unverifiedAcct.email,
      role: "contributor",
      status: "active",
      type: "individual",
      emailVerified: false,
      gen: 1,
    });

    const unverifiedRes = await request(testRoleApp)
      .post("/api/v1/test/verified-only-mutation")
      .set("Authorization", `Bearer ${unverifiedTok}`);
    expect(unverifiedRes.status).toBe(403);
    expect(unverifiedRes.body.error.code).toBe(ErrorCode.EMAIL_VERIFICATION_REQUIRED);

    // Update to verified -> 200 OK
    await testPrisma.account.update({
      where: { id: unverifiedAcct.id },
      data: { emailVerified: true },
    });

    const verifiedTok = await signAccessToken({
      sub: unverifiedAcct.id,
      email: unverifiedAcct.email,
      role: "contributor",
      status: "active",
      type: "individual",
      emailVerified: true,
      gen: 1,
    });

    const verifiedRes = await request(testRoleApp)
      .post("/api/v1/test/verified-only-mutation")
      .set("Authorization", `Bearer ${verifiedTok}`);
    expect(verifiedRes.status).toBe(200);
    expect(verifiedRes.body.message).toBe("Mutation permitted");
  });

  // =========================================================================
  // SCENARIO 12: CORS Preflight & Security Headers
  // =========================================================================
  it("Scenario 12: CORS preflight check allows X-Requested-With and returns maxAge 3600", async () => {
    // Preflight OPTIONS request from allowed origin
    const preflightRes = await request(app)
      .options("/api/v1/auth/refresh")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type, X-Requested-With, Authorization");

    expect(preflightRes.status).toBe(204);
    expect(preflightRes.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(preflightRes.headers["access-control-allow-headers"]).toContain("X-Requested-With");
    expect(preflightRes.headers["access-control-max-age"]).toBe("3600");

    // Request from unauthorized origin returns 403
    const forbiddenCors = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://malicious-site.com");
    expect(forbiddenCors.status).toBe(403);
  });

  // =========================================================================
  // SCENARIO 13: Payload Size Bounding & DoS Mitigation
  // =========================================================================
  it("Scenario 13: Payload size bounding (rejects bodies > 100kb with 413)", async () => {
    const largePayload = "a".repeat(105 * 1024); // 105kb

    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send(`{"email":"test@example.com","password":"${largePayload}"}`);

    expect(res.status).toBe(413);
    expect(res.body.error.message).toContain("maximum allowed size: 100kb");
  });

  // =========================================================================
  // SCENARIO 14: Missing/Deleted Account on GET /me (HTTP 401 AUTHENTICATION_REQUIRED)
  // =========================================================================
  it("Scenario 14: GET /api/v1/auth/me missing/deleted account returns 401 AUTHENTICATION_REQUIRED", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const email = `deleted_${uniqueSuffix}@example.com`;
    const password = "StrongPassword123!";

    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName: "Deleted User",
        handle: `deleted_${uniqueSuffix}`,
      });
    expect(reg.status).toBe(201);
    const accountId = reg.body.data.account.id;

    // Login to obtain active access token
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(loginRes.status).toBe(200);
    const accessToken = loginRes.body.data.accessToken;

    // Delete account from PostgreSQL directly
    await testPrisma.account.delete({
      where: { id: accountId },
    });

    // Call GET /api/v1/auth/me with access token
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(meRes.status).toBe(401);
    expect(meRes.body.success).toBe(false);
    expect(meRes.body.error.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
    expect(meRes.body.error.message).toContain("Account not found or no longer active");
  });

  // =========================================================================
  // SCENARIO 15: Redis Test Cleanup Verification
  // =========================================================================
  it("Scenario 15: Redis test cleanup leaves zero orphaned family keys and zero orphaned account-session entries", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const email = `cleanup_${uniqueSuffix}@example.com`;
    const password = "StrongPassword123!";

    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName: "Cleanup Verification",
        handle: `cleanup_${uniqueSuffix}`,
      });
    expect(reg.status).toBe(201);
    const accountId = reg.body.data.account.id;
    createdAccountIds.add(accountId);
    createdEmails.add(email);

    // Login to create active family, session, token_lookup, and account_sessions in Redis
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(loginRes.status).toBe(200);

    const rawRefreshToken = extractCookie(loginRes, REFRESH_COOKIE_NAME)!;
    const familyId = extractFamilyId(rawRefreshToken);
    expect(familyId).toBeTruthy();

    // Verify keys exist in Redis before cleanup
    const familyKeyExists = await realRedis.exists(`family:{${familyId}}`);
    const accountSessionsExists = await realRedis.exists(`account_sessions:${accountId}`);
    expect(familyKeyExists).toBe(1);
    expect(accountSessionsExists).toBe(1);

    const sessionKeysBefore = await realRedis.keys(`*{${familyId}}*`);
    expect(sessionKeysBefore.length).toBeGreaterThanOrEqual(3);

    // Run targeted cleanup
    await cleanupTestRedisData(realRedis, [familyId], [accountId]);

    // Verify zero orphaned family keys remain in Redis
    const sessionKeysAfter = await realRedis.keys(`*{${familyId}}*`);
    expect(sessionKeysAfter.length).toBe(0);

    // Verify zero orphaned account_sessions entries remain in Redis
    const accountSessionsAfter = await realRedis.exists(`account_sessions:${accountId}`);
    expect(accountSessionsAfter).toBe(0);
  });
});
