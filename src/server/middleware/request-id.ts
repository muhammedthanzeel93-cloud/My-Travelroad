/**
 * My Travelroad — Request ID Tracing Middleware
 * Validates client-supplied X-Request-Id or generates a secure UUIDv4.
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingHeader = req.headers["x-request-id"];
  const candidateId = Array.isArray(incomingHeader)
    ? incomingHeader[0]
    : incomingHeader;

  let requestId: string;

  if (candidateId && SAFE_REQUEST_ID_REGEX.test(candidateId.trim())) {
    requestId = candidateId.trim();
  } else {
    requestId = randomUUID();
  }

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
