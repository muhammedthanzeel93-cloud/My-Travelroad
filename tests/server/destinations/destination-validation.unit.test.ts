/**
 * My Travelroad — Destination Validation Unit Tests
 * tests/server/destinations/destination-validation.unit.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  createDestinationSchema,
  updateDestinationSchema,
  listDestinationsQuerySchema,
  adminListDestinationsQuerySchema,
  searchDestinationsQuerySchema,
  coordinateTupleSchema,
  destinationLocationInputSchema,
  destinationOpeningHoursSchema,
  dayScheduleSchema,
  feeStructureSchema,
} from "../../../src/server/destinations/destination.schema";

describe("Destination Schema Validation Unit Tests", () => {
  const validLocation = {
    coordinates: [76.3125, 11.3412] as [number, number],
    formattedAddress: "Kurmbalangod Village, Nilambur Taluk, Malappuram 679334",
    locality: "Kurmbalangod",
    talukOrSubdivision: "Nilambur",
    district: "Malappuram",
    stateOrProvince: "Kerala",
    countryCode: "IN",
    isRestricted: false,
  };

  const validCreatePayload = {
    title: "Adyanpara Cascades",
    slug: "adyanpara-cascades",
    shortDescription: "A picturesque cascade nestled in the Kurmbalangod forest.",
    fullDescription: "Comprehensive editorial description of Adyanpara waterfalls with rich cultural context.",
    primaryCategoryId: "11111111-1111-4000-a000-000000000001",
    secondaryCategoryIds: ["22222222-2222-4000-a000-000000000002"],
    location: validLocation,
  };

  describe("coordinateTupleSchema", () => {
    it("accepts valid WGS 84 coordinates within Kerala bounds", () => {
      expect(coordinateTupleSchema.safeParse([76.3125, 11.3412]).success).toBe(true);
      expect(coordinateTupleSchema.safeParse([0, 0]).success).toBe(true);
      expect(coordinateTupleSchema.safeParse([-180, -90]).success).toBe(true);
      expect(coordinateTupleSchema.safeParse([180, 90]).success).toBe(true);
    });

    it("rejects out-of-bounds longitude or latitude", () => {
      expect(coordinateTupleSchema.safeParse([180.1, 11.0]).success).toBe(false);
      expect(coordinateTupleSchema.safeParse([-180.5, 11.0]).success).toBe(false);
      expect(coordinateTupleSchema.safeParse([76.0, 90.5]).success).toBe(false);
      expect(coordinateTupleSchema.safeParse([76.0, -90.1]).success).toBe(false);
    });

    it("rejects non-numeric, NaN, and Infinity coordinates", () => {
      expect(coordinateTupleSchema.safeParse([NaN, 11.0]).success).toBe(false);
      expect(coordinateTupleSchema.safeParse([76.0, Infinity]).success).toBe(false);
      expect(coordinateTupleSchema.safeParse(["76.0", 11.0]).success).toBe(false);
    });
  });

  describe("createDestinationSchema", () => {
    it("successfully parses a valid complete destination payload", () => {
      const parsed = createDestinationSchema.parse(validCreatePayload);
      expect(parsed.title).toBe("Adyanpara Cascades");
      expect(parsed.slug).toBe("adyanpara-cascades");
      expect(parsed.primaryCategoryId).toBe("11111111-1111-4000-a000-000000000001");
      expect(parsed.location.coordinates).toEqual([76.3125, 11.3412]);
    });

    it("normalizes and trims whitespace from titles and descriptions", () => {
      const parsed = createDestinationSchema.parse({
        ...validCreatePayload,
        title: "  Adyanpara Cascades  ",
        shortDescription: "  A picturesque cascade nestled in the Kurmbalangod forest.  ",
        slug: "  adyanpara-cascades  ",
      });
      expect(parsed.title).toBe("Adyanpara Cascades");
      expect(parsed.slug).toBe("adyanpara-cascades");
    });

    it("rejects title shorter than 2 characters", () => {
      const result = createDestinationSchema.safeParse({
        ...validCreatePayload,
        title: "A",
      });
      expect(result.success).toBe(false);
    });

    it("rejects shortDescription shorter than 10 characters", () => {
      const result = createDestinationSchema.safeParse({
        ...validCreatePayload,
        shortDescription: "Too short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects fullDescription shorter than 20 characters", () => {
      const result = createDestinationSchema.safeParse({
        ...validCreatePayload,
        fullDescription: "Short text",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid slug formats (spaces, uppercase, non-alphanumeric, double-hyphens)", () => {
      expect(createDestinationSchema.safeParse({ ...validCreatePayload, slug: "Invalid Slug" }).success).toBe(false);
      expect(createDestinationSchema.safeParse({ ...validCreatePayload, slug: "-start-hyphen" }).success).toBe(false);
      expect(createDestinationSchema.safeParse({ ...validCreatePayload, slug: "end-hyphen-" }).success).toBe(false);
      expect(createDestinationSchema.safeParse({ ...validCreatePayload, slug: "special@slug!" }).success).toBe(false);
    });

    it("rejects invalid UUIDs for primaryCategoryId", () => {
      const result = createDestinationSchema.safeParse({
        ...validCreatePayload,
        primaryCategoryId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects unknown or injected properties (mass assignment defense via .strict())", () => {
      const result = createDestinationSchema.safeParse({
        ...validCreatePayload,
        publicationStatus: "published", // Injected privileged field
        featuredRank: 1,
        isVerified: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid location coordinates inside payload", () => {
      const result = createDestinationSchema.safeParse({
        ...validCreatePayload,
        location: {
          ...validLocation,
          coordinates: [200.0, 11.0], // Out of bounds longitude
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateDestinationSchema", () => {
    it("allows valid partial update fields", () => {
      const result = updateDestinationSchema.safeParse({
        shortDescription: "Updated summary of cascade trails.",
        featuredRank: 5,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.shortDescription).toBe("Updated summary of cascade trails.");
        expect(result.data.featuredRank).toBe(5);
      }
    });

    it("rejects mass assignment of immutable or state machine fields", () => {
      expect(
        updateDestinationSchema.safeParse({
          publicationStatus: "published",
        }).success
      ).toBe(false);

      expect(
        updateDestinationSchema.safeParse({
          id: "550e8400-e29b-41d4-a716-446655440003",
        }).success
      ).toBe(false);

      expect(
        updateDestinationSchema.safeParse({
          createdAt: "2026-01-01T00:00:00.000Z",
        }).success
      ).toBe(false);
    });
  });

  describe("listDestinationsQuerySchema", () => {
    it("defaults page=1, limit=20, and sort=createdAt:desc", () => {
      const parsed = listDestinationsQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sort).toBe("createdAt:desc");
    });

    it("rejects limit greater than 100", () => {
      expect(listDestinationsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    });

    it("rejects unapproved sort criteria", () => {
      expect(listDestinationsQuerySchema.safeParse({ sort: "password:asc" }).success).toBe(false);
      expect(listDestinationsQuerySchema.safeParse({ sort: "drop_table" }).success).toBe(false);
    });
  });

  describe("adminListDestinationsQuerySchema", () => {
    it("accepts valid publication status filters", () => {
      expect(adminListDestinationsQuerySchema.safeParse({ status: "draft" }).success).toBe(true);
      expect(adminListDestinationsQuerySchema.safeParse({ status: "in_review" }).success).toBe(true);
      expect(adminListDestinationsQuerySchema.safeParse({ status: "published" }).success).toBe(true);
      expect(adminListDestinationsQuerySchema.safeParse({ status: "archived" }).success).toBe(true);
    });

    it("rejects invalid status filters", () => {
      expect(adminListDestinationsQuerySchema.safeParse({ status: "unknown_status" }).success).toBe(false);
    });
  });

  describe("searchDestinationsQuerySchema", () => {
    it("accepts valid text query and pagination", () => {
      const parsed = searchDestinationsQuerySchema.parse({
        q: "Nilambur teak",
        page: 1,
        limit: 10,
      });
      expect(parsed.q).toBe("Nilambur teak");
      expect(parsed.limit).toBe(10);
    });

    it("accepts valid near coordinate string", () => {
      const parsed = searchDestinationsQuerySchema.parse({
        near: "76.22,11.28",
        radiusKm: 25,
      });
      expect(parsed.near).toBe("76.22,11.28");
      expect(parsed.radiusKm).toBe(25);
    });

    it("rejects malformed near parameter", () => {
      expect(searchDestinationsQuerySchema.safeParse({ near: "invalid" }).success).toBe(false);
      expect(searchDestinationsQuerySchema.safeParse({ near: "250.0,11.0" }).success).toBe(false); // Out of bounds
    });

    it("accepts valid bounding box coordinates", () => {
      const parsed = searchDestinationsQuerySchema.parse({
        bbox: "75.8,10.8,76.5,11.5",
      });
      expect(parsed.bbox).toBe("75.8,10.8,76.5,11.5");
    });

    it("accepts antimeridian-crossing bounding box coordinates (minLon > maxLon)", () => {
      const parsed = searchDestinationsQuerySchema.parse({
        bbox: "175.0,10.0,-175.0,12.0",
      });
      expect(parsed.bbox).toBe("175.0,10.0,-175.0,12.0");
    });

    it("rejects invalid bounding box coordinates", () => {
      // Inverted latitudes: minLat (12.0) > maxLat (10.0)
      expect(searchDestinationsQuerySchema.safeParse({ bbox: "75.8,12.0,76.5,10.0" }).success).toBe(false);
      // Latitude out of bounds
      expect(searchDestinationsQuerySchema.safeParse({ bbox: "75.8,-95.0,76.5,10.0" }).success).toBe(false);
      // Longitude out of bounds
      expect(searchDestinationsQuerySchema.safeParse({ bbox: "-185.0,10.0,76.5,12.0" }).success).toBe(false);
    });
  });

  describe("destinationLocationInputSchema", () => {
    it("accepts unrestricted location without publicApproximateDisplayName", () => {
      const result = destinationLocationInputSchema.safeParse(validLocation);
      expect(result.success).toBe(true);
    });

    it("rejects restricted location without publicApproximateDisplayName", () => {
      const result = destinationLocationInputSchema.safeParse({
        ...validLocation,
        isRestricted: true,
        restrictionReason: "wildlife_protection",
      });
      expect(result.success).toBe(false);
    });

    it("accepts restricted location with valid publicApproximateDisplayName and approved reason", () => {
      const result = destinationLocationInputSchema.safeParse({
        ...validLocation,
        isRestricted: true,
        restrictionReason: "wildlife_protection",
        publicApproximateDisplayName: "Nilambur Forest Division Buffer Area",
        publicApproximateCentroid: [76.3, 11.3],
      });
      expect(result.success).toBe(true);
    });

    it("rejects restricted location with unapproved restriction reason", () => {
      const result = destinationLocationInputSchema.safeParse({
        ...validLocation,
        isRestricted: true,
        restrictionReason: "unapproved_reason",
        publicApproximateDisplayName: "Buffer Area",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("dayScheduleSchema", () => {
    it("accepts standard daytime open schedule", () => {
      const result = dayScheduleSchema.safeParse({
        dayOfWeek: 1,
        isClosed: false,
        openTime: "09:00",
        closeTime: "17:30",
      });
      expect(result.success).toBe(true);
    });

    it("accepts overnight open schedule (closeTime < openTime)", () => {
      const result = dayScheduleSchema.safeParse({
        dayOfWeek: 5,
        isClosed: false,
        openTime: "22:00",
        closeTime: "04:00",
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero duration schedule (openTime === closeTime)", () => {
      const result = dayScheduleSchema.safeParse({
        dayOfWeek: 2,
        isClosed: false,
        openTime: "10:00",
        closeTime: "10:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejects open day missing openTime or closeTime", () => {
      expect(
        dayScheduleSchema.safeParse({
          dayOfWeek: 3,
          isClosed: false,
          openTime: "09:00",
        }).success
      ).toBe(false);

      expect(
        dayScheduleSchema.safeParse({
          dayOfWeek: 3,
          isClosed: false,
          closeTime: "17:00",
        }).success
      ).toBe(false);
    });

    it("accepts closed day with no times specified", () => {
      const result = dayScheduleSchema.safeParse({
        dayOfWeek: 0,
        isClosed: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects closed day specifying openTime or closeTime", () => {
      expect(
        dayScheduleSchema.safeParse({
          dayOfWeek: 0,
          isClosed: true,
          openTime: "09:00",
        }).success
      ).toBe(false);

      expect(
        dayScheduleSchema.safeParse({
          dayOfWeek: 0,
          isClosed: true,
          closeTime: "17:00",
        }).success
      ).toBe(false);
    });
  });

  describe("feeStructureSchema", () => {
    it("accepts isFree: true with no fees", () => {
      const result = feeStructureSchema.safeParse({
        isFree: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects isFree: true when positive fees are present", () => {
      const result = feeStructureSchema.safeParse({
        isFree: true,
        adultFee: 50,
      });
      expect(result.success).toBe(false);
    });

    it("accepts isFree: false with valid adult fee", () => {
      const result = feeStructureSchema.safeParse({
        isFree: false,
        currency: "INR",
        adultFee: 100,
      });
      expect(result.success).toBe(true);
    });

    it("rejects isFree: false when no fees, permit, or booking URL are provided", () => {
      const result = feeStructureSchema.safeParse({
        isFree: false,
        currency: "INR",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("destinationOpeningHoursSchema", () => {
    it("accepts weeklySchedule with distinct days of week", () => {
      const result = destinationOpeningHoursSchema.safeParse({
        type: "scheduled",
        weeklySchedule: [
          { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 2, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 0, isClosed: true },
        ],
        entryFeePolicy: "free",
        feeStructure: { isFree: true },
      });
      expect(result.success).toBe(true);
    });

    it("rejects weeklySchedule with duplicate days of the week", () => {
      const result = destinationOpeningHoursSchema.safeParse({
        type: "scheduled",
        weeklySchedule: [
          { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 1, isClosed: true }, // Duplicate Monday (1)
        ],
        entryFeePolicy: "free",
      });
      expect(result.success).toBe(false);
    });

    it("rejects entryFeePolicy conflict between policy: free and feeStructure: not free", () => {
      const result = destinationOpeningHoursSchema.safeParse({
        type: "always_open",
        entryFeePolicy: "free",
        feeStructure: { isFree: false, adultFee: 50 },
      });
      expect(result.success).toBe(false);
    });

    it("rejects entryFeePolicy conflict between policy: paid and feeStructure: free", () => {
      const result = destinationOpeningHoursSchema.safeParse({
        type: "always_open",
        entryFeePolicy: "paid",
        feeStructure: { isFree: true },
      });
      expect(result.success).toBe(false);
    });

    it("accepts entryFeePolicy: restricted_permit with feeStructure", () => {
      const result = destinationOpeningHoursSchema.safeParse({
        type: "always_open",
        entryFeePolicy: "restricted_permit",
        feeStructure: { isFree: false, specialPermitRequired: true, adultFee: 200 },
      });
      expect(result.success).toBe(true);
    });
  });
});
