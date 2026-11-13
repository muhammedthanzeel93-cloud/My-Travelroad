/**
 * My Travelroad — Destination Domain Models
 * Core domain entities for tourism destination discovery, locations, operating schedules,
 * accessibility, safety advisories, and rich media assets.
 */

import type {
  CategoryId,
  CountryCode,
  CoordinateSensitivity,
  DestinationId,
  GeoPoint,
  IsoDateTimeString,
  MediaId,
} from "./common.types";

/**
 * Editorial lifecycle publication status of a destination.
 * Note: publication status is intentionally decoupled from verification status!
 * A published destination may have partial field verifications.
 */
export type DestinationPublicationStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "published"
  | "archived"
  | "suspended";

/** Media content type for destination gallery assets. */
export type DestinationMediaType = "image" | "video" | "panorama_360";

/** Copyright and licensing classification for destination media. */
export type MediaLicense =
  | "public_domain"
  | "cc_by"
  | "cc_by_sa"
  | "official_department_press"
  | "contributor_licensed"
  | "proprietary";

/**
 * Media asset associated with a destination.
 */
export interface DestinationMedia {
  /** Unique media identifier. */
  id: MediaId;

  /** Owning destination identifier. */
  destinationId: DestinationId;

  /** Asset medium type. */
  type: DestinationMediaType;

  /** High-resolution asset URL. */
  url: string;

  /** Optimized thumbnail URL for cards and grid previews. */
  thumbnailUrl?: string | null;

  /** Descriptive alt text for screen readers and accessibility. */
  altText: string;

  /** Optional editorial caption displayed beneath the image. */
  caption?: string | null;

  /** Photographer or organizational credit (e.g., 'Kerala Tourism / DTPC Malappuram'). */
  attribution?: string | null;

  /** Asset licensing classification. */
  license: MediaLicense;

  /** Whether this asset serves as the primary cover image on discovery cards. */
  isCover: boolean;

  /** Display sequence order in destination galleries. */
  displayOrder: number;

  /** Media moderation status. */
  status: "pending_review" | "approved" | "rejected";

  /** Timestamp when uploaded. */
  createdAt: IsoDateTimeString;
}

/**
 * Geographic and administrative location model.
 * Scales from Malappuram taluks (Eranad, Nilambur, Tirur, Ponnani, Perinthalmanna, Kondotty, Tirurangadi)
 * to statewide Kerala districts, all Indian states, and international destinations.
 */
export interface DestinationLocation {
  /** Exact WGS 84 coordinate point with PostGIS tuple. */
  coordinates: GeoPoint;

  /** Coordinate sensitivity and privacy controls for restricted/fragile ecosystems. */
  sensitivity: CoordinateSensitivity;

  /** Full formatted postal or regional address. */
  formattedAddress: string;

  /** Specific town, village, or panchayat (e.g., 'Kottakkal', 'Padinjarekkara', 'Vazhikadavu'). */
  locality?: string | null;

  /** Taluk or revenue subdivision (e.g., 'Nilambur', 'Tirur', 'Eranad'). */
  talukOrSubdivision: string;

  /** Revenue district (e.g., 'Malappuram'). */
  district: string;

  /** State or provincial jurisdiction (e.g., 'Kerala'). */
  stateOrProvince: string;

  /** ISO two-letter country code (e.g., 'IN'). */
  countryCode: CountryCode;

  /** Postal / PIN code where applicable. */
  postalCode?: string | null;

  /** Nearest transit connectivity information for traveler trip planning. */
  nearestTransitHub?: {
    type: "airport" | "railway_station" | "bus_terminal";
    name: string;
    distanceKm: number;
    travelTimeMinutesApprox?: number | null;
  } | null;
}

/** Day-of-week operating hours interval. */
export interface DaySchedule {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday ...
  isClosed: boolean;
  openTime?: string | null; // HH:mm 24-hour format
  closeTime?: string | null; // HH:mm 24-hour format
}

/** Entry fee and admission tariff structure. */
export interface AdmissionFeeStructure {
  currency: string; // ISO 4217, e.g. 'INR'
  isFree: boolean;
  adultFee?: number | null;
  childFee?: number | null;
  foreignNationalFee?: number | null;
  stillCameraFee?: number | null;
  videoCameraFee?: number | null;
  vehicleParkingFee?: number | null;
  ticketBookingUrl?: string | null;
  specialPermitRequired?: boolean;
}

/**
 * Operating schedule, season closures, and ticketing policy.
 */
export interface DestinationOpeningHours {
  /** High-level operational pattern. */
  type: "always_open" | "seasonal" | "scheduled" | "temporarily_closed";

  /** Standard weekly schedule days. Null if always open or purely seasonal. */
  weeklySchedule?: DaySchedule[] | null;

