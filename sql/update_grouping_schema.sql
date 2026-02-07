-- ==========================================
-- TYPES & ENUMS
-- ==========================================
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
-- TRIGGER FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
DECLARE
    col_name TEXT;
BEGIN
    -- This is a generic trigger that expects the column name to be passed as an argument
    -- But since we use specific names, we will just use the TG_TABLE_NAME to determine the column
    -- Actually, simpler to just define them per table as before for clarity in this SQL dialect.
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- FARM GROUPS
-- ==========================================

CREATE TABLE IF NOT EXISTS farm_group_table (
  farm_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_group_name TEXT NOT NULL,
  farm_group_description TEXT,
  farm_owner_id UUID NOT NULL, -- references farmer_account_table(farmer_account_id)
  farm_group_created_at TIMESTAMPTZ DEFAULT NOW(),
  farm_group_updated_at TIMESTAMPTZ DEFAULT NOW(),
  farm_group_deleted_at TIMESTAMPTZ
);

CREATE TRIGGER IF NOT EXISTS update_farm_group_modtime
BEFORE UPDATE ON farm_group_table
FOR EACH ROW EXECUTE FUNCTION update_timestamp(); -- Note: Using a generic function name for simplicity here, but usually it's table-prefixed.

-- ==========================================
-- FARM MEMBERSHIP
-- ==========================================

CREATE TABLE IF NOT EXISTS farm_membership_table (
  farm_membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_group_id UUID NOT NULL REFERENCES farm_group_table(farm_group_id) ON DELETE CASCADE,
  farmer_account_id UUID NOT NULL REFERENCES farmer_account_table(farmer_account_id) ON DELETE CASCADE,
  farm_membership_status farm_membership_status NOT NULL DEFAULT 'PENDING',
  farm_membership_created_at TIMESTAMPTZ DEFAULT NOW(),
  farm_membership_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(farm_group_id, farmer_account_id)
);

-- ==========================================
-- UPDATING FARMER ACCOUNT TABLE
-- ==========================================

-- Ensure farmer_account_table exists (it should from schema.sql)
-- We add an optional current_farm_group_id if a farmer wants to be linked to one "active" farm
ALTER TABLE farmer_account_table 
ADD COLUMN IF NOT EXISTS current_farm_group_id UUID REFERENCES farm_group_table(farm_group_id) ON DELETE SET NULL;

-- ==========================================
-- WATERMELON ITEMS (Updated for Group ID)
-- ==========================================

-- We migrate the reference from farmer_account_id to farm_group_id
-- However, we keep farmer_account_id as the 'creator' or 'responsible' person if needed
ALTER TABLE watermelon_item_table 
ADD COLUMN IF NOT EXISTS farm_group_id UUID REFERENCES farm_group_table(farm_group_id) ON DELETE CASCADE;

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_watermelon_item_farm_group_id ON watermelon_item_table (farm_group_id);
CREATE INDEX IF NOT EXISTS idx_farm_membership_farmer_id ON farm_membership_table (farmer_account_id);
CREATE INDEX IF NOT EXISTS idx_farm_membership_group_id ON farm_membership_table (farm_group_id);

-- ==========================================
-- RPC FUNCTIONS FOR GROUP MANAGEMENT
-- ==========================================

