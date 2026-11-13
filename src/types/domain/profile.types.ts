/**
 * My Travelroad — Profile Domain Models
 * Represents user-facing identity projections decoupled from authentication credentials.
 */

import type {
  AccountId,
  BusinessProfileId,
  IsoDateTimeString,
  ProfileId,
} from "./common.types";

/** Controlled travel preference tags for personalization and curation. */
export type TravelPreference =
  | "ecotourism_nature"
  | "cultural_heritage"
  | "waterfalls_trekking"
  | "coastal_estuaries"
  | "ayurvedic_wellness"
  | "culinary_food_trails"
  | "wildlife_birdwatching"
  | "photography"
  | "family_friendly";

/**
 * Public tourist and community member profile.
 * Exactly 1:1 with an individual Account.
 */
export interface TouristProfile {
  /** Unique profile identifier. */
  id: ProfileId;

  /** Foreign key pointing to the owning Account. Exactly 1:1. */
  accountId: AccountId;

  /** Public display name (e.g., 'Amina Rahman'). */
  displayName: string;

  /** Unique URL-friendly public handle (e.g., 'amina_explorer', without the leading @). */
  handle: string;

  /** URL to the hosted profile avatar image. */
  avatarUrl?: string | null;

  /** Short public bio or traveler introduction. */
  bio?: string | null;

  /** Self-declared home region or district (e.g., 'Malappuram, Kerala'). */
  homeRegion?: string | null;

  /** Preferred interface language code (e.g., 'en', 'ml'). Default: 'en'. */
  preferredLanguage: string;

  /** Array of interest tags used for recommendation ranking. */
  travelPreferences: TravelPreference[];

  /** Whether this profile is publicly discoverable in community feeds. */
  isPublic: boolean;

  /** Timestamp when the profile was created. */
  createdAt: IsoDateTimeString;

  /** Timestamp when the profile was last modified. */
  updatedAt: IsoDateTimeString;
}

/**
 * Business / Operator Profile (Future Phase Capability).
 * Enables registered regional homestays, tour guides, and eco-operators to claim destinations.
 */
export interface BusinessProfile {
  /** Unique business profile identifier. */
  id: BusinessProfileId;

  /** Owning Account identifier. Exactly 1:1. */
  accountId: AccountId;

  /** Registered legal business or operating trade name. */
  businessName: string;

  /** Official registration number or enterprise license (e.g., Kerala Tourism or DTPC ID). */
  registrationNumber?: string | null;

  /** Business industry category. */
  category:
    | "hospitality_homestay"
    | "licensed_tour_guide"
    | "water_sports_boating"
    | "ayurvedic_center"
    | "handicrafts_artisan"
    | "transport_logistics";

  /** Official business contact email. */
  contactEmail: string;

  /** Official business contact phone. */
  contactPhone: string;

  /** Verified business website URL. */
  websiteUrl?: string | null;

  /** Operating address or physical office location. */
  physicalAddress?: string | null;

  /** Verification badge status for commercial operations. */
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";

  /** Timestamp when the business profile was submitted. */
  createdAt: IsoDateTimeString;

  /** Timestamp when the business profile was last modified. */
  updatedAt: IsoDateTimeString;
}
