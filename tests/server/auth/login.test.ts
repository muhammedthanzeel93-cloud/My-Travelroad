/**
 * Tests for Secure User Authentication & Login API
 * Endpoint: POST /api/v1/auth/login
 * References: docs/architecture/api-contracts.md (Module A Section 2) & api-architecture.md Section 6
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../../../src/server/app";
import * as passwordModule from "../../../src/server/auth/password";
import { hashPassword, verifyPassword } from "../../../src/server/auth/password";
import { verifyAccessToken } from "../../../src/server/auth/jwt";
import { loginRateLimiter } from "../../../src/server/middleware/rate-limiter";
import { createAuthenticateMiddleware } from "../../../src/server/middleware/authenticate";
import { createAuthRouter } from "../../../src/server/routes/auth.routes";
import express, { Express } from "express";
import { errorHandler } from "../../../src/server/middleware/error-handler";
import * as loginService from "../../../src/server/services/login.service";

const VALID_LOGIN_PAYLOAD = {
  email: "amina.rahman@example.com",
  password: "Password123!",
};

describe("POST /api/v1/auth/login", () => {
  let mockPasswordHash: string;
  let mockPasswordWithSpacesHash: string;

  beforeEach(async () => {
    loginRateLimiter.reset();
    mockPasswordHash = await hashPassword("Password123!");
    mockPasswordWithSpacesHash = await hashPassword("  PasswordWithSpaces123!  ");
  });

  function createMockPrisma(options: {
    account?: any;
    updateSecurityCredential?: (args: any) => Promise<any>;
    updateAccount?: (args: any) => Promise<any>;
    transactionFn?: (fn: (tx: any) => Promise<any>) => Promise<any>;
    queryRawFn?: any;
  } = {}) {
    let currentAccount = options.account;
    const updateSecurityCredentialSpy = options.updateSecurityCredential ?? vi.fn().mockImplementation(async ({ data }: any) => {
      if (currentAccount?.securityCredentials) {
        if (data.failedLoginAttempts !== undefined) {
          currentAccount.securityCredentials.failedLoginAttempts = data.failedLoginAttempts;
        }
        if (data.lockedUntil !== undefined) {
          currentAccount.securityCredentials.lockedUntil = data.lockedUntil;
        }
      }
      return {};
    });
    const updateAccountSpy = options.updateAccount ?? vi.fn().mockResolvedValue({});

    const queryRawSpy = options.queryRawFn ?? vi.fn().mockImplementation(async () => {
      return [
        {
          failed_login_attempts: currentAccount?.securityCredentials?.failedLoginAttempts ?? 0,
          locked_until: currentAccount?.securityCredentials?.lockedUntil ?? null,
        },
      ];
    });

    const mockPrisma = {
      account: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.email && currentAccount && currentAccount.email.toLowerCase() === where.email.toLowerCase()) {
            return currentAccount;
          }
          if (where.id && currentAccount && currentAccount.id === where.id) {
            return currentAccount;
          }
          return null;
        }),
        update: updateAccountSpy,
      },
      accountSecurityCredential: {
        update: updateSecurityCredentialSpy,
      },
      $queryRaw: queryRawSpy,
      $transaction: options.transactionFn ?? vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        return fn({
          account: { update: updateAccountSpy },
          accountSecurityCredential: { update: updateSecurityCredentialSpy },
          $queryRaw: queryRawSpy,
        });
      }),
    };

    return {
      prisma: mockPrisma as unknown as PrismaClient,
      updateSecurityCredentialSpy,
      updateAccountSpy,
      queryRawSpy,
    };
  }

  // ============================================================================
  // 1. Validation Requirements
  // ============================================================================
  describe("Validation Requirements", () => {
    it("successfully validates and processes a login with valid payload", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokenType).toBe("Bearer");
      expect(res.body.data.expiresIn).toBe(900);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.account).toEqual({
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        status: "active",
        emailVerified: true,
      });
    });

    it("normalizes email to lowercase before lookup", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "Amina.Rahman@EXAMPLE.com",
          password: "Password123!",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.account.email).toBe("amina.rahman@example.com");
    });

    it("rejects invalid email formats with 422 VALIDATION_FAILED", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "not-an-email",
          password: "Password123!",
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects missing email with 422 VALIDATION_FAILED", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          password: "Password123!",
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects missing password with 422 VALIDATION_FAILED", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects empty password with 422 VALIDATION_FAILED", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: "",
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects passwords exceeding 72 Unicode code points with 422 VALIDATION_FAILED", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: "A".repeat(73),
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("preserves exact password without trimming whitespace", async () => {
      const passwordWithSpaces = "  PasswordWithSpaces123!  ";
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordWithSpacesHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      // 1. Password with exact whitespace succeeds
      const resSuccess = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: passwordWithSpaces,
        });

      expect(resSuccess.status).toBe(200);

      // 2. Trimmed password fails with 401 INVALID_CREDENTIALS
      const resFail = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: passwordWithSpaces.trim(),
        });

      expect(resFail.status).toBe(401);
      expect(resFail.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects unknown or injected request properties with 422 VALIDATION_FAILED", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          ...VALID_LOGIN_PAYLOAD,
          role: "super_admin",
          injectedField: "malicious",
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  // ============================================================================
  // 2. Authentication & Timing Defense
  // ============================================================================
  describe("Authentication & Timing Defense", () => {
    it("returns 401 INVALID_CREDENTIALS when account does not exist and runs dummy verification", async () => {
      const { prisma } = createMockPrisma({ account: null });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "Password123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("Invalid email or password");
    });

    it("returns 401 INVALID_CREDENTIALS when security credentials record is missing", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: null,
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("returns 401 INVALID_CREDENTIALS when stored passwordHash is null", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("returns 401 INVALID_CREDENTIALS when candidate password is incorrect", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma, updateSecurityCredentialSpy } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: "WrongPassword999!",
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(updateSecurityCredentialSpy).toHaveBeenCalledWith({
        where: { accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101" },
        data: {
          failedLoginAttempts: 1,
          lockedUntil: null,
        },
      });
    });

    it("safely handles malformed stored password hash returning 401 without throwing 500, executing dummy verification and recording failure", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: "invalid_malformed_hash_format",
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma, updateSecurityCredentialSpy } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const verifyPasswordSpy = vi.spyOn(passwordModule, "verifyPassword");

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("Invalid email or password");
      // Must not leak the malformed hash in response body or headers
      expect(JSON.stringify(res.body)).not.toContain("invalid_malformed_hash_format");

      // Verify dummy hash path was executed to equalize execution timing
      expect(verifyPasswordSpy).toHaveBeenCalledWith(
        VALID_LOGIN_PAYLOAD.password,
        loginService.DUMMY_ARGON2_HASH
      );

      // Verify failure was recorded (failed-login protection not bypassed)
      expect(updateSecurityCredentialSpy).toHaveBeenCalledWith({
        where: { accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101" },
        data: {
          failedLoginAttempts: 1,
          lockedUntil: null,
        },
      });

      verifyPasswordSpy.mockRestore();
    });

    it("treats non-Argon2id hash (e.g. bcrypt $2b$) as unsupported, executing dummy verification and incrementing attempts", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: "$2b$12$e8uqVlE7mYy3y3bWfP.nOO5E11Yf8qjN1vOa9U5kUuG6E5u9K2W2a",
          failedLoginAttempts: 1,
          lockedUntil: null,
        },
      };

      const { prisma, updateSecurityCredentialSpy } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const verifyPasswordSpy = vi.spyOn(passwordModule, "verifyPassword");

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");

      expect(verifyPasswordSpy).toHaveBeenCalledWith(
        VALID_LOGIN_PAYLOAD.password,
        loginService.DUMMY_ARGON2_HASH
      );

      expect(updateSecurityCredentialSpy).toHaveBeenCalledWith({
        where: { accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101" },
        data: {
          failedLoginAttempts: 2,
          lockedUntil: null,
        },
      });

      verifyPasswordSpy.mockRestore();
    });

    it("aborts successful login with 423 ACCOUNT_LOCKED if a concurrent failed attempt locked the account", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 4,
          lockedUntil: null, // initially looks unlocked
        },
      };

      // When $queryRaw runs inside recordSuccessfulLogin, simulate that another concurrent transaction locked it
      const concurrentLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      const queryRawFn = vi.fn().mockResolvedValue([
        {
          failed_login_attempts: 5,
          locked_until: concurrentLockedUntil,
        },
      ]);

      const { prisma, updateAccountSpy } = createMockPrisma({
        account: mockAccount,
        queryRawFn,
      });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
      // Must not update lastLoginAt when aborting due to concurrent lock
      expect(updateAccountSpy).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 3. Account Lifecycle Enforcement
  // ============================================================================
  describe("Account Lifecycle Enforcement", () => {
    it("allows pending_verification accounts to log in with emailVerified: false", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "pending_verification",
        emailVerified: false,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(200);
      expect(res.body.data.account.status).toBe("pending_verification");
      expect(res.body.data.account.emailVerified).toBe(false);

      // Verify issued JWT carries emailVerified: false
      const claims = await verifyAccessToken(res.body.data.accessToken);
      expect(claims.emailVerified).toBe(false);
      expect(claims.status).toBe("pending_verification");
    });

    it("rejects suspended accounts with 403 ACCOUNT_SUSPENDED", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "suspended",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
      expect(res.body.error.message).toContain("suspended");
    });

    it("rejects deactivated accounts with 403 ACCOUNT_DEACTIVATED", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "deactivated",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
    });

    it("forbids public interactive authentication for type = 'system' returning 401 without leakage", async () => {
      const mockAccount = {
        id: "00000000-0000-4000-8000-000000000001",
        email: "system.root@mytravelroad.internal",
        role: "super_admin",
        type: "system",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "00000000-0000-4000-8000-000000000001",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "system.root@mytravelroad.internal",
          password: "Password123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });
  });

  // ============================================================================
  // 4. Failed-Login Protection & Lockout
  // ============================================================================
  describe("Failed-Login Protection & Lockout", () => {
    it("increments failedLoginAttempts counter on incorrect password", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 2,
          lockedUntil: null,
        },
      };

      const { prisma, updateSecurityCredentialSpy } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: "WrongPassword123!",
        });

      expect(res.status).toBe(401);
      expect(updateSecurityCredentialSpy).toHaveBeenCalledWith({
        where: { accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101" },
        data: {
          failedLoginAttempts: 3,
          lockedUntil: null,
        },
      });
    });

    it("triggers 15-minute account lock on 5th consecutive failure", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 4,
          lockedUntil: null,
        },
      };

      const { prisma, updateSecurityCredentialSpy } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const beforeCall = Date.now();
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: "WrongPassword123!",
        });
      const afterCall = Date.now();

      expect(res.status).toBe(401);
      expect(updateSecurityCredentialSpy).toHaveBeenCalled();
      const updateCall = (updateSecurityCredentialSpy as any).mock.calls[0][0];
      expect(updateCall.data.failedLoginAttempts).toBe(5);
      expect(updateCall.data.lockedUntil).toBeInstanceOf(Date);

      const lockDurationMs = updateCall.data.lockedUntil.getTime() - beforeCall;
      expect(lockDurationMs).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);
      expect(lockDurationMs).toBeLessThanOrEqual(15 * 60 * 1000 + 5000);
    });

    it("rejects login attempts on currently locked accounts with 423 ACCOUNT_LOCKED without incrementing counter", async () => {
      const futureLock = new Date(Date.now() + 10 * 60 * 1000); // locked for 10 more minutes
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 5,
          lockedUntil: futureLock,
        },
      };

      const { prisma, updateSecurityCredentialSpy } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(423);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
      expect(res.body.error.message).toContain("locked");

      // Must not update attempts counter during active lock
      expect(updateSecurityCredentialSpy).not.toHaveBeenCalled();
    });

    it("allows login when previous lock has expired and clears lock state on successful authentication", async () => {
      const pastLock = new Date(Date.now() - 5 * 60 * 1000); // lock expired 5 minutes ago
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 5,
          lockedUntil: pastLock,
        },
      };

      const { prisma, updateSecurityCredentialSpy, updateAccountSpy } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Successfully reset failed attempts and cleared lock
      expect(updateSecurityCredentialSpy).toHaveBeenCalledWith({
        where: { accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101" },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Updated lastLoginAt
      expect(updateAccountSpy).toHaveBeenCalledWith({
        where: { id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101" },
        data: {
          lastLoginAt: expect.any(Date),
        },
      });
    });

    it("resets failed attempts to 1 and clears expired lock when candidate password on expired lock is incorrect", async () => {
      const pastLock = new Date(Date.now() - 5 * 60 * 1000);
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 5,
          lockedUntil: pastLock,
        },
      };

      const { prisma, updateSecurityCredentialSpy } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "amina.rahman@example.com",
          password: "WrongPassword123!",
        });

      expect(res.status).toBe(401);
      expect(updateSecurityCredentialSpy).toHaveBeenCalledWith({
        where: { accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101" },
        data: {
          failedLoginAttempts: 1,
          lockedUntil: null,
        },
      });
    });
  });

  // ============================================================================
  // 5. Access Token Issuance & Middleware Compatibility
  // ============================================================================
  describe("Access Token Issuance & Middleware Compatibility", () => {
    it("issues a valid HS256 access token that is accepted by authenticate middleware", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      // 1. Perform login
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.data.accessToken;
      expect(token).toBeDefined();

      // 2. Verify token claims directly
      const claims = await verifyAccessToken(token);
      expect(claims.sub).toBe(mockAccount.id);
      expect(claims.email).toBe(mockAccount.email);
      expect(claims.role).toBe(mockAccount.role);
      expect(claims.status).toBe(mockAccount.status);
      expect(claims.type).toBe(mockAccount.type);
      expect(claims.emailVerified).toBe(true);
      expect(claims.gen).toBe(1);
      expect(claims.exp - claims.iat).toBe(900);

      // 3. Test token against authenticate middleware
      const testServer = express();
      testServer.use(createAuthenticateMiddleware(prisma));
      testServer.get("/protected", (req: any, res) => {
        res.json({ user: req.user });
      });

      const protectedRes = await request(testServer)
        .get("/protected")
        .set("Authorization", `Bearer ${token}`);

      expect(protectedRes.status).toBe(200);
      expect(protectedRes.body.user.accountId).toBe(mockAccount.id);
      expect(protectedRes.body.user.email).toBe(mockAccount.email);
      expect(protectedRes.body.user.role).toBe(mockAccount.role);
    });
  });

  // ============================================================================
  // 6. Security, Credential Non-Leakage & Rate Limiting
  // ============================================================================
  describe("Security, Credential Non-Leakage & Rate Limiting", () => {
    it("never returns credentials, password hashes, or internal lockout state in response", async () => {
      const mockAccount = {
        id: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
        email: "amina.rahman@example.com",
        role: "traveler",
        type: "individual",
        status: "active",
        emailVerified: true,
        securityCredentials: {
          accountId: "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
          passwordHash: mockPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      };

      const { prisma } = createMockPrisma({ account: mockAccount });
      const app = createApp({ prismaClient: prisma });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send(VALID_LOGIN_PAYLOAD);

      expect(res.status).toBe(200);
      const jsonStr = JSON.stringify(res.body);
      expect(jsonStr).not.toContain("passwordHash");
      expect(jsonStr).not.toContain(mockPasswordHash);
      expect(jsonStr).not.toContain("failedLoginAttempts");
      expect(jsonStr).not.toContain("lockedUntil");
      expect(jsonStr).not.toContain("mfaSecret");
      expect(jsonStr).not.toContain("mfaSecretEncrypted");
    });

    it("enforces rate limit of 5 requests per minute per IP and returns 429 RATE_LIMIT_EXCEEDED with Retry-After", async () => {
      const app = createApp();

      // First 5 requests pass rate limit (will fail validation with 422, but not rate limited)
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post("/api/v1/auth/login")
          .send({});
        expect(res.status).toBe(422);
        expect(res.headers["x-ratelimit-remaining"]).toBe(String(4 - i));
      }

      // 6th request triggers rate limiter
      const blockedRes = await request(app)
        .post("/api/v1/auth/login")
        .send({});

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(blockedRes.body.error.message).toContain("Too many login attempts");
      expect(blockedRes.headers["retry-after"]).toBeDefined();
    });

    it("does not trust spoofed X-Forwarded-For headers when trust proxy is false", async () => {
      const app = createApp(); // trust proxy is disabled by default

      // Send 5 requests with spoofed X-Forwarded-For
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", `198.51.100.${i + 1}`)
          .send({});
      }

      // 6th request with a different spoofed IP is still throttled because socket remoteAddress is used
      const blockedRes = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", "203.0.113.99")
        .send({});

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });
});
