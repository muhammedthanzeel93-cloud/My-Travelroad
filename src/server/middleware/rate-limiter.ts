/**
 * My Travelroad — In-Memory IP Rate Limiting Middleware
 * Enforces per-IP request throttling with RFC 6585 headers and spoofing defense.
 *
 * Production Deployment Constraints:
 * 1. Process-Local State: This rate limiter uses in-memory process-local state (`Map`).
 *    It is appropriate only for single-process deployment or local development.
 * 2. Multi-Instance Deployments: In a multi-instance or clustered production environment,
 *    separate instances do not share counters. A distributed/shared rate limiter backed
 *    by Redis is required before multi-instance production deployment.
 * 3. Reverse Proxy Configuration: Proxy trust (`trust proxy`) must be configured explicitly
 *    and safely in Express to prevent spoofed `X-Forwarded-For` headers from bypassing limits.
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import { TooManyRequestsError } from "../errors/app-error";

export interface RateLimiterOptions {
  /** Time window in milliseconds. Default: 60,000 (1 minute). */
  windowMs?: number;
  /** Maximum number of allowed requests per window. Default: 5. */
  max?: number;
  /** Custom error message when rate limit is exceeded. */
  message?: string;
  /** Optional custom key generator. Defaults to secure IP extraction. */
  keyGenerator?: (req: Request) => string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Extracts client IP address safely.
 * Only trusts req.ip if Express has 'trust proxy' explicitly enabled.
 * Otherwise, falls back to direct socket remoteAddress to prevent X-Forwarded-For header spoofing.
 */
export function getClientIp(req: Request): string {
  const isTrustProxy = Boolean(req.app?.get("trust proxy"));
  if (isTrustProxy && req.ip) {
    return req.ip;
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}

export interface RateLimiterInstance {
  middleware: RequestHandler;
  reset: () => void;
}

/**
 * Creates an in-memory IP rate limiter middleware.
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiterInstance {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 5;
  const message =
    options.message ?? "Too many registration attempts. Please try again later.";
  const keyGen = options.keyGenerator ?? getClientIp;

  const hits = new Map<string, RateLimitRecord>();

  // Periodic cleanup of expired records every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    hits.forEach((record, key) => {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    });
  }, 300_000);

  // Unref interval to allow clean node process shutdown
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const middleware: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const now = Date.now();
    const key = keyGen(req);

    let record = hits.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    const resetEpochSeconds = Math.ceil(record.resetTime / 1000);
    const remaining = Math.max(0, max - record.count);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetEpochSeconds);

    if (record.count > max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((record.resetTime - now) / 1000)
      );
      res.setHeader("Retry-After", retryAfterSeconds);
      return next(new TooManyRequestsError(message));
    }

    next();
  };

  return {
    middleware,
    reset: () => {
      hits.clear();
    },
  };
}

/**
 * Default registration rate limiter: 5 requests per minute per IP.
 */
export const registrationRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  message: "Too many registration attempts. Please try again later.",
});

/**
 * Default login rate limiter: 5 requests per minute per IP.
 * Enforces per-IP login throttling matching api-contracts.md Module A Section 2.
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  message: "Too many login attempts. Please try again later.",
});
