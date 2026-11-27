/**
 * Regression Tests for Database Safety Guard (tests/server/auth/db-safety.test.ts)
 * Verifies that assertTestDatabaseSafety, isApprovedTestHost, normalizeHost, and parseDatabaseConfig
 * fail closed on any dangerous, unapproved remote host, production-like, or non-conforming configuration.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  parseDatabaseConfig,
  assertTestDatabaseSafety,
  normalizeHost,
  isApprovedTestHost,
  APPROVED_LOCAL_HOSTS,
  APPROVED_CONTAINER_HOSTS,
} from "../../helpers/db-safety.helper";

describe("Database Safety Guard & Host Allowlist Unit Tests", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("normalizeHost", () => {
    it("lowercases and trims hostnames", () => {
      expect(normalizeHost("  LocalHost  ")).toBe("localhost");
      expect(normalizeHost("127.0.0.1")).toBe("127.0.0.1");
      expect(normalizeHost("POSTGRES")).toBe("postgres");
    });

    it("strips outer square brackets from IPv6 hostnames", () => {
      expect(normalizeHost("[::1]")).toBe("::1");
      expect(normalizeHost("::1")).toBe("::1");
    });

    it("returns empty string for undefined, null, or empty string", () => {
      expect(normalizeHost("")).toBe("");
      expect(normalizeHost(undefined as unknown as string)).toBe("");
    });
  });

  describe("isApprovedTestHost", () => {
    it("identifies approved local loopback hosts", () => {
      expect(isApprovedTestHost("localhost")).toBe(true);
      expect(isApprovedTestHost("127.0.0.1")).toBe(true);
      expect(isApprovedTestHost("::1")).toBe(true);
      expect(isApprovedTestHost("[::1]")).toBe(true);
      expect(isApprovedTestHost("LOCALHOST")).toBe(true);
    });

    it("identifies approved standard container hosts", () => {
      expect(isApprovedTestHost("host.docker.internal")).toBe(true);
      expect(isApprovedTestHost("gateway.docker.internal")).toBe(true);
      expect(isApprovedTestHost("postgres")).toBe(true);
      expect(isApprovedTestHost("database")).toBe(true);
      expect(isApprovedTestHost("db")).toBe(true);
      expect(isApprovedTestHost("test-db")).toBe(true);
      expect(isApprovedTestHost("local-db")).toBe(true);
    });

    it("identifies custom allowed hosts when provided", () => {
      expect(isApprovedTestHost("ci-db", ["ci-db", "k8s-postgres"])).toBe(true);
      expect(isApprovedTestHost("k8s-postgres", ["ci-db", "k8s-postgres"])).toBe(true);
      expect(isApprovedTestHost("unlisted-db", ["ci-db"])).toBe(false);
    });

    it("returns false for arbitrary unapproved hosts", () => {
      expect(isApprovedTestHost("192.168.1.50")).toBe(false);
      expect(isApprovedTestHost("10.0.0.1")).toBe(false);
      expect(isApprovedTestHost("remote-postgres.corp")).toBe(false);
      expect(isApprovedTestHost("db.example.com")).toBe(false);
    });
  });

  describe("parseDatabaseConfig", () => {
    it("successfully parses valid PostgreSQL URL with custom port", () => {
      const config = parseDatabaseConfig(
        "postgresql://testuser:testpass@127.0.0.1:5433/mytravelroad_test?schema=public"
      );
      expect(config.host).toBe("127.0.0.1");
      expect(config.port).toBe(5433);
      expect(config.database).toBe("mytravelroad_test");
    });

    it("defaults port to 5432 when omitted in URL", () => {
      const config = parseDatabaseConfig(
        "postgresql://testuser:testpass@localhost/mytravelroad_test"
      );
      expect(config.host).toBe("localhost");
      expect(config.port).toBe(5432);
      expect(config.database).toBe("mytravelroad_test");
    });

    it("strips brackets from IPv6 hostnames in database URL", () => {
      const config = parseDatabaseConfig(
        "postgresql://testuser:testpass@[::1]:5432/mytravelroad_test"
      );
      expect(config.host).toBe("::1");
      expect(config.port).toBe(5432);
      expect(config.database).toBe("mytravelroad_test");
    });

    it("throws clear error when database URL is missing or empty", () => {
      expect(() => parseDatabaseConfig(undefined)).toThrowError(
        /TEST DATABASE SAFETY ERROR: Database URL is missing or empty/
      );
      expect(() => parseDatabaseConfig("")).toThrowError(
        /TEST DATABASE SAFETY ERROR: Database URL is missing or empty/
      );
      expect(() => parseDatabaseConfig("   ")).toThrowError(
        /TEST DATABASE SAFETY ERROR: Database URL is missing or empty/
      );
    });

    it("throws clear error when database URL format is malformed (never leaks passwords)", () => {
      expect(() => parseDatabaseConfig("not-a-valid-url")).toThrowError(
        /TEST DATABASE SAFETY ERROR: Invalid database URL format/
      );
    });
  });

  describe("assertTestDatabaseSafety", () => {
    const validContext = {
      testDatabaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/mytravelroad_test?schema=public",
      allowDestructiveDbTests: "true",
      nodeEnv: "test",
    };

    describe("Approved local loopback hosts", () => {
      it("passes for 127.0.0.1", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "127.0.0.1", validContext)
        ).not.toThrow();
      });

      it("passes for localhost", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "localhost", validContext)
        ).not.toThrow();
      });

      it("passes for ::1", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "::1", validContext)
        ).not.toThrow();
      });

      it("passes for [::1] (bracketed IPv6)", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "[::1]", validContext)
        ).not.toThrow();
      });

      it("passes case-insensitively for LocalHost and 127.0.0.1", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "LocalHost", validContext)
        ).not.toThrow();
      });
    });

    describe("Approved standard container hosts", () => {
      it.each(Array.from(APPROVED_CONTAINER_HOSTS))("passes for container host '%s'", (containerHost) => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", containerHost, validContext)
        ).not.toThrow();
      });
    });

    describe("Controlled custom container host configuration", () => {
      it("passes when custom host is in context.allowedHosts", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "custom-ci-postgres", {
            ...validContext,
            allowedHosts: ["custom-ci-postgres"],
          })
        ).not.toThrow();
      });

      it("passes when custom host is in context.testAllowedDbHosts (comma-separated)", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "runner-db", {
            ...validContext,
            testAllowedDbHosts: "runner-db,test-pod-db",
          })
        ).not.toThrow();
      });

      it("passes when custom host is set in process.env.TEST_ALLOWED_DB_HOSTS", () => {
        process.env.TEST_ALLOWED_DB_HOSTS = "k8s-test-postgres,compose-db";
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "k8s-test-postgres", validContext)
        ).not.toThrow();
      });
    });

    describe("Arbitrary unapproved remote hostnames fail closed", () => {
      it("rejects arbitrary private LAN IP addresses", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "192.168.1.50", validContext)
        ).toThrowError(/SAFETY CHECK FAILED: Host '192.168.1.50' is not an approved test database host/);

        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "10.0.0.1", validContext)
        ).toThrowError(/not an approved test database host/);
      });

      it("rejects arbitrary external domain names", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "database.internal-corp.net", validContext)
        ).toThrowError(/not an approved test database host/);

        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "remote-postgres.example.com", validContext)
        ).toThrowError(/not an approved test database host/);

        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "8.8.8.8", validContext)
        ).toThrowError(/not an approved test database host/);
      });
    });

    describe("Production and cloud host targets fail closed (defense-in-depth)", () => {
      it("rejects production domain patterns", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "db.prod.mytravelroad.com", validContext)
        ).toThrowError(
          /SAFETY CHECK FAILED: Host 'db.prod.mytravelroad.com' appears to be a production or remote cloud server/
        );

        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "production-db.internal", validContext)
        ).toThrowError(/appears to be a production or remote cloud server/);
      });

      it("rejects remote cloud providers (AWS, Supabase)", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "db.xyz.supabase.co", validContext)
        ).toThrowError(/appears to be a production or remote cloud server/);

        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "rds.amazonaws.com", validContext)
        ).toThrowError(/appears to be a production or remote cloud server/);
      });

      it("rejects production hosts even if explicitly placed in allowedHosts", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "db.prod.mytravelroad.com", {
            ...validContext,
            allowedHosts: ["db.prod.mytravelroad.com"],
          })
        ).toThrowError(/appears to be a production or remote cloud server/);
      });
    });

    describe("Fail-closed configuration checks", () => {
      it("throws when ALLOW_DESTRUCTIVE_DB_TESTS is not 'true'", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "127.0.0.1", {
            ...validContext,
            allowDestructiveDbTests: "false",
          })
        ).toThrowError(
          /TEST DATABASE SAFETY ERROR: Destructive database integration tests require ALLOW_DESTRUCTIVE_DB_TESTS=true/
        );

        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "127.0.0.1", {
            ...validContext,
            allowDestructiveDbTests: undefined,
          })
        ).toThrowError(/ALLOW_DESTRUCTIVE_DB_TESTS=true/);
      });

      it("throws when NODE_ENV is 'production'", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "127.0.0.1", {
            ...validContext,
            nodeEnv: "production",
          })
        ).toThrowError(
          /SAFETY CHECK FAILED: Refusing to run destructive database integration tests when NODE_ENV is 'production'/
        );
      });

      it("throws when TEST_DATABASE_URL is missing or empty (prohibits fallback to DATABASE_URL)", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "127.0.0.1", {
            ...validContext,
            testDatabaseUrl: undefined,
          })
        ).toThrowError(
          /TEST DATABASE SAFETY ERROR: TEST_DATABASE_URL must be explicitly set for destructive integration tests. Falling back to DATABASE_URL is strictly forbidden/
        );

        expect(() =>
          assertTestDatabaseSafety("mytravelroad_test", "127.0.0.1", {
            ...validContext,
            testDatabaseUrl: "",
          })
        ).toThrowError(/Falling back to DATABASE_URL is strictly forbidden/);
      });

      it("throws when database name does not contain 'test'", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad", "127.0.0.1", validContext)
        ).toThrowError(
          /SAFETY CHECK FAILED: Database name 'mytravelroad' does not conform to test database naming policy/
        );

        expect(() =>
          assertTestDatabaseSafety("travelroad_development", "127.0.0.1", validContext)
        ).toThrowError(/does not conform to test database naming policy/);
      });

      it("throws when database name contains 'prod' or 'production'", () => {
        expect(() =>
          assertTestDatabaseSafety("mytravelroad_prod_test", "127.0.0.1", validContext)
        ).toThrowError(
          /SAFETY CHECK FAILED: Database name 'mytravelroad_prod_test' appears to be a production database/
        );

        expect(() =>
          assertTestDatabaseSafety("production_test_db", "127.0.0.1", validContext)
        ).toThrowError(/appears to be a production database/);
      });
    });
  });
});
