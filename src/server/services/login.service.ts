/**
 * My Travelroad — User Authentication & Login Service
 * Orchestrates credential authentication, account lifecycle verification,
 * anti-enumeration timing defenses, failed-login throttling/lockout, and access token issuance.
 * References:
 * - docs/architecture/api-contracts.md (Module A Section 2)
 * - docs/architecture/api-architecture.md (Section 6.1 & 6.2)
 */

import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/db";
import { verifyPassword } from "../auth/password";
import { signAccessToken, ACCESS_TOKEN_EXPIRATION_SECONDS } from "../auth/jwt";
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
 * when candidate accounts do not exist, preventing account enumeration attacks.
 * Conforms to RFC 9106 Modular Crypt Format (Argon2id, v=19, m=65536, t=3, p=4).
 */
export const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$c29tZXJhbmRvbXNhbHQxMjM$0123456789012345678901234567890123456789012";

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
  prismaClient: PrismaClient = defaultPrisma
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
  // If the account does not exist, has no security credentials, lacks a password hash,
  // or is a forbidden system account, perform a dummy Argon2id verification to consume
  // equivalent CPU cycles before returning the generic 401 INVALID_CREDENTIALS error.
  if (
    !account ||
    !account.securityCredentials ||
    !account.securityCredentials.passwordHash ||
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

  // 3. Check for active temporary account lockout (423 ACCOUNT_LOCKED)
  const isCurrentlyLocked =
    credentials.lockedUntil !== null &&
    credentials.lockedUntil.getTime() > now.getTime();

  if (isCurrentlyLocked) {
    throw new LockedError(
      "Account is temporarily locked due to excessive failed login attempts."
    );
  }

  // Determine if a previous lockout has expired
  const wasLockExpired =
    credentials.lockedUntil !== null &&
    credentials.lockedUntil.getTime() <= now.getTime();

  // 4. Constant-time Argon2id password verification
  const isPasswordValid = await verifyPassword(
    input.password,
    credentials.passwordHash!
  );

  if (!isPasswordValid) {
    // Increment failed attempt counter; if prior lock expired, start new cycle at 1
    const currentFailedAttempts = wasLockExpired
      ? 0
      : credentials.failedLoginAttempts;
    const newFailedAttempts = currentFailedAttempts + 1;
    const isLockTriggered =
      newFailedAttempts >= FAILED_LOGIN_LOCKOUT_THRESHOLD;

    const newLockedUntil = isLockTriggered
      ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
      : wasLockExpired
      ? null
      : credentials.lockedUntil;

    // Persist failed attempt telemetry atomically
    await prismaClient.accountSecurityCredential.update({
      where: { accountId: account.id },
      data: {
        failedLoginAttempts: isLockTriggered
          ? FAILED_LOGIN_LOCKOUT_THRESHOLD
          : newFailedAttempts,
        lockedUntil: newLockedUntil,
      },
    });

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

  // 6. Successful Authentication: Reset failed login attempts and update lastLoginAt
  await prismaClient.$transaction(async (tx) => {
    if (
      credentials.failedLoginAttempts > 0 ||
      credentials.lockedUntil !== null
    ) {
      await tx.accountSecurityCredential.update({
        where: { accountId: account.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    await tx.account.update({
      where: { id: account.id },
      data: {
        lastLoginAt: now,
      },
    });
  });

  // 7. Issue short-lived JWT access token using approved HS256 signing
  const accessToken = await signAccessToken({
    sub: account.id,
    email: account.email,
    role: account.role as UserRole,
    emailVerified: account.emailVerified,
    type: account.type as AccountType,
    status: account.status as AccountStatus,
    gen: 1,
  });

  // 8. Return standardized safe login result envelope
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
  };
}
