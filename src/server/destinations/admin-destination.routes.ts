/**
 * My Travelroad — Administrative Destination Management Routes
 * Mounts privileged endpoints for destination creation, updates, lifecycle transitions, and unmasked coordinate inspection.
 * Reference: docs/architecture/api-contracts.md (Module F: Administration) & api-authorization-matrix.md
 */

import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/db";
import { DestinationService } from "./destination.service";
import { createAuthenticateMiddleware } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import {
  createDestinationSchema,
  updateDestinationSchema,
  adminListDestinationsQuerySchema,
  updateOpeningHoursSchema,
} from "./destination.schema";
import { RequestAuditContext } from "./destination.types";

export interface AdminDestinationRouterOptions {
  prismaClient?: PrismaClient;
}

export function createAdminDestinationRouter(
  options: AdminDestinationRouterOptions = {}
): Router {
  const router = Router();
  const dbClient = options.prismaClient ?? defaultPrisma;
  const service = new DestinationService(dbClient);
  const authenticate = createAuthenticateMiddleware(dbClient);

  // Helper to extract audit context
  function getAuditContext(req: Request): RequestAuditContext {
    return {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    };
  }

  // All administrative routes require valid authentication
  router.use(authenticate);

  /**
   * GET /api/v1/admin/destinations
   * Lists destinations across all publication statuses.
   * Allowed roles: curator, super_admin.
   */
  router.get(
    "/",
    requireRole("curator", "super_admin"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = adminListDestinationsQuerySchema.parse(req.query);
        const result = await service.listAdminDestinations(req.auth!, query);
        res.status(200).json({
          success: true,
          data: result.data,
          meta: result.meta,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /api/v1/admin/destinations
   * Creates a new destination draft with location and taxonomy.
   * Allowed roles: contributor, curator, super_admin.
   */
  router.post(
    "/",
    requireRole("contributor", "curator", "super_admin"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = createDestinationSchema.parse(req.body);
        const auditContext = getAuditContext(req);
        const data = await service.createDestinationDraft(req.auth!, input, auditContext);
        res.status(201).json({
          success: true,
          data,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /api/v1/admin/destinations/:id
   * Privileged administrative view: unmasked coordinates, altitude, accuracy.
   * Produces an immutable AuditLog entry (action: 'destination.privileged_location_read').
   * Fail-closed: returns 500 AUDIT_LOG_FAILURE and suppresses coordinates if audit write fails.
   * Allowed roles: curator, super_admin.
   */
  router.get(
    "/:id",
    requireRole("curator", "super_admin"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const auditContext = getAuditContext(req);
        const data = await service.getAdminDestinationById(req.auth!, id, auditContext);
        res.status(200).json({
          success: true,
          data,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * PATCH /api/v1/admin/destinations/:id
   * Updates destination metadata, descriptions, category, or location.
   * Allowed roles: curator, super_admin.
   */
  router.patch(
    "/:id",
    requireRole("curator", "super_admin"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const input = updateDestinationSchema.parse(req.body);
        const auditContext = getAuditContext(req);
        const data = await service.updateDestination(req.auth!, id, input, auditContext);
        res.status(200).json({
          success: true,
          data,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /api/v1/admin/destinations/:id/publish
   * Elevates destination lifecycle status to 'published'.
   * Allowed role: super_admin only.
   */
  router.post(
    "/:id/publish",
    requireRole("super_admin"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const auditContext = getAuditContext(req);
        const data = await service.publishDestination(req.auth!, id, auditContext);
        res.status(200).json({
          success: true,
          data,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /api/v1/admin/destinations/:id/archive
   * Transitions destination to 'archived' status, unpublishing it from public views.
   * Allowed role: super_admin only.
   */
  router.post(
    "/:id/archive",
    requireRole("super_admin"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const auditContext = getAuditContext(req);
        const data = await service.archiveDestination(req.auth!, id, auditContext);
        res.status(200).json({
          success: true,
          data,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * PUT /api/v1/admin/destinations/:id/opening-hours
   * Upserts operating schedule, tariffs, and fee policies.
   * Allowed roles: curator, super_admin.
   */
  router.put(
    "/:id/opening-hours",
    requireRole("curator", "super_admin"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const input = updateOpeningHoursSchema.parse(req.body);
        const auditContext = getAuditContext(req);
        const data = await service.upsertOpeningHours(req.auth!, id, input, auditContext);
        res.status(200).json({
          success: true,
          data,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
