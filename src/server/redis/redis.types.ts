/**
 * My Travelroad — Redis Session Store Types & Constants
 * Defines telemetry models, family records, lookup schemas, and Lua result interfaces.
 * References: docs/architecture/api-architecture.md Section 6.3
 */

/** Session TTL in seconds (30 days). */
export const SESSION_TTL_SECONDS = 2592000;

/** Revoked token tombstone TTL in seconds (24 hours). */
export const TOMBSTONE_TTL_SECONDS = 86400;

/** Compromised family retention TTL in seconds (24 hours). */
export const COMPROMISED_FAMILY_TTL_SECONDS = 86400;

/**
 * Token Family tracking record stored in Redis hash `family:{familyId}`.
 * Tracks lineage, active valid credentials, and compromise state.
 */
export interface FamilyRecord {
  familyId: string;
  activeSessionId: string;
  activeTokenHash: string;
  rotationSeq: number;
  tokenGeneration: number;
  isCompromised: boolean;
}

/**
 * Active session telemetry stored in Redis hash `session:{familyId}:{sessionId}`.
 */
export interface SessionRecord {
  sessionId: string;
  familyId: string;
  accountId: string;
  tokenHash: string;
  rotationSeq: number;
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Inverted token lookup index stored in Redis key `token_lookup:{familyId}:{tokenHash}`.
 * Maps tokenHash -> { familyId, sessionId, accountId }.
 */
export interface TokenLookupData {
  familyId: string;
  sessionId: string;
  accountId: string;
}

/**
 * Parameters to provision an initial session during login.
 */
export interface CreateSessionParams {
  familyId: string;
  sessionId: string;
  tokenHash: string;
  accountId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: string;
}

/**
 * Parameters for atomic refresh token rotation.
 */
export interface RotateSessionParams {
  familyId: string;
  oldSessionId: string;
  newSessionId: string;
  presentedTokenHash: string;
  replacementTokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
  expiresAt?: string;
}

/**
 * Result of atomic session rotation script.
 */
export type RotationScriptResult =
  | { success: true; newRotationSeq: number }
  | { success: false; reason: "FAMILY_NOT_FOUND" | "FAMILY_COMPROMISED" | "RACE_OR_REPLAY_DETECTED" | "TOKEN_LOOKUP_NOT_FOUND" | string; error?: string };

/**
 * Parameters for atomic replay revocation.
 */
export interface ReplayRevocationParams {
  familyId: string;
  presentedTokenHash: string;
  expectedActiveTokenHash: string;
  expectedActiveSessionId: string;
  accountId?: string;
}

/**
 * Result of atomic replay revocation script.
 */
export type ReplayRevocationResult =
  | "REPLAY_CONFIRMED"
  | "NOT_A_REPLAY"
  | "ALREADY_REVOKED"
  | "CONCURRENT_ROTATION_DETECTED";

/**
 * Parameters for single-device logout.
 */
export interface LogoutParams {
  familyId: string;
  expectedActiveSessionId: string;
  expectedActiveTokenHash: string;
  accountId?: string;
}

/**
 * Result of single-device logout script.
 */
export type LogoutScriptResult =
  | "LOGOUT_SUCCESS"
  | "ALREADY_LOGGED_OUT"
  | "SESSION_MISMATCH"
  | "SESSION_CORRUPTED";
