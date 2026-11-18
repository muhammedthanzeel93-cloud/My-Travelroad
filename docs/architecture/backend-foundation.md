# Backend Foundation Architecture Specification

## 1. Overview & System Purpose

The **My Travelroad** backend is built as a secure, maintainable, modular-monolith web service utilizing Node.js, Express.js, TypeScript, PostgreSQL, and Prisma ORM.

This foundation establishes the core application infrastructure:
- Type-safe runtime environment validation using Zod.
- High-performance structured logging with Pino and automated sensitive field redaction.
- Request correlation tracing via deterministic `X-Request-Id` validation and UUIDv4 generation.
- Defense-in-depth HTTP security via Helmet and strict CORS origin controls.
- Express body parsing with explicit size boundaries (100kb limit).
- Centralized operational error taxonomy and standardized JSON response envelopes.
- Health and readiness probes (`/health`, `/health/ready`) integrating non-leaking database health verification.
- Graceful shutdown lifecycle management coordinating active HTTP connections and Prisma client teardown.

---

## 2. Directory Structure

```text
src/
├── config/
│   ├── env.ts                  # Zod environment schema & validated runtime configuration
│   └── logger.ts               # Structured Pino logger with sensitive data redaction
├── lib/
│   ├── db.ts                   # Prisma client singleton, connection lifecycle & PostGIS helpers
│   └── utils.ts                # Shared general utilities
├── server/
│   ├── app.ts                  # Express application factory (createApp)
│   ├── index.ts                # Server bootstrap entrypoint & graceful shutdown handlers
│   ├── auth/
│   │   ├── index.ts            # Auth module barrel exports
│   │   ├── password.ts         # Argon2id password hashing, verification & re-hash checking
│   │   ├── password.schema.ts  # Zod password validation schemas (creation & login)
│   │   ├── token.types.ts      # Auth token, claims, session metadata & cookie types
│   │   ├── jwt.ts              # HS256 JWT access token signing & verification (jose)
│   │   ├── refresh-token.ts    # CSPRNG refresh token generation (rt_<familyId>_<entropy>), SHA-256 hashing & validation
│   │   └── cookie.ts           # Centralized auth cookie options (HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth)
│   ├── errors/
│   │   ├── app-error.ts        # AppError base class & specialized error subclasses
│   │   └── error-codes.ts      # Machine-readable error code constants
│   ├── middleware/
│   │   ├── cors.ts             # CORS configuration bounded by validated environment origins
│   │   ├── error-handler.ts    # Centralized 404 handler and error response middleware
│   │   ├── request-id.ts       # Request ID validation and generation
│   │   └── request-logger.ts   # Correlated request/response Pino logging middleware
│   ├── routes/
│   │   ├── health.routes.ts    # /health and /health/ready endpoints
│   │   └── index.ts            # Root API router aggregation
│   └── types/
│       ├── express.d.ts        # Ambient type extensions for Express.Request (req.id, req.log)
│       └── response.types.ts   # Canonical API response and error envelope interfaces
```

---

## 3. Environment Configuration & Validation

Environment variables are validated on application startup via `src/config/env.ts` using Zod. Missing or malformed configurations trigger an immediate, descriptive startup failure without logging raw secrets or stack traces.

### Variable Definitions

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `enum('development', 'test', 'production')` | `development` | Runtime environment. In `test`, log level defaults to `silent`. |
| `PORT` | `number (1-65535)` | `4000` | HTTP listener port. Avoids port 3000 used by Next.js. |
| `DATABASE_URL` | `string` | *(Required)* | PostgreSQL + PostGIS connection string for Prisma. |
| `DIRECT_URL` | `string` | *(Optional)* | Direct PostgreSQL connection string bypassing poolers. |
| `CORS_ALLOWED_ORIGINS` | `string` (comma-separated) | `http://localhost:3000` | Allowed origins for cross-origin requests. Every entry must strictly conform to RFC 6454 HTTP(S) serialized origins (`http://host[:port]` or `https://host[:port]`). Wildcards (`*`), credentials, paths, query strings, fragments, and empty entries are rejected at startup with generic, non-reflecting error messages to prevent credential leakage. |
| `LOG_LEVEL` | `enum('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')` | `info` | Active Pino log level threshold. |
| `JWT_SECRET` | `string (min 32 chars)` | *(Required)* | Secret key used to sign and verify HMAC-SHA256 (`HS256`) access tokens. Must contain at least 32 characters (256 bits) of entropy. |
| `JWT_ISSUER` | `string` | `https://mytravelroad.com` | Expected JWT issuer claim (`iss`). |
| `JWT_AUDIENCE` | `string` | `https://mytravelroad.com` | Expected JWT audience claim (`aud`). |

