/**
 * My Travelroad — Destination Validation Schemas
 * Enforces strict request schema validation using Zod.
 * Reference: docs/architecture/api-contracts.md (Module D & Admin Module F) & openapi.yaml
 */

import { z } from "zod";
import { validateCoordinates, validateBoundingBox } from "../../lib/db";

/**
 * Slug regex: lowercase letters, numbers, and hyphens (cannot start or end with hyphen).
 */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Coordinate tuple schema: [longitude, latitude].
 * WGS 84 bounds: lon in [-180, 180], lat in [-90, 90], must be finite numbers.
 */
export const coordinateTupleSchema = z
  .tuple([z.number(), z.number()])
  .refine(
    ([lon, lat]) => validateCoordinates(lon, lat),
    "Invalid WGS 84 coordinates: longitude must be between -180 and 180, latitude between -90 and 90, and both must be finite numbers"
  );

/**
 * Nearest transit hub schema.
 */
export const nearestTransitHubSchema = z
  .object({
    type: z.enum(["airport", "railway_station", "bus_terminal"]),
    name: z.string().min(2).max(150),
    distanceKm: z.number().positive().max(500),
    travelTimeMinutesApprox: z.number().int().positive().max(1440).optional().nullable(),
  })
  .strict();

/**
 * Authoritative restriction reasons permitted in the database check constraint ck_locations_restriction_reason.
 */
export const RESTRICTION_REASONS = [
  "wildlife_protection",
  "tribal_settlement",
  "defense_boundary",
  "hazardous_terrain",
  "private_property",
] as const;

export type RestrictionReason = (typeof RESTRICTION_REASONS)[number];

export const baseDestinationLocationSchema = z
  .object({
    coordinates: coordinateTupleSchema,
    altitudeMeters: z.number().min(-500).max(9000).optional().nullable(),
    accuracyMeters: z.number().positive().max(1000).optional().nullable(),
    isRestricted: z.boolean().default(false),
    restrictionReason: z.enum(RESTRICTION_REASONS).optional().nullable(),
    publicApproximateCentroid: coordinateTupleSchema.optional().nullable(),
    publicApproximateDisplayName: z.string().max(150).optional().nullable(),
    formattedAddress: z.string().min(5).max(500),
    locality: z.string().max(120).optional().nullable(),
    talukOrSubdivision: z.string().min(2).max(100),
    district: z.string().min(2).max(100),
    stateOrProvince: z.string().min(2).max(100).default("Kerala"),
    countryCode: z.string().length(2).default("IN"),
    postalCode: z.string().max(20).optional().nullable(),
    nearestTransitHub: nearestTransitHubSchema.optional().nullable(),
  })
  .strict();

/**
 * Destination location input schema with strict restriction validation.
 */
export const destinationLocationInputSchema = baseDestinationLocationSchema.superRefine(
  (data, ctx) => {
    if (data.isRestricted) {
      if (!data.publicApproximateDisplayName || data.publicApproximateDisplayName.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Restricted destinations must specify a publicApproximateDisplayName",
          path: ["publicApproximateDisplayName"],
        });
      }
    }
  }
);

export const updateDestinationLocationSchema = baseDestinationLocationSchema.partial();

/**
 * Opening hours day schedule schema.
 */
export const dayScheduleSchema = z
  .object({
    dayOfWeek: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    isClosed: z.boolean(),
    openTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:mm 24-hour format")
      .optional()
      .nullable(),
    closeTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:mm 24-hour format")
      .optional()
      .nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.isClosed) {
      if (data.openTime != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Closed days must not specify an openTime",
          path: ["openTime"],
        });
      }
      if (data.closeTime != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Closed days must not specify a closeTime",
          path: ["closeTime"],
        });
      }
    } else {
      if (!data.openTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Open days must specify an openTime in HH:mm format",
          path: ["openTime"],
        });
      }
      if (!data.closeTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Open days must specify a closeTime in HH:mm format",
          path: ["closeTime"],
        });
      }
      if (data.openTime && data.closeTime && data.openTime === data.closeTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "openTime and closeTime cannot be identical (zero duration)",
          path: ["closeTime"],
        });
      }
    }
  });

/**
 * Admission fee structure schema.
 */
export const feeStructureSchema = z
  .object({
    currency: z.string().length(3).default("INR"),
    isFree: z.boolean(),
    adultFee: z.number().min(0).optional().nullable(),
    childFee: z.number().min(0).optional().nullable(),
    foreignNationalFee: z.number().min(0).optional().nullable(),
    stillCameraFee: z.number().min(0).optional().nullable(),
    videoCameraFee: z.number().min(0).optional().nullable(),
    vehicleParkingFee: z.number().min(0).optional().nullable(),
    ticketBookingUrl: z.string().url().max(500).optional().nullable(),
    specialPermitRequired: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const feeValues = [
      data.adultFee,
      data.childFee,
      data.foreignNationalFee,
      data.stillCameraFee,
      data.videoCameraFee,
      data.vehicleParkingFee,
    ].filter((v): v is number => typeof v === "number");

    if (data.isFree) {
      const positiveFees = feeValues.filter((v) => v > 0);
      if (positiveFees.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Free entry destinations must not specify positive admission fees",
          path: ["isFree"],
        });
      }
    } else {
      const positiveFees = feeValues.filter((v) => v > 0);
      if (positiveFees.length === 0 && !data.ticketBookingUrl && !data.specialPermitRequired) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Paid entry destinations must specify at least one positive fee amount, booking URL, or special permit requirement",
          path: ["isFree"],
        });
      }
    }
  });

/**
 * Destination opening hours schema.
 */
