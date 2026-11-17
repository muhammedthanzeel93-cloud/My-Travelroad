/**
 * Tests for Password Security Module & Validation Schemas (src/server/auth/)
 */

import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  DEFAULT_ARGON2_OPTIONS,
  passwordCreationSchema,
  loginPasswordSchema,
} from "../../../src/server/auth";

describe("Argon2id Password Security Module", () => {
  // Test password matching API contracts
  const validPassword = "SecurePassword123!";
  const wrongPassword = "WrongPassword999!";

  it("hashes a password producing a standard Argon2id Modular Crypt Format (MCF) string", async () => {
    const hash = await hashPassword(validPassword);

    // Assert format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<digest>
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);

    // Plaintext password MUST NOT be present anywhere in the generated hash string
    expect(hash).not.toContain(validPassword);
  });

  it("successfully verifies the correct password against the generated hash", async () => {
    const hash = await hashPassword(validPassword);
    const isValid = await verifyPassword(validPassword, hash);

    expect(isValid).toBe(true);
  });

  it("safely rejects an incorrect password", async () => {
    const hash = await hashPassword(validPassword);
    const isValid = await verifyPassword(wrongPassword, hash);

    expect(isValid).toBe(false);
  });

  it("generates different hashes for identical passwords due to unique CSPRNG salts", async () => {
    const hashA = await hashPassword(validPassword);
    const hashB = await hashPassword(validPassword);

    // Must have different salt & digest
    expect(hashA).not.toBe(hashB);

    // Both must verify successfully
    expect(await verifyPassword(validPassword, hashA)).toBe(true);
    expect(await verifyPassword(validPassword, hashB)).toBe(true);
  });

  it("safely handles malformed, truncated, or invalid hashes without throwing", async () => {
    // Completely invalid strings
    expect(await verifyPassword(validPassword, "not-a-valid-argon2-hash")).toBe(false);
    expect(await verifyPassword(validPassword, "")).toBe(false);
    expect(await verifyPassword(validPassword, "   ")).toBe(false);

    // Truncated MCF headers
    expect(await verifyPassword(validPassword, "$argon2id$v=19$m=65536,t=3,p=4$short")).toBe(false);
    expect(await verifyPassword(validPassword, "$argon2i$v=19$invalid")).toBe(false);
    expect(await verifyPassword(validPassword, "$2a$12$invalidBcryptHeaderString1234567890")).toBe(false);

    // Corrupted base64 payload
    expect(
      await verifyPassword(
        validPassword,
        "$argon2id$v=19$m=65536,t=3,p=4$!!!corrupted_salt!!!$!!!corrupted_digest!!!"
      )
    ).toBe(false);
  });

  it("safely handles invalid password inputs during verification without throwing", async () => {
    const hash = await hashPassword(validPassword);

    expect(await verifyPassword("", hash)).toBe(false);
    expect(await verifyPassword(null as any, hash)).toBe(false);
    expect(await verifyPassword(undefined as any, hash)).toBe(false);
    expect(await verifyPassword(12345 as any, hash)).toBe(false);
  });

  it("rejects invalid password inputs during hashing", async () => {
    await expect(hashPassword("")).rejects.toThrow("Password must be a non-empty string");
    await expect(hashPassword(null as any)).rejects.toThrow("Password must be a non-empty string");
    await expect(hashPassword(undefined as any)).rejects.toThrow("Password must be a non-empty string");

    // Passwords exceeding 72 characters (Argon2 byte boundary)
    const oversizedPassword = "A1!" + "x".repeat(70); // 73 chars
    await expect(hashPassword(oversizedPassword)).rejects.toThrow(
      "Password exceeds maximum length of 72 characters"
    );
  });

  it("detects when a hash needs re-hashing due to parameter differences", async () => {
    // Generate hash with lower test cost
    const legacyOptions = { memoryCost: 4096, timeCost: 1, parallelism: 1 };
    const legacyHash = await hashPassword(validPassword, legacyOptions);

    // When evaluated against target production parameters (64 MiB, t=3, p=4), needsRehash must return true
    expect(needsRehash(legacyHash, DEFAULT_ARGON2_OPTIONS)).toBe(true);

    // Hash generated with current production parameters does NOT need re-hashing
    const currentHash = await hashPassword(validPassword, DEFAULT_ARGON2_OPTIONS);
    expect(needsRehash(currentHash, DEFAULT_ARGON2_OPTIONS)).toBe(false);

    // Malformed hashes return false safely
    expect(needsRehash("invalid-hash-string")).toBe(false);
    expect(needsRehash("")).toBe(false);
  });
});

describe("Password Zod Validation Schemas", () => {
  describe("passwordCreationSchema", () => {
    it("accepts valid passwords conforming to complexity criteria", () => {
      const validCases = [
        "Password123!",
        "ValidP@ssw0rd",
        "Kerala2026Tourism",
        "A1b2C3d4E5f6",
        "LongerPasswordWithAllRequirements99",
      ];

      for (const pass of validCases) {
        const result = passwordCreationSchema.safeParse(pass);
        expect(result.success).toBe(true);
      }
    });

    it("strictly preserves leading/trailing whitespace without silent trimming", () => {
      // User-submitted whitespace provides entropy and must not be trimmed
      const passWithSpaces = " Password123! ";
      const result = passwordCreationSchema.safeParse(passWithSpaces);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(" Password123! ");
        expect(result.data.length).toBe(14);
      }
    });

    it("rejects passwords under 8 characters", () => {
      const shortCases = ["Pass1!", "Abc1", "P1!a", ""];
      for (const pass of shortCases) {
        const result = passwordCreationSchema.safeParse(pass);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((i) => i.message.includes("at least 8 characters"))).toBe(
            true
          );
        }
      }
    });

    it("rejects passwords exceeding 72 characters", () => {
      const longPassword = "A1a" + "x".repeat(70); // 73 chars
      const result = passwordCreationSchema.safeParse(longPassword);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("not exceed 72 characters"))).toBe(
          true
        );
      }
    });

    it("rejects passwords missing an uppercase letter", () => {
      const result = passwordCreationSchema.safeParse("password123!");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes("at least one uppercase letter"))
        ).toBe(true);
      }
    });

    it("rejects passwords missing a lowercase letter", () => {
      const result = passwordCreationSchema.safeParse("PASSWORD123!");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes("at least one lowercase letter"))
        ).toBe(true);
      }
    });

    it("rejects passwords missing a numeric digit", () => {
      const result = passwordCreationSchema.safeParse("Password!Special");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("at least one digit"))).toBe(
          true
        );
      }
    });
  });

  describe("loginPasswordSchema", () => {
    it("accepts any non-empty password up to 72 characters", () => {
      expect(loginPasswordSchema.safeParse("anyPassword").success).toBe(true);
      expect(loginPasswordSchema.safeParse("simple").success).toBe(true);
      expect(loginPasswordSchema.safeParse("Password123!").success).toBe(true);
    });

    it("rejects empty password strings", () => {
      const result = loginPasswordSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("Password is required"))).toBe(
          true
        );
      }
    });

    it("rejects passwords exceeding 72 characters", () => {
      const result = loginPasswordSchema.safeParse("x".repeat(73));
      expect(result.success).toBe(false);
    });
  });
});
