-- ====================================================================================================
-- WATERMELON HARVEST APP - FULL DATABASE SETUP (Supabase Optimized)
-- ====================================================================================================

-- 1. CLEANUP (Uncomment if you want to reset everything)
-- DROP TABLE IF EXISTS watermelon_analysis_settings_table CASCADE;
-- DROP TABLE IF EXISTS watermelon_sweetness_record_table CASCADE;
-- DROP TABLE IF EXISTS watermelon_sound_analyses_table CASCADE;
-- DROP TABLE IF EXISTS watermelon_item_table CASCADE;
-- DROP TABLE IF EXISTS farmer_address_table CASCADE;
-- DROP TABLE IF EXISTS farmer_account_table CASCADE;
-- DROP TYPE IF EXISTS watermelon_item_harvest_status CASCADE;

-- ==========================================
-- CUSTOM TYPES
-- ==========================================
DO $$ BEGIN
    CREATE TYPE watermelon_item_harvest_status AS ENUM ('NOT_READY', 'READY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- TRIGGER FUNCTIONS
-- ==========================================

CREATE OR REPLACE FUNCTION update_farmer_account_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.farmer_account_updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_farmer_address_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.farmer_address_updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_watermelon_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.watermelon_item_updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_watermelon_analysis_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.watermelon_analysis_settings_updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION create_default_farmer_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO watermelon_analysis_settings_table (farmer_account_id)
    VALUES (NEW.farmer_account_id)
    ON CONFLICT (farmer_account_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM auth.users WHERE id = OLD.farmer_account_id;
    RETURN OLD;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- ==========================================
-- TABLES & INDICES
-- ==========================================


-- Farmer personal information
CREATE TABLE IF NOT EXISTS farmer_account_table (
  farmer_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_account_first_name TEXT NOT NULL,
  farmer_account_last_name TEXT NOT NULL,
  farmer_account_email TEXT UNIQUE NOT NULL,
  farmer_contact_number TEXT NOT NULL,
  farmer_account_profile_image_url TEXT,
  farmer_account_bio TEXT,
  farmer_account_created_at TIMESTAMPTZ DEFAULT NOW(),
  farmer_account_updated_at TIMESTAMPTZ DEFAULT NOW(),
  farmer_account_deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_farmer_account_modtime
BEFORE UPDATE ON farmer_account_table
FOR EACH ROW EXECUTE FUNCTION update_farmer_account_updated_at();

CREATE TRIGGER on_farmer_created
AFTER INSERT ON farmer_account_table
FOR EACH ROW EXECUTE FUNCTION create_default_farmer_settings();

CREATE TRIGGER on_farmer_deleted
BEFORE DELETE ON farmer_account_table
FOR EACH ROW EXECUTE FUNCTION delete_auth_user();

CREATE INDEX IF NOT EXISTS idx_farmer_account_email ON farmer_account_table (farmer_account_email);


-- Farmer address details
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

CREATE TRIGGER update_farmer_address_modtime
BEFORE UPDATE ON farmer_address_table
FOR EACH ROW EXECUTE FUNCTION update_farmer_address_updated_at();

CREATE INDEX IF NOT EXISTS idx_farmer_address_farmer_account_id ON farmer_address_table (farmer_account_id);

-- Watermelon items
CREATE TABLE IF NOT EXISTS watermelon_item_table (
  watermelon_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_account_id UUID NOT NULL REFERENCES farmer_account_table (farmer_account_id) ON DELETE CASCADE,
  watermelon_item_label TEXT,
  watermelon_item_variety TEXT DEFAULT 'Sugar Baby',
  watermelon_item_description TEXT,
  watermelon_item_image_url TEXT,
  watermelon_item_harvest_status watermelon_item_harvest_status NOT NULL DEFAULT 'NOT_READY',
  watermelon_item_created_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_item_updated_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_item_deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_watermelon_item_modtime
BEFORE UPDATE ON watermelon_item_table
FOR EACH ROW EXECUTE FUNCTION update_watermelon_item_updated_at();

CREATE INDEX IF NOT EXISTS idx_watermelon_item_farmer_account_id ON watermelon_item_table (farmer_account_id);
CREATE INDEX IF NOT EXISTS idx_watermelon_item_harvest_status ON watermelon_item_table (watermelon_item_harvest_status);

-- Sound analysis records
CREATE TABLE IF NOT EXISTS watermelon_sound_analyses_table (
  watermelon_sound_analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watermelon_item_id UUID NOT NULL REFERENCES watermelon_item_table (watermelon_item_id) ON DELETE CASCADE,
  watermelon_sound_analysis_frequency NUMERIC,
  watermelon_sound_analysis_amplitude NUMERIC,
  watermelon_sound_analysis_result watermelon_item_harvest_status NOT NULL DEFAULT 'NOT_READY',
  watermelon_sound_analysis_created_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_sound_analysis_deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sound_analysis_watermelon_item_id ON watermelon_sound_analyses_table (watermelon_item_id);
CREATE INDEX IF NOT EXISTS idx_sound_analysis_created_at ON watermelon_sound_analyses_table (watermelon_sound_analysis_created_at DESC);

-- Sweetness records
CREATE TABLE IF NOT EXISTS watermelon_sweetness_record_table (
  watermelon_sweetness_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watermelon_item_id UUID NOT NULL REFERENCES watermelon_item_table (watermelon_item_id) ON DELETE CASCADE,
  watermelon_sweetness_record_score INTEGER,
  watermelon_sweetness_record_notes TEXT,
  watermelon_sweetness_record_created_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_sweetness_record_deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sweetness_record_watermelon_item_id ON watermelon_sweetness_record_table (watermelon_item_id);
CREATE INDEX IF NOT EXISTS idx_sweetness_record_created_at ON watermelon_sweetness_record_table (watermelon_sweetness_record_created_at DESC);

-- Analysis Settings
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

CREATE TRIGGER update_watermelon_analysis_settings_modtime
BEFORE UPDATE ON watermelon_analysis_settings_table
FOR EACH ROW EXECUTE FUNCTION update_watermelon_analysis_settings_updated_at();

CREATE INDEX IF NOT EXISTS idx_analysis_settings_farmer_account_id ON watermelon_analysis_settings_table (farmer_account_id);

-- ==========================================
-- STORAGE BUCKETS (Supabase)
-- ==========================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true), ('watermelons', 'watermelons', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for profiles
DO $$ BEGIN
    CREATE POLICY "Public profiles are viewable by everyone" ON storage.objects FOR SELECT USING (bucket_id = 'profiles');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Farmers can upload their own profile images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Farmers can update or delete their own profile images" ON storage.objects FOR ALL USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- RLS Policies for watermelons
DO $$ BEGIN
    CREATE POLICY "Watermelon images are viewable by everyone" ON storage.objects FOR SELECT USING (bucket_id = 'watermelons');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Farmers can upload watermelon images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'watermelons' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Farmers can manage their own watermelon images" ON storage.objects FOR ALL USING (bucket_id = 'watermelons' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==========================================
-- REMOTE PROCEDURE CALLS (RPC)
-- ==========================================

CREATE OR REPLACE FUNCTION record_watermelon_sound_analysis(p_watermelon_item_id UUID, p_frequency NUMERIC, p_amplitude NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_farmer_id UUID;
  v_settings RECORD;
  v_result watermelon_item_harvest_status;
  v_analysis_id UUID;
BEGIN
  SELECT farmer_account_id INTO v_farmer_id FROM watermelon_item_table WHERE watermelon_item_id = p_watermelon_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Watermelon item not found'; END IF;
  SELECT * INTO v_settings FROM watermelon_analysis_settings_table WHERE farmer_account_id = v_farmer_id;
  
  IF p_frequency >= v_settings.watermelon_analysis_settings_ready_frequency_min 
     AND p_frequency <= v_settings.watermelon_analysis_settings_ready_frequency_max
     AND p_amplitude >= v_settings.watermelon_analysis_settings_ready_amplitude_min THEN
    v_result := 'READY'::watermelon_item_harvest_status;
  ELSE
    v_result := 'NOT_READY'::watermelon_item_harvest_status;
  END IF;

  INSERT INTO watermelon_sound_analyses_table (watermelon_item_id, watermelon_sound_analysis_frequency, watermelon_sound_analysis_amplitude, watermelon_sound_analysis_result)
  VALUES (p_watermelon_item_id, p_frequency, p_amplitude, v_result)
  RETURNING watermelon_sound_analysis_id INTO v_analysis_id;

  UPDATE watermelon_item_table SET watermelon_item_harvest_status = v_result, watermelon_item_updated_at = NOW() WHERE watermelon_item_id = p_watermelon_item_id;

  RETURN jsonb_build_object('analysis_id', v_analysis_id, 'result', v_result, 'frequency', p_frequency, 'amplitude', p_amplitude);
END;
$$;

CREATE OR REPLACE FUNCTION get_farmer_analytics(p_farmer_id UUID)
RETURNS TABLE (total_items BIGINT, ready_count BIGINT, not_ready_count BIGINT, average_sweetness NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT COUNT(wi.watermelon_item_id)::BIGINT, COUNT(wi.watermelon_item_id) FILTER (WHERE wi.watermelon_item_harvest_status = 'READY')::BIGINT, COUNT(wi.watermelon_item_id) FILTER (WHERE wi.watermelon_item_harvest_status = 'NOT_READY')::BIGINT, AVG(wsr.watermelon_sweetness_record_score)::NUMERIC
  FROM watermelon_item_table wi LEFT JOIN watermelon_sweetness_record_table wsr ON wi.watermelon_item_id = wsr.watermelon_item_id
  WHERE wi.farmer_account_id = p_farmer_id AND wi.watermelon_item_deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION get_farmer_inventory(p_farmer_id UUID)
RETURNS TABLE (item_id UUID, label TEXT, variety TEXT, status watermelon_item_harvest_status, last_frequency NUMERIC, last_amplitude NUMERIC, last_sweetness INTEGER, image_url TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT DISTINCT ON (wi.watermelon_item_id) wi.watermelon_item_id, wi.watermelon_item_label, wi.watermelon_item_variety, wi.watermelon_item_harvest_status, wsa.watermelon_sound_analysis_frequency, wsa.watermelon_sound_analysis_amplitude, wsr.watermelon_sweetness_record_score, wi.watermelon_item_image_url, wi.watermelon_item_created_at
  FROM watermelon_item_table wi LEFT JOIN watermelon_sound_analyses_table wsa ON wi.watermelon_item_id = wsa.watermelon_item_id LEFT JOIN watermelon_sweetness_record_table wsr ON wi.watermelon_item_id = wsr.watermelon_item_id
  WHERE wi.farmer_account_id = p_farmer_id AND wi.watermelon_item_deleted_at IS NULL
  ORDER BY wi.watermelon_item_id, wsa.watermelon_sound_analysis_created_at DESC, wsr.watermelon_sweetness_record_created_at DESC;
END;
$$;

-- ==========================================
-- SEED DATA
-- ==========================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    f1 UUID := gen_random_uuid();
    f2 UUID := gen_random_uuid();
    f3 UUID := gen_random_uuid();
    f4 UUID := gen_random_uuid();
    f5 UUID := gen_random_uuid();
    hashed_pass TEXT := crypt('farmer', gen_salt('bf'));
BEGIN
    -- 0. Cleanup existing seeded users
    DELETE FROM auth.users WHERE email IN ('juan@example.com', 'maria@example.com', 'cardo@example.com', 'elena@example.com', 'sim@example.com');

    -- 1. Auth Users (Supabase Auth)

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES 
      (f1, '00000000-0000-0000-0000-000000000000', 'juan@example.com', hashed_pass, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', ''),
      (f2, '00000000-0000-0000-0000-000000000000', 'maria@example.com', hashed_pass, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', ''),
      (f3, '00000000-0000-0000-0000-000000000000', 'cardo@example.com', hashed_pass, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', ''),
      (f4, '00000000-0000-0000-0000-000000000000', 'elena@example.com', hashed_pass, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', ''),
      (f5, '00000000-0000-0000-0000-000000000000', 'sim@example.com', hashed_pass, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', '');

    -- 2. Public Farmer Profiles
    INSERT INTO farmer_account_table (farmer_account_id, farmer_account_first_name, farmer_account_last_name, farmer_account_email, farmer_contact_number)
    VALUES 
      (f1, 'Juan', 'Dela Cruz', 'juan@example.com', '0917'),
      (f2, 'Maria', 'Clara', 'maria@example.com', '0918'),
      (f3, 'Ricardo', 'Dalisay', 'cardo@example.com', '0920'),
      (f4, 'Elena', 'Adarna', 'elena@example.com', '0933'),
      (f5, 'Simeon', 'Ibarra', 'sim@example.com', '0944');

    -- Addresses
    INSERT INTO farmer_address_table (farmer_account_id, farmer_address_sitio, farmer_address_barangay, farmer_address_municipality, farmer_address_province)
    VALUES 
      (f1, 'Centro', 'Maligaya', 'Tarlac', 'Tarlac'),
      (f2, 'Purok 1', 'San Jose', 'Dagupan', 'Pangasinan'),
      (f3, 'Kanto', 'Bagong Silang', 'QC', 'Manila'),
      (f4, 'Ilaya', 'Poblacion', 'Cebu', 'Cebu'),
      (f5, 'Libis', 'San Roque', 'Davao', 'Davao');



    -- Note: Settings are created automatically by trigger 'on_farmer_created'

    -- 20 Items per farmer
    FOR i IN 1..20 LOOP
        INSERT INTO watermelon_item_table (farmer_account_id, watermelon_item_label, watermelon_item_harvest_status)
        VALUES 
          (f1, 'F1-WM-' || i, (CASE WHEN i%3=0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status),
          (f2, 'F2-WM-' || i, (CASE WHEN i%4=0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status),
          (f3, 'F3-WM-' || i, (CASE WHEN i%2=0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status),
          (f4, 'F4-WM-' || i, (CASE WHEN i%5=0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status),
          (f5, 'F5-WM-' || i, (CASE WHEN i%3=1 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status);
    END LOOP;

    -- 3. Sample Analysis and Sweetness Records (for first 5 items of each farmer)
    DECLARE
        v_farmer_record RECORD;
        v_item_record RECORD;
    BEGIN
        FOR v_farmer_record IN (SELECT farmer_account_id FROM farmer_account_table) LOOP
            FOR v_item_record IN (SELECT watermelon_item_id FROM watermelon_item_table WHERE farmer_account_id = v_farmer_record.farmer_account_id LIMIT 5) LOOP
                -- Analysis
                INSERT INTO watermelon_sound_analyses_table (watermelon_item_id, watermelon_sound_analysis_frequency, watermelon_sound_analysis_amplitude, watermelon_sound_analysis_result)
                VALUES (v_item_record.watermelon_item_id, 100 + (random() * 100), 0.4 + (random() * 0.4), (CASE WHEN random() > 0.5 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status);
                
                -- Sweetness
                INSERT INTO watermelon_sweetness_record_table (watermelon_item_id, watermelon_sweetness_record_score, watermelon_sweetness_record_notes)
                VALUES (v_item_record.watermelon_item_id, floor(random() * 5) + 10, 'Sample sweetness record');
            END LOOP;
        END LOOP;
    END;


END $$;
