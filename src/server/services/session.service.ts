/**
 * My Travelroad — Session Management & Refresh Token Service
 * Orchestrates refresh token rotation, replay detection, single-device logout,
 * authoritative PostgreSQL account lifecycle checks, and password-change invalidation.
 * References:
 * - docs/architecture/api-contracts.md Module A (Sections 3 & 4)
 * - docs/architecture/api-architecture.md Section 6.2 & 6.3
 */

import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { RedisSessionStore } from "../redis/session.store";
import {
  parseRefreshToken,
  generateRefreshToken,
} from "../auth/refresh-token";
import { signAccessToken, ACCESS_TOKEN_EXPIRATION_SECONDS } from "../auth/jwt";
import { UserRole, AccountType, AccountStatus } from "../../types/domain/account.types";
import {
  UnauthorizedError,
  ForbiddenError,
} from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";

export interface RefreshSessionResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  newRawRefreshToken: string;
}

export interface SessionClientMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export class SessionService {
  constructor(private sessionStore: RedisSessionStore) {}

  /**
   * Rotates an active refresh token, enforces replay detection, and issues a fresh access token.
   *
   * @param rawCookie Value from req.cookies.refreshToken
   * @param metadata Client IP and User-Agent telemetry
   * @param prismaClient Prisma client instance for authoritative database checks
   * @returns RefreshSessionResult containing new access token and replacement raw refresh token
   */
  public async rotateRefreshSession(
    rawCookie: string | undefined,
    metadata: SessionClientMetadata,
    prismaClient: PrismaClient
  ): Promise<RefreshSessionResult> {
    // 1. Strict cookie presence check
    if (!rawCookie || typeof rawCookie !== "string" || rawCookie.trim().length === 0) {
      throw new UnauthorizedError(
        "Refresh token cookie is missing or empty",
        ErrorCode.AUTHENTICATION_REQUIRED
      );
    }

    // 2. Validate cookie syntax and compute SHA-256 digest of presented token
    const { familyId, tokenHash } = parseRefreshToken(rawCookie);

    // 3. Pre-read token family state from Redis
    const family = await this.sessionStore.getFamily(familyId);

    if (!family) {
      // Check if presented token was previously rotated (tombstone exists)
      const isRevoked = await this.sessionStore.isTokenRevoked(familyId, tokenHash);
      if (isRevoked) {
        throw new UnauthorizedError(
          "Refresh token has been revoked",
          ErrorCode.TOKEN_INVALID
        );
      }
      throw new UnauthorizedError(
        "Invalid or expired refresh token",
        ErrorCode.TOKEN_INVALID
      );
    }

    // 4. Assert family is not already marked compromised
    if (family.isCompromised) {
      throw new UnauthorizedError(
        "Refresh token family has been revoked due to replay detection",
        ErrorCode.TOKEN_REPLAY_DETECTED
      );
    }

    // 5. Replay Detection & Family-Level Revocation
    // If presented token hash does NOT match the currently active token hash in the family:
    if (family.activeTokenHash !== tokenHash) {
      // Execute atomic replay revocation with state revalidation and retry-to-convergence
      let currentActiveHash = family.activeTokenHash;
      let currentActiveSession = family.activeSessionId;
      let replayConfirmed = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        const replayResult = await this.sessionStore.revokeFamilyReplay({
          familyId,
          presentedTokenHash: tokenHash,
          expectedActiveTokenHash: currentActiveHash,
          expectedActiveSessionId: currentActiveSession,
        });

        if (replayResult === "REPLAY_CONFIRMED") {
          replayConfirmed = true;
          break;
        }

        if (replayResult === "CONCURRENT_ROTATION_DETECTED") {
          // Re-fetch latest active credentials and retry to guarantee active session is pruned
          const updatedFamily = await this.sessionStore.getFamily(familyId);
          if (!updatedFamily || updatedFamily.isCompromised) {
            replayConfirmed = true;
            break;
          }
          currentActiveHash = updatedFamily.activeTokenHash;
          currentActiveSession = updatedFamily.activeSessionId;
          continue;
        }

        if (replayResult === "NOT_A_REPLAY") {
          throw new UnauthorizedError(
            "Invalid refresh token",
            ErrorCode.TOKEN_INVALID
          );
        }

        if (replayResult === "ALREADY_REVOKED") {
          throw new UnauthorizedError(
            "Refresh token family has been revoked",
            ErrorCode.TOKEN_REPLAY_DETECTED
          );
        }
      }

      if (replayConfirmed) {
        throw new UnauthorizedError(
          "Refresh token replay detected. Session family has been revoked.",
          ErrorCode.TOKEN_REPLAY_DETECTED
        );
      }

      throw new UnauthorizedError(
        "Invalid refresh token",
        ErrorCode.TOKEN_INVALID
      );
    }

    // 6. Legitimate Rotation Candidate: Resolve session telemetry and owner
    const lookup = await this.sessionStore.getTokenLookup(familyId, tokenHash);
    const session = await this.sessionStore.getSession(familyId, family.activeSessionId);

    if (!lookup || !session) {
      throw new UnauthorizedError(
        "Session state is missing or corrupted",
        ErrorCode.TOKEN_INVALID
      );
    }

