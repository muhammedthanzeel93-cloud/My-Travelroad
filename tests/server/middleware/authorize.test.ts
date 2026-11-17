/**
 * Tests for Authorization & Role Enforcement Middleware (src/server/middleware/authorize.ts)
 */

import { describe, it, expect } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import {
  requireRole,
  requireEmailVerified,
  requireAccountStatus,
  requireActiveAccount,
} from "../../../src/server/middleware/authorize";
import { errorHandler } from "../../../src/server/middleware/error-handler";
import { AuthenticatedPrincipal } from "../../../src/server/auth";
import { UserRole, AccountStatus } from "../../../src/types/domain/account.types";
import { AccountId } from "../../../src/types/domain/common.types";

function createPrincipal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    accountId: "00000000-0000-4000-8000-000000000002" as AccountId,
    email: "test@mytravelroad.com",
    role: "traveler",
    accountType: "individual",
    accountStatus: "active",
    emailVerified: true,
    ...overrides,
  };
}

describe("Authorization Middleware", () => {
  describe("requireRole", () => {
    it("throws at initialization time when no roles are provided", () => {
      expect(() => (requireRole as unknown as () => void)()).toThrow(
        "requireRole requires at least one valid UserRole"
      );
    });

    it("throws at initialization time when an invalid role is provided", () => {
      expect(() =>
        (requireRole as unknown as (r: string) => void)("invalid_role")
      ).toThrow("Invalid UserRole supplied to requireRole: 'invalid_role'");
    });

    it("rejects request when principal is missing", async () => {
      const app = express();
      app.get("/role-protected", requireRole("traveler"), (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/role-protected");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it.each<UserRole>([
      "traveler",
      "contributor",
      "curator",
      "moderator",
      "super_admin",
    ])("accepts role '%s' when explicitly allowed", async (role) => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ role });
        next();
      });
      app.get("/role-test", requireRole(role), (_req, res) => {
        res.status(200).json({ success: true, role });
      });
      app.use(errorHandler);

      const res = await request(app).get("/role-test");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.role).toBe(role);
    });

    it("rejects request with 403 FORBIDDEN_ACCESS when caller role is not listed", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ role: "traveler" });
        next();
      });
      app.get("/curators-only", requireRole("curator"), (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/curators-only");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
      expect(res.body.error.message).toContain("insufficient permissions");
    });

    it("permits request when caller possesses one of multiple allowed roles", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ role: "moderator" });
        next();
      });
      app.get("/staff-only", requireRole("curator", "moderator", "super_admin"), (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/staff-only");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("enforces zero implicit role inheritance: rejects super_admin when only curator is permitted", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ role: "super_admin" });
        next();
      });
      app.get("/curator-queue", requireRole("curator"), (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/curator-queue");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
    });
  });

  describe("requireEmailVerified", () => {
    it("rejects request when principal is missing", async () => {
      const app = express();
      app.get("/email-gated", requireEmailVerified, (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/email-gated");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("permits request when email is verified", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ emailVerified: true });
        next();
      });
      app.get("/email-gated", requireEmailVerified, (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/email-gated");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects request with 403 EMAIL_VERIFICATION_REQUIRED when email is not verified", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ emailVerified: false });
        next();
      });
      app.get("/email-gated", requireEmailVerified, (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/email-gated");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("EMAIL_VERIFICATION_REQUIRED");
      expect(res.body.error.message).toContain("Email verification is required");
    });
  });

  describe("requireAccountStatus & requireActiveAccount", () => {
    it("throws at initialization time when no statuses or invalid statuses are provided", () => {
      expect(() => (requireAccountStatus as unknown as () => void)()).toThrow(
        "requireAccountStatus requires at least one valid AccountStatus"
      );
      expect(() =>
        (requireAccountStatus as unknown as (s: string) => void)("invalid_status")
      ).toThrow(
        "Invalid AccountStatus supplied to requireAccountStatus: 'invalid_status'"
      );
    });

    it("rejects request when principal is missing", async () => {
      const app = express();
      app.get("/status-gated", requireActiveAccount, (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/status-gated");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("permits active account on requireActiveAccount", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ accountStatus: "active" });
        next();
      });
      app.get("/active-only", requireActiveAccount, (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/active-only");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects pending_verification account with 403 EMAIL_VERIFICATION_REQUIRED", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ accountStatus: "pending_verification" });
        next();
      });
      app.get("/active-only", requireActiveAccount, (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/active-only");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("EMAIL_VERIFICATION_REQUIRED");
    });

    it("rejects suspended account with 403 ACCOUNT_SUSPENDED", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ accountStatus: "suspended" });
        next();
      });
      app.get("/active-only", requireActiveAccount, (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/active-only");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
    });

    it("rejects deactivated account with 403 ACCOUNT_DEACTIVATED", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ accountStatus: "deactivated" });
        next();
      });
      app.get("/active-only", requireActiveAccount, (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/active-only");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
    });

    it("permits pending_verification account when explicitly included in allowed statuses", async () => {
      const app = express();
      app.use((req, _res, next) => {
        req.auth = createPrincipal({ accountStatus: "pending_verification" });
        next();
      });
      app.get("/allow-pending", requireAccountStatus("active", "pending_verification"), (_req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get("/allow-pending");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
