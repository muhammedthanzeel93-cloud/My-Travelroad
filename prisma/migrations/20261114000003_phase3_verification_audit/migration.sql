-- ==============================================================================
-- Migration: 20261114000003_phase3_verification_audit
-- Stage A: Phase 3 Verification, Wishlists, Audit Ledger, Views & Role Separation
-- Reference: docs/architecture/database-architecture.md (Sections 3.10 - 3.15, 4.2, 10, 11)
-- ==============================================================================

-- 1. Create `destination_verifications` Table (Section 3.10)
CREATE TABLE destination_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL,
    overall_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
    assigned_curator_id UUID NULL,
    last_audited_at TIMESTAMPTZ NULL,
    next_audit_due_at TIMESTAMPTZ NULL,
    field_statuses JSONB NOT NULL DEFAULT '{}',
    curator_queue_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_verifications_destination UNIQUE (destination_id),
    CONSTRAINT fk_verifications_destination FOREIGN KEY (destination_id)
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_verifications_curator FOREIGN KEY (assigned_curator_id)
        REFERENCES accounts(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT ck_verifications_status CHECK (
        overall_status IN ('unverified', 'in_review', 'needs_update', 'partially_verified', 'verified', 'flagged')
    )
);

CREATE INDEX idx_verifications_status ON destination_verifications (overall_status);
CREATE INDEX idx_verifications_curator ON destination_verifications (assigned_curator_id) WHERE assigned_curator_id IS NOT NULL;
CREATE INDEX idx_verifications_next_due ON destination_verifications (next_audit_due_at) WHERE next_audit_due_at IS NOT NULL;

-- 2. Create `verification_evidence` Table (Section 3.11)
CREATE TABLE verification_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL,
    evidence_type VARCHAR(50) NOT NULL,
    document_url TEXT NULL,
    source_organization VARCHAR(150) NOT NULL,
    official_reference_code VARCHAR(100) NULL,
    notes TEXT NULL,
    submitted_by UUID NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_evidence_verification FOREIGN KEY (verification_id)
        REFERENCES destination_verifications(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_evidence_submitter FOREIGN KEY (submitted_by)
        REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_evidence_type CHECK (evidence_type IN (
        'government_gazette', 'department_circular', 'official_website',
        'on_site_gps_track', 'photographic_proof', 'curator_affidavit', 'field_survey_sheet'
    ))
);

CREATE INDEX idx_evidence_verification_id ON verification_evidence (verification_id);
CREATE INDEX idx_evidence_type ON verification_evidence (evidence_type);

-- 3. Create `verification_records` Table (Section 3.12)
CREATE TABLE verification_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL,
    destination_id UUID NOT NULL,
    field VARCHAR(50) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'unverified',
    verified_by UUID NOT NULL,
    evidence_id UUID NULL,
    verified_value_snapshot_hash VARCHAR(64) NULL,
    confidence_level VARCHAR(50) NOT NULL,
    notes TEXT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ NULL,

    CONSTRAINT fk_records_verification FOREIGN KEY (verification_id)
        REFERENCES destination_verifications(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_records_destination FOREIGN KEY (destination_id)
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_records_verifier FOREIGN KEY (verified_by)
        REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_records_evidence FOREIGN KEY (evidence_id)
        REFERENCES verification_evidence(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT ck_records_field CHECK (field IN (
        'location_coordinates', 'opening_hours', 'entry_fees', 'safety_advisories',
        'accessibility', 'contact_info', 'historical_facts', 'governing_authority'
    )),
    CONSTRAINT ck_records_status CHECK (status IN ('verified', 'disputed', 'needs_update', 'unverified')),
    CONSTRAINT ck_records_confidence CHECK (confidence_level IN (
        'official_authority', 'on_site_inspection', 'documentary_cross_reference', 'community_consensus'
    ))
);

CREATE INDEX idx_records_dest_field ON verification_records (destination_id, field);
CREATE INDEX idx_records_verification_id ON verification_records (verification_id);
CREATE INDEX idx_records_timestamp ON verification_records (timestamp DESC);

-- 4. Create `saved_destinations` Table (Section 3.13)
CREATE TABLE saved_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    destination_id UUID NOT NULL,
    collection_name VARCHAR(100) NULL,
    personal_notes TEXT NULL,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_saved_destinations_account_dest UNIQUE (account_id, destination_id),
    CONSTRAINT fk_saved_account FOREIGN KEY (account_id)
        REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_saved_destination FOREIGN KEY (destination_id)
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_saved_no_system_account CHECK (account_id != '00000000-0000-4000-8000-000000000001'::uuid)
);

CREATE INDEX idx_saved_account_id ON saved_destinations (account_id);
CREATE INDEX idx_saved_destination_id ON saved_destinations (destination_id);
CREATE INDEX idx_saved_collection ON saved_destinations (account_id, collection_name) WHERE collection_name IS NOT NULL;

CREATE TRIGGER trg_guard_no_system_bookmarks
BEFORE INSERT OR UPDATE ON saved_destinations
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_system_account_child_records();

