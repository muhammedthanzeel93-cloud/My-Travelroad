/**
 * My Travelroad — Moderation Domain Models
 * Tracks curator moderation actions, content triage, and user report resolutions.
 */

import type {
  AccountId,
  IsoDateTimeString,
  ModerationRecordId,
  ReportId,
} from "./common.types";

/**
 * Concrete action taken by a moderator during content or report triage.
 */
export type ModerationAction =
  | "dismiss_report"
  | "hide_content"
  | "unhide_content"
  | "edit_content"
  | "delete_content"
  | "warn_user"
  | "suspend_user"
  | "escalate_to_curator"
  | "mark_resolved";

/**
 * Immutable audit record of an administrative or curator moderation intervention.
 */
export interface ModerationRecord {
  /** Unique moderation record identifier. */
  id: ModerationRecordId;

  /** Associated community report identifier, if triggered by a report. */
  reportId?: ReportId | null;

  /** Entity type acted upon. */
  targetType: "destination" | "review" | "community_post" | "comment" | "user_profile";

  /** Unique identifier of the affected entity. */
  targetId: string;

  /** Moderator or curator account who authorized the action. */
  moderatorAccountId: AccountId;

  /** Action executed. */
  action: ModerationAction;

  /** Official justification or internal policy basis for the moderation decision. */
  justificationReason: string;

  /** Internal notes detailing what corrections were applied or communication sent. */
  internalNotes?: string | null;

  /** Timestamp when the action was recorded. */
  createdAt: IsoDateTimeString;
}
