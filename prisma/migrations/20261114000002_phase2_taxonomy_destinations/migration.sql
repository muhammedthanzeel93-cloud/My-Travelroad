-- ==============================================================================
-- Migration: 20261114000002_phase2_taxonomy_destinations
-- Stage A: Phase 2 Taxonomy, Destinations, PostGIS Geography & Spatial Indexing
-- ==============================================================================

-- 1. Create `destination_categories` Table
CREATE TABLE destination_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    parent_id UUID NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    icon_name VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) 
        REFERENCES destination_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_categories_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX idx_categories_parent_id ON destination_categories (parent_id);
CREATE INDEX idx_categories_display_order ON destination_categories (display_order);

-- 2. Create `destinations` Table
CREATE TABLE destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    short_description VARCHAR(500) NOT NULL,
    long_description TEXT NOT NULL,
    primary_category_id UUID NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    publication_status VARCHAR(32) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ NULL,
    search_vector tsvector NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_destinations_slug UNIQUE (slug),
    CONSTRAINT fk_destinations_primary_category FOREIGN KEY (primary_category_id) 
        REFERENCES destination_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_destinations_status CHECK (publication_status IN ('draft', 'review_pending', 'published', 'archived')),
    CONSTRAINT ck_destinations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT ck_destinations_published_at_consistency CHECK (
        (publication_status = 'published' AND published_at IS NOT NULL) OR
        (publication_status != 'published')
    )
);

CREATE INDEX idx_destinations_category ON destinations (primary_category_id);
CREATE INDEX idx_destinations_status ON destinations (publication_status);
CREATE INDEX idx_destinations_published_at ON destinations (published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX idx_destinations_tags ON destinations USING GIN (tags);
CREATE INDEX idx_destinations_search_vector ON destinations USING GIN (search_vector);

-- Search Vector Auto-Population Trigger
CREATE OR REPLACE FUNCTION trg_destinations_update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.short_description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.long_description, '')), 'C') ||
        setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_destinations_search_vector_update
BEFORE INSERT OR UPDATE OF title, short_description, long_description, tags ON destinations
FOR EACH ROW
EXECUTE FUNCTION trg_destinations_update_search_vector();

-- 3. Create `destination_secondary_categories` Table
CREATE TABLE destination_secondary_categories (
    destination_id UUID NOT NULL,
    category_id UUID NOT NULL,

    PRIMARY KEY (destination_id, category_id),
    CONSTRAINT fk_sec_cat_destination FOREIGN KEY (destination_id) 
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sec_cat_category FOREIGN KEY (category_id) 
        REFERENCES destination_categories(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_dest_sec_cat_cat ON destination_secondary_categories (category_id);

-- 4. Create `destination_locations` Table (PostGIS GEOGRAPHY & Privacy Invariants)
CREATE TABLE destination_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    locality VARCHAR(120) NOT NULL,
    sub_district VARCHAR(120) NOT NULL,
    district VARCHAR(120) NOT NULL,
    state VARCHAR(120) NOT NULL DEFAULT 'Kerala',
    country VARCHAR(120) NOT NULL DEFAULT 'India',
    postal_code VARCHAR(20) NULL,
    is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
    public_approximate_centroid GEOGRAPHY(Point, 4326) NULL,
    public_approximate_display_name VARCHAR(200) NULL,
    public_access_information TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_locations_destination_id UNIQUE (destination_id),
    CONSTRAINT fk_locations_destination FOREIGN KEY (destination_id) 
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_locations_coord_range CHECK (
        ST_X(coordinates::geometry) >= -180.0 AND ST_X(coordinates::geometry) <= 180.0 AND
        ST_Y(coordinates::geometry) >= -90.0 AND ST_Y(coordinates::geometry) <= 90.0
    ),
    CONSTRAINT ck_locations_coord_valid CHECK (ST_IsValid(coordinates::geometry)),
    CONSTRAINT ck_locations_restricted_centroid_consistency CHECK (
        (is_restricted = FALSE) OR 
        (is_restricted = TRUE AND public_approximate_display_name IS NOT NULL)
    )
);

CREATE INDEX idx_locations_coordinates ON destination_locations USING GIST (coordinates);
CREATE INDEX idx_locations_district ON destination_locations (district);
CREATE INDEX idx_locations_restricted ON destination_locations (is_restricted);

-- Spatial Expression GiST Index for View Inlining
CREATE INDEX idx_locations_public_coord_expr ON destination_locations USING GIST (
    (CASE 
        WHEN NOT is_restricted THEN coordinates
        ELSE public_approximate_centroid
    END)
) WHERE (
    NOT is_restricted OR public_approximate_centroid IS NOT NULL
);

-- 5. Create `destination_media` Table
CREATE TABLE destination_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT NULL,
    caption VARCHAR(255) NULL,
    alt_text VARCHAR(255) NOT NULL,
    media_type VARCHAR(32) NOT NULL,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    attribution_name VARCHAR(150) NULL,
    attribution_license VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_media_destination FOREIGN KEY (destination_id) 
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_media_type CHECK (media_type IN ('image', 'video_external', 'document')),
    CONSTRAINT ck_media_sort_order CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX uq_media_destination_single_cover 
    ON destination_media (destination_id) 
    WHERE is_cover = TRUE;

CREATE INDEX idx_media_destination_id ON destination_media (destination_id);
CREATE INDEX idx_media_sort_order ON destination_media (sort_order);

-- 6. Create `destination_opening_hours` Table
CREATE TABLE destination_opening_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL,
    weekly_schedule JSONB NOT NULL,
    fee_structure JSONB NOT NULL,
    seasonal_notes TEXT NULL,
    is_temporarily_closed BOOLEAN NOT NULL DEFAULT FALSE,
    closure_reason VARCHAR(255) NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_opening_hours_destination_id UNIQUE (destination_id),
    CONSTRAINT fk_opening_hours_destination FOREIGN KEY (destination_id) 
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_opening_weekly_schedule_type CHECK (jsonb_typeof(weekly_schedule) = 'object'),
    CONSTRAINT ck_opening_fee_structure_type CHECK (jsonb_typeof(fee_structure) = 'object'),
    CONSTRAINT ck_opening_temporary_closure_consistency CHECK (
        (is_temporarily_closed = FALSE) OR 
        (is_temporarily_closed = TRUE AND closure_reason IS NOT NULL)
    )
);
