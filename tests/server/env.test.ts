/**
 * Tests for Environment Configuration & Zod Validation (src/config/env.ts)
 */

import { describe, it, expect } from "vitest";
import { validateEnv, envSchema } from "../../src/config/env";

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

  it("splits comma-separated CORS_ALLOWED_ORIGINS into an array", () => {
    const raw = {
      DATABASE_URL: "postgresql://localhost:5432/db",
      CORS_ALLOWED_ORIGINS: "http://localhost:3000, https://admin.mytravelroad.com, http://127.0.0.1:3000",
    };

    const parsed = validateEnv(raw);
    expect(parsed.CORS_ALLOWED_ORIGINS).toEqual([
      "http://localhost:3000",
      "https://admin.mytravelroad.com",
      "http://127.0.0.1:3000",
    ]);
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
