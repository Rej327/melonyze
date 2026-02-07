-- Create a table for global app configuration
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings
CREATE POLICY "Allow public read access" ON app_settings
    FOR SELECT USING (true);

-- Insert initial testing deadline
-- PH time is UTC+8. Defaulting to 9:15 PM
INSERT INTO app_settings (key, value, description)
VALUES (
    'testing_deadline', 
    '{"deadline": "2026-02-07T21:15:00+08:00", "is_enabled": true}',
    'Deadline for test version availability (Philippine Time)'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
