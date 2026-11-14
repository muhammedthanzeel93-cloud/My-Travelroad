-- ==============================================================================
-- Migration: 20261114000003_phase3_verification_audit
-- Stage A: Phase 3 Verification, Wishlists, Audit Ledger, Views & Role Separation
-- ==============================================================================

-- 1. Create `destination_verifications` Table
CREATE TABLE destination_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL,
    overall_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
    last_verified_at TIMESTAMPTZ NULL,
    assigned_curator_account_id UUID NULL,
    recheck_required_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_verifications_destination_id UNIQUE (destination_id),
    CONSTRAINT fk_verifications_destination FOREIGN KEY (destination_id) 
        REFERENCES destinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_verifications_curator FOREIGN KEY (assigned_curator_account_id) 
        REFERENCES accounts(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT ck_verifications_status CHECK (
        overall_status IN ('unverified', 'partially_verified', 'verified', 'flagged_for_review')
    )
);

CREATE INDEX idx_verifications_status ON destination_verifications (overall_status);
CREATE INDEX idx_verifications_recheck ON destination_verifications (recheck_required_at) WHERE recheck_required_at IS NOT NULL;

-- 2. Create `verification_evidence` Table
CREATE TABLE verification_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL,
    evidence_type VARCHAR(32) NOT NULL,
    url TEXT NOT NULL,
    description VARCHAR(500) NOT NULL,
    submitted_by UUID NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_evidence_verification FOREIGN KEY (verification_id) 
        REFERENCES destination_verifications(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_evidence_submitted_by FOREIGN KEY (submitted_by) 
        REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_evidence_type CHECK (
        evidence_type IN ('official_document', 'field_photo', 'gps_track', 'authority_statement', 'community_corroboration')
    )
);

CREATE INDEX idx_evidence_verification_id ON verification_evidence (verification_id);
CREATE INDEX idx_evidence_submitted_by ON verification_evidence (submitted_by);

-- 3. Create `verification_records` Table
CREATE TABLE verification_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL,
    field VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    verified_by UUID NOT NULL,
    confidence_level VARCHAR(32) NOT NULL,
    notes TEXT NULL,
    valid_until TIMESTAMPTZ NULL,
    verified_value_snapshot_hash VARCHAR(64) NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ver_records_verification FOREIGN KEY (verification_id) 
        REFERENCES destination_verifications(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ver_records_verifier FOREIGN KEY (verified_by) 
        REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_ver_records_status CHECK (status IN ('verified', 'unverified', 'disputed', 'needs_update')),
    CONSTRAINT ck_ver_records_confidence CHECK (confidence_level IN ('high', 'medium', 'low'))
);

CREATE INDEX idx_ver_records_field ON verification_records (verification_id, field);
CREATE INDEX idx_ver_records_verifier ON verification_records (verified_by);
CREATE INDEX idx_ver_records_timestamp ON verification_records (timestamp DESC);

-- 4. Create `saved_destinations` Table
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

-- 6. Create `audit_logs` Table (Core Immutable Ledger)
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

-- 7. Create `audit_log_telemetry` Table (Auxiliary Privacy Extension)
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

    CONSTRAINT fk_telemetry_audit_log FOREIGN KEY (audit_log_id) 
        REFERENCES audit_logs(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_telemetry_retention ON audit_log_telemetry (retention_expires_at) WHERE is_anonymized = FALSE;
CREATE INDEX idx_telemetry_anonymized ON audit_log_telemetry (is_anonymized);

-- 8. Create Secure Projections / Views
CREATE OR REPLACE VIEW v_public_destination_locations AS
SELECT 
    dl.id,
    dl.destination_id,
    CASE 
        WHEN NOT dl.is_restricted THEN dl.coordinates
        ELSE dl.public_approximate_centroid
    END AS public_coordinates,
    CASE 
        WHEN NOT dl.is_restricted THEN dl.locality
        ELSE dl.public_approximate_display_name
    END AS display_locality,
    dl.sub_district,
    dl.district,
    dl.state,
    dl.country,
    CASE 
        WHEN NOT dl.is_restricted THEN dl.postal_code
        ELSE NULL
    END AS postal_code,
    dl.is_restricted,
    dl.public_access_information,
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

-- 9. Provision Database Roles & Privileges
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

-- Standard Web Application Role Privileges
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
