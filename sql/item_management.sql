-- ==========================================
-- ITEM MANAGEMENT & DELETION REQUESTS
-- ==========================================

-- 1. Add columns for tracking deletion requests
ALTER TABLE watermelon_item_table 
ADD COLUMN IF NOT EXISTS deletion_requested_by UUID REFERENCES farmer_account_table(farmer_account_id),
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

-- 2. Update status bulk update to check for owner if SOLD
CREATE OR REPLACE FUNCTION bulk_update_watermelon_status(
  p_executing_user_id UUID,
  p_item_ids UUID[],
  p_status watermelon_item_harvest_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
  v_owner_id UUID;
BEGIN
  -- Get group_id from the first item (assuming all items are from the same group for bulk actions)
  SELECT farm_group_id INTO v_group_id
  FROM watermelon_item_table
  WHERE watermelon_item_id = p_item_ids[1];

  SELECT farm_owner_id INTO v_owner_id
  FROM farm_group_table
  WHERE farm_group_id = v_group_id;

  -- If status is SOLD, only owner can do it
  IF p_status = 'SOLD' AND p_executing_user_id != v_owner_id THEN
    RAISE EXCEPTION 'Only the farm owner can mark items as SOLD.';
  END IF;

  UPDATE watermelon_item_table
  SET watermelon_item_harvest_status = p_status,
      watermelon_item_updated_at = NOW()
  WHERE watermelon_item_id = ANY(p_item_ids);
END;
$$;

-- 3. Request deletion (For non-owners)
CREATE OR REPLACE FUNCTION request_bulk_delete_watermelons(
  p_farmer_id UUID,
  p_item_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE watermelon_item_table
  SET deletion_requested_by = p_farmer_id,
      deletion_requested_at = NOW(),
      watermelon_item_updated_at = NOW()
  WHERE watermelon_item_id = ANY(p_item_ids);
END;
$$;

-- 4. Manage deletion requests (Owner only)
CREATE OR REPLACE FUNCTION manage_watermelon_deletion_requests(
  p_owner_id UUID,
  p_item_ids UUID[],
  p_action TEXT -- 'ACCEPT' or 'REJECT'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
  v_owner_id UUID;
BEGIN
  -- Verify owner
  SELECT farm_group_id INTO v_group_id
  FROM watermelon_item_table
  WHERE watermelon_item_id = p_item_ids[1];

  SELECT farm_owner_id INTO v_owner_id
  FROM farm_group_table
  WHERE farm_group_id = v_group_id;

  IF p_owner_id != v_owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Only farm owner can manage deletion requests.';
  END IF;

  IF p_action = 'ACCEPT' THEN
    UPDATE watermelon_item_table
    SET watermelon_item_deleted_at = NOW(),
        watermelon_item_updated_at = NOW()
    WHERE watermelon_item_id = ANY(p_item_ids);
  ELSE
    UPDATE watermelon_item_table
    SET deletion_requested_by = NULL,
        deletion_requested_at = NULL,
        watermelon_item_updated_at = NOW()
    WHERE watermelon_item_id = ANY(p_item_ids);
  END IF;
END;
$$;

-- 5. Direct delete (Owner only)
CREATE OR REPLACE FUNCTION bulk_delete_watermelons(
  p_executing_user_id UUID,
  p_item_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
  v_owner_id UUID;
BEGIN
  SELECT farm_group_id INTO v_group_id
  FROM watermelon_item_table
  WHERE watermelon_item_id = p_item_ids[1];

  SELECT farm_owner_id INTO v_owner_id
  FROM farm_group_table
  WHERE farm_group_id = v_group_id;

  IF p_executing_user_id != v_owner_id THEN
    RAISE EXCEPTION 'Only farm owners can delete items directly. Please request deletion instead.';
  END IF;

  UPDATE watermelon_item_table
  SET watermelon_item_deleted_at = NOW(),
      watermelon_item_updated_at = NOW()
  WHERE watermelon_item_id = ANY(p_item_ids);
END;
$$;

-- 6. RPC to get deletion requests
CREATE OR REPLACE FUNCTION get_deletion_requests(p_group_id UUID)
RETURNS TABLE (
  item_id UUID,
  label TEXT,
  variety TEXT,
  requested_by_name TEXT,
  requested_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wi.watermelon_item_id,
    wi.watermelon_item_label,
    wi.watermelon_item_variety,
    (fa.farmer_account_first_name || ' ' || fa.farmer_account_last_name)::TEXT,
    wi.deletion_requested_at
  FROM watermelon_item_table wi
  JOIN farmer_account_table fa ON wi.deletion_requested_by = fa.farmer_account_id
  WHERE wi.farm_group_id = p_group_id
  AND wi.deletion_requested_by IS NOT NULL
  AND wi.watermelon_item_deleted_at IS NULL;
END;
$$;
-- 7. Update get_group_inventory to include pending deletion status
CREATE OR REPLACE FUNCTION get_group_inventory(p_group_id UUID)
RETURNS TABLE (
  item_id UUID,
  label TEXT,
  variety TEXT,
  status watermelon_item_harvest_status,
  last_frequency NUMERIC,
  last_amplitude NUMERIC,
  last_sweetness INTEGER,
  image_url TEXT,
  created_at TIMESTAMPTZ,
  farmer_name TEXT,
  is_deletion_pending BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (wi.watermelon_item_id)
    wi.watermelon_item_id,
    wi.watermelon_item_label,
    wi.watermelon_item_variety,
    wi.watermelon_item_harvest_status,
    wsa.watermelon_sound_analysis_frequency,
    wsa.watermelon_sound_analysis_amplitude,
    wsr.watermelon_sweetness_record_score,
    wi.watermelon_item_image_url,
    wi.watermelon_item_created_at,
    (fa.farmer_account_first_name || ' ' || fa.farmer_account_last_name)::TEXT,
    (wi.deletion_requested_by IS NOT NULL)
  FROM watermelon_item_table wi
  JOIN farmer_account_table fa ON wi.farmer_account_id = fa.farmer_account_id
  LEFT JOIN watermelon_sound_analyses_table wsa ON wi.watermelon_item_id = wsa.watermelon_item_id
  LEFT JOIN watermelon_sweetness_record_table wsr ON wi.watermelon_item_id = wsr.watermelon_item_id
  WHERE wi.farm_group_id = p_group_id
  AND wi.watermelon_item_deleted_at IS NULL
  ORDER BY wi.watermelon_item_id, wsa.watermelon_sound_analysis_created_at DESC, wsr.watermelon_sweetness_record_created_at DESC;
END;
$$;
