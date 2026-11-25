/**
 * Unit Tests for RedisSessionStore, Keys, and Anti-CSRF Middleware
 * (src/server/redis/session.store.ts & src/server/middleware/csrf.ts)
 */

import { describe, it, expect, vi } from "vitest";
import { Request, Response } from "express";
import { RedisSessionStore } from "../../../src/server/redis/session.store";
import {
  SESSION_TTL_SECONDS,
  TOMBSTONE_TTL_SECONDS,
  COMPROMISED_FAMILY_TTL_SECONDS,
} from "../../../src/server/redis/redis.types";
import {
  csrfProtectionMiddleware,
  REQUIRED_CSRF_HEADER,
  REQUIRED_CSRF_VALUE,
} from "../../../src/server/middleware/csrf";
import { BadRequestError, ServiceUnavailableError } from "../../../src/server/errors/app-error";
import { ErrorCode } from "../../../src/server/errors/error-codes";

describe("RedisSessionStore Key Naming & Hash-Tag Contract", () => {
  const store = new RedisSessionStore();
  const familyId = "550e8400-e29b-41d4-a716-446655440001";
  const sessionId = "550e8400-e29b-41d4-a716-446655440002";
  const tokenHash = "a".repeat(64);
  const accountId = "550e8400-e29b-41d4-a716-446655440099";

  it("enforces {familyId} hash tagging for Redis Cluster single-slot execution", () => {
    expect(store.familyKey(familyId)).toBe(`family:{${familyId}}`);
    expect(store.sessionKey(familyId, sessionId)).toBe(`session:{${familyId}}:${sessionId}`);
    expect(store.tokenLookupKey(familyId, tokenHash)).toBe(`token_lookup:{${familyId}}:${tokenHash}`);
    expect(store.revokedTokenKey(familyId, tokenHash)).toBe(`revoked_token:{${familyId}}:${tokenHash}`);
  });

  it("decouples account_sessions key outside the family slot", () => {
    expect(store.accountSessionsKey(accountId)).toBe(`account_sessions:${accountId}`);
    // Must NOT contain {familyId}
    expect(store.accountSessionsKey(accountId)).not.toContain(`{${familyId}}`);
  });

  it("preserves approved TTL constants", () => {
    expect(SESSION_TTL_SECONDS).toBe(2592000); // 30 days
    expect(TOMBSTONE_TTL_SECONDS).toBe(86400); // 24 hours
    expect(COMPROMISED_FAMILY_TTL_SECONDS).toBe(86400); // 24 hours
  });

  it("fails closed with ServiceUnavailableError when Redis client throws", async () => {
    const errorClient = {
      status: "ready",
      hgetall: vi.fn().mockRejectedValue(new Error("Connection lost")),
    } as any;

    const failingStore = new RedisSessionStore(errorClient);

    await expect(failingStore.getFamily(familyId)).rejects.toThrow(
      ServiceUnavailableError
    );
  });
});

describe("Anti-CSRF Protection Middleware", () => {
  it("allows requests presenting valid X-Requested-With: XMLHttpRequest", () => {
    const req = {
      headers: {
        [REQUIRED_CSRF_HEADER]: REQUIRED_CSRF_VALUE,
      },
    } as unknown as Request;

    const res = {} as Response;
    const next = vi.fn();

    csrfProtectionMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("accepts case-insensitive variations of XMLHttpRequest", () => {
    const variations = ["XMLHttpRequest", "xmlhttprequest", "XMLHTTPREQUEST", "  xmlhttprequest  "];

    for (const val of variations) {
      const req = {
        headers: {
          [REQUIRED_CSRF_HEADER]: val,
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = vi.fn();

      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects requests missing the X-Requested-With header with 400 Bad Request", () => {
    const req = {
      headers: {},
    } as unknown as Request;

    const res = {} as Response;
    const next = vi.fn();

    expect(() => csrfProtectionMiddleware(req, res, next)).toThrow(BadRequestError);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests with incorrect header value (e.g. Fetch or custom)", () => {
    const req = {
      headers: {
        [REQUIRED_CSRF_HEADER]: "Fetch",
      },
    } as unknown as Request;

    const res = {} as Response;
    const next = vi.fn();

    expect(() => csrfProtectionMiddleware(req, res, next)).toThrow(BadRequestError);
    expect(next).not.toHaveBeenCalled();
  });
});
