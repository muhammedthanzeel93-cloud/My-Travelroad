/**
 * PostgreSQL Database Integration Tests for User Authentication & Login
 * Tests the login service and security credentials against live PostgreSQL.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import net from "net";
import { PrismaClient } from "@prisma/client";
import { PRISMA_LOG_CONFIG } from "../../../src/lib/db";
import { registerTouristAccount } from "../../../src/server/services/registration.service";
import { authenticateLogin } from "../../../src/server/services/login.service";
import { verifyAccessToken } from "../../../src/server/auth/jwt";
import { UnauthorizedError, LockedError, ForbiddenError } from "../../../src/server/errors/app-error";
import { ErrorCode } from "../../../src/server/errors/error-codes";

/**
 * Dedicated PrismaClient instance explicitly bound to the validated test database URL.
 * Guarantees zero target mismatch between safety checks and database operations.
 */
let testPrisma: PrismaClient;

/**
 * Extracts connection parameters dynamically from a database URL.
 * Never exposes raw credentials or the full connection URL in error messages.
 */
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

/**
 * Strict database safety guard enforcing explicit opt-in and rejecting production targets.
 * Fails closed if configuration is ambiguous or missing. Never logs credentials.
 */
function assertTestDatabaseSafety(databaseName: string, host: string): void {
  // 1. Explicit opt-in requirement
  if (process.env.ALLOW_DESTRUCTIVE_DB_TESTS !== "true") {
    throw new Error(
      `\n==============================================================================\n` +
        `TEST DATABASE SAFETY ERROR: Destructive database integration tests are disabled.\n` +
        `To protect development and production data, integration tests require explicit opt-in.\n\n` +
        `To run these tests against an isolated test database:\n` +
        `  1. Set ALLOW_DESTRUCTIVE_DB_TESTS=true\n` +
        `  2. Set TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/mytravelroad_test?schema=public\n` +
        `  3. Run migrations: DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy\n` +
        `==============================================================================\n`
    );
  }

  // 2. Reject production environment
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SAFETY CHECK FAILED: Refusing to run destructive database integration tests when NODE_ENV is 'production'."
    );
  }

  // 3. Reject production database names
  const lowerName = databaseName.toLowerCase();
  if (lowerName.includes("prod") || lowerName.includes("production")) {
    throw new Error(
      `SAFETY CHECK FAILED: Database name '${databaseName}' appears to be a production database. Integration tests require an isolated test database (e.g. 'mytravelroad_test').`
    );
  }

  // 4. Reject production host targets
  const lowerHost = host.toLowerCase();
  if (lowerHost.includes("prod") || lowerHost.includes("production")) {
    throw new Error(
      `SAFETY CHECK FAILED: Host '${host}' appears to be a production server. Integration tests must run against an isolated local or test container instance.`
    );
  }
}

/**
 * Probes socket reachability with a strict timeout to prevent worker pool hangs.
 */
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

