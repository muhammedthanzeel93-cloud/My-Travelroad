/**
 * Test Suite: Redis Pipeline Failure Handling, Session Persistence & Telemetry Safety
 * Verifies Task 10.6-R5 requirements for command-level pipeline failure detection,
 * fail-closed initial session persistence, partial-write rollback, and observable telemetry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { createApp } from "../../../src/server/app";
import {
  RedisSessionStore,
  assertPipelineSuccess,
} from "../../../src/server/redis/session.store";
import { ServiceUnavailableError } from "../../../src/server/errors/app-error";
import { SessionService } from "../../../src/server/services/session.service";
import { REFRESH_COOKIE_NAME } from "../../../src/server/auth/cookie";
import { hashPassword } from "../../../src/server/auth/password";
import { loginRateLimiter } from "../../../src/server/middleware/rate-limiter";
import { SESSION_TTL_SECONDS } from "../../../src/server/redis/redis.types";

/**
 * Creates a mock pipeline object with chainable methods.
 */
function createMockPipeline(
  execImpl: () => Promise<[Error | null, unknown][] | null>
) {
  const p: any = {
    hset: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    exec: vi.fn().mockImplementation(execImpl),
  };
  return p;
}

describe("assertPipelineSuccess Helper", () => {
  it("throws when results is null", () => {
    expect(() => assertPipelineSuccess(null, "testOp")).toThrow(
      "Pipeline execution failed in testOp: no results returned"
    );
  });

  it("throws when results is undefined", () => {
    expect(() => assertPipelineSuccess(undefined, "testOp")).toThrow(
      "Pipeline execution failed in testOp: no results returned"
    );
  });

  it("throws when results is not an array", () => {
    expect(() => assertPipelineSuccess("not-an-array" as any, "testOp")).toThrow(
      "Pipeline execution failed in testOp: no results returned"
    );
  });

  it("returns results array when all commands succeed with null errors", () => {
    const results: [Error | null, unknown][] = [
      [null, 1],
      [null, 1],
      [null, "OK"],
    ];
    const extracted = assertPipelineSuccess(results, "testOp");
    expect(extracted).toEqual([1, 1, "OK"]);
  });

  it("throws combined error when a single command returns an error in tuple", () => {
    const commandError = new Error("OOM command not allowed");
    const results: [Error | null, unknown][] = [
      [null, 1],
      [commandError, null],
      [null, "OK"],
    ];

    expect(() => assertPipelineSuccess(results, "testOp")).toThrow(
      "Pipeline command failure in testOp (1 error(s)): OOM command not allowed"
    );
  });

  it("throws combined error when multiple commands return errors and links primary cause", () => {
    const err1 = new Error("Command 1 failed");
    const err2 = new Error("Command 2 failed");
    const results: [Error | null, unknown][] = [
      [err1, null],
      [null, 1],
      [err2, null],
    ];

    try {
      assertPipelineSuccess(results, "multiErrorOp");
      expect.fail("Should have thrown");
    } catch (e: any) {
      expect(e.message).toContain("Pipeline command failure in multiErrorOp (2 error(s))");
      expect(e.message).toContain("Command 1 failed; Command 2 failed");
      expect(e.cause).toBe(err1);
    }
  });
});