---

## 4. Middleware Pipeline & Execution Flow

Incoming requests pass through a strictly ordered middleware pipeline:

```mermaid
flowchart TD
    Req["Incoming HTTP Request"] --> MW1["1. Request ID Middleware (src/server/middleware/request-id.ts)"]
    MW1 --> MW2["2. Helmet Security Headers (HSTS, NoSniff, XSS Protection)"]
    MW2 --> MW3["3. CORS Middleware (Origin check from env.CORS_ALLOWED_ORIGINS)"]
    MW3 --> MW4["4. Express JSON Body Parser (limit: 100kb)"]
    MW4 --> MW5["5. Cookie Parser Middleware"]
    MW5 --> MW6["6. Pino Request Logger (Attaches req.log, logs start & finish)"]
    MW6 --> Dispatch{"Route Matched?"}
    Dispatch -- Yes --> Route["Route Handler (e.g. /health, /health/ready)"]
    Dispatch -- No --> MW404["Catch-All 404 Handler (NotFoundError)"]
    Route -- Next(err) or Throw --> MWError["Centralized Error Handler (src/server/middleware/error-handler.ts)"]
    MW404 --> MWError
    MWError --> Res["Sanitized JSON Error Response Envelope"]
```

### Request ID & Path-Only URL Logging
- If the incoming request contains an `X-Request-Id` header matching `^[a-zA-Z0-9_-]{1,64}$`, that value is preserved.
- If missing, empty, or containing invalid characters, a new UUIDv4 is generated via Node.js `crypto.randomUUID()`.
- The ID is bound to `req.id` and echoed back via the `X-Request-Id` response header.
- **Pathname-Only Logging**: To prevent sensitive query parameters (`?token=...`, `?password=...`) from leaking into persistent log storage, the request logger strips all query strings and logs strictly the sanitized pathname (`path: req.originalUrl.split('?')[0]`).
- **Injectable Logger Middleware Factory**: `createRequestLoggerMiddleware(customLogger?: Logger)` allows injecting custom or test loggers into the actual production logging pipeline while exporting `requestLoggerMiddleware` by default.

### CORS Origin Validation & Sanitized Error Responses
- CORS origins are strictly matched against the validated allowlist.
- When an unauthorized origin attempts cross-origin access, the request is rejected with a generic HTTP `403 FORBIDDEN_ACCESS` error envelope (`"message": "Cross-origin request forbidden by CORS policy"`).
- Attacker-controlled origin strings are **never reflected** in error response payloads, eliminating XSS and reflection vectors.
- Environment validation of CORS configuration likewise uses generic error messages (`"CORS_ALLOWED_ORIGINS contains an invalid HTTP(S) origin entry."`) to prevent user credentials or tokens configured in origin strings from leaking into startup logs.

### Sensitive Data Redaction in Logging
Pino is configured to redact credentials, tokens, and sensitive headers across all log records:
- `req.headers.authorization`
- `req.headers.cookie`
- `res.headers['set-cookie']`
- `password`, `*.password`
- `token`, `*.token`
- `refreshToken`, `*.refreshToken`
- `accessToken`, `*.accessToken`
- `secret`, `*.secret`
- `credentials`, `*.credentials`

Redacted values are replaced with `[REDACTED]`.

---

## 5. API Response Envelopes & Error Taxonomy

