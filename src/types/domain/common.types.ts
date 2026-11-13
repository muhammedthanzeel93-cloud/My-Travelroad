/**
 * My Travelroad — Domain Modeling Foundation
 * Common domain primitives, nominal branded IDs, and geospatial types.
 */

/** Brand symbol to enforce nominal/branded ID types at compile time. */
declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

/** Nominal entity identifiers preventing accidental ID cross-assignment. */
export type AccountId = Brand<string, "AccountId">;
export type ProfileId = Brand<string, "ProfileId">;
export type BusinessProfileId = Brand<string, "BusinessProfileId">;
export type DestinationId = Brand<string, "DestinationId">;
export type CategoryId = Brand<string, "CategoryId">;
export type MediaId = Brand<string, "MediaId">;
export type VerificationId = Brand<string, "VerificationId">;
export type VerificationRecordId = Brand<string, "VerificationRecordId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type SavedDestinationId = Brand<string, "SavedDestinationId">;
export type AuditLogId = Brand<string, "AuditLogId">;
export type ModerationRecordId = Brand<string, "ModerationRecordId">;

// Future-phase identifiers
export type CommunityPostId = Brand<string, "CommunityPostId">;
export type CommentId = Brand<string, "CommentId">;
export type LikeId = Brand<string, "LikeId">;
export type FollowId = Brand<string, "FollowId">;
export type ReviewId = Brand<string, "ReviewId">;
export type ReportId = Brand<string, "ReportId">;

/** ISO 8601 representation of UTC date-time (e.g., '2026-11-13T10:00:00Z'). */
export type IsoDateTimeString = string;

/** ISO 3166-1 alpha-2 two-letter country code (e.g., 'IN', 'AE', 'GB'). */
export type CountryCode = string;

/**
 * Standard WGS 84 geographic coordinate point structured for future PostGIS integration.
 * In PostGIS, coordinates are indexed as POINT(longitude latitude) with SRID 4326.
 */
export interface GeoPoint {
  /** WGS 84 Latitude in decimal degrees (-90.0 to 90.0). */
  latitude: number;
  /** WGS 84 Longitude in decimal degrees (-180.0 to 180.0). */
  longitude: number;
  /** Optional elevation above mean sea level in meters. */
  altitudeMeters?: number | null;
  /** Accuracy radius in meters when recorded via field GPS. */
  accuracyMeters?: number | null;
  /**
   * PostGIS-ready coordinate tuple: [longitude, latitude].
   * Standard GeoJSON and PostGIS Point geometry order.
   */
  postGisPoint: [longitude: number, latitude: number];
}

/**
 * Privacy and sensitivity classification for destination coordinates.
 * Sensitive ecological zones, protected breeding sites, or tribal settlements
 * must not expose precise coordinates to public APIs without editorial clearance.
 */
export interface CoordinateSensitivity {
  /** When true, exact GPS coordinates must be hidden from public API consumers. */
  isRestricted: boolean;
  /** Reason for coordinate restriction if applicable. */
  restrictionReason?:
    | "wildlife_protection"
    | "tribal_settlement"
    | "defense_boundary"
    | "hazardous_terrain"
    | "private_property"
    | null;
  /** Approximate public centroid shown on maps when exact coordinates are restricted. */
  publicApproximateCentroid?: {
    latitude: number;
    longitude: number;
    displayName: string;
  } | null;
}

/** Standard pagination metadata container. */
export interface DomainPaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