  /** Seasonal operational notes (e.g., 'Monsoon closure during heavy rainfall advisory'). */
  seasonalNotes?: string | null;

  /** Admission tariff policy classification. */
  entryFeePolicy: "free" | "paid" | "partially_paid" | "restricted_permit";

  /** Granular tariff breakdown when admission is paid. */
  feeStructure?: AdmissionFeeStructure | null;

  /** General operational advisory notice (e.g., 'Last entry 45 minutes before sunset'). */
  advisoryNote?: string | null;
}

/**
 * Official administrative and emergency contact information.
 */
export interface DestinationContact {
  /** Official visitor inquiry telephone number. */
  phone?: string | null;

  /** Official inquiries email address. */
  email?: string | null;

  /** Verified official website or portal link. */
  officialWebsite?: string | null;

  /** Official managing authority (e.g., 'Kerala Forest Department', 'DTPC Malappuram', 'ASI'). */
  governingAuthority?: string | null;

  /** Nearest local emergency response / ranger phone. */
  emergencyPhone?: string | null;
}

/**
 * Physical accessibility infrastructure parameters.
 */
export interface DestinationAccessibility {
  /** Wheelchair accessibility rating. */
  wheelchairAccessible: "fully" | "partially" | "not_accessible" | "unknown";

  /** Dedicated designated parking facility availability. */
  parkingAvailable: boolean;

  /** Clean public restroom facilities availability. */
  restroomsAvailable: boolean;

  /** Official or licensed local guide services availability. */
  guideServicesAvailable: boolean;

  /** Tactile paths or Braille signage presence. */
  brailleOrTactilePaving: boolean;

  /** Detailed accessibility remarks (e.g., 'Ramped access to main boardwalk only; trails have stone steps'). */
  notes?: string | null;
}

/**
 * Regional safety advisories, seasonal hazards, and emergency proximity.
 */
export interface DestinationSafetyInformation {
  /** Overall environmental and physical risk rating. */
  overallRiskLevel: "low" | "moderate" | "high" | "seasonal_hazard";

  /** Monsoon hazard warning (e.g., slippery rocks, flash-flood hazard at waterfalls). */
  monsoonAdvisory?: string | null;

  /** Wildlife warnings (e.g., wild elephant movement near Nilambur forest fringes). */
  wildlifeAdvisory?: string | null;

  /** Coastal or water body safety (e.g., dangerous undertow at Kadalundi river mouth). */
  waterBodySafety?: string | null;

  /** Mandatory or recommended traveler gear (e.g., 'Sturdy trekking shoes, leech socks, drinking water'). */
  recommendedGear?: string[];

  /** Proximity to the nearest government / district hospital. */
  nearestHospital?: {
    name: string;
    distanceKm: number;
    emergencyPhone?: string | null;
  } | null;

  /** Proximity to the local police station / forest range office. */
  nearestPoliceStation?: {
    name: string;
    distanceKm: number;
    phone?: string | null;
  } | null;
}

/**
 * Core Tourism Destination Entity.
 * Represents a geographical destination, historical landmark, nature reserve, or cultural precinct.
 */
export interface Destination {
  /** Unique nominal destination identifier. */
  id: DestinationId;

  /** URL-friendly unique slug (e.g., 'nilambur-teak-reserve', 'kadalundi-estuary'). */
  slug: string;

  /** Primary display title. */
  title: string;

  /** Concise summary excerpt used on cards, search results, and meta descriptions. */
  shortDescription: string;

  /** Comprehensive editorial description with cultural, ecological, and historical storytelling. */
  fullDescription: string;

  /** Primary category association. Exactly 1 primary category. */
  primaryCategoryId: CategoryId;

  /** Secondary / cross-cutting category associations (e.g., Nature destination also listed under Heritage). */
  secondaryCategoryIds: CategoryId[];

  /** Physical, geographic, and administrative location. */
  location: DestinationLocation;

  /** Operating hours, seasonal advisories, and admission tariffs. */
  openingHours?: DestinationOpeningHours | null;

  /** Official managing authority and emergency contact details. */
  contact?: DestinationContact | null;

  /** Accessibility infrastructure details. */
  accessibility?: DestinationAccessibility | null;

  /** Safety warnings, terrain hazards, and hospital proximity. */
  safety?: DestinationSafetyInformation | null;

  /** Editorial publication lifecycle status. */
  publicationStatus: DestinationPublicationStatus;

  /** Editorial featured priority rank for home and category showcases (null if unfeatured). */
  featuredRank?: number | null;

  /** Timestamp when the destination draft was created. */
  createdAt: IsoDateTimeString;

  /** Timestamp when the destination was last updated. */
  updatedAt: IsoDateTimeString;

  /** Timestamp when the destination was first published live. */
  publishedAt?: string | null;
}
