/**
 * Tests for Health and Readiness Endpoints (src/server/routes/health.routes.ts)
 */

import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/app";
import { PrismaClient } from "@prisma/client";

describe("Health & Readiness Probes", () => {
  it("GET /health returns 200 OK with liveness metrics", async () => {
    const app = createApp();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ok",
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      },
    });
    expect(response.headers["x-request-id"]).toBeDefined();
  });

  it("GET /api/v1/health also returns 200 OK via versioned router", async () => {
    const app = createApp();

    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
  });

  it("GET /health/ready returns 200 OK when database probe succeeds", async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as PrismaClient;

    const app = createApp({ prismaClient: mockPrisma });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ready",
        database: "connected",
        timestamp: expect.any(String),
      },
    });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("GET /health/ready returns 503 SERVICE_UNAVAILABLE when database probe fails without leaking secrets", async () => {
    const sensitiveError = new Error(
      "FATAL: password authentication failed for user 'internal_admin' at postgresql://internal_admin:s3cr3tP@ss@10.0.0.5:5432/production"
    );
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(sensitiveError),
    } as unknown as PrismaClient;

    const app = createApp({ prismaClient: mockPrisma });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Database readiness check failed",
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });

    // Verify information sanitization: no secrets, connection strings or internal errors leaked
    const rawBody = JSON.stringify(response.body);
    expect(rawBody).not.toContain("FATAL");
    expect(rawBody).not.toContain("internal_admin");
    expect(rawBody).not.toContain("s3cr3tP@ss");
    expect(rawBody).not.toContain("10.0.0.5");
    expect(rawBody).not.toContain("stack");
  });
});