    const accountId = lookup.accountId;

    // 7. Authoritative PostgreSQL Lifecycle & Password-Change Validation
    const account = await prismaClient.account.findUnique({
      where: { id: accountId },
      include: {
        securityCredentials: true,
      },
    });

    if (!account || !account.securityCredentials) {
      await this.sessionStore.revokeFamilyDirect(
        familyId,
        family.activeSessionId,
        family.activeTokenHash,
        accountId
      );
      throw new UnauthorizedError(
        "Account not found",
        ErrorCode.TOKEN_INVALID
      );
    }

    if (account.type === "system") {
      await this.sessionStore.revokeFamilyDirect(
        familyId,
        family.activeSessionId,
        family.activeTokenHash,
        accountId
      );
      throw new UnauthorizedError(
        "System accounts cannot maintain interactive sessions",
        ErrorCode.TOKEN_INVALID
      );
    }

    if (account.status === "suspended") {
      await this.sessionStore.revokeFamilyDirect(
        familyId,
        family.activeSessionId,
        family.activeTokenHash,
        accountId
      );
      throw new ForbiddenError(
        "Account is suspended. Please contact customer support.",
        ErrorCode.ACCOUNT_SUSPENDED
      );
    }

    if (account.status === "deactivated") {
      await this.sessionStore.revokeFamilyDirect(
        familyId,
        family.activeSessionId,
        family.activeTokenHash,
        accountId
      );
      throw new ForbiddenError(
        "Account is deactivated.",
        ErrorCode.ACCOUNT_DEACTIVATED
      );
    }

    // 8. Password-Change Invalidation Check
    const passwordChangedAt = account.securityCredentials.passwordChangedAt;
    if (passwordChangedAt) {
      const sessionCreatedTime = new Date(session.createdAt).getTime();
      const passwordChangedTime = passwordChangedAt.getTime();

      if (sessionCreatedTime <= passwordChangedTime) {
        await this.sessionStore.revokeFamilyDirect(
          familyId,
          family.activeSessionId,
          family.activeTokenHash,
          accountId
        );
        throw new UnauthorizedError(
          "Session has been invalidated due to a password change",
          ErrorCode.TOKEN_INVALID
        );
      }
    }

    // 9. Pre-generate replacement credentials in Node.js memory
    const replacement = generateRefreshToken(familyId);
    const newSessionId = crypto.randomUUID();
    const oldSessionId = family.activeSessionId;
    const nowIso = new Date().toISOString();

    // 10. Execute Deterministic Atomic Rotation Script in Redis
    const rotationResult = await this.sessionStore.rotateSession({
      familyId,
      oldSessionId,
      newSessionId,
      presentedTokenHash: tokenHash,
      replacementTokenHash: replacement.tokenHash,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      timestamp: nowIso,
    });

    if (!rotationResult.success) {
      if (rotationResult.reason === "RACE_OR_REPLAY_DETECTED") {
        throw new UnauthorizedError(
          "Concurrent token rotation or replay detected",
          ErrorCode.TOKEN_INVALID
        );
      }
      if (rotationResult.reason === "FAMILY_COMPROMISED") {
        throw new UnauthorizedError(
          "Refresh token family has been revoked due to replay detection",
          ErrorCode.TOKEN_REPLAY_DETECTED
        );
      }
      throw new UnauthorizedError(
        `Session rotation rejected: ${rotationResult.reason}`,
        ErrorCode.TOKEN_INVALID
      );
    }

    // 11. Decoupled update to account-level session index
    await this.sessionStore.updateAccountSessionIndex(
      accountId,
      familyId,
      oldSessionId,
      newSessionId
    );

    // 12. Issue short-lived HS256 JWT access token
    const accessToken = await signAccessToken({
      sub: account.id,
      email: account.email,
      role: account.role as UserRole,
      emailVerified: account.emailVerified,
      type: account.type as AccountType,
      status: account.status as AccountStatus,
      gen: 1,
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_EXPIRATION_SECONDS,
      newRawRefreshToken: replacement.rawToken,
    };
  }

  /**
   * Logs out the current device session and clears associated Redis records.
   *
   * @param rawCookie Value from req.cookies.refreshToken
   * @param accountId Optional account UUID if resolved from Bearer token
   * @returns Success confirmation message
   */
  public async logoutSession(
    rawCookie: string | undefined,
    accountId?: string
  ): Promise<{ message: string }> {
    if (!rawCookie || typeof rawCookie !== "string" || rawCookie.trim().length === 0) {
      return { message: "Successfully logged out and session revoked." };
    }

    try {
      const { familyId, tokenHash } = parseRefreshToken(rawCookie);
      const family = await this.sessionStore.getFamily(familyId);

      if (family) {
        await this.sessionStore.logoutSession({
          familyId,
          expectedActiveSessionId: family.activeSessionId,
          expectedActiveTokenHash: family.activeTokenHash,
          accountId,
        });
      }
    } catch {
      // Logout is idempotent and must succeed safely even if token is already expired or malformed
    }

    return { message: "Successfully logged out and session revoked." };
  }
}
