-- Add decay time and confidence to sound analysis table
ALTER TABLE watermelon_sound_analyses_table
ADD COLUMN IF NOT EXISTS watermelon_sound_analysis_decay_time NUMERIC,
ADD COLUMN IF NOT EXISTS watermelon_sound_analysis_confidence NUMERIC DEFAULT 1.0;

-- Add decay threshold to settings table
ALTER TABLE watermelon_analysis_settings_table
ADD COLUMN IF NOT EXISTS watermelon_analysis_settings_ready_decay_threshold NUMERIC DEFAULT 120;

-- Update defaults for existing columns to match recommended research values
ALTER TABLE watermelon_analysis_settings_table
ALTER COLUMN watermelon_analysis_settings_ready_frequency_min SET DEFAULT 60,
ALTER COLUMN watermelon_analysis_settings_ready_frequency_max SET DEFAULT 200,
ALTER COLUMN watermelon_analysis_settings_ready_amplitude_min SET DEFAULT 0.25,
ALTER COLUMN watermelon_analysis_settings_ready_decay_threshold SET DEFAULT 1200;
