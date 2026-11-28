/**
 * My Travelroad — Root API Router
 * Aggregates foundational routes. Future authentication and domain modules mount here.
 */

import { Router, RequestHandler } from "express";
import { PrismaClient } from "@prisma/client";
import { createHealthRouter } from "./health.routes";
import { createAuthRouter } from "./auth.routes";
import { RedisSessionStore } from "../redis/session.store";
import { createDestinationRouter } from "../destinations/destination.routes";
import { createAdminDestinationRouter } from "../destinations/admin-destination.routes";

export interface ApiRouterOptions {
  prismaClient?: PrismaClient;
  rateLimiter?: RequestHandler;
  sessionStore?: RedisSessionStore;
}

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  // Foundational health & readiness endpoints
  router.use("/health", createHealthRouter(options.prismaClient));

  // Module A: Authentication & Identity endpoints
  router.use(
    "/auth",
    createAuthRouter({
      prismaClient: options.prismaClient,
      rateLimiter: options.rateLimiter,
      sessionStore: options.sessionStore,
    })
  );

  // Module D: Destinations (Public Discovery)
  router.use(
    "/destinations",
    createDestinationRouter({
      prismaClient: options.prismaClient,
    })
  );

  // Module F: Administration — Destinations Management
  router.use(
    "/admin/destinations",
    createAdminDestinationRouter({
      prismaClient: options.prismaClient,
    })
  );

  return router;
}
