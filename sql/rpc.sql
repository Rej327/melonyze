-- ==========================================
-- REMOTE PROCEDURE CALLS (RPC)
-- ==========================================

-- Function to record sound analysis and automatically determine status based on settings
CREATE OR REPLACE FUNCTION record_watermelon_sound_analysis(
  p_watermelon_item_id UUID,
  p_frequency NUMERIC,
  p_amplitude NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_farmer_id UUID;
  v_settings RECORD;
  v_result watermelon_item_harvest_status;
  v_analysis_id UUID;
BEGIN
  -- Get the farmer_account_id for this item
  SELECT farmer_account_id INTO v_farmer_id
  FROM watermelon_item_table
  WHERE watermelon_item_id = p_watermelon_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Watermelon item not found';
  END IF;

  -- Get the analysis settings for this farmer
  SELECT * INTO v_settings
  FROM watermelon_analysis_settings_table
  WHERE farmer_account_id = v_farmer_id;

  -- Determine the result
  IF p_frequency >= v_settings.watermelon_analysis_settings_ready_frequency_min 
     AND p_frequency <= v_settings.watermelon_analysis_settings_ready_frequency_max
     AND p_amplitude >= v_settings.watermelon_analysis_settings_ready_amplitude_min THEN
    v_result := 'READY'::watermelon_item_harvest_status;
  ELSE
    v_result := 'NOT_READY'::watermelon_item_harvest_status;
  END IF;

  -- Insert the analysis record
  INSERT INTO watermelon_sound_analyses_table (
    watermelon_item_id,
    watermelon_sound_analysis_frequency,
    watermelon_sound_analysis_amplitude,
    watermelon_sound_analysis_result
  )
  VALUES (
    p_watermelon_item_id,
    p_frequency,
    p_amplitude,
    v_result
  )
  RETURNING watermelon_sound_analysis_id INTO v_analysis_id;

  -- Update the item harvest status
  UPDATE watermelon_item_table
  SET watermelon_item_harvest_status = v_result,
      watermelon_item_updated_at = NOW()
  WHERE watermelon_item_id = p_watermelon_item_id;

  RETURN jsonb_build_object(
    'analysis_id', v_analysis_id,
    'result', v_result,
    'frequency', p_frequency,
    'amplitude', p_amplitude
  );
END;
$$;

-- Function to get farmer dashboard stats
CREATE OR REPLACE FUNCTION get_farmer_analytics(p_farmer_id UUID)
RETURNS TABLE (
  total_items BIGINT,
  ready_count BIGINT,
  not_ready_count BIGINT,
  average_sweetness NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(wi.watermelon_item_id)::BIGINT,
    COUNT(wi.watermelon_item_id) FILTER (WHERE wi.watermelon_item_harvest_status = 'READY')::BIGINT,
    COUNT(wi.watermelon_item_id) FILTER (WHERE wi.watermelon_item_harvest_status = 'NOT_READY')::BIGINT,
    AVG(wsr.watermelon_sweetness_record_score)::NUMERIC
  FROM watermelon_item_table wi
  LEFT JOIN watermelon_sweetness_record_table wsr ON wi.watermelon_item_id = wsr.watermelon_item_id
  WHERE wi.farmer_account_id = p_farmer_id
  AND wi.watermelon_item_deleted_at IS NULL;
END;
$$;

-- Function to get all watermelons for a farm group
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
  farmer_name TEXT
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
    (fa.farmer_account_first_name || ' ' || fa.farmer_account_last_name)::TEXT
  FROM watermelon_item_table wi
  JOIN farmer_account_table fa ON wi.farmer_account_id = fa.farmer_account_id
  LEFT JOIN watermelon_sound_analyses_table wsa ON wi.watermelon_item_id = wsa.watermelon_item_id
  LEFT JOIN watermelon_sweetness_record_table wsr ON wi.watermelon_item_id = wsr.watermelon_item_id
  WHERE wi.farm_group_id = p_group_id
  AND wi.watermelon_item_deleted_at IS NULL
  ORDER BY wi.watermelon_item_id, wsa.watermelon_sound_analysis_created_at DESC, wsr.watermelon_sweetness_record_created_at DESC;
END;
$$;

-- Function to get farm group dashboard stats
CREATE OR REPLACE FUNCTION get_group_analytics(p_group_id UUID)
RETURNS TABLE (
  total_items BIGINT,
  ready_count BIGINT,
  not_ready_count BIGINT,
  average_sweetness NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(wi.watermelon_item_id)::BIGINT,
    COUNT(wi.watermelon_item_id) FILTER (WHERE wi.watermelon_item_harvest_status = 'READY')::BIGINT,
    COUNT(wi.watermelon_item_id) FILTER (WHERE wi.watermelon_item_harvest_status = 'NOT_READY')::BIGINT,
    AVG(wsr.watermelon_sweetness_record_score)::NUMERIC
  FROM watermelon_item_table wi
  LEFT JOIN watermelon_sweetness_record_table wsr ON wi.watermelon_item_id = wsr.watermelon_item_id
  WHERE wi.farm_group_id = p_group_id
  AND wi.watermelon_item_deleted_at IS NULL;
END;
$$;

-- Function to get all watermelons with their latest analysis for a farmer
CREATE OR REPLACE FUNCTION get_farmer_inventory(p_farmer_id UUID)
RETURNS TABLE (
  item_id UUID,
  label TEXT,
  variety TEXT,
  status watermelon_item_harvest_status,
  last_frequency NUMERIC,
  last_amplitude NUMERIC,
  last_sweetness INTEGER,
  image_url TEXT,
  created_at TIMESTAMPTZ
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
    wi.watermelon_item_created_at
  FROM watermelon_item_table wi

  LEFT JOIN watermelon_sound_analyses_table wsa ON wi.watermelon_item_id = wsa.watermelon_item_id
  LEFT JOIN watermelon_sweetness_record_table wsr ON wi.watermelon_item_id = wsr.watermelon_item_id
  WHERE wi.farmer_account_id = p_farmer_id
  AND wi.watermelon_item_deleted_at IS NULL
  ORDER BY wi.watermelon_item_id, wsa.watermelon_sound_analysis_created_at DESC, wsr.watermelon_sweetness_record_created_at DESC;
END;
$$;