### 5.1 Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 100,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "timestamp": "2026-11-17T03:00:00.000Z"
  }
}
```

### 5.2 Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request body failed schema validation.",
    "details": [
      {
        "field": "title",
        "issue": "Title must be at least 3 characters long."
      }
    ],
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-11-17T03:00:00.000Z"
  }
}
```

### 5.3 Error Code Mapping
| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `BAD_REQUEST` | `400` | Malformed JSON syntax, invalid query parameters, or missing mandatory headers. |
| `AUTHENTICATION_REQUIRED` | `401` | Missing, expired, or malformed authentication token. |
| `INVALID_CREDENTIALS` | `401` | Incorrect username/email or password. |
| `FORBIDDEN_ACCESS` | `403` | Caller lacks the necessary permission or role. |
| `RESOURCE_NOT_FOUND` | `404` | The requested route, ID, or entity does not exist. |
| `DUPLICATE_RESOURCE` | `409` | Unique constraint violation. |
| `VALIDATION_FAILED` | `422` | Zod schema validation failed on one or more payload fields. |
| `SERVICE_UNAVAILABLE` | `503` | Readiness check failed or downstream dependency unavailable. |
| `INTERNAL_SERVER_ERROR` | `500` | Unhandled server exception. Raw errors and stack traces are suppressed. |

---

## 6. Health & Readiness Endpoints

