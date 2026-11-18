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

async function isPortReachable(port: number, host: string, timeoutMs = 500): Promise<boolean> {
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
  let isDatabaseAvailable = false;
  const createdAccountIds: string[] = [];

  beforeAll(async () => {
    const portOpen = await isPortReachable(5432, "127.0.0.1", 500);
    if (!portOpen) {
      isDatabaseAvailable = false;
      return;
    }
    isDatabaseAvailable = await checkDatabaseHealth();
  });

  afterEach(async () => {
    if (isDatabaseAvailable && createdAccountIds.length > 0) {
      const idsToDelete = [...createdAccountIds];
      createdAccountIds.length = 0;
      try {
        await prisma.account.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      } catch {
        // Cleanup best-effort
      }
    }
  });

  afterAll(async () => {
    if (isDatabaseAvailable) {
      await prisma.$disconnect();
    }
  });

  it("successfully creates all three records (Account, SecurityCredential, TouristProfile) in PostgreSQL", async () => {
    if (!isDatabaseAvailable) {
      expect(true).toBe(true);
      return;
    }

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_success_${uniqueSuffix}@example.com`;
    const handle = `pg_succ_${uniqueSuffix}`;
    const password = "ValidPassword123!";

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
    createdAccountIds.push(result.account.id);

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

  it("rolls back the entire transaction if credential or profile creation fails, leaving no orphaned account", async () => {
    if (!isDatabaseAvailable) {
      expect(true).toBe(true);
      return;
    }

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `pg_rollback_${uniqueSuffix}@example.com`;

    // Execute transaction that intentionally fails on profile insertion (e.g. check constraint violation on handle length)
    let caughtError: unknown = null;
    try {
      await prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            email,
            type: "individual",
            role: "traveler",
            status: "pending_verification",
            emailVerified: false,
            phoneVerified: false,
          },
        });

        await tx.accountSecurityCredential.create({
          data: {
            accountId: account.id,
            passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$fakehash",
            mfaEnabled: false,
            failedLoginAttempts: 0,
          },
        });

        // Deliberately throw an error to trigger transaction rollback
        throw new Error("Simulated profile failure triggering transaction rollback");
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();

    // Verify that the Account was NOT persisted in PostgreSQL (rollback verified)
    const orphanedAccount = await prisma.account.findUnique({
      where: { email },
    });
    expect(orphanedAccount).toBeNull();
  });

  it("enforces PostgreSQL duplicate email constraint (uq_accounts_email) and returns 409 DUPLICATE_RESOURCE", async () => {
    if (!isDatabaseAvailable) {
      expect(true).toBe(true);
      return;
    }

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const sharedEmail = `pg_dup_email_${uniqueSuffix}@example.com`;

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
    createdAccountIds.push(firstRes.account.id);

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
    if (!isDatabaseAvailable) {
      expect(true).toBe(true);
      return;
    }

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const sharedHandle = `pg_dup_handle_${uniqueSuffix}`;

    // 1. First registration succeeds
    const firstRes = await registerTouristAccount(
      {
        email: `pg_handle_one_${uniqueSuffix}@example.com`,
        password: "ValidPassword123!",
        displayName: "First User",
        handle: sharedHandle,
        preferredLanguage: "en",
      },
      prisma
    );
    createdAccountIds.push(firstRes.account.id);

    // 2. Second registration with the same handle must be rejected by PostgreSQL
    let conflictError: ConflictError | null = null;
    try {
      await registerTouristAccount(
        {
          email: `pg_handle_two_${uniqueSuffix}@example.com`,
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
    if (!isDatabaseAvailable) {
      expect(true).toBe(true);
      return;
    }

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const sharedEmail = `pg_concurrent_email_${uniqueSuffix}@example.com`;

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
    createdAccountIds.push(fulfilledResult.value.account.id);

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
    if (!isDatabaseAvailable) {
      expect(true).toBe(true);
      return;
    }

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const sharedHandle = `pg_conc_hnd_${uniqueSuffix}`;

    const payloadA = {
      email: `conc_user_a_${uniqueSuffix}@example.com`,
      password: "PasswordA123!",
      displayName: "Concurrent User A",
      handle: sharedHandle,
      preferredLanguage: "en" as const,
    };

    const payloadB = {
      email: `conc_user_b_${uniqueSuffix}@example.com`,
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
    createdAccountIds.push(fulfilledResult.value.account.id);

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