describe("Initial Session Creation — Fail-Closed & Partial Write Rollback", () => {
  const familyId = "550e8400-e29b-41d4-a716-446655440001";
  const sessionId = "550e8400-e29b-41d4-a716-446655440002";
  const tokenHash = "b".repeat(64);
  const accountId = "550e8400-e29b-41d4-a716-446655440099";

  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("A.1: succeeds when all pipeline commands and SADD succeed", async () => {
    const pipeline = createMockPipeline(async () => [
      [null, 1], // hset family
      [null, 1], // expire family
      [null, 1], // hset session
      [null, 1], // expire session
      [null, "OK"], // set lookup
    ]);

    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockReturnValue(pipeline),
      sadd: vi.fn().mockResolvedValue(1),
    } as any;

    const store = new RedisSessionStore(mockClient);

    await expect(
      store.createInitialSession({
        familyId,
        sessionId,
        tokenHash,
        accountId,
      })
    ).resolves.toBeUndefined();

    expect(pipeline.hset).toHaveBeenCalledWith(
      `family:{${familyId}}`,
      expect.objectContaining({ familyId, activeSessionId: sessionId })
    );
    expect(pipeline.expire).toHaveBeenCalledWith(`family:{${familyId}}`, SESSION_TTL_SECONDS);
    expect(pipeline.set).toHaveBeenCalledWith(
      `token_lookup:{${familyId}}:${tokenHash}`,
      expect.any(String),
      "EX",
      SESSION_TTL_SECONDS
    );
    expect(mockClient.sadd).toHaveBeenCalledWith(
      `account_sessions:${accountId}`,
      `${familyId}:${sessionId}`
    );
  });

  it("A.2: family write returns individual command error -> rolls back and fails closed", async () => {
    let cleanupExecuted = false;
    let callCount = 0;

    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primary pipeline: family write fails
          return createMockPipeline(async () => [
            [new Error("OOM command not allowed"), null], // hset family failed!
            [null, 1],
            [null, 1],
            [null, 1],
            [null, "OK"],
          ]);
        }
        // Cleanup pipeline
        cleanupExecuted = true;
        return createMockPipeline(async () => [
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
        ]);
      }),
      sadd: vi.fn().mockResolvedValue(1),
    } as any;

    const store = new RedisSessionStore(mockClient);

    await expect(
      store.createInitialSession({
        familyId,
        sessionId,
        tokenHash,
        accountId,
      })
    ).rejects.toThrow(ServiceUnavailableError);

    expect(cleanupExecuted).toBe(true);
    expect(mockClient.sadd).not.toHaveBeenCalled();
  });

  it("A.3: session write returns individual command error -> rolls back and fails closed", async () => {
    let cleanupExecuted = false;
    let callCount = 0;

    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primary pipeline: session write fails
          return createMockPipeline(async () => [
            [null, 1],
            [null, 1],
            [new Error("READONLY replica"), null], // hset session failed!
            [null, 1],
            [null, "OK"],
          ]);
        }
        // Cleanup pipeline
        cleanupExecuted = true;
        return createMockPipeline(async () => [
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
        ]);
      }),
      sadd: vi.fn().mockResolvedValue(1),
    } as any;

    const store = new RedisSessionStore(mockClient);

    await expect(
      store.createInitialSession({
        familyId,
        sessionId,
        tokenHash,
        accountId,
      })
    ).rejects.toThrow(ServiceUnavailableError);

    expect(cleanupExecuted).toBe(true);
  });

  it("A.4: token lookup write returns individual command error -> rolls back and fails closed", async () => {
    let cleanupExecuted = false;
    let callCount = 0;

    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primary pipeline: token lookup fails
          return createMockPipeline(async () => [
            [null, 1],
            [null, 1],
            [null, 1],
            [null, 1],
            [new Error("CLUSTERDOWN Hash slot not served"), null], // set lookup failed!
          ]);
        }
        // Cleanup pipeline
        cleanupExecuted = true;
        return createMockPipeline(async () => [
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
        ]);
      }),
      sadd: vi.fn().mockResolvedValue(1),
    } as any;

    const store = new RedisSessionStore(mockClient);

    await expect(
      store.createInitialSession({
        familyId,
        sessionId,
        tokenHash,
        accountId,
      })
    ).rejects.toThrow(ServiceUnavailableError);

    expect(cleanupExecuted).toBe(true);
  });

  it("A.5: pipeline promise itself rejects -> rolls back and fails closed", async () => {
    let cleanupExecuted = false;
    let callCount = 0;

    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primary pipeline promise rejects
          return createMockPipeline(async () => {
            throw new Error("Connection reset by peer");
          });
        }
        // Cleanup pipeline
        cleanupExecuted = true;
        return createMockPipeline(async () => [
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
        ]);
      }),
      sadd: vi.fn().mockResolvedValue(1),
    } as any;

    const store = new RedisSessionStore(mockClient);

    await expect(
      store.createInitialSession({
        familyId,
        sessionId,
        tokenHash,
        accountId,
      })
    ).rejects.toThrow(ServiceUnavailableError);

    expect(cleanupExecuted).toBe(true);
  });

  it("A.6: partial-write cleanup succeeds -> no cleanup error logged", async () => {
    let callCount = 0;

    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockPipeline(async () => [
            [null, 1],
            [null, 1],
            [new Error("Session write failed"), null],
            [null, 1],
            [null, "OK"],
          ]);
        }
        // Cleanup succeeds
        return createMockPipeline(async () => [
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
        ]);
      }),
      sadd: vi.fn().mockResolvedValue(1),
    } as any;

    const store = new RedisSessionStore(mockClient);

    await expect(
      store.createInitialSession({ familyId, sessionId, tokenHash, accountId })
    ).rejects.toThrow(ServiceUnavailableError);

    // Verify SESSION_CLEANUP_FAILURE was NOT logged
    const cleanupErrorLogs = consoleErrorSpy.mock.calls
      .map(([arg]: any) => {
        try {
          return JSON.parse(arg);
        } catch {
          return null;
        }
      })
      .filter((log: any) => log?.event === "SESSION_CLEANUP_FAILURE");

    expect(cleanupErrorLogs.length).toBe(0);
  });

  it("A.7: partial-write cleanup also fails -> logs cleanup failure telemetry and still fails closed with original error", async () => {
    let callCount = 0;

    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primary pipeline fails
          return createMockPipeline(async () => [
            [null, 1],
            [null, 1],
            [new Error("Primary session write error"), null],
            [null, 1],
            [null, "OK"],
          ]);
        }
        // Cleanup pipeline also fails!
        return createMockPipeline(async () => {
          throw new Error("Cleanup network disconnected");
        });
      }),
      sadd: vi.fn().mockResolvedValue(1),
    } as any;

    const store = new RedisSessionStore(mockClient);

    await expect(
      store.createInitialSession({ familyId, sessionId, tokenHash, accountId })
    ).rejects.toThrow(ServiceUnavailableError);

    // Assert SESSION_CLEANUP_FAILURE was logged with structured JSON
    expect(consoleErrorSpy).toHaveBeenCalled();
    const cleanupLog = consoleErrorSpy.mock.calls
      .map(([arg]: any) => {
        try {
          return JSON.parse(arg);
        } catch {
          return null;
        }
      })
      .find((log: any) => log?.event === "SESSION_CLEANUP_FAILURE");

    expect(cleanupLog).toBeDefined();
    expect(cleanupLog.operation).toBe("cleanupPartialInitialSession");
    expect(cleanupLog.accountId).toBe(accountId);
    expect(cleanupLog.familyId).toBe(familyId);
    expect(cleanupLog.sessionId).toBe(sessionId);
    expect(cleanupLog.error).toContain("Cleanup network disconnected");
  });

  it("A.8: login endpoint does not issue refresh cookie or credentials when persistence fails", async () => {
    // Failing session store
    const failingStore = {
      createInitialSession: vi.fn().mockRejectedValue(
        new ServiceUnavailableError("Session persistence service temporarily unavailable")
      ),
    } as unknown as RedisSessionStore;

    loginRateLimiter.reset();
    const passwordHash = await hashPassword("Password123!");
    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: accountId,
          email: "amina.rahman@example.com",
          role: "traveler",
          status: "active",
          type: "individual",
          emailVerified: true,
          securityCredentials: {
            passwordHash,
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: null,
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      accountSecurityCredential: {
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (callback: any) => {
        return callback({
          $queryRaw: vi.fn().mockResolvedValue([
            { failed_login_attempts: 0, locked_until: null },
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

    const app = createApp({
      prismaClient: mockPrisma as any,
      sessionStore: failingStore,
      rateLimiter: ((_req: any, _res: any, next: any) => next()) as any,
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "amina.rahman@example.com", password: "Password123!" });

    // Assert 503 Service Unavailable
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");

    // Assert NO Set-Cookie header for refreshToken
    const setCookie = res.headers["set-cookie"];
    if (setCookie) {
      const refreshCookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).find(
        (c: string) => c.startsWith(`${REFRESH_COOKIE_NAME}=`)
      );
      expect(refreshCookie).toBeUndefined();
    }

    // Assert NO accessToken or refreshToken in response body
    expect(res.body.data).toBeUndefined();
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });
});

describe("Account-Session Index Maintenance Failures", () => {
  const familyId = "550e8400-e29b-41d4-a716-446655440001";
  const oldSessionId = "550e8400-e29b-41d4-a716-446655440002";
  const newSessionId = "550e8400-e29b-41d4-a716-446655440003";
  const tokenHash = "c".repeat(64);
  const accountId = "550e8400-e29b-41d4-a716-446655440099";

  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("B.1: SADD error on initial session -> cleans up and fails closed with ServiceUnavailableError", async () => {
    let cleanupExecuted = false;
    let callCount = 0;

    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primary pipeline succeeds
          return createMockPipeline(async () => [
            [null, 1],
            [null, 1],
            [null, 1],
            [null, 1],
            [null, "OK"],
          ]);
        }
        // Cleanup pipeline
        cleanupExecuted = true;
        return createMockPipeline(async () => [
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
        ]);
      }),
      // SADD fails!
      sadd: vi.fn().mockRejectedValue(new Error("SADD cluster slot error")),
    } as any;

    const store = new RedisSessionStore(mockClient);

    await expect(
      store.createInitialSession({ familyId, sessionId: oldSessionId, tokenHash, accountId })
    ).rejects.toThrow(ServiceUnavailableError);

    expect(cleanupExecuted).toBe(true);

    // Verify ACCOUNT_SESSION_INDEX_FAILURE was logged
    const indexLog = consoleErrorSpy.mock.calls
      .map(([arg]: any) => {
        try {
          return JSON.parse(arg);
        } catch {
          return null;
        }
      })
      .find((log: any) => log?.event === "ACCOUNT_SESSION_INDEX_FAILURE");

    expect(indexLog).toBeDefined();
    expect(indexLog.operation).toBe("addAccountSessionIndexOnInitialSession");
    expect(indexLog.accountId).toBe(accountId);
  });

  it("B.2: SREM error in replay revocation is logged but family revocation remains committed", async () => {
    const mockClient = {
      status: "ready",
      eval: vi.fn().mockResolvedValue("REPLAY_CONFIRMED"),
      srem: vi.fn().mockRejectedValue(new Error("SREM timeout")),
    } as any;

    const store = new RedisSessionStore(mockClient);

    const result = await store.revokeFamilyReplay({
      familyId,
      presentedTokenHash: tokenHash,
      expectedActiveTokenHash: tokenHash,
      expectedActiveSessionId: oldSessionId,
      accountId,
    });

    // Revocation status is still REPLAY_CONFIRMED!
    expect(result).toBe("REPLAY_CONFIRMED");

    // Failure was logged
    const indexLog = consoleErrorSpy.mock.calls
      .map(([arg]: any) => {
        try {
          return JSON.parse(arg);
        } catch {
          return null;
        }
      })
      .find((log: any) => log?.event === "ACCOUNT_SESSION_INDEX_FAILURE");

    expect(indexLog).toBeDefined();
    expect(indexLog.operation).toBe("pruneAccountSessionIndexOnReplay");
    expect(indexLog.accountId).toBe(accountId);
  });

  it("B.3: rotation index update where one command succeeds and the other fails -> logs failure but rotation remains committed", async () => {
    // SessionStore mock where updateAccountSessionIndex pipeline fails
    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockReturnValue(
        createMockPipeline(async () => [
          [null, 1], // srem succeeds
          [new Error("SADD slot unavailable"), null], // sadd fails!
        ])
      ),
    } as any;

    const store = new RedisSessionStore(mockClient);

    // updateAccountSessionIndex throws ServiceUnavailableError when pipeline command fails
    await expect(
      store.updateAccountSessionIndex(accountId, familyId, oldSessionId, newSessionId)
    ).rejects.toThrow(ServiceUnavailableError);

    const rawToken = `rt_${familyId}_${"a".repeat(64)}`;
    const presentedTokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Now test sessionService: verify that rotation succeeds and does NOT undo rotation when index fails
    const mockSessionStoreForService = {
      getFamily: vi.fn().mockResolvedValue({
        familyId,
        activeSessionId: oldSessionId,
        activeTokenHash: presentedTokenHash,
        rotationSeq: 1,
        tokenGeneration: 1,
        isCompromised: false,
      }),
      getSession: vi.fn().mockResolvedValue({
        sessionId: oldSessionId,
        familyId,
        accountId,
        tokenHash: presentedTokenHash,
        rotationSeq: 1,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 100000).toISOString(),
      }),
      getTokenLookup: vi.fn().mockResolvedValue({
        familyId,
        sessionId: oldSessionId,
        accountId,
      }),
      rotateSession: vi.fn().mockResolvedValue({
        success: true,
        newRotationSeq: 2,
      }),
      revokeFamilyDirect: vi.fn().mockResolvedValue(undefined),
      revokeFamilyReplay: vi.fn().mockResolvedValue("REPLAY_CONFIRMED"),
      updateAccountSessionIndex: vi.fn().mockRejectedValue(
        new ServiceUnavailableError("Index pipeline failure")
      ),
    } as any;

    const service = new SessionService(mockSessionStoreForService);

    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({
          id: accountId,
          email: "amina.rahman@example.com",
          role: "traveler",
          status: "active",
          type: "individual",
          emailVerified: true,
          securityCredentials: {
            passwordChangedAt: null,
          },
        }),
      },
      accountSecurityCredential: {
        findUnique: vi.fn().mockResolvedValue({
          passwordChangedAt: null,
        }),
      },
    };

    const rotationResult = await service.rotateRefreshSession(
      rawToken,
      { ipAddress: "127.0.0.1" },
      mockPrisma as any
    );

    // Assert rotation succeeded and returned fresh credentials!
    expect(rotationResult.accessToken).toBeDefined();
    expect(rotationResult.newRawRefreshToken).toBeDefined();

    // Assert error was logged
    const indexLog = consoleErrorSpy.mock.calls
      .map(([arg]: any) => {
        try {
          return JSON.parse(arg);
        } catch {
          return null;
        }
      })
      .find((log: any) => log?.event === "ACCOUNT_SESSION_INDEX_FAILURE");

    expect(indexLog).toBeDefined();
    expect(indexLog.operation).toBe("updateAccountSessionIndex");
    expect(indexLog.accountId).toBe(accountId);
  });

  it("B.4: logout cleanup failure is logged without undoing logout", async () => {
    const mockClient = {
      status: "ready",
      eval: vi.fn().mockResolvedValue("LOGOUT_SUCCESS"),
      srem: vi.fn().mockRejectedValue(new Error("SREM disconnect")),
    } as any;

    const store = new RedisSessionStore(mockClient);

    const result = await store.logoutSession({
      familyId,
      expectedActiveSessionId: oldSessionId,
      expectedActiveTokenHash: tokenHash,
      accountId,
    });

    expect(result).toBe("LOGOUT_SUCCESS");

    const indexLog = consoleErrorSpy.mock.calls
      .map(([arg]: any) => {
        try {
          return JSON.parse(arg);
        } catch {
          return null;
        }
      })
      .find((log: any) => log?.event === "ACCOUNT_SESSION_INDEX_FAILURE");

    expect(indexLog).toBeDefined();
    expect(indexLog.operation).toBe("pruneAccountSessionIndexOnLogout");
  });

  it("B.5: direct revocation cleanup failure is logged without undoing direct revocation", async () => {
    const mockClient = {
      status: "ready",
      pipeline: vi.fn().mockReturnValue(
        createMockPipeline(async () => [
          [null, 1], // hset isCompromised
          [null, 1], // expire
          [null, 1], // del session
          [null, 1], // del lookup
        ])
      ),
      srem: vi.fn().mockRejectedValue(new Error("SREM failure")),
    } as any;

    const store = new RedisSessionStore(mockClient);

    await expect(
      store.revokeFamilyDirect(familyId, oldSessionId, tokenHash, accountId)
    ).resolves.toBeUndefined();

    const indexLog = consoleErrorSpy.mock.calls
      .map(([arg]: any) => {
        try {
          return JSON.parse(arg);
        } catch {
          return null;
        }
      })
      .find((log: any) => log?.event === "ACCOUNT_SESSION_INDEX_FAILURE");

    expect(indexLog).toBeDefined();
    expect(indexLog.operation).toBe("pruneAccountSessionIndexOnDirectRevocation");
  });
});