### 6.1 Basic Process Health
- **Endpoint**: `GET /health`
- **Purpose**: Verifies that the Node.js process is alive and responsive.
- **Response**: HTTP 200 OK
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "uptime": 45.21,
      "timestamp": "2026-11-17T03:00:00.000Z"
    }
  }
  ```

### 6.2 Database Readiness Probe
- **Endpoint**: `GET /health/ready`
- **Purpose**: Verifies active connectivity to PostgreSQL using `SELECT 1`.
- **Success Response**: HTTP 200 OK
  ```json
  {
    "success": true,
    "data": {
      "status": "ready",
      "database": "connected",
      "timestamp": "2026-11-17T03:00:00.000Z"
    }
  }
  ```
- **Failure Response**: HTTP 503 Service Unavailable
  ```json
  {
    "success": false,
    "error": {
      "code": "SERVICE_UNAVAILABLE",
      "message": "Database readiness check failed",
      "requestId": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2026-11-17T03:00:00.000Z"
    }
  }
  ```
- **Security Invariant**: Failure responses **never** expose PostgreSQL error codes, database credentials, connection strings, or internal stack traces.

---

## 7. Database Infrastructure & Lifecycle Management

- **Prisma Client Singleton**: `src/lib/db.ts` uses the global singleton pattern to prevent duplicate connection pools during hot-reloading in development.
- **Query Logging Hardening**: Prisma Client is configured strictly with `log: PRISMA_LOG_CONFIG` where `PRISMA_LOG_CONFIG: Prisma.LogLevel[] = ["error", "warn"]` across all environments. Raw SQL query logging (`"query"`) is prohibited to prevent the emission of bound parameter values that may contain sensitive credentials, password hashes, or personally identifiable information.
- **Explicit Connection Lifecycle**:
  - `connectDatabase()`: Explicitly initiates connection pool creation (`prisma.$connect()`).
  - `disconnectDatabase()`: Cleanly drains connection pools on server shutdown (`prisma.$disconnect()`).
  - `checkDatabaseHealth()`: Executes `SELECT 1` without modifying state.
- **Preservation of Existing Assets**: All 39 PostGIS spatial helpers and custom WKT/bounding-box utilities in `src/lib/db.ts` are preserved.

---

## 8. Graceful Shutdown Protocol

The server bootstrap (`src/server/index.ts`) registers termination handlers for `SIGTERM` and `SIGINT`:
1. **Stop Incoming Traffic**: The HTTP listener calls `server.close()`, refusing new connections.
2. **Drain Existing Connections**: In-flight requests are granted a graceful drain period (up to 10 seconds).
3. **Database Teardown**: The Prisma client connection is closed via `disconnectDatabase()`.
4. **Clean Exit**: The process logs the shutdown completion and exits with code 0.
5. **Crash Safety**: Uncaught exceptions (`uncaughtException`) and unhandled promise rejections (`unhandledRejection`) log fatal diagnostic errors via Pino before initiating an exit with code 1.

---

## 9. Testing Strategy

The test suite is built on **Vitest** and **Supertest** located under `tests/server/`:
- `env.test.ts`: Validates Zod environment parsing, defaults, port boundary coercion, RFC 6454 origin validation, secret leakage prevention on malformed origins, and empty entry rejection.
- `app.test.ts`: Validates Express factory creation, Helmet headers, CORS headers, and JSON body parsing 100kb limit.
- `health.test.ts`: Validates process health (200), database readiness (200), and database connection failure (503 with safe sanitization).
- `error-handler.test.ts`: Validates 404 handler, custom `AppError` subclasses, Zod validation formatting, body parser syntax errors, and 500 stack sanitization.
- `request-id.test.ts`: Validates generation of UUIDv4, validation/preservation of valid incoming headers, sanitization of malicious headers, and header echo.
- `logging.test.ts`: Validates Pino redaction rules against authorization headers, cookies, passwords, and tokens; tests actual `requestLoggerMiddleware` query-stripping behavior; asserts on `PRISMA_LOG_CONFIG` to guarantee query logging suppression.
- `auth/password.test.ts`: Validates Argon2id MCF generation, constant-time verification, rejection of incorrect passwords, unique CSPRNG salts, safe malformed hash handling, `needsRehash` parameter detection, and Zod password complexity rules.
- `auth/jwt.test.ts`: Validates HMAC-SHA256 access token signing, claim preservation, algorithm-confusion attack rejection (`alg: none`, `alg: HS512`), expiration enforcement, and issuer/audience verification.
- `auth/refresh-token.test.ts`: Validates CSPRNG opaque refresh token generation (`rt_<uuid>_<64hex>`), timing-safe SHA-256 hash verification, family ID extraction, format regex checking, and centralized cookie options generation.

---

## 10. Password Security & Cryptography Foundation

The authentication module (`src/server/auth/`) provides reusable cryptographic utilities strictly adhering to **RFC 9106** and **OWASP Password Storage Guidelines**:

### 10.1 Argon2id Configuration Parameters
- **Algorithm**: `argon2id` (v=19 / 0x13)
- **Memory Cost ($m$)**: $65536\text{ KiB}$ ($64\text{ MiB}$)
- **Time Cost ($t$)**: $3\text{ iterations}$
- **Parallelism ($p$)**: $4\text{ threads / lanes}$
- **Salt Length**: $16\text{ bytes}$ ($128\text{ bits}$ CSPRNG generated automatically by `argon2`)
- **Key / Digest Length**: $32\text{ bytes}$ ($256\text{ bits}$)
- **Format**: Standard Modular Crypt Format (MCF): `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<digest>`

### 10.2 Cryptographic Invariants
1. **No Plaintext Persistence**: Passwords are never stored, logged, or reflected in responses or traces.
2. **Safe Error Handling**: `verifyPassword` catches malformed hashes, corrupted salts, and internal library exceptions, returning `false` safely without exposing internal details or crashing.
3. **Lazy Re-Hashing**: `needsRehash` checks whether stored MCF strings match current target cost parameters, enabling zero-downtime parameter upgrades during authenticated logins.
4. **Password Input Policy (Zod & Unicode Code-Point Semantics)**:
   - Password lengths are strictly evaluated in **Unicode code points** (`countCodePoints(str)` via `Array.from(str).length`), correctly accommodating supplementary characters (e.g. emoji, astral symbols) spanning surrogate pairs.
   - The 72-character maximum threshold is an **application-level API policy** established for payload bounding and DoS mitigation, distinct from Argon2id's maximum supported input length (which natively supports inputs up to $2^{32}-1$ bytes).
   - `passwordCreationSchema`: 8–72 Unicode code points, $\ge 1$ uppercase ASCII letter, $\ge 1$ lowercase ASCII letter, $\ge 1$ numeric digit. Whitespace is strictly preserved without silent trimming.
   - `loginPasswordSchema`: 1–72 Unicode code points, non-empty string. Both schemas and the hashing boundary enforce identical 72-code-point boundaries.

---

## 11. Authentication Token & Session Security Foundation

The authentication module (`src/server/auth/`) establishes reusable cryptographic primitives for stateless access token verification, opaque refresh token lifecycle management, and centralized cookie configuration:

### 11.1 Access Token Architecture (JWT)
- **Signing Algorithm**: HMAC-SHA256 (`HS256`) via `jose` library.
- **Key Derivation**: Sourced from `env.JWT_SECRET` (minimum 32 characters / 256 bits of entropy).
- **Lifetime**: 15 minutes (`900` seconds).
- **Defensive Signing Options**: `signAccessToken()` accepts an optional `expiresInSeconds` bounded strictly between $1$ and $86,400$ seconds (1 second to 24 hours), rejecting zero, negative, non-integer, or unreasonable values.
- **Algorithm Pinning & Confusion Defense**: Both signing and verification pin strictly to `HS256` (`algorithms: ["HS256"]`). Tokens signed with `none`, `RS256`, `HS384`, or `HS512` are rejected.
- **Payload & Claims Schema**:
  - `sub`: Valid account UUID string strictly matching UUIDv4 (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`), rejecting UUID versions other than 4.
  - `role`: One of the approved `UserRole` enums: `traveler`, `contributor`, `curator`, `moderator`, `super_admin`.
  - `email`: Valid non-empty email string matching standard email syntax.
  - `emailVerified`: Strict boolean value.
  - `type`: One of the approved `AccountType` enums: `individual`, `business`, `system`.
  - `status`: One of the approved `AccountStatus` enums: `active`, `suspended`, `pending_verification`, `deactivated`.
  - `gen`: Positive integer sequence counter ($\ge 1$). Purely a validated compatibility claim in Stage A.
  - `iat`: Valid positive integer Unix timestamp; bounded by an explicit clock tolerance of 60 seconds (`CLOCK_TOLERANCE_SECONDS = 60`) to reject timestamps unreasonably in the future.
  - `exp`: Valid positive integer Unix timestamp strictly later than `iat` (`exp > iat`).
  - `iss`: Issuer URI (`env.JWT_ISSUER`, default `https://mytravelroad.com`).
  - `aud`: Audience URI (`env.JWT_AUDIENCE`, default `https://mytravelroad.com`). Verification confirms presence in `aud` string or array and guarantees returned `claims.aud` reflects the verified configured expected audience.
