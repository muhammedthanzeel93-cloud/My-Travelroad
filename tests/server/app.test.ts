/**
 * Tests for Express Application Factory (src/server/app.ts)
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/app";

describe("Express Application Factory", () => {
  it("initializes Express application with Helmet security headers", async () => {
    const app = createApp();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    // Helmet headers
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-dns-prefetch-control"]).toBe("off");
    expect(response.headers["x-download-options"]).toBe("noopen");
    expect(response.headers["x-permitted-cross-domain-policies"]).toBe("none");
  });

  it("permits allowed CORS origins and sets access-control headers", async () => {
    const app = createApp({
      corsOrigins: ["http://localhost:3000", "https://mytravelroad.com"],
    });

    const response = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:3000");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("blocks unauthorized CORS origins with generic 403 FORBIDDEN_ACCESS without reflecting attacker input", async () => {
    const app = createApp({
      corsOrigins: ["http://localhost:3000"],
    });

    const maliciousOrigin = "http://unauthorized-attacker.example.com/<script>alert(1)</script>";
    const response = await request(app)
      .get("/health")
      .set("Origin", maliciousOrigin);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "FORBIDDEN_ACCESS",
        message: "Cross-origin request forbidden by CORS policy",
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });

    // Explicitly verify zero reflection of attacker-controlled Origin input
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("unauthorized-attacker");
    expect(serialized).not.toContain("<script>");
    expect(serialized).not.toContain("alert(1)");
  });

  it("enforces 100kb payload size limit on JSON bodies", async () => {
    const app = createApp();

    // Create a payload larger than 100kb (~120kb)
    const largeData = {
      content: "x".repeat(120 * 1024),
    };

    const response = await request(app)
      .post("/health")
      .send(largeData);

    // Express body-parser rejects payloads > limit with 413 or 400
    expect([400, 413]).toContain(response.status);
    expect(response.body.success).toBe(false);
  });
});
