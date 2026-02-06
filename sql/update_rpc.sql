-- Update RPC to include decay and confidence
CREATE OR REPLACE FUNCTION record_watermelon_sound_analysis(
  p_watermelon_item_id UUID,
  p_frequency NUMERIC,
  p_amplitude NUMERIC,
  p_decay_time NUMERIC DEFAULT 0,
  p_confidence NUMERIC DEFAULT 0
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
  v_decay_threshold NUMERIC;
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
  
  -- Use default threshold if setting is missing (migration safety)
  -- Note: We check if the column exists in the RECORD by simple coalesce logic if possible, 
  -- but plpgsql records are strict. Assuming schema update ran, it should be there.
  -- Safe default 120ms
  v_decay_threshold := COALESCE(v_settings.watermelon_analysis_settings_ready_decay_threshold, 120);

  -- Determine the result
  -- Condition: Freq in range AND Amplitude > min AND Decay > threshold
  IF p_frequency >= v_settings.watermelon_analysis_settings_ready_frequency_min 
     AND p_frequency <= v_settings.watermelon_analysis_settings_ready_frequency_max
     AND p_amplitude >= v_settings.watermelon_analysis_settings_ready_amplitude_min 
     AND p_decay_time >= v_decay_threshold THEN
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
    p_watermelon_item_id,
    p_frequency,
    p_amplitude,
    p_decay_time,
    p_confidence,
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
    'amplitude', p_amplitude,
    'decay_time', p_decay_time,
    'confidence', p_confidence
  );
END;
$$;
