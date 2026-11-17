/**
 * Tests for Environment Configuration & Zod Validation (src/config/env.ts)
 */

import { describe, it, expect } from "vitest";
import { validateEnv, envSchema, isValidHttpOrigin } from "../../src/config/env";

describe("Environment Configuration & Validation", () => {
  it("successfully parses valid environment variables with defaults", () => {
    const raw = {
      DATABASE_URL: "postgresql://postgres:secret@localhost:5432/testdb?schema=public",
    };

    const parsed = validateEnv(raw);
    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.PORT).toBe(4000);
    expect(parsed.DATABASE_URL).toBe(raw.DATABASE_URL);
    expect(parsed.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:3000"]);
    expect(parsed.LOG_LEVEL).toBe("info");
  });

  it("coerces PORT string to integer", () => {
    const raw = {
      DATABASE_URL: "postgresql://localhost:5432/db",
      PORT: "8080",
    };

    const parsed = validateEnv(raw);
    expect(parsed.PORT).toBe(8080);
  });

  it("splits comma-separated CORS_ALLOWED_ORIGINS into an array and normalizes trailing slashes", () => {
    const raw = {
      DATABASE_URL: "postgresql://localhost:5432/db",
      CORS_ALLOWED_ORIGINS: "http://localhost:3000, https://admin.mytravelroad.com/, http://127.0.0.1:3000",
    };

    const parsed = validateEnv(raw);
    expect(parsed.CORS_ALLOWED_ORIGINS).toEqual([
      "http://localhost:3000",
      "https://admin.mytravelroad.com",
      "http://127.0.0.1:3000",
    ]);
  });

  it("validates RFC 6454 HTTP(S) origins via isValidHttpOrigin", () => {
    // Valid origins
    expect(isValidHttpOrigin("http://localhost:3000")).toBe(true);
    expect(isValidHttpOrigin("https://mytravelroad.com")).toBe(true);
    expect(isValidHttpOrigin("https://admin.mytravelroad.com:8443")).toBe(true);
    expect(isValidHttpOrigin("http://127.0.0.1:4000")).toBe(true);
    expect(isValidHttpOrigin("https://example.com/")).toBe(true);

    // Invalid: wildcards
    expect(isValidHttpOrigin("*")).toBe(false);
    expect(isValidHttpOrigin("https://*.example.com")).toBe(false);

    // Invalid: userinfo / credentials
    expect(isValidHttpOrigin("https://user:pass@example.com")).toBe(false);

    // Invalid: URL paths
    expect(isValidHttpOrigin("https://example.com/api")).toBe(false);
    expect(isValidHttpOrigin("http://localhost:3000/app/v1")).toBe(false);

    // Invalid: query strings and fragments
    expect(isValidHttpOrigin("http://localhost:3000?debug=true")).toBe(false);
    expect(isValidHttpOrigin("http://localhost:3000#section")).toBe(false);

    // Invalid: non-http(s) protocols
    expect(isValidHttpOrigin("ftp://example.com")).toBe(false);
    expect(isValidHttpOrigin("javascript:alert(1)")).toBe(false);

    // Invalid: malformed strings
    expect(isValidHttpOrigin("localhost:3000")).toBe(false);
    expect(isValidHttpOrigin("")).toBe(false);
  });

  it("rejects invalid CORS origins during environment validation", () => {
    const base = { DATABASE_URL: "postgresql://localhost:5432/db" };

    // Wildcard
    expect(() =>
      validateEnv({ ...base, CORS_ALLOWED_ORIGINS: "*" })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an invalid HTTP\(S\) origin entry/);
    expect(() =>
      validateEnv({ ...base, CORS_ALLOWED_ORIGINS: "http://localhost:3000, *" })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an invalid HTTP\(S\) origin entry/);

    // Path
    expect(() =>
      validateEnv({ ...base, CORS_ALLOWED_ORIGINS: "https://example.com/api" })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an invalid HTTP\(S\) origin entry/);

    // Credentials
    expect(() =>
      validateEnv({
        ...base,
        CORS_ALLOWED_ORIGINS: "https://admin:secret@domain.com",
      })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an invalid HTTP\(S\) origin entry/);

    // Query string
    expect(() =>
      validateEnv({
        ...base,
        CORS_ALLOWED_ORIGINS: "http://localhost:3000?token=123",
      })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an invalid HTTP\(S\) origin entry/);

    // Fragment
    expect(() =>
      validateEnv({
        ...base,
        CORS_ALLOWED_ORIGINS: "http://localhost:3000#admin",
      })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an invalid HTTP\(S\) origin entry/);

    // Malformed
    expect(() =>
      validateEnv({ ...base, CORS_ALLOWED_ORIGINS: "example.com" })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an invalid HTTP\(S\) origin entry/);
  });

  it("prevents secret leakage in CORS configuration validation errors", () => {
    const base = { DATABASE_URL: "postgresql://localhost:5432/db" };
    const secretValue = "SUPER_SECRET_ADMIN_TOKEN_999888";

    let thrownError: Error | null = null;
    try {
      validateEnv({
        ...base,
        CORS_ALLOWED_ORIGINS: `https://admin:${secretValue}@example.com`,
      });
    } catch (err) {
      thrownError = err as Error;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toContain(
      "CORS_ALLOWED_ORIGINS contains an invalid HTTP(S) origin entry."
    );
    // Explicitly assert that the credential/secret value is NEVER leaked in the error message
    expect(thrownError?.message).not.toContain(secretValue);
    expect(thrownError?.message).not.toContain("admin:");
    expect(thrownError?.message).not.toContain("example.com");
  });

  it("rejects empty entries in comma-separated CORS configuration", () => {
    const base = { DATABASE_URL: "postgresql://localhost:5432/db" };

    // Trailing comma
    expect(() =>
      validateEnv({
        ...base,
        CORS_ALLOWED_ORIGINS: "http://localhost:3000,",
      })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an empty origin entry/);

    // Consecutive commas
    expect(() =>
      validateEnv({
        ...base,
        CORS_ALLOWED_ORIGINS: "http://localhost:3000,,https://example.com",
      })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an empty origin entry/);

    // Leading comma
    expect(() =>
      validateEnv({
        ...base,
        CORS_ALLOWED_ORIGINS: ",http://localhost:3000",
      })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an empty origin entry/);

    // Whitespace comma
    expect(() =>
      validateEnv({
        ...base,
        CORS_ALLOWED_ORIGINS: "http://localhost:3000,   ,https://example.com",
      })
    ).toThrowError(/CORS_ALLOWED_ORIGINS contains an empty origin entry/);

    // Empty string
    expect(() =>
      validateEnv({
        ...base,
        CORS_ALLOWED_ORIGINS: "",
      })
    ).toThrowError(/CORS_ALLOWED_ORIGINS must contain at least one valid HTTP\(S\) origin/);
  });

  it("rejects invalid NODE_ENV values", () => {
    const raw = {
      DATABASE_URL: "postgresql://localhost:5432/db",
      NODE_ENV: "invalid_env" as any,
    };

    expect(() => validateEnv(raw)).toThrowError(/Invalid environment configuration/);
  });

  it("rejects out-of-range PORT values (< 1 or > 65535)", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://localhost:5432/db",
        PORT: "-1",
      })
    ).toThrowError();

    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://localhost:5432/db",
        PORT: "70000",
      })
    ).toThrowError();
  });

  it("rejects missing DATABASE_URL", () => {
    expect(() => validateEnv({})).toThrowError(/DATABASE_URL/);
  });

  it("rejects invalid LOG_LEVEL", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://localhost:5432/db",
        LOG_LEVEL: "super_verbose" as any,
      })
    ).toThrowError();
  });
});
