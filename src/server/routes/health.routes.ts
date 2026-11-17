/**
 * My Travelroad — Health & Readiness Endpoints
 * Basic process liveness and sanitized database connectivity probes.
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/db";
import { ApiSuccessResponse, ApiErrorResponse } from "../types/response.types";
import { ErrorCode } from "../errors/error-codes";

export function createHealthRouter(prismaClient: PrismaClient = defaultPrisma): Router {
  const router = Router();

  /**
   * GET /health
   * Liveness probe verifying process responsiveness.
   */
  router.get("/", (_req: Request, res: Response) => {
    const response: ApiSuccessResponse<{
      status: string;
      uptime: number;
      timestamp: string;
    }> = {
      success: true,
      data: {
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    };

    res.status(200).json(response);
  });

  /**
   * GET /health/ready
   * Readiness probe verifying active database connectivity via SELECT 1.
   * Suppresses database connection strings, error messages, and internal traces on failure.
   */
  router.get("/ready", async (req: Request, res: Response) => {
    const requestId = req.id || "unknown";
    const timestamp = new Date().toISOString();

    try {
      await prismaClient.$queryRaw`SELECT 1`;

      const response: ApiSuccessResponse<{
        status: string;
        database: string;
        timestamp: string;
      }> = {
        success: true,
        data: {
          status: "ready",
          database: "connected",
          timestamp,
        },
      };

      res.status(200).json(response);
    } catch (err) {
      if (req.log) {
        req.log.error({ err, requestId }, "Database readiness probe failed");
      }

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: "Database readiness check failed",
          requestId,
          timestamp,
        },
      };

      res.status(503).json(errorResponse);
    }
  });

  return router;
}
