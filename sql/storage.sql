-- ==========================================
-- STORAGE BUCKETS
-- ==========================================

-- Note: These commands are for Supabase Storage. 
-- If you are using a different provider, the syntax may vary.

-- 1. Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('profiles', 'profiles', true),
  ('watermelons', 'watermelons', true);

-- 2. Enable RLS on storage.objects
-- (Usually enabled by default in Supabase, but good to be explicit if needed)

-- 3. Set up Policies for 'profiles' bucket
-- Allow public to view profile images
CREATE POLICY "Public profiles are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Allow farmers to upload their own profile image
CREATE POLICY "Farmers can upload their own profile images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profiles' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow farmers to update/delete their own profile image
CREATE POLICY "Farmers can update or delete their own profile images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'profiles' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Set up Policies for 'watermelons' bucket
-- Allow public to view watermelon images (optional, could be restricted)
CREATE POLICY "Watermelon images are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'watermelons');

-- Allow farmers to upload watermelon images to their own folder
CREATE POLICY "Farmers can upload watermelon images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'watermelons' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow farmers to manage their own watermelon images
CREATE POLICY "Farmers can manage their own watermelon images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'watermelons' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
