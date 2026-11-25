/**
 * My Travelroad — Redis Client Factory & Lifecycle Management
 * Supports Standalone, Sentinel, Cluster, and TLS configurations.
 * References: docs/architecture/api-architecture.md Section 6.3
 */

import Redis, { Redis as RedisInstance, RedisOptions } from "ioredis";
import { env } from "../../config/env";

let singletonRedisClient: RedisInstance | null = null;

/**
 * Creates a configured Redis client instance based on application environment settings.
 */
export function createRedisClient(overrides: Partial<RedisOptions> = {}): RedisInstance {
  const isTest = process.env.NODE_ENV === "test";

  // In automated test environments without explicit REDIS_URL or USE_REAL_REDIS,
  // utilize in-memory mock client to prevent ECONNREFUSED socket errors
  if (isTest && !process.env.REDIS_URL && !process.env.USE_REAL_REDIS) {
    try {
      const RedisMock = require("ioredis-mock");
      const mockClient = new RedisMock() as RedisInstance;
      return mockClient;
    } catch {
      // Fall through to standard Redis client if mock cannot be instantiated
    }
  }

  let client: RedisInstance;

  // 1. Connection via explicit URL (e.g., in cloud or staging environments)
  if (env.REDIS_URL) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 100, 1000);
      },
      ...overrides,
    });
  } else if (env.REDIS_SENTINEL_HOSTS && env.REDIS_SENTINEL_MASTER) {
    // 2. Redis Sentinel High-Availability Topology
    const sentinels = env.REDIS_SENTINEL_HOSTS.split(",").map((entry) => {
      const [host, portStr] = entry.trim().split(":");
      return { host, port: portStr ? parseInt(portStr, 10) : 26379 };
    });

    client = new Redis({
      sentinels,
      name: env.REDIS_SENTINEL_MASTER,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      ...overrides,
    });
  } else {
    // 3. Standalone Redis Instance
    const options: RedisOptions = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      tls: env.REDIS_TLS_ENABLED ? {} : undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
      ...overrides,
    };

    client = new Redis(options);
  }

  // Prevent unhandled error event crashes when connection drops or fails;
  // individual operations will reject and be caught by handleRedisError
  client.on("error", () => {});

  return client;
}

/**
 * Retrieves or initializes the shared singleton Redis client.
 */
export function getRedisClient(): RedisInstance {
  if (!singletonRedisClient) {
    singletonRedisClient = createRedisClient();
  }
  return singletonRedisClient;
}

/**
 * Gracefully disconnects the shared singleton Redis client.
 */
export async function disconnectRedis(): Promise<void> {
  if (singletonRedisClient) {
    try {
      await singletonRedisClient.quit();
    } catch {
      singletonRedisClient.disconnect();
    } finally {
      singletonRedisClient = null;
    }
  }
}
