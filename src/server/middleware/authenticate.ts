/**
 * My Travelroad — Authentication Middleware
 * Validates Bearer access tokens, queries authoritative PostgreSQL account state,
 * asserts account status and password-change invalidation, and attaches the typed AuthenticatedPrincipal.
 */

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/db";
import {
  verifyAccessToken,
  isValidUserRole,
  isValidAccountType,
  isValidAccountStatus,
  VerifyTokenOptions,
} from "../auth";
import type { AuthenticatedPrincipal } from "../auth/auth.types";
import type { AccountId } from "../../types/domain/common.types";
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  ServiceUnavailableError,
} from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";

/**
 * Authentication Middleware Factory
 * Supports dependency injection for unit testing with mock Prisma clients.
 */
export function createAuthenticateMiddleware(
  dbClient: PrismaClient = prisma,
  verifyOptions?: VerifyTokenOptions
) {
  return async function authenticate(
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || typeof authHeader !== "string") {
        return next(
          new UnauthorizedError(
            "Authentication required: missing Authorization header",
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      const trimmedHeader = authHeader.trim();
      if (trimmedHeader.toLowerCase() === "bearer") {
        return next(
          new UnauthorizedError(
            "Authentication required: empty token",
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      if (!/^Bearer\s+/i.test(authHeader)) {
        return next(
          new UnauthorizedError(
            "Authentication required: malformed Authorization header, expected 'Bearer <token>'",
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) {
        return next(
          new UnauthorizedError(
            "Authentication required: empty token",
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      // Verify cryptographic signature and standard JWT claims
      const claims = await verifyAccessToken(token, verifyOptions);

      // Retrieve authoritative account state from PostgreSQL
      const account = await dbClient.account.findUnique({
        where: { id: claims.sub },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          status: true,
          type: true,
          role: true,
          securityCredentials: {
            select: {
              passwordChangedAt: true,
            },
          },
        },
      });

      if (!account) {
        return next(
          new UnauthorizedError(
            "Account not found or no longer active",
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      // Reject programmatic system accounts from interactive API endpoints
      if (account.type === "system") {
        return next(
          new ForbiddenError(
            "System accounts cannot authenticate via API endpoints",
            ErrorCode.FORBIDDEN_ACCESS
          )
        );
      }

      // Assert operational account lifecycle status
      if (account.status === "suspended") {
        return next(
          new ForbiddenError(
            "Account has been suspended",
            ErrorCode.ACCOUNT_SUSPENDED
          )
        );
      }

      if (account.status === "deactivated") {
        return next(
          new ForbiddenError(
            "Account has been deactivated",
            ErrorCode.ACCOUNT_DEACTIVATED
          )
        );
      }

      // Stage A password change invalidation check
      if (account.securityCredentials?.passwordChangedAt) {
        const passwordChangedUnix = Math.floor(
          account.securityCredentials.passwordChangedAt.getTime() / 1000
        );
        if (claims.iat <= passwordChangedUnix) {
          return next(
            new UnauthorizedError(
              "Session has been invalidated due to password change",
              ErrorCode.TOKEN_INVALID
            )
          );
        }
      }

      // Assert runtime domain types for authoritative database attributes
      if (
        !isValidUserRole(account.role) ||
        !isValidAccountType(account.type) ||
        !isValidAccountStatus(account.status)
      ) {
        return next(
          new UnauthorizedError(
            "Corrupted account authorization attributes",
            ErrorCode.TOKEN_INVALID
          )
        );
      }

      // Construct request principal using authoritative PostgreSQL values
      const principal: AuthenticatedPrincipal = {
        accountId: account.id as AccountId,
        email: account.email,
        role: account.role,
        accountType: account.type,
        accountStatus: account.status,
        emailVerified: account.emailVerified,
      };

      req.auth = principal;
      req.user = principal;

      next();
    } catch (err: unknown) {
      if (err instanceof AppError) {
        return next(err);
      }

      req.log?.error(
        { err },
        "Database or unexpected failure during authentication verification"
      );

      return next(
        new ServiceUnavailableError(
          "Authentication service temporarily unavailable"
        )
      );
    }
  };
}

/**
 * Default singleton authentication middleware bound to primary Prisma client.
 */
export const authenticate = createAuthenticateMiddleware(prisma);
