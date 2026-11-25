/**
 * My Travelroad — Redis-Backed Session Store
 * Implements session persistence, atomic token rotation, replay revocation,
 * and single-device logout using deterministic same-slot Lua scripts.
 * Compatible with both Redis Sentinel and Redis Cluster via {familyId} hash tagging.
 * References: docs/architecture/api-architecture.md Section 6.3
 */

import { Redis as RedisInstance } from "ioredis";
import { getRedisClient } from "./redis.client";
import {
  SESSION_TTL_SECONDS,
  TOMBSTONE_TTL_SECONDS,
  COMPROMISED_FAMILY_TTL_SECONDS,
  FamilyRecord,
  SessionRecord,
  TokenLookupData,
  CreateSessionParams,
  RotateSessionParams,
  RotationScriptResult,
  ReplayRevocationParams,
  ReplayRevocationResult,
  LogoutParams,
  LogoutScriptResult,
} from "./redis.types";
import {
  ATOMIC_ROTATION_LUA,
  REPLAY_REVOCATION_LUA,
  SINGLE_DEVICE_LOGOUT_LUA,
} from "./lua-scripts";
import { ServiceUnavailableError } from "../errors/app-error";
import { ErrorCode } from "../errors/error-codes";

export class RedisSessionStore {
  private client: RedisInstance;

  constructor(customClient?: RedisInstance) {
    this.client = customClient ?? getRedisClient();
  }

  // Key naming helpers with explicit {familyId} hash tags for Redis Cluster single-slot guarantees
  public familyKey(familyId: string): string {
    return `family:{${familyId}}`;
  }

  public sessionKey(familyId: string, sessionId: string): string {
    return `session:{${familyId}}:${sessionId}`;
  }

  public tokenLookupKey(familyId: string, tokenHash: string): string {
    return `token_lookup:{${familyId}}:${tokenHash}`;
  }

  public revokedTokenKey(familyId: string, tokenHash: string): string {
    return `revoked_token:{${familyId}}:${tokenHash}`;
  }

  // Account-level inverted index resides outside {familyId} slot
  public accountSessionsKey(accountId: string): string {
    return `account_sessions:${accountId}`;
  }

  /**
   * Catches underlying Redis connection or execution errors and converts them
   * to fail-closed ServiceUnavailableError per api-architecture.md.
   */
  private handleRedisError(err: unknown): never {
    if (err instanceof ServiceUnavailableError) throw err;
    throw new ServiceUnavailableError(
      "Session persistence service temporarily unavailable"
    );
  }

