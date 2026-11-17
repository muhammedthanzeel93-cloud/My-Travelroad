/**
 * My Travelroad — Authentication Token & Session Security Types
 * References: docs/architecture/api-architecture.md (Section 6.2 & 6.3)
 */

import { UserRole, AccountType, AccountStatus } from "../../types/domain/account.types";

/**
 * Access Token Payload inputs required to sign a new short-lived JWT.
 */
export interface AccessTokenPayload {
  /** Account UUID identifier. */
  sub: string;
  /** Platform authorization role. */
  role: UserRole;
  /** Primary account email. */
  email: string;
  /** Whether the email has passed verification. */
  emailVerified: boolean;
  /** Account classification type. */
  type: AccountType;
  /** Operational account lifecycle status. */
  status: AccountStatus;
  /** Durable revocation generation integer (defaults to 1). */
  gen?: number;
}

/**
 * Decoded and verified Access Token claims conforming to api-architecture.md Section 6.2.
 */
export interface AccessTokenClaims extends AccessTokenPayload {
  /** Durable revocation generation integer. */
  gen: number;
  /** Issued at timestamp (seconds since Unix epoch). */
  iat: number;
  /** Expiration timestamp (seconds since Unix epoch; iat + 900s). */
  exp: number;
  /** Token issuer (e.g., https://mytravelroad.com). */
  iss: string;
  /** Intended audience (e.g., https://mytravelroad.com). */
  aud: string;
}

/**
 * Opaque Refresh Token parsed components.
 * Format: rt_<familyId>_<64hex>
 */
export interface RefreshTokenParsed {
  /** UUIDv4 routing shard key representing the token family lineage. */
  familyId: string;
  /** 256-bit CSPRNG hex entropy (64 characters). */
  rawEntropy: string;
  /** Cryptographic SHA-256 digest of the complete raw token string. */
  tokenHash: string;
}

/**
 * Newly generated refresh token credentials.
 */
export interface RefreshTokenGenerated {
  /** Full raw opaque token for client cookie dispatch: rt_<familyId>_<64hex>. */
  rawToken: string;
  /** Token family UUIDv4 routing shard key. */
  familyId: string;
  /** SHA-256 hex digest for server/Redis indexing. */
  tokenHash: string;
}

/**
 * Active session telemetry stored in Redis session key (session:{familyId}:{sessionId}).
 */
export interface SessionMetadata {
  /** Active session UUIDv4. */
  sessionId: string;
  /** Token family UUIDv4 lineage. */
  familyId: string;
  /** Authenticated account UUID. */
  accountId: string;
  /** SHA-256 hex digest of the currently active refresh token. */
  tokenHash: string;
  /** Monotonic rotation sequence counter (starts at 1). */
  rotationSeq: number;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 expiry timestamp (30 days from creation). */
  expiresAt: string;
  /** Client IP address recorded at token issuance. */
  ipAddress?: string;
  /** Client User-Agent string recorded at token issuance. */
  userAgent?: string;
}

/**
 * Express Cookie configuration options for authentication tokens.
 */
export interface AuthCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  maxAge: number;
}
