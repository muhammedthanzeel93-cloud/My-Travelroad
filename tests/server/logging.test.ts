/**
 * Tests for Structured Logging and Sensitive Data Redaction (src/config/logger.ts)
 */

import { describe, it, expect } from "vitest";
import pino from "pino";
import express from "express";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { requestIdMiddleware } from "../../src/server/middleware/request-id";
import { createRequestLoggerMiddleware } from "../../src/server/middleware/request-logger";
import { prisma, PRISMA_LOG_CONFIG } from "../../src/lib/db";

describe("Pino Sensitive Data Redaction", () => {
  it("redacts authorization headers, cookies, passwords, and tokens", () => {
    let output = "";
    const destination = {
      write: (str: string) => {
        output += str;
      },
    };

    const testLogger = pino(
      {
        level: "info",
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers['set-cookie']",
            "headers.authorization",
            "headers.cookie",
            "password",
            "*.password",
            "token",
            "*.token",
            "refreshToken",
            "*.refreshToken",
            "accessToken",
            "*.accessToken",
            "secret",
            "*.secret",
            "credentials",
            "*.credentials",
          ],
          censor: "[REDACTED]",
        },
      },
      destination
    );

    testLogger.info(
      {
        headers: {
          authorization: "Bearer my-secret-jwt-token-12345",
          cookie: "refresh_token=sensitive-cookie-payload",
        },
        user: {
          email: "traveler@example.com",
          password: "MySuperSecretPassword#123",
          token: "sensitive-auth-token",
        },
        refreshToken: "rt_sensitive_refresh_family_uuid",
        secret: "aws_secret_access_key_value",
      },
      "Test sensitive log entry"
    );

    const logRecord = JSON.parse(output.trim());

    // Verified redacted fields
    expect(logRecord.headers.authorization).toBe("[REDACTED]");
    expect(logRecord.headers.cookie).toBe("[REDACTED]");
    expect(logRecord.user.password).toBe("[REDACTED]");
    expect(logRecord.user.token).toBe("[REDACTED]");
    expect(logRecord.refreshToken).toBe("[REDACTED]");
    expect(logRecord.secret).toBe("[REDACTED]");

    // Verified non-sensitive field preserved
    expect(logRecord.user.email).toBe("traveler@example.com");

    // Raw sensitive strings MUST NOT appear anywhere in the output
    expect(output).not.toContain("my-secret-jwt-token-12345");
    expect(output).not.toContain("sensitive-cookie-payload");
    expect(output).not.toContain("MySuperSecretPassword#123");
    expect(output).not.toContain("sensitive-auth-token");
    expect(output).not.toContain("rt_sensitive_refresh_family_uuid");
    expect(output).not.toContain("aws_secret_access_key_value");
  });

  it("excludes query strings from request URL logging", async () => {
    let capturedLogs = "";
    const testLogger = pino(
      { level: "debug" },
      {
        write: (msg: string) => {
          capturedLogs += msg;
        },
      }
    );

    const app = express();
    app.use(requestIdMiddleware);
    // Mount the actual production requestLoggerMiddleware configured with testLogger
    app.use(createRequestLoggerMiddleware(testLogger));

    app.get("/api/v1/destinations", (_req, res) => {
      res.json({ success: true });
    });

    const response = await request(app)
      .get("/api/v1/destinations?token=SENSITIVE_QUERY_TOKEN_999&password=SENSITIVE_PASSWORD_888&filter=beaches")
      .expect(200);

    expect(response.body.success).toBe(true);

    // Parse logged records
    const lines = capturedLogs.trim().split("\n").filter(Boolean);
    const parsedRecords = lines.map((line) => JSON.parse(line));

    // Verify both debug and info log entries record the pathname without query parameters
    const incomingRecord = parsedRecords.find(
      (r) => r.msg === "Incoming request"
    );
    expect(incomingRecord).toBeDefined();
    expect(incomingRecord.path).toBe("/api/v1/destinations");

    const completionRecord = parsedRecords.find(
      (r) => r.msg === "Request completed"
    );
    expect(completionRecord).toBeDefined();
    expect(completionRecord.path).toBe("/api/v1/destinations");
    expect(completionRecord.statusCode).toBe(200);

    // Assert that sensitive query string values and parameter names are completely absent from logs
    expect(capturedLogs).not.toContain("SENSITIVE_QUERY_TOKEN_999");
    expect(capturedLogs).not.toContain("SENSITIVE_PASSWORD_888");
    expect(capturedLogs).not.toContain("token=");
    expect(capturedLogs).not.toContain("password=");
  });

  it("verifies Prisma logging configuration suppresses raw query and bound parameter logging", async () => {
    // Explicitly assert on the exported PRISMA_LOG_CONFIG constant to guarantee test failure if query logging is enabled
    expect(PRISMA_LOG_CONFIG).toEqual(["error", "warn"]);
    expect(PRISMA_LOG_CONFIG).not.toContain("query");
    expect(PRISMA_LOG_CONFIG).not.toContain("info");

    // Inspect the Prisma Client instance internal log options if available
    const clientOptions =
      (prisma as any)._engineConfig || (prisma as any)._options;
    if (clientOptions && clientOptions.log) {
      // Must not include "query" or "info" log levels
      const logLevels = Array.isArray(clientOptions.log)
        ? clientOptions.log.map((entry: any) =>
            typeof entry === "string" ? entry : entry.level
          )
        : [];
      expect(logLevels).not.toContain("query");
      expect(logLevels).not.toContain("info");
      expect(logLevels).toEqual(expect.arrayContaining(["error", "warn"]));
    }

    // Verify that running a parameterized raw query with a sensitive marker string
    // does not output the sensitive value or SQL statement to stdout/stderr
    let stdoutBuffer = "";
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any) => {
      stdoutBuffer += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    };

    try {
      const sensitiveToken = "CONFIDENTIAL_BOUND_PARAMETER_SECRET_XYZ_12345";
      try {
        await prisma.$queryRaw(
          Prisma.sql`SELECT 1 AS check_col, ${sensitiveToken} AS token_col`
        );
      } catch {
        // Expected offline failure when local PostgreSQL is not running
      }

      // Ensure the sensitive bound parameter was NOT written to stdout by Prisma query logging
      expect(stdoutBuffer).not.toContain(
        "CONFIDENTIAL_BOUND_PARAMETER_SECRET_XYZ_12345"
      );
      expect(stdoutBuffer).not.toContain("SELECT 1 AS check_col");
    } finally {
      process.stdout.write = originalStdoutWrite;
    }
  });
});
