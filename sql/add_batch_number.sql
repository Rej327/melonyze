-- Add missing batch_number column
ALTER TABLE watermelon_item_table 
ADD COLUMN IF NOT EXISTS watermelon_item_batch_number TEXT;
