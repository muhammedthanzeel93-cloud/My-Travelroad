/**
 * My Travelroad — Destination Management Types & DTOs
 * Reference: docs/architecture/api-contracts.md (Module D & Admin Module F)
 */

import { DestinationPublicationStatus } from "../../types/domain/destination.types";

export interface GeoCoordinateTuple {
  longitude: number;
  latitude: number;
}

export interface NearestTransitHubDto {
  type: "airport" | "railway_station" | "bus_terminal";
  name: string;
  distanceKm: number;
  travelTimeMinutesApprox?: number | null;
}

export interface DayScheduleDto {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  isClosed: boolean;
  openTime?: string | null;
  closeTime?: string | null;
}

export interface AdmissionFeeStructureDto {
  currency: string;
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

export interface DestinationOpeningHoursDto {
  type: "always_open" | "seasonal" | "scheduled" | "temporarily_closed";
  weeklySchedule?: DayScheduleDto[] | null;
  seasonalNotes?: string | null;
  entryFeePolicy: "free" | "paid" | "partially_paid" | "restricted_permit";
  feeStructure?: AdmissionFeeStructureDto | null;
  advisoryNote?: string | null;
}

export interface DestinationLocationInputDto {
  coordinates: [number, number]; // [longitude, latitude]
  altitudeMeters?: number | null;
  accuracyMeters?: number | null;
  isRestricted?: boolean;
  restrictionReason?: string | null;
  publicApproximateCentroid?: [number, number] | null; // [longitude, latitude]
  publicApproximateDisplayName?: string | null;
  formattedAddress: string;
  locality?: string | null;
  talukOrSubdivision: string;
  district: string;
  stateOrProvince?: string;
  countryCode?: string;
  postalCode?: string | null;
  nearestTransitHub?: NearestTransitHubDto | null;
}

export interface CreateDestinationInputDto {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  primaryCategoryId: string;
  secondaryCategoryIds?: string[];
  location: DestinationLocationInputDto;
  openingHours?: DestinationOpeningHoursDto | null;
}

export interface UpdateDestinationInputDto {
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  primaryCategoryId?: string;
  secondaryCategoryIds?: string[];
  featuredRank?: number | null;
  location?: Partial<DestinationLocationInputDto>;
}

export interface DestinationListQueryDto {
  page?: number;
  limit?: number;
  category?: string; // category slug
  district?: string;
  sort?: string;
}

export interface AdminDestinationListQueryDto {
  page?: number;
  limit?: number;
  status?: DestinationPublicationStatus;
  category?: string;
  district?: string;
  search?: string;
  sort?: string;
}

export interface DestinationSearchQueryDto {
  q?: string;
  near?: string; // "lon,lat"
  radiusKm?: number;
  bbox?: string; // "minLon,minLat,maxLon,maxLat"
  page?: number;
  limit?: number;
}

export interface RequestAuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}
