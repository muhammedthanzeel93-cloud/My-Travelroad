/**
 * Tests for Request ID Tracing Middleware (src/server/middleware/request-id.ts)
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { requestIdMiddleware } from "../../src/server/middleware/request-id";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("Request ID Middleware", () => {
  it("generates a cryptographically secure UUIDv4 when X-Request-Id is missing", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/test", (req, res) => {
      res.json({ id: req.id });
    });

    const response = await request(app).get("/test");

    expect(response.status).toBe(200);
    expect(response.body.id).toMatch(UUID_V4_REGEX);
    expect(response.headers["x-request-id"]).toBe(response.body.id);
  });

  it("preserves and propagates a valid client-supplied X-Request-Id", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/test", (req, res) => {
      res.json({ id: req.id });
    });

    const customId = "client-req-01J9X78Q29ZAB-1234_abc";
    const response = await request(app)
      .get("/test")
      .set("X-Request-Id", customId);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(customId);
    expect(response.headers["x-request-id"]).toBe(customId);
  });

  it("discards and generates fresh UUIDv4 when client X-Request-Id contains illegal characters", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/test", (req, res) => {
      res.json({ id: req.id });
    });

    const maliciousId = "invalid id with spaces<script>";
    const response = await request(app)
      .get("/test")
      .set("X-Request-Id", maliciousId);

    expect(response.status).toBe(200);
    expect(response.body.id).not.toBe(maliciousId);
    expect(response.body.id).toMatch(UUID_V4_REGEX);
    expect(response.headers["x-request-id"]).toBe(response.body.id);
  });

  it("discards and replaces X-Request-Id exceeding 64 characters", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/test", (req, res) => {
      res.json({ id: req.id });
    });

    const tooLongId = "a".repeat(65);
    const response = await request(app)
      .get("/test")
      .set("X-Request-Id", tooLongId);

    expect(response.status).toBe(200);
    expect(response.body.id).not.toBe(tooLongId);
    expect(response.body.id).toMatch(UUID_V4_REGEX);
  });
});
