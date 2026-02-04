CREATE TYPE watermelon_item_harvest_status AS ENUM ('NOT_READY', 'READY');

-- Trigger functions for each table to handle prefixed updated_at columns
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

-- Function to automatically create default settings for a new farmer
CREATE OR REPLACE FUNCTION create_default_farmer_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO watermelon_analysis_settings_table (farmer_account_id)
    VALUES (NEW.farmer_account_id)
    ON CONFLICT (farmer_account_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to delete auth user when farmer profile is deleted
-- Note: This requires SECURITY DEFINER to have permission to delete from auth.users
CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM auth.users WHERE id = OLD.farmer_account_id;
    RETURN OLD;
END;
$$ language 'plpgsql' SECURITY DEFINER;






-- ==========================================
-- FARMER ACCOUNTS & ADDRESSES
-- ==========================================

-- Table to store farmer personal information
CREATE TABLE farmer_account_table (
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

-- Automatically create settings when a farmer is created
CREATE TRIGGER on_farmer_created
AFTER INSERT ON farmer_account_table
FOR EACH ROW EXECUTE FUNCTION create_default_farmer_settings();

-- Automatically delete auth user when farmer profile is deleted
CREATE TRIGGER on_farmer_deleted
BEFORE DELETE ON farmer_account_table
FOR EACH ROW EXECUTE FUNCTION delete_auth_user();





CREATE INDEX idx_farmer_account_email
ON farmer_account_table (farmer_account_email);

-- Table to store farmer address details
CREATE TABLE farmer_address_table (
  farmer_address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  farmer_account_id UUID NOT NULL
    REFERENCES farmer_account_table (farmer_account_id)
    ON DELETE CASCADE,

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



CREATE INDEX idx_farmer_address_farmer_account_id
ON farmer_address_table (farmer_account_id);

-- ==========================================
-- WATERMELON ITEMS
-- ==========================================

-- Table to store information about individual watermelons
CREATE TABLE watermelon_item_table (
  watermelon_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  farmer_account_id UUID NOT NULL
    REFERENCES farmer_account_table (farmer_account_id)
    ON DELETE CASCADE,

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



CREATE INDEX idx_watermelon_item_farmer_account_id
ON watermelon_item_table (farmer_account_id);

CREATE INDEX idx_watermelon_item_harvest_status
ON watermelon_item_table (watermelon_item_harvest_status);

-- ==========================================
-- ANALYSIS & RECORDS
-- ==========================================

-- Table to store sound analysis data for watermelons
CREATE TABLE watermelon_sound_analyses_table (
  watermelon_sound_analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  watermelon_item_id UUID NOT NULL
    REFERENCES watermelon_item_table (watermelon_item_id)
    ON DELETE CASCADE,

  watermelon_sound_analysis_frequency NUMERIC,
  watermelon_sound_analysis_amplitude NUMERIC,
  watermelon_sound_analysis_result watermelon_item_harvest_status NOT NULL DEFAULT 'NOT_READY',

  watermelon_sound_analysis_created_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_sound_analysis_deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_sound_analysis_watermelon_item_id
ON watermelon_sound_analyses_table (watermelon_item_id);

CREATE INDEX idx_sound_analysis_created_at
ON watermelon_sound_analyses_table (watermelon_sound_analysis_created_at DESC);


-- Table to store manual sweetness ratings and notes
CREATE TABLE watermelon_sweetness_record_table (
  watermelon_sweetness_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  watermelon_item_id UUID NOT NULL
    REFERENCES watermelon_item_table (watermelon_item_id)
    ON DELETE CASCADE,

  watermelon_sweetness_record_score INTEGER, -- manual input
  watermelon_sweetness_record_notes TEXT,

  watermelon_sweetness_record_created_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_sweetness_record_deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_sweetness_record_watermelon_item_id
ON watermelon_sweetness_record_table (watermelon_item_id);

CREATE INDEX idx_sweetness_record_created_at
ON watermelon_sweetness_record_table (watermelon_sweetness_record_created_at DESC);


-- ==========================================
-- SETTINGS
-- ==========================================

-- Table for user-adjustable sound analysis thresholds
CREATE TABLE watermelon_analysis_settings_table (
  watermelon_analysis_settings_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  farmer_account_id UUID NOT NULL UNIQUE
    REFERENCES farmer_account_table (farmer_account_id)
    ON DELETE CASCADE,
  -- Thresholds for "READY" status based on sound analysis
  watermelon_analysis_settings_ready_frequency_min NUMERIC NOT NULL DEFAULT 100,
  watermelon_analysis_settings_ready_frequency_max NUMERIC NOT NULL DEFAULT 200,
  watermelon_analysis_settings_ready_amplitude_min NUMERIC NOT NULL DEFAULT 0.5,
  
  CONSTRAINT check_frequency_range 
    CHECK (watermelon_analysis_settings_ready_frequency_min < watermelon_analysis_settings_ready_frequency_max),
  
  watermelon_analysis_settings_created_at TIMESTAMPTZ DEFAULT NOW(),

  watermelon_analysis_settings_updated_at TIMESTAMPTZ DEFAULT NOW(),
  watermelon_analysis_settings_deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_watermelon_analysis_settings_modtime
BEFORE UPDATE ON watermelon_analysis_settings_table
FOR EACH ROW EXECUTE FUNCTION update_watermelon_analysis_settings_updated_at();


CREATE INDEX idx_analysis_settings_farmer_account_id
ON watermelon_analysis_settings_table (farmer_account_id);