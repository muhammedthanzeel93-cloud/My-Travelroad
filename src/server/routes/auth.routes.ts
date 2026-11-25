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
import { verifyAccessToken } from "../auth/jwt";
import { SessionService } from "../services/session.service";
import { RedisSessionStore } from "../redis/session.store";
import {
  REFRESH_COOKIE_NAME,
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from "../auth/cookie";
import {
  registrationRateLimiter,
  loginRateLimiter,
  getClientIp,
  csrfProtectionMiddleware,
} from "../middleware";
import { BadRequestError } from "../errors/app-error";
import { env } from "../../config/env";
import { ApiSuccessResponse } from "../types/response.types";

export interface AuthRouterOptions {
  prismaClient?: PrismaClient;
  rateLimiter?: RequestHandler;
  loginRateLimiter?: RequestHandler;
  sessionStore?: RedisSessionStore;
}

/**
 * Creates the authentication router.
 * Mounts:
 * - POST /register: Tourist account registration (5 req/min per IP, atomic 3-table transaction)
 * - POST /login: Interactive user authentication (5 req/min per IP, HS256 JWT access token, HttpOnly refresh cookie)
 * - POST /refresh: Token rotation and session renewal (5 req/min per IP, CSRF protected)
 * - POST /logout: Single-device session revocation and cookie clearing
 */
export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const router = Router();
  const dbClient = options.prismaClient ?? defaultPrisma;
  const sessionStore = options.sessionStore ?? new RedisSessionStore();
  const sessionService = new SessionService(sessionStore);

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
   * persists an isolated session in Redis, sets HttpOnly refresh cookie, and returns a short-lived JWT.
   */
  router.post(
    "/login",
    loginRateLimitMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // 1. Validate request body against strict Zod schema (rejects unknown properties with 422)
        const validatedInput = loginRequestSchema.parse(req.body);

        // 2. Delegate to authentication service with session store
        const clientIp = getClientIp(req);
        const userAgent = req.headers["user-agent"];

        const loginResult = await authenticateLogin(
          validatedInput,
          dbClient,
          sessionStore,
          { ipAddress: clientIp, userAgent }
        );

        // 3. Dispatch secure HttpOnly refresh token cookie if session was persisted
        if (loginResult.rawRefreshToken) {
          res.cookie(
            REFRESH_COOKIE_NAME,
            loginResult.rawRefreshToken,
            getRefreshTokenCookieOptions(env.NODE_ENV === "production")
          );
        }

        // 4. Do not leak raw refresh token in JSON response
        const { rawRefreshToken, ...safeResult } = loginResult;

        // 5. Respond with 200 OK and safe response envelope
        const response: ApiSuccessResponse<LoginResult> = {
          success: true,
          data: safeResult,
        };

        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /refresh
   * Rotates the opaque refresh token, validates account status against PostgreSQL,
   * detects replay attacks, and issues a fresh 15-minute access token.
   */
  router.post(
    "/refresh",
    loginRateLimitMiddleware,
    csrfProtectionMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rawCookie = req.cookies?.[REFRESH_COOKIE_NAME];
        const clientIp = getClientIp(req);
        const userAgent = req.headers["user-agent"];

        const result = await sessionService.rotateRefreshSession(
          rawCookie,
          { ipAddress: clientIp, userAgent },
          dbClient
        );

        // Dispatch updated rotating refresh token cookie
        res.cookie(
          REFRESH_COOKIE_NAME,
          result.newRawRefreshToken,
          getRefreshTokenCookieOptions(env.NODE_ENV === "production")
        );

        const response: ApiSuccessResponse<{
          accessToken: string;
          tokenType: string;
          expiresIn: number;
        }> = {
          success: true,
          data: {
            accessToken: result.accessToken,
            tokenType: result.tokenType,
            expiresIn: result.expiresIn,
          },
        };

        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /logout
   * Revokes the active refresh token session in Redis, prunes the account-level index,
   * and clears the session cookie.
   */
  router.post(
    "/logout",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rawCookie = req.cookies?.[REFRESH_COOKIE_NAME];

        // Mandatory anti-CSRF check when invoking with cookies
        if (rawCookie) {
          const xrw = req.headers["x-requested-with"];
          if (
            !xrw ||
            typeof xrw !== "string" ||
            xrw.trim().toLowerCase() !== "xmlhttprequest"
          ) {
            throw new BadRequestError(
              "Missing or invalid anti-CSRF header: X-Requested-With: XMLHttpRequest is required"
            );
          }
        }

        // Optional Bearer token account resolution
        let bearerAccountId: string | undefined;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          try {
            const token = authHeader.slice(7).trim();
            const payload = await verifyAccessToken(token);
            bearerAccountId = payload.sub;
          } catch {
            // Ignored: invalid Bearer token does not block logout with valid cookie
          }
        }

        // Delegate revocation to session service
        await sessionService.logoutSession(rawCookie, bearerAccountId);

        // Always clear the cookie with maxAge: 0
        res.cookie(
          REFRESH_COOKIE_NAME,
          "",
          getClearRefreshTokenCookieOptions(env.NODE_ENV === "production")
        );

        const response: ApiSuccessResponse<{ message: string }> = {
          success: true,
          data: {
            message: "Successfully logged out and session revoked.",
          },
        };

        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
