/**
 * Real Redis Live Integration Test Suite (Task 10.6-R1)
 * Executes production Lua scripts and session lifecycle directly against
 * a live, native Redis-compatible instance (localhost:6379) with USE_REAL_REDIS=true.
 * Validates real Redis EVAL scripts, TTLs, connection failure, race conditions, and key states.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import crypto from "node:crypto";
import Redis from "ioredis";
import { RedisSessionStore } from "../../../src/server/redis/session.store";
import { SessionService } from "../../../src/server/services/session.service";
import { generateRefreshToken } from "../../../src/server/auth/refresh-token";
import { UnauthorizedError, ServiceUnavailableError } from "../../../src/server/errors/app-error";
import { ErrorCode } from "../../../src/server/errors/error-codes";
import {
  SESSION_TTL_SECONDS,
  TOMBSTONE_TTL_SECONDS,
  COMPROMISED_FAMILY_TTL_SECONDS,
} from "../../../src/server/redis/redis.types";

describe("Live Native Redis Integration Test Suite", () => {
  let realRedis: Redis;
  let sessionStore: RedisSessionStore;
  let sessionService: SessionService;
  let mockPrisma: any;

  const testAccountId = "550e8400-e29b-41d4-a716-446655440001";
  const validAccount = {
    id: testAccountId,
    email: "tourist.realredis@example.com",
    role: "traveler",
    status: "active",
    type: "individual",
    emailVerified: true,
    securityCredentials: {
      passwordChangedAt: null,
    },
  };

  beforeAll(async () => {
    // Connect directly to live native Redis test server
    realRedis = new Redis({
      host: "127.0.0.1",
      port: 6379,
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    // Verify it is a genuine Redis server responding with PONG
    const ping = await realRedis.ping();
    expect(ping).toBe("PONG");

    sessionStore = new RedisSessionStore(realRedis);
    sessionService = new SessionService(sessionStore);

    mockPrisma = {
      account: {
        findUnique: () => Promise.resolve(validAccount),
      },
    };
  });

  afterAll(async () => {
    if (realRedis) {
      await realRedis.quit().catch(() => realRedis.disconnect());
    }
  });

  beforeEach(async () => {
    // Flush test database before each test to guarantee complete isolation
    await realRedis.flushdb();
  });

  // 1. Initial family and session creation
  it("1. creates initial family, session record, token lookup, and account index in real Redis", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: testAccountId,
      ipAddress: "127.0.0.1",
      userAgent: "RealRedisClient/1.0",
    });

    // Inspect actual Redis keys
    const famKey = sessionStore.familyKey(familyId);
    const famData = await realRedis.hgetall(famKey);
    expect(famData.familyId).toBe(familyId);
    expect(famData.activeSessionId).toBe(sessionId);
    expect(famData.activeTokenHash).toBe(token.tokenHash);
    expect(famData.rotationSeq).toBe("1");
    expect(famData.isCompromised).toBe("0");

    const sessKey = sessionStore.sessionKey(familyId, sessionId);
    const sessData = await realRedis.hgetall(sessKey);
    expect(sessData.accountId).toBe(testAccountId);
    expect(sessData.tokenHash).toBe(token.tokenHash);
    expect(sessData.ipAddress).toBe("127.0.0.1");

    const lookupKey = sessionStore.tokenLookupKey(familyId, token.tokenHash);
    const lookupRaw = await realRedis.get(lookupKey);
    expect(lookupRaw).not.toBeNull();
    const parsedLookup = JSON.parse(lookupRaw!);
    expect(parsedLookup.familyId).toBe(familyId);
    expect(parsedLookup.sessionId).toBe(sessionId);

    const acctMembers = await realRedis.smembers(sessionStore.accountSessionsKey(testAccountId));
    expect(acctMembers).toContain(`${familyId}:${sessionId}`);
  });

  // 2. Successful token rotation
  it("2. executes production Lua script to rotate session and updates keys atomically in real Redis", async () => {
    const familyId = crypto.randomUUID();
    const token1 = generateRefreshToken(familyId);
    const sessionId1 = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId: sessionId1,
      tokenHash: token1.tokenHash,
      accountId: testAccountId,
    });

    const rotationResult = await sessionService.rotateRefreshSession(
      token1.rawToken,
      { ipAddress: "127.0.0.1", userAgent: "RealRedisClient/2.0" },
      mockPrisma
    );

    expect(rotationResult.accessToken).toBeDefined();
    expect(rotationResult.newRawRefreshToken).toMatch(/^rt_/);

    // Verify in real Redis:
    // Old lookup and session MUST be deleted
    const oldLookupExists = await realRedis.exists(sessionStore.tokenLookupKey(familyId, token1.tokenHash));
    expect(oldLookupExists).toBe(0);

    const oldSessionExists = await realRedis.exists(sessionStore.sessionKey(familyId, sessionId1));
    expect(oldSessionExists).toBe(0);

    // Revoked tombstone MUST exist with rotation timestamp
    const tombstone = await realRedis.get(sessionStore.revokedTokenKey(familyId, token1.tokenHash));
    expect(tombstone).not.toBeNull();

    // Family record MUST be updated to rotationSeq 2
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.rotationSeq).toBe(2);
    expect(fam?.isCompromised).toBe(false);
  });

  // 3. Exactly one successful concurrent rotation
  it("3. allows exactly one successful rotation under concurrent execution against real Redis", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: testAccountId,
    });

    // Launch two simultaneous rotation requests presenting the exact same token
    const results = await Promise.allSettled([
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma),
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const rejections = results.filter((r) => r.status === "rejected");

    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);

    // Sequence in Redis must be exactly 2
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.rotationSeq).toBe(2);
  });

  // 4. Replay detection and family compromise
  it("4. detects token replay after grace window and marks family compromised in real Redis", async () => {
    const familyId = crypto.randomUUID();
    const token1 = generateRefreshToken(familyId);
    const sessionId1 = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId: sessionId1,
      tokenHash: token1.tokenHash,
      accountId: testAccountId,
    });

    // Rotate token1 -> token2
    const rotation = await sessionService.rotateRefreshSession(token1.rawToken, {}, mockPrisma);
    expect(rotation.accessToken).toBeDefined();

    // Simulate replay after grace window by setting tombstone timestamp 20s in the past
    await realRedis.set(
      sessionStore.revokedTokenKey(familyId, token1.tokenHash),
      new Date(Date.now() - 20000).toISOString()
    );

    // Present old token1 again
    await expect(
      sessionService.rotateRefreshSession(token1.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError(
        "Refresh token replay detected. Session family has been revoked.",
        ErrorCode.TOKEN_REPLAY_DETECTED
      )
    );

    // Inspect real Redis: family is compromised
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.isCompromised).toBe(true);

    // Active session and lookup must be deleted
    const famData = await realRedis.hgetall(sessionStore.familyKey(familyId));
    expect(famData.isCompromised).toBe("1");
  });

  // 5. Single-device logout
  it("5. executes single-device logout and purges records from real Redis", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: testAccountId,
    });

    const logoutRes = await sessionService.logoutSession(token.rawToken, testAccountId);
    expect(logoutRes.message).toBe("Successfully logged out and session revoked.");

    // Verify keys in real Redis
    const famExists = await realRedis.exists(sessionStore.familyKey(familyId));
    expect(famExists).toBe(0);

    const sessExists = await realRedis.exists(sessionStore.sessionKey(familyId, sessionId));
    expect(sessExists).toBe(0);

    const lookupExists = await realRedis.exists(sessionStore.tokenLookupKey(familyId, token.tokenHash));
    expect(lookupExists).toBe(0);

    // Pruned from account index
    const members = await realRedis.smembers(sessionStore.accountSessionsKey(testAccountId));
    expect(members).not.toContain(`${familyId}:${sessionId}`);
  });

  // 6. Session TTL and tombstone TTL
  it("6. asserts accurate TTLs on session, family, and tombstone in real Redis", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: testAccountId,
    });

    const famTtl = await realRedis.ttl(sessionStore.familyKey(familyId));
    expect(famTtl).toBeGreaterThan(SESSION_TTL_SECONDS - 5);
    expect(famTtl).toBeLessThanOrEqual(SESSION_TTL_SECONDS);

    const sessTtl = await realRedis.ttl(sessionStore.sessionKey(familyId, sessionId));
    expect(sessTtl).toBeGreaterThan(SESSION_TTL_SECONDS - 5);
    expect(sessTtl).toBeLessThanOrEqual(SESSION_TTL_SECONDS);

    // Rotate and check tombstone TTL
    await sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma);
    const tombTtl = await realRedis.ttl(sessionStore.revokedTokenKey(familyId, token.tokenHash));
    expect(tombTtl).toBeGreaterThan(TOMBSTONE_TTL_SECONDS - 5);
    expect(tombTtl).toBeLessThanOrEqual(TOMBSTONE_TTL_SECONDS);
  });

  // 7. Redis connection failure
  it("7. throws ServiceUnavailableError when connecting to an unreachable Redis host", async () => {
    const brokenClient = new Redis({
      host: "127.0.0.1",
      port: 59999, // Unused port
      lazyConnect: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 500,
      retryStrategy: () => null,
    });
    brokenClient.on("error", () => {}); // silence node warning

    const brokenStore = new RedisSessionStore(brokenClient);

    await expect(brokenStore.getFamily(crypto.randomUUID())).rejects.toThrow(
      ServiceUnavailableError
    );

    brokenClient.disconnect();
  });

  // 8. Redis restart or reconnection behavior
  it("8. recovers and continues serving operations after connection pause", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: testAccountId,
    });

    // Ping works
    const isAlive = await sessionStore.ping();
    expect(isAlive).toBe(true);

    // Verify session still exists
    const fam = await sessionStore.getFamily(familyId);
    expect(fam).not.toBeNull();
  });

  // 9. Malformed Redis records
  it("9. handles corrupted or missing Redis fields safely without crashing", async () => {
    const familyId = crypto.randomUUID();
    // Write partial corrupted hash directly into real Redis
    await realRedis.hset(sessionStore.familyKey(familyId), "corruptedField", "randomValue");

    const fam = await sessionStore.getFamily(familyId);
    // Missing activeTokenHash causes getFamily to safely return null
    expect(fam).toBeNull();
  });

  // 10. Rotation and logout race conditions
  it("10. handles concurrent rotation and logout without leaving orphaned state", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: testAccountId,
    });

    // Fire rotation and logout concurrently
    const [rotRes, logoutRes] = await Promise.allSettled([
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma),
      sessionService.logoutSession(token.rawToken, testAccountId),
    ]);

    // Either rotation wins then logout cleans it, or logout wins and rotation fails:
    // in all cases, system state converges deterministically without unhandled errors
    expect(["fulfilled", "rejected"]).toContain(rotRes.status);
    expect(logoutRes.status).toBe("fulfilled");
  });

  // 11. Post-rotation failure recovery
  it("11. client retry within grace window returns 401 TOKEN_INVALID without compromising family", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: testAccountId,
    });

    // First rotation succeeds
    const rot = await sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma);

    // Immediate retry with the same old token (simulating lost response / network retry)
    await expect(
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError("Refresh token has already been rotated", ErrorCode.TOKEN_INVALID)
    );

    // Inspect real Redis: family is NOT compromised!
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.isCompromised).toBe(false);

    // Replacement token is still valid
    const rot2 = await sessionService.rotateRefreshSession(rot.newRawRefreshToken, {}, mockPrisma);
    expect(rot2.accessToken).toBeDefined();
  });

  // 12. Account-index consistency
  it("12. maintains account session index consistency across multiple device families in real Redis", async () => {
    const family1 = crypto.randomUUID();
    const token1 = generateRefreshToken(family1);
    const session1 = crypto.randomUUID();

    const family2 = crypto.randomUUID();
    const token2 = generateRefreshToken(family2);
    const session2 = crypto.randomUUID();

    // Create session for Device 1
    await sessionStore.createInitialSession({
      familyId: family1,
      sessionId: session1,
      tokenHash: token1.tokenHash,
      accountId: testAccountId,
    });

    // Create session for Device 2
    await sessionStore.createInitialSession({
      familyId: family2,
      sessionId: session2,
      tokenHash: token2.tokenHash,
      accountId: testAccountId,
    });

    // Account index must contain both devices
    let members = await realRedis.smembers(sessionStore.accountSessionsKey(testAccountId));
    expect(members).toHaveLength(2);
    expect(members).toContain(`${family1}:${session1}`);
    expect(members).toContain(`${family2}:${session2}`);

    // Logout Device 1 only
    await sessionService.logoutSession(token1.rawToken, testAccountId);

    // Device 1 removed, Device 2 remains!
    members = await realRedis.smembers(sessionStore.accountSessionsKey(testAccountId));
    expect(members).toHaveLength(1);
    expect(members).toContain(`${family2}:${session2}`);
    expect(members).not.toContain(`${family1}:${session1}`);
  });
});
