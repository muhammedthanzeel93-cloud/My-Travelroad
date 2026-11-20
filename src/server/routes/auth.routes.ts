/**
 * My Travelroad — Authentication Routes
 * Public and session management endpoints for identity and credentials.
 * Reference: docs/architecture/api-contracts.md (Module A)
 */

import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/db";
import { registerRequestSchema } from "../auth/register.schema";
import { loginRequestSchema } from "../auth/login.schema";
import { registerTouristAccount, RegistrationResult } from "../services/registration.service";
import { authenticateLogin, LoginResult } from "../services/login.service";
import { registrationRateLimiter, loginRateLimiter } from "../middleware/rate-limiter";
import { ApiSuccessResponse } from "../types/response.types";

export interface AuthRouterOptions {
  prismaClient?: PrismaClient;
  rateLimiter?: RequestHandler;
  loginRateLimiter?: RequestHandler;
}

/**
 * Creates the authentication router.
 * Mounts:
 * - POST /register: Tourist account registration (5 req/min per IP, atomic 3-table transaction)
 * - POST /login: Interactive user authentication (5 req/min per IP, HS256 JWT access token)
 */
export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const router = Router();
  const dbClient = options.prismaClient ?? defaultPrisma;
  const registrationRateLimitMiddleware =
    options.rateLimiter ?? registrationRateLimiter.middleware;
  const loginRateLimitMiddleware =
    options.loginRateLimiter ?? loginRateLimiter.middleware;

  /**
   * POST /register
   * Registers a new tourist account with individual type and traveler role.
   */
  router.post(
    "/register",
    registrationRateLimitMiddleware,
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

  /**
   * POST /login
   * Authenticates user credentials, applies account lifecycle rules and failed-login throttling,
   * and returns a short-lived JWT access token for eligible accounts.
   */
  router.post(
    "/login",
    loginRateLimitMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // 1. Validate request body against strict Zod schema (rejects unknown properties with 422)
        const validatedInput = loginRequestSchema.parse(req.body);

        // 2. Delegate to authentication service
        const loginResult = await authenticateLogin(validatedInput, dbClient);

        // 3. Respond with 200 OK and safe response envelope
        const response: ApiSuccessResponse<LoginResult> = {
          success: true,
          data: loginResult,
        };

        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
