-- ==========================================
-- NEW SEED DATA (Consolidated)
-- ==========================================
-- This seed script creates users, farm groups, members, and inventory 
-- that perfectly match the new consolidated schema.

DO $$
DECLARE
    -- Create specific UUIDs for predictable linking
    f1_id UUID := gen_random_uuid();
    f2_id UUID := gen_random_uuid();
    f3_id UUID := gen_random_uuid();
    
    g1_id UUID := gen_random_uuid();
    g2_id UUID := gen_random_uuid();
    
    hashed_pass TEXT := crypt('farmer', gen_salt('bf'));
BEGIN
    -- 0. Cleanup existing seeded Auth Users
    DELETE FROM auth.users WHERE email IN ('juan.delacruz@example.com', 'maria.clara@example.com', 'cardos.dalisay@example.com');

    -- 1. Create Auth Users (Supabase Auth)
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role)
    VALUES 
      (f1_id, '00000000-0000-0000-0000-000000000000', 'juan.delacruz@example.com', hashed_pass, NOW(), '{"provider":"email"}', '{}', NOW(), NOW(), 'authenticated'),
      (f2_id, '00000000-0000-0000-0000-000000000000', 'maria.clara@example.com', hashed_pass, NOW(), '{"provider":"email"}', '{}', NOW(), NOW(), 'authenticated'),
      (f3_id, '00000000-0000-0000-0000-000000000000', 'cardos.dalisay@example.com', hashed_pass, NOW(), '{"provider":"email"}', '{}', NOW(), NOW(), 'authenticated');

    -- 2. Create Public Farmer Profiles
    INSERT INTO farmer_account_table (farmer_account_id, farmer_account_first_name, farmer_account_last_name, farmer_account_email, farmer_contact_number)
    VALUES 
      (f1_id, 'Juan', 'Dela Cruz', 'juan.delacruz@example.com', '09170001111'),
      (f2_id, 'Maria', 'Clara', 'maria.clara@example.com', '09180002222'),
      (f3_id, 'Ricardo', 'Dalisay', 'cardos.dalisay@example.com', '09200003333');

    -- 3. Create Farm Groups
    INSERT INTO farm_group_table (farm_group_id, farm_group_name, farm_group_description, farm_owner_id)
    VALUES 
      (g1_id, 'Green Valleys Farm', 'A collaborative farm group in Tarlac', f1_id),
      (g2_id, 'Pangasinan Sweets', 'Best watermelons in Dagupan', f2_id);

    -- 4. Establish Memberships
    INSERT INTO farm_membership_table (farm_group_id, farmer_account_id, farm_membership_status)
    VALUES 
      (g1_id, f1_id, 'ACCEPTED'), -- Owner
      (g1_id, f3_id, 'ACCEPTED'), -- Member
      (g2_id, f2_id, 'ACCEPTED'); -- Owner

    -- Set current farm groups for farmers
    UPDATE farmer_account_table SET current_farm_group_id = g1_id WHERE farmer_account_id IN (f1_id, f3_id);
    UPDATE farmer_account_table SET current_farm_group_id = g2_id WHERE farmer_account_id = f2_id;

    -- 5. Seed Inventory
    -- Seed items for Group 1
    FOR i IN 1..15 LOOP
        INSERT INTO watermelon_item_table (
            farmer_account_id, farm_group_id, watermelon_item_label, 
            watermelon_item_variety, watermelon_item_batch_number, watermelon_item_harvest_status
        )
        VALUES (
            (CASE WHEN i%2=0 THEN f1_id ELSE f3_id END), 
            g1_id, 
            'GVF-BATCH1-' || i, 
            'Sugar Baby', 
            'BATCH-001', 
            (CASE WHEN i%3=0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status
        );
    END LOOP;

    -- Seed items for Group 2
    FOR i IN 1..10 LOOP
        INSERT INTO watermelon_item_table (
            farmer_account_id, farm_group_id, watermelon_item_label, 
            watermelon_item_variety, watermelon_item_batch_number, watermelon_item_harvest_status
        )
        VALUES (
            f2_id, 
            g2_id, 
            'PS-Dagupan-' || i, 
            'Crimson Sweet', 
            'DAG-2026', 
            (CASE WHEN i%2=0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status
        );
    END LOOP;

    -- 6. Seed some analysis records
    INSERT INTO watermelon_sound_analyses_table (watermelon_item_id, watermelon_sound_analysis_frequency, watermelon_sound_analysis_amplitude, watermelon_sound_analysis_result)
    SELECT watermelon_item_id, 150, 0.7, 'READY'
    FROM watermelon_item_table
    WHERE watermelon_item_harvest_status = 'READY'
    LIMIT 10;

END $$;
