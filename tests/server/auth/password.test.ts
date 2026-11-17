/**
 * Tests for Password Security Module & Validation Schemas (src/server/auth/)
 */

import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  countCodePoints,
  DEFAULT_ARGON2_OPTIONS,
  MIN_PASSWORD_CODE_POINTS,
  MAX_PASSWORD_CODE_POINTS,
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
  });

  it("enforces application-level 72 Unicode code-point limit during hashing", async () => {
    // Exactly 72 Unicode code points (mix of ASCII and supplementary emoji characters)
    // 68 emoji (2 UTF-16 code units each = 136) + 4 ASCII = 140 UTF-16 code units, but exactly 72 code points
    const pass72 = "Ab1!" + "🌴".repeat(68);
    expect(countCodePoints(pass72)).toBe(72);
    expect(pass72.length).toBe(140);

    // Hashing must succeed for 72 code points
    const hash72 = await hashPassword(pass72);
    expect(await verifyPassword(pass72, hash72)).toBe(true);

    // 73 Unicode code points exceeds the application policy threshold
    const pass73 = "Ab1!" + "🌴".repeat(69);
    expect(countCodePoints(pass73)).toBe(73);
    await expect(hashPassword(pass73)).rejects.toThrow(
      "Password exceeds maximum length of 72 characters"
    );
  });

  it("preserves leading and trailing whitespace exactly without silent trimming", async () => {
    const untrimmedPassword = "  UntrimmedPassword123!  ";
    const trimmedPassword = "UntrimmedPassword123!";

    const hash = await hashPassword(untrimmedPassword);

    // Verification with exact untrimmed string must succeed
    expect(await verifyPassword(untrimmedPassword, hash)).toBe(true);

    // Verification with trimmed string MUST fail, proving whitespace reached the hasher intact
    expect(await verifyPassword(trimmedPassword, hash)).toBe(false);
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

describe("Unicode Code-Point Counting (countCodePoints)", () => {
  it("counts code points correctly for ASCII, empty string, and supplementary characters", () => {
    expect(countCodePoints("")).toBe(0);
    expect(countCodePoints("Password")).toBe(8);
    expect(countCodePoints("🌴")).toBe(1); // 2 UTF-16 code units, 1 code point
    expect(countCodePoints("Kerala🌴Tourism")).toBe(14);
    expect(countCodePoints("🏖️")).toBe(2); // Beach with umbrella (U+1F3D6 + U+FE0F variation selector)
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

    it("accepts password with supplementary Unicode characters (emoji) at exactly 72 code points", () => {
      // 4 ASCII + 68 emojis = 72 Unicode code points (140 UTF-16 code units)
      const pass72 = "Ab1!" + "🌴".repeat(68);
      expect(countCodePoints(pass72)).toBe(72);
      expect(pass72.length).toBe(140);

      const result = passwordCreationSchema.safeParse(pass72);
      expect(result.success).toBe(true);
      if (result.success) {
        // Must preserve the exact characters
        expect(result.data).toBe(pass72);
      }
    });

    it("rejects password with 73 Unicode code points", () => {
      // 4 ASCII + 69 emojis = 73 Unicode code points
      const pass73 = "Ab1!" + "🌴".repeat(69);
      expect(countCodePoints(pass73)).toBe(73);

      const result = passwordCreationSchema.safeParse(pass73);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes("not exceed 72 characters"))
        ).toBe(true);
      }
    });

    it("accepts password with exactly 8 Unicode code points containing supplementary characters", () => {
      // 7 ASCII + 1 emoji = 8 Unicode code points (9 UTF-16 code units)
      const pass8 = "Ab1!xyz🌴";
      expect(countCodePoints(pass8)).toBe(8);
      expect(pass8.length).toBe(9);

      const result = passwordCreationSchema.safeParse(pass8);
      expect(result.success).toBe(true);
    });

    it("rejects password with 7 Unicode code points containing supplementary characters", () => {
      // 6 ASCII + 1 emoji = 7 Unicode code points (8 UTF-16 code units)
      const pass7 = "Ab1!xy🌴";
      expect(countCodePoints(pass7)).toBe(7);
      expect(pass7.length).toBe(8);

      const result = passwordCreationSchema.safeParse(pass7);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes("at least 8 characters"))
        ).toBe(true);
      }
    });

    it("strictly preserves leading/trailing whitespace without silent trimming", () => {
      const passWithSpaces = " Password123! ";
      const result = passwordCreationSchema.safeParse(passWithSpaces);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(" Password123! ");
        expect(countCodePoints(result.data)).toBe(14);
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

    it("rejects passwords exceeding 72 ASCII characters", () => {
      const longPassword = "A1a" + "x".repeat(70); // 73 code points
      expect(countCodePoints(longPassword)).toBe(73);

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
    it("accepts any non-empty password up to 72 Unicode code points", () => {
      expect(loginPasswordSchema.safeParse("anyPassword").success).toBe(true);
      expect(loginPasswordSchema.safeParse("simple").success).toBe(true);
      expect(loginPasswordSchema.safeParse("Password123!").success).toBe(true);

      // 72 Unicode code points with emojis (140 UTF-16 code units)
      const pass72 = "Ab1!" + "🌴".repeat(68);
      expect(loginPasswordSchema.safeParse(pass72).success).toBe(true);
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

    it("rejects passwords exceeding 72 Unicode code points", () => {
      // 73 ASCII
      expect(loginPasswordSchema.safeParse("x".repeat(73)).success).toBe(false);

      // 73 code points with emojis
      const pass73 = "Ab1!" + "🌴".repeat(69);
      expect(loginPasswordSchema.safeParse(pass73).success).toBe(false);
    });
  });

  describe("Consistency between Creation, Login, and Hashing Boundaries", () => {
    it("treats 72 code points as valid across creation, login, and hashing", async () => {
      const pass72 = "SecureP@ss1" + "🌴".repeat(61);
      expect(countCodePoints(pass72)).toBe(72);

      expect(passwordCreationSchema.safeParse(pass72).success).toBe(true);
      expect(loginPasswordSchema.safeParse(pass72).success).toBe(true);
      const hash = await hashPassword(pass72);
      expect(await verifyPassword(pass72, hash)).toBe(true);
    });

    it("treats 73 code points as invalid across creation, login, and hashing", async () => {
      const pass73 = "SecureP@ss1" + "🌴".repeat(62);
      expect(countCodePoints(pass73)).toBe(73);

      expect(passwordCreationSchema.safeParse(pass73).success).toBe(false);
      expect(loginPasswordSchema.safeParse(pass73).success).toBe(false);
      await expect(hashPassword(pass73)).rejects.toThrow(
        "Password exceeds maximum length of 72 characters"
      );
    });
  });
});
