-- ==============================================================================
-- My Travelroad - Automated SQL Verification & Security Invariant Test Suite
-- ==============================================================================
-- Executes against PostgreSQL 16 + PostGIS 3.4
-- Can be executed via: psql -U postgres -d mytravelroad -f tests/sql/verification_tests.sql
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
    RAISE NOTICE '==============================================================================';
    RAISE NOTICE 'STARTING STAGE A DATABASE VERIFICATION & SECURITY INVARIANT SUITE';
    RAISE NOTICE '==============================================================================';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 1: Verify PostGIS Extension
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_version TEXT;
BEGIN
    SELECT PostGIS_Full_Version() INTO v_version;
    IF v_version IS NULL OR v_version NOT LIKE '%POSTGIS=%' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: PostGIS extension is not installed or enabled.';
    END IF;
    RAISE NOTICE 'Test 1 PASSED: PostGIS extension verified: %', split_part(v_version, ' ', 1);
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 2: Verify Schema Inventory (15 Tables and 2 Views)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_missing_tables TEXT[];
    v_missing_views TEXT[];
    v_expected_tables TEXT[] := ARRAY[
        'accounts',
        'account_security_credentials',
        'tourist_profiles',
        'destination_categories',
        'destinations',
        'destination_secondary_categories',
        'destination_locations',
        'destination_media',
        'destination_opening_hours',
        'destination_verifications',
        'verification_evidence',
        'verification_records',
        'saved_destinations',
        'audit_logs',
        'audit_log_telemetry'
    ];
    v_expected_views TEXT[] := ARRAY[
        'v_public_destination_locations',
        'v_domain_audit_logs'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY v_expected_tables LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            v_missing_tables := array_append(v_missing_tables, t);
        END IF;
    END LOOP;

    FOREACH t IN ARRAY v_expected_views LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = t) THEN
            v_missing_views := array_append(v_missing_views, t);
        END IF;
    END LOOP;

    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Missing tables: %', v_missing_tables;
    END IF;

    IF array_length(v_missing_views, 1) > 0 THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Missing views: %', v_missing_views;
    END IF;

    RAISE NOTICE 'Test 2 PASSED: All 15 core tables and 2 secure views exist.';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 3: Verify Spatial GiST Indexes
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_coord_idx BOOLEAN;
    v_centroid_idx BOOLEAN;
    v_expr_idx BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'destination_locations' AND indexname = 'idx_locations_coordinates' AND indexdef LIKE '%gist%'
    ) INTO v_coord_idx;

    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'destination_locations' AND indexname = 'idx_locations_public_centroid' AND indexdef LIKE '%gist%'
    ) INTO v_centroid_idx;

    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'destination_locations' AND indexname = 'idx_locations_public_coord_expr' AND indexdef LIKE '%gist%'
    ) INTO v_expr_idx;

    IF NOT (v_coord_idx AND v_centroid_idx AND v_expr_idx) THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Spatial GiST indexes missing on destination_locations (coords: %, centroid: %, expr: %)',
            v_coord_idx, v_centroid_idx, v_expr_idx;
    END IF;

    RAISE NOTICE 'Test 3 PASSED: Spatial GiST indexes verified (coordinates, public_centroid, public_coord_expr).';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 4: Root System Account Immutability & Anti-Deletion
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_caught_update BOOLEAN := FALSE;
    v_caught_delete BOOLEAN := FALSE;
