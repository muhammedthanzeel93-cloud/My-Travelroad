/**
 * My Travelroad — Destination Management Service
 * Implements business logic, atomic transactions, PostGIS spatial queries,
 * 3-tier coordinate privacy projection, and immutable audit logging.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/db";
import { AuthenticatedPrincipal } from "../auth/auth.types";
import {
  CreateDestinationInputDto,
  UpdateDestinationInputDto,
  DestinationListQueryDto,
  AdminDestinationListQueryDto,
  DestinationSearchQueryDto,
  RequestAuditContext,
  DestinationOpeningHoursDto,
} from "./destination.types";
import {
  AppError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";

export class DestinationService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Helper to write an immutable AuditLog and AuditLogTelemetry record within a transaction.
   * Fails closed if audit recording encounters any database error.
   */
  private async recordAuditLog(
    tx: Prisma.TransactionClient,
    params: {
      actor: AuthenticatedPrincipal;
      action: string;
      entityType: string;
      entityId: string;
      previousState?: Record<string, unknown> | null;
      newState?: Record<string, unknown> | null;
      contextNotes?: string | null;
      reqContext?: RequestAuditContext;
    }
  ): Promise<void> {
    try {
      const auditLog = await tx.auditLog.create({
        data: {
          actorAccountId: params.actor.accountId,
          actorRole: params.actor.role,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
        },
      });

      const retentionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1-year retention
      const rawIp = params.reqContext?.ipAddress;
      const sanitizedIp =
        rawIp && typeof rawIp === "string" && rawIp !== "unknown" && rawIp.trim().length > 0
          ? rawIp.trim()
          : null;
      const userAgent = params.reqContext?.userAgent ?? null;

      await tx.$executeRaw`
        INSERT INTO audit_log_telemetry (
          audit_log_id,
          actor_email,
          ip_address,
          user_agent,
          previous_state_snapshot,
          new_state_snapshot,
          context_notes,
          retention_expires_at
        ) VALUES (
          ${auditLog.id}::uuid,
          ${params.actor.email},
          ${sanitizedIp ? Prisma.sql`${sanitizedIp}::inet` : null},
          ${userAgent},
          ${params.previousState ? JSON.stringify(params.previousState) : null}::jsonb,
          ${params.newState ? JSON.stringify(params.newState) : null}::jsonb,
          ${params.contextNotes ?? null},
          ${retentionExpiresAt}
        )
      `;
    } catch (err) {
      throw new AppError(
        500,
        ErrorCode.AUDIT_LOG_FAILURE,
        `Audit log insertion failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Creates a new destination draft with location and optional taxonomy/schedule.
   * Permitted roles: contributor, curator, super_admin.
   */
  public async createDestinationDraft(
    actor: AuthenticatedPrincipal,
    input: CreateDestinationInputDto,
    reqContext?: RequestAuditContext
  ) {
    // 1. Verify primary category exists and is active
    const primaryCat = await this.prisma.destinationCategory.findUnique({
      where: { id: input.primaryCategoryId },
    });
    if (!primaryCat || primaryCat.status !== "active") {
      throw new BadRequestError("Primary category does not exist or is not active");
    }

    // 2. Verify secondary categories if specified
    if (input.secondaryCategoryIds && input.secondaryCategoryIds.length > 0) {
      const distinctSecondaryIds = Array.from(new Set(input.secondaryCategoryIds));
      if (distinctSecondaryIds.includes(input.primaryCategoryId)) {
        throw new BadRequestError("Secondary categories must not include the primary category");
      }
      const secondaryCats = await this.prisma.destinationCategory.findMany({
        where: { id: { in: distinctSecondaryIds }, status: "active" },
      });
      if (secondaryCats.length !== distinctSecondaryIds.length) {
        throw new BadRequestError("One or more secondary categories do not exist or are not active");
      }
    }

    // 3. Check for existing slug collision
    const existingSlug = await this.prisma.destination.findUnique({
      where: { slug: input.slug },
    });
    if (existingSlug) {
      throw new ConflictError(`A destination with slug '${input.slug}' already exists`);
    }

    // 4. Atomic multi-table write
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 4a. Create base destination record
        const destination = await tx.destination.create({
          data: {
            title: input.title,
            slug: input.slug,
            shortDescription: input.shortDescription,
            fullDescription: input.fullDescription,
            primaryCategoryId: input.primaryCategoryId,
            publicationStatus: "draft",
          },
        });

        // 4b. Create spatial location record using PostGIS ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
        const [lon, lat] = input.location.coordinates;
        const centroidLon = input.location.publicApproximateCentroid?.[0] ?? null;
        const centroidLat = input.location.publicApproximateCentroid?.[1] ?? null;

        await tx.$executeRaw`
          INSERT INTO destination_locations (
            destination_id,
            coordinates,
            altitude_meters,
            accuracy_meters,
            is_restricted,
            restriction_reason,
            public_approximate_centroid,
            public_approximate_display_name,
            formatted_address,
            locality,
            taluk_or_subdivision,
            district,
            state_or_province,
            country_code,
            postal_code,
            nearest_transit_hub
          ) VALUES (
            ${destination.id}::uuid,
            ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
            ${input.location.altitudeMeters ?? null},
            ${input.location.accuracyMeters ?? null},
            ${input.location.isRestricted ?? false},
            ${input.location.restrictionReason ?? null},
            ${centroidLon !== null && centroidLat !== null ? Prisma.sql`ST_SetSRID(ST_MakePoint(${centroidLon}, ${centroidLat}), 4326)::geography` : null},
            ${input.location.publicApproximateDisplayName ?? null},
            ${input.location.formattedAddress},
            ${input.location.locality ?? null},
            ${input.location.talukOrSubdivision},
            ${input.location.district},
            ${input.location.stateOrProvince ?? "Kerala"},
            ${input.location.countryCode ?? "IN"},
            ${input.location.postalCode ?? null},
            ${input.location.nearestTransitHub ? JSON.stringify(input.location.nearestTransitHub) : null}::jsonb
          )
        `;

        // 4c. Secondary categories
        if (input.secondaryCategoryIds && input.secondaryCategoryIds.length > 0) {
          const distinctIds = Array.from(new Set(input.secondaryCategoryIds));
          await tx.destinationSecondaryCategory.createMany({
            data: distinctIds.map((catId) => ({
              destinationId: destination.id,
              categoryId: catId,
            })),
          });
        }

        // 4d. Opening hours if specified
        if (input.openingHours) {
          await tx.destinationOpeningHour.create({
            data: {
              destinationId: destination.id,
              type: input.openingHours.type,
              weeklySchedule: input.openingHours.weeklySchedule
                ? (input.openingHours.weeklySchedule as unknown as Prisma.InputJsonValue)
                : undefined,
              seasonalNotes: input.openingHours.seasonalNotes,
              entryFeePolicy: input.openingHours.entryFeePolicy,
              feeStructure: input.openingHours.feeStructure
                ? (input.openingHours.feeStructure as unknown as Prisma.InputJsonValue)
                : undefined,
              advisoryNote: input.openingHours.advisoryNote,
            },
          });
        }

        // 4e. Record immutable audit log
        await this.recordAuditLog(tx, {
          actor,
          action: "destination.create",
          entityType: "destination",
          entityId: destination.id,
          newState: {
            id: destination.id,
            slug: destination.slug,
            title: destination.title,
            primaryCategoryId: destination.primaryCategoryId,
            publicationStatus: destination.publicationStatus,
          },
          reqContext,
        });

        return {
          id: destination.id,
          slug: destination.slug,
          title: destination.title,
          publicationStatus: destination.publicationStatus,
          createdAt: destination.createdAt.toISOString(),
        };
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        throw new ConflictError(`A destination with slug '${input.slug}' already exists`);
      }
      throw err;
    }
  }

  /**
   * Public Listing: Returns published destinations with 3-tier coordinate privacy, cover media, and pagination.
   */
  public async listPublicDestinations(query: DestinationListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    // Conditions
    const whereConditions: Prisma.Sql[] = [Prisma.sql`d.publication_status = 'published'`];

    if (query.district) {
      whereConditions.push(Prisma.sql`LOWER(vdl.district) = LOWER(${query.district})`);
    }

    if (query.category) {
      whereConditions.push(Prisma.sql`
        (
          cat.slug = ${query.category}
          OR EXISTS (
            SELECT 1 FROM destination_secondary_categories dsc
            JOIN destination_categories sc ON sc.id = dsc.category_id
            WHERE dsc.destination_id = d.id AND sc.slug = ${query.category}
          )
        )
      `);
    }

    const whereClause = Prisma.join(whereConditions, " AND ");

    // Sorting
    let orderByClause = Prisma.sql`d.created_at DESC`;
    if (query.sort === "featuredRank:asc") {
      orderByClause = Prisma.sql`d.featured_rank ASC NULLS LAST, d.created_at DESC`;
    } else if (query.sort === "featuredRank:desc") {
      orderByClause = Prisma.sql`d.featured_rank DESC NULLS LAST, d.created_at DESC`;
    } else if (query.sort === "createdAt:asc") {
      orderByClause = Prisma.sql`d.created_at ASC`;
    } else if (query.sort === "title:asc") {
      orderByClause = Prisma.sql`d.title ASC`;
    } else if (query.sort === "title:desc") {
      orderByClause = Prisma.sql`d.title DESC`;
    } else if (query.sort === "updatedAt:desc") {
      orderByClause = Prisma.sql`d.updated_at DESC`;
    } else if (query.sort === "updatedAt:asc") {
      orderByClause = Prisma.sql`d.updated_at ASC`;
    }

    // Execute total count
    const countResult = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM destinations d
      JOIN destination_categories cat ON cat.id = d.primary_category_id
      LEFT JOIN v_public_destination_locations vdl ON vdl.destination_id = d.id
      WHERE ${whereClause}
    `;
    const totalItems = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Query items
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      slug: string;
      title: string;
      short_description: string;
      district: string | null;
      taluk_or_subdivision: string | null;
      category_slug: string;
      category_name: string;
      cover_url: string | null;
      cover_thumb: string | null;
      cover_alt: string | null;
      verification_status: string | null;
    }>>`
      SELECT
        d.id,
        d.slug,
        d.title,
        d.short_description,
        vdl.district,
        vdl.taluk_or_subdivision,
        cat.slug AS category_slug,
        cat.name AS category_name,
        m.url AS cover_url,
        m.thumbnail_url AS cover_thumb,
        m.alt_text AS cover_alt,
        v.overall_status AS verification_status
      FROM destinations d
      JOIN destination_categories cat ON cat.id = d.primary_category_id
      LEFT JOIN v_public_destination_locations vdl ON vdl.destination_id = d.id
      LEFT JOIN destination_verifications v ON v.destination_id = d.id
      LEFT JOIN LATERAL (
        SELECT url, thumbnail_url, alt_text
        FROM destination_media
        WHERE destination_id = d.id AND status = 'approved'
        ORDER BY is_cover DESC, display_order ASC
        LIMIT 1
      ) m ON true
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      shortDescription: r.short_description,
      district: r.district,
      talukOrSubdivision: r.taluk_or_subdivision,
      primaryCategory: {
        slug: r.category_slug,
        name: r.category_name,
      },
      coverMedia: r.cover_url
        ? {
            url: r.cover_url,
            thumbnailUrl: r.cover_thumb,
            altText: r.cover_alt ?? r.title,
          }
        : null,
      verificationStatus: r.verification_status ?? "unverified",
    }));

    return {
      data,
      meta: {
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    };
  }

  /**
   * Public Detail: Returns destination by slug strictly if published.
   * Applies 3-tier coordinate privacy projection.
   */
  public async getPublicDestinationBySlug(slug: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
      include: {
        primaryCategory: { select: { id: true, slug: true, name: true } },
        secondaryCategories: {
          include: { category: { select: { id: true, slug: true, name: true } } },
        },
        openingHours: true,
        verification: { select: { overallStatus: true, lastAuditedAt: true } },
      },
    });

    if (!destination || destination.publicationStatus !== "published") {
      throw new NotFoundError("Destination not found");
    }

    // Query 3-tier projected location
    const locationRows = await this.prisma.$queryRaw<Array<{
      is_restricted: boolean;
      restriction_reason: string | null;
      longitude: number | null;
      latitude: number | null;
      public_locality_name: string | null;
      formatted_address: string;
      taluk_or_subdivision: string;
      district: string;
      state_or_province: string;
      country_code: string;
      postal_code: string | null;
    }>>`
      SELECT
        vdl.is_restricted,
        vdl.restriction_reason,
        ST_X(vdl.public_coordinates::geometry) AS longitude,
        ST_Y(vdl.public_coordinates::geometry) AS latitude,
        vdl.public_locality_name,
        dl.formatted_address,
        vdl.taluk_or_subdivision,
        vdl.district,
        vdl.state_or_province,
        vdl.country_code,
        vdl.postal_code
      FROM v_public_destination_locations vdl
      JOIN destination_locations dl ON dl.destination_id = vdl.destination_id
      WHERE vdl.destination_id = ${destination.id}::uuid
    `;

    const loc = locationRows[0];

    // Query approved media
    const media = await this.prisma.destinationMedia.findMany({
      where: { destinationId: destination.id, status: "approved" },
      orderBy: [{ isCover: "desc" }, { displayOrder: "asc" }],
      select: {
        id: true,
        type: true,
        url: true,
        thumbnailUrl: true,
        altText: true,
        caption: true,
        attribution: true,
        license: true,
        isCover: true,
        displayOrder: true,
      },
    });

    return {
      id: destination.id,
      slug: destination.slug,
      title: destination.title,
      shortDescription: destination.shortDescription,
      fullDescription: destination.fullDescription,
      primaryCategory: destination.primaryCategory,
      secondaryCategories: destination.secondaryCategories.map((sc) => sc.category),
      locationSummary: loc
        ? {
            formattedAddress: loc.formatted_address,
            locality: loc.public_locality_name,
            talukOrSubdivision: loc.taluk_or_subdivision,
            district: loc.district,
            stateOrProvince: loc.state_or_province,
            countryCode: loc.country_code,
            isRestricted: loc.is_restricted,
          }
        : null,
      openingHours: destination.openingHours
        ? {
            type: destination.openingHours.type,
            weeklySchedule: destination.openingHours.weeklySchedule,
            seasonalNotes: destination.openingHours.seasonalNotes,
            entryFeePolicy: destination.openingHours.entryFeePolicy,
            feeStructure: destination.openingHours.feeStructure,
            advisoryNote: destination.openingHours.advisoryNote,
          }
        : null,
      media,
      verificationSummary: {
        overallStatus: destination.verification?.overallStatus ?? "unverified",
        lastAuditedAt: destination.verification?.lastAuditedAt?.toISOString() ?? null,
      },
      publishedAt: destination.publishedAt?.toISOString() ?? null,
    };
  }

  /**
   * Public Location: Returns 3-Tier Coordinate Privacy projected location for a destination slug.
   */
  public async getPublicDestinationLocation(slug: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
      select: { id: true, publicationStatus: true },
    });
    if (!destination || destination.publicationStatus !== "published") {
      throw new NotFoundError("Destination not found");
    }

    const rows = await this.prisma.$queryRaw<Array<{
      destination_id: string;
      is_restricted: boolean;
      restriction_reason: string | null;
      longitude: number | null;
      latitude: number | null;
      public_locality_name: string | null;
      taluk_or_subdivision: string;
      district: string;
      state_or_province: string;
      country_code: string;
      nearest_transit_hub: any;
    }>>`
      SELECT
        destination_id,
        is_restricted,
        restriction_reason,
        ST_X(public_coordinates::geometry) AS longitude,
        ST_Y(public_coordinates::geometry) AS latitude,
        public_locality_name,
        taluk_or_subdivision,
        district,
        state_or_province,
        country_code,
        nearest_transit_hub
      FROM v_public_destination_locations
      WHERE destination_id = ${destination.id}::uuid
    `;

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Destination location not found");
    }

    return {
      destinationId: row.destination_id,
      isRestricted: row.is_restricted,
      restrictionReason: row.restriction_reason,
      publicCoordinates:
        row.longitude !== null && row.latitude !== null ? [row.longitude, row.latitude] : null,
      publicLocalityName: row.public_locality_name,
      talukOrSubdivision: row.taluk_or_subdivision,
      district: row.district,
      stateOrProvince: row.state_or_province,
      countryCode: row.country_code,
      nearestTransitHub: row.nearest_transit_hub,
    };
  }

  /**
   * Public Media Gallery: Returns approved media for a destination slug.
   */
  public async getPublicDestinationMedia(slug: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
      select: { id: true, publicationStatus: true },
    });
    if (!destination || destination.publicationStatus !== "published") {
      throw new NotFoundError("Destination not found");
    }

    return this.prisma.destinationMedia.findMany({
      where: { destinationId: destination.id, status: "approved" },
      orderBy: [{ isCover: "desc" }, { displayOrder: "asc" }],
      select: {
        id: true,
        type: true,
        url: true,
        thumbnailUrl: true,
        altText: true,
        caption: true,
        attribution: true,
        license: true,
        isCover: true,
        displayOrder: true,
      },
    });
  }

  /**
   * Public Opening Hours: Returns operating schedule for a destination slug.
   */
  public async getPublicDestinationOpeningHours(slug: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
      select: { id: true, publicationStatus: true },
    });
    if (!destination || destination.publicationStatus !== "published") {
      throw new NotFoundError("Destination not found");
    }

    const openingHours = await this.prisma.destinationOpeningHour.findUnique({
      where: { destinationId: destination.id },
    });
    if (!openingHours) {
      return {
        type: "always_open",
        weeklySchedule: null,
        seasonalNotes: null,
        entryFeePolicy: "free",
        feeStructure: null,
        advisoryNote: null,
      };
    }

    return {
      type: openingHours.type,
      weeklySchedule: openingHours.weeklySchedule,
      seasonalNotes: openingHours.seasonalNotes,
      entryFeePolicy: openingHours.entryFeePolicy,
      feeStructure: openingHours.feeStructure,
      advisoryNote: openingHours.advisoryNote,
    };
  }

  /**
   * Multi-modal Search: Keyword text matching, radial geographic proximity, or bounding box.
   */
  public async searchDestinations(query: DestinationSearchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: Prisma.Sql[] = [Prisma.sql`d.publication_status = 'published'`];

    // Text search
    if (query.q && query.q.trim().length > 0) {
      const searchParam = `%${query.q.trim()}%`;
      conditions.push(Prisma.sql`(d.title ILIKE ${searchParam} OR d.short_description ILIKE ${searchParam})`);
    }

    // Near radial search
    let nearPointSql: Prisma.Sql | null = null;
    if (query.near) {
      const [lon, lat] = query.near.split(",").map(Number);
      const radiusMeters = (query.radiusKm ?? 15) * 1000;
      nearPointSql = Prisma.sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography`;
      conditions.push(Prisma.sql`
        vdl.public_coordinates IS NOT NULL
        AND ST_DWithin(vdl.public_coordinates, ${nearPointSql}, ${radiusMeters})
      `);
    }

    // Bounding box search
    if (query.bbox) {
      const [minLon, minLat, maxLon, maxLat] = query.bbox.split(",").map(Number);
      conditions.push(Prisma.sql`
        vdl.public_coordinates IS NOT NULL
        AND ST_Intersects(vdl.public_coordinates, ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)::geography)
      `);
    }

    const whereClause = Prisma.join(conditions, " AND ");

    // Count
    const countRes = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM destinations d
      LEFT JOIN v_public_destination_locations vdl ON vdl.destination_id = d.id
      WHERE ${whereClause}
    `;
    const totalItems = Number(countRes[0]?.count ?? 0);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Items
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      slug: string;
      title: string;
      district: string | null;
      longitude: number | null;
      latitude: number | null;
      distance_km: number | null;
    }>>`
      SELECT
        d.id,
        d.slug,
        d.title,
        vdl.district,
        ST_X(vdl.public_coordinates::geometry) AS longitude,
        ST_Y(vdl.public_coordinates::geometry) AS latitude
        ${
          nearPointSql
            ? Prisma.sql`, ROUND((ST_Distance(vdl.public_coordinates, ${nearPointSql}) / 1000)::numeric, 1)::float AS distance_km`
            : Prisma.sql`, NULL::float AS distance_km`
        }
      FROM destinations d
      LEFT JOIN v_public_destination_locations vdl ON vdl.destination_id = d.id
      WHERE ${whereClause}
      ORDER BY ${nearPointSql ? Prisma.sql`distance_km ASC NULLS LAST, d.created_at DESC` : Prisma.sql`d.created_at DESC`}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      district: r.district,
      distanceKm: r.distance_km,
      publicCoordinates:
        r.longitude !== null && r.latitude !== null ? [r.longitude, r.latitude] : null,
    }));

    return {
      data,
      meta: {
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    };
  }

  /**
   * Admin Listing: Lists destinations across all publication statuses.
   * Permitted roles: curator, super_admin.
   */
  public async listAdminDestinations(
    actor: AuthenticatedPrincipal,
    query: AdminDestinationListQueryDto
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];

    if (query.status) {
      conditions.push(Prisma.sql`d.publication_status = ${query.status}`);
    }

    if (query.district) {
      conditions.push(Prisma.sql`LOWER(dl.district) = LOWER(${query.district})`);
    }

    if (query.category) {
      conditions.push(Prisma.sql`
        (
          cat.slug = ${query.category}
          OR cat.id::text = ${query.category}
          OR EXISTS (
            SELECT 1 FROM destination_secondary_categories dsc
            JOIN destination_categories sc ON sc.id = dsc.category_id
            WHERE dsc.destination_id = d.id AND (sc.slug = ${query.category} OR sc.id::text = ${query.category})
          )
        )
      `);
    }

    if (query.search && query.search.trim().length > 0) {
      const searchParam = `%${query.search.trim()}%`;
      conditions.push(Prisma.sql`(d.title ILIKE ${searchParam} OR d.slug ILIKE ${searchParam})`);
    }

    const whereClause = Prisma.join(conditions, " AND ");

    // Sorting
    let orderByClause = Prisma.sql`d.created_at DESC`;
    if (query.sort === "createdAt:asc") orderByClause = Prisma.sql`d.created_at ASC`;
    else if (query.sort === "updatedAt:desc") orderByClause = Prisma.sql`d.updated_at DESC`;
    else if (query.sort === "updatedAt:asc") orderByClause = Prisma.sql`d.updated_at ASC`;
    else if (query.sort === "title:asc") orderByClause = Prisma.sql`d.title ASC`;
    else if (query.sort === "title:desc") orderByClause = Prisma.sql`d.title DESC`;
    else if (query.sort === "featuredRank:asc") orderByClause = Prisma.sql`d.featured_rank ASC NULLS LAST`;
    else if (query.sort === "featuredRank:desc") orderByClause = Prisma.sql`d.featured_rank DESC NULLS LAST`;

    const countRes = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM destinations d
      JOIN destination_categories cat ON cat.id = d.primary_category_id
      LEFT JOIN destination_locations dl ON dl.destination_id = d.id
      WHERE ${whereClause}
    `;
    const totalItems = Number(countRes[0]?.count ?? 0);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      slug: string;
      title: string;
      publication_status: string;
      featured_rank: number | null;
      verification_status: string | null;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT
        d.id,
        d.slug,
        d.title,
        d.publication_status,
        d.featured_rank,
        v.overall_status AS verification_status,
        d.created_at,
        d.updated_at
      FROM destinations d
      JOIN destination_categories cat ON cat.id = d.primary_category_id
      LEFT JOIN destination_locations dl ON dl.destination_id = d.id
      LEFT JOIN destination_verifications v ON v.destination_id = d.id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      publicationStatus: r.publication_status,
      featuredRank: r.featured_rank,
      verificationOverallStatus: r.verification_status ?? "unverified",
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));

    return {
      data,
      meta: {
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    };
  }

  /**
   * Privileged Destination Detail: Returns unmasked coordinates, altitude, accuracy, and restriction parameters.
   * Produces an immutable AuditLog entry (action: 'destination.privileged_location_read').
   * Fail-Closed Security Guarantee: Must execute in transaction. If audit log insertion fails,
   * transaction rolls back and 500 AUDIT_LOG_FAILURE is thrown. Coordinates are never exposed.
   */
  public async getAdminDestinationById(
    actor: AuthenticatedPrincipal,
    id: string,
    reqContext?: RequestAuditContext
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch base destination
      const destination = await tx.destination.findUnique({
        where: { id },
        include: {
          primaryCategory: { select: { id: true, slug: true, name: true } },
          secondaryCategories: {
            include: { category: { select: { id: true, slug: true, name: true } } },
          },
          openingHours: true,
          verification: true,
        },
      });

      if (!destination) {
        throw new NotFoundError("Destination not found");
      }

      // 2. Fetch unmasked spatial coordinates
      const locRows = await tx.$queryRaw<Array<{
        destination_id: string;
        longitude: number;
        latitude: number;
        altitude_meters: number | null;
        accuracy_meters: number | null;
        is_restricted: boolean;
        restriction_reason: string | null;
        centroid_lon: number | null;
        centroid_lat: number | null;
        public_approximate_display_name: string | null;
        formatted_address: string;
        locality: string | null;
        taluk_or_subdivision: string;
        district: string;
        state_or_province: string;
        country_code: string;
        postal_code: string | null;
      }>>`
        SELECT
          dl.destination_id,
          ST_X(dl.coordinates::geometry) AS longitude,
          ST_Y(dl.coordinates::geometry) AS latitude,
          dl.altitude_meters::float AS altitude_meters,
          dl.accuracy_meters::float AS accuracy_meters,
          dl.is_restricted,
          dl.restriction_reason,
          ST_X(dl.public_approximate_centroid::geometry) AS centroid_lon,
          ST_Y(dl.public_approximate_centroid::geometry) AS centroid_lat,
          dl.public_approximate_display_name,
          dl.formatted_address,
          dl.locality,
          dl.taluk_or_subdivision,
          dl.district,
          dl.state_or_province,
          dl.country_code,
          dl.postal_code
        FROM destination_locations dl
        WHERE dl.destination_id = ${id}::uuid
      `;

      const loc = locRows[0];

      // 3. Record AuditLog entry — FAIL-CLOSED: if this throws, transaction rolls back immediately
      await this.recordAuditLog(tx, {
        actor,
        action: "destination.privileged_location_read",
        entityType: "destination",
        entityId: id,
        // Sanitized telemetry: strictly omit exact coordinates, geometry, altitude, and accuracy
        newState: {
          destinationId: id,
          slug: destination.slug,
          isRestricted: loc?.is_restricted ?? false,
        },
        reqContext,
      });

      // 4. Fetch media
      const media = await tx.destinationMedia.findMany({
        where: { destinationId: id },
        orderBy: [{ isCover: "desc" }, { displayOrder: "asc" }],
      });

      return {
        id: destination.id,
        slug: destination.slug,
        title: destination.title,
        shortDescription: destination.shortDescription,
        fullDescription: destination.fullDescription,
        publicationStatus: destination.publicationStatus,
        featuredRank: destination.featuredRank,
        primaryCategory: destination.primaryCategory,
        secondaryCategories: destination.secondaryCategories.map((sc) => sc.category),
        location: loc
          ? {
              destinationId: loc.destination_id,
              coordinates: [loc.longitude, loc.latitude],
              altitudeMeters: loc.altitude_meters,
              accuracyMeters: loc.accuracy_meters,
              formattedAddress: loc.formatted_address,
              locality: loc.locality,
              talukOrSubdivision: loc.taluk_or_subdivision,
              district: loc.district,
              stateOrProvince: loc.state_or_province,
              countryCode: loc.country_code,
              postalCode: loc.postal_code,
              isRestricted: loc.is_restricted,
              restrictionReason: loc.restriction_reason,
              publicCentroidCoordinates:
                loc.centroid_lon !== null && loc.centroid_lat !== null
                  ? [loc.centroid_lon, loc.centroid_lat]
                  : null,
              publicApproximateDisplayName: loc.public_approximate_display_name,
              maskLocality: loc.is_restricted,
            }
          : null,
        openingHours: destination.openingHours,
        media,
        verificationSummary: {
          overallStatus: destination.verification?.overallStatus ?? "unverified",
          lastAuditedAt: destination.verification?.lastAuditedAt?.toISOString() ?? null,
          nextAuditDueAt: destination.verification?.nextAuditDueAt?.toISOString() ?? null,
        },
        createdAt: destination.createdAt.toISOString(),
        updatedAt: destination.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Partial Update Destination: Updates metadata, descriptions, category, or location.
   * Permitted roles: curator, super_admin.
   */
  public async updateDestination(
    actor: AuthenticatedPrincipal,
    id: string,
    input: UpdateDestinationInputDto,
    reqContext?: RequestAuditContext
  ) {
    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({
        where: { id },
      });
      if (!destination) {
        throw new NotFoundError("Destination not found");
      }

      // Role check for featuredRank: only super_admin can modify featured rank
      if (input.featuredRank !== undefined && actor.role !== "super_admin") {
        throw new ForbiddenError(
          "Forbidden: only super administrators can set destination featured rank",
          ErrorCode.FORBIDDEN_ACCESS
        );
      }

      // Verify category if changed
      if (input.primaryCategoryId) {
        const cat = await tx.destinationCategory.findUnique({
          where: { id: input.primaryCategoryId },
        });
        if (!cat || cat.status !== "active") {
          throw new BadRequestError("Primary category does not exist or is not active");
        }
      }

      if (input.secondaryCategoryIds) {
        const distinct = Array.from(new Set(input.secondaryCategoryIds));
        const primaryId = input.primaryCategoryId ?? destination.primaryCategoryId;
        if (distinct.includes(primaryId)) {
          throw new BadRequestError("Secondary categories must not include the primary category");
        }
        const cats = await tx.destinationCategory.findMany({
          where: { id: { in: distinct }, status: "active" },
        });
        if (cats.length !== distinct.length) {
          throw new BadRequestError("One or more secondary categories do not exist or are not active");
        }
      }

      // Base updates
      const updatedDestination = await tx.destination.update({
        where: { id },
        data: {
          title: input.title,
          shortDescription: input.shortDescription,
          fullDescription: input.fullDescription,
          primaryCategoryId: input.primaryCategoryId,
          featuredRank: input.featuredRank,
        },
      });

      // Secondary categories sync
      if (input.secondaryCategoryIds !== undefined) {
        await tx.destinationSecondaryCategory.deleteMany({
          where: { destinationId: id },
        });
        const distinct = Array.from(new Set(input.secondaryCategoryIds));
        if (distinct.length > 0) {
          await tx.destinationSecondaryCategory.createMany({
            data: distinct.map((catId) => ({
              destinationId: id,
              categoryId: catId,
            })),
          });
        }
      }

      // Location update if provided
      if (input.location) {
        const loc = input.location;
        const setClauses: Prisma.Sql[] = [Prisma.sql`updated_at = NOW()`];

        if (loc.coordinates) {
          const [lon, lat] = loc.coordinates;
          setClauses.push(Prisma.sql`coordinates = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography`);
        }
        if (loc.publicApproximateCentroid !== undefined) {
          if (loc.publicApproximateCentroid === null) {
            setClauses.push(Prisma.sql`public_approximate_centroid = NULL`);
          } else {
            const [cLon, cLat] = loc.publicApproximateCentroid;
            setClauses.push(
              Prisma.sql`public_approximate_centroid = ST_SetSRID(ST_MakePoint(${cLon}, ${cLat}), 4326)::geography`
            );
          }
        }
        if (loc.isRestricted !== undefined) setClauses.push(Prisma.sql`is_restricted = ${loc.isRestricted}`);
        if (loc.restrictionReason !== undefined) setClauses.push(Prisma.sql`restriction_reason = ${loc.restrictionReason}`);
        if (loc.publicApproximateDisplayName !== undefined)
          setClauses.push(Prisma.sql`public_approximate_display_name = ${loc.publicApproximateDisplayName}`);
        if (loc.formattedAddress !== undefined) setClauses.push(Prisma.sql`formatted_address = ${loc.formattedAddress}`);
        if (loc.locality !== undefined) setClauses.push(Prisma.sql`locality = ${loc.locality}`);
        if (loc.talukOrSubdivision !== undefined) setClauses.push(Prisma.sql`taluk_or_subdivision = ${loc.talukOrSubdivision}`);
        if (loc.district !== undefined) setClauses.push(Prisma.sql`district = ${loc.district}`);
        if (loc.stateOrProvince !== undefined) setClauses.push(Prisma.sql`state_or_province = ${loc.stateOrProvince}`);
        if (loc.postalCode !== undefined) setClauses.push(Prisma.sql`postal_code = ${loc.postalCode}`);
        if (loc.altitudeMeters !== undefined) setClauses.push(Prisma.sql`altitude_meters = ${loc.altitudeMeters}`);
        if (loc.accuracyMeters !== undefined) setClauses.push(Prisma.sql`accuracy_meters = ${loc.accuracyMeters}`);

        await tx.$executeRaw`
          UPDATE destination_locations
          SET ${Prisma.join(setClauses, ", ")}
          WHERE destination_id = ${id}::uuid
        `;
      }

      // Record AuditLog
      await this.recordAuditLog(tx, {
        actor,
        action: "destination.update",
        entityType: "destination",
        entityId: id,
        previousState: {
          title: destination.title,
          shortDescription: destination.shortDescription,
          featuredRank: destination.featuredRank,
          primaryCategoryId: destination.primaryCategoryId,
        },
        newState: {
          title: updatedDestination.title,
          shortDescription: updatedDestination.shortDescription,
          featuredRank: updatedDestination.featuredRank,
          primaryCategoryId: updatedDestination.primaryCategoryId,
        },
        reqContext,
      });

      return {
        id: updatedDestination.id,
        shortDescription: updatedDestination.shortDescription,
        featuredRank: updatedDestination.featuredRank,
        updatedAt: updatedDestination.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Publish Destination: Transitions publicationStatus to 'published' and sets publishedAt.
   * Permitted role: super_admin only.
   */
  public async publishDestination(
    actor: AuthenticatedPrincipal,
    id: string,
    reqContext?: RequestAuditContext
  ) {
    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({ where: { id } });
      if (!destination) {
        throw new NotFoundError("Destination not found");
      }

      const publishedAt = new Date();
      const updated = await tx.destination.update({
        where: { id },
        data: {
          publicationStatus: "published",
          publishedAt,
        },
      });

      await this.recordAuditLog(tx, {
        actor,
        action: "destination.publish",
        entityType: "destination",
        entityId: id,
        previousState: { publicationStatus: destination.publicationStatus },
        newState: { publicationStatus: "published", publishedAt: publishedAt.toISOString() },
        reqContext,
      });

      return {
        id: updated.id,
        publicationStatus: updated.publicationStatus,
        publishedAt: publishedAt.toISOString(),
      };
    });
  }

  /**
   * Archive Destination: Transitions publicationStatus to 'archived'.
   * Permitted role: super_admin only.
   */
  public async archiveDestination(
    actor: AuthenticatedPrincipal,
    id: string,
    reqContext?: RequestAuditContext
  ) {
    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({ where: { id } });
      if (!destination) {
        throw new NotFoundError("Destination not found");
      }

      const updated = await tx.destination.update({
        where: { id },
        data: {
          publicationStatus: "archived",
        },
      });

      await this.recordAuditLog(tx, {
        actor,
        action: "destination.archive",
        entityType: "destination",
        entityId: id,
        previousState: { publicationStatus: destination.publicationStatus },
        newState: { publicationStatus: "archived" },
        reqContext,
      });

      return {
        id: updated.id,
        publicationStatus: updated.publicationStatus,
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Upsert Opening Hours: Sets or replaces opening schedules and admission tariffs.
   * Permitted roles: curator, super_admin.
   */
  public async upsertOpeningHours(
    actor: AuthenticatedPrincipal,
    id: string,
    input: DestinationOpeningHoursDto,
    reqContext?: RequestAuditContext
  ) {
    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({ where: { id } });
      if (!destination) {
        throw new NotFoundError("Destination not found");
      }

      const openingHours = await tx.destinationOpeningHour.upsert({
        where: { destinationId: id },
        create: {
          destinationId: id,
          type: input.type,
          weeklySchedule: input.weeklySchedule
            ? (input.weeklySchedule as unknown as Prisma.InputJsonValue)
            : undefined,
          seasonalNotes: input.seasonalNotes,
          entryFeePolicy: input.entryFeePolicy,
          feeStructure: input.feeStructure
            ? (input.feeStructure as unknown as Prisma.InputJsonValue)
            : undefined,
          advisoryNote: input.advisoryNote,
        },
        update: {
          type: input.type,
          weeklySchedule: input.weeklySchedule
            ? (input.weeklySchedule as unknown as Prisma.InputJsonValue)
            : undefined,
          seasonalNotes: input.seasonalNotes,
          entryFeePolicy: input.entryFeePolicy,
          feeStructure: input.feeStructure
            ? (input.feeStructure as unknown as Prisma.InputJsonValue)
            : undefined,
          advisoryNote: input.advisoryNote,
        },
      });

      await this.recordAuditLog(tx, {
        actor,
        action: "destination.opening_hours_update",
        entityType: "destination",
        entityId: id,
        newState: {
          type: openingHours.type,
          entryFeePolicy: openingHours.entryFeePolicy,
        },
        reqContext,
      });

      return {
        id: openingHours.id,
        destinationId: openingHours.destinationId,
        type: openingHours.type,
        weeklySchedule: openingHours.weeklySchedule,
        seasonalNotes: openingHours.seasonalNotes,
        entryFeePolicy: openingHours.entryFeePolicy,
        feeStructure: openingHours.feeStructure,
        advisoryNote: openingHours.advisoryNote,
        updatedAt: openingHours.updatedAt.toISOString(),
      };
    });
  }
}
