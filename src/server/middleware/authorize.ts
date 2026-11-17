/**
 * My Travelroad — Authorization & Role Enforcement Middleware
 * Implements discrete Role-Based Access Control (RBAC), email verification gating,
 * and operational account status authorization.
 */

import { Request, Response, NextFunction } from "express";
import { UserRole, AccountStatus } from "../../types/domain/account.types";
import { isValidUserRole, isValidAccountStatus } from "../auth";
import { UnauthorizedError, ForbiddenError } from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";

/**
 * Role Enforcement Middleware Factory
 * Restricts endpoint access strictly to callers whose authoritative account role
 * matches one of the explicitly allowed roles.
 *
 * Security Invariant: Discrete Roles (Zero Implicit Inheritance).
 * Roles do not inherit permissions. super_admin is not automatically granted access
 * unless explicitly included in allowedRoles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  if (allowedRoles.length === 0) {
    throw new Error("requireRole requires at least one valid UserRole");
  }

  for (const role of allowedRoles) {
    if (!isValidUserRole(role)) {
      throw new Error(`Invalid UserRole supplied to requireRole: '${String(role)}'`);
    }
  }

  const roleSet = new Set<UserRole>(allowedRoles);

  return function roleEnforcer(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    if (!req.auth) {
      return next(
        new UnauthorizedError(
          "Authentication required",
          ErrorCode.AUTHENTICATION_REQUIRED
        )
      );
    }

    if (!roleSet.has(req.auth.role)) {
      return next(
        new ForbiddenError(
          "Forbidden: insufficient permissions for this resource",
          ErrorCode.FORBIDDEN_ACCESS
        )
      );
    }

    next();
  };
}

/**
 * Email Verification Enforcement Middleware
 * Restricts protected mutating operations to accounts whose primary email
 * address has passed verification.
 */
export function requireEmailVerified(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.auth) {
    return next(
      new UnauthorizedError(
        "Authentication required",
        ErrorCode.AUTHENTICATION_REQUIRED
      )
    );
  }

  if (!req.auth.emailVerified) {
    return next(
      new ForbiddenError(
        "Email verification is required to perform this action",
        ErrorCode.EMAIL_VERIFICATION_REQUIRED
      )
    );
  }

  next();
}

/**
 * Account Status Enforcement Middleware Factory
 * Restricts endpoint access to accounts with explicitly allowed operational lifecycle statuses.
 */
export function requireAccountStatus(...allowedStatuses: AccountStatus[]) {
  if (allowedStatuses.length === 0) {
    throw new Error("requireAccountStatus requires at least one valid AccountStatus");
  }

  for (const status of allowedStatuses) {
    if (!isValidAccountStatus(status)) {
      throw new Error(
        `Invalid AccountStatus supplied to requireAccountStatus: '${String(status)}'`
      );
    }
  }

  const statusSet = new Set<AccountStatus>(allowedStatuses);

  return function statusEnforcer(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    if (!req.auth) {
      return next(
        new UnauthorizedError(
          "Authentication required",
          ErrorCode.AUTHENTICATION_REQUIRED
        )
      );
    }

    if (!statusSet.has(req.auth.accountStatus)) {
      if (req.auth.accountStatus === "pending_verification") {
        return next(
          new ForbiddenError(
            "Account email verification is pending",
            ErrorCode.EMAIL_VERIFICATION_REQUIRED
          )
        );
      }

      if (req.auth.accountStatus === "suspended") {
        return next(
          new ForbiddenError(
            "Account has been suspended",
            ErrorCode.ACCOUNT_SUSPENDED
          )
        );
      }

      if (req.auth.accountStatus === "deactivated") {
        return next(
          new ForbiddenError(
            "Account has been deactivated",
            ErrorCode.ACCOUNT_DEACTIVATED
          )
        );
      }

      return next(
        new ForbiddenError(
          "Forbidden: account status does not permit this operation",
          ErrorCode.FORBIDDEN_ACCESS
        )
      );
    }

    next();
  };
}

/**
 * Convenience middleware enforcing strictly 'active' account status.
 */
export const requireActiveAccount = requireAccountStatus("active");
