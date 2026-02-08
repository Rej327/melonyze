-- ==========================================
-- ADD RECORD_SOUND_ANALYSIS RPC
-- This function is called from the app when saving analysis results
-- ==========================================

CREATE OR REPLACE FUNCTION record_sound_analysis(
  p_executing_user_id UUID,
  p_item_id UUID,
  p_frequency NUMERIC,
  p_amplitude NUMERIC,
  p_decay NUMERIC,
  p_confidence NUMERIC,
  p_is_ripe BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_analysis_id UUID;
  v_result watermelon_item_harvest_status;
BEGIN
  -- Determine status based on p_is_ripe parameter
  IF p_is_ripe THEN
    v_result := 'READY'::watermelon_item_harvest_status;
  ELSE
    v_result := 'NOT_READY'::watermelon_item_harvest_status;
  END IF;

  -- Insert the analysis record
  INSERT INTO watermelon_sound_analyses_table (
    watermelon_item_id,
    watermelon_sound_analysis_frequency,
    watermelon_sound_analysis_amplitude,
    watermelon_sound_analysis_decay_time,
    watermelon_sound_analysis_confidence,
    watermelon_sound_analysis_result
  )
  VALUES (
    p_item_id,
    p_frequency,
    p_amplitude,
    p_decay,
    p_confidence,
    v_result
  )
  RETURNING watermelon_sound_analysis_id INTO v_analysis_id;

  -- Update the item harvest status
  UPDATE watermelon_item_table
  SET watermelon_item_harvest_status = v_result,
      watermelon_item_updated_at = NOW()
  WHERE watermelon_item_id = p_item_id;

  RETURN v_analysis_id;
END;
$$;
