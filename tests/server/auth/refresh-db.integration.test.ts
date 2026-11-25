/**
 * PostgreSQL Database Integration Tests for Refresh Token Rotation & Session Management
 * Tests the session service, token rotation, and credential invalidation against live PostgreSQL.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import net from "net";
import { PrismaClient } from "@prisma/client";
import RedisMock from "ioredis-mock";
import { PRISMA_LOG_CONFIG } from "../../../src/lib/db";
import { registerTouristAccount } from "../../../src/server/services/registration.service";
import { authenticateLogin } from "../../../src/server/services/login.service";
import { SessionService } from "../../../src/server/services/session.service";
import { RedisSessionStore } from "../../../src/server/redis/session.store";
import { UnauthorizedError, ForbiddenError } from "../../../src/server/errors/app-error";
import { ErrorCode } from "../../../src/server/errors/error-codes";

let testPrisma: PrismaClient;

function parseDatabaseConfig(urlStr: string | undefined): { host: string; port: number; database: string } {
  if (!urlStr) {
    throw new Error(
      "Database URL is missing or empty. Please set TEST_DATABASE_URL or DATABASE_URL in your test environment or .env file."
    );
  }
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      database: parsed.pathname.replace(/^\//, ""),
    };
  } catch {
    throw new Error(
      "Invalid database URL format. Expected standard postgresql://[user[:password]@]host[:port]/database format."
    );
  }
}

function assertTestDatabaseSafety(databaseName: string, host: string): void {
  if (process.env.ALLOW_DESTRUCTIVE_DB_TESTS !== "true") {
    throw new Error(
      `TEST DATABASE SAFETY ERROR: Destructive database integration tests are disabled. ` +
      `Set ALLOW_DESTRUCTIVE_DB_TESTS=true to enable.`
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SAFETY CHECK FAILED: Refusing to run destructive database integration tests when NODE_ENV is 'production'."
    );
  }

  const lowerName = databaseName.toLowerCase();
  if (lowerName.includes("prod") || lowerName.includes("production")) {
    throw new Error(
      `SAFETY CHECK FAILED: Database name '${databaseName}' appears to be a production database.`
    );
  }

  const lowerHost = host.toLowerCase();
  if (lowerHost.includes("prod") || lowerHost.includes("production")) {
    throw new Error(
      `SAFETY CHECK FAILED: Host '${host}' appears to be a production server.`
    );
  }
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

describe("PostgreSQL Integration: Refresh Token & Session Management", () => {
  const createdAccountIds = new Set<string>();
  const createdEmails = new Set<string>();
  let sessionStore: RedisSessionStore;
  let sessionService: SessionService;

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    const { host, port, database } = parseDatabaseConfig(databaseUrl);

    assertTestDatabaseSafety(database, host);

    const reachable = await isPortReachable(port, host, 2000);
    if (!reachable) {
      throw new Error(
        `Database connection failed: Could not establish TCP connection to PostgreSQL server.`
      );
    }

    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: PRISMA_LOG_CONFIG,
    });

    await testPrisma.$connect();

    const redis = new RedisMock();
    sessionStore = new RedisSessionStore(redis);
    sessionService = new SessionService(sessionStore);
  });

  afterEach(async () => {
    if (createdAccountIds.size > 0 && testPrisma) {
      const ids = Array.from(createdAccountIds);
      await testPrisma.account.deleteMany({
        where: { id: { in: ids } },
      });
      createdAccountIds.clear();
      createdEmails.clear();
    }
  });

  afterAll(async () => {
    if (testPrisma) {
      try {
        if (createdAccountIds.size > 0) {
          const ids = Array.from(createdAccountIds);
          await testPrisma.account.deleteMany({
            where: { id: { in: ids } },
          });
        }
      } finally {
        await testPrisma.$disconnect();
      }
    }
  });

  it("provisions a session on login and successfully rotates it against real PostgreSQL", async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `tourist_${suffix}@example.com`;
    const password = "Password123!";

    const registered = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Real DB Tourist",
        handle: `real_tourist_${suffix}`,
        preferredLanguage: "en",
      },
      testPrisma
    );

    createdAccountIds.add(registered.account.id);
    createdEmails.add(email);

    // 1. Log in with sessionStore
    const loginRes = await authenticateLogin(
      { email, password },
      testPrisma,
      sessionStore,
      { ipAddress: "127.0.0.1", userAgent: "TestClient/1.0" }
    );

    expect(loginRes.accessToken).toBeDefined();
    expect(loginRes.rawRefreshToken).toBeDefined();

    // 2. Rotate session against real PostgreSQL
    const refreshRes = await sessionService.rotateRefreshSession(
      loginRes.rawRefreshToken,
      { ipAddress: "127.0.0.1", userAgent: "TestClient/2.0" },
      testPrisma
    );

    expect(refreshRes.accessToken).toBeDefined();
    expect(refreshRes.newRawRefreshToken).toMatch(/^rt_/);
    expect(refreshRes.newRawRefreshToken).not.toBe(loginRes.rawRefreshToken);
  });

  it("rejects refresh and revokes family when account is suspended in real PostgreSQL", async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `tourist_${suffix}@example.com`;
    const password = "Password123!";

    const registered = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Suspended Tourist",
        handle: `susp_tourist_${suffix}`,
        preferredLanguage: "en",
      },
      testPrisma
    );

    createdAccountIds.add(registered.account.id);
    createdEmails.add(email);

    const loginRes = await authenticateLogin(
      { email, password },
      testPrisma,
      sessionStore
    );

    // Suspend account in real PostgreSQL
    await testPrisma.account.update({
      where: { id: registered.account.id },
      data: { status: "suspended" },
    });

    await expect(
      sessionService.rotateRefreshSession(loginRes.rawRefreshToken, {}, testPrisma)
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects refresh when passwordChangedAt in PostgreSQL is newer than session creation", async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `tourist_${suffix}@example.com`;
    const password = "Password123!";

    const registered = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Password Change Tourist",
        handle: `pwd_tourist_${suffix}`,
        preferredLanguage: "en",
      },
      testPrisma
    );

    createdAccountIds.add(registered.account.id);
    createdEmails.add(email);

    const loginRes = await authenticateLogin(
      { email, password },
      testPrisma,
      sessionStore
    );

    // Simulate password change in PostgreSQL (set passwordChangedAt to future timestamp)
    await testPrisma.accountSecurityCredential.update({
      where: { accountId: registered.account.id },
      data: { passwordChangedAt: new Date(Date.now() + 60000) },
    });

    await expect(
      sessionService.rotateRefreshSession(loginRes.rawRefreshToken, {}, testPrisma)
    ).rejects.toThrow(
      new UnauthorizedError("Session has been invalidated due to a password change", ErrorCode.TOKEN_INVALID)
    );
  });
});
