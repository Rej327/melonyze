-- ==========================================
-- SEED DATA (Auth & Farmers)
-- ==========================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    -- Create specific UUIDs to link Auth and Public tables
    farmer1_id UUID := gen_random_uuid();
    farmer2_id UUID := gen_random_uuid();
    farmer3_id UUID := gen_random_uuid();
    farmer4_id UUID := gen_random_uuid();
    farmer5_id UUID := gen_random_uuid();
    
    -- Hashed password for 'farmer'
    hashed_password TEXT := crypt('farmer', gen_salt('bf'));
BEGIN
    -- 0. Cleanup existing seeded Auth Users
    DELETE FROM auth.users WHERE email IN ('juan.delacruz@example.com', 'maria.clara@example.com', 'cardos.dalisay@example.com', 'elena.adarna@example.com', 'sim.ibarra@example.com');

    -- 1. Create Auth Users (Supabase Auth)

    -- We insert into auth.users so you can actually log in with these credentials
    
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES 
      (farmer1_id, '00000000-0000-0000-0000-000000000000', 'juan.delacruz@example.com', hashed_password, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', ''),
      (farmer2_id, '00000000-0000-0000-0000-000000000000', 'maria.clara@example.com', hashed_password, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', ''),
      (farmer3_id, '00000000-0000-0000-0000-000000000000', 'cardos.dalisay@example.com', hashed_password, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', ''),
      (farmer4_id, '00000000-0000-0000-0000-000000000000', 'elena.adarna@example.com', hashed_password, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', ''),
      (farmer5_id, '00000000-0000-0000-0000-000000000000', 'sim.ibarra@example.com', hashed_password, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 'authenticated', '', '', '', '');

    -- 2. Create Public Farmer Profiles
    -- Farmer 1
    INSERT INTO farmer_account_table (farmer_account_id, farmer_account_first_name, farmer_account_last_name, farmer_account_email, farmer_contact_number)
    VALUES (farmer1_id, 'Juan', 'Dela Cruz', 'juan.delacruz@example.com', '09171234567');
    INSERT INTO farmer_address_table (farmer_account_id, farmer_address_sitio, farmer_address_barangay, farmer_address_municipality, farmer_address_province)
    VALUES (farmer1_id, 'Centro', 'Maligaya', 'Tarlac City', 'Tarlac');
    INSERT INTO watermelon_analysis_settings_table (farmer_account_id, watermelon_analysis_settings_ready_frequency_min, watermelon_analysis_settings_ready_frequency_max, watermelon_analysis_settings_ready_amplitude_min)
    VALUES (farmer1_id, 110, 190, 0.6);

    -- Farmer 2
    INSERT INTO farmer_account_table (farmer_account_id, farmer_account_first_name, farmer_account_last_name, farmer_account_email, farmer_contact_number)
    VALUES (farmer2_id, 'Maria', 'Clara', 'maria.clara@example.com', '09187654321');
    INSERT INTO farmer_address_table (farmer_account_id, farmer_address_sitio, farmer_address_barangay, farmer_address_municipality, farmer_address_province)
    VALUES (farmer2_id, 'Purok 1', 'San Jose', 'Dagupan', 'Pangasinan');
    INSERT INTO watermelon_analysis_settings_table (farmer_account_id) VALUES (farmer2_id);

    -- Farmer 3
    INSERT INTO farmer_account_table (farmer_account_id, farmer_account_first_name, farmer_account_last_name, farmer_account_email, farmer_contact_number)
    VALUES (farmer3_id, 'Ricardo', 'Dalisay', 'cardos.dalisay@example.com', '09201112233');
    INSERT INTO farmer_address_table (farmer_account_id, farmer_address_sitio, farmer_address_barangay, farmer_address_municipality, farmer_address_province)
    VALUES (farmer3_id, 'Kanto', 'Bagong Silang', 'Quezon City', 'Metro Manila');
    INSERT INTO watermelon_analysis_settings_table (farmer_account_id, watermelon_analysis_settings_ready_frequency_min, watermelon_analysis_settings_ready_frequency_max)
    VALUES (farmer3_id, 105, 185);

    -- Farmer 4
    INSERT INTO farmer_account_table (farmer_account_id, farmer_account_first_name, farmer_account_last_name, farmer_account_email, farmer_contact_number)
    VALUES (farmer4_id, 'Elena', 'Adarna', 'elena.adarna@example.com', '09334445566');
    INSERT INTO farmer_address_table (farmer_account_id, farmer_address_sitio, farmer_address_barangay, farmer_address_municipality, farmer_address_province)
    VALUES (farmer4_id, 'Ilaya', 'Poblacion', 'Cebu City', 'Cebu');
    INSERT INTO watermelon_analysis_settings_table (farmer_account_id, watermelon_analysis_settings_ready_amplitude_min)
    VALUES (farmer4_id, 0.7);

    -- Farmer 5
    INSERT INTO farmer_account_table (farmer_account_id, farmer_account_first_name, farmer_account_last_name, farmer_account_email, farmer_contact_number)
    VALUES (farmer5_id, 'Simeon', 'Ibarra', 'sim.ibarra@example.com', '09445556677');
    INSERT INTO farmer_address_table (farmer_account_id, farmer_address_sitio, farmer_address_barangay, farmer_address_municipality, farmer_address_province)
    VALUES (farmer5_id, 'Libis', 'San Roque', 'Davao City', 'Davao del Sur');


    INSERT INTO watermelon_analysis_settings_table (farmer_account_id) VALUES (farmer5_id);

    -- 2. Create Watermelon Items for each farmer (approx 20 each)
    FOR i IN 1..20 LOOP
        INSERT INTO watermelon_item_table (farmer_account_id, watermelon_item_label, watermelon_item_variety, watermelon_item_harvest_status, watermelon_item_image_url)
        VALUES (farmer1_id, 'WM-1-' || i, (CASE WHEN i % 2 = 0 THEN 'Sugar Baby' ELSE 'Crimson Sweet' END), (CASE WHEN i % 3 = 0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status, 'https://placehold.co/400x400?text=Watermelon+1-' || i);
        
        INSERT INTO watermelon_item_table (farmer_account_id, watermelon_item_label, watermelon_item_variety, watermelon_item_harvest_status, watermelon_item_image_url)
        VALUES (farmer2_id, 'WM-2-' || i, 'Charleston Gray', (CASE WHEN i % 4 = 0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status, 'https://placehold.co/400x400?text=Watermelon+2-' || i);
        
        INSERT INTO watermelon_item_table (farmer_account_id, watermelon_item_label, watermelon_item_variety, watermelon_item_harvest_status, watermelon_item_image_url)
        VALUES (farmer3_id, 'WM-3-' || i, (CASE WHEN i % 2 = 0 THEN 'Sugar Baby' ELSE 'Black Diamond' END), (CASE WHEN i % 2 = 0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status, 'https://placehold.co/400x400?text=Watermelon+3-' || i);
        
        INSERT INTO watermelon_item_table (farmer_account_id, watermelon_item_label, watermelon_item_variety, watermelon_item_harvest_status, watermelon_item_image_url)
        VALUES (farmer4_id, 'WM-4-' || i, 'Jubilee', (CASE WHEN i % 5 = 0 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status, 'https://placehold.co/400x400?text=Watermelon+4-' || i);
        
        INSERT INTO watermelon_item_table (farmer_account_id, watermelon_item_label, watermelon_item_variety, watermelon_item_harvest_status, watermelon_item_image_url)
        VALUES (farmer5_id, 'WM-5-' || i, 'Allsweet', (CASE WHEN i % 3 = 1 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status, 'https://placehold.co/400x400?text=Watermelon+5-' || i);
    END LOOP;


    -- 3. Add some sample Analysis and Sweetness records
    -- (We'll just add for the first 5 watermelons of each farmer)
    DECLARE
        v_farmer_record RECORD;
        v_item_record RECORD;
    BEGIN
        FOR v_farmer_record IN (SELECT farmer_account_id FROM farmer_account_table) LOOP
            FOR v_item_record IN (SELECT watermelon_item_id FROM watermelon_item_table WHERE farmer_account_id = v_farmer_record.farmer_account_id LIMIT 5) LOOP
                -- Analysis
                INSERT INTO watermelon_sound_analyses_table (watermelon_item_id, watermelon_sound_analysis_frequency, watermelon_sound_analysis_amplitude, watermelon_sound_analysis_result)
                VALUES (v_item_record.watermelon_item_id, 100 + (random() * 100), 0.4 + (random() * 0.4), (CASE WHEN random() > 0.5 THEN 'READY' ELSE 'NOT_READY' END)::watermelon_item_harvest_status);
                
                -- Sweetness
                INSERT INTO watermelon_sweetness_record_table (watermelon_item_id, watermelon_sweetness_record_score, watermelon_sweetness_record_notes)
                VALUES (v_item_record.watermelon_item_id, floor(random() * 5) + 10, 'Sample sweetness record');
            END LOOP;
        END LOOP;
    END;


END $$;
