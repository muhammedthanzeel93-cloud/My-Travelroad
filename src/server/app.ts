/**
 * My Travelroad — Express Application Factory
 * Configures centralized middleware, security headers, routing, and error handling.
 */

import express, { Express } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import { Logger } from "pino";
import { env } from "../config/env";
import { requestIdMiddleware } from "./middleware/request-id";
import { createCorsMiddleware } from "./middleware/cors";
import {
  requestLoggerMiddleware,
  createRequestLoggerMiddleware,
} from "./middleware/request-logger";
import { notFoundHandler, errorHandler } from "./middleware/error-handler";
import { createHealthRouter } from "./routes/health.routes";
import { createApiRouter } from "./routes";

export interface AppOptions {
  prismaClient?: PrismaClient;
  corsOrigins?: string[];
  logger?: Logger;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  // 1. Request ID Generation & Tracing
  app.use(requestIdMiddleware);

  // 2. HTTP Security Headers
  app.use(helmet());

  // 3. CORS Controls
  const allowedOrigins = options.corsOrigins ?? env.CORS_ALLOWED_ORIGINS;
  app.use(createCorsMiddleware(allowedOrigins));

  // 4. Body Parsing with Explicit Size Limits
  app.use(express.json({ limit: "100kb" }));

  // 5. Cookie Parser
  app.use(cookieParser());

  // 6. Correlated Request Logger
  app.use(
    options.logger
      ? createRequestLoggerMiddleware(options.logger)
      : requestLoggerMiddleware
  );

  // 7. Route Mounting
  // Top-level liveness & readiness probes for load balancers / container orchestrators
  app.use("/health", createHealthRouter(options.prismaClient));

  // Versioned API routes
  app.use("/api/v1", createApiRouter({ prismaClient: options.prismaClient }));

  // 8. 404 Catch-All Handler
  app.use(notFoundHandler);

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
