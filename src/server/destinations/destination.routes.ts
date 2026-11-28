/**
 * My Travelroad — Public Destination Routes
 * Mounts public discovery endpoints for destinations, locations, media, schedules, and spatial search.
 * Reference: docs/architecture/api-contracts.md (Module D: Destinations)
 */

import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/db";
import { DestinationService } from "./destination.service";
import {
  listDestinationsQuerySchema,
  searchDestinationsQuerySchema,
} from "./destination.schema";

export interface DestinationRouterOptions {
  prismaClient?: PrismaClient;
}

export function createDestinationRouter(options: DestinationRouterOptions = {}): Router {
  const router = Router();
  const dbClient = options.prismaClient ?? defaultPrisma;
  const service = new DestinationService(dbClient);

  /**
   * GET /api/v1/destinations
   * Public discovery listing with district and category filters.
   */
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listDestinationsQuerySchema.parse(req.query);
      const result = await service.listPublicDestinations(query);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/destinations/search
   * Multi-modal search: text keyword matching, radial geographic proximity, or bounding box.
   */
  router.get("/search", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = searchDestinationsQuerySchema.parse(req.query);
      const result = await service.searchDestinations(query);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/destinations/:slug
   * Comprehensive published destination profile with 3-tier coordinate privacy.
   */
  router.get("/:slug", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const data = await service.getPublicDestinationBySlug(slug);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/destinations/:slug/location
   * Returns location data strictly projected through the 3-Tier Coordinate Privacy model.
   */
  router.get("/:slug/location", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const data = await service.getPublicDestinationLocation(slug);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/destinations/:slug/media
   * Returns approved media assets in display sequence order.
   */
  router.get("/:slug/media", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const data = await service.getPublicDestinationMedia(slug);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/destinations/:slug/opening-hours
   * Operating schedules, season advisories, and admission fee structure.
   */
  router.get("/:slug/opening-hours", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const data = await service.getPublicDestinationOpeningHours(slug);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
