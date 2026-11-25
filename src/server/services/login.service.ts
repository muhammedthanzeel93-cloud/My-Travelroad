/**
 * My Travelroad — User Authentication & Login Service
 * Orchestrates credential authentication, account lifecycle verification,
 * anti-enumeration timing defenses, concurrency-safe failed-login tracking/lockout,
 * and access token issuance.
 * References:
 * - docs/architecture/api-contracts.md (Module A Section 2)
 * - docs/architecture/api-architecture.md (Section 6.1 & 6.2)
 */

import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/db";
import { verifyPassword } from "../auth/password";
import { signAccessToken, ACCESS_TOKEN_EXPIRATION_SECONDS } from "../auth/jwt";
import { generateRefreshToken } from "../auth/refresh-token";
import { RedisSessionStore } from "../redis/session.store";
import { LoginRequestInput } from "../auth/login.schema";
import { UserRole, AccountType, AccountStatus } from "../../types/domain/account.types";
import {
  UnauthorizedError,
  ForbiddenError,
  LockedError,
} from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";

/**
 * Approved failed-login protection constants per api-architecture.md Section 6.1.
 * - Lockout threshold: 5 consecutive failed attempts
 * - Lockout duration: 15 minutes (900 seconds / 900,000 ms)
 */
export const FAILED_LOGIN_LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Standard dummy Argon2id hash used to equalize execution timing
 * when candidate accounts do not exist or contain malformed stored hashes,
 * preventing account enumeration and state-detection side channels.
 * Conforms strictly to RFC 9106 Modular Crypt Format (Argon2id, v=19, m=65536, t=3, p=4,
 * 16-byte salt, 32-byte digest).
 */
export const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$1G7pO+iiNcV0ev/jZ+l4ZA$ScOGasAOdi2F2+HKaO7Cm0PtlIOFYqtZOd6WYe566jI";

/**
 * Validates whether a candidate string is valid, canonical Base64 encoding
 * representing a buffer of the exact expected byte length.
 *
 * @param str Base64 candidate string
 * @param expectedByteLength Expected decoded buffer length in bytes
 * @returns true if valid, canonical Base64 with exact byte length
 */
export function isCanonicalBase64(str: string, expectedByteLength: number): boolean {
  if (typeof str !== "string" || str.length === 0) return false;
  // Standard Base64 characters with up to 2 optional padding characters
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(str)) return false;

  const buf = Buffer.from(str, "base64");
  if (buf.length !== expectedByteLength) return false;

  // Canonical check: re-encoding to Base64 without padding must exactly match the unpadded input
  const unpaddedInput = str.replace(/=+$/, "");
  const unpaddedReencoded = buf.toString("base64").replace(/=+$/, "");
  return unpaddedInput === unpaddedReencoded;
}

/**
 * Strict validator for Argon2id Modular Crypt Format (MCF) hashes.
 * Ensures the stored hash conforms strictly to approved production parameters:
 * - Prefix: $argon2id$
 * - Version: v=19
 * - Parameters: m=65536,t=3,p=4
 * - Salt: canonical Base64 decoding to exactly 16 bytes (128 bits)
 * - Digest: canonical Base64 decoding to exactly 32 bytes (256 bits)
 *
 * Any malformed, truncated, unsupported, or parameter-mismatched hash is rejected,
 * routing execution through dummy Argon2id verification to equalize timing.
 */
export function isValidArgon2idHash(hash: unknown): hash is string {
  if (typeof hash !== "string" || !hash.startsWith("$")) {
    return false;
  }

  const parts = hash.split("$");
  // Expected format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<digest>
  // parts[0] is "", parts[1] is "argon2id", parts[2] is "v=19",
  // parts[3] is "m=65536,t=3,p=4", parts[4] is salt, parts[5] is digest
  if (parts.length !== 6) {
    return false;
  }

  if (parts[1] !== "argon2id") {
    return false;
  }

  if (parts[2] !== "v=19") {
    return false;
  }

  if (parts[3] !== "m=65536,t=3,p=4") {
    return false;
  }

  // Salt: must decode to exactly 16 bytes with canonical Base64
  if (!isCanonicalBase64(parts[4], 16)) {
    return false;
  }

  // Digest: must decode to exactly 32 bytes with canonical Base64
  if (!isCanonicalBase64(parts[5], 32)) {
    return false;
  }

  return true;
}

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  account: {
    id: string;
    email: string;
    role: string;
    status: string;
    emailVerified: boolean;
  };
  rawRefreshToken?: string;
}

