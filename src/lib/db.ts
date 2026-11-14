import { PrismaClient } from "@prisma/client";

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
 * PostGIS Spatial & Coordinate Utility Types and Functions
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
 */
export function validateCoordinates(lon: number, lat: number): boolean {
  if (typeof lon !== "number" || typeof lat !== "number") return false;
  if (Number.isNaN(lon) || Number.isNaN(lat)) return false;
  return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

/**
 * Formats longitude and latitude into a PostGIS Well-Known Text (WKT) POINT representation.
 * Standard PostGIS axis order is POINT(longitude latitude).
 */
export function toPointWkt(lon: number, lat: number): string {
  if (!validateCoordinates(lon, lat)) {
    throw new Error(
      `Invalid WGS 84 coordinates: lon=${lon}, lat=${lat}. Lon must be [-180, 180] and lat must be [-90, 90].`
    );
  }
  return `POINT(${lon} ${lat})`;
}

/**
 * Checks whether a bounding box crosses the International Date Line (antimeridian).
 * When minLon > maxLon, the bounding box crosses the antimeridian (-180 / 180).
 */
export function crossesAntimeridian(box: BoundingBox): boolean {
  return box.minLon > box.maxLon;
}

/**
 * Generates bounding box envelope coordinates for spatial queries.
 * If box crosses the antimeridian (minLon > maxLon), it returns two envelopes:
 * 1. [minLon, minLat, 180, maxLat]
 * 2. [-180, minLat, maxLon, maxLat]
 */
export function getBoundingBoxEnvelopes(box: BoundingBox): BoundingBox[] {
  if (box.minLat > box.maxLat || box.minLat < -90 || box.maxLat > 90) {
    throw new Error(
      `Invalid latitude bounds in bounding box: minLat=${box.minLat}, maxLat=${box.maxLat}`
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
