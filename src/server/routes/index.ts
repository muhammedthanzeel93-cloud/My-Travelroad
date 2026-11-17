/**
 * My Travelroad — Root API Router
 * Aggregates foundational routes. Future authentication and domain modules mount here.
 */

import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { createHealthRouter } from "./health.routes";

export interface ApiRouterOptions {
  prismaClient?: PrismaClient;
}

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  // Foundational health & readiness endpoints
  router.use("/health", createHealthRouter(options.prismaClient));

  return router;
}