/**
 * Concurrency-safe failed login recorder using PostgreSQL row-level locking.
 * Serializes concurrent updates to prevent lost increments and accurately enforces lockout.
 */
async function recordFailedLogin(
  prismaClient: PrismaClient,
  accountId: string
): Promise<void> {
  await prismaClient.$transaction(async (tx) => {
    // 1. Acquire exclusive row-level lock on account_security_credentials
    const rows = await tx.$queryRaw<Array<{
      failed_login_attempts: number;
      locked_until: Date | null;
    }>>`
      SELECT failed_login_attempts, locked_until
      FROM account_security_credentials
      WHERE account_id = ${accountId}::uuid
      FOR UPDATE
    `;

    if (rows.length === 0) return;
    const cred = rows[0];
    const txNow = new Date();

    const isCurrentlyLocked =
      cred.locked_until !== null && cred.locked_until.getTime() > txNow.getTime();

    if (isCurrentlyLocked) {
      // Account is already actively locked; do not increment counter or extend lock
      return;
    }

    const wasLockExpired =
      cred.locked_until !== null && cred.locked_until.getTime() <= txNow.getTime();

    // If a previous lock expired, reset counter to 0 so this failure begins attempt 1
    const currentFailedAttempts = wasLockExpired ? 0 : cred.failed_login_attempts;
    const newFailedAttempts = currentFailedAttempts + 1;
    const isLockTriggered = newFailedAttempts >= FAILED_LOGIN_LOCKOUT_THRESHOLD;

    const newLockedUntil = isLockTriggered
      ? new Date(txNow.getTime() + LOCKOUT_DURATION_MS)
      : null;

    await tx.accountSecurityCredential.update({
      where: { accountId },
      data: {
        failedLoginAttempts: isLockTriggered
          ? FAILED_LOGIN_LOCKOUT_THRESHOLD
          : newFailedAttempts,
        lockedUntil: newLockedUntil,
      },
    });
  });
}

/**
 * Concurrency-safe successful login recorder using PostgreSQL row-level locking.
 * Resets failed attempts and verifies that a racing failed attempt did not lock the account.
 */
