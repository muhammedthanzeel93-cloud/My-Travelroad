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
      host: parsed.hostname || "127.0.0.1",
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

  // 6. Reject production or remote cloud host targets
  const lowerHost = host.toLowerCase();
  if (
    lowerHost.includes("prod") ||
    lowerHost.includes("production") ||
    lowerHost.includes("amazonaws.com") ||
    lowerHost.includes("supabase.co")
  ) {
    throw new Error(
      `SAFETY CHECK FAILED: Host '${host}' appears to be a production or remote cloud server. Integration tests must run against an isolated local or test container instance.`
    );
  }
}