- **Strict Runtime Type Guards**: `verifyAccessToken()` asserts each claim at runtime using dedicated type guard functions (`isValidUserRole`, `isValidAccountType`, `isValidAccountStatus`) without unsafe TypeScript type casts or manufactured defaults. Missing, malformed, or invalid claims trigger immediate rejection with a sanitized `UnauthorizedError(ErrorCode.TOKEN_INVALID)`.

### 11.2 Refresh Token Primitives
- **Format**: Structured opaque string: `rt_<familyId>_<entropy>`
  - `familyId`: UUIDv4 routing shard key representing the token family lineage. Contains zero user, role, or authorization data.
  - `entropy`: 32 bytes of cryptographically secure random bytes generated via `crypto.randomBytes(32)` formatted as a 64-character lowercase hex string (256 bits entropy).
  - Validated via regex: `^rt_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_[0-9a-f]{64}$`.
- **Storage & Hashing**:
  - Refresh tokens are **never stored in plaintext** in any storage tier.
  - The server computes a SHA-256 hex digest (`hashRefreshToken(token)`).
  - Verification against stored digests is performed using constant-time comparison via `crypto.timingSafeEqual` (`verifyRefreshTokenHash(token, hash)`).
- **Lifetime**: 30 days (`2,592,000` seconds).