BEGIN
    -- Test UPDATE immutability
    BEGIN
        UPDATE accounts SET email = 'tampered@external.com' WHERE id = '00000000-0000-4000-8000-000000000001'::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_caught_update := TRUE;
    END;

    IF NOT v_caught_update THEN
        RAISE EXCEPTION 'TEST 4 FAILED: UPDATE on root system account was not blocked by trigger!';
    END IF;

    -- Test DELETE immutability
    BEGIN
        DELETE FROM accounts WHERE id = '00000000-0000-4000-8000-000000000001'::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_caught_delete := TRUE;
    END;

    IF NOT v_caught_delete THEN
        RAISE EXCEPTION 'TEST 4 FAILED: DELETE on root system account was not blocked by trigger!';
    END IF;

    RAISE NOTICE 'Test 4 PASSED: Root system account immutability and anti-deletion triggers verified.';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 5: Prevention of Credentials on System Accounts
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_caught BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO account_security_credentials (account_id, password_hash)
        VALUES ('00000000-0000-4000-8000-000000000001'::uuid, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_attempt');
    EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Inserting security credentials on root system account was not blocked!';
    END IF;

    RAISE NOTICE 'Test 5 PASSED: System account credential prevention constraint/trigger verified.';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 6: Prevention of Tourist Profile on System Accounts
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_caught BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO tourist_profiles (account_id, display_name, handle)
        VALUES ('00000000-0000-4000-8000-000000000001'::uuid, 'Fake Profile', 'sys_fake_profile');
    EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Inserting tourist profile on root system account was not blocked!';
    END IF;

    RAISE NOTICE 'Test 6 PASSED: System account tourist profile prevention constraint/trigger verified.';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 7: Prevention of Saved Destinations on System Accounts
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_caught BOOLEAN := FALSE;
    v_dest_id UUID := gen_random_uuid();
BEGIN
    BEGIN
        INSERT INTO saved_destinations (account_id, destination_id)
        VALUES ('00000000-0000-4000-8000-000000000001'::uuid, v_dest_id);
    EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Inserting saved destination on root system account was not blocked!';
    END IF;

    RAISE NOTICE 'Test 7 PASSED: System account saved destination prevention constraint/trigger verified.';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 8: System Account Type Transition Prevention When Children Exist
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_test_acc_id UUID := gen_random_uuid();
    v_caught BOOLEAN := FALSE;
BEGIN
    -- Create non-system account
    INSERT INTO accounts (id, email, type, role, status, email_verified)
    VALUES (v_test_acc_id, 'transition-test@mytravelroad.local', 'individual', 'traveler', 'active', TRUE);

    -- Attach tourist profile
    INSERT INTO tourist_profiles (account_id, display_name, handle)
    VALUES (v_test_acc_id, 'Transition Tester', 'trans_tester_99');

    -- Attempt to change account type to system -> MUST FAIL
    BEGIN
        UPDATE accounts SET type = 'system' WHERE id = v_test_acc_id;
    EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Transition to system type was not rejected while child profile existed!';
    END IF;

    -- Clean up test records
    DELETE FROM tourist_profiles WHERE account_id = v_test_acc_id;
    DELETE FROM accounts WHERE id = v_test_acc_id;

    RAISE NOTICE 'Test 8 PASSED: trg_guard_system_type_transition successfully prevented illegal type transition.';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 9: Audit Log Append-Only Immutability
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_log_id UUID := gen_random_uuid();
    v_caught_upd BOOLEAN := FALSE;
    v_caught_del BOOLEAN := FALSE;
BEGIN
    INSERT INTO audit_logs (id, actor_account_id, actor_role, action, entity_type, entity_id)
    VALUES (v_log_id, '00000000-0000-4000-8000-000000000001'::uuid, 'super_admin', 'TEST_EVENT', 'system', 'sys_1');

    -- Test UPDATE forbidden
    BEGIN
        UPDATE audit_logs SET action = 'TAMPERED_EVENT' WHERE id = v_log_id;
    EXCEPTION WHEN OTHERS THEN
        v_caught_upd := TRUE;
    END;

    IF NOT v_caught_upd THEN
        RAISE EXCEPTION 'TEST 9 FAILED: UPDATE on audit_logs was not blocked!';
    END IF;

    -- Test DELETE forbidden
    BEGIN
        DELETE FROM audit_logs WHERE id = v_log_id;
    EXCEPTION WHEN OTHERS THEN
        v_caught_del := TRUE;
    END;

    IF NOT v_caught_del THEN
        RAISE EXCEPTION 'TEST 9 FAILED: DELETE on audit_logs was not blocked!';
    END IF;

    RAISE NOTICE 'Test 9 PASSED: audit_logs immutability trigger verified.';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 10: 3-Tier Coordinate Privacy in `v_public_destination_locations`
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_cat_id UUID := gen_random_uuid();
    v_dest_public UUID := gen_random_uuid();
    v_dest_restricted_centroid UUID := gen_random_uuid();
    v_dest_restricted_suppressed UUID := gen_random_uuid();

    v_exact_coords GEOGRAPHY := ST_SetSRID(ST_MakePoint(76.2234, 11.2789), 4326)::geography;
    v_centroid_coords GEOGRAPHY := ST_SetSRID(ST_MakePoint(76.2000, 11.2500), 4326)::geography;

    v_proj_coords_public GEOGRAPHY;
    v_proj_coords_centroid GEOGRAPHY;
    v_proj_coords_suppressed GEOGRAPHY;
    v_proj_name_centroid TEXT;
BEGIN
    -- Create test category
    INSERT INTO destination_categories (id, slug, name, short_label, description, icon_key)
    VALUES (v_cat_id, 'privacy-test-cat', 'Privacy Test Category', 'Privacy', 'Test description', 'test-icon');

    -- Case 1: Unrestricted Destination
    INSERT INTO destinations (id, slug, title, short_description, full_description, primary_category_id)
    VALUES (v_dest_public, 'public-dest-test', 'Public Site', 'Short desc', 'Full desc', v_cat_id);

    INSERT INTO destination_locations (
        destination_id, coordinates, is_restricted, formatted_address, locality,
        taluk_or_subdivision, district, state_or_province, country_code
    ) VALUES (
        v_dest_public, v_exact_coords, FALSE, 'Address 1', 'Nilambur Town',
        'Nilambur', 'Malappuram', 'Kerala', 'IN'
    );

    -- Case 2: Restricted Destination with Approved Centroid (Tier 1/2)
    INSERT INTO destinations (id, slug, title, short_description, full_description, primary_category_id)
    VALUES (v_dest_restricted_centroid, 'restricted-centroid-test', 'Restricted Centroid Site', 'Short desc', 'Full desc', v_cat_id);

    INSERT INTO destination_locations (
        destination_id, coordinates, is_restricted, restriction_reason,
        public_approximate_centroid, public_approximate_display_name,
        formatted_address, locality, taluk_or_subdivision, district, state_or_province, country_code
    ) VALUES (
        v_dest_restricted_centroid, v_exact_coords, TRUE, 'wildlife_protection',
        v_centroid_coords, 'Nilambur Eco-Buffer Zone',
        'Sensitive Perimeter 1', 'Sensitive Interior',
        'Nilambur', 'Malappuram', 'Kerala', 'IN'
    );

    -- Case 3: Restricted Destination with Complete Coordinate Suppression (Tier 3)
    INSERT INTO destinations (id, slug, title, short_description, full_description, primary_category_id)
    VALUES (v_dest_restricted_suppressed, 'restricted-suppressed-test', 'Suppressed Site', 'Short desc', 'Full desc', v_cat_id);

    INSERT INTO destination_locations (
        destination_id, coordinates, is_restricted, restriction_reason,
        public_approximate_centroid, public_approximate_display_name,
        formatted_address, locality, taluk_or_subdivision, district, state_or_province, country_code
    ) VALUES (
        v_dest_restricted_suppressed, v_exact_coords, TRUE, 'tribal_settlement',
        NULL, 'Protected Forest Settlement',
        'Undisclosed Address', 'Tribal Hamlet',
        'Nilambur', 'Malappuram', 'Kerala', 'IN'
    );

    -- Assert Projections from View
    SELECT public_coordinates INTO v_proj_coords_public
    FROM v_public_destination_locations WHERE destination_id = v_dest_public;

    SELECT public_coordinates, public_locality_name INTO v_proj_coords_centroid, v_proj_name_centroid
    FROM v_public_destination_locations WHERE destination_id = v_dest_restricted_centroid;

    SELECT public_coordinates INTO v_proj_coords_suppressed
    FROM v_public_destination_locations WHERE destination_id = v_dest_restricted_suppressed;

    -- Verification 1: Unrestricted projects exact coordinates
    IF ST_AsText(v_proj_coords_public) != ST_AsText(v_exact_coords) THEN
        RAISE EXCEPTION 'TEST 10 FAILED: Unrestricted destination did not expose exact coordinates!';
    END IF;

    -- Verification 2: Restricted with centroid projects centroid, NOT exact coordinates
    IF ST_AsText(v_proj_coords_centroid) != ST_AsText(v_centroid_coords) THEN
        RAISE EXCEPTION 'TEST 10 FAILED: Restricted centroid destination did not project approximate centroid!';
    END IF;
    IF ST_AsText(v_proj_coords_centroid) = ST_AsText(v_exact_coords) THEN
        RAISE EXCEPTION 'TEST 10 FAILED: CRITICAL PRIVACY LEAK: Restricted destination exposed exact coordinates!';
    END IF;
    IF v_proj_name_centroid != 'Nilambur Eco-Buffer Zone' THEN
        RAISE EXCEPTION 'TEST 10 FAILED: Restricted destination did not expose approved public display name!';
    END IF;

    -- Verification 3: Restricted with NULL centroid projects NULL (Tier 3 suppression)
    IF v_proj_coords_suppressed IS NOT NULL THEN
        RAISE EXCEPTION 'TEST 10 FAILED: Suppressed destination exposed coordinates when it should be NULL!';
    END IF;

    RAISE NOTICE 'Test 10 PASSED: 3-Tier Coordinate Privacy verified (unrestricted exact, Tier 1/2 centroid, Tier 3 NULL suppression).';
END;
$$;

-- ------------------------------------------------------------------------------
-- Test 11: PostGIS Coordinate Insertion & ST_DWithin Distance Query
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Query destinations within 15 km of Nilambur town center (76.2272, 11.2764)
    SELECT COUNT(*) INTO v_count
    FROM v_public_destination_locations
    WHERE public_coordinates IS NOT NULL
      AND ST_DWithin(
          public_coordinates,
          ST_SetSRID(ST_MakePoint(76.2272, 11.2764), 4326)::geography,
          15000
      );

    IF v_count < 1 THEN
        RAISE EXCEPTION 'TEST 11 FAILED: Expected at least 1 destination in spatial proximity query, found %', v_count;
    END IF;

    RAISE NOTICE 'Test 11 PASSED: PostGIS ST_DWithin spatial proximity search returned % matching records.', v_count;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE '==============================================================================';
    RAISE NOTICE 'ALL 11 DATABASE TESTS PASSED SUCCESSFULLY!';
    RAISE NOTICE '==============================================================================';
END;
$$;

-- Roll back test transaction to leave database clean
ROLLBACK;
