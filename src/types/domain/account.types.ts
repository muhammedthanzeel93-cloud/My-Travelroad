/**
 * My Travelroad — Identity & Account Domain Models
 * Implements the split-identity architecture where security credentials and authorization
 * are strictly isolated from user-facing profiles.
 */

import type { AccountId, IsoDateTimeString } from "./common.types";

/** Lifecycle status of a platform account. */
export type AccountStatus =
  | "active"
  | "suspended"
  | "pending_verification"
  | "deactivated";

/**
 * Functional classification of an account.
 * Individual travelers and contributors use 'individual'.
 * Registered tourism operators use 'business'.
 * Automated background tasks or sentinels use 'system'.
 */
export type AccountType = "individual" | "business" | "system";

/**
 * Platform authorization roles.
 * Privileged roles ('curator', 'moderator', 'super_admin') require explicit administrative
 * elevation via audit-logged workflows and cannot be self-selected during registration.
 */
export type UserRole =
  | "traveler"
  | "contributor"
  | "curator"
  | "moderator"
  | "super_admin";

/**
 * Core Account entity representing an identity with authentication credentials.
 * NEVER exposed directly to public profile APIs.
 */
export interface Account {
  /** Unique nominal account identifier. */
  id: AccountId;

  /** Primary unique email address used for sign-in and transactional communications. */
  email: string;

  /** Optional international E.164 phone number. */
  phone?: string | null;

  /** Whether the email address has passed verification. */
  emailVerified: boolean;

  /** Whether the phone number has passed OTP verification. */
  phoneVerified: boolean;

  /** Account operational status. */
  status: AccountStatus;

  /** Account classification type. */
  type: AccountType;

  /** Security and permission role. */
  role: UserRole;

  /** Timestamp of the most recent successful authentication. */
  lastLoginAt?: IsoDateTimeString | null;

  /** Timestamp when the account was initially registered. */
  createdAt: IsoDateTimeString;

  /** Timestamp when the account record was last modified. */
  updatedAt: IsoDateTimeString;
}

/**
 * Account authentication security credentials container.
 * Strictly internal to the authentication service layer.
 */
export interface AccountSecurityCredentials {
  accountId: AccountId;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  mfaEnabled: boolean;
  mfaSecretEncrypted?: string | null;
  failedLoginAttempts: number;
  lockedUntil?: IsoDateTimeString | null;
  passwordChangedAt?: IsoDateTimeString | null;
}
