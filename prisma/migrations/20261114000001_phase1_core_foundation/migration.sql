-- ==============================================================================
-- Migration: 20261114000001_phase1_core_foundation
-- Stage A: Phase 1 Core Extensions, Identity Foundation & Security Safeguards
-- ==============================================================================

-- 1. Enable Core PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Create `accounts` Table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_verification',
    type VARCHAR(32) NOT NULL DEFAULT 'individual',
    role VARCHAR(32) NOT NULL DEFAULT 'traveler',
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_accounts_email UNIQUE (email),
    CONSTRAINT uq_accounts_phone UNIQUE (phone),
    CONSTRAINT ck_accounts_status CHECK (status IN ('active', 'suspended', 'pending_verification', 'deactivated')),
    CONSTRAINT ck_accounts_type CHECK (type IN ('individual', 'business', 'system')),
    CONSTRAINT ck_accounts_role CHECK (role IN ('traveler', 'contributor', 'curator', 'moderator', 'super_admin')),
    CONSTRAINT ck_accounts_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE UNIQUE INDEX idx_accounts_email_lower ON accounts (LOWER(email));
CREATE INDEX idx_accounts_status ON accounts (status);
CREATE INDEX idx_accounts_role ON accounts (role);

-- 3. Idempotent Provisioning of Root System Account (00000000-0000-4000-8000-000000000001)
DO $$
DECLARE
    v_existing_by_id RECORD;
    v_existing_by_email RECORD;
