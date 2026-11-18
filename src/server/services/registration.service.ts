/**
 * My Travelroad — Tourist Account Registration Service
 * Orchestrates Argon2id password hashing and atomic 3-table account provisioning.
 * Reference: docs/architecture/api-contracts.md (Module A) & docs/architecture/database-architecture.md
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/db";
import { hashPassword } from "../auth/password";
import { RegisterRequestInput } from "../auth/register.schema";
import { ConflictError, InternalServerError } from "../errors/app-error";
import { logger } from "../../config/logger";

export interface RegistrationResult {
  account: {
    id: string;
    email: string;
    role: string;
    status: string;
    emailVerified: boolean;
    createdAt: string;
  };
  profile: {
    id: string;
    displayName: string;
    handle: string;
    preferredLanguage: string;
    travelPreferences: string[];
    isPublic: boolean;
  };
}

/**
 * Registers a new tourist account atomically.
 *
 * 1. Hashes user password with Argon2id.
 * 2. In a single Prisma transaction:
 *    - Creates Account (individual, traveler, pending_verification, unverified)
 *    - Creates AccountSecurityCredential (Argon2id MCF hash, mfa disabled)
 *    - Creates TouristProfile (public profile, travel preferences empty)
 * 3. Safely maps database uniqueness constraint violations (P2002) to 409 DUPLICATE_RESOURCE.
 * 4. Returns safe account and profile projections without credentials.
 */
export async function registerTouristAccount(
  input: RegisterRequestInput,
  prismaClient: PrismaClient = defaultPrisma
): Promise<RegistrationResult> {
  // 1. Hash password using Argon2id with cryptographically random salt
  const passwordHash = await hashPassword(input.password);

  try {
    // 2. Atomic 3-table transaction: Account + Security Credentials + Tourist Profile
    const result = await prismaClient.$transaction(async (tx) => {
      // 2a. Provision Account
      const account = await tx.account.create({
        data: {
          email: input.email,
          type: "individual",
          role: "traveler",
          status: "pending_verification",
          emailVerified: false,
          phoneVerified: false,
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
        },
      });

      // 2b. Provision AccountSecurityCredential linked 1:1
      await tx.accountSecurityCredential.create({
        data: {
          accountId: account.id,
          passwordHash,
          mfaEnabled: false,
          failedLoginAttempts: 0,
        },
      });

      // 2c. Provision TouristProfile linked 1:1
      const profile = await tx.touristProfile.create({
        data: {
          accountId: account.id,
          displayName: input.displayName,
          handle: input.handle,
          preferredLanguage: input.preferredLanguage ?? "en",
          travelPreferences: [],
          isPublic: true,
        },
        select: {
          id: true,
          displayName: true,
          handle: true,
          preferredLanguage: true,
          travelPreferences: true,
          isPublic: true,
        },
      });

      return { account, profile };
    });

    return {
      account: {
        id: result.account.id,
        email: result.account.email,
        role: result.account.role,
        status: result.account.status,
        emailVerified: result.account.emailVerified,
        createdAt: result.account.createdAt.toISOString(),
      },
      profile: {
        id: result.profile.id,
        displayName: result.profile.displayName,
        handle: result.profile.handle,
        preferredLanguage: result.profile.preferredLanguage,
        travelPreferences: result.profile.travelPreferences,
        isPublic: result.profile.isPublic,
      },
    };
  } catch (err: unknown) {
    // Check for Prisma unique constraint violation (P2002) or mocked P2002 error
    const isPrismaP2002 =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    const isMockP2002 =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002";

    if (isPrismaP2002 || isMockP2002) {
      // Map uniqueness violation safely to 409 Conflict without leaking schema internals
      throw new ConflictError(
        "An account with the provided email or handle already exists."
      );
    }

    // Re-throw known operational AppErrors intact
    if (typeof err === "object" && err !== null && "isOperational" in err) {
      throw err;
    }

    // Log unexpected errors securely without passwords or hashes
    logger.error(
      {
        err,
        email: input.email,
        handle: input.handle,
      },
      "Unexpected database failure during account registration"
    );

    throw new InternalServerError(
      "Account registration could not be completed due to a database error."
    );
  }
}
