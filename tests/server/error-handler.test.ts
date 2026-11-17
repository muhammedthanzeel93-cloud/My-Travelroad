/**
 * Tests for Centralized Error Handling & Taxonomy (src/server/middleware/error-handler.ts)
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { z } from "zod";
import { createApp } from "../../src/server/app";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ServiceUnavailableError,
} from "../../src/server/errors/app-error";
import { errorHandler, notFoundHandler } from "../../src/server/middleware/error-handler";
import { requestIdMiddleware } from "../../src/server/middleware/request-id";

describe("Centralized Error Handling", () => {
  it("returns 404 RESOURCE_NOT_FOUND envelope for unmatched routes", async () => {
    const app = createApp();

    const response = await request(app).get("/api/v1/non-existent-endpoint");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Cannot GET /api/v1/non-existent-endpoint",
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it("handles custom AppError subclasses with correct status and error code", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());

    app.get("/test/bad-request", () => {
      throw new BadRequestError("Invalid parameter supplied", [
        { field: "sort", issue: "Must be asc or desc" },
      ]);
    });

    app.get("/test/unauthorized", () => {
      throw new UnauthorizedError("Session expired");
    });

    app.get("/test/forbidden", () => {
      throw new ForbiddenError("Administrative privilege required");
    });

    app.get("/test/conflict", () => {
      throw new ConflictError("Email already in use");
    });

    app.get("/test/service-unavailable", () => {
      throw new ServiceUnavailableError("Cache node temporarily unreachable");
    });

    app.use(errorHandler);

    // 1. Bad Request
    const resBad = await request(app).get("/test/bad-request");
    expect(resBad.status).toBe(400);
    expect(resBad.body.error.code).toBe("BAD_REQUEST");
    expect(resBad.body.error.details).toEqual([
      { field: "sort", issue: "Must be asc or desc" },
    ]);

    // 2. Unauthorized
    const resAuth = await request(app).get("/test/unauthorized");
    expect(resAuth.status).toBe(401);
    expect(resAuth.body.error.code).toBe("AUTHENTICATION_REQUIRED");

    // 3. Forbidden
    const resForbid = await request(app).get("/test/forbidden");
    expect(resForbid.status).toBe(403);
    expect(resForbid.body.error.code).toBe("FORBIDDEN_ACCESS");

    // 4. Conflict
    const resConflict = await request(app).get("/test/conflict");
    expect(resConflict.status).toBe(409);
    expect(resConflict.body.error.code).toBe("DUPLICATE_RESOURCE");

    // 5. Service Unavailable
    const resUnavailable = await request(app).get("/test/service-unavailable");
    expect(resUnavailable.status).toBe(503);
    expect(resUnavailable.body.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("handles ZodError by returning 422 VALIDATION_FAILED with field details", async () => {
    const dummySchema = z.object({
      email: z.string().email("Invalid email address"),
      age: z.number().min(18, "Must be at least 18"),
    });

    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());

    app.post("/test/zod", (req) => {
      dummySchema.parse(req.body);
    });

    app.use(errorHandler);

    const response = await request(app)
      .post("/test/zod")
      .send({ email: "invalid-email", age: 16 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "The request body failed schema validation.",
        details: [
          { field: "email", issue: "Invalid email address" },
          { field: "age", issue: "Must be at least 18" },
        ],
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it("returns 400 BAD_REQUEST for malformed JSON request bodies", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send("{ malformed json: true, ");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "Malformed JSON in request body",
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it("sanitizes unexpected internal 500 errors and withholds stack traces", async () => {
    const app = express();
    app.use(requestIdMiddleware);

    app.get("/test/crash", () => {
      throw new Error("SECRET_INTERNAL_CRASH_INFO: database connection pool exhausted");
    });

    app.use(errorHandler);

    const response = await request(app).get("/test/crash");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected internal server error occurred",
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain("SECRET_INTERNAL_CRASH_INFO");
    expect(raw).not.toContain("stack");
  });
});
