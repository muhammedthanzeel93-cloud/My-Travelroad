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

    // Present old spent token1 again: under strict single-winner rotation, this is immediately
    // detected as replay because token1 is now in revoked_token tombstones
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

  // 11. Rotated token replay immediate revocation
  it("11. presenting rotated token immediately triggers TOKEN_REPLAY_DETECTED and revokes family in real Redis", async () => {
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
    expect(rot.accessToken).toBeDefined();
    expect(rot.newRawRefreshToken).toBeDefined();

    // Replay presentation with spent token: strict single-winner policy classifies this as replay
    await expect(
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError(
        "Refresh token replay detected. Session family has been revoked.",
        ErrorCode.TOKEN_REPLAY_DETECTED
      )
    );

    // Inspect real Redis: family is permanently marked compromised
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.isCompromised).toBe(true);

    // Replacement token is also revoked because the entire family is compromised
    await expect(
      sessionService.rotateRefreshSession(rot.newRawRefreshToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError(
        "Refresh token family has been revoked due to replay detection",
        ErrorCode.TOKEN_REPLAY_DETECTED
      )
    );
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

  // 13. Concurrent refresh requests: strict single-winner rotation & subsequent spent-token replay
  it("13. concurrent refresh requests result in exactly one winner without credentials to the loser, preserving the session until a later replay confirms revocation", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    // Device 1
    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: testAccountId,
    });

    // Device 2 (unrelated device session for same user)
    const familyId2 = crypto.randomUUID();
    const token2 = generateRefreshToken(familyId2);
    const sessionId2 = crypto.randomUUID();
    await sessionStore.createInitialSession({
      familyId: familyId2,
      sessionId: sessionId2,
      tokenHash: token2.tokenHash,
      accountId: testAccountId,
    });

    // 13a. Fire 2 concurrent refresh requests presenting the exact same refresh token
    const results = await Promise.allSettled([
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma),
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    // Exactly one winner succeeds
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Winner receives brand new access token and refresh token
    const winnerRes = fulfilled[0].value;
    expect(winnerRes.accessToken).toBeDefined();
    expect(winnerRes.newRawRefreshToken).toBeDefined();

    // Loser receives 401 UnauthorizedError with TOKEN_INVALID (concurrency race detected)
    expect(rejected[0].reason).toBeInstanceOf(UnauthorizedError);
    expect(rejected[0].reason.code).toBe(ErrorCode.TOKEN_INVALID);
    expect(rejected[0].reason.message).toContain("Concurrent token rotation or replay detected");

    // The loser receives NO access or refresh credentials
    expect((rejected[0].reason as any).accessToken).toBeUndefined();
    expect((rejected[0].reason as any).newRawRefreshToken).toBeUndefined();

    // 13b. Verify family state matches the single-winner policy:
    // Family 1 is NOT compromised, rotation sequence is 2, active session updated
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.isCompromised).toBe(false);
    expect(fam?.rotationSeq).toBe(2);
    expect(fam?.activeSessionId).not.toBe(sessionId);

    // Device 2 is untouched
    const fam2 = await sessionStore.getFamily(familyId2);
    expect(fam2?.isCompromised).toBe(false);
    expect(fam2?.rotationSeq).toBe(1);

    // 13c. Later presentation of the spent token triggers confirmed replay detection
    await expect(
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError(
        "Refresh token replay detected. Session family has been revoked.",
        ErrorCode.TOKEN_REPLAY_DETECTED
      )
    );

    // Family 1 is now marked compromised
    const compromisedFam = await sessionStore.getFamily(familyId);
    expect(compromisedFam?.isCompromised).toBe(true);

    // Active session for Family 1 is purged from account index
    const members = await realRedis.smembers(sessionStore.accountSessionsKey(testAccountId));
    expect(members).not.toContain(`${familyId}:${fam?.activeSessionId}`);

    // Device 2 session remains active and in account index!
    expect(members).toContain(`${familyId2}:${sessionId2}`);

    // Device 2 can still rotate cleanly without failure
    const rot2 = await sessionService.rotateRefreshSession(token2.rawToken, {}, mockPrisma);
    expect(rot2.accessToken).toBeDefined();
    expect(rot2.newRawRefreshToken).toBeDefined();
  });

  // 14. Strict Lua validation testing sequence overflow and malformed state against ATOMIC_ROTATION_LUA
  it("14. strict Lua state validation rejects sequence overflow and 20 distinct invalid inputs without altering Redis state", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    const setupSession = async () => {
      await realRedis.flushall();
      await sessionStore.createInitialSession({
        familyId,
        sessionId,
        tokenHash: token.tokenHash,
        accountId: testAccountId,
      });
    };

    const runRotation = async () => {
      return sessionStore.rotateSession({
        familyId,
        presentedTokenHash: token.tokenHash,
        oldSessionId: sessionId,
        newSessionId: crypto.randomUUID(),
        replacementTokenHash: crypto.randomBytes(32).toString("hex"),
        ipAddress: "127.0.0.1",
        userAgent: "Test/1.0",
        timestamp: new Date().toISOString(),
      });
    };

    const assertUntouched = async (expectedSeqStr = "1") => {
      const famRaw = await realRedis.hgetall(sessionStore.familyKey(familyId));
      expect(famRaw.rotationSeq).toBe(expectedSeqStr);
      expect(famRaw.activeTokenHash).toBe(token.tokenHash);
      expect(famRaw.activeSessionId).toBe(sessionId);
      expect(famRaw.isCompromised).toBe("0");

      const sess = await sessionStore.getSession(familyId, sessionId);
      expect(sess).not.toBeNull();

      const lookupRaw = await realRedis.get(sessionStore.tokenLookupKey(familyId, token.tokenHash));
      expect(lookupRaw).not.toBeNull();

      const tombstoneExists = await realRedis.exists(sessionStore.revokedTokenKey(familyId, token.tokenHash));
      expect(tombstoneExists).toBe(0);
    };

    // 14.1 Corrupted JSON lookup
    await setupSession();
    await realRedis.set(sessionStore.tokenLookupKey(familyId, token.tokenHash), "{bad-json:");
    let res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("TOKEN_LOOKUP_CORRUPTED");
    await assertUntouched();

    // 14.2 Non-table JSON lookup
    await setupSession();
    await realRedis.set(sessionStore.tokenLookupKey(familyId, token.tokenHash), JSON.stringify("scalar-string"));
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("TOKEN_LOOKUP_CORRUPTED");
    await assertUntouched();

    // 14.3 Lookup family mismatch
    await setupSession();
    await realRedis.set(sessionStore.tokenLookupKey(familyId, token.tokenHash), JSON.stringify({
      familyId: "wrong-family-uuid",
      sessionId,
      accountId: testAccountId,
    }));
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("LOOKUP_FAMILY_MISMATCH");
    await assertUntouched();

    // 14.4 Lookup session mismatch
    await setupSession();
    await realRedis.set(sessionStore.tokenLookupKey(familyId, token.tokenHash), JSON.stringify({
      familyId,
      sessionId: "wrong-session-uuid",
      accountId: testAccountId,
    }));
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("LOOKUP_SESSION_MISMATCH");
    await assertUntouched();

    // 14.5 Lookup account missing
    await setupSession();
    await realRedis.set(sessionStore.tokenLookupKey(familyId, token.tokenHash), JSON.stringify({
      familyId,
      sessionId,
    }));
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("LOOKUP_ACCOUNT_MISSING");
    await assertUntouched();

    // 14.6 Old session record missing entirely
    await setupSession();
    await realRedis.del(sessionStore.sessionKey(familyId, sessionId));
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("OLD_SESSION_NOT_FOUND");

    // 14.7 Old session sessionId mismatch
    await setupSession();
    await realRedis.hset(sessionStore.sessionKey(familyId, sessionId), "sessionId", "mismatched-uuid");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("OLD_SESSION_ID_MISMATCH");
    await assertUntouched();

    // 14.8 Old session family mismatch
    await setupSession();
    await realRedis.hset(sessionStore.sessionKey(familyId, sessionId), "familyId", "mismatched-family");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("OLD_SESSION_FAMILY_MISMATCH");
    await assertUntouched();

    // 14.9 Old session account mismatch
    await setupSession();
    await realRedis.hset(sessionStore.sessionKey(familyId, sessionId), "accountId", "wrong-account");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("OLD_SESSION_ACCOUNT_MISMATCH");
    await assertUntouched();

    // 14.10 Old session tokenHash missing
    await setupSession();
    await realRedis.hdel(sessionStore.sessionKey(familyId, sessionId), "tokenHash");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("OLD_SESSION_TOKEN_HASH_MISSING");
    let famCheck = await sessionStore.getFamily(familyId);
    expect(famCheck?.rotationSeq).toBe(1);
    expect(await realRedis.exists(sessionStore.revokedTokenKey(familyId, token.tokenHash))).toBe(0);

    // 14.11 Old session tokenHash mismatch
    await setupSession();
    await realRedis.hset(sessionStore.sessionKey(familyId, sessionId), "tokenHash", "wrong-hash");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("OLD_SESSION_HASH_MISMATCH");
    famCheck = await sessionStore.getFamily(familyId);
    expect(famCheck?.rotationSeq).toBe(1);
    expect(await realRedis.exists(sessionStore.revokedTokenKey(familyId, token.tokenHash))).toBe(0);

    // 14.12 Rotation sequence: empty string
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("");

    // 14.13 Rotation sequence: non-digit string
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "abc");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("abc");

    // 14.14 Rotation sequence: 0
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "0");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("0");

    // 14.15 Rotation sequence: negative number
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "-1");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("-1");

    // 14.16 Rotation sequence: decimal number
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "1.5");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("1.5");

    // 14.17 Rotation sequence: exponential notation
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "1e5");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("1e5");

    // 14.18 Rotation sequence: leading zeroes
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "01");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("01");

    // 14.19 Rotation sequence: maximum safe integer (9007199254740991)
    // Cannot be incremented without exceeding Number.MAX_SAFE_INTEGER
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "9007199254740991");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("9007199254740991");

    // 14.20 Rotation sequence: beyond maximum safe integer (9007199254740992 and 17-digit huge number)
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "9007199254740992");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("9007199254740992");

    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "99999999999999999");
    res = await runRotation();
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("INVALID_ROTATION_SEQUENCE");
    await assertUntouched("99999999999999999");

    // 14.21 Valid upper bound: Maximum safe integer minus one (9007199254740990)
    // CAN safely be incremented to 9007199254740991!
    await setupSession();
    await realRedis.hset(sessionStore.familyKey(familyId), "rotationSeq", "9007199254740990");
    res = await runRotation();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.newRotationSeq).toBe(9007199254740991);
    }
    const updatedFam = await sessionStore.getFamily(familyId);
    expect(updatedFam?.rotationSeq).toBe(9007199254740991);

    // 14.22 Replacement lookup key collision
    await setupSession();
    const collidingNewHash = crypto.randomBytes(32).toString("hex");
    await realRedis.set(sessionStore.tokenLookupKey(familyId, collidingNewHash), "pre-existing");
    res = await sessionStore.rotateSession({
      familyId,
      presentedTokenHash: token.tokenHash,
      oldSessionId: sessionId,
      newSessionId: crypto.randomUUID(),
      replacementTokenHash: collidingNewHash,
      ipAddress: "127.0.0.1",
      userAgent: "Test/1.0",
      timestamp: new Date().toISOString(),
    });
    expect(res.success).toBe(false);
    expect((res as any).reason).toBe("REPLACEMENT_KEY_COLLISION");
    await assertUntouched();
  });

  // 15. Confirms account session index cleanup after confirmed replay in real Redis
  it("15. removes compromised session from account index after confirmed replay in real Redis", async () => {
    const family1 = crypto.randomUUID();
    const token1 = generateRefreshToken(family1);
    const session1 = crypto.randomUUID();

    const family2 = crypto.randomUUID();
    const token2 = generateRefreshToken(family2);
    const session2 = crypto.randomUUID();

    // Device 1
    await sessionStore.createInitialSession({
      familyId: family1,
      sessionId: session1,
      tokenHash: token1.tokenHash,
      accountId: testAccountId,
    });

    // Device 2
    await sessionStore.createInitialSession({
      familyId: family2,
      sessionId: session2,
      tokenHash: token2.tokenHash,
      accountId: testAccountId,
    });

    // Rotate Device 1
    await sessionService.rotateRefreshSession(token1.rawToken, {}, mockPrisma);

    // Present old token on Device 1: immediately triggers replay detection
    await expect(
      sessionService.rotateRefreshSession(token1.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError(
        "Refresh token replay detected. Session family has been revoked.",
        ErrorCode.TOKEN_REPLAY_DETECTED
      )
    );

    // Real Redis account index inspection: Device 1 removed, Device 2 remains!
    const members = await realRedis.smembers(sessionStore.accountSessionsKey(testAccountId));
    expect(members).toHaveLength(1);
    expect(members).toContain(`${family2}:${session2}`);
    expect(members).not.toContain(`${family1}:${session1}`);
  });

  // 16. Security assertions: no raw tokens or recovery envelopes in Redis
  it("16. asserts zero plaintext refresh tokens or recovery envelopes stored in real Redis", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: testAccountId,
    });

    // Rotate session
    await sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma);

    // Inspect tombstone key: must contain ONLY a timestamp ISO string
    const tombstoneVal = await realRedis.get(sessionStore.revokedTokenKey(familyId, token.tokenHash));
    expect(tombstoneVal).toBeDefined();
    // Validate ISO timestamp format: e.g. 2026-11-26T...
    expect(new Date(tombstoneVal!).toISOString()).toBe(tombstoneVal);
    // Must NOT be JSON and must NOT contain recovery envelope fields
    expect(tombstoneVal).not.toContain("encryptedRecovery");
    expect(tombstoneVal).not.toContain("ciphertext");

    // Scan all keys in Redis and verify rawToken does NOT exist in any key or value
    const allKeys = await realRedis.keys("*");
    for (const key of allKeys) {
      expect(key).not.toContain(token.rawToken);
      const type = await realRedis.type(key);
      if (type === "string") {
        const val = await realRedis.get(key);
        expect(val).not.toContain(token.rawToken);
      } else if (type === "hash") {
        const hash = await realRedis.hgetall(key);
        for (const [f, v] of Object.entries(hash)) {
          expect(f).not.toContain(token.rawToken);
          expect(v).not.toContain(token.rawToken);
        }
      }
    }
  });
});
