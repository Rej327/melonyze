-- RPC to fetch farms with membership status for Discovery screen
CREATE OR REPLACE FUNCTION get_discover_farms(p_farmer_id UUID)
RETURNS TABLE (
  farm_group_id UUID,
  farm_group_name TEXT,
  farm_group_description TEXT,
  farm_owner_id UUID,
  owner_first_name TEXT,
  owner_last_name TEXT,
  membership_status farm_membership_status
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fg.farm_group_id,
    fg.farm_group_name,
    fg.farm_group_description,
    fg.farm_owner_id,
    fa.farmer_account_first_name,
    fa.farmer_account_last_name,
    fm.farm_membership_status
  FROM farm_group_table fg
  JOIN farmer_account_table fa ON fg.farm_owner_id = fa.farmer_account_id
  LEFT JOIN farm_membership_table fm ON fg.farm_group_id = fm.farm_group_id AND fm.farmer_account_id = p_farmer_id
  WHERE fg.farm_group_deleted_at IS NULL;
END;
$$;
