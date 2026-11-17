/**
 * My Travelroad — Structured HTTP Request Logger
 * Correlates HTTP requests with Pino child loggers and logs completion metrics.
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../../config/logger";

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  req.log = logger.child({ requestId: req.id });

  // Log incoming request at debug level
  req.log.debug(
    {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    },
    "Incoming request"
  );

  // Hook response completion
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      durationMs: duration,
    };

    if (statusCode >= 500) {
      req.log.error(logData, "Request completed with server error");
    } else if (statusCode >= 400) {
      req.log.warn(logData, "Request completed with client error");
    } else {
      req.log.info(logData, "Request completed");
    }
  });

  next();
}