BEGIN
    SELECT * INTO v_existing_by_id FROM accounts WHERE id = '00000000-0000-4000-8000-000000000001'::uuid;
    SELECT * INTO v_existing_by_email FROM accounts WHERE LOWER(email) = LOWER('system-internal@mytravelroad.local');

    IF v_existing_by_id.id IS NOT NULL THEN
        IF v_existing_by_id.email != 'system-internal@mytravelroad.local' 
           OR v_existing_by_id.type != 'system' 
           OR v_existing_by_id.role != 'super_admin' 
           OR v_existing_by_id.status != 'active'
           OR v_existing_by_id.phone IS NOT NULL
           OR v_existing_by_id.email_verified != TRUE
           OR v_existing_by_id.phone_verified != FALSE THEN
            RAISE EXCEPTION 'MIGRATION CONFLICT: Reserved root system UUID 00000000-0000-4000-8000-000000000001 is already occupied by a conflicting record (email: %, type: %, role: %, status: %). Manual DBA resolution required.', 
                v_existing_by_id.email, v_existing_by_id.type, v_existing_by_id.role, v_existing_by_id.status;
        END IF;
    END IF;

    IF v_existing_by_email.id IS NOT NULL AND v_existing_by_email.id != '00000000-0000-4000-8000-000000000001'::uuid THEN
        RAISE EXCEPTION 'MIGRATION CONFLICT: Reserved root system email system-internal@mytravelroad.local is occupied by conflicting UUID %. Manual DBA resolution required.', 
            v_existing_by_email.id;
    END IF;

    IF v_existing_by_id.id IS NULL THEN
        INSERT INTO accounts (
            id, email, email_verified, phone, phone_verified, status, type, role, created_at, updated_at
        ) VALUES (
            '00000000-0000-4000-8000-000000000001'::uuid,
            'system-internal@mytravelroad.local',
            TRUE,
            NULL,
            FALSE,
            'active',
            'system',
            'super_admin',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
    END IF;
END;
$$;

-- 4. Protection Trigger Guard for Root System Account
CREATE OR REPLACE FUNCTION trg_protect_system_account()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE' AND OLD.id = '00000000-0000-4000-8000-000000000001'::uuid) THEN
        RAISE EXCEPTION 'FATAL: Root system account cannot be deleted.';
    END IF;

    IF (TG_OP = 'UPDATE' AND OLD.id = '00000000-0000-4000-8000-000000000001'::uuid) THEN
        IF NEW.id != OLD.id THEN
            RAISE EXCEPTION 'FATAL: Root system account id is immutable.';
        END IF;
        IF NEW.email != 'system-internal@mytravelroad.local' THEN
            RAISE EXCEPTION 'FATAL: Root system account email is immutable.';
        END IF;
        IF NEW.phone IS NOT NULL THEN
            RAISE EXCEPTION 'FATAL: Root system account phone must remain NULL.';
        END IF;
        IF NEW.email_verified != TRUE THEN
            RAISE EXCEPTION 'FATAL: Root system account email_verified must remain TRUE.';
        END IF;
        IF NEW.phone_verified != FALSE THEN
            RAISE EXCEPTION 'FATAL: Root system account phone_verified must remain FALSE.';
        END IF;
        IF NEW.status != 'active' THEN
            RAISE EXCEPTION 'FATAL: Root system account status must remain active.';
        END IF;
        IF NEW.type != 'system' THEN
            RAISE EXCEPTION 'FATAL: Root system account type must remain system.';
        END IF;
        IF NEW.role != 'super_admin' THEN
            RAISE EXCEPTION 'FATAL: Root system account role must remain super_admin.';
        END IF;
        IF NEW.created_at != OLD.created_at THEN
            RAISE EXCEPTION 'FATAL: Root system account created_at is immutable.';
        END IF;
        IF NEW.last_login_at IS NOT NULL THEN
            RAISE EXCEPTION 'FATAL: Root system account cannot record interactive logins.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_system_account
BEFORE UPDATE OR DELETE ON accounts
FOR EACH ROW
WHEN (OLD.id = '00000000-0000-4000-8000-000000000001'::uuid)
EXECUTE FUNCTION trg_protect_system_account();

-- 5. Generalized Child-Record Prevention Trigger Function
CREATE OR REPLACE FUNCTION trg_prevent_system_account_child_records()
RETURNS TRIGGER AS $$
DECLARE
    v_account_type VARCHAR(32);
BEGIN
    SELECT type INTO v_account_type
      FROM accounts
     WHERE id = NEW.account_id
     FOR UPDATE;
    IF v_account_type = 'system' THEN
        RAISE EXCEPTION 'INTEGRITY VIOLATION: System accounts (type = system) are strictly barred from possessing security credentials, tourist profiles, or saved destinations.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Transition Guard Function (Attached in Phase 3 after child tables exist)
CREATE OR REPLACE FUNCTION trg_reject_system_type_with_children()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.type IS DISTINCT FROM 'system' AND NEW.type = 'system' THEN
        IF current_setting('transaction_isolation') <> 'read committed' THEN
            RAISE EXCEPTION
                'Account type transition to system requires READ COMMITTED isolation; retry in a READ COMMITTED transaction.';
        END IF;
        IF EXISTS (SELECT 1 FROM account_security_credentials WHERE account_id = NEW.id)
           OR EXISTS (SELECT 1 FROM tourist_profiles WHERE account_id = NEW.id)
           OR EXISTS (SELECT 1 FROM saved_destinations WHERE account_id = NEW.id) THEN
            RAISE EXCEPTION
                'INTEGRITY VIOLATION: Account % cannot become type system while credentials, a tourist profile, or saved destinations exist.',
                NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create `account_security_credentials` Table
CREATE TABLE account_security_credentials (
    account_id UUID PRIMARY KEY,
    password_hash VARCHAR(255) NULL,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret_encrypted TEXT NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    password_changed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_security_account FOREIGN KEY (account_id) 
        REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_security_failed_attempts CHECK (failed_login_attempts >= 0),
    CONSTRAINT ck_security_no_system_account CHECK (account_id != '00000000-0000-4000-8000-000000000001'::uuid)
);

CREATE INDEX idx_security_locked_until ON account_security_credentials (locked_until) WHERE locked_until IS NOT NULL;

CREATE TRIGGER trg_guard_no_system_credentials
BEFORE INSERT OR UPDATE ON account_security_credentials
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_system_account_child_records();

-- 8. Create `tourist_profiles` Table
CREATE TABLE tourist_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    handle VARCHAR(50) NOT NULL,
    avatar_url TEXT NULL,
    bio TEXT NULL,
    home_region VARCHAR(120) NULL,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    travel_preferences TEXT[] NOT NULL DEFAULT '{}',
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_profiles_account_id UNIQUE (account_id),
    CONSTRAINT uq_profiles_handle UNIQUE (handle),
    CONSTRAINT fk_profiles_account FOREIGN KEY (account_id) 
        REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_profiles_handle_format CHECK (handle ~ '^[a-zA-Z0-9_]{3,50}$'),
    CONSTRAINT ck_profiles_display_name_length CHECK (length(trim(display_name)) >= 2),
    CONSTRAINT ck_profiles_no_system_account CHECK (account_id != '00000000-0000-4000-8000-000000000001'::uuid)
);

CREATE UNIQUE INDEX idx_profiles_handle_lower ON tourist_profiles (LOWER(handle));
CREATE INDEX idx_profiles_travel_preferences ON tourist_profiles USING GIN (travel_preferences);

CREATE TRIGGER trg_guard_no_system_profiles
BEFORE INSERT OR UPDATE ON tourist_profiles
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_system_account_child_records();