-- Function to create a group and join the owner to it automatically
CREATE OR REPLACE FUNCTION create_farm_group(
  p_owner_id UUID,
  p_name TEXT,
  p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
BEGIN
  INSERT INTO farm_group_table (farm_group_name, farm_group_description, farm_owner_id)
  VALUES (p_name, p_description, p_owner_id)
  RETURNING farm_group_id INTO v_group_id;

  INSERT INTO farm_membership_table (farm_group_id, farmer_account_id, farm_membership_status)
  VALUES (v_group_id, p_owner_id, 'ACCEPTED');

  -- Update farmer's current group
  UPDATE farmer_account_table 
  SET current_farm_group_id = v_group_id
  WHERE farmer_account_id = p_owner_id;

  RETURN v_group_id;
END;
$$;

-- Function to join a farm group (request)
CREATE OR REPLACE FUNCTION join_farm_group(
  p_farmer_id UUID,
  p_group_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO farm_membership_table (farm_group_id, farmer_account_id, farm_membership_status)
  VALUES (p_group_id, p_farmer_id, 'PENDING')
  ON CONFLICT (farm_group_id, farmer_account_id) DO NOTHING;
END;
$$;

-- Function to handle membership (Owner only)
CREATE OR REPLACE FUNCTION manage_farm_membership(
  p_owner_id UUID,
  p_membership_id UUID,
  p_status farm_membership_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM farm_membership_table fm
    JOIN farm_group_table fg ON fm.farm_group_id = fg.farm_group_id
    WHERE fm.farm_membership_id = p_membership_id AND fg.farm_owner_id = p_owner_id
  ) THEN
    UPDATE farm_membership_table
    SET farm_membership_status = p_status,
        farm_membership_updated_at = NOW()
    WHERE farm_membership_id = p_membership_id;
    
    -- If accepted, optionally set as their current farm if they don't have one
    IF p_status = 'ACCEPTED' THEN
      UPDATE farmer_account_table ft
      SET current_farm_group_id = fm.farm_group_id
      FROM farm_membership_table fm
      WHERE ft.farmer_account_id = fm.farmer_account_id 
      AND fm.farm_membership_id = p_membership_id
      AND ft.current_farm_group_id IS NULL;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized or membership not found';
  END IF;
END;
$$;

-- ==========================================
-- BULK ACTIONS FOR WATERMELONS
-- ==========================================

-- Function to bulk update status (Harvest/Sold)
CREATE OR REPLACE FUNCTION bulk_update_watermelon_status(
  p_item_ids UUID[],
  p_status watermelon_item_harvest_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE watermelon_item_table
  SET watermelon_item_harvest_status = p_status,
      watermelon_item_updated_at = NOW()
  WHERE watermelon_item_id = ANY(p_item_ids);
END;
$$;

-- Function to bulk delete
CREATE OR REPLACE FUNCTION bulk_delete_watermelons(
  p_item_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE watermelon_item_table
  SET watermelon_item_deleted_at = NOW()
  WHERE watermelon_item_id = ANY(p_item_ids);
END;
$$;
-- Function to kick a member (Owner only)
-- Also useful for leaving a group (member kicks themselves)
CREATE OR REPLACE FUNCTION delete_farm_membership(
  p_executing_user_id UUID,
  p_membership_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
  v_owner_id UUID;
  v_target_farmer_id UUID;
BEGIN
  -- Get context
  SELECT farm_group_id, farmer_account_id INTO v_group_id, v_target_farmer_id
  FROM farm_membership_table
  WHERE farm_membership_id = p_membership_id;

  SELECT farm_owner_id INTO v_owner_id
  FROM farm_group_table
  WHERE farm_group_id = v_group_id;

  -- Authority check: Must be owner OR the farmer themselves leaving
  IF p_executing_user_id = v_owner_id OR p_executing_user_id = v_target_farmer_id THEN
    -- If owner is leaving, they should probably promote someone else or delete the group,
    -- but for now let's just allow it if they aren't the last member or something.
    -- Actually, usually owner cannot leave without transferring ownership.
    IF p_executing_user_id = v_owner_id AND v_target_farmer_id = v_owner_id THEN
       -- Implementation choice: owner leaving deletes group or error?
       -- For now, error logic.
       RAISE EXCEPTION 'Owner cannot leave the group. Transfer ownership or delete the group first.';
    END IF;

    DELETE FROM farm_membership_table WHERE farm_membership_id = p_membership_id;
    
    -- Clear current_farm_group_id for the kicked/leaving user
    UPDATE farmer_account_table 
    SET current_farm_group_id = NULL
    WHERE farmer_account_id = v_target_farmer_id AND current_farm_group_id = v_group_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized to delete this membership';
  END IF;
END;
$$;

-- Function to set a default farm (member only)
CREATE OR REPLACE FUNCTION set_default_farm(
  p_farmer_id UUID,
  p_group_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify membership first
  IF EXISTS (
    SELECT 1 FROM farm_membership_table 
    WHERE farmer_account_id = p_farmer_id AND farm_group_id = p_group_id AND farm_membership_status = 'ACCEPTED'
  ) THEN
    UPDATE farmer_account_table 
    SET current_farm_group_id = p_group_id
    WHERE farmer_account_id = p_farmer_id;
  ELSE
    RAISE EXCEPTION 'You must be an accepted member of the farm to set it as default.';
  END IF;
END;
$$;

