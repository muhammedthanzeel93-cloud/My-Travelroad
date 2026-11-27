/**
 * My Travelroad — Test Database Safety Guard & Configuration Helper
 * Enforces strict fail-closed safety checks preventing destructive test execution
 * against development, staging, or production PostgreSQL databases.
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
}

export interface DatabaseSafetyContext {
  testDatabaseUrl?: string;
  allowDestructiveDbTests?: string;
  nodeEnv?: string;
  allowedHosts?: string[];
  testAllowedDbHosts?: string;
}

/**
 * Approved local loopback hostnames and IP addresses.
 * Explicitly permits localhost, 127.0.0.1, and IPv6 loopback (::1).
 */
export const APPROVED_LOCAL_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

/**
 * Approved Docker / test container hostnames commonly used in local containerized workflows and CI.
 */
export const APPROVED_CONTAINER_HOSTS: ReadonlySet<string> = new Set([
  "host.docker.internal",
  "gateway.docker.internal",
  "postgres",
  "database",
  "db",
  "test-db",
  "local-db",
]);

/**
 * Normalizes host strings for consistent comparison:
 * Trims whitespace, converts to lowercase, and strips outer square brackets (e.g. "[::1]" -> "::1").
 */
export function normalizeHost(rawHost: string): string {
  if (!rawHost || typeof rawHost !== "string") {
    return "";
  }
  return rawHost.trim().toLowerCase().replace(/^\[|\]$/g, "");
}

/**
 * Checks whether a given host is in the approved local or container allowlist,
 * or in an explicitly provided custom allowlist.
 */
export function isApprovedTestHost(
  host: string,
  customAllowedHosts?: Iterable<string>
): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (APPROVED_LOCAL_HOSTS.has(normalized)) return true;
  if (APPROVED_CONTAINER_HOSTS.has(normalized)) return true;
  if (customAllowedHosts) {
    const list = Array.from(customAllowedHosts);
    for (const allowed of list) {
      if (normalizeHost(allowed) === normalized) return true;
    }
  }
  return false;
}

/**
 * Parses connection parameters from a PostgreSQL database URL.
 * Never exposes passwords or raw connection strings in error messages.
 */
export function parseDatabaseConfig(urlStr: string | undefined): DatabaseConfig {
  if (!urlStr || typeof urlStr !== "string" || urlStr.trim().length === 0) {
    throw new Error(
      "TEST DATABASE SAFETY ERROR: Database URL is missing or empty. Please set TEST_DATABASE_URL in your test environment."
    );
  }

  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname ? parsed.hostname.replace(/^\[|\]$/g, "") : "127.0.0.1",
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      database: parsed.pathname.replace(/^\//, ""),
    };
  } catch {
    throw new Error(
      "TEST DATABASE SAFETY ERROR: Invalid database URL format. Expected standard postgresql://[user[:password]@]host[:port]/database format."
    );
  }
}

/**
 * Asserts that the target database meets strict safety requirements for destructive integration tests.
 * Fails closed immediately before any database connection or write operation occurs.
 */
export function assertTestDatabaseSafety(
  databaseName: string,
  host: string,
  context: DatabaseSafetyContext = {}
): void {
  const allowDestructive =
    "allowDestructiveDbTests" in context
      ? context.allowDestructiveDbTests
      : process.env.ALLOW_DESTRUCTIVE_DB_TESTS;
  const currentEnv =
    "nodeEnv" in context ? context.nodeEnv : process.env.NODE_ENV;
  const testUrl =
    "testDatabaseUrl" in context
      ? context.testDatabaseUrl
      : process.env.TEST_DATABASE_URL;
  const customHostsFromEnv =
    "testAllowedDbHosts" in context
      ? context.testAllowedDbHosts
      : process.env.TEST_ALLOWED_DB_HOSTS;

  // 1. Explicit opt-in requirement
  if (allowDestructive !== "true") {
    throw new Error(
      "TEST DATABASE SAFETY ERROR: Destructive database integration tests require ALLOW_DESTRUCTIVE_DB_TESTS=true."
    );
  }

  // 2. Reject production environment
  if (currentEnv === "production") {
    throw new Error(
      "SAFETY CHECK FAILED: Refusing to run destructive database integration tests when NODE_ENV is 'production'."
    );
  }

  // 3. Strict TEST_DATABASE_URL requirement (zero fallback to DATABASE_URL)
  if (!testUrl || typeof testUrl !== "string" || testUrl.trim().length === 0) {
    throw new Error(
      "TEST DATABASE SAFETY ERROR: TEST_DATABASE_URL must be explicitly set for destructive integration tests. Falling back to DATABASE_URL is strictly forbidden."
    );
  }

  // 4. Test database naming policy: MUST contain 'test'
  const lowerDb = databaseName.toLowerCase();
  if (!lowerDb.includes("test")) {
    throw new Error(
      `SAFETY CHECK FAILED: Database name '${databaseName}' does not conform to test database naming policy. Test database name must contain 'test' (e.g. 'mytravelroad_test').`
    );
  }

  // 5. Reject production database names
  if (lowerDb.includes("prod") || lowerDb.includes("production")) {
    throw new Error(
      `SAFETY CHECK FAILED: Database name '${databaseName}' appears to be a production database. Integration tests require an isolated test database.`
    );
  }

  // 6. Reject production or remote cloud host targets (Defense-in-Depth)
  const normalizedHost = normalizeHost(host);
  if (
    normalizedHost.includes("prod") ||
    normalizedHost.includes("production") ||
    normalizedHost.includes("amazonaws.com") ||
    normalizedHost.includes("supabase.co")
  ) {
    throw new Error(
      `SAFETY CHECK FAILED: Host '${host}' appears to be a production or remote cloud server. Integration tests must run against an isolated local or test container instance.`
    );
  }

  // 7. Strict Host Allowlist Enforcement (Local loopback or approved test container)
  const customAllowed = new Set<string>();
  if (context.allowedHosts && Array.isArray(context.allowedHosts)) {
    for (const h of context.allowedHosts) {
      if (typeof h === "string" && h.trim().length > 0) {
        customAllowed.add(normalizeHost(h));
      }
    }
  }
  if (customHostsFromEnv && typeof customHostsFromEnv === "string") {
    for (const h of customHostsFromEnv.split(",")) {
      if (h.trim().length > 0) {
        customAllowed.add(normalizeHost(h));
      }
    }
  }

  if (!isApprovedTestHost(normalizedHost, customAllowed)) {
    throw new Error(
      `SAFETY CHECK FAILED: Host '${host}' is not an approved test database host. Destructive integration tests are restricted to approved local loopback hosts (${Array.from(APPROVED_LOCAL_HOSTS).join(", ")}) or approved container hosts (${Array.from(APPROVED_CONTAINER_HOSTS).join(", ")}). To permit a custom test container host, configure TEST_ALLOWED_DB_HOSTS.`
    );
  }
}
