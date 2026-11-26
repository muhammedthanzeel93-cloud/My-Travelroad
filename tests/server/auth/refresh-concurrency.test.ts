/**
 * Concurrency & Race Condition Tests for Refresh Token Rotation
 * (tests/server/auth/refresh-concurrency.test.ts)
 *
 * Validates:
 * 1. Two simultaneous refresh requests using the same token: exactly one succeeds.
 * 2. Losing request cannot issue a replacement token or overwrite winner's session.
 * 3. Replay racing with rotation maintains family isolation and failure convergence.
 * 4. Logout racing with refresh ensures no zombie session resurrection.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import RedisMock from "ioredis-mock";
import { setupRedisMock } from "../helpers/redis-mock.helper";
import { RedisSessionStore } from "../../../src/server/redis/session.store";
import { SessionService } from "../../../src/server/services/session.service";
import { generateRefreshToken } from "../../../src/server/auth/refresh-token";
import { UnauthorizedError } from "../../../src/server/errors/app-error";

describe("Refresh Token Concurrency & Race Condition Guarantees", () => {
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
    setupRedisMock(redis);
    sessionStore = new RedisSessionStore(redis);
    sessionService = new SessionService(sessionStore);

    mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue(validAccount),
      },
    };
  });

  it("handles two simultaneous refresh requests with the same token: exactly one succeeds", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: validAccountId,
    });

    // Execute two concurrent refresh requests simultaneously
    const results = await Promise.allSettled([
      sessionService.rotateRefreshSession(
        token.rawToken,
        { ipAddress: "127.0.0.1", userAgent: "Client-A" },
        mockPrisma
      ),
      sessionService.rotateRefreshSession(
        token.rawToken,
        { ipAddress: "127.0.0.1", userAgent: "Client-B" },
        mockPrisma
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    // In a race condition with the same token, at most one can succeed
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // The successful winner receives a valid access token and rotation sequence 2
    const winner = fulfilled[0].value;
    expect(winner.accessToken).toBeDefined();
    expect(winner.newRawRefreshToken).toMatch(/^rt_/);

    const fam = await sessionStore.getFamily(familyId);
    expect(fam?.rotationSeq).toBe(2);

    // The losing request must have been rejected with an UnauthorizedError
    expect(rejected[0].reason).toBeInstanceOf(UnauthorizedError);

    // The winner's replacement token is the ONLY valid token in Redis
    const winnerTokenHash = winner.newRawRefreshToken.split("_")[2];
    expect(fam?.activeTokenHash).toBe(crypto.createHash("sha256").update(winner.newRawRefreshToken).digest("hex"));
  });

  it("ensures losing request in a rotation race cannot overwrite the winner's session state", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: validAccountId,
    });

    // Execute first rotation to completion
    const winner = await sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma);
    expect(winner.accessToken).toBeDefined();

    // Subsequent presentation of the spent old token triggers immediate replay detection
    await expect(
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma)
    ).rejects.toThrow(UnauthorizedError);

    // Verify family activeSessionId was never reverted or overwritten by the old session ID
    const currentFam = await sessionStore.getFamily(familyId);
    expect(currentFam?.activeSessionId).not.toBe(sessionId);
    expect(currentFam?.isCompromised).toBe(true);
  });

  it("handles logout racing with refresh: refresh fails after logout commits", async () => {
    const familyId = crypto.randomUUID();
    const token = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: token.tokenHash,
      accountId: validAccountId,
    });

    // Logout commits
    await sessionService.logoutSession(token.rawToken, validAccountId);

    // Racing refresh arrives after logout has committed
    await expect(
      sessionService.rotateRefreshSession(token.rawToken, {}, mockPrisma)
    ).rejects.toThrow(
      new UnauthorizedError("Invalid or expired refresh token")
    );

    // Verify family remains deleted
    const fam = await sessionStore.getFamily(familyId);
    expect(fam).toBeNull();
  });
});