### 11.3 Centralized Cookie Configuration
- **Cookie Name**: `refreshToken`
- **Path**: Restricted strictly to `/api/v1/auth` (preventing transmission on general API requests or static assets).
- **HttpOnly**: `true` (prohibiting JavaScript access and mitigating XSS token theft).
- **Secure**: `true` in production (`env.NODE_ENV === "production"`); `false` in development/test.
- **SameSite**: `Strict` (defending against Cross-Site Request Forgery).
- **MaxAge**: 30 days (`30 * 24 * 60 * 60 * 1000` ms) on active session issuance; `0` on logout or session clearing (`getClearRefreshTokenCookieOptions()`).

### 11.4 Architectural Boundaries & Stage A Scope
- **Task 10.2 Scope**: Limited exclusively to reusable cryptographic token and cookie primitives (`signAccessToken`, `verifyAccessToken`, `generateRefreshToken`, `parseRefreshToken`, `hashRefreshToken`, `verifyRefreshTokenHash`, `getRefreshTokenCookieOptions`, `getClearRefreshTokenCookieOptions`).
- **Deferred to Subsequent Tasks**:
  - Redis connection lifecycle, cluster client initialization, and session state persistence (`session:{familyId}:{sessionId}`, `family:{familyId}`).
  - Redis Lua scripts for atomic refresh rotation and replay revocation.
  - HTTP authentication endpoints (`/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`).
- **Stage A Revocation & Token Generation Semantics**:
  - The Stage A database uses `accounts` and `account_security_credentials`. It does **not** contain a `token_generation` column.
  - In Stage A, durable invalidation (such as on password change or admin intervention) is evaluated against `AccountSecurityCredential.passwordChangedAt` and live `Account.status` checks (`active` vs `suspended`/`deactivated`).
  - The `gen` integer claim is included in the access token contract per `api-architecture.md` Section 6.2 and is strictly verified at runtime as an integer ($\ge 1$). However, **it is purely a validated compatibility claim and does NOT function as an active revocation mechanism in Stage A**. Connecting `gen` to a durable database increment counter is deferred to a future architecture stage when database schema changes are formally scheduled.

---

## 12. Authentication & Role Authorization Middleware Foundation

The middleware layer (`src/server/middleware/`) provides reusable, modular Express middleware enforcing server-side identity verification, discrete role authorization, email verification gating, and lifecycle status checks:

### 12.1 Authentication Middleware (`authenticate`, `createAuthenticateMiddleware`)
- **Protocol**: Reads HTTP `Authorization` header with case-insensitive Bearer scheme parsing (accepting `Bearer`, `bearer`, `BEARER`, `bEaReR` per RFC 6750). Rejects missing headers, unsupported schemes (`Basic`, `Digest`, etc.), or empty/whitespace tokens with `401 UnauthorizedError(ErrorCode.AUTHENTICATION_REQUIRED)`.
- **Token Verification**: Calls the verified `verifyAccessToken()` primitive. Rejects expired (`TOKEN_EXPIRED`) or corrupted/tampered (`TOKEN_INVALID`) JWTs. Never implements a secondary verification path.
- **Authoritative Database Synchronization**:
  - Queries PostgreSQL via Prisma `account.findUnique` selecting only minimal operational fields: `id`, `email`, `emailVerified`, `status`, `type`, `role`, and `securityCredentials.passwordChangedAt`.
  - Never retrieves password hashes, salts, MFA secrets, or sensitive credentials.
  - Nonexistent accounts are rejected with `401 UnauthorizedError(ErrorCode.AUTHENTICATION_REQUIRED)`.
