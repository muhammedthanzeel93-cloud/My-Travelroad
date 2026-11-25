/**
 * Integration Tests for Session Lifecycle, Rotation, Replay Detection, and Multi-Device Isolation
 * (src/server/services/session.service.ts & src/server/redis/session.store.ts)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import RedisMock from "ioredis-mock";
import { RedisSessionStore } from "../../../src/server/redis/session.store";
import { SessionService } from "../../../src/server/services/session.service";
import { generateRefreshToken } from "../../../src/server/auth/refresh-token";
import { UnauthorizedError, ForbiddenError } from "../../../src/server/errors/app-error";
import { ErrorCode } from "../../../src/server/errors/error-codes";

describe("SessionService & RedisSessionStore Integration Tests", () => {
  let redis: any;
  let sessionStore: RedisSessionStore;
  let sessionService: SessionService;
  let mockPrisma: any;

  const validAccountId = "550e8400-e29b-41d4-a716-446655440001";
  const validAccount = {
    id: validAccountId,
    email: "amina.rahman@example.com",
    role: "traveler",
    status: "active",
    type: "individual",
    emailVerified: true,
    securityCredentials: {
      passwordChangedAt: null,
    },
  };

  beforeEach(() => {
    redis = new RedisMock();
    sessionStore = new RedisSessionStore(redis);
    sessionService = new SessionService(sessionStore);

    mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue(validAccount),
      },
    };
  });

  it("persists initial session, family, token lookup, and account index on creation", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: validAccountId,
      ipAddress: "192.168.1.100",
      userAgent: "TestAgent/1.0",
    });

    const fam = await sessionStore.getFamily(familyId);
    expect(fam).not.toBeNull();
    expect(fam?.activeSessionId).toBe(sessionId);
    expect(fam?.activeTokenHash).toBe(token.tokenHash);
    expect(fam?.rotationSeq).toBe(1);
    expect(fam?.isCompromised).toBe(false);

    const session = await sessionStore.getSession(familyId, sessionId);
    expect(session).not.toBeNull();
    expect(session?.accountId).toBe(validAccountId);
    expect(session?.ipAddress).toBe("192.168.1.100");

    const lookup = await sessionStore.getTokenLookup(familyId, token.tokenHash);
    expect(lookup).not.toBeNull();
    expect(lookup?.accountId).toBe(validAccountId);
    expect(lookup?.sessionId).toBe(sessionId);

    const members = await redis.smembers(`account_sessions:${validAccountId}`);
    expect(members).toContain(`${familyId}:${sessionId}`);
  });

  it("successfully rotates an active refresh token and returns a new access token", async () => {
    const familyId = crypto.randomUUID();
    const initialToken = generateRefreshToken(familyId);
    const initialSessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId: initialSessionId,
      tokenHash: initialToken.tokenHash,
      accountId: validAccountId,
    });

    const result = await sessionService.rotateRefreshSession(
      initialToken.rawToken,
      { ipAddress: "127.0.0.1", userAgent: "Mozilla/5.0" },
      mockPrisma
    );

    expect(result.accessToken).toBeDefined();
    expect(result.tokenType).toBe("Bearer");
    expect(result.expiresIn).toBe(900);
    expect(result.newRawRefreshToken).toMatch(/^rt_/);
    expect(result.newRawRefreshToken).not.toBe(initialToken.rawToken);

    // Verify family was updated to new sequence
    const updatedFam = await sessionStore.getFamily(familyId);
    expect(updatedFam?.rotationSeq).toBe(2);
    expect(updatedFam?.activeSessionId).not.toBe(initialSessionId);

    // Verify old token lookup was deleted
    const oldLookup = await sessionStore.getTokenLookup(familyId, initialToken.tokenHash);
    expect(oldLookup).toBeNull();

    // Verify revoked tombstone was recorded for old token
    const isRevoked = await sessionStore.isTokenRevoked(familyId, initialToken.tokenHash);
    expect(isRevoked).toBe(true);

    // Verify account session index was updated (old member removed, new added)
    const members = await redis.smembers(`account_sessions:${validAccountId}`);
    expect(members).not.toContain(`${familyId}:${initialSessionId}`);
    expect(members).toContain(`${familyId}:${updatedFam?.activeSessionId}`);
  });

  it("detects token replay and revokes strictly the compromised family", async () => {
    const familyId = crypto.randomUUID();
    const initialToken = generateRefreshToken(familyId);
    const initialSessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId: initialSessionId,
      tokenHash: initialToken.tokenHash,
      accountId: validAccountId,
    });

    // 1. First legitimate rotation
    const rotation1 = await sessionService.rotateRefreshSession(
      initialToken.rawToken,
      {},
      mockPrisma
    );

    // 2. Replay attack: present the old initial token again
    await expect(
      sessionService.rotateRefreshSession(initialToken.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError(
        "Refresh token replay detected. Session family has been revoked.",
        ErrorCode.TOKEN_REPLAY_DETECTED
      )
    );

    // Verify family is marked compromised
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.isCompromised).toBe(true);

    // Verify the previously active session from rotation1 is now deleted
    const activeLookup = await sessionStore.getTokenLookup(
      familyId,
      rotation1.newRawRefreshToken.split("_")[2]
    );
    expect(activeLookup).toBeNull();

    // Subsequent presentations of rotation1 token also fail with TOKEN_REPLAY_DETECTED
    await expect(
      sessionService.rotateRefreshSession(rotation1.newRawRefreshToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError(
        "Refresh token family has been revoked due to replay detection",
        ErrorCode.TOKEN_REPLAY_DETECTED
      )
    );
  });

  it("guarantees cross-device session isolation: compromising Family A leaves Family B valid", async () => {
    // User has Device A (e.g. laptop) and Device B (e.g. mobile)
    const familyA = crypto.randomUUID();
    const tokenA1 = generateRefreshToken(familyA);
    const sessionA1 = crypto.randomUUID();
    await sessionStore.createInitialSession({
      familyId: familyA,
      sessionId: sessionA1,
      tokenHash: tokenA1.tokenHash,
      accountId: validAccountId,
    });

    const familyB = crypto.randomUUID();
    const tokenB1 = generateRefreshToken(familyB);
    const sessionB1 = crypto.randomUUID();
    await sessionStore.createInitialSession({
      familyId: familyB,
      sessionId: sessionB1,
      tokenHash: tokenB1.tokenHash,
      accountId: validAccountId,
    });

    // Legitimate rotation on Device A
    await sessionService.rotateRefreshSession(tokenA1.rawToken, {}, mockPrisma);

    // Replay attack on Device A
    await expect(
      sessionService.rotateRefreshSession(tokenA1.rawToken, {}, mockPrisma)
    ).rejects.toThrow(UnauthorizedError);

    // Verify Device A is compromised
    const famA = await sessionStore.getFamily(familyA);
    expect(famA?.isCompromised).toBe(true);

    // CRITICAL: Device B must remain UNCOMPROMISED and fully functional!
    const famB = await sessionStore.getFamily(familyB);
    expect(famB?.isCompromised).toBe(false);

    // Device B can rotate its session without error
    const rotationB = await sessionService.rotateRefreshSession(tokenB1.rawToken, {}, mockPrisma);
    expect(rotationB.accessToken).toBeDefined();

    const updatedFamB = await sessionStore.getFamily(familyB);
    expect(updatedFamB?.rotationSeq).toBe(2);
    expect(updatedFamB?.isCompromised).toBe(false);
  });

  it("performs atomic single-device logout and prunes account session index", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: validAccountId,
    });

    const logoutRes = await sessionService.logoutSession(token.rawToken, validAccountId);
    expect(logoutRes.message).toBe("Successfully logged out and session revoked.");

    // Family and session must be deleted
    const fam = await sessionStore.getFamily(familyId);
    expect(fam).toBeNull();

    const session = await sessionStore.getSession(familyId, sessionId);
    expect(session).toBeNull();

    // Account index member must be pruned
    const members = await redis.smembers(`account_sessions:${validAccountId}`);
    expect(members).not.toContain(`${familyId}:${sessionId}`);

    // Subsequent refresh attempts must fail
    await expect(
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError("Invalid or expired refresh token", ErrorCode.TOKEN_INVALID)
    );

    // Repeated logout is safe and idempotent
    const repeatLogout = await sessionService.logoutSession(token.rawToken, validAccountId);
    expect(repeatLogout.message).toBe("Successfully logged out and session revoked.");
  });

  it("rejects refresh and revokes family when account is suspended in PostgreSQL", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: validAccountId,
    });

    mockPrisma.account.findUnique.mockResolvedValueOnce({
      ...validAccount,
      status: "suspended",
    });

    await expect(
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new ForbiddenError("Account is suspended. Please contact customer support.", ErrorCode.ACCOUNT_SUSPENDED)
    );

    // Family must be revoked
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.isCompromised).toBe(true);
  });

  it("rejects refresh and revokes family when account is deactivated in PostgreSQL", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: validAccountId,
    });

    mockPrisma.account.findUnique.mockResolvedValueOnce({
      ...validAccount,
      status: "deactivated",
    });

    await expect(
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new ForbiddenError("Account is deactivated.", ErrorCode.ACCOUNT_DEACTIVATED)
    );

    // Family must be revoked
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.isCompromised).toBe(true);
  });

  it("rejects refresh and revokes family when session was created before passwordChangedAt", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    // Session created at t=1000
    const sessionCreatedAt = new Date("2026-11-20T10:00:00.000Z").toISOString();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: validAccountId,
      createdAt: sessionCreatedAt,
    });

    // Password changed later at t=2000
    mockPrisma.account.findUnique.mockResolvedValueOnce({
      ...validAccount,
      securityCredentials: {
        passwordChangedAt: new Date("2026-11-20T12:00:00.000Z"),
      },
    });

    await expect(
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError("Session has been invalidated due to a password change", ErrorCode.TOKEN_INVALID)
    );

    // Family must be revoked
    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.isCompromised).toBe(true);
  });

  it("allows refresh when session was created AFTER passwordChangedAt", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    // Session created at t=3000
    const sessionCreatedAt = new Date("2026-11-20T14:00:00.000Z").toISOString();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: validAccountId,
      createdAt: sessionCreatedAt,
    });

    // Password changed earlier at t=2000
    mockPrisma.account.findUnique.mockResolvedValueOnce({
      ...validAccount,
      securityCredentials: {
        passwordChangedAt: new Date("2026-11-20T12:00:00.000Z"),
      },
    });

    const result = await sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma);
    expect(result.accessToken).toBeDefined();
  });
});
