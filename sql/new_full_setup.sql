-- ====================================================================================================
-- WATERMELON HARVEST APP - CONSOLIDATED DATABASE SETUP (V2)
-- ====================================================================================================
-- This script contains the complete schema, including grouping, sales, analysis settings,
-- deletion requests, and global app configuration for easy migration to a new Supabase account.

-- ==========================================
-- 1. EXTENSIONS & TYPES
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE watermelon_item_harvest_status AS ENUM ('NOT_READY', 'READY', 'SOLD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE farm_membership_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- 2. TRIGGER FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION update_timestamp_generic() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_farmer_account_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.farmer_account_updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_farmer_address_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.farmer_address_updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_watermelon_item_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.watermelon_item_updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_watermelon_analysis_settings_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.watermelon_analysis_settings_updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

CREATE OR REPLACE FUNCTION create_default_farmer_settings() RETURNS TRIGGER AS $$
BEGIN INSERT INTO watermelon_analysis_settings_table (farmer_account_id) VALUES (NEW.farmer_account_id) ON CONFLICT DO NOTHING; RETURN NEW; END; $$ language 'plpgsql';

CREATE OR REPLACE FUNCTION delete_auth_user() RETURNS TRIGGER AS $$
BEGIN DELETE FROM auth.users WHERE id = OLD.farmer_account_id; RETURN OLD; END; $$ language 'plpgsql' SECURITY DEFINER;

-- ==========================================
-- 3. TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS farm_group_table (
  farm_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_group_name TEXT NOT NULL,
  farm_group_description TEXT,
  farm_owner_id UUID NOT NULL,
  farm_group_created_at TIMESTAMPTZ DEFAULT NOW(),
  farm_group_updated_at TIMESTAMPTZ DEFAULT NOW(),
  farm_group_deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS farmer_account_table (
  farmer_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_account_first_name TEXT NOT NULL,
  farmer_account_last_name TEXT NOT NULL,
  farmer_account_email TEXT UNIQUE NOT NULL,
  farmer_contact_number TEXT NOT NULL,
  farmer_account_profile_image_url TEXT,
  farmer_account_bio TEXT,
  current_farm_group_id UUID REFERENCES farm_group_table(farm_group_id) ON DELETE SET NULL,
  farmer_account_created_at TIMESTAMPTZ DEFAULT NOW(),
  farmer_account_updated_at TIMESTAMPTZ DEFAULT NOW(),
  farmer_account_deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS farm_membership_table (
  farm_membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_group_id UUID NOT NULL REFERENCES farm_group_table(farm_group_id) ON DELETE CASCADE,
  farmer_account_id UUID NOT NULL REFERENCES farmer_account_table(farmer_account_id) ON DELETE CASCADE,
  farm_membership_status farm_membership_status NOT NULL DEFAULT 'PENDING',
  farm_membership_created_at TIMESTAMPTZ DEFAULT NOW(),
  farm_membership_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(farm_group_id, farmer_account_id)
);

CREATE TABLE IF NOT EXISTS farmer_address_table (
  farmer_address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_account_id UUID NOT NULL REFERENCES farmer_account_table (farmer_account_id) ON DELETE CASCADE,
  farmer_address_sitio TEXT,
  farmer_address_barangay TEXT,
  farmer_address_municipality TEXT,
  farmer_address_province TEXT,
  farmer_address_created_at TIMESTAMPTZ DEFAULT NOW(),
  farmer_address_updated_at TIMESTAMPTZ DEFAULT NOW(),
  farmer_address_deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS watermelon_item_table (
  watermelon_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_account_id UUID NOT NULL REFERENCES farmer_account_table (farmer_account_id) ON DELETE CASCADE,
  farm_group_id UUID REFERENCES farm_group_table(farm_group_id) ON DELETE CASCADE,
  watermelon_item_label TEXT,
  watermelon_item_variety TEXT DEFAULT 'Sugar Baby',
  watermelon_item_description TEXT,
  watermelon_item_image_url TEXT,
  watermelon_item_batch_number TEXT,
  watermelon_item_harvest_status watermelon_item_harvest_status NOT NULL DEFAULT 'NOT_READY',
  deletion_requested_by UUID REFERENCES farmer_account_table(farmer_account_id),
  deletion_requested_at TIMESTAMPTZ,
  watermelon_item_created_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_item_updated_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_item_deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS watermelon_sound_analyses_table (
  watermelon_sound_analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watermelon_item_id UUID NOT NULL REFERENCES watermelon_item_table (watermelon_item_id) ON DELETE CASCADE,
  watermelon_sound_analysis_frequency NUMERIC,
  watermelon_sound_analysis_amplitude NUMERIC,
  watermelon_sound_analysis_result watermelon_item_harvest_status NOT NULL DEFAULT 'NOT_READY',
  watermelon_sound_analysis_created_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_sound_analysis_deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS watermelon_sweetness_record_table (
  watermelon_sweetness_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watermelon_item_id UUID NOT NULL REFERENCES watermelon_item_table (watermelon_item_id) ON DELETE CASCADE,
  watermelon_sweetness_record_score INTEGER,
  watermelon_sweetness_record_notes TEXT,
  watermelon_sweetness_record_created_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_sweetness_record_deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS watermelon_analysis_settings_table (
  watermelon_analysis_settings_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_account_id UUID NOT NULL UNIQUE REFERENCES farmer_account_table (farmer_account_id) ON DELETE CASCADE,
  watermelon_analysis_settings_ready_frequency_min NUMERIC NOT NULL DEFAULT 100,
  watermelon_analysis_settings_ready_frequency_max NUMERIC NOT NULL DEFAULT 200,
  watermelon_analysis_settings_ready_amplitude_min NUMERIC NOT NULL DEFAULT 0.5,
  CONSTRAINT check_frequency_range CHECK (watermelon_analysis_settings_ready_frequency_min < watermelon_analysis_settings_ready_frequency_max),
  watermelon_analysis_settings_created_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_analysis_settings_updated_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_analysis_settings_deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS watermelon_sales_table (
  sale_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_group_id UUID NOT NULL REFERENCES farm_group_table(farm_group_id),
  sold_by UUID NOT NULL REFERENCES farmer_account_table(farmer_account_id),
  total_amount NUMERIC NOT NULL,
  item_count INTEGER NOT NULL,
  item_ids UUID[] NOT NULL,
  sold_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. INDEXES & TRIGGERS
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_farmer_account_email ON farmer_account_table (farmer_account_email);
CREATE INDEX IF NOT EXISTS idx_watermelon_item_farm_group_id ON watermelon_item_table (farm_group_id);
CREATE INDEX IF NOT EXISTS idx_sound_analysis_created_at ON watermelon_sound_analyses_table (watermelon_sound_analysis_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sweetness_record_created_at ON watermelon_sweetness_record_table (watermelon_sweetness_record_created_at DESC);

CREATE TRIGGER update_farmer_account_modtime BEFORE UPDATE ON farmer_account_table FOR EACH ROW EXECUTE FUNCTION update_farmer_account_updated_at();
CREATE TRIGGER update_farmer_address_modtime BEFORE UPDATE ON farmer_address_table FOR EACH ROW EXECUTE FUNCTION update_farmer_address_updated_at();
CREATE TRIGGER update_watermelon_item_modtime BEFORE UPDATE ON watermelon_item_table FOR EACH ROW EXECUTE FUNCTION update_watermelon_item_updated_at();
CREATE TRIGGER update_watermelon_analysis_settings_modtime BEFORE UPDATE ON watermelon_analysis_settings_table FOR EACH ROW EXECUTE FUNCTION update_watermelon_analysis_settings_updated_at();
CREATE TRIGGER update_farm_group_modtime BEFORE UPDATE ON farm_group_table FOR EACH ROW EXECUTE FUNCTION update_timestamp_generic();
CREATE TRIGGER on_farmer_created AFTER INSERT ON farmer_account_table FOR EACH ROW EXECUTE FUNCTION create_default_farmer_settings();
CREATE TRIGGER on_farmer_deleted BEFORE DELETE ON farmer_account_table FOR EACH ROW EXECUTE FUNCTION delete_auth_user();

-- ==========================================
-- 5. RPC FUNCTIONS
-- ==========================================

-- Record Sound Analysis
CREATE OR REPLACE FUNCTION record_watermelon_sound_analysis(p_watermelon_item_id UUID, p_frequency NUMERIC, p_amplitude NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_farmer_id UUID; v_settings RECORD; v_result watermelon_item_harvest_status; v_analysis_id UUID;
BEGIN
  SELECT farmer_account_id INTO v_farmer_id FROM watermelon_item_table WHERE watermelon_item_id = p_watermelon_item_id;
  SELECT * INTO v_settings FROM watermelon_analysis_settings_table WHERE farmer_account_id = v_farmer_id;
  IF p_frequency >= v_settings.watermelon_analysis_settings_ready_frequency_min AND p_frequency <= v_settings.watermelon_analysis_settings_ready_frequency_max AND p_amplitude >= v_settings.watermelon_analysis_settings_ready_amplitude_min THEN v_result := 'READY'::watermelon_item_harvest_status; ELSE v_result := 'NOT_READY'::watermelon_item_harvest_status; END IF;
  INSERT INTO watermelon_sound_analyses_table (watermelon_item_id, watermelon_sound_analysis_frequency, watermelon_sound_analysis_amplitude, watermelon_sound_analysis_result) VALUES (p_watermelon_item_id, p_frequency, p_amplitude, v_result) RETURNING watermelon_sound_analysis_id INTO v_analysis_id;
  UPDATE watermelon_item_table SET watermelon_item_harvest_status = v_result, watermelon_item_updated_at = NOW() WHERE watermelon_item_id = p_watermelon_item_id;
  RETURN jsonb_build_object('analysis_id', v_analysis_id, 'result', v_result);
END; $$;

-- Manage Inventory & Status
CREATE OR REPLACE FUNCTION bulk_update_watermelon_status(p_executing_user_id UUID, p_item_ids UUID[], p_status watermelon_item_harvest_status)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_group_id UUID; v_owner_id UUID;
BEGIN
  SELECT farm_group_id INTO v_group_id FROM watermelon_item_table WHERE watermelon_item_id = p_item_ids[1];
  SELECT farm_owner_id INTO v_owner_id FROM farm_group_table WHERE farm_group_id = v_group_id;
  IF p_status = 'SOLD' AND p_executing_user_id != v_owner_id THEN RAISE EXCEPTION 'Only farm owner can mark as SOLD'; END IF;
  UPDATE watermelon_item_table SET watermelon_item_harvest_status = p_status, watermelon_item_updated_at = NOW() WHERE watermelon_item_id = ANY(p_item_ids);
END; $$;

CREATE OR REPLACE FUNCTION bulk_delete_watermelons(p_executing_user_id UUID, p_item_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_group_id UUID; v_owner_id UUID;
BEGIN
  SELECT farm_group_id INTO v_group_id FROM watermelon_item_table WHERE watermelon_item_id = p_item_ids[1];
  SELECT farm_owner_id INTO v_owner_id FROM farm_group_table WHERE farm_group_id = v_group_id;
  IF p_executing_user_id != v_owner_id THEN RAISE EXCEPTION 'Only farm owner can delete directly'; END IF;
  UPDATE watermelon_item_table SET watermelon_item_deleted_at = NOW() WHERE watermelon_item_id = ANY(p_item_ids);
END; $$;

-- Deletion Requests
CREATE OR REPLACE FUNCTION request_bulk_delete_watermelons(p_farmer_id UUID, p_item_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN UPDATE watermelon_item_table SET deletion_requested_by = p_farmer_id, deletion_requested_at = NOW() WHERE watermelon_item_id = ANY(p_item_ids); END; $$;

CREATE OR REPLACE FUNCTION manage_watermelon_deletion_requests(p_owner_id UUID, p_item_ids UUID[], p_action TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_action = 'ACCEPT' THEN UPDATE watermelon_item_table SET watermelon_item_deleted_at = NOW() WHERE watermelon_item_id = ANY(p_item_ids);
  ELSE UPDATE watermelon_item_table SET deletion_requested_by = NULL, deletion_requested_at = NULL WHERE watermelon_item_id = ANY(p_item_ids); END IF;
END; $$;

-- Get Inventory (Updated for Group UI)
CREATE OR REPLACE FUNCTION get_group_inventory(p_group_id UUID)
RETURNS TABLE (item_id UUID, label TEXT, variety TEXT, status watermelon_item_harvest_status, last_frequency NUMERIC, last_amplitude NUMERIC, last_sweetness INTEGER, image_url TEXT, created_at TIMESTAMPTZ, farmer_name TEXT, is_deletion_pending BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT DISTINCT ON (wi.watermelon_item_id) wi.watermelon_item_id, wi.watermelon_item_label, wi.watermelon_item_variety, wi.watermelon_item_harvest_status, 
  wsa.watermelon_sound_analysis_frequency, wsa.watermelon_sound_analysis_amplitude, wsr.watermelon_sweetness_record_score, wi.watermelon_item_image_url, wi.watermelon_item_created_at,
  (fa.farmer_account_first_name || ' ' || fa.farmer_account_last_name)::TEXT, (wi.deletion_requested_by IS NOT NULL)
  FROM watermelon_item_table wi JOIN farmer_account_table fa ON wi.farmer_account_id = fa.farmer_account_id
  LEFT JOIN watermelon_sound_analyses_table wsa ON wi.watermelon_item_id = wsa.watermelon_item_id LEFT JOIN watermelon_sweetness_record_table wsr ON wi.watermelon_item_id = wsr.watermelon_item_id
  WHERE wi.farm_group_id = p_group_id AND wi.watermelon_item_deleted_at IS NULL
  ORDER BY wi.watermelon_item_id, wsa.watermelon_sound_analysis_created_at DESC, wsr.watermelon_sweetness_record_created_at DESC;
END; $$;

-- Create Sales
CREATE OR REPLACE FUNCTION record_watermelon_sale(p_executing_user_id UUID, p_farm_group_id UUID, p_item_ids UUID[], p_total_amount NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO watermelon_sales_table (farm_group_id, sold_by, total_amount, item_count, item_ids)
  VALUES (p_farm_group_id, p_executing_user_id, p_total_amount, array_length(p_item_ids, 1), p_item_ids);
  UPDATE watermelon_item_table SET watermelon_item_harvest_status = 'SOLD' WHERE watermelon_item_id = ANY(p_item_ids);
END; $$;

-- ==========================================
-- 6. STORAGE & POLICIES
-- ==========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('profiles', 'profiles', true), ('watermelons', 'watermelons', true) ON CONFLICT DO NOTHING;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read app_settings" ON app_settings FOR SELECT USING (true);
-- (Other RLS policies should be added here as per security requirements)

-- ==========================================
-- 7. INITIAL SEED
-- ==========================================
INSERT INTO app_settings (key, value, description)
VALUES ('testing_deadline', '{"deadline": "2026-02-07T23:23:00+08:00", "is_enabled": true}', 'Deadline for test version availability (Philippine Time)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