- **System Account Defense**: Accounts with `type = 'system'` (including Root System Account `00000000-0000-4000-8000-000000000001`) are programmatic and barred from authenticating via interactive APIs, rejecting with `403 ForbiddenError(ErrorCode.FORBIDDEN_ACCESS)`.
- **Status Gating at Authentication Barrier**:
  - Suspended accounts (`status = 'suspended'`) are rejected immediately with `403 ForbiddenError(ErrorCode.ACCOUNT_SUSPENDED)`.
  - Deactivated accounts (`status = 'deactivated'`) are rejected immediately with `403 ForbiddenError(ErrorCode.ACCOUNT_DEACTIVATED)`.
  - Unverified accounts (`status = 'pending_verification'`) successfully authenticate to allow access to initial self-service endpoints (`/auth/me`, `/auth/verify-email`, `/auth/resend-verification`), while downstream mutation guards enforce email verification.
- **Stage A Password Change Invalidation**:
  - If `AccountSecurityCredential.passwordChangedAt` is populated, the middleware verifies that the token's issued-at timestamp is strictly later than the password change timestamp (`claims.iat > Math.floor(passwordChangedAt.getTime() / 1000)`).
  - Tokens issued in the same second as, or prior to, a password change (`claims.iat <= Math.floor(passwordChangedAt.getTime() / 1000)`) are conservatively rejected with `401 UnauthorizedError(ErrorCode.TOKEN_INVALID)`, requiring re-authentication.
- **Fail-Closed Reliability**:
  - Database failures or connection drops fail closed, logging the error and returning `503 ServiceUnavailableError(ErrorCode.SERVICE_UNAVAILABLE)` without leaking database connection strings or internals.
- **Dependency Injection**:
  - Provides `createAuthenticateMiddleware(dbClient)` allowing unit tests to inject mock Prisma clients with complete test isolation.

### 12.2 Authenticated Principal (`AuthenticatedPrincipal`)
- Upon successful authentication and database resolution, the middleware attaches a typed `AuthenticatedPrincipal` to `req.auth` (and alias `req.user`):
  ```ts
  export interface AuthenticatedPrincipal {
    accountId: AccountId;       // Nominal UUIDv4
    email: string;              // Authoritative PostgreSQL email
    role: UserRole;             // Authoritative PostgreSQL role
    accountType: AccountType;   // Authoritative PostgreSQL classification
    accountStatus: AccountStatus; // Authoritative PostgreSQL lifecycle status
    emailVerified: boolean;     // Authoritative PostgreSQL email verification flag
  }
  ```
- **Authoritative Overrides**: Authoritative role, type, status, and verification state are always derived from PostgreSQL, preventing stale or forged JWT claims from exercising unauthorized privileges.

### 12.3 Discrete Role Enforcement (`requireRole`)
- **Discrete RBAC (Zero Implicit Inheritance)**:
  - Permissions are discrete. Roles (`traveler`, `contributor`, `curator`, `moderator`, `super_admin`) do **not** inherit capabilities from other roles.
  - `super_admin` is not automatically authorized unless `super_admin` is explicitly passed in `allowedRoles`.
- **Factory-Time Validation**: Validates that `allowedRoles` contains at least one approved `UserRole` using `isValidUserRole()`. Invalid or empty configurations fail fast at initialization.
- **Runtime Assertion**:
  - If unauthenticated (`!req.auth`): returns `401 UnauthorizedError(ErrorCode.AUTHENTICATION_REQUIRED)`.
  - If caller's role is not in `allowedRoles`: returns `403 ForbiddenError(ErrorCode.FORBIDDEN_ACCESS)`.

### 12.4 Email Verification Enforcement (`requireEmailVerified`)
- Restricts protected mutation operations (such as destination drafting, media upload, or bookmarking) to accounts with `req.auth.emailVerified === true`.
- Unverified accounts are rejected with `403 ForbiddenError(ErrorCode.EMAIL_VERIFICATION_REQUIRED)`.

### 12.5 Account Status Enforcement (`requireAccountStatus`, `requireActiveAccount`)
- Provides reusable middleware asserting acceptable lifecycle statuses:
  - `requireAccountStatus(...allowedStatuses)`: Restricts routes to specified statuses.
  - `requireActiveAccount`: Convenience shorthand asserting `req.auth.accountStatus === 'active'`.
- Pending verification accounts attempting active-only operations receive `403 ForbiddenError(ErrorCode.EMAIL_VERIFICATION_REQUIRED)`.

