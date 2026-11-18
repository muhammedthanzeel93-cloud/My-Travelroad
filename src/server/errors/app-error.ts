/**
 * My Travelroad — Application Error Class Hierarchy
 * Base and specialized operational error types matching the platform error taxonomy.
 */

import { ErrorCode, ErrorCodeType } from "./error-codes";
import { ApiErrorDetail } from "../types/response.types";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCodeType | string;
  public readonly details?: ApiErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: ErrorCodeType | string,
    message: string,
    details?: ApiErrorDetail[],
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: ApiErrorDetail[]) {
    super(400, ErrorCode.BAD_REQUEST, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = "Authentication required",
    code: string = ErrorCode.AUTHENTICATION_REQUIRED
  ) {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = "Forbidden access",
    code: string = ErrorCode.FORBIDDEN_ACCESS
  ) {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, ErrorCode.RESOURCE_NOT_FOUND, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(409, ErrorCode.DUPLICATE_RESOURCE, message);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = "The request body failed schema validation.",
    details?: ApiErrorDetail[]
  ) {
    super(422, ErrorCode.VALIDATION_FAILED, message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(429, ErrorCode.RATE_LIMIT_EXCEEDED, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable") {
    super(503, ErrorCode.SERVICE_UNAVAILABLE, message);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "An unexpected error occurred") {
    super(500, ErrorCode.INTERNAL_SERVER_ERROR, message, undefined, false);
  }
}