  /**
   * Asserts Redis client is connected and ready.
   */
  private async ensureConnection(): Promise<void> {
    try {
      if (this.client.status === "wait") {
        await this.client.connect();
      }
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Persists an initial session and family lineage upon successful user login.
   */
  public async createInitialSession(params: CreateSessionParams): Promise<void> {
    await this.ensureConnection();

    const { familyId, sessionId, tokenHash, accountId, ipAddress, userAgent } = params;
    const now = params.createdAt ?? new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

    try {
      const famKey = this.familyKey(familyId);
      const sessKey = this.sessionKey(familyId, sessionId);
      const lookupKey = this.tokenLookupKey(familyId, tokenHash);
      const acctKey = this.accountSessionsKey(accountId);

      // 1. Multi-key pipeline for same-slot keys
      const pipeline = this.client.pipeline();

      // Write family record
      pipeline.hset(famKey, {
        familyId,
        activeSessionId: sessionId,
        activeTokenHash: tokenHash,
        rotationSeq: "1",
        tokenGeneration: "1",
        isCompromised: "0",
      });
      pipeline.expire(famKey, SESSION_TTL_SECONDS);

      // Write session metadata
      pipeline.hset(sessKey, {
        sessionId,
        familyId,
        accountId,
        tokenHash,
        rotationSeq: "1",
        createdAt: now,
        expiresAt,
        ipAddress: ipAddress ?? "",
        userAgent: userAgent ?? "",
      });
      pipeline.expire(sessKey, SESSION_TTL_SECONDS);

      // Write token lookup
      const lookupJson = JSON.stringify({
        familyId,
        sessionId,
        accountId,
      });
      pipeline.set(lookupKey, lookupJson, "EX", SESSION_TTL_SECONDS);

      await pipeline.exec();

      // 2. Decoupled update to account-level session index
      await this.client.sadd(acctKey, `${familyId}:${sessionId}`);
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Reads the current family record from Redis.
   */
  public async getFamily(familyId: string): Promise<FamilyRecord | null> {
    await this.ensureConnection();

    try {
      const data = await this.client.hgetall(this.familyKey(familyId));
      if (!data || Object.keys(data).length === 0 || !data.activeTokenHash) {
        return null;
      }

      return {
        familyId: data.familyId || familyId,
        activeSessionId: data.activeSessionId,
        activeTokenHash: data.activeTokenHash,
        rotationSeq: parseInt(data.rotationSeq || "1", 10),
        tokenGeneration: parseInt(data.tokenGeneration || "1", 10),
        isCompromised: data.isCompromised === "1",
      };
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Reads active session metadata from Redis.
   */
  public async getSession(familyId: string, sessionId: string): Promise<SessionRecord | null> {
    await this.ensureConnection();

    try {
      const data = await this.client.hgetall(this.sessionKey(familyId, sessionId));
      if (!data || Object.keys(data).length === 0 || !data.accountId) {
        return null;
      }

      return {
        sessionId: data.sessionId || sessionId,
        familyId: data.familyId || familyId,
        accountId: data.accountId,
        tokenHash: data.tokenHash,
        rotationSeq: parseInt(data.rotationSeq || "1", 10),
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress || undefined,
        userAgent: data.userAgent || undefined,
      };
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Reads the token lookup record for a presented token hash.
   */
  public async getTokenLookup(familyId: string, tokenHash: string): Promise<TokenLookupData | null> {
    await this.ensureConnection();

    try {
      const raw = await this.client.get(this.tokenLookupKey(familyId, tokenHash));
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed.familyId || !parsed.sessionId || !parsed.accountId) {
        return null;
      }
      return parsed as TokenLookupData;
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Checks whether a token hash exists in the revoked token tombstone index.
   */
  public async isTokenRevoked(familyId: string, tokenHash: string): Promise<boolean> {
    await this.ensureConnection();

    try {
      const count = await this.client.exists(this.revokedTokenKey(familyId, tokenHash));
      return count === 1;
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Retrieves the stored payload (e.g. rotation timestamp) from the revoked token tombstone index.
   */
  public async getRevokedTokenTombstone(familyId: string, tokenHash: string): Promise<string | null> {
    await this.ensureConnection();

    try {
      return await this.client.get(this.revokedTokenKey(familyId, tokenHash));
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Executes the atomic rotation Lua script on same-slot keys.
   */
  public async rotateSession(params: RotateSessionParams): Promise<RotationScriptResult> {
    await this.ensureConnection();

    const {
      familyId,
      oldSessionId,
      newSessionId,
      presentedTokenHash,
      replacementTokenHash,
      ipAddress,
      userAgent,
      timestamp,
      expiresAt: customExpiresAt,
    } = params;

    const keys = [
      this.familyKey(familyId),
      this.tokenLookupKey(familyId, presentedTokenHash),
      this.sessionKey(familyId, oldSessionId),
      this.revokedTokenKey(familyId, presentedTokenHash),
      this.tokenLookupKey(familyId, replacementTokenHash),
      this.sessionKey(familyId, newSessionId),
    ];

    const nowIso = timestamp ?? new Date().toISOString();
    const expiresAt =
      customExpiresAt ??
      new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

    const args = [
      presentedTokenHash,
      replacementTokenHash,
      newSessionId,
      ipAddress ?? "",
      userAgent ?? "",
      nowIso,
      SESSION_TTL_SECONDS.toString(),
      TOMBSTONE_TTL_SECONDS.toString(),
      expiresAt,
      oldSessionId ?? "",
    ];

    try {
      const result = (await this.client.eval(
        ATOMIC_ROTATION_LUA,
        keys.length,
        ...keys,
        ...args
      )) as [string, string];

      if (Array.isArray(result) && result[0] === "OK") {
        return {
          success: true,
          newRotationSeq: parseInt(result[1], 10),
        };
      }

      return {
        success: false,
        reason: (Array.isArray(result) ? result[1] : "UNKNOWN_ROTATION_ERROR") as any,
      };
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Decoupled maintenance of account-level session index (outside Lua script).
   */
  public async updateAccountSessionIndex(
    accountId: string,
    familyId: string,
    oldSessionId?: string,
    newSessionId?: string
  ): Promise<void> {
    await this.ensureConnection();

    try {
      const key = this.accountSessionsKey(accountId);
      const pipeline = this.client.pipeline();

      if (oldSessionId) {
        pipeline.srem(key, `${familyId}:${oldSessionId}`);
      }
      if (newSessionId) {
        pipeline.sadd(key, `${familyId}:${newSessionId}`);
      }

      await pipeline.exec();
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Executes atomic replay revocation on a compromised family.
   */
  public async revokeFamilyReplay(params: ReplayRevocationParams): Promise<ReplayRevocationResult> {
    await this.ensureConnection();

    const { familyId, presentedTokenHash, expectedActiveTokenHash, expectedActiveSessionId } = params;

    const keys = [
      this.familyKey(familyId),
      this.revokedTokenKey(familyId, presentedTokenHash),
      this.tokenLookupKey(familyId, expectedActiveTokenHash),
      this.sessionKey(familyId, expectedActiveSessionId),
    ];

    const args = [
      expectedActiveTokenHash,
      expectedActiveSessionId,
      COMPROMISED_FAMILY_TTL_SECONDS.toString(),
    ];

    try {
      const result = (await this.client.eval(
        REPLAY_REVOCATION_LUA,
        keys.length,
        ...keys,
        ...args
      )) as ReplayRevocationResult;

      if (result === "REPLAY_CONFIRMED" && params.accountId) {
        try {
          await this.client.srem(
            this.accountSessionsKey(params.accountId),
            `${familyId}:${expectedActiveSessionId}`
          );
        } catch {
          // Best effort decoupled index maintenance
        }
      }

      return result;
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Executes single-device logout script and prunes account session index.
   */
  public async logoutSession(params: LogoutParams): Promise<LogoutScriptResult> {
    await this.ensureConnection();

    const { familyId, expectedActiveSessionId, expectedActiveTokenHash, accountId } = params;

    const keys = [
      this.familyKey(familyId),
      this.sessionKey(familyId, expectedActiveSessionId),
      this.tokenLookupKey(familyId, expectedActiveTokenHash),
    ];

    const args = [expectedActiveTokenHash, expectedActiveSessionId];

    try {
      const result = (await this.client.eval(
        SINGLE_DEVICE_LOGOUT_LUA,
        keys.length,
        ...keys,
        ...args
      )) as LogoutScriptResult;

      if (accountId) {
        await this.client.srem(this.accountSessionsKey(accountId), `${familyId}:${expectedActiveSessionId}`);
      }

      return result;
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Direct revocation of a family (used when account is suspended/deactivated or password changed).
   */
  public async revokeFamilyDirect(
    familyId: string,
    activeSessionId?: string,
    activeTokenHash?: string,
    accountId?: string
  ): Promise<void> {
    await this.ensureConnection();

    try {
      const pipeline = this.client.pipeline();
      pipeline.hset(this.familyKey(familyId), "isCompromised", "1");
      pipeline.expire(this.familyKey(familyId), COMPROMISED_FAMILY_TTL_SECONDS);

      if (activeSessionId) {
        pipeline.del(this.sessionKey(familyId, activeSessionId));
      }
      if (activeTokenHash) {
        pipeline.del(this.tokenLookupKey(familyId, activeTokenHash));
      }

      await pipeline.exec();

      if (accountId && activeSessionId) {
        await this.client.srem(this.accountSessionsKey(accountId), `${familyId}:${activeSessionId}`);
      }
    } catch (err) {
      this.handleRedisError(err);
    }
  }

  /**
   * Health check probe for Redis connectivity.
   */
  public async ping(): Promise<boolean> {
    try {
      await this.ensureConnection();
      const res = await this.client.ping();
      return res === "PONG";
    } catch {
      return false;
    }
  }
}
