/**
 * Regression Tests for Database Safety Guard (tests/server/auth/db-safety.test.ts)
 * Verifies that assertTestDatabaseSafety and parseDatabaseConfig fail closed on any
 * dangerous, production-like, or non-conforming configuration.
 */

import { describe, it, expect } from "vitest";
import {
  parseDatabaseConfig,
  assertTestDatabaseSafety,
} from "../../helpers/db-safety.helper";

describe("Database Safety Guard & URL Parser Unit Tests", () => {
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

    it("throws clear error when database URL format is malformed", () => {
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

    it("passes when all safety requirements are satisfied", () => {
      expect(() =>
        assertTestDatabaseSafety("mytravelroad_test", "127.0.0.1", validContext)
      ).not.toThrow();
    });

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

    it("throws when host target appears to be production or cloud host", () => {
      expect(() =>
        assertTestDatabaseSafety("mytravelroad_test", "db.prod.mytravelroad.com", validContext)
      ).toThrowError(
        /SAFETY CHECK FAILED: Host 'db.prod.mytravelroad.com' appears to be a production or remote cloud server/
      );

      expect(() =>
        assertTestDatabaseSafety("mytravelroad_test", "production-db.internal", validContext)
      ).toThrowError(/appears to be a production or remote cloud server/);

      expect(() =>
        assertTestDatabaseSafety("mytravelroad_test", "db.xyz.supabase.co", validContext)
      ).toThrowError(/appears to be a production or remote cloud server/);

      expect(() =>
        assertTestDatabaseSafety("mytravelroad_test", "rds.amazonaws.com", validContext)
      ).toThrowError(/appears to be a production or remote cloud server/);
    });
  });
});
