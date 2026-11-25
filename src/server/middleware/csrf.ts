/**
 * My Travelroad — Anti-CSRF Protection Middleware
 * Strictly enforces mandatory anti-CSRF request header on cookie-authenticated endpoints.
 * References:
 * - docs/architecture/api-contracts.md Module A (Sections 3 & 4)
 * - docs/architecture/api-architecture.md Section 8.3
 */

import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../errors/app-error";

export const REQUIRED_CSRF_HEADER = "x-requested-with";
export const REQUIRED_CSRF_VALUE = "xmlhttprequest";

/**
 * Middleware that asserts the presence and validity of the X-Requested-With header.
 * Rejects requests with 400 Bad Request if the header is missing or does not match XMLHttpRequest.
 */
export function csrfProtectionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const headerValue = req.headers[REQUIRED_CSRF_HEADER];

  if (
    !headerValue ||
    typeof headerValue !== "string" ||
    headerValue.trim().toLowerCase() !== REQUIRED_CSRF_VALUE
  ) {
    throw new BadRequestError(
      "Missing or invalid anti-CSRF header: X-Requested-With: XMLHttpRequest is required",
      [
        {
          field: "headers.x-requested-with",
          issue: "A mandatory 'X-Requested-With: XMLHttpRequest' header must be present on this request.",
        },
      ]
    );
  }

  next();
}
