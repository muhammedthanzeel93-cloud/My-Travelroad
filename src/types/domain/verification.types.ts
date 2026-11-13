/**
 * My Travelroad — Destination Verification Domain Models
 * Implements fact-level verification decoupled from destination publication status.
 * Approval of a destination does NOT mean every field is verified.
 */

import type {
  AccountId,
  DestinationId,
  EvidenceId,
  IsoDateTimeString,
  VerificationId,
  VerificationRecordId,
} from "./common.types";

/**
 * Aggregate verification status of a destination.
 * Represents overall verification confidence across its verified facts.
 */
export type VerificationStatus =
  | "unverified"
  | "in_review"
  | "needs_update"
  | "partially_verified"
  | "verified"
  | "flagged";

/**
 * Specific fact-level fields subject to independent verification.
 * Each fact can be verified, disputed, or outdated independently of others.
 */
export type VerificationField =
  | "location_coordinates"
  | "opening_hours"
  | "entry_fees"
  | "safety_advisories"
  | "accessibility"
  | "contact_info"
  | "historical_facts"
  | "governing_authority";

/**
 * Evidentiary confidence tier supporting a verification claim.
 */
export type VerificationConfidence =
  | "official_authority" // DTPC, Forest Department, Archeological Survey of India gazette
  | "on_site_inspection" // Physical audit by assigned curator or verified guide
  | "documentary_cross_reference" // Cross-referenced against published government circulars
  | "community_consensus"; // High-confidence consensus from multiple verified travelers

/**
 * Classification of documentary or physical proof.
 */
export type EvidenceType =
  | "government_gazette"
  | "department_circular"
  | "official_website"
  | "on_site_gps_track"
  | "photographic_proof"
  | "curator_affidavit"
  | "field_survey_sheet";

/**
 * Evidentiary artifact substantiating a fact verification.
 */
export interface VerificationEvidence {
  /** Unique evidence artifact identifier. */
  id: EvidenceId;

  /** Owning verification container identifier. */
  verificationId: VerificationId;

  /** Type of evidentiary proof. */
  evidenceType: EvidenceType;

  /** External or hosted storage URL to the evidence document/photo/track. */
  documentUrl?: string | null;

  /** Issuing organization or authority (e.g., 'DTPC Malappuram', 'Kerala Forest Dept'). */
  sourceOrganization: string;

  /** Document reference, circular number, or gazette ID if available. */
  officialReferenceCode?: string | null;

  /** Account of the curator or authority who submitted this evidence. */
  submittedBy: AccountId;

  /** Timestamp when evidence was recorded. */
  submittedAt: IsoDateTimeString;

  /** Explanatory notes detailing what the evidence substantiates. */
  notes?: string | null;
}

/**
 * Granular fact-level audit record.
 * Tracks the verification history of an individual field on a destination.
 */
export interface VerificationRecord {
  /** Unique verification record identifier. */
  id: VerificationRecordId;

  /** Owning verification container identifier. */
  verificationId: VerificationId;

  /** Destination being verified. */
  destinationId: DestinationId;

  /** Specific fact field being audited. */
  field: VerificationField;

  /** Status of this individual fact. */
  status: "verified" | "disputed" | "needs_update" | "unverified";

  /** Account of the curator who performed the verification. */
  verifiedBy: AccountId;

  /** Associated evidence artifact validating this fact. */
  evidenceId?: EvidenceId | null;

  /**
   * Cryptographic or serial hash of the verified field payload at the time of verification.
   * Enables automated drift detection: if the destination field is subsequently edited,
   * the hash mismatch automatically flags the field as 'needs_update'.
   */
  verifiedValueSnapshotHash?: string | null;

  /** Confidence tier. */
  confidenceLevel: VerificationConfidence;

  /** Internal curator audit remarks or field observations. */
  notes?: string | null;

  /** Timestamp when this fact verification was certified. */
  timestamp: IsoDateTimeString;

  /** Optional expiration timestamp requiring periodic re-audit (e.g., entry fees require annual check). */
  validUntil?: IsoDateTimeString | null;
}

/**
 * Destination Verification Container.
 * Aggregates overall verification state, granular field statuses, and evidentiary references.
 * Kept strictly separate from public destination storytelling.
 */
export interface DestinationVerification {
  /** Unique verification entity identifier. */
  id: VerificationId;

  /** Target destination identifier. Exactly 1:1 with Destination. */
  destinationId: DestinationId;

  /** High-level verification aggregate status. */
  overallStatus: VerificationStatus;

  /** Lead assigned curator account supervising verification. */
  assignedCuratorId?: AccountId | null;

  /** Timestamp of the most recent field verification update. */
  lastAuditedAt?: IsoDateTimeString | null;

  /** Next scheduled mandatory audit date (e.g., prior to monsoon season). */
  nextAuditDueAt?: IsoDateTimeString | null;

  /** Summary map of field-level verification statuses. */
  fieldStatuses: Record<VerificationField, "verified" | "disputed" | "needs_update" | "unverified">;

  /** Array of evidence artifact IDs linked to this verification container. */
  evidenceIds: EvidenceId[];

  /** High-level curator notes for internal administration and verification queues. */
  curatorQueueNotes?: string | null;

  /** Timestamp when the verification container was created. */
  createdAt: IsoDateTimeString;

  /** Timestamp when the verification container was last modified. */
  updatedAt: IsoDateTimeString;
}
