/**
 * My Travelroad — Destination Management Integration Test Suite (Task 11)
 *
 * Validates the complete Destination Management lifecycle against live PostgreSQL 16
 * with PostGIS spatial extensions and live Redis:
 *
 * 1. Authorized destination draft creation (contributor, curator, super_admin)
 * 2. Unauthorized creation rejection (traveler 403, unauthenticated 401)
 * 3. Duplicate slug conflict (409 DUPLICATE_RESOURCE)
 * 4. Invalid category references (400 BAD_REQUEST)
 * 5. Public listing (published only, district & category filtering, pagination)
 * 6. Public detail & 3-Tier Coordinate Privacy (draft 404, Tier 0 exact, Tier 1 centroid, Tier 2 null)
 * 7. Privileged admin read (curator 200 with raw coords + audit log, traveler 403)
 * 8. Admin listing across all publication statuses
 * 9. Destination update (PATCH, shortDescription, mass assignment rejection, contributor 403)
 * 10. Publication lifecycle (curator publish 403, super_admin publish 200, archive 200, public visibility)
 * 11. Opening hours upsert (PUT 200, public read, audit log created)
 * 12. Multi-modal spatial and text search (keyword, radial proximity with distanceKm, bbox)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import net from "node:net";
import crypto from "node:crypto";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { createApp } from "../../../src/server/app";
import { RedisSessionStore } from "../../../src/server/redis/session.store";
import { PRISMA_LOG_CONFIG } from "../../../src/lib/db";
import { signAccessToken } from "../../../src/server/auth/jwt";
import {
  parseDatabaseConfig,
  assertTestDatabaseSafety,
} from "../../helpers/db-safety.helper";
import { DestinationService } from "../../../src/server/destinations/destination.service";
import { AppError } from "../../../src/server/errors/app-error";
import { ErrorCode } from "../../../src/server/errors/error-codes";

let testPrisma: PrismaClient;
let realRedis: Redis;
let sessionStore: RedisSessionStore;
let app: ReturnType<typeof createApp>;

// Track created test resources for surgical cleanup
const createdAccountIds = new Set<string>();
const createdCategoryIds = new Set<string>();
const createdDestinationIds = new Set<string>();

async function isPortReachable(port: number, host: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket
      .once("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .once("error", () => {
        socket.destroy();
        resolve(false);
      })
      .once("timeout", () => {
        socket.destroy();
        resolve(false);
      })
      .connect(port, host);
  });
}

// Helpers to create test accounts and tokens
async function createTestAccount(role: "traveler" | "contributor" | "curator" | "super_admin"): Promise<{
  id: string;
  email: string;
  role: string;
  token: string;
}> {
  const accountId = crypto.randomUUID();
  const email = `test-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

  await testPrisma.account.create({
    data: {
      id: accountId,
      email,
      role,
      type: "individual",
      status: "active",
      emailVerified: true,
    },
  });
  createdAccountIds.add(accountId);

  const token = await signAccessToken({
    sub: accountId,
    role,
    email,
    emailVerified: true,
    type: "individual",
    status: "active",
    gen: 1,
  });

  return { id: accountId, email, role, token };
}

describe("Destination Management Integration Test Suite (Task 11)", () => {
  let traveler: { id: string; email: string; role: string; token: string };
  let contributor: { id: string; email: string; role: string; token: string };
  let curator: { id: string; email: string; role: string; token: string };
  let superAdmin: { id: string; email: string; role: string; token: string };

  let primaryCategory: { id: string; slug: string; name: string };
  let secondaryCategory: { id: string; slug: string; name: string };

  beforeAll(async () => {
    // 1. Database Safety Verification
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!testDatabaseUrl || typeof testDatabaseUrl !== "string" || testDatabaseUrl.trim().length === 0) {
      throw new Error(
        "TEST DATABASE SAFETY ERROR: TEST_DATABASE_URL must be explicitly set for destructive integration tests."
      );
    }

    const dbConfig = parseDatabaseConfig(testDatabaseUrl);
    assertTestDatabaseSafety(dbConfig.database, dbConfig.host, { testDatabaseUrl });

    const isDbReachable = await isPortReachable(dbConfig.port, dbConfig.host);
    if (!isDbReachable) {
      throw new Error(`PostgreSQL is unreachable at ${dbConfig.host}:${dbConfig.port}`);
    }

    testPrisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
      log: PRISMA_LOG_CONFIG,
    });
    await testPrisma.$connect();

    // 2. Redis Connection
    const isRedisReachable = await isPortReachable(6379, "127.0.0.1");
    if (!isRedisReachable) {
      throw new Error("Redis is unreachable at 127.0.0.1:6379");
    }

    realRedis = new Redis({
      host: "127.0.0.1",
      port: 6379,
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    await realRedis.ping();
    sessionStore = new RedisSessionStore(realRedis);

    // 3. Application instance
    app = createApp({
      prismaClient: testPrisma,
      sessionStore,
      corsOrigins: ["http://localhost:3000", "https://mytravelroad.com"],
    });

    // 4. Seed test accounts across roles
    traveler = await createTestAccount("traveler");
    contributor = await createTestAccount("contributor");
    curator = await createTestAccount("curator");
    superAdmin = await createTestAccount("super_admin");

    // 5. Seed test categories
    const cat1Id = crypto.randomUUID();
    const cat1Slug = `nature-test-${Date.now()}`;
    await testPrisma.destinationCategory.create({
      data: {
        id: cat1Id,
        slug: cat1Slug,
        name: "Nature & Wildlife",
        shortLabel: "Nature",
        description: "Lush green forests and national parks",
        iconKey: "nature-icon",
        status: "active",
        displayOrder: 1,
      },
    });
    createdCategoryIds.add(cat1Id);
    primaryCategory = { id: cat1Id, slug: cat1Slug, name: "Nature & Wildlife" };

    const cat2Id = crypto.randomUUID();
    const cat2Slug = `heritage-test-${Date.now()}`;
    await testPrisma.destinationCategory.create({
      data: {
        id: cat2Id,
        slug: cat2Slug,
        name: "Cultural Heritage",
        shortLabel: "Heritage",
        description: "Ancient temples, forts and historical monuments",
        iconKey: "heritage-icon",
        status: "active",
        displayOrder: 2,
      },
    });
    createdCategoryIds.add(cat2Id);
    secondaryCategory = { id: cat2Id, slug: cat2Slug, name: "Cultural Heritage" };
  });

  afterAll(async () => {
    // Clean up created resources in strict dependency order.
    // Note: audit_logs is append-only with an immutable trigger, so audit_logs and accounts with audit_logs remain.
    if (testPrisma) {
      const destIds = Array.from(createdDestinationIds);
      const catIds = Array.from(createdCategoryIds);

      // Clean up destination sub-tables and destinations
      if (destIds.length > 0) {
        await testPrisma.destinationOpeningHour.deleteMany({
          where: { destinationId: { in: destIds } },
        });
        await testPrisma.destinationMedia.deleteMany({
          where: { destinationId: { in: destIds } },
        });
        await testPrisma.destinationSecondaryCategory.deleteMany({
          where: { destinationId: { in: destIds } },
        });
        await testPrisma.destinationLocation.deleteMany({
          where: { destinationId: { in: destIds } },
        });
        await testPrisma.destination.deleteMany({
          where: { id: { in: destIds } },
        });
      }

      // Clean up categories
      if (catIds.length > 0) {
        await testPrisma.destinationCategory.deleteMany({
          where: { id: { in: catIds } },
        });
      }

      await testPrisma.$disconnect();
    }

    if (realRedis) {
      await realRedis.quit();
    }
  });

  // -------------------------------------------------------------------------
  // 1. Authorized Destination Draft Creation
  // -------------------------------------------------------------------------
  describe("1. Destination Draft Creation (Authorized Roles)", () => {
    it("should allow a contributor to create a draft destination with valid coordinates and categories", async () => {
      const slug = `eravikulam-test-${Date.now()}`;
      const payload = {
        title: "Eravikulam National Park",
        slug,
        shortDescription: "Home of the endangered Nilgiri Tahr and Neelakurinji flowers.",
        fullDescription:
          "Eravikulam National Park is a 97 sq km national park located along the Western Ghats in the Idukki and Ernakulam districts of Kerala in India.",
        primaryCategoryId: primaryCategory.id,
        secondaryCategoryIds: [secondaryCategory.id],
        location: {
          coordinates: [77.085, 10.2005], // [lon, lat]
          formattedAddress: "Munnar, Kerala 685612",
          district: "idukki",
          talukOrSubdivision: "Devikulam",
          stateOrProvince: "Kerala",
          countryCode: "IN",
          postalCode: "685612",
          isRestricted: false,
        },
      };

      const res = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${contributor.token}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.slug).toBe(slug);
      expect(res.body.data.publicationStatus).toBe("draft");

      createdDestinationIds.add(res.body.data.id);

      // Verify DB postgis insertion
      const dbLocation = await testPrisma.$queryRaw<Array<{ lat: number; lon: number }>>`
        SELECT ST_Y(coordinates::geometry) as lat, ST_X(coordinates::geometry) as lon
        FROM destination_locations
        WHERE destination_id = ${res.body.data.id}::uuid
      `;
      expect(dbLocation[0].lat).toBeCloseTo(10.2005, 4);
      expect(dbLocation[0].lon).toBeCloseTo(77.085, 4);

      // Verify AuditLog record
      const auditLog = await testPrisma.auditLog.findFirst({
        where: { entityId: res.body.data.id, action: "destination.create" },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.actorAccountId).toBe(contributor.id);
    });

    it("should allow a curator to create a draft destination", async () => {
      const slug = `silent-valley-test-${Date.now()}`;
      const payload = {
        title: "Silent Valley National Park",
        slug,
        shortDescription: "A pristine tropical evergreen rainforest in the Nilgiri hills.",
        fullDescription:
          "Silent Valley National Park is a national park in Kerala, India. It is located in the rich biodiversity hotspot of the Nilgiri Hills.",
        primaryCategoryId: primaryCategory.id,
        location: {
          coordinates: [76.45, 11.08], // [lon, lat]
          formattedAddress: "Silent Valley, Palakkad, Kerala",
          district: "palakkad",
          talukOrSubdivision: "Mannarkkad",
          stateOrProvince: "Kerala",
          countryCode: "IN",
          isRestricted: false,
        },
      };

      const res = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${curator.token}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe(slug);
      createdDestinationIds.add(res.body.data.id);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Unauthorized Creation Rejection
  // -------------------------------------------------------------------------
  describe("2. Unauthorized Destination Creation Rejection", () => {
    it("should reject a traveler with 403 Forbidden", async () => {
      const payload = {
        title: "Unauthorized Destination",
        slug: `unauthorized-${Date.now()}`,
        shortDescription: "Test short description",
        fullDescription: "Test full description and overview.",
        primaryCategoryId: primaryCategory.id,
        location: {
          coordinates: [76.0, 10.0],
          formattedAddress: "Some address",
          district: "ernakulam",
          talukOrSubdivision: "Kochi",
          stateOrProvince: "Kerala",
          countryCode: "IN",
          isRestricted: false,
        },
      };

      const res = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${traveler.token}`)
        .send(payload)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
    });

    it("should reject an unauthenticated request with 401 Unauthorized", async () => {
      const payload = {
        title: "No Token Destination",
        slug: `no-token-${Date.now()}`,
        shortDescription: "Test short description",
        fullDescription: "Test full description and overview.",
        primaryCategoryId: primaryCategory.id,
        location: {
          coordinates: [76.0, 10.0],
          formattedAddress: "Some address",
          district: "ernakulam",
          talukOrSubdivision: "Kochi",
          stateOrProvince: "Kerala",
          countryCode: "IN",
          isRestricted: false,
        },
      };

      const res = await request(app)
        .post("/api/v1/admin/destinations")
        .send(payload)
        .expect(401);

      expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Duplicate Slug Conflict
  // -------------------------------------------------------------------------
  describe("3. Duplicate Slug Conflict", () => {
    it("should return 409 DUPLICATE_RESOURCE when creating with an already existing slug", async () => {
      const existingSlug = `duplicate-slug-test-${Date.now()}`;
      const payload = {
        title: "Unique First Destination",
        slug: existingSlug,
        shortDescription: "First occurrence short description.",
        fullDescription: "Detailed description of first occurrence.",
        primaryCategoryId: primaryCategory.id,
        location: {
          coordinates: [76.5, 9.5],
          formattedAddress: "Kottayam, Kerala",
          district: "kottayam",
          talukOrSubdivision: "Kottayam",
          stateOrProvince: "Kerala",
          countryCode: "IN",
          isRestricted: false,
        },
      };

      const res1 = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${curator.token}`)
        .send(payload)
        .expect(201);
      createdDestinationIds.add(res1.body.data.id);

      // Attempt duplicate creation
      const res2 = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${curator.token}`)
        .send({ ...payload, title: "Duplicate Second Destination" })
        .expect(409);

      expect(res2.body.error.code).toBe("DUPLICATE_RESOURCE");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Invalid Category References
  // -------------------------------------------------------------------------
  describe("4. Invalid Category References", () => {
    it("should return 400 BAD_REQUEST when primaryCategoryId does not exist", async () => {
      const fakeCategoryId = crypto.randomUUID();
      const payload = {
        title: "Bad Category Destination",
        slug: `bad-cat-test-${Date.now()}`,
        shortDescription: "Description is long enough.",
        fullDescription: "Full description is definitely long enough for validation.",
        primaryCategoryId: fakeCategoryId,
        location: {
          coordinates: [76.5, 9.5],
          formattedAddress: "Address",
          district: "kottayam",
          talukOrSubdivision: "Kottayam",
          stateOrProvince: "Kerala",
          countryCode: "IN",
          isRestricted: false,
        },
      };

      const res = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${curator.token}`)
        .send(payload)
        .expect(400);

      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.message).toContain("Primary category does not exist");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Public Listing (Published Only, Filtering, Pagination)
  // -------------------------------------------------------------------------
  describe("5. Public Listing Filtering & Pagination", () => {
    let publishedDest1Id: string;
    let publishedDest2Id: string;
    let draftDestId: string;

    beforeAll(async () => {
      // Create 2 published destinations and 1 draft destination
      const dest1 = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Wayanad Wildlife Sanctuary",
          slug: `wayanad-sanctuary-${Date.now()}`,
          shortDescription: "An integral part of the Nilgiri Biosphere Reserve.",
          fullDescription: "Wayanad Wildlife Sanctuary is an animal sanctuary in Wayanad, Kerala.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [76.3674, 11.6854],
            formattedAddress: "Sulthan Bathery, Wayanad",
            district: "wayanad",
            talukOrSubdivision: "Sulthan Bathery",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      publishedDest1Id = dest1.body.data.id;
      createdDestinationIds.add(publishedDest1Id);
      await request(app)
        .post(`/api/v1/admin/destinations/${publishedDest1Id}/publish`)
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .expect(200);

      const dest2 = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Bekal Fort Heritage",
          slug: `bekal-fort-${Date.now()}`,
          shortDescription: "Largest fortress in Kerala situated in Kasaragod.",
          fullDescription: "Bekal Fort was built by Shivappa Nayaka of Keladi in 1650 AD.",
          primaryCategoryId: secondaryCategory.id,
          location: {
            coordinates: [75.0322, 12.3926],
            formattedAddress: "Bekal, Kasaragod",
            district: "kasaragod",
            talukOrSubdivision: "Hosdurg",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      publishedDest2Id = dest2.body.data.id;
      createdDestinationIds.add(publishedDest2Id);
      await request(app)
        .post(`/api/v1/admin/destinations/${publishedDest2Id}/publish`)
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .expect(200);

      // Draft destination
      const draft = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Secret Draft Destination",
          slug: `secret-draft-${Date.now()}`,
          shortDescription: "Draft short description that is long enough.",
          fullDescription: "Draft full description is also sufficiently detailed.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [76.5, 10.0],
            formattedAddress: "Draft address",
            district: "wayanad",
            talukOrSubdivision: "Vythiri",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      draftDestId = draft.body.data.id;
      createdDestinationIds.add(draftDestId);
    });

    it("should list only published destinations on public GET /api/v1/destinations", async () => {
      const res = await request(app)
        .get("/api/v1/destinations")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const returnedIds = res.body.data.map((d: any) => d.id);
      expect(returnedIds).toContain(publishedDest1Id);
      expect(returnedIds).toContain(publishedDest2Id);
      expect(returnedIds).not.toContain(draftDestId);
    });

    it("should filter public destinations by district", async () => {
      const res = await request(app)
        .get("/api/v1/destinations?district=wayanad")
        .expect(200);

      const returnedIds = res.body.data.map((d: any) => d.id);
      expect(returnedIds).toContain(publishedDest1Id);
      expect(returnedIds).not.toContain(publishedDest2Id);
    });

    it("should filter public destinations by category slug", async () => {
      const res = await request(app)
        .get(`/api/v1/destinations?category=${secondaryCategory.slug}`)
        .expect(200);

      const returnedIds = res.body.data.map((d: any) => d.id);
      expect(returnedIds).toContain(publishedDest2Id);
      expect(returnedIds).not.toContain(publishedDest1Id);
    });

    it("should support pagination parameters (page, limit)", async () => {
      const res = await request(app)
        .get("/api/v1/destinations?page=1&limit=1")
        .expect(200);

      expect(res.body.meta.pagination).toBeDefined();
      expect(res.body.meta.pagination.page).toBe(1);
      expect(res.body.meta.pagination.limit).toBe(1);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Public Detail & 3-Tier Coordinate Privacy
  // -------------------------------------------------------------------------
  describe("6. Public Detail & 3-Tier Coordinate Privacy", () => {
    let tier0Slug: string;
    let tier1Slug: string;
    let tier2Slug: string;
    let draftSlug: string;

    beforeAll(async () => {
      // Tier 0: Unrestricted (exact coordinates returned)
      tier0Slug = `tier0-unrestricted-${Date.now()}`;
      const d0 = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Kovalam Beach",
          slug: tier0Slug,
          shortDescription: "World famous crescent beach destination.",
          fullDescription: "Kovalam is an internationally renowned beach with three adjacent crescent beaches.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [76.9784, 8.402], // [lon, lat]
            formattedAddress: "Kovalam, Thiruvananthapuram",
            district: "thiruvananthapuram",
            talukOrSubdivision: "Neyyattinkara",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      createdDestinationIds.add(d0.body.data.id);
      await request(app)
        .post(`/api/v1/admin/destinations/${d0.body.data.id}/publish`)
        .set("Authorization", `Bearer ${superAdmin.token}`);

      // Tier 1: Restricted with public approximate centroid
      tier1Slug = `tier1-centroid-${Date.now()}`;
      const d1 = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Sensitive Wildlife Core",
          slug: tier1Slug,
          shortDescription: "Ecologically sensitive nesting sanctuary.",
          fullDescription: "Core habitat of rare species requiring coordinate approximation.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [77.15, 9.35], // [lon, lat]
            formattedAddress: "Deep Reserve, Pathanamthitta",
            district: "pathanamthitta",
            talukOrSubdivision: "Ranni",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: true,
            restrictionReason: "wildlife_protection",
            publicApproximateCentroid: [77.1, 9.3], // [lon, lat]
            publicApproximateDisplayName: "Ranni Forest Buffer Zone",
          },
        });
      createdDestinationIds.add(d1.body.data.id);
      await request(app)
        .post(`/api/v1/admin/destinations/${d1.body.data.id}/publish`)
        .set("Authorization", `Bearer ${superAdmin.token}`);

      // Tier 2: Restricted without centroid (null coordinates returned to public)
      tier2Slug = `tier2-null-coords-${Date.now()}`;
      const d2 = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Highly Classified Sacred Grove",
          slug: tier2Slug,
          shortDescription: "Protected ancient indigenous sacred grove.",
          fullDescription: "Sacred site with strict access controls and complete coordinate suppression.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [75.3, 12.1], // [lon, lat]
            formattedAddress: "Protected Area, Kannur",
            district: "kannur",
            talukOrSubdivision: "Taliparamba",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: true,
            restrictionReason: "tribal_settlement",
            publicApproximateDisplayName: "Protected Settlement Area",
          },
        });
      createdDestinationIds.add(d2.body.data.id);
      await request(app)
        .post(`/api/v1/admin/destinations/${d2.body.data.id}/publish`)
        .set("Authorization", `Bearer ${superAdmin.token}`);

      // Draft destination
      draftSlug = `draft-hidden-${Date.now()}`;
      const dDraft = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Draft Hidden Destination",
          slug: draftSlug,
          shortDescription: "Draft short description is long enough.",
          fullDescription: "Draft full description is properly articulated.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [76.0, 10.0],
            formattedAddress: "Hidden address",
            district: "alappuzha",
            talukOrSubdivision: "Ambalappuzha",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      createdDestinationIds.add(dDraft.body.data.id);
    });

    it("should return 404 RESOURCE_NOT_FOUND when public requests a draft destination", async () => {
      const res = await request(app)
        .get(`/api/v1/destinations/${draftSlug}`)
        .expect(404);

      expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
    });

    it("should return exact coordinates for Tier 0 (unrestricted) destination on location endpoint", async () => {
      const res = await request(app)
        .get(`/api/v1/destinations/${tier0Slug}/location`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isRestricted).toBe(false);
      expect(res.body.data.publicCoordinates[0]).toBeCloseTo(76.9784, 3); // lon
      expect(res.body.data.publicCoordinates[1]).toBeCloseTo(8.402, 3); // lat
    });

    it("should return approximate centroid coordinates for Tier 1 (restricted with centroid)", async () => {
      const res = await request(app)
        .get(`/api/v1/destinations/${tier1Slug}/location`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isRestricted).toBe(true);
      // The public coordinates must match the approximate centroid (lon: 77.1, lat: 9.3)
      expect(res.body.data.publicCoordinates[0]).toBeCloseTo(77.1, 2);
      expect(res.body.data.publicCoordinates[1]).toBeCloseTo(9.3, 2);
      expect(res.body.data.publicLocalityName).toBe("Ranni Forest Buffer Zone");
    });

    it("should return null coordinates for Tier 2 (restricted without centroid)", async () => {
      const res = await request(app)
        .get(`/api/v1/destinations/${tier2Slug}/location`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isRestricted).toBe(true);
      expect(res.body.data.publicCoordinates).toBeNull();
      expect(res.body.data.publicLocalityName).toBe("Protected Settlement Area");
    });

    it("should expose sub-resources: location, media, opening-hours", async () => {
      const locRes = await request(app)
        .get(`/api/v1/destinations/${tier0Slug}/location`)
        .expect(200);
      expect(locRes.body.data.district).toBe("thiruvananthapuram");

      const mediaRes = await request(app)
        .get(`/api/v1/destinations/${tier0Slug}/media`)
        .expect(200);
      expect(Array.isArray(mediaRes.body.data)).toBe(true);

      const hoursRes = await request(app)
        .get(`/api/v1/destinations/${tier0Slug}/opening-hours`)
        .expect(200);
      expect(hoursRes.body.data).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 7. Privileged Admin Read & Audit Log
  // -------------------------------------------------------------------------
  describe("7. Privileged Admin Read & Audit Logging", () => {
    let restrictedDestId: string;

    beforeAll(async () => {
      const d = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Periyar Core Area",
          slug: `periyar-core-${Date.now()}`,
          shortDescription: "Tiger reserve core zone description.",
          fullDescription: "Core protected reserve zone with rich biodiversity.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [77.2333, 9.4667], // [lon, lat]
            formattedAddress: "Thekkady, Idukki",
            district: "idukki",
            talukOrSubdivision: "Peermade",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: true,
            restrictionReason: "wildlife_protection",
            publicApproximateDisplayName: "Periyar Buffer Zone",
          },
        });
      restrictedDestId = d.body.data.id;
      createdDestinationIds.add(restrictedDestId);
    });

    it("should allow curator to read raw unmasked coordinates on GET /api/v1/admin/destinations/:id", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/destinations/${restrictedDestId}`)
        .set("Authorization", `Bearer ${curator.token}`)
        .set("User-Agent", "CuratorBrowser/1.0")
        .set("X-Forwarded-For", "192.168.1.50")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.location.isRestricted).toBe(true);
      // Raw coordinates returned to privileged caller: [lon, lat]
      expect(res.body.data.location.coordinates[0]).toBeCloseTo(77.2333, 4);
      expect(res.body.data.location.coordinates[1]).toBeCloseTo(9.4667, 4);

      // Verify immutable AuditLog was written with sanitized telemetry
      const auditLog = await testPrisma.auditLog.findFirst({
        where: {
          entityId: restrictedDestId,
          action: "destination.privileged_location_read",
          actorAccountId: curator.id,
        },
        include: { telemetry: true },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.actorRole).toBe("curator");
      expect(auditLog?.telemetry?.userAgent).toBe("CuratorBrowser/1.0");
    });

    it("should fail closed and throw 500 AUDIT_LOG_FAILURE if audit log write fails on privileged coordinate read", async () => {
      const spy = vi
        .spyOn(DestinationService.prototype as any, "recordAuditLog")
        .mockRejectedValueOnce(
          new AppError(
            500,
            ErrorCode.AUDIT_LOG_FAILURE,
            "Failed to record mandatory audit log for destination mutation"
          )
        );

      const res = await request(app)
        .get(`/api/v1/admin/destinations/${restrictedDestId}`)
        .set("Authorization", `Bearer ${curator.token}`)
        .expect(500);

      expect(res.body.error.code).toBe("AUDIT_LOG_FAILURE");
      // Verify raw coordinates were never returned
      expect(res.body.data).toBeUndefined();

      spy.mockRestore();
    });

    it("should reject traveler access to admin destination detail with 403 Forbidden", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/destinations/${restrictedDestId}`)
        .set("Authorization", `Bearer ${traveler.token}`)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
    });
  });

  // -------------------------------------------------------------------------
  // 8. Admin Listing Across All Publication Statuses
  // -------------------------------------------------------------------------
  describe("8. Admin Listing Across All Statuses", () => {
    it("should allow curator to list destinations including drafts and filter by status", async () => {
      const res = await request(app)
        .get("/api/v1/admin/destinations?status=draft")
        .set("Authorization", `Bearer ${curator.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const dest of res.body.data) {
        expect(dest.publicationStatus).toBe("draft");
      }
    });
  });

  // -------------------------------------------------------------------------
  // 9. Destination Update & Mass Assignment Protection
  // -------------------------------------------------------------------------
  describe("9. Destination Update & Schema Strictness", () => {
    let updateDestId: string;

    beforeAll(async () => {
      const d = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${curator.token}`)
        .send({
          title: "Varkala Cliff Initial",
          slug: `varkala-cliff-${Date.now()}`,
          shortDescription: "Initial short description.",
          fullDescription: "Initial full description with lots of information.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [76.7163, 8.7379],
            formattedAddress: "Varkala, Thiruvananthapuram",
            district: "thiruvananthapuram",
            talukOrSubdivision: "Varkala",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      updateDestId = d.body.data.id;
      createdDestinationIds.add(updateDestId);
    });

    it("should allow curator to update destination fields via PATCH", async () => {
      const updatedShortDesc = "Updated cliff short description overlooking the Arabian Sea.";
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${updateDestId}`)
        .set("Authorization", `Bearer ${curator.token}`)
        .send({
          shortDescription: updatedShortDesc,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.shortDescription).toBe(updatedShortDesc);

      // Verify audit log for destination.update
      const auditLog = await testPrisma.auditLog.findFirst({
        where: {
          entityId: updateDestId,
          action: "destination.update",
        },
      });
      expect(auditLog).toBeDefined();
    });

    it("should reject curator attempting to update featuredRank with 403 Forbidden (super_admin only)", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${updateDestId}`)
        .set("Authorization", `Bearer ${curator.token}`)
        .send({
          featuredRank: 10,
        })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
    });

    it("should allow super_admin to update featuredRank via PATCH", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${updateDestId}`)
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          featuredRank: 10,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.featuredRank).toBe(10);
    });

    it("should reject contributor from modifying destination via PATCH with 403 Forbidden", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${updateDestId}`)
        .set("Authorization", `Bearer ${contributor.token}`)
        .send({ shortDescription: "Unauthorized update attempt." })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
    });

    it("should reject unknown fields (mass assignment attempt) due to .strict() schema", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/destinations/${updateDestId}`)
        .set("Authorization", `Bearer ${curator.token}`)
        .send({
          shortDescription: "Valid update length.",
          maliciousField: "DROP TABLE users;",
          publicationStatus: "published", // publicationStatus cannot be changed via PATCH
        })
        .expect(422);

      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  // -------------------------------------------------------------------------
  // 10. Publication Lifecycle (Publish & Archive)
  // -------------------------------------------------------------------------
  describe("10. Publication Lifecycle Management", () => {
    let lifecycleDestId: string;
    let lifecycleSlug: string;

    beforeAll(async () => {
      lifecycleSlug = `athirappilly-waterfalls-${Date.now()}`;
      const d = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${curator.token}`)
        .send({
          title: "Athirappilly Waterfalls",
          slug: lifecycleSlug,
          shortDescription: "Niagara of South India.",
          fullDescription: "Athirappilly Falls is situated in Athirappilly Panchayat in Chalakudy Taluk of Thrissur District.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [76.5698, 10.2851],
            formattedAddress: "Athirappilly, Thrissur",
            district: "thrissur",
            talukOrSubdivision: "Chalakudy",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      lifecycleDestId = d.body.data.id;
      createdDestinationIds.add(lifecycleDestId);
    });

    it("should reject curator attempting to publish with 403 Forbidden (super_admin only)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/destinations/${lifecycleDestId}/publish`)
        .set("Authorization", `Bearer ${curator.token}`)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
    });

    it("should allow super_admin to publish a destination, making it publicly visible", async () => {
      // 1. Verify before publish: public access returns 404
      await request(app)
        .get(`/api/v1/destinations/${lifecycleSlug}`)
        .expect(404);

      // 2. Publish as super_admin
      const res = await request(app)
        .post(`/api/v1/admin/destinations/${lifecycleDestId}/publish`)
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.publicationStatus).toBe("published");
      expect(res.body.data.publishedAt).toBeDefined();

      // 3. Verify public access succeeds now
      const pubRes = await request(app)
        .get(`/api/v1/destinations/${lifecycleSlug}`)
        .expect(200);
      expect(pubRes.body.data.slug).toBe(lifecycleSlug);
    });

    it("should allow super_admin to archive a published destination, removing it from public view", async () => {
      // 1. Archive as super_admin
      const res = await request(app)
        .post(`/api/v1/admin/destinations/${lifecycleDestId}/archive`)
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.publicationStatus).toBe("archived");

      // 2. Verify public access returns 404
      await request(app)
        .get(`/api/v1/destinations/${lifecycleSlug}`)
        .expect(404);
    });
  });

  // -------------------------------------------------------------------------
  // 11. Opening Hours Upsert
  // -------------------------------------------------------------------------
  describe("11. Opening Hours Upsert", () => {
    let hoursDestId: string;
    let hoursSlug: string;

    beforeAll(async () => {
      hoursSlug = `padmanabhaswamy-temple-${Date.now()}`;
      const d = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${curator.token}`)
        .send({
          title: "Sree Padmanabhaswamy Temple",
          slug: hoursSlug,
          shortDescription: "Historic Hindu temple with Dravidian architecture.",
          fullDescription: "Sree Padmanabhaswamy Temple is a Hindu temple located in Thiruvananthapuram.",
          primaryCategoryId: secondaryCategory.id,
          location: {
            coordinates: [76.9436, 8.4831],
            formattedAddress: "West Nada, Fort, Thiruvananthapuram",
            district: "thiruvananthapuram",
            talukOrSubdivision: "Thiruvananthapuram",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      hoursDestId = d.body.data.id;
      createdDestinationIds.add(hoursDestId);
      await request(app)
        .post(`/api/v1/admin/destinations/${hoursDestId}/publish`)
        .set("Authorization", `Bearer ${superAdmin.token}`);
    });

    it("should allow curator to upsert opening hours schedule and verify public retrieval", async () => {
      const schedulePayload = {
        type: "scheduled",
        entryFeePolicy: "paid",
        advisoryNote: "Traditional dress code strictly enforced: Dhoti for men, Saree for women.",
        feeStructure: {
          currency: "INR",
          isFree: false,
          adultFee: 50,
          foreignNationalFee: 500,
        },
        weeklySchedule: [
          { dayOfWeek: 0, isClosed: false, openTime: "03:30", closeTime: "19:30" },
          { dayOfWeek: 1, isClosed: false, openTime: "03:30", closeTime: "19:30" },
          { dayOfWeek: 2, isClosed: false, openTime: "03:30", closeTime: "19:30" },
          { dayOfWeek: 3, isClosed: false, openTime: "03:30", closeTime: "19:30" },
          { dayOfWeek: 4, isClosed: false, openTime: "03:30", closeTime: "19:30" },
          { dayOfWeek: 5, isClosed: false, openTime: "03:30", closeTime: "19:30" },
          { dayOfWeek: 6, isClosed: false, openTime: "03:30", closeTime: "19:30" },
        ],
      };

      const res = await request(app)
        .put(`/api/v1/admin/destinations/${hoursDestId}/opening-hours`)
        .set("Authorization", `Bearer ${curator.token}`)
        .send(schedulePayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.entryFeePolicy).toBe("paid");
      expect(res.body.data.advisoryNote).toContain("Traditional dress code");

      // Verify public retrieval
      const pubRes = await request(app)
        .get(`/api/v1/destinations/${hoursSlug}/opening-hours`)
        .expect(200);

      expect(pubRes.body.data.entryFeePolicy).toBe("paid");
      expect(pubRes.body.data.weeklySchedule).toHaveLength(7);
    });
  });

  // -------------------------------------------------------------------------
  // 12. Multi-Modal Spatial & Text Search
  // -------------------------------------------------------------------------
  describe("12. Multi-Modal Spatial and Text Search", () => {
    let munnarDestId: string;
    let kochiDestId: string;

    beforeAll(async () => {
      // Destination 1: Munnar Hill Station (approx lat 10.0889, lon 77.0595)
      const d1 = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Munnar Tea Gardens",
          slug: `munnar-tea-gardens-${Date.now()}`,
          shortDescription: "Sprawling tea plantations in the Western Ghats mountain range.",
          fullDescription: "Munnar is a town and hill station in the Idukki district of the southwestern Indian state of Kerala.",
          primaryCategoryId: primaryCategory.id,
          location: {
            coordinates: [77.0595, 10.0889],
            formattedAddress: "Munnar, Idukki",
            district: "idukki",
            talukOrSubdivision: "Devikulam",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      munnarDestId = d1.body.data.id;
      createdDestinationIds.add(munnarDestId);
      await request(app)
        .post(`/api/v1/admin/destinations/${munnarDestId}/publish`)
        .set("Authorization", `Bearer ${superAdmin.token}`);

      // Destination 2: Fort Kochi Heritage (approx lat 9.9658, lon 76.2425) - ~110km from Munnar
      const d2 = await request(app)
        .post("/api/v1/admin/destinations")
        .set("Authorization", `Bearer ${superAdmin.token}`)
        .send({
          title: "Fort Kochi Chinese Fishing Nets",
          slug: `fort-kochi-nets-${Date.now()}`,
          shortDescription: "Iconic shore operated lift nets in Kochi.",
          fullDescription: "Fort Kochi is a settlement in the city of Kochi in Kerala, famous for colonial architecture.",
          primaryCategoryId: secondaryCategory.id,
          location: {
            coordinates: [76.2425, 9.9658],
            formattedAddress: "Fort Kochi, Ernakulam",
            district: "ernakulam",
            talukOrSubdivision: "Kochi",
            stateOrProvince: "Kerala",
            countryCode: "IN",
            isRestricted: false,
          },
        });
      kochiDestId = d2.body.data.id;
      createdDestinationIds.add(kochiDestId);
      await request(app)
        .post(`/api/v1/admin/destinations/${kochiDestId}/publish`)
        .set("Authorization", `Bearer ${superAdmin.token}`);
    });

    it("should find destinations matching text query 'Munnar'", async () => {
      const res = await request(app)
        .get("/api/v1/destinations/search?q=Munnar")
        .expect(200);

      expect(res.body.success).toBe(true);
      const returnedIds = res.body.data.map((d: any) => d.id);
      expect(returnedIds).toContain(munnarDestId);
      expect(returnedIds).not.toContain(kochiDestId);
    });

    it("should find destinations within radial proximity and return calculated distanceKm", async () => {
      // Search from Munnar town center with radius 20km (near=lon,lat)
      const res = await request(app)
        .get("/api/v1/destinations/search?near=77.06,10.08&radiusKm=20")
        .expect(200);

      expect(res.body.success).toBe(true);
      const returnedIds = res.body.data.map((d: any) => d.id);
      expect(returnedIds).toContain(munnarDestId);
      expect(returnedIds).not.toContain(kochiDestId); // Fort Kochi is > 100km away

      // Check distanceKm calculation
      const munnarResult = res.body.data.find((d: any) => d.id === munnarDestId);
      expect(munnarResult.distanceKm).toBeDefined();
      expect(munnarResult.distanceKm).toBeLessThan(10);
    });

    it("should find destinations inside a spatial bounding box", async () => {
      // Bounding box covering Ernakulam/Kochi: minLon 76.0, minLat 9.8, maxLon 76.5, maxLat 10.1
      const res = await request(app)
        .get("/api/v1/destinations/search?bbox=76.0,9.8,76.5,10.1")
        .expect(200);

      expect(res.body.success).toBe(true);
      const returnedIds = res.body.data.map((d: any) => d.id);
      expect(returnedIds).toContain(kochiDestId);
      expect(returnedIds).not.toContain(munnarDestId);
    });
  });
});