describe("Telemetry Safety & Credential Non-Leakage", () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("C.1: all emitted telemetry logs parse as valid JSON with required structured fields", async () => {
    const mockClient = {
      status: "ready",
      eval: vi.fn().mockResolvedValue("REPLAY_CONFIRMED"),
      srem: vi.fn().mockRejectedValue(new Error("Test failure message")),
    } as any;

    const store = new RedisSessionStore(mockClient);
    await store.revokeFamilyReplay({
      familyId: "550e8400-e29b-41d4-a716-446655440001",
      presentedTokenHash: "a".repeat(64),
      expectedActiveTokenHash: "a".repeat(64),
      expectedActiveSessionId: "550e8400-e29b-41d4-a716-446655440002",
      accountId: "550e8400-e29b-41d4-a716-446655440099",
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    for (const call of consoleErrorSpy.mock.calls) {
      const raw = call[0];
      const parsed = JSON.parse(raw);
      expect(parsed).toHaveProperty("timestamp");
      expect(parsed).toHaveProperty("event");
      expect(parsed).toHaveProperty("operation");
      expect(parsed).toHaveProperty("accountId");
      expect(parsed).toHaveProperty("familyId");
      expect(parsed).toHaveProperty("sessionId");
      expect(parsed).toHaveProperty("error");
    }
  });

  it("C.2: zero raw refresh tokens or cookies appear in telemetry logs", async () => {
    const rawToken = "rt_550e8400-e29b-41d4-a716-446655440001_" + "f".repeat(64);
    const mockClient = {
      status: "ready",
      eval: vi.fn().mockResolvedValue("LOGOUT_SUCCESS"),
      srem: vi.fn().mockRejectedValue(new Error("Connection lost")),
    } as any;

    const store = new RedisSessionStore(mockClient);
    await store.logoutSession({
      familyId: "550e8400-e29b-41d4-a716-446655440001",
      expectedActiveSessionId: "550e8400-e29b-41d4-a716-446655440002",
      expectedActiveTokenHash: "f".repeat(64),
      accountId: "550e8400-e29b-41d4-a716-446655440099",
    });

    for (const call of consoleErrorSpy.mock.calls) {
      const logStr = call.join(" ");
      expect(logStr).not.toContain(rawToken);
      expect(logStr).not.toMatch(/rt_[0-9a-f-]+_[0-9a-f]+/);
      expect(logStr).not.toContain("refreshToken=");
    }
  });

  it("C.3: zero passwords, JWTs, or credential secrets appear in telemetry logs", async () => {
    const secretJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature";
    const password = "SuperSecretPassword123!";

    const mockClient = {
      status: "ready",
      eval: vi.fn().mockResolvedValue("LOGOUT_SUCCESS"),
      srem: vi.fn().mockRejectedValue(new Error("Error occurred")),
    } as any;

    const store = new RedisSessionStore(mockClient);
    await store.logoutSession({
      familyId: "550e8400-e29b-41d4-a716-446655440001",
      expectedActiveSessionId: "550e8400-e29b-41d4-a716-446655440002",
      expectedActiveTokenHash: "a".repeat(64),
      accountId: "550e8400-e29b-41d4-a716-446655440099",
    });

    for (const call of consoleErrorSpy.mock.calls) {
      const logStr = call.join(" ");
      expect(logStr).not.toContain(secretJwt);
      expect(logStr).not.toContain(password);
      expect(logStr).not.toContain("passwordHash");
      expect(logStr).not.toContain("argon2");
    }
  });

  it("C.4: index errors are observable and not silently swallowed", async () => {
    const mockClient = {
      status: "ready",
      eval: vi.fn().mockResolvedValue("REPLAY_CONFIRMED"),
      srem: vi.fn().mockRejectedValue(new Error("Explicit error message")),
    } as any;

    const store = new RedisSessionStore(mockClient);
    await store.revokeFamilyReplay({
      familyId: "550e8400-e29b-41d4-a716-446655440001",
      presentedTokenHash: "a".repeat(64),
      expectedActiveTokenHash: "a".repeat(64),
      expectedActiveSessionId: "550e8400-e29b-41d4-a716-446655440002",
      accountId: "550e8400-e29b-41d4-a716-446655440099",
    });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(parsed.event).toBe("ACCOUNT_SESSION_INDEX_FAILURE");
    expect(parsed.error).toBe("Explicit error message");
  });
});
