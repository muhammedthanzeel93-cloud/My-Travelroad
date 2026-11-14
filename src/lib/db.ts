import { PrismaClient, Prisma } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export const db = prisma;

/**
 * Spatial Types & Coordinate Interfaces
 */

export interface Coordinates {
  longitude: number;
  latitude: number;
}

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/**
 * Validates WGS 84 (EPSG:4326) coordinate bounds.
 * Longitude: [-180, 180]
 * Latitude: [-90, 90]
 * Explicitly rejects NaN, Infinity, -Infinity, and non-number types.
 */
export function validateCoordinates(lon: number, lat: number): boolean {
  if (typeof lon !== "number" || typeof lat !== "number") return false;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

/**
 * Validates BoundingBox boundaries.
 * All coordinates must be finite numbers within standard geographic limits:
 * - minLat and maxLat must be in [-90, 90], and minLat <= maxLat.
 * - minLon and maxLon must be in [-180, 180].
 * Note: If minLon > maxLon, the box crosses the antimeridian (-180Â° / 180Â°).
 */
export function validateBoundingBox(box: BoundingBox): boolean {
  if (!box || typeof box !== "object") return false;
  const { minLon, minLat, maxLon, maxLat } = box;

  if (
    typeof minLon !== "number" ||
    typeof minLat !== "number" ||
    typeof maxLon !== "number" ||
    typeof maxLat !== "number"
  ) {
    return false;
  }

  if (
    !Number.isFinite(minLon) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLon) ||
    !Number.isFinite(maxLat)
  ) {
    return false;
  }

  if (minLat < -90 || maxLat > 90 || minLat > maxLat) {
    return false;
  }

  if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180) {
    return false;
  }

  return true;
}

/**
 * Formats longitude and latitude into a PostGIS Well-Known Text (WKT) POINT representation.
 * Standard PostGIS axis order is POINT(longitude latitude).
 */
export function toPointWkt(lon: number, lat: number): string {
  if (!validateCoordinates(lon, lat)) {
    throw new Error(
      `Invalid WGS 84 coordinates: lon=${lon}, lat=${lat}. Longitude must be in [-180, 180], latitude in [-90, 90], and both must be finite numbers.`
    );
  }
  return `POINT(${lon} ${lat})`;
}

/**
 * Checks whether a bounding box crosses the International Date Line (antimeridian).
 * When minLon > maxLon, the bounding box crosses 180Â° / -180Â°.
 */
export function crossesAntimeridian(box: BoundingBox): boolean {
  if (!validateBoundingBox(box)) {
    throw new Error(
      `Invalid bounding box provided to crossesAntimeridian: [${box?.minLon}, ${box?.minLat}, ${box?.maxLon}, ${box?.maxLat}]`
    );
  }
  return box.minLon > box.maxLon;
}

/**
 * Generates bounding box envelope coordinates for spatial queries.
 * If box crosses the antimeridian (minLon > maxLon), it splits into two envelopes:
 * 1. [minLon, minLat, 180, maxLat] (Eastern hemisphere segment)
 * 2. [-180, minLat, maxLon, maxLat] (Western hemisphere segment)
 */
export function getBoundingBoxEnvelopes(box: BoundingBox): BoundingBox[] {
  if (!validateBoundingBox(box)) {
    throw new Error(
      `Invalid bounding box coordinates: minLon=${box?.minLon}, minLat=${box?.minLat}, maxLon=${box?.maxLon}, maxLat=${box?.maxLat}. Latitudes must be in [-90, 90] with minLat <= maxLat, and longitudes in [-180, 180].`
    );
  }

  if (crossesAntimeridian(box)) {
    return [
      { minLon: box.minLon, minLat: box.minLat, maxLon: 180, maxLat: box.maxLat },
      { minLon: -180, minLat: box.minLat, maxLon: box.maxLon, maxLat: box.maxLat },
    ];
  }

  return [box];
}

/**
 * Safe Parameterized Spatial Query Builders using Prisma.sql
 * Prevents SQL injection by using parameterized templates.
 */

/**
 * Generates a parameterized PostGIS ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography expression.
 */
export function createPointGeographySql(lon: number, lat: number): Prisma.Sql {
  if (!validateCoordinates(lon, lat)) {
    throw new Error(`Invalid WGS 84 coordinates: lon=${lon}, lat=${lat}`);
  }
  return Prisma.sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography`;
}

/**
 * Generates a parameterized PostGIS spatial bounding box condition using ST_MakeEnvelope.
 * Handles single or antimeridian-split envelopes safely using Prisma.join and Prisma.sql.
 */
export function createBoundingBoxWhereClause(
  box: BoundingBox,
  columnExpression: Prisma.Sql = Prisma.sql`dl.public_coordinates`
): Prisma.Sql {
  const envelopes = getBoundingBoxEnvelopes(box);

  if (envelopes.length === 1) {
    const env = envelopes[0];
    return Prisma.sql`ST_Intersects(${columnExpression}, ST_MakeEnvelope(${env.minLon}, ${env.minLat}, ${env.maxLon}, ${env.maxLat}, 4326)::geography)`;
  }

  // Antimeridian crossing: OR condition across both envelopes
  const conditions = envelopes.map(
    (env) =>
      Prisma.sql`ST_Intersects(${columnExpression}, ST_MakeEnvelope(${env.minLon}, ${env.minLat}, ${env.maxLon}, ${env.maxLat}, 4326)::geography)`
  );

  return Prisma.sql`(${Prisma.join(conditions, " OR ")})`;
}