-- 5. Attach Transition Guard Trigger to `accounts`
-- All three protected child tables now exist.
-- Same-event BEFORE ROW triggers run alphabetically:
-- 1. trg_guard_system_account ('a' < 't') protects the root system account.
-- 2. trg_guard_system_type_transition checks child absence under READ COMMITTED.
CREATE TRIGGER trg_guard_system_type_transition
BEFORE UPDATE OF type ON accounts
FOR EACH ROW
EXECUTE FUNCTION trg_reject_system_type_with_children();

-- 6. Create `audit_logs` Table (Section 3.14 - Core Immutable Ledger)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_account_id UUID NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_account_id)
        REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_audit_actor ON audit_logs (actor_account_id);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs (action);

-- Audit Log Immutability Trigger
CREATE OR REPLACE FUNCTION trg_prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'FATAL: audit_logs is append-only and strictly immutable. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION trg_prevent_audit_log_mutation();

-- 7. Create `audit_log_telemetry` Table (Section 3.15 - Auxiliary Privacy Extension)
CREATE TABLE audit_log_telemetry (
    audit_log_id UUID PRIMARY KEY,
    actor_email VARCHAR(255) NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    previous_state_snapshot JSONB NULL,
    new_state_snapshot JSONB NULL,
    context_notes TEXT NULL,
    retention_expires_at TIMESTAMPTZ NOT NULL,
    is_anonymized BOOLEAN NOT NULL DEFAULT FALSE,
    anonymized_at TIMESTAMPTZ NULL,

    CONSTRAINT fk_telemetry_audit FOREIGN KEY (audit_log_id)
        REFERENCES audit_logs(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_telemetry_expiry ON audit_log_telemetry (retention_expires_at) WHERE is_anonymized = FALSE;
CREATE INDEX idx_telemetry_actor_email ON audit_log_telemetry (actor_email) WHERE actor_email IS NOT NULL;

-- 8. Create Secure Projections / Views (Sections 4.2 & 10)
-- 3-Tier Publication Policy for Public Coordinate Privacy:
-- Tier 1 & 2: Restricted destinations with an approved centroid project public_approximate_centroid.
-- Tier 3: Restricted destinations without an approved centroid project NULL (complete suppression).
-- Unrestricted: Non-restricted destinations project exact coordinates.
-- Raw coordinates of restricted destinations are never exposed via this view.
CREATE OR REPLACE VIEW v_public_destination_locations AS
SELECT
    dl.destination_id,
    dl.is_restricted,
    dl.restriction_reason,
    -- Projected coordinate: returns centroid if restricted, exact if public, or NULL if suppressed
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

CREATE OR REPLACE VIEW v_domain_audit_logs AS
SELECT
    al.id,
    al.actor_account_id,
    al.actor_role,
    al.action,
    al.entity_type,
    al.entity_id,
    al.timestamp,
    alt.actor_email,
    alt.ip_address,
    alt.user_agent,
    alt.previous_state_snapshot,
    alt.new_state_snapshot,
    alt.context_notes,
    alt.retention_expires_at,
    alt.is_anonymized,
    alt.anonymized_at
FROM audit_logs al
LEFT JOIN audit_log_telemetry alt ON alt.audit_log_id = al.id;

-- 9. Provision Database Roles & Privileges (Section 11)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_service_role') THEN
        CREATE ROLE admin_service_role;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_maintenance_role') THEN
        CREATE ROLE audit_maintenance_role;
    END IF;
END;
$$;

-- Standard Web Application Role Privileges (Least Privilege)
-- Note: Raw destination_locations is explicitly revoked; app_user can only access v_public_destination_locations
GRANT SELECT ON destination_categories, destinations, destination_secondary_categories,
                destination_media, destination_opening_hours, destination_verifications,
                verification_evidence, verification_records TO app_user;
GRANT SELECT ON v_public_destination_locations TO app_user;
REVOKE ALL ON destination_locations FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_destinations TO app_user;
GRANT SELECT, INSERT, UPDATE ON tourist_profiles TO app_user;
GRANT SELECT ON accounts TO app_user;
GRANT UPDATE (email, phone, status, last_login_at, updated_at) ON accounts TO app_user;
REVOKE UPDATE (role, type) ON accounts FROM app_user;

-- Administrative Service Role Privileges
GRANT ALL ON accounts, account_security_credentials, tourist_profiles,
             destination_categories, destinations, destination_secondary_categories,
             destination_locations, destination_media, destination_opening_hours,
             destination_verifications, verification_evidence, verification_records,
             saved_destinations TO admin_service_role;
GRANT SELECT, INSERT ON audit_logs TO admin_service_role;
GRANT SELECT, INSERT, UPDATE ON audit_log_telemetry TO admin_service_role;
REVOKE UPDATE, DELETE ON audit_logs FROM admin_service_role;

-- Telemetry Maintenance Role Privileges
GRANT SELECT, INSERT ON audit_logs TO audit_maintenance_role;
GRANT SELECT, UPDATE, DELETE ON audit_log_telemetry TO audit_maintenance_role;
REVOKE UPDATE, DELETE ON audit_logs FROM audit_maintenance_role;