### 12.6 Explicit Separation of Authentication and Authorization
- **Authentication (`authenticate`)**: Verifies cryptographic token validity, confirms account existence in PostgreSQL, asserts baseline non-suspension and password freshness, and attaches the `AuthenticatedPrincipal`.
- **Authorization (`requireRole`, `requireEmailVerified`, `requireAccountStatus`)**: Asserts capability permissions, email verification, and status eligibility. Downstream route handlers remain clean and focused on business logic.

---

## 13. Tourist Account Registration API (`POST /api/v1/auth/register`)

### 13.1 Endpoint Architecture & Purpose
The tourist registration endpoint provisions public traveler accounts and associated profile projections.
- **URI**: `POST /api/v1/auth/register`
- **Authentication**: None (Public).
- **Rate Limit**: 5 requests per minute per client IP.
- **Atomicity**: Single PostgreSQL transaction covering `Account`, `AccountSecurityCredential`, and `TouristProfile`.

### 13.2 Request Validation Schema (`registerRequestSchema`)
Enforced via strict Zod schema rejecting unexpected properties (`.strict()`):
- **`email`**: Valid RFC 5322 format, maximum 255 characters, normalized to lowercase.
- **`password`**: 8 to 72 Unicode code points, $\ge 1$ uppercase letter, $\ge 1$ lowercase letter, $\ge 1$ digit. Whitespace preserved exactly without silent trimming.
- **`displayName`**: 2 to 120 characters, surrounding whitespace trimmed, non-empty.
- **`handle`**: 3 to 50 characters, regex `^[a-z0-9_]+$`. Uppercase characters and special symbols rejected without silent conversion.
- **`preferredLanguage`**: Strict allowlist (`['en', 'ml']`), default `'en'`.

### 13.3 Atomic Transaction & Provisioning Invariants
All records are created within a single `prisma.$transaction`:
1. **`Account`**:
   - `type`: `'individual'`
   - `role`: `'traveler'`
   - `status`: `'pending_verification'`
   - `emailVerified`: `false`
   - `phoneVerified`: `false`
2. **`AccountSecurityCredential`**:
   - `accountId`: `Account.id` (1:1)
   - `passwordHash`: Argon2id MCF format ($argon2id$v=19$m=65536,t=3,p=4$...)
   - `mfaEnabled`: `false`
   - `failedLoginAttempts`: `0`
3. **`TouristProfile`**:
   - `accountId`: `Account.id` (1:1)
   - `displayName`: Trimmed display name
   - `handle`: Validated handle
   - `preferredLanguage`: Selected or default language
   - `travelPreferences`: Empty array `[]`
   - `isPublic`: `true`

### 13.4 Concurrency & Duplicate Handling
- Concurrency-safe uniqueness is authoritatively enforced by PostgreSQL database constraints (`uq_accounts_email`, `uq_profiles_handle`, `idx_profiles_handle_lower`).
- Database uniqueness constraint violations (`P2002`) are caught and translated into `409 ConflictError(ErrorCode.DUPLICATE_RESOURCE)` with a generic message: `"An account with the provided email or handle already exists."`.
- Internal schema names, constraint names, SQL queries, and stack traces are never exposed.

### 13.5 Rate Limiting & Spoofing Defense (`createRateLimiter`)
- An in-memory rate limiter tracks request counts per IP over a 60-second sliding window.
- In untrusted proxy configurations (`app.get("trust proxy")` is false), the client IP is extracted strictly from the underlying socket remote address (`req.socket.remoteAddress`), preventing forged `X-Forwarded-For` headers from bypassing throttling.
- Exceeded rate limits return `429 TooManyRequestsError(ErrorCode.RATE_LIMIT_EXCEEDED)` along with standard `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

### 13.6 Stage A Boundaries
- Registration solely creates identity records. It does **not** authenticate the user, return JWT access tokens, set refresh cookies, or initiate email verification delivery.
- The 15-table Stage A schema boundary is preserved without migrations.
