-- ==========================================
-- SEED DATA (Groups & Memberships)
-- ==========================================

DO $$
DECLARE
    farmer1_id UUID;
    farmer2_id UUID;
    farmer3_id UUID;
    farmer4_id UUID;
    farmer5_id UUID;
    
    group1_id UUID;
    group2_id UUID;
BEGIN
    -- 1. Get existing farmer IDs
    SELECT farmer_account_id INTO farmer1_id FROM farmer_account_table WHERE farmer_account_email = 'juan.delacruz@example.com';
    SELECT farmer_account_id INTO farmer2_id FROM farmer_account_table WHERE farmer_account_email = 'maria.clara@example.com';
    SELECT farmer_account_id INTO farmer3_id FROM farmer_account_table WHERE farmer_account_email = 'cardos.dalisay@example.com';
    SELECT farmer_account_id INTO farmer4_id FROM farmer_account_table WHERE farmer_account_email = 'elena.adarna@example.com';
    SELECT farmer_account_id INTO farmer5_id FROM farmer_account_table WHERE farmer_account_email = 'sim.ibarra@example.com';

    -- 2. Create Farm Groups
    -- Group 1: Northern Harvest (Owner: Juan)
    INSERT INTO farm_group_table (farm_group_name, farm_group_description, farm_owner_id)
    VALUES ('Northern Harvest', 'Main farm group for Tarlac region', farmer1_id)
    RETURNING farm_group_id INTO group1_id;

    -- Group 2: Southern Greens (Owner: Ricardo)
    INSERT INTO farm_group_table (farm_group_name, farm_group_description, farm_owner_id)
    VALUES ('Southern Greens', 'Main farm group for Davao region', farmer3_id)
    RETURNING farm_group_id INTO group2_id;

    -- 3. Create Memberships
    -- Members of Group 1
    INSERT INTO farm_membership_table (farm_group_id, farmer_account_id, farm_membership_status)
    VALUES 
    (group1_id, farmer1_id, 'ACCEPTED'), -- Owner
    (group1_id, farmer2_id, 'ACCEPTED'), -- Accepted member
    (group1_id, farmer4_id, 'PENDING');  -- Pending request

    -- Members of Group 2
    INSERT INTO farm_membership_table (farm_group_id, farmer_account_id, farm_membership_status)
    VALUES 
    (group2_id, farmer3_id, 'ACCEPTED'), -- Owner
    (group2_id, farmer5_id, 'ACCEPTED'); -- Accepted member

    -- 4. Update Farmers' Current Groups
    UPDATE farmer_account_table SET current_farm_group_id = group1_id WHERE farmer_account_id IN (farmer1_id, farmer2_id);
    UPDATE farmer_account_table SET current_farm_group_id = group2_id WHERE farmer_account_id IN (farmer3_id, farmer5_id);

    -- 5. Associate Watermelons with Groups
    -- Juan and Maria's items go to Group 1
    UPDATE watermelon_item_table SET farm_group_id = group1_id WHERE farmer_account_id IN (farmer1_id, farmer2_id);
    
    -- Ricardo and Simeon's items go to Group 2
    UPDATE watermelon_item_table SET farm_group_id = group2_id WHERE farmer_account_id IN (farmer3_id, farmer5_id);

    -- Elena's items (no group yet, but she requested Group 1)
    -- They stay without group for now or we could auto-assign if we want.

END $$;
