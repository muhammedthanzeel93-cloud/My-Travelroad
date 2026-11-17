/**
 * My Travelroad — Authenticated Principal & Request Types
 * Defines the request-bound principal representing an authenticated and verified caller.
 */

import type { Request } from "express";
import type { AccountId } from "../../types/domain/common.types";
import type {
  UserRole,
  AccountType,
  AccountStatus,
} from "../../types/domain/account.types";

/**
 * Authenticated Principal attached to Express requests following successful JWT verification
 * and authoritative PostgreSQL account state retrieval.
 *
 * Security: Contains only operational authorization attributes.
 * Never includes password hashes, MFA secrets, or raw credentials.
 */
export interface AuthenticatedPrincipal {
  /** Authoritative nominal account identifier (UUIDv4). */
  accountId: AccountId;
  /** Primary account email address. */
  email: string;
  /** Authoritative domain authorization role from PostgreSQL. */
  role: UserRole;
  /** Authoritative account classification type from PostgreSQL. */
  accountType: AccountType;
  /** Authoritative operational lifecycle status from PostgreSQL. */
  accountStatus: AccountStatus;
  /** Authoritative email verification flag from PostgreSQL. */
  emailVerified: boolean;
}

/**
 * Express Request narrowed to guarantee presence of the AuthenticatedPrincipal.
 */
export interface AuthenticatedRequest extends Request {
  auth: AuthenticatedPrincipal;
  user: AuthenticatedPrincipal;
}
