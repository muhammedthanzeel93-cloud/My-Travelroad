/**
 * PostgreSQL Database Integration Tests for Tourist Account Registration
 * Tests the registration service and database transaction boundaries against live PostgreSQL.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import net from "net";
import { prisma, checkDatabaseHealth } from "../../../src/lib/db";
import { registerTouristAccount } from "../../../src/server/services/registration.service";
import { verifyPassword } from "../../../src/server/auth/password";
import { ConflictError } from "../../../src/server/errors/app-error";
import { ErrorCode } from "../../../src/server/errors/error-codes";

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

describe("PostgreSQL Integration: Tourist Account Registration", () => {
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
          `The tourist registration database integration suite requires a running PostgreSQL instance.\n\n` +
          `How to configure and start the test database:\n` +
          `  1. Ensure PostgreSQL is running (e.g. Docker:\n` +
          `     docker run --name mytravelroad-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgis/postgis:15-3.3)\n` +
          `  2. Set ALLOW_DESTRUCTIVE_DB_TESTS=true in your environment\n` +
          `  3. Set TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mytravelroad?schema=public\n` +
          `  4. Apply database migrations: npx prisma migrate deploy\n` +
          `==============================================================================\n`
      );
    }

    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      throw new Error(
        `\n==============================================================================\n` +
          `POSTGRESQL HEALTH CHECK FAILED: Connected to port ${port} on ${host}, but 'SELECT 1' failed.\n` +
          `Please ensure database '${database}' exists and migrations have been applied.\n` +
          `==============================================================================\n`
      );
    }
  });

  afterEach(async () => {
    if (createdAccountIds.size > 0 || createdEmails.size > 0) {
      const ids = Array.from(createdAccountIds);
      const emails = Array.from(createdEmails);
      try {
        await prisma.account.deleteMany({
          where: {
            OR: [{ id: { in: ids } }, { email: { in: emails } }],
          },
        });
        // Clear tracked sets ONLY after successful deletion
        createdAccountIds.clear();
        createdEmails.clear();
      } catch (err) {
        // Do not clear the sets if deletion fails so identifiers remain available for diagnosis or afterAll
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `CLEANUP FAILURE: Failed to delete test accounts (${ids.length} IDs, ${emails.length} emails): ${msg}`
        );
      }
    }
  });

  afterAll(async () => {
    try {
      if (createdAccountIds.size > 0 || createdEmails.size > 0) {
        const ids = Array.from(createdAccountIds);
        const emails = Array.from(createdEmails);
        await prisma.account.deleteMany({
          where: {
            OR: [{ id: { in: ids } }, { email: { in: emails } }],
          },
        });
        createdAccountIds.clear();
        createdEmails.clear();
      }
    } catch (err) {
      console.error("Warning: afterAll final sweep cleanup encountered an error:", err);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("successfully creates all three records (Account, SecurityCredential, TouristProfile) in PostgreSQL", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_success_${uniqueSuffix}@example.com`;
    const handle = `pg_succ_${uniqueSuffix}`;
    const password = "ValidPassword123!";
    createdEmails.add(email);

    const result = await registerTouristAccount(
      {
        email,
        password,
        displayName: "PostgreSQL Integration User",
        handle,
        preferredLanguage: "en",
      },
      prisma
    );

    expect(result.account.id).toBeDefined();
    createdAccountIds.add(result.account.id);

    // 1. Verify Account record in PostgreSQL
    const dbAccount = await prisma.account.findUnique({
      where: { id: result.account.id },
    });
    expect(dbAccount).not.toBeNull();
    expect(dbAccount?.email).toBe(email);
    expect(dbAccount?.type).toBe("individual");
    expect(dbAccount?.role).toBe("traveler");
    expect(dbAccount?.status).toBe("pending_verification");
    expect(dbAccount?.emailVerified).toBe(false);
    expect(dbAccount?.phoneVerified).toBe(false);

    // 2. Verify AccountSecurityCredential record in PostgreSQL
    const dbCredentials = await prisma.accountSecurityCredential.findUnique({
      where: { accountId: result.account.id },
    });
    expect(dbCredentials).not.toBeNull();
    expect(dbCredentials?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(dbCredentials?.mfaEnabled).toBe(false);
    expect(dbCredentials?.failedLoginAttempts).toBe(0);
    expect(await verifyPassword(password, dbCredentials!.passwordHash!)).toBe(true);

    // 3. Verify TouristProfile record in PostgreSQL
    const dbProfile = await prisma.touristProfile.findUnique({
      where: { accountId: result.account.id },
    });
    expect(dbProfile).not.toBeNull();
    expect(dbProfile?.displayName).toBe("PostgreSQL Integration User");
    expect(dbProfile?.handle).toBe(handle);
    expect(dbProfile?.preferredLanguage).toBe("en");
    expect(dbProfile?.travelPreferences).toEqual([]);
    expect(dbProfile?.isPublic).toBe(true);
  });

  it("rolls back the entire transaction if profile creation fails, leaving no orphaned account or credentials", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_rollback_${uniqueSuffix}@example.com`;
    const handle = `pg_rb_fail_${uniqueSuffix}`;
    createdEmails.add(email);

    // Setup: Create isolated failure function independently (not batched)
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION fn_test_isolated_fail_profile()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.handle LIKE 'pg_rb_fail_%' THEN
          RAISE EXCEPTION 'TEST_INDUCED_PROFILE_INSERT_FAILURE';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Setup: Ensure any previous trigger is dropped independently
    await prisma.$executeRawUnsafe(
      "DROP TRIGGER IF EXISTS trg_test_isolated_fail_profile ON tourist_profiles;"
    );

    // Setup: Create scoped trigger with row-level WHEN filter independently
    // This ensures only rows with handle matching 'pg_rb_fail_%' are intercepted, preventing global disruption
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_test_isolated_fail_profile
      BEFORE INSERT ON tourist_profiles
      FOR EACH ROW
      WHEN (NEW.handle LIKE 'pg_rb_fail_%')
      EXECUTE FUNCTION fn_test_isolated_fail_profile();
    `);

    try {
      let caughtError: unknown = null;
      try {
        await registerTouristAccount(
          {
            email,
            password: "ValidPassword123!",
            displayName: "Rollback User",
            handle,
            preferredLanguage: "en",
          },
          prisma
        );
      } catch (err) {
        caughtError = err;
      }

      // Must reject due to the induced database layer failure
      expect(caughtError).not.toBeNull();

      // Verify that NO records were committed in PostgreSQL (atomic transaction rollback)
      const orphanedAccount = await prisma.account.findUnique({
        where: { email },
      });
      expect(orphanedAccount).toBeNull();

      const orphanedCredential = await prisma.accountSecurityCredential.findFirst({
        where: { account: { email } },
      });
      expect(orphanedCredential).toBeNull();

      const orphanedProfile = await prisma.touristProfile.findFirst({
        where: { handle },
      });
      expect(orphanedProfile).toBeNull();
    } finally {
      // Safe teardown: Drop trigger and function independently with defensive error handling
      try {
        await prisma.$executeRawUnsafe(
          "DROP TRIGGER IF EXISTS trg_test_isolated_fail_profile ON tourist_profiles;"
        );
      } catch (err) {
        console.error("Warning: Failed to drop test trigger trg_test_isolated_fail_profile:", err);
      }
      try {
        await prisma.$executeRawUnsafe(
          "DROP FUNCTION IF EXISTS fn_test_isolated_fail_profile();"
        );
      } catch (err) {
        console.error("Warning: Failed to drop test function fn_test_isolated_fail_profile:", err);
      }
    }
  });

  it("enforces PostgreSQL duplicate email constraint (uq_accounts_email) and returns 409 DUPLICATE_RESOURCE", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const sharedEmail = `pg_dup_email_${uniqueSuffix}@example.com`;
    createdEmails.add(sharedEmail);

    // 1. First registration succeeds
    const firstRes = await registerTouristAccount(
      {
        email: sharedEmail,
        password: "ValidPassword123!",
        displayName: "First User",
        handle: `user_one_${uniqueSuffix}`,
        preferredLanguage: "en",
      },
      prisma
    );
    createdAccountIds.add(firstRes.account.id);

    // 2. Second registration with the same email must be rejected by PostgreSQL constraint
    let conflictError: ConflictError | null = null;
    try {
      await registerTouristAccount(
        {
          email: sharedEmail,
          password: "ValidPassword123!",
          displayName: "Second User",
          handle: `user_two_${uniqueSuffix}`,
          preferredLanguage: "en",
        },
        prisma
      );
    } catch (err) {
      if (err instanceof ConflictError) {
        conflictError = err;
      }
    }

    expect(conflictError).not.toBeNull();
    expect(conflictError?.statusCode).toBe(409);
    expect(conflictError?.code).toBe(ErrorCode.DUPLICATE_RESOURCE);
    expect(conflictError?.message).toBe("An account with the provided email or handle already exists.");

    // Confirm PostgreSQL only has exactly 1 account with this email
    const count = await prisma.account.count({
      where: { email: sharedEmail },
    });
    expect(count).toBe(1);
  });

  it("enforces PostgreSQL duplicate handle constraint (uq_profiles_handle) and returns 409 DUPLICATE_RESOURCE", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const sharedHandle = `pg_dup_handle_${uniqueSuffix}`;
    const emailOne = `pg_handle_one_${uniqueSuffix}@example.com`;
    const emailTwo = `pg_handle_two_${uniqueSuffix}@example.com`;
    createdEmails.add(emailOne);
    createdEmails.add(emailTwo);

    // 1. First registration succeeds
    const firstRes = await registerTouristAccount(
      {
        email: emailOne,
        password: "ValidPassword123!",
        displayName: "First User",
        handle: sharedHandle,
        preferredLanguage: "en",
      },
      prisma
    );
    createdAccountIds.add(firstRes.account.id);

    // 2. Second registration with the same handle must be rejected by PostgreSQL
    let conflictError: ConflictError | null = null;
    try {
      await registerTouristAccount(
        {
          email: emailTwo,
          password: "ValidPassword123!",
          displayName: "Second User",
          handle: sharedHandle,
          preferredLanguage: "en",
        },
        prisma
      );
    } catch (err) {
      if (err instanceof ConflictError) {
        conflictError = err;
      }
    }

    expect(conflictError).not.toBeNull();
    expect(conflictError?.statusCode).toBe(409);
    expect(conflictError?.code).toBe(ErrorCode.DUPLICATE_RESOURCE);
    expect(conflictError?.message).toBe("An account with the provided email or handle already exists.");

    // Confirm PostgreSQL only has exactly 1 profile with this handle
    const count = await prisma.touristProfile.count({
      where: { handle: sharedHandle },
    });
    expect(count).toBe(1);
  });

  it("handles two concurrent registration attempts with identical email: exactly one succeeds and one returns 409", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const sharedEmail = `pg_concurrent_email_${uniqueSuffix}@example.com`;
    createdEmails.add(sharedEmail);

    const payloadA = {
      email: sharedEmail,
      password: "PasswordA123!",
      displayName: "Concurrent User A",
      handle: `conc_a_${uniqueSuffix}`,
      preferredLanguage: "en" as const,
    };

    const payloadB = {
      email: sharedEmail,
      password: "PasswordB123!",
      displayName: "Concurrent User B",
      handle: `conc_b_${uniqueSuffix}`,
      preferredLanguage: "en" as const,
    };

    // Fire both registration requests concurrently into PostgreSQL
    const [resultA, resultB] = await Promise.allSettled([
      registerTouristAccount(payloadA, prisma),
      registerTouristAccount(payloadB, prisma),
    ]);

    const successes = [resultA, resultB].filter((r) => r.status === "fulfilled");
    const rejections = [resultA, resultB].filter((r) => r.status === "rejected");

    // Exactly one should succeed, and one should fail
    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);

    // Track successful account for cleanup
    const fulfilledResult = successes[0] as PromiseFulfilledResult<any>;
    createdAccountIds.add(fulfilledResult.value.account.id);

    // Verify rejection error is 409 DUPLICATE_RESOURCE
    const rejectedResult = rejections[0] as PromiseRejectedResult;
    expect(rejectedResult.reason).toBeInstanceOf(ConflictError);
    expect(rejectedResult.reason.statusCode).toBe(409);
    expect(rejectedResult.reason.code).toBe(ErrorCode.DUPLICATE_RESOURCE);

    // Confirm only 1 account exists in PostgreSQL
    const accountCount = await prisma.account.count({
      where: { email: sharedEmail },
    });
    expect(accountCount).toBe(1);
  });

  it("handles two concurrent registration attempts with identical handle: exactly one succeeds and one returns 409", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const sharedHandle = `pg_conc_hnd_${uniqueSuffix}`;
    const emailA = `conc_user_a_${uniqueSuffix}@example.com`;
    const emailB = `conc_user_b_${uniqueSuffix}@example.com`;
    createdEmails.add(emailA);
    createdEmails.add(emailB);

    const payloadA = {
      email: emailA,
      password: "PasswordA123!",
      displayName: "Concurrent User A",
      handle: sharedHandle,
      preferredLanguage: "en" as const,
    };

    const payloadB = {
      email: emailB,
      password: "PasswordB123!",
      displayName: "Concurrent User B",
      handle: sharedHandle,
      preferredLanguage: "en" as const,
    };

    // Fire both registration requests concurrently into PostgreSQL
    const [resultA, resultB] = await Promise.allSettled([
      registerTouristAccount(payloadA, prisma),
      registerTouristAccount(payloadB, prisma),
    ]);

    const successes = [resultA, resultB].filter((r) => r.status === "fulfilled");
    const rejections = [resultA, resultB].filter((r) => r.status === "rejected");

    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);

    const fulfilledResult = successes[0] as PromiseFulfilledResult<any>;
    createdAccountIds.add(fulfilledResult.value.account.id);

    const rejectedResult = rejections[0] as PromiseRejectedResult;
    expect(rejectedResult.reason).toBeInstanceOf(ConflictError);
    expect(rejectedResult.reason.statusCode).toBe(409);
    expect(rejectedResult.reason.code).toBe(ErrorCode.DUPLICATE_RESOURCE);

    // Confirm only 1 profile exists in PostgreSQL with this handle
    const profileCount = await prisma.touristProfile.count({
      where: { handle: sharedHandle },
    });
    expect(profileCount).toBe(1);
  });
});
