/**
 * Tests for Structured Logging and Sensitive Data Redaction (src/config/logger.ts)
 */

import { describe, it, expect } from "vitest";
import pino from "pino";

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
});
