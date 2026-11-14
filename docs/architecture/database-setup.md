# Database Setup & Operations Runbook

## 1. Overview

**My Travelroad** utilizes **PostgreSQL 16** with the **PostGIS 3.4** spatial extension as its primary relational and geospatial datastore. The database layer is structured according to the Stage A domain model and database architecture approved in [`docs/architecture/database-architecture.md`](file:///c:/Users/aysha/Downloads/My%20Travelroad/My%20Travelroad/docs/architecture/database-architecture.md) and [`docs/architecture/domain-model.md`](file:///c:/Users/aysha/Downloads/My%20Travelroad/My%20Travelroad/docs/architecture/domain-model.md).

### Stage A Schema Scope
The foundation comprises **15 tables**:
1. `accounts` — Central identity registry.
2. `account_security_credentials` — Isolated 1:1 security credentials.
3. `tourist_profiles` — Public and private user profile attributes.
4. `destination_categories` — Hierarchical taxonomy.
5. `destinations` — Core destination entity.
6. `destination_locations` — Spatial coordinates (`GEOGRAPHY(Point, 4326)`), fuzzy precision flags, and geo-enrichment metadata.
7. `destination_media` — Multi-resolution assets, licensing, and focal point geometry.
8. `destination_opening_hours` — Weekly schedule, seasonal intervals, and operational statuses.
9. `destination_verifications` — Governance lifecycle and reviewer assignments.
10. `verification_evidence` — Audit trails and uploaded proof documents.
11. `verification_records` — Immutable certified provenance snapshots.
12. `saved_destinations` — Traveler bookmarks and trip staging.
13. `audit_logs` — Immutable, append-only operational and security event log.
14. `audit_log_telemetry` — Auxiliary privacy-protected audit telemetry (IP, client headers).
15. `destination_secondary_categories` — Many-to-many junction table between destinations and categories.

Additionally, the database layer provisions:
- **Public Views**: `v_public_destination_locations` (geographic projection and coordinate fuzzing), `v_domain_audit_logs`.
- **Database Roles**: `app_user` (least-privilege runtime), `admin_service_role` (administrative actions), `audit_maintenance_role` (compliance archiving).
- **Security Triggers**: Root system account immutability, system child table prevention, account-type transition protection, and audit log immutability.

---

## 2. Prerequisites

- **Node.js**: `v18.18+` or `v20.x`
- **npm**: `v9+` or `v10+`
- **PostgreSQL**: PostgreSQL 16+ with PostGIS 3.4+
- **Docker & Docker Compose** (recommended for local development and CI testing)

---

## 3. Docker Compose Local Setup

For reproducible local development, use the following `docker-compose.yml` to provision a PostGIS-enabled PostgreSQL 16 instance.

```yaml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:16-3.4
    container_name: mytravelroad-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: mytravelroad
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d mytravelroad"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### Starting the Container
```bash
docker compose up -d
```

### Checking Container Health
```bash
docker compose ps
```

---

## 4. Environment Configuration

Copy the template from `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure the connection strings are properly configured:

```env
# Standard application connection pool URL (e.g. PgBouncer or direct pool)
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/mytravelroad?schema=public&connection_limit=10"

# Direct URL for schema migrations and administrative operations
DIRECT_URL="postgresql://postgres:postgrespassword@localhost:5432/mytravelroad?schema=public"

NODE_ENV="development"
```

---

## 5. Migration Execution

The schema migrations are fully version-controlled under `prisma/migrations/` and execute sequentially across three designated phases:

1. **Phase 1: Core Foundation (`20261114000001_phase1_core_foundation`)**
   - Enables `uuid-ossp`, `pgcrypto`, and `postgis` extensions.
   - Creates `accounts`, `account_security_credentials`, `tourist_profiles`.
   - Seeds the Root System Account (`00000000-0000-4000-8000-000000000001`).
   - Attaches `trg_guard_system_account` and child credential/profile prevention triggers.

2. **Phase 2: Taxonomy & Destinations (`20261114000002_phase2_taxonomy_destinations`)**
   - Creates `destination_categories`, `destinations`, `destination_secondary_categories`.
   - Creates `destination_locations` with native `GEOGRAPHY(Point, 4326)`.
   - Provisions GiST spatial expression indexes (`idx_locations_public_coord_expr`).
   - Creates `destination_media` and `destination_opening_hours`.

3. **Phase 3: Verification, Audit & Security Roles (`20261114000003_phase3_verification_audit`)**
   - Creates `destination_verifications`, `verification_evidence`, `verification_records`.
   - Creates `saved_destinations`.
   - Attaches `trg_guard_system_type_transition` to `accounts`.
   - Creates `audit_logs` and `audit_log_telemetry` with immutability triggers.
   - Provisions views `v_public_destination_locations` and `v_domain_audit_logs`.
   - Grants least-privilege permissions to `app_user`, `admin_service_role`, and `audit_maintenance_role`.

### Running Migrations

```bash
# Apply pending migrations to the database
npm run db:migrate
```

### Generating Prisma Client

```bash
# Re-generate the TypeScript Prisma Client
npm run db:generate
```

---

## 6. Database Seeding

The database seed script (`prisma/seed.ts`) is idempotent and safe to run multiple times:

```bash
npm run db:seed
```

### Seeding Invariants Enforced
1. **Root System Account**:
   - UUID: `00000000-0000-4000-8000-000000000001`
   - Email: `system-internal@mytravelroad.local`
   - Role: `super_admin`, Type: `system`, Status: `active`
   - **Zero Credentials**: Explicitly validates that no `account_security_credentials`, `tourist_profiles`, or `saved_destinations` records exist for this account.
2. **Taxonomy Baseline (Malappuram)**:
   - `nature-wildlife` (Nature & Wildlife)
   - `beaches-coastal` (Beaches & Estuaries)
   - `hills-valleys` (Waterfalls & Hills)
   - `heritage-culture` (Heritage & Culture)

---

## 7. Verification & PostGIS Validation Queries

Once migrations and seeding have run against a live PostgreSQL instance, verify the installation with these administrative queries:

### 1. Verify PostGIS Extension
```sql
SELECT PostGIS_Full_Version();
```
*Expected Output*: Returns `POSTGIS="3.4.x" ... GEOS="3.x" ... PROJ="9.x"`.

### 2. Verify Spatial Indexes
```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'destination_locations'
  AND indexdef LIKE '%gist%';
```
*Expected Output*: Returns `idx_destination_locations_coordinates` and `idx_locations_public_coord_expr`.

### 3. Verify Public Spatial View
```sql
SELECT destination_id, published_longitude, published_latitude, is_exact
FROM v_public_destination_locations
LIMIT 5;
```

### 4. Verify Root System Account Immutability Trigger
```sql
-- Attempting to alter root system account email MUST fail
UPDATE accounts
SET email = 'malicious@external.com'
WHERE id = '00000000-0000-4000-8000-000000000001';
-- Expected: ERROR: CRITICAL SECURITY VIOLATION: Root system account attributes are immutable (id=00000000-0000-4000-8000-000000000001)
```

### 5. Verify System Account Child-Table Prevention Trigger
```sql
-- Attempting to add credentials to a system account MUST fail
INSERT INTO account_security_credentials (account_id, password_hash)
VALUES ('00000000-0000-4000-8000-000000000001', 'hashed_pw_attempt');
-- Expected: ERROR: INVARIANT VIOLATION: System accounts cannot possess authentication credentials (account_id=00000000-0000-4000-8000-000000000001)
```

### 6. Verify Audit Log Immutability Trigger
```sql
-- Attempting to update an audit log record MUST fail
UPDATE audit_logs
SET action = 'TAMPERED'
WHERE id = (SELECT id FROM audit_logs LIMIT 1);
-- Expected: ERROR: INVARIANT VIOLATION: audit_logs records are strictly append-only and cannot be updated or deleted.
```

---

## 8. TypeScript Application Integration

Application code interacts with the database using the singleton Prisma Client and spatial helper functions exported from `src/lib/db.ts`:

```typescript
import { prisma, toPointWkt, getBoundingBoxEnvelopes } from "@/lib/db";

// Example spatial proximity query using Prisma raw queries
const nearbyDestinations = await prisma.$queryRaw`
  SELECT 
    d.id, 
    d.title, 
    d.slug,
    ST_Distance(
      dl.coordinates, 
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
    ) AS distance_meters
  FROM destinations d
  JOIN destination_locations dl ON dl.destination_id = d.id
  WHERE d.publication_status = 'published'
    AND ST_DWithin(
      dl.coordinates, 
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, 
      ${radiusMeters}
    )
  ORDER BY distance_meters ASC
  LIMIT 20;
`;
```
