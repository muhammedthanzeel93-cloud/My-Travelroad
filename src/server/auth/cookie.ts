/**
 * My Travelroad — Authentication Cookie Security Configuration
 * Strictly enforces HttpOnly, Secure, SameSite=Strict, and Path=/api/v1/auth.
 * References: docs/architecture/api-architecture.md Section 6.2 & 6.3
 */

import { AuthCookieOptions } from "./token.types";

/** Cookie identifier key holding the rotating opaque refresh token. */
export const REFRESH_COOKIE_NAME = "refreshToken";

/** Path boundary restricting refresh cookie transmission strictly to auth endpoints. */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

/** Refresh token expiration threshold in seconds (30 days). */
export const REFRESH_TOKEN_TTL_SECONDS = 2592000;

/** Refresh token expiration threshold in milliseconds (30 days). */
export const REFRESH_TOKEN_MAX_AGE_MS = REFRESH_TOKEN_TTL_SECONDS * 1000;

/**
 * Returns security attributes for dispatching an active refresh token cookie.
 *
 * @param isProduction Optional override for production mode. Defaults to NODE_ENV === 'production'.
 * @returns Fully populated AuthCookieOptions
 */
export function getRefreshTokenCookieOptions(isProduction?: boolean): AuthCookieOptions {
  const secure = isProduction ?? process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  };
}

/**
 * Returns security attributes for clearing the refresh token cookie on logout.
 *
 * @param isProduction Optional override for production mode. Defaults to NODE_ENV === 'production'.
 * @returns AuthCookieOptions configured with maxAge: 0
 */
export function getClearRefreshTokenCookieOptions(isProduction?: boolean): AuthCookieOptions {
  const secure = isProduction ?? process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    maxAge: 0,
  };
}
