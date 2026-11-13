/**
 * My Travelroad — Saved Destinations Domain Models
 * Models bookmarking and itinerary wishlists for authenticated travelers.
 * Enforces duplicate prevention per account.
 */

import type {
  AccountId,
  DestinationId,
  IsoDateTimeString,
  SavedDestinationId,
} from "./common.types";

/**
 * Saved Destination relationship entity.
 * Represents an account bookmarking a destination for future exploration.
 *
 * Integrity Rule: The composite key `(accountId, destinationId)` MUST be uniquely constrained
 * in storage to prevent duplicate saves by the same account.
 */
export interface SavedDestination {
  /** Unique saved destination relationship identifier. */
  id: SavedDestinationId;

  /** Owning traveler account. */
  accountId: AccountId;

  /** Bookmarked destination identifier. */
  destinationId: DestinationId;

  /**
   * Optional custom trip collection tag (e.g., 'Monsoon 2027', 'Nilambur Weekend', 'Heritage Trails').
   * Default: null (standard default wishlist).
   */
  collectionName?: string | null;

  /** Private traveler notes (e.g., 'Visit early morning for bird photography'). */
  personalNotes?: string | null;

  /** Timestamp when the destination was bookmarked. */
  savedAt: IsoDateTimeString;
}

/**
 * Summary view of a traveler's saved collections.
 */
export interface SavedDestinationCollectionSummary {
  collectionName: string;
  totalSaved: number;
  lastAddedAt: IsoDateTimeString;
}
