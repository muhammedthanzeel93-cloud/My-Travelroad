/**
 * My Travelroad — Argon2id Password Security Module
 * Implements RFC 9106 and OWASP Password Storage Guidelines using Argon2id.
 * Stores and verifies Modular Crypt Format (MCF) hashes with isolated salts.
 */

import * as argon2 from "argon2";

export interface Argon2CustomOptions {
  hashLength?: number;
  timeCost?: number;
  memoryCost?: number;
  parallelism?: number;
  type?: 0 | 1 | 2;
  version?: number;
}

/**
 * Target Argon2id cost parameters as specified in database-architecture.md Section 3.2.
 * - Type: Argon2id (v=19 / 0x13, type = 2)
 * - Memory Cost (m): 65536 KiB (64 MiB)
 * - Time Cost (t): 3 iterations
 * - Parallelism (p): 4 lanes / worker threads
 * - Salt: 16 bytes (128 bits) CSPRNG generated automatically by argon2
 * - Digest / Hash Length: 32 bytes (256 bits)
 */
export const DEFAULT_ARGON2_OPTIONS: Readonly<Argon2CustomOptions & { type: 2 }> = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  version: 0x13,
});

/**
 * Hashes a plaintext password using Argon2id with cryptographically secure random salt.
 * Produces a standard self-contained Modular Crypt Format (MCF) string:
 * $argon2id$v=19$m=65536,t=3,p=4$<16-byte-base64-salt>$<32-byte-base64-hash>
 *
 * @param password Plaintext password (1 to 72 characters)
 * @param options Optional Argon2 option overrides (e.g., lower cost during unit testing)
 * @returns Standard Argon2id MCF hash string
 */
export async function hashPassword(
  password: string,
  options?: Argon2CustomOptions
): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string");
  }

  if (password.length > 72) {
    throw new Error("Password exceeds maximum length of 72 characters");
  }

  const mergedOptions: argon2.HashOptions & { raw?: false } = {
    ...DEFAULT_ARGON2_OPTIONS,
    ...options,
    raw: false,
  };

  return await argon2.hash(password, mergedOptions);
}

/**
 * Verifies a plaintext password against an Argon2id MCF hash in constant time.
 * Handles malformed, truncated, or invalid hashes safely by returning false without throwing.
 * Never leaks internal cryptographic exceptions or timing side channels.
 *
 * @param password Plaintext candidate password
 * @param hash Stored Argon2id MCF hash string (digest)
 * @returns true if candidate matches stored hash, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    typeof hash !== "string" ||
    password.length === 0 ||
    hash.length === 0
  ) {
    return false;
  }

  try {
    return await argon2.verify(hash, password);
  } catch {
    // Malformed hash, invalid MCF encoding, or internal crypto error fails safely closed
    return false;
  }
}

/**
 * Inspects whether a stored Argon2id MCF hash was generated with older or different
 * cost parameters compared to the active production target configuration.
 * Used during authenticated user logins to perform transparent, lazy re-hashing.
 *
 * @param hash Stored Argon2id MCF hash string
 * @param options Optional target cost parameters to check against
 * @returns true if the hash should be regenerated, false if current or malformed
 */
export function needsRehash(
  hash: string,
  options?: Argon2CustomOptions
): boolean {
  if (typeof hash !== "string" || hash.length === 0) {
    return false;
  }

  try {
    const checkOptions = {
      timeCost: options?.timeCost ?? DEFAULT_ARGON2_OPTIONS.timeCost,
      memoryCost: options?.memoryCost ?? DEFAULT_ARGON2_OPTIONS.memoryCost,
      parallelism: options?.parallelism ?? DEFAULT_ARGON2_OPTIONS.parallelism,
      version: options?.version ?? DEFAULT_ARGON2_OPTIONS.version,
    };
    return argon2.needsRehash(hash, checkOptions);
  } catch {
    return false;
  }
}