async function recordSuccessfulLogin(
  prismaClient: PrismaClient,
  accountId: string
): Promise<void> {
  await prismaClient.$transaction(async (tx) => {
    // 1. Acquire exclusive row-level lock
    const rows = await tx.$queryRaw<Array<{
      failed_login_attempts: number;
      locked_until: Date | null;
    }>>`
      SELECT failed_login_attempts, locked_until
      FROM account_security_credentials
      WHERE account_id = ${accountId}::uuid
      FOR UPDATE
    `;

    if (rows.length === 0) return;
    const cred = rows[0];
    const txNow = new Date();

    // Check if a racing concurrent request locked the account while password was being verified
    if (cred.locked_until !== null && cred.locked_until.getTime() > txNow.getTime()) {
      throw new LockedError(
        "Account is temporarily locked due to excessive failed login attempts."
      );
    }

    if (cred.failed_login_attempts > 0 || cred.locked_until !== null) {
      await tx.accountSecurityCredential.update({
        where: { accountId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    await tx.account.update({
      where: { id: accountId },
      data: {
        lastLoginAt: txNow,
      },
    });
  });
}

/**
 * Authenticates user credentials and issues a short-lived JWT access token.
 *
 * @param input Validated login request input (normalized email and candidate password)
 * @param prismaClient Prisma client instance (defaults to shared singleton, injectable for testing)
 * @returns Authenticated user projection and signed Bearer token
 */
export async function authenticateLogin(
  input: LoginRequestInput,
  prismaClient: PrismaClient = defaultPrisma,
  sessionStore?: RedisSessionStore,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<LoginResult> {
  const normalizedEmail = input.email.toLowerCase();

  // 1. Retrieve account and associated security credentials
  const account = await prismaClient.account.findUnique({
    where: { email: normalizedEmail },
    include: {
      securityCredentials: true,
    },
  });

  // 2. Anti-enumeration timing defense:
  // If the account does not exist, has no security credentials record,
  // or is a forbidden system account, perform a dummy Argon2id verification to consume
  // equivalent CPU cycles before returning the generic 401 INVALID_CREDENTIALS error.
  if (
    !account ||
    !account.securityCredentials ||
    account.type === "system"
  ) {
    await verifyPassword(input.password, DUMMY_ARGON2_HASH);
    throw new UnauthorizedError(
      "Invalid email or password",
      ErrorCode.INVALID_CREDENTIALS
    );
  }

  const credentials = account.securityCredentials;
  const now = new Date();

  // 3. Fast-path check for active temporary account lockout (423 ACCOUNT_LOCKED)
  const isCurrentlyLocked =
    credentials.lockedUntil !== null &&
    credentials.lockedUntil.getTime() > now.getTime();

  if (isCurrentlyLocked) {
    throw new LockedError(
      "Account is temporarily locked due to excessive failed login attempts."
    );
  }

  // 4. Password Verification with Malformed-Hash Timing Defense
  // Check whether the stored password hash conforms to valid Argon2id MCF format
  const isStoredHashValidFormat = isValidArgon2idHash(credentials.passwordHash);

  let isPasswordValid = false;

  if (!isStoredHashValidFormat) {
    // Malformed, unsupported, or missing stored hash:
    // Execute dummy Argon2id verification to consume equivalent CPU cycles (~126 ms)
    // and equalize timing, preventing side-channel detection of corrupt/missing hashes.
    // Note: This practical timing-equalization approach aligns CPU execution duration
    // but is not claimed to be perfectly constant-time at microsecond levels due to OS
    // thread scheduling, CPU frequency scaling, and cache variance.
    await verifyPassword(input.password, DUMMY_ARGON2_HASH);
    isPasswordValid = false;
  } else {
    // Valid format: verify candidate password against stored Argon2id hash
    isPasswordValid = await verifyPassword(
      input.password,
      credentials.passwordHash!
    );
  }

  if (!isPasswordValid) {
    // Increment failed attempt counter atomically with PostgreSQL row-level locking
    await recordFailedLogin(prismaClient, account.id);

    throw new UnauthorizedError(
      "Invalid email or password",
      ErrorCode.INVALID_CREDENTIALS
    );
  }

  // 5. Account Lifecycle Enforcement (Authoritative database values)
  if (account.status === "suspended") {
    throw new ForbiddenError(
      "Account is suspended. Please contact customer support.",
      ErrorCode.ACCOUNT_SUSPENDED
    );
  }

  if (account.status === "deactivated") {
    throw new ForbiddenError(
      "Account is deactivated.",
      ErrorCode.ACCOUNT_DEACTIVATED
    );
  }

  // Note: 'pending_verification' accounts remain eligible to log in per API contract.
  // Their token will carry `emailVerified: false`, allowing read-only or verification access.

  // 6. Successful Authentication: Concurrency-safe reset of failed attempts & update lastLoginAt
  await recordSuccessfulLogin(prismaClient, account.id);

  // 7. Session persistence in Redis (when sessionStore is configured)
  let rawRefreshToken: string | undefined;

  if (sessionStore) {
    const familyId = crypto.randomUUID();
    const tokenCreds = generateRefreshToken(familyId);
    const sessionId = crypto.randomUUID();

    await sessionStore.createInitialSession({
      familyId,
      sessionId,
      tokenHash: tokenCreds.tokenHash,
      accountId: account.id,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    rawRefreshToken = tokenCreds.rawToken;
  }

  // 8. Issue short-lived JWT access token using approved HS256 signing
  const accessToken = await signAccessToken({
    sub: account.id,
    email: account.email,
    role: account.role as UserRole,
    emailVerified: account.emailVerified,
    type: account.type as AccountType,
    status: account.status as AccountStatus,
    gen: 1,
  });

  // 9. Return standardized safe login result envelope
  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn: ACCESS_TOKEN_EXPIRATION_SECONDS,
    account: {
      id: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      emailVerified: account.emailVerified,
    },
    ...(rawRefreshToken ? { rawRefreshToken } : {}),
  };
}
