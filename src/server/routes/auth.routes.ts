/**
 * My Travelroad — Authentication Routes
 * Public and session management endpoints for identity and credentials.
 * Reference: docs/architecture/api-contracts.md (Module A)
 */

import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/db";
import { registerRequestSchema } from "../auth/register.schema";
import { registerTouristAccount, RegistrationResult } from "../services/registration.service";
import { registrationRateLimiter } from "../middleware/rate-limiter";
import { ApiSuccessResponse } from "../types/response.types";

export interface AuthRouterOptions {
  prismaClient?: PrismaClient;
  rateLimiter?: RequestHandler;
}

/**
 * Creates the authentication router.
 * Mounts:
 * - POST /register: Tourist account registration (5 req/min per IP, atomic 3-table transaction)
 */
export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const router = Router();
  const dbClient = options.prismaClient ?? defaultPrisma;
  const rateLimitMiddleware =
    options.rateLimiter ?? registrationRateLimiter.middleware;

  /**
   * POST /register
   * Registers a new tourist account with individual type and traveler role.
   */
  router.post(
    "/register",
    rateLimitMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // 1. Validate request body against strict Zod schema (rejects unknown properties with 422)
        const validatedInput = registerRequestSchema.parse(req.body);

        // 2. Delegate to atomic registration service
        const registrationResult = await registerTouristAccount(
          validatedInput,
          dbClient
        );

        // 3. Respond with 201 Created and safe response envelope
        const response: ApiSuccessResponse<RegistrationResult> = {
          success: true,
          data: registrationResult,
        };

        res.status(201).json(response);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
