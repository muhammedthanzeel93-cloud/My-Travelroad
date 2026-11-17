/**
 * My Travelroad — Centralized Error Handling Middleware
 * Catch-all 404 handler and unified error envelope response formatter.
 */

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, NotFoundError } from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";
import { ApiErrorResponse, ApiErrorDetail } from "../types/response.types";
import { logger } from "../../config/logger";

/**
 * 404 Catch-All Handler
 * Catches any unmapped routes and converts them into a standard NotFoundError.
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl || req.url}`));
}

/**
 * Central Error Handler Middleware
 * Normalizes AppError, ZodError, syntax errors, and unexpected exceptions into the canonical error envelope.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(err);
  }

  const log = req.log ?? logger;
  const requestId = req.id || "unknown";
  const timestamp = new Date().toISOString();

  let statusCode = 500;
  let code: string = ErrorCode.INTERNAL_SERVER_ERROR;
  let message = "An unexpected internal server error occurred";
  let details: ApiErrorDetail[] | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 422;
    code = ErrorCode.VALIDATION_FAILED;
    message = "The request body failed schema validation.";
    const issues = err.issues || (err as any).errors || [];
    details = issues.map((e: any) => ({
      field: e.path.join("."),
      issue: e.message,
    }));
  } else if (err instanceof SyntaxError && "status" in err && (err as { status: number }).status === 400 && "body" in err) {
    statusCode = 400;
    code = ErrorCode.BAD_REQUEST;
    message = "Malformed JSON in request body";
  } else if (
    typeof err === "object" &&
    err !== null &&
    (("type" in err && (err as { type: string }).type === "entity.too.large") ||
      ("status" in err && (err as { status: number }).status === 413))
  ) {
    statusCode = 413;
    code = ErrorCode.BAD_REQUEST;
    message = "Request entity too large (maximum allowed size: 100kb)";
  } else if (err instanceof Error && err.message.includes("not allowed by CORS")) {
    statusCode = 403;
    code = ErrorCode.FORBIDDEN_ACCESS;
    message = err.message;
  } else {
    // Unexpected internal server error — log stack trace securely without leaking to client
    log.error({ err, requestId }, "Unhandled internal exception encountered");
  }

  const errorEnvelope: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
      requestId,
      timestamp,
    },
  };

  res.status(statusCode).json(errorEnvelope);
}
