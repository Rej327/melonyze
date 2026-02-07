-- ==========================================
-- SALES MANAGEMENT
-- ==========================================

-- 1. Table to store sales records
CREATE TABLE IF NOT EXISTS watermelon_sales_table (
  sale_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_group_id UUID NOT NULL REFERENCES farm_group_table(farm_group_id),
  sold_by UUID NOT NULL REFERENCES farmer_account_table(farmer_account_id),
  total_amount NUMERIC NOT NULL,
  item_count INTEGER NOT NULL,
  item_ids UUID[] NOT NULL,
  sold_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_farm_group_id ON watermelon_sales_table(farm_group_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON watermelon_sales_table(sold_at DESC);

-- 2. RPC to record a sale
CREATE OR REPLACE FUNCTION record_watermelon_sale(
  p_executing_user_id UUID,
  p_farm_group_id UUID,
  p_item_ids UUID[],
  p_total_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Verify owner
  SELECT farm_owner_id INTO v_owner_id
  FROM farm_group_table
  WHERE farm_group_id = p_farm_group_id;

  IF p_executing_user_id != v_owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the farm owner can record sales.';
  END IF;

  -- Record the sale
  INSERT INTO watermelon_sales_table (
    farm_group_id,
    sold_by,
    total_amount,
    item_count,
    item_ids
  ) VALUES (
    p_farm_group_id,
    p_executing_user_id,
    p_total_amount,
    array_length(p_item_ids, 1),
    p_item_ids
  );

  -- Update items status to SOLD
  UPDATE watermelon_item_table
  SET watermelon_item_harvest_status = 'SOLD',
      watermelon_item_updated_at = NOW()
  WHERE watermelon_item_id = ANY(p_item_ids);
END;
$$;

-- 3. RPC to get sales history
CREATE OR REPLACE FUNCTION get_sales_history(p_farm_group_id UUID)
RETURNS TABLE (
  sale_id UUID,
  sold_at TIMESTAMPTZ,
  total_amount NUMERIC,
  item_count INTEGER,
  sold_by_name TEXT,
  first_item_label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.sale_id,
    s.sold_at,
    s.total_amount,
    s.item_count,
    (fa.farmer_account_first_name || ' ' || fa.farmer_account_last_name)::TEXT as sold_by_name,
    (SELECT watermelon_item_label FROM watermelon_item_table WHERE watermelon_item_id = s.item_ids[1])::TEXT as first_item_label
  FROM watermelon_sales_table s
  JOIN farmer_account_table fa ON s.sold_by = fa.farmer_account_id
  WHERE s.farm_group_id = p_farm_group_id
  ORDER BY s.sold_at DESC;
END;
$$;
