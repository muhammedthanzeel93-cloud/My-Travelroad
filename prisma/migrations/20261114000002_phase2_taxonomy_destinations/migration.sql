-- ==============================================================================
-- Migration: 20261114000002_phase2_taxonomy_destinations
-- Stage A: Phase 2 Taxonomy, Destinations, PostGIS Geography & Spatial Indexing
-- Reference: docs/architecture/database-architecture.md (Sections 3.4 - 3.9)
-- ==============================================================================

-- 1. Create `destination_categories` Table (Section 3.4)
CREATE TABLE destination_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    short_label VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    icon_key VARCHAR(50) NOT NULL,
    parent_id UUID NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id)
        REFERENCES destination_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_categories_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT ck_categories_status CHECK (status IN ('active', 'inactive', 'archived')),
    CONSTRAINT ck_categories_no_self_parent CHECK (id <> parent_id)
);

CREATE INDEX idx_categories_parent_id ON destination_categories (parent_id);
CREATE INDEX idx_categories_status_order ON destination_categories (status, display_order);

-- 2. Create `destinations` Table (Section 3.5)
CREATE TABLE destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(120) NOT NULL,
    title VARCHAR(200) NOT NULL,
    short_description VARCHAR(500) NOT NULL,
    full_description TEXT NOT NULL,
    primary_category_id UUID NOT NULL,
    publication_status VARCHAR(32) NOT NULL DEFAULT 'draft',
    featured_rank INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ NULL,

    CONSTRAINT uq_destinations_slug UNIQUE (slug),
    CONSTRAINT fk_destinations_primary_category FOREIGN KEY (primary_category_id)
        REFERENCES destination_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_destinations_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT ck_destinations_publication_status CHECK (
        publication_status IN ('draft', 'submitted', 'in_review', 'published', 'archived', 'suspended')
    ),
    CONSTRAINT ck_destinations_featured_rank CHECK (featured_rank IS NULL OR featured_rank > 0)
);

CREATE INDEX idx_destinations_primary_cat ON destinations (primary_category_id);
CREATE INDEX idx_destinations_status ON destinations (publication_status);
CREATE INDEX idx_destinations_published_featured ON destinations (publication_status, featured_rank)
    WHERE publication_status = 'published' AND featured_rank IS NOT NULL;
CREATE INDEX idx_destinations_created_at ON destinations (created_at DESC);

-- 3. Create `destination_secondary_categories` Table (Section 3.6)
CREATE TABLE destination_secondary_categories (
    destination_id UUID NOT NULL,
    category_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (destination_id, category_id),
    CONSTRAINT fk_sec_cat_destination FOREIGN KEY (destination_id)
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sec_cat_category FOREIGN KEY (category_id)
        REFERENCES destination_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_sec_cat_category ON destination_secondary_categories (category_id);

-- 4. Create `destination_locations` Table (Section 3.7)
CREATE TABLE destination_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    altitude_meters NUMERIC(7,2) NULL,
    accuracy_meters NUMERIC(6,2) NULL,
    is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
    restriction_reason VARCHAR(50) NULL,
    public_approximate_centroid GEOGRAPHY(Point, 4326) NULL,
    public_approximate_display_name VARCHAR(150) NULL,
    formatted_address TEXT NOT NULL,
    locality VARCHAR(120) NULL,
    taluk_or_subdivision VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state_or_province VARCHAR(100) NOT NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'IN',
    postal_code VARCHAR(20) NULL,
    nearest_transit_hub JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_locations_destination_id UNIQUE (destination_id),
    CONSTRAINT fk_locations_destination FOREIGN KEY (destination_id)
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_locations_country_code CHECK (length(country_code) = 2 AND country_code = upper(country_code)),
    CONSTRAINT ck_locations_coord_range CHECK (
        ST_X(coordinates::geometry) >= -180.0 AND ST_X(coordinates::geometry) <= 180.0 AND
        ST_Y(coordinates::geometry) >= -90.0 AND ST_Y(coordinates::geometry) <= 90.0
    ),
    CONSTRAINT ck_locations_coord_valid CHECK (
        ST_IsValid(coordinates::geometry)
    ),
    CONSTRAINT ck_locations_restriction_reason CHECK (
        restriction_reason IS NULL OR restriction_reason IN (
            'wildlife_protection', 'tribal_settlement', 'defense_boundary', 'hazardous_terrain', 'private_property'
        )
    ),
    CONSTRAINT ck_locations_restricted_centroid CHECK (
        is_restricted = FALSE OR public_approximate_display_name IS NOT NULL
    )
);

-- PostGIS GiST Spatial Indexes
CREATE INDEX idx_locations_coordinates ON destination_locations USING GIST (coordinates);
CREATE INDEX idx_locations_public_centroid ON destination_locations USING GIST (public_approximate_centroid)
    WHERE public_approximate_centroid IS NOT NULL;
CREATE INDEX idx_locations_public_coord_expr ON destination_locations USING GIST (
    (CASE WHEN is_restricted THEN public_approximate_centroid ELSE coordinates END)
);

-- B-Tree Administrative Hierarchy Indexes
CREATE INDEX idx_locations_district ON destination_locations (district);
CREATE INDEX idx_locations_state_country ON destination_locations (country_code, state_or_province, district);
CREATE INDEX idx_locations_taluk ON destination_locations (taluk_or_subdivision);
CREATE INDEX idx_locations_restricted ON destination_locations (is_restricted);

-- 5. Create `destination_media` Table (Section 3.8)
CREATE TABLE destination_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'image',
    url TEXT NOT NULL,
    thumbnail_url TEXT NULL,
    alt_text VARCHAR(255) NOT NULL,
    caption TEXT NULL,
    attribution VARCHAR(200) NULL,
    license VARCHAR(50) NOT NULL DEFAULT 'cc_by',
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_media_destination FOREIGN KEY (destination_id)
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_media_type CHECK (type IN ('image', 'video', 'panorama_360')),
    CONSTRAINT ck_media_status CHECK (status IN ('pending_review', 'approved', 'rejected')),
    CONSTRAINT ck_media_license CHECK (license IN (
        'public_domain', 'cc_by', 'cc_by_sa', 'official_department_press', 'contributor_licensed', 'proprietary'
    ))
);

-- Partial unique index: Only one primary cover media item per destination
CREATE UNIQUE INDEX idx_media_single_cover ON destination_media (destination_id) WHERE is_cover = TRUE;
CREATE INDEX idx_media_destination_order ON destination_media (destination_id, display_order);
CREATE INDEX idx_media_status ON destination_media (status);

-- 6. Create `destination_opening_hours` Table (Section 3.9)
CREATE TABLE destination_opening_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'always_open',
    weekly_schedule JSONB NULL,
    seasonal_notes TEXT NULL,
    entry_fee_policy VARCHAR(32) NOT NULL DEFAULT 'free',
    fee_structure JSONB NULL,
    advisory_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_opening_hours_destination UNIQUE (destination_id),
    CONSTRAINT fk_opening_hours_destination FOREIGN KEY (destination_id)
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_opening_hours_type CHECK (type IN ('always_open', 'seasonal', 'scheduled', 'temporarily_closed')),
    CONSTRAINT ck_opening_hours_fee_policy CHECK (entry_fee_policy IN ('free', 'paid', 'partially_paid', 'restricted_permit'))
);

CREATE INDEX idx_opening_hours_fee_policy ON destination_opening_hours (entry_fee_policy);
