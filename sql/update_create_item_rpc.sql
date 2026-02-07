-- ==========================================
-- CREATE WATERMELON ITEM RPC (Updated)
-- ==========================================

-- Function to create a new watermelon item with initial data
CREATE OR REPLACE FUNCTION create_watermelon_item(
  p_farmer_id UUID,
  p_farm_group_id UUID,
  p_label TEXT,
  p_variety TEXT,
  p_status watermelon_item_harvest_status,
  p_description TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_batch_number TEXT DEFAULT NULL,
  p_initial_brix NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_item_id UUID;
BEGIN
  -- Insert the new watermelon item
  INSERT INTO watermelon_item_table (
    farmer_account_id,
    farm_group_id,
    watermelon_item_label,
    watermelon_item_variety,
    watermelon_item_harvest_status,
    watermelon_item_description,
    watermelon_item_image_url,
    watermelon_item_batch_number
  )
  VALUES (
    p_farmer_id,
    p_farm_group_id,
    p_label,
    p_variety,
    p_status,
    p_description,
    p_image_url,
    p_batch_number
  )
  RETURNING watermelon_item_id INTO v_new_item_id;

  -- If initial brix value provided, create a sweetness record
  IF p_initial_brix IS NOT NULL THEN
    INSERT INTO watermelon_sweetness_record_table (
      watermelon_item_id,
      watermelon_sweetness_record_score
    )
    VALUES (
      v_new_item_id,
      p_initial_brix
    );
  END IF;

  RETURN v_new_item_id;
END;
$$;
