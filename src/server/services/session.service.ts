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

    // 5. Strict Replay Detection Check
    // If presented token hash does NOT match the currently active token hash in the family,
    // this is a spent/rotated or unrecognized token. Under strict single-winner rotation,
    // a rotated token is permanently spent. Re-presenting an already-rotated token is classified
    // as an active replay attack and immediately revokes the session family fail-closed.
    if (family.activeTokenHash !== tokenHash) {
      let currentActiveHash = family.activeTokenHash;
      let currentActiveSession = family.activeSessionId;
      let replayConfirmed = false;

      // Resolve accountId for account session index cleanup
      const activeSessionRecord = await this.sessionStore.getSession(familyId, currentActiveSession);
      const targetAccountId = activeSessionRecord?.accountId;

      for (let attempt = 0; attempt < 3; attempt++) {
        const replayResult = await this.sessionStore.revokeFamilyReplay({
          familyId,
          presentedTokenHash: tokenHash,
          expectedActiveTokenHash: currentActiveHash,
          expectedActiveSessionId: currentActiveSession,
          accountId: targetAccountId,
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
            "Invalid or expired refresh token",
            ErrorCode.TOKEN_INVALID
          );
        }

        if (replayResult === "ALREADY_REVOKED") {
          throw new UnauthorizedError(
            "Refresh token family has been revoked due to replay detection",
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
        "Invalid or expired refresh token",
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

    // 9.5 Pre-sign short-lived HS256 JWT access token before Redis mutation to guarantee
    // that a signing failure will not leave an orphaned, rotated session in Redis
    const accessToken = await signAccessToken({
      sub: account.id,
      email: account.email,
      role: account.role as UserRole,
      emailVerified: account.emailVerified,
      type: account.type as AccountType,
      status: account.status as AccountStatus,
      gen: 1,
    });

    const refreshResult: RefreshSessionResult = {
      accessToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_EXPIRATION_SECONDS,
      newRawRefreshToken: replacement.rawToken,
    };

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
    // Best-effort decoupled index maintenance: Redis rotation is already committed
    try {
      await this.sessionStore.updateAccountSessionIndex(
        accountId,
        familyId,
        oldSessionId,
        newSessionId
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          event: "ACCOUNT_SESSION_INDEX_FAILURE",
          operation: "updateAccountSessionIndex",
          accountId,
          familyId,
          oldSessionId,
          newSessionId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }

    return refreshResult;
  }

  /**
   * Logs out the current device session with strict validation.
   * Old, fabricated, or unrelated tokens cannot revoke an active session.
   * Infrastructure failures (Redis down) throw ServiceUnavailableError.
   *
   * @param rawCookie Value from req.cookies.refreshToken
   * @param callerAccountId Optional account UUID if resolved from Bearer token
   * @returns Success confirmation message
   */
  public async logoutSession(
    rawCookie: string | undefined,
    callerAccountId?: string
  ): Promise<{ message: string }> {
    if (!rawCookie || typeof rawCookie !== "string" || rawCookie.trim().length === 0) {
      return { message: "Successfully logged out and session revoked." };
    }

    let parsed;
    try {
      parsed = parseRefreshToken(rawCookie);
    } catch {
      // Malformed cookie is an expected idempotent client outcome
      return { message: "Successfully logged out and session revoked." };
    }

    const { familyId, tokenHash } = parsed;

    // 1. Resolve token lookup record from Redis
    const lookup = await this.sessionStore.getTokenLookup(familyId, tokenHash);

    if (!lookup) {
      // Lookup not found: token might be already revoked, expired, or non-existent
      const family = await this.sessionStore.getFamily(familyId);
      if (!family) {
        // Family does not exist (already logged out or expired): idempotent success
        return { message: "Successfully logged out and session revoked." };
      }

      // Family exists, but presented token hash is not in lookup!
      // This is a stale, rotated, or fabricated token.
      // It MUST NOT revoke the active family/session!
      return { message: "Successfully logged out and session revoked." };
    }

    // 2. Lookup exists: verify account ownership if caller identity was provided
    if (callerAccountId && lookup.accountId !== callerAccountId) {
      // Token belongs to another account! Must NOT revoke!
      return { message: "Successfully logged out and session revoked." };
    }

    // 3. Verify family state and active credentials
    const family = await this.sessionStore.getFamily(familyId);
    if (!family) {
      return { message: "Successfully logged out and session revoked." };
    }

    // Assert that presented token matches the active token in the family
    if (family.activeTokenHash !== tokenHash || family.activeSessionId !== lookup.sessionId) {
      // Token is stale or mismatched! Must NOT revoke the active session!
      return { message: "Successfully logged out and session revoked." };
    }

    // 4. Invoke atomic Lua logout with verified expected credentials
    await this.sessionStore.logoutSession({
      familyId,
      expectedActiveSessionId: lookup.sessionId,
      expectedActiveTokenHash: tokenHash,
      accountId: lookup.accountId,
    });

    return { message: "Successfully logged out and session revoked." };
  }
}
