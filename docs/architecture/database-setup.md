# Database Setup & Operations Runbook

## 1. Overview

**My Travelroad** utilizes **PostgreSQL 16** with the **PostGIS 3.4** spatial extension as its primary relational and geospatial datastore. The database layer strictly implements the Stage A domain model and database architecture approved in [`docs/architecture/database-architecture.md`](file:///c:/Users/aysha/Downloads/My%20Travelroad/My%20Travelroad/docs/architecture/database-architecture.md) and [`docs/architecture/domain-model.md`](file:///c:/Users/aysha/Downloads/My%20Travelroad/My%20Travelroad/docs/architecture/domain-model.md).

### Stage A Schema Scope (15 Tables)
1. `accounts` — Central identity registry decoupled from public profiles.
2. `account_security_credentials` — Isolated 1:1 authentication secrets and security lockouts.
3. `tourist_profiles` — Public and private user profile attributes and travel preferences.
4. `destination_categories` — Hierarchical taxonomy classification with self-referencing subcategories.
5. `destinations` — Core tourism destination storytelling entity.
6. `destination_locations` — PostGIS spherical location data (`GEOGRAPHY(Point, 4326)`), administrative hierarchy, and coordinate sensitivity flags.
7. `destination_media` — High-resolution media, licensing, and single-cover partial index.
8. `destination_opening_hours` — Operating patterns, weekly schedule intervals, seasonal notes, and fee structures.
9. `destination_verifications` — Overall verification container aggregating fact-level verifications and curator audit dates.
10. `verification_evidence` — Physical or documentary evidence (gazettes, circulars, GPS tracks, photos) supporting fact claims.
11. `verification_records` — Granular historical fact audit stamps per field (`location_coordinates`, `opening_hours`, etc.).
12. `saved_destinations` — Traveler bookmarks and trip staging (strictly one bookmark per account/destination).
13. `audit_logs` — Strictly append-only, immutable regulatory and administrative event ledger.
14. `audit_log_telemetry` — Auxiliary privacy-protected audit telemetry (actor email, IP address, user agent, state snapshots).
15. `destination_secondary_categories` — Many-to-many junction table supporting secondary cross-cutting category tags.

---

## 2. Public Coordinate Privacy Architecture

### The 3-Tier Coordinate Publication Hierarchy
To prevent life-safety hazards (e.g. tourists navigating into hazardous terrain, active quarries, or river gorges) and eliminate mathematical triangulation attacks, **algorithmic pseudo-random Gaussian jitter is explicitly rejected**. Instead, coordinate privacy is governed by the database engine via a **3-Tier Publication Hierarchy**:

1. **Priority 1: Approved Official Public Visitor Access Point**
   - Curated visitor gateway: Forest Department checkpost, ticket counter, official parking area, boat jetty.
   - Safe and legally accessible outside the protected ecological or tribal boundary.
   - Projected via `public_approximate_centroid`.
2. **Priority 2: Reviewed Safe Administrative-Area Centroid**
   - Verified administrative buffer: Taluk headquarters, panchayat center, or designated buffer zone.
   - Human-reviewed by a curator during verification.
   - Projected via `public_approximate_centroid` with `public_approximate_display_name` (e.g. *"Nilambur Eco-Zone Buffer Area"*).
3. **Priority 3: Complete Coordinate Suppression (No Map Pin)**
   - When no safe gateway or reviewed centroid exists, `public_approximate_centroid` is `NULL`.
   - The public projection view `v_public_destination_locations` projects `NULL` for `public_coordinates`.
   - **Crucial Invariant**: Suppressed destinations **never fall back to exact coordinates**.

### Public Projection View: `v_public_destination_locations`
```sql
CREATE OR REPLACE VIEW v_public_destination_locations AS
SELECT
    dl.destination_id,
    dl.is_restricted,
    dl.restriction_reason,
    -- Projected coordinate: returns centroid if restricted, exact if public, or NULL if suppressed (Tier 3)
    CASE
        WHEN dl.is_restricted THEN dl.public_approximate_centroid
        ELSE dl.coordinates
    END AS public_coordinates,
    CASE
        WHEN dl.is_restricted THEN dl.public_approximate_display_name
        ELSE dl.locality
    END AS public_locality_name,
    dl.taluk_or_subdivision,
    dl.district,
    dl.state_or_province,
    dl.country_code,
    dl.postal_code,
    dl.nearest_transit_hub,
    dl.created_at,
    dl.updated_at
FROM destination_locations dl;
```

### Database-Level Access Control
- Raw `destination_locations` table access is revoked from the standard application role:
  ```sql
  REVOKE ALL ON destination_locations FROM app_user;
  GRANT SELECT ON v_public_destination_locations TO app_user;
  ```
- Ordinary application queries cannot bypass the view to inspect raw coordinates of restricted destinations.

---

## 3. Prisma Schema & SQL Migration Constraint Mapping

Every unique constraint, composite unique constraint, and foreign key relationship is explicitly mapped in [`prisma/schema.prisma`](file:///c:/Users/aysha/Downloads/My%20Travelroad/My%20Travelroad/prisma/schema.prisma) to eliminate schema drift:

| Table | SQL Migration Constraint Name | Prisma Declaration |
| :--- | :--- | :--- |
| `accounts` | `uq_accounts_email` | `email @unique(map: "uq_accounts_email")` |
| `accounts` | `uq_accounts_phone` | `phone @unique(map: "uq_accounts_phone")` |
| `account_security_credentials` | `fk_security_account` | `@relation(..., map: "fk_security_account")` |
| `tourist_profiles` | `uq_profiles_account_id` | `accountId @unique(map: "uq_profiles_account_id")` |
| `tourist_profiles` | `uq_profiles_handle` | `handle @unique(map: "uq_profiles_handle")` |
| `tourist_profiles` | `fk_profiles_account` | `@relation(..., map: "fk_profiles_account")` |
| `destination_categories` | `uq_categories_slug` | `slug @unique(map: "uq_categories_slug")` |
| `destination_categories` | `fk_categories_parent` | `@relation(..., map: "fk_categories_parent")` |
| `destinations` | `uq_destinations_slug` | `slug @unique(map: "uq_destinations_slug")` |
| `destinations` | `fk_destinations_primary_category` | `@relation(..., map: "fk_destinations_primary_category")` |
| `destination_secondary_categories` | `fk_sec_cat_destination` | `@relation(..., map: "fk_sec_cat_destination")` |
| `destination_secondary_categories` | `fk_sec_cat_category` | `@relation(..., map: "fk_sec_cat_category")` |
| `destination_locations` | `uq_locations_destination_id` | `destinationId @unique(map: "uq_locations_destination_id")` |
| `destination_locations` | `fk_locations_destination` | `@relation(..., map: "fk_locations_destination")` |
| `destination_media` | `fk_media_destination` | `@relation(..., map: "fk_media_destination")` |
| `destination_opening_hours` | `uq_opening_hours_destination` | `destinationId @unique(map: "uq_opening_hours_destination")` |
| `destination_opening_hours` | `fk_opening_hours_destination` | `@relation(..., map: "fk_opening_hours_destination")` |
| `destination_verifications` | `uq_verifications_destination` | `destinationId @unique(map: "uq_verifications_destination")` |
| `destination_verifications` | `fk_verifications_destination` | `@relation(..., map: "fk_verifications_destination")` |
| `destination_verifications` | `fk_verifications_curator` | `@relation(..., map: "fk_verifications_curator")` |
| `verification_evidence` | `fk_evidence_verification` | `@relation(..., map: "fk_evidence_verification")` |
| `verification_evidence` | `fk_evidence_submitter` | `@relation(..., map: "fk_evidence_submitter")` |
| `verification_records` | `fk_records_verification` | `@relation(..., map: "fk_records_verification")` |
| `verification_records` | `fk_records_destination` | `@relation(..., map: "fk_records_destination")` |
| `verification_records` | `fk_records_verifier` | `@relation(..., map: "fk_records_verifier")` |
| `verification_records` | `fk_records_evidence` | `@relation(..., map: "fk_records_evidence")` |
| `saved_destinations` | `uq_saved_destinations_account_dest` | `@@unique([accountId, destinationId], map: "uq_saved_destinations_account_dest")` |
| `saved_destinations` | `fk_saved_account` | `@relation(..., map: "fk_saved_account")` |
| `saved_destinations` | `fk_saved_destination` | `@relation(..., map: "fk_saved_destination")` |
| `audit_logs` | `fk_audit_actor` | `@relation(..., map: "fk_audit_actor")` |
| `audit_log_telemetry` | `fk_telemetry_audit` | `@relation(..., map: "fk_telemetry_audit")` |

---

## 4. Catalog of Intentionally SQL-Only Database Objects

| Object Name | Type | Purpose / Invariant Enforced |
| :--- | :--- | :--- |
| `uuid-ossp`, `pgcrypto`, `postgis` | Extensions | UUID generation and native spherical geodetic calculations |
| `idx_locations_coordinates` | GiST Index | Spatial index on raw coordinates (`coordinates`) |
| `idx_locations_public_centroid` | GiST Index (Partial) | Spatial index on `public_approximate_centroid WHERE public_approximate_centroid IS NOT NULL` |
| `idx_locations_public_coord_expr` | GiST Index (Functional) | Expression index on `(CASE WHEN is_restricted THEN public_approximate_centroid ELSE coordinates END)` for view inlining pushdown |
| `idx_media_single_cover` | B-Tree (Partial Unique) | Enforces only one cover media item per destination (`WHERE is_cover = TRUE`) |
| `idx_security_locked_until` | B-Tree (Partial) | B-tree index on `(locked_until) WHERE locked_until IS NOT NULL` |
| `idx_telemetry_actor_email` | B-Tree (Partial) | B-tree index on `(actor_email) WHERE actor_email IS NOT NULL` |
| `ck_accounts_email_format` | CHECK Constraint | Regex validation for RFC-compliant email formatting |
| `ck_locations_coord_range` | CHECK Constraint | Restricts longitude to `[-180.0, 180.0]` and latitude to `[-90.0, 90.0]` |
| `ck_locations_coord_valid` | CHECK Constraint | Validates OGC Simple Features point geometry (`ST_IsValid`) |
| `ck_locations_restricted_centroid` | CHECK Constraint | Enforces that restricted destinations must carry an approved `public_approximate_display_name` |
| `ck_security_no_system_account` | CHECK Constraint | Prevents root system account from acquiring security credentials |
| `ck_profiles_no_system_account` | CHECK Constraint | Prevents root system account from acquiring tourist profiles |
| `ck_saved_no_system_account` | CHECK Constraint | Prevents root system account from saving destination bookmarks |
| `trg_guard_system_account` | Trigger | Protects all 8 identity fields of root system account and blocks deletion |
| `trg_guard_no_system_credentials` | Trigger | Cross-table trigger preventing any `type = 'system'` account from having credentials |
| `trg_guard_no_system_profiles` | Trigger | Cross-table trigger preventing any `type = 'system'` account from having tourist profiles |
| `trg_guard_no_system_bookmarks` | Trigger | Cross-table trigger preventing any `type = 'system'` account from saving destinations |
| `trg_guard_system_type_transition` | Trigger | Prevents non-system accounts from transitioning to `system` if child records exist |
| `trg_audit_logs_immutable` | Trigger | Enforces append-only immutability on `audit_logs` (blocks `UPDATE` and `DELETE`) |
| `v_public_destination_locations` | View | Projects sanitized 3-Tier public coordinates and masked locality names |
| `v_domain_audit_logs` | View | Reconstructs composite domain audit log model with decrypted telemetry |
| `app_user`, `admin_service_role`, `audit_maintenance_role` | Roles & Privileges | Enforces least-privilege role-based access control at the engine level |

---

## 5. Local Setup via Docker Compose

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

---

## 6. Environment Configuration

Copy the template from `.env.example` to `.env`:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/mytravelroad?schema=public&connection_limit=10"
DIRECT_URL="postgresql://postgres:postgrespassword@localhost:5432/mytravelroad?schema=public"
NODE_ENV="development"
```

---

## 7. Migration & Seeding Execution

```bash
# 1. Generate Prisma Client
npm run db:generate

# 2. Deploy version-controlled migrations
npm run db:migrate

# 3. Seed Root System Account & Baseline Taxonomy
npm run db:seed
```

---

## 8. Verification & Testing

### 1. Automated Database Helper Unit Tests
```bash
npm run test:db
```
*Validates coordinate bounds, NaN/Infinity rejection, bounding box envelopes, antimeridian crossing, and parameterized Prisma.sql builders.*

### 2. Standalone SQL Test Suite (Stop-On-Error Guaranteed)
When connected to a PostgreSQL 16 + PostGIS 3.4 database, execute the automated verification suite using either the direct `psql` command or the npm runner:
```bash
# Direct psql invocation with strict error stop:
psql -v ON_ERROR_STOP=1 -U postgres -d mytravelroad -f tests/sql/verification_tests.sql

# Or using the npm runner script:
npm run test:sql
```
*Tests all 11 requirements: extensions, 15 tables, 2 views, GiST indexes, root account immutability, child table guards, account-type transition checks, audit log immutability, 3-tier coordinate privacy, and spatial proximity queries. Any assertion failure immediately aborts the transaction and exits with a non-zero status code.*

### 3. Prisma Schema Drift Check
```bash
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma
```
*Verifies 0 drift across tables, columns, unique constraints, and foreign key relations.*

---

## 9. TypeScript Application Integration

```typescript
import { prisma, createPointGeographySql, createBoundingBoxWhereClause, BoundingBox } from "@/lib/db";

// Spatial bounding box query using parameterized Prisma tagged templates
const box: BoundingBox = { minLon: 75.8, minLat: 10.8, maxLon: 76.4, maxLat: 11.4 };
const whereClause = createBoundingBoxWhereClause(box);

const nearbyLocations = await prisma.$queryRaw`
  SELECT
    destination_id,
    public_locality_name,
    is_restricted,
    ST_AsGeoJSON(public_coordinates) AS geojson
  FROM v_public_destination_locations dl
  WHERE ${whereClause}
  LIMIT 50;
`;
```