describe("PostgreSQL Integration: User Authentication & Login", () => {
  const createdAccountIds = new Set<string>();
  const createdEmails = new Set<string>();

  beforeAll(async () => {
    // Prefer dedicated TEST_DATABASE_URL, falling back to DATABASE_URL
    const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    const { host, port, database } = parseDatabaseConfig(databaseUrl);
    assertTestDatabaseSafety(database, host);

    const reachable = await isPortReachable(port, host, 1000);
    if (!reachable) {
      throw new Error(
        `\n==============================================================================\n` +
          `POSTGRESQL CONNECTION ERROR: Cannot reach PostgreSQL at ${host}:${port}.\n` +
          `The login database integration suite requires a running PostgreSQL instance.\n\n` +
          `How to configure and start the test database:\n` +
          `  1. Ensure PostgreSQL is running (e.g. Docker:\n` +
          `     docker run --name mytravelroad-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgis/postgis:15-3.3)\n` +
          `  2. Set ALLOW_DESTRUCTIVE_DB_TESTS=true in your environment\n` +
          `  3. Set TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mytravelroad?schema=public\n` +
          `  4. Apply database migrations: npx prisma migrate deploy\n` +
          `==============================================================================\n`
      );
    }

    // Initialize dedicated PrismaClient explicitly configured with the validated test database URL
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: PRISMA_LOG_CONFIG,
    });

    // Query active database identity to mathematically confirm the Prisma client matches the validated test target
    try {
      const identityResult = await testPrisma.$queryRaw<Array<{ current_database: string }>>`
        SELECT current_database();
      `;
      const effectiveDatabase = identityResult[0]?.current_database;
      if (effectiveDatabase !== database) {
        throw new Error(
          `SAFETY CHECK FAILED: Effective database identity '${effectiveDatabase}' does not match expected test database '${database}'. Aborting.`
        );
      }
    } catch (err) {
      await testPrisma.$disconnect();
      throw new Error(
        `POSTGRESQL HEALTH/IDENTITY CHECK FAILED: Connected to port ${port} on ${host}, but database validation query failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });

  afterEach(async () => {
    if (createdAccountIds.size > 0 || createdEmails.size > 0) {
      const ids = Array.from(createdAccountIds);
      const emails = Array.from(createdEmails);
      try {
        await testPrisma.account.deleteMany({
          where: {
            OR: [{ id: { in: ids } }, { email: { in: emails } }],
          },
        });
        createdAccountIds.clear();
        createdEmails.clear();
      } catch (err) {
        console.error("Cleanup error in afterEach:", err);
        throw err;
      }
    }
  });

  afterAll(async () => {
    try {
      if (testPrisma && (createdAccountIds.size > 0 || createdEmails.size > 0)) {
        const ids = Array.from(createdAccountIds);
        const emails = Array.from(createdEmails);
        await testPrisma.account.deleteMany({
          where: {
            OR: [{ id: { in: ids } }, { email: { in: emails } }],
          },
        });
        createdAccountIds.clear();
        createdEmails.clear();
      }
    } finally {
      if (testPrisma) {
        await testPrisma.$disconnect();
      }
    }
  });

  it("authenticates a real tourist account in PostgreSQL, updates lastLoginAt, and returns valid JWT", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_login_user_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_login_${uniqueSuffix}`;
    createdEmails.add(email);

    // 1. Create account via registration service
    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "PostgreSQL Login User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    // Update account to active & emailVerified: true to test full active flow
    await testPrisma.account.update({
      where: { id: regResult.account.id },
      data: {
        status: "active",
        emailVerified: true,
      },
    });

    // 2. Execute login service
    const loginResult = await authenticateLogin(
      {
        email,
        password,
      },
      testPrisma
    );

    // 3. Verify response DTO
    expect(loginResult.accessToken).toBeDefined();
    expect(loginResult.tokenType).toBe("Bearer");
    expect(loginResult.expiresIn).toBe(900);
    expect(loginResult.account).toEqual({
      id: regResult.account.id,
      email,
      role: "traveler",
      status: "active",
      emailVerified: true,
    });

    // 4. Verify token claims
    const claims = await verifyAccessToken(loginResult.accessToken);
    expect(claims.sub).toBe(regResult.account.id);
    expect(claims.email).toBe(email);
    expect(claims.role).toBe("traveler");
    expect(claims.status).toBe("active");
    expect(claims.emailVerified).toBe(true);

    // 5. Verify PostgreSQL database state: lastLoginAt updated, failedLoginAttempts is 0
    const dbAccount = await testPrisma.account.findUnique({
      where: { id: regResult.account.id },
      include: { securityCredentials: true },
    });
    expect(dbAccount?.lastLoginAt).not.toBeNull();
    expect(dbAccount?.securityCredentials?.failedLoginAttempts).toBe(0);
    expect(dbAccount?.securityCredentials?.lockedUntil).toBeNull();
  });

  it("authenticates pending_verification account returning emailVerified: false", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_pending_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_pend_${uniqueSuffix}`;
    createdEmails.add(email);

    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Pending User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    const loginResult = await authenticateLogin(
      {
        email,
        password,
      },
      testPrisma
    );

    expect(loginResult.account.status).toBe("pending_verification");
    expect(loginResult.account.emailVerified).toBe(false);

    const claims = await verifyAccessToken(loginResult.accessToken);
    expect(claims.emailVerified).toBe(false);
    expect(claims.status).toBe("pending_verification");
  });

  it("increments failedLoginAttempts in PostgreSQL on incorrect password", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_failed_pw_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_fail_${uniqueSuffix}`;
    createdEmails.add(email);

    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Failed PW User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    // Attempt login with wrong password
    let error: unknown = null;
    try {
      await authenticateLogin(
        {
          email,
          password: "WrongPassword999!",
        },
        testPrisma
      );
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).code).toBe(ErrorCode.INVALID_CREDENTIALS);

    // Confirm failedLoginAttempts was incremented in PostgreSQL
    const cred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    expect(cred?.failedLoginAttempts).toBe(1);
    expect(cred?.lockedUntil).toBeNull();
  });

  it("locks account in PostgreSQL after 5 consecutive failed attempts and rejects with 423 ACCOUNT_LOCKED", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_lockout_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_lock_${uniqueSuffix}`;
    createdEmails.add(email);

    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Lockout User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    // 1. Fail 4 times
    for (let i = 1; i <= 4; i++) {
      try {
        await authenticateLogin(
          { email, password: "WrongPassword!" },
          testPrisma
        );
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
      const cred = await testPrisma.accountSecurityCredential.findUnique({
        where: { accountId: regResult.account.id },
      });
      expect(cred?.failedLoginAttempts).toBe(i);
      expect(cred?.lockedUntil).toBeNull();
    }

    // 2. 5th failure triggers 15-minute lock in PostgreSQL
    const before5th = Date.now();
    try {
      await authenticateLogin(
        { email, password: "WrongPassword!" },
        testPrisma
      );
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError);
    }

    const lockedCred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    expect(lockedCred?.failedLoginAttempts).toBe(5);
    expect(lockedCred?.lockedUntil).not.toBeNull();
    const lockDurationMs = lockedCred!.lockedUntil!.getTime() - before5th;
    expect(lockDurationMs).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);

    // 3. 6th attempt (even with CORRECT password) is rejected with 423 ACCOUNT_LOCKED
    let lockedError: unknown = null;
    try {
      await authenticateLogin(
        { email, password },
        testPrisma
      );
    } catch (err) {
      lockedError = err;
    }

    expect(lockedError).toBeInstanceOf(LockedError);
    expect((lockedError as LockedError).code).toBe(ErrorCode.ACCOUNT_LOCKED);
    expect((lockedError as LockedError).statusCode).toBe(423);
  });

  it("resets failedLoginAttempts counter in PostgreSQL after successful login", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_reset_counter_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_res_${uniqueSuffix}`;
    createdEmails.add(email);

    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Reset Counter User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    // 1. Fail twice
    for (let i = 0; i < 2; i++) {
      try {
        await authenticateLogin(
          { email, password: "WrongPassword!" },
          testPrisma
        );
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
      }
    }

    let cred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    expect(cred?.failedLoginAttempts).toBe(2);

    // 2. Succeed with correct password
    const loginResult = await authenticateLogin(
      { email, password },
      testPrisma
    );
    expect(loginResult.accessToken).toBeDefined();

    // 3. Confirm counter is reset to 0 in PostgreSQL
    cred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    expect(cred?.failedLoginAttempts).toBe(0);
    expect(cred?.lockedUntil).toBeNull();
  });

  // ============================================================================
  // Concurrency & Row-Level Locking Verification
  // ============================================================================

  it("handles concurrent failed logins starting from known counter without lost updates", async () => {
    const uniqueSuffix = `concurrent_lost_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_conc_lost_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_c_lost_${uniqueSuffix.slice(-20)}`;
    createdEmails.add(email);

    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Concurrent Lost Updates User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    // Initial state: 0 failed attempts, unlocked
    let cred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    expect(cred?.failedLoginAttempts).toBe(0);
    expect(cred?.lockedUntil).toBeNull();

    // Fire 4 concurrent failed login attempts with wrong password
    const results = await Promise.allSettled([
      authenticateLogin({ email, password: "WrongPassword1" }, testPrisma),
      authenticateLogin({ email, password: "WrongPassword2" }, testPrisma),
      authenticateLogin({ email, password: "WrongPassword3" }, testPrisma),
      authenticateLogin({ email, password: "WrongPassword4" }, testPrisma),
    ]);

    // All 4 attempts must be rejected with 401 INVALID_CREDENTIALS
    for (const res of results) {
      expect(res.status).toBe("rejected");
      if (res.status === "rejected") {
        expect(res.reason).toBeInstanceOf(UnauthorizedError);
        expect((res.reason as UnauthorizedError).code).toBe(ErrorCode.INVALID_CREDENTIALS);
      }
    }

    // Authoritative check against PostgreSQL: all 4 increments MUST be accounted for (zero lost updates)
    cred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    expect(cred?.failedLoginAttempts).toBe(4);
    expect(cred?.lockedUntil).toBeNull();
  });

  it("enforces lockout threshold under concurrent failed logins producing a 15-minute lock", async () => {
    const uniqueSuffix = `concurrent_lock_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_conc_lock_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_c_lock_${uniqueSuffix.slice(-20)}`;
    createdEmails.add(email);

    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Concurrent Lockout User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    // Pre-set failed attempts to 3
    await testPrisma.accountSecurityCredential.update({
      where: { accountId: regResult.account.id },
      data: { failedLoginAttempts: 3 },
    });

    const beforeAttempts = Date.now();

    // Fire 3 concurrent failed login attempts (reaching 5 threshold)
    const results = await Promise.allSettled([
      authenticateLogin({ email, password: "WrongPasswordA" }, testPrisma),
      authenticateLogin({ email, password: "WrongPasswordB" }, testPrisma),
      authenticateLogin({ email, password: "WrongPasswordC" }, testPrisma),
    ]);

    // All 3 attempts rejected with UnauthorizedError
    for (const res of results) {
      expect(res.status).toBe("rejected");
      if (res.status === "rejected") {
        expect(res.reason).toBeInstanceOf(UnauthorizedError);
      }
    }

    // Verify PostgreSQL state: threshold capped at 5 and 15-minute lock established
    const cred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    expect(cred?.failedLoginAttempts).toBe(5);
    expect(cred?.lockedUntil).not.toBeNull();

    const lockDurationMs = cred!.lockedUntil!.getTime() - beforeAttempts;
    expect(lockDurationMs).toBeGreaterThanOrEqual(15 * 60 * 1000 - 2000);
    expect(lockDurationMs).toBeLessThanOrEqual(15 * 60 * 1000 + 10000);
  });

  it("rejects login attempts with 423 ACCOUNT_LOCKED after lock is established without modifying counter or lock duration", async () => {
    const uniqueSuffix = `post_lock_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_post_lock_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_p_lock_${uniqueSuffix.slice(-20)}`;
    createdEmails.add(email);

    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Post Lockout User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    const establishedLockedUntil = new Date(Date.now() + 14 * 60 * 1000);
    await testPrisma.accountSecurityCredential.update({
      where: { accountId: regResult.account.id },
      data: {
        failedLoginAttempts: 5,
        lockedUntil: establishedLockedUntil,
      },
    });

    // Attempt login with incorrect password
    let wrongPwError: unknown;
    try {
      await authenticateLogin({ email, password: "WrongPassword!" }, testPrisma);
    } catch (err) {
      wrongPwError = err;
    }
    expect(wrongPwError).toBeInstanceOf(LockedError);
    expect((wrongPwError as LockedError).statusCode).toBe(423);
    expect((wrongPwError as LockedError).code).toBe(ErrorCode.ACCOUNT_LOCKED);

    // Attempt login with correct password
    let correctPwError: unknown;
    try {
      await authenticateLogin({ email, password }, testPrisma);
    } catch (err) {
      correctPwError = err;
    }
    expect(correctPwError).toBeInstanceOf(LockedError);
    expect((correctPwError as LockedError).statusCode).toBe(423);
    expect((correctPwError as LockedError).code).toBe(ErrorCode.ACCOUNT_LOCKED);

    // Query database: state MUST NOT have been mutated
    const cred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    expect(cred?.failedLoginAttempts).toBe(5);
    expect(cred?.lockedUntil?.getTime()).toBe(establishedLockedUntil.getTime());
  });

  it("starts a new failure cycle on expired lock with concurrent failures without lost updates", async () => {
    const uniqueSuffix = `expired_lock_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_exp_lock_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_e_lock_${uniqueSuffix.slice(-20)}`;
    createdEmails.add(email);

    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Expired Lockout User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    // Set lock expired 2 minutes ago with 5 failed attempts
    const expiredTime = new Date(Date.now() - 2 * 60 * 1000);
    await testPrisma.accountSecurityCredential.update({
      where: { accountId: regResult.account.id },
      data: {
        failedLoginAttempts: 5,
        lockedUntil: expiredTime,
      },
    });

    // Concurrently execute 3 failed login attempts
    const results = await Promise.allSettled([
      authenticateLogin({ email, password: "WrongPassword1" }, testPrisma),
      authenticateLogin({ email, password: "WrongPassword2" }, testPrisma),
      authenticateLogin({ email, password: "WrongPassword3" }, testPrisma),
    ]);

    for (const res of results) {
      expect(res.status).toBe("rejected");
      if (res.status === "rejected") {
        expect(res.reason).toBeInstanceOf(UnauthorizedError);
      }
    }

    // Verify PostgreSQL state: expired lock was cleared, and 3 failed attempts counted cleanly
    const cred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    expect(cred?.failedLoginAttempts).toBe(3);
    expect(cred?.lockedUntil).toBeNull();
  });

  it("maintains consistent database state when successful login races with concurrent failed attempts", async () => {
    const uniqueSuffix = `race_success_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_race_${uniqueSuffix}@example.com`;
    const password = "ValidPassword123!";
    const handle = `pg_race_${uniqueSuffix.slice(-20)}`;
    createdEmails.add(email);

    const regResult = await registerTouristAccount(
      {
        email,
        password,
        displayName: "Race Success User",
        handle,
        preferredLanguage: "en",
      },
      testPrisma
    );
    createdAccountIds.add(regResult.account.id);

    // Set 3 failed attempts
    await testPrisma.accountSecurityCredential.update({
      where: { accountId: regResult.account.id },
      data: { failedLoginAttempts: 3 },
    });

    // Concurrently execute 1 legitimate login and 2 failed logins
    const results = await Promise.allSettled([
      authenticateLogin({ email, password }, testPrisma),
      authenticateLogin({ email, password: "WrongPassword1" }, testPrisma),
      authenticateLogin({ email, password: "WrongPassword2" }, testPrisma),
    ]);

    // Inspect PostgreSQL database state to verify consistency invariants
    const cred = await testPrisma.accountSecurityCredential.findUnique({
      where: { accountId: regResult.account.id },
    });
    const account = await testPrisma.account.findUnique({
      where: { id: regResult.account.id },
    });

    const successResult = results[0];
    if (successResult.status === "fulfilled") {
      // Valid login succeeded: token issued
      expect(successResult.value.accessToken).toBeDefined();
      expect(account?.lastLoginAt).not.toBeNull();

      // Because the success reset attempts to 0, subsequent failed attempts in the batch
      // incremented from 0. State is unlocked and attempts is 1 or 2.
      expect(cred?.lockedUntil).toBeNull();
      expect(cred?.failedLoginAttempts).toBeGreaterThanOrEqual(0);
      expect(cred?.failedLoginAttempts).toBeLessThanOrEqual(2);
    } else {
      // Valid login was rejected: the 2 failed attempts must have locked the account first!
      expect(successResult.reason).toBeInstanceOf(LockedError);
      expect(cred?.failedLoginAttempts).toBe(5);
      expect(cred?.lockedUntil).not.toBeNull();
    }

    // Invariant: Failed attempts must never exceed 5
    expect(cred!.failedLoginAttempts).toBeLessThanOrEqual(5);
    // Invariant: If locked, attempts must be 5
    if (cred!.lockedUntil !== null) {
      expect(cred!.failedLoginAttempts).toBe(5);
    }
  });
});
