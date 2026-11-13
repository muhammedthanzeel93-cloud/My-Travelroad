/**
 * My Travelroad — Audit Logging Domain Models
 * Immutable audit trail capturing all privileged administrative operations and entity mutations.
 */

import type { AccountId, AuditLogId, IsoDateTimeString } from "./common.types";
import type { UserRole } from "./account.types";

/**
 * Standardized taxonomy of auditable administrative actions.
 */
export type AdminAction =
  // Destination operations
  | "destination.create"
  | "destination.update"
  | "destination.publish"
  | "destination.unpublish"
  | "destination.archive"
  | "destination.delete"
  // Verification operations
  | "verification.field_verify"
  | "verification.field_dispute"
  | "verification.status_update"
  | "verification.evidence_attach"
  // Category operations
  | "category.create"
  | "category.update"
  | "category.reorder"
  | "category.archive"
  // Account and role administration
  | "account.role_elevate"
  | "account.role_demote"
  | "account.suspend"
  | "account.reactivate"
  // Moderation operations
  | "moderation.report_resolve"
  | "moderation.report_dismiss"
  | "moderation.content_hide";

/**
 * Audit Actor metadata snapshot.
 * Preserves the actor's role and identity at the exact moment the action occurred.
 */
export interface AuditActor {
  accountId: AccountId;
  email: string;
  roleAtExecution: UserRole;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Immutable Audit Log Entry.
 * Records state mutations, privilege changes, and verification certifications.
 */
export interface AuditLog {
  /** Unique audit entry identifier. */
  id: AuditLogId;

  /** Actor who performed the operation. */
  actor: AuditActor;

  /** Categorized admin action performed. */
  action: AdminAction;

  /** Classification of the mutated entity. */
  entityType:
    | "destination"
    | "category"
    | "verification"
    | "verification_evidence"
    | "account"
    | "tourist_profile"
    | "business_profile"
    | "moderation_record"
    | "user_report";

  /** Identifier of the mutated entity. */
  entityId: string;

  /** Serialized snapshot of relevant fields before the change. Null for creation events. */
  previousStateSnapshot?: Record<string, unknown> | null;

  /** Serialized snapshot of relevant fields after the change. Null for deletion events. */
  newStateSnapshot?: Record<string, unknown> | null;

  /** Explanatory remarks or administrative ticket reference. */
  contextNotes?: string | null;

  /** Exact UTC timestamp of execution. */
  timestamp: IsoDateTimeString;
}