export const destinationOpeningHoursSchema = z
  .object({
    type: z.enum(["always_open", "seasonal", "scheduled", "temporarily_closed"]),
    weeklySchedule: z
      .array(dayScheduleSchema)
      .max(7, "Weekly schedule cannot exceed 7 days")
      .optional()
      .nullable(),
    seasonalNotes: z.string().max(500).optional().nullable(),
    entryFeePolicy: z.enum(["free", "paid", "partially_paid", "restricted_permit"]),
    feeStructure: feeStructureSchema.optional().nullable(),
    advisoryNote: z.string().max(500).optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.weeklySchedule && data.weeklySchedule.length > 0) {
      const daySet = new Set(data.weeklySchedule.map((d) => d.dayOfWeek));
      if (daySet.size !== data.weeklySchedule.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Weekly schedule must not contain duplicate days of the week",
          path: ["weeklySchedule"],
        });
      }
    }

    if (data.feeStructure) {
      if (data.entryFeePolicy === "free" && !data.feeStructure.isFree) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "entryFeePolicy 'free' conflicts with feeStructure.isFree = false",
          path: ["entryFeePolicy"],
        });
      }
      if (data.entryFeePolicy === "paid" && data.feeStructure.isFree) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "entryFeePolicy 'paid' conflicts with feeStructure.isFree = true",
          path: ["entryFeePolicy"],
        });
      }
    }
  });

/**
 * Schema for POST /api/v1/admin/destinations (Create Destination Draft)
 */
export const createDestinationSchema = z
  .object({
    title: z.string().min(2, "Title must be at least 2 characters").max(200, "Title must not exceed 200 characters").transform((v) => v.trim()),
    slug: z
      .string()
      .min(2, "Slug must be at least 2 characters")
      .max(120, "Slug must not exceed 120 characters")
      .transform((v) => v.trim().toLowerCase())
      .refine((v) => SLUG_REGEX.test(v), {
        message: "Slug must contain only lowercase alphanumeric characters and hyphens, and cannot start or end with a hyphen",
      }),
    shortDescription: z
      .string()
      .min(10, "Short description must be at least 10 characters")
      .max(500, "Short description must not exceed 500 characters")
      .transform((v) => v.trim()),
    fullDescription: z
      .string()
      .min(20, "Full description must be at least 20 characters")
      .transform((v) => v.trim()),
    primaryCategoryId: z.string().uuid("Primary category ID must be a valid UUID"),
    secondaryCategoryIds: z.array(z.string().uuid("Secondary category IDs must be valid UUIDs")).optional().default([]),
    location: destinationLocationInputSchema,
    openingHours: destinationOpeningHoursSchema.optional().nullable(),
  })
  .strict();

/**
 * Schema for PATCH /api/v1/admin/destinations/:id (Partial Update Destination)
 */
export const updateDestinationSchema = z
  .object({
    title: z.string().min(2).max(200).transform((v) => v.trim()).optional(),
    shortDescription: z.string().min(10).max(500).transform((v) => v.trim()).optional(),
    fullDescription: z.string().min(20).transform((v) => v.trim()).optional(),
    primaryCategoryId: z.string().uuid().optional(),
    secondaryCategoryIds: z.array(z.string().uuid()).optional(),
    featuredRank: z.number().int().min(1).max(9999).optional().nullable(),
    location: updateDestinationLocationSchema.optional(),
  })
  .strict();

/**
 * Schema for GET /api/v1/destinations (Public List Query)
 */
export const listDestinationsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    category: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    sort: z
      .enum([
        "featuredRank:asc",
        "featuredRank:desc",
        "createdAt:asc",
        "createdAt:desc",
        "updatedAt:asc",
        "updatedAt:desc",
        "title:asc",
        "title:desc",
      ])
      .default("createdAt:desc"),
  })
  .strict();

/**
 * Schema for GET /api/v1/admin/destinations (Admin List Query)
 */
export const adminListDestinationsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(["draft", "submitted", "in_review", "published", "archived", "suspended"]).optional(),
    category: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    search: z.string().max(100).optional(),
    sort: z
      .enum([
        "createdAt:desc",
        "createdAt:asc",
        "updatedAt:desc",
        "updatedAt:asc",
        "title:asc",
        "title:desc",
        "featuredRank:asc",
        "featuredRank:desc",
      ])
      .default("createdAt:desc"),
  })
  .strict();

/**
 * Schema for GET /api/v1/destinations/search (Public Search Query)
 */
export const searchDestinationsQuerySchema = z
  .object({
    q: z.string().max(100).optional(),
    near: z
      .string()
      .regex(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/, "near must be formatted as 'longitude,latitude'")
      .optional(),
    radiusKm: z.coerce.number().positive().max(100).default(15).optional(),
    bbox: z
      .string()
      .regex(
        /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/,
        "bbox must be formatted as 'minLon,minLat,maxLon,maxLat'"
      )
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict()
  .refine(
    (data) => {
      if (data.bbox) {
        const [minLon, minLat, maxLon, maxLat] = data.bbox.split(",").map(Number);
        return validateBoundingBox({ minLon, minLat, maxLon, maxLat });
      }
      return true;
    },
    { message: "Invalid bounding box coordinates in bbox parameter", path: ["bbox"] }
  )
  .refine(
    (data) => {
      if (data.near) {
        const [lon, lat] = data.near.split(",").map(Number);
        return validateCoordinates(lon, lat);
      }
      return true;
    },
    { message: "Invalid coordinates in near parameter", path: ["near"] }
  );

/**
 * Schema for PUT /api/v1/admin/destinations/:id/opening-hours
 */
export const updateOpeningHoursSchema = destinationOpeningHoursSchema;
