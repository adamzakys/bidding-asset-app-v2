-- SUPABASE DATABASE SCHEMA
-- Bidding Management System (PT. Berlian Manyar Sejahtera)

-- Migration: Ensure avatar_url exists in profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- =========================================================================
-- 1. Create Tables
-- =========================================================================

-- Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nama_lengkap TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'BIDDER' CHECK (role IN ('BIDDER', 'ADMIN')),
    status_akun TEXT NOT NULL DEFAULT 'PENDING' CHECK (status_akun IN ('PENDING', 'AKTIF', 'BLOKIR')),
    additional_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Drop dependent view first if we recreate tables
DROP VIEW IF EXISTS public.view_active_bids CASCADE;

-- Drop dependent tables if we recreate them
DROP TABLE IF EXISTS public.bids CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;

-- Assets Table (Auction Catalog)
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_aset TEXT UNIQUE NOT NULL,
    jenis_aset TEXT NOT NULL,
    nama_aset TEXT NOT NULL,
    deskripsi TEXT,
    gambar_url TEXT[] NOT NULL DEFAULT '{}'::text[], -- Support multiple images
    harga_buka NUMERIC NOT NULL CHECK (harga_buka >= 0),
    waktu_mulai TIMESTAMP WITH TIME ZONE NOT NULL,
    waktu_selesai TIMESTAMP WITH TIME ZONE NOT NULL,
    status_lelang TEXT NOT NULL DEFAULT 'OPEN' CHECK (status_lelang IN ('OPEN', 'CLOSED', 'CANCEL')),
    kelipatan_bid NUMERIC NOT NULL DEFAULT 10000 CHECK (kelipatan_bid >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_times CHECK (waktu_selesai > waktu_mulai)
);

-- Bids Table (Transaction Log)
CREATE TABLE public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    nominal_bid NUMERIC NOT NULL CHECK (nominal_bid > 0),
    status_bid TEXT NOT NULL DEFAULT 'VALID' CHECK (status_bid IN ('VALID', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Registration Fields Table (Dynamic form config)
CREATE TABLE IF NOT EXISTS public.registration_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'email', 'tel', 'file', 'textarea')),
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Categories Table (Lelang categories)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 2. SQL Views for UI & Analytics
-- =========================================================================

-- View to get active bids details including highest bid and winner info
CREATE OR REPLACE VIEW public.view_active_bids AS
WITH highest_bids AS (
    SELECT DISTINCT ON (asset_id)
        id AS bid_id,
        asset_id,
        user_id,
        nominal_bid,
        created_at AS bid_time
    FROM public.bids
    WHERE status_bid = 'VALID'
    ORDER BY asset_id, nominal_bid DESC, created_at ASC
)
SELECT 
    a.id AS asset_id,
    a.kode_aset,
    a.kelipatan_bid,
    a.nama_aset,
    a.jenis_aset,
    a.deskripsi,
    a.gambar_url,
    a.harga_buka,
    COALESCE(hb.nominal_bid, a.harga_buka) AS current_highest_bid,
    hb.user_id AS winner_id,
    p.email AS winner_email,
    p.nama_lengkap AS winner_name,
    p.additional_data AS winner_details,
    a.waktu_selesai,
    a.status_lelang,
    CASE 
        WHEN a.status_lelang = 'CANCEL' THEN 'CANCELLED'
        WHEN now() > a.waktu_selesai THEN 'CLOSED'
        ELSE 'OPEN'
    END AS computed_status
FROM public.assets a
LEFT JOIN highest_bids hb ON a.id = hb.asset_id
LEFT JOIN public.profiles p ON hb.user_id = p.id;

-- =========================================================================
-- 3. Automatic Triggers
-- =========================================================================

-- Trigger to automatically create a profile record when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nama_lengkap, avatar_url, role, status_akun, additional_data)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'nama_lengkap', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
        'BIDDER',
        'PENDING', -- Default is PENDING until approved by admin
        '{}'::jsonb
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for auto updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS trigger AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

DROP TRIGGER IF EXISTS update_assets_modtime ON public.assets;
CREATE TRIGGER update_assets_modtime BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

DROP TRIGGER IF EXISTS update_registration_fields_modtime ON public.registration_fields;
CREATE TRIGGER update_registration_fields_modtime BEFORE UPDATE ON public.registration_fields FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- =========================================================================
-- 4. Bidding RPC (Remote Procedure Call)
-- =========================================================================

-- Secure RPC function to process bid submissions
CREATE OR REPLACE FUNCTION public.submit_bid(p_asset_id UUID, p_nominal NUMERIC)
RETURNS VOID AS $$
DECLARE
    v_highest_bid NUMERIC;
    v_harga_buka NUMERIC;
    v_status_lelang TEXT;
    v_waktu_selesai TIMESTAMP WITH TIME ZONE;
    v_status_akun TEXT;
    v_kelipatan_bid NUMERIC;
BEGIN
    -- 1. Check if user is authenticated and active
    SELECT status_akun INTO v_status_akun 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF v_status_akun IS NULL THEN
        RAISE EXCEPTION 'User profile not found.';
    END IF;
    
    IF v_status_akun != 'AKTIF' THEN
        RAISE EXCEPTION 'Akun Anda belum aktif atau diblokir. Hubungi Admin untuk verifikasi.';
    END IF;

    -- 2. Fetch asset info and lock row to prevent race conditions
    SELECT status_lelang, waktu_selesai, harga_buka, kelipatan_bid 
    INTO v_status_lelang, v_waktu_selesai, v_harga_buka, v_kelipatan_bid
    FROM public.assets 
    WHERE id = p_asset_id 
    FOR UPDATE;

    IF v_status_lelang IS NULL THEN
        RAISE EXCEPTION 'Aset tidak ditemukan.';
    END IF;

    -- 3. Check if auction is still open
    IF v_status_lelang != 'OPEN' OR now() > v_waktu_selesai THEN
        RAISE EXCEPTION 'Lelang untuk aset ini sudah ditutup atau dibatalkan.';
    END IF;

    -- 4. Get current highest valid bid
    SELECT COALESCE(MAX(nominal_bid), 0) INTO v_highest_bid 
    FROM public.bids 
    WHERE asset_id = p_asset_id AND status_bid = 'VALID';

    -- 5. Validate nominal bid amount
    IF v_highest_bid = 0 THEN
        IF p_nominal < v_harga_buka THEN
            RAISE EXCEPTION 'Nominal penawaran pertama minimal harus sama dengan harga buka (%s).', v_harga_buka;
        END IF;
    ELSE
        IF p_nominal < (v_highest_bid + v_kelipatan_bid) THEN
            RAISE EXCEPTION 'Nominal penawaran minimal adalah %s (Tertinggi saat ini: %s + Kelipatan: %s).', 
                (v_highest_bid + v_kelipatan_bid), v_highest_bid, v_kelipatan_bid;
        END IF;
    END IF;

    -- 6. Insert new valid bid
    INSERT INTO public.bids (asset_id, user_id, nominal_bid, status_bid)
    VALUES (p_asset_id, auth.uid(), p_nominal, 'VALID');

    -- 7. Anti-sniping / Auto-extend logic
    -- If bid is placed within 2 minutes of the auction end time, extend it by 2 minutes
    IF (v_waktu_selesai - now()) < INTERVAL '2 minutes' THEN
        UPDATE public.assets
        SET waktu_selesai = now() + INTERVAL '2 minutes'
        WHERE id = p_asset_id;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 5. Row Level Security (RLS) & Policies
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_fields ENABLE ROW LEVEL SECURITY;

-- Helper function to check if request is from an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- Profiles Policies ---
DROP POLICY IF EXISTS "Public Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Public Profiles are viewable by authenticated users" 
    ON public.profiles FOR SELECT 
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id) 
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles" 
    ON public.profiles FOR ALL 
    USING (public.is_admin());

-- --- Assets Policies ---
DROP POLICY IF EXISTS "Assets are viewable by authenticated users" ON public.assets;
CREATE POLICY "Assets are viewable by authenticated users" 
    ON public.assets FOR SELECT 
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins have full access to assets" ON public.assets;
CREATE POLICY "Admins have full access to assets" 
    ON public.assets FOR ALL 
    USING (public.is_admin());

-- --- Bids Policies ---
DROP POLICY IF EXISTS "Bids are viewable by authenticated users" ON public.bids;
CREATE POLICY "Bids are viewable by authenticated users" 
    ON public.bids FOR SELECT 
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins have full access to bids" ON public.bids;
CREATE POLICY "Admins have full access to bids" 
    ON public.bids FOR ALL 
    USING (public.is_admin());

-- Note: Bid insertion is done via RPC, which is SECURITY DEFINER, so normal users don't need direct INSERT privilege.

-- --- Registration Fields Policies ---
DROP POLICY IF EXISTS "Fields are viewable by authenticated users or public" ON public.registration_fields;
CREATE POLICY "Fields are viewable by authenticated users or public" 
    ON public.registration_fields FOR SELECT 
    TO public
    USING (true);

DROP POLICY IF EXISTS "Admins have full access to registration fields" ON public.registration_fields;
CREATE POLICY "Admins have full access to registration fields" 
    ON public.registration_fields FOR ALL 
    USING (public.is_admin());

-- --- Categories Policies ---
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories are viewable by public" ON public.categories;
CREATE POLICY "Categories are viewable by public" 
    ON public.categories FOR SELECT 
    TO public
    USING (true);

DROP POLICY IF EXISTS "Admins have full access to categories" ON public.categories;
CREATE POLICY "Admins have full access to categories" 
    ON public.categories FOR ALL 
    TO authenticated
    USING (public.is_admin());

-- --- Storage Objects Policies ---

-- 1. registration-docs policies
DROP POLICY IF EXISTS "Allow authenticated users to upload registration documents" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload registration documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'registration-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to read their own registration documents" ON storage.objects;
CREATE POLICY "Allow authenticated users to read their own registration documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'registration-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow admins to read all registration documents" ON storage.objects;
CREATE POLICY "Allow admins to read all registration documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'registration-docs' AND public.is_admin());

-- 2. asset-images policies
DROP POLICY IF EXISTS "Allow public select on asset-images" ON storage.objects;
CREATE POLICY "Allow public select on asset-images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'asset-images');

DROP POLICY IF EXISTS "Allow admins to manage asset-images" ON storage.objects;
CREATE POLICY "Allow admins to manage asset-images"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'asset-images' AND public.is_admin())
    WITH CHECK (bucket_id = 'asset-images' AND public.is_admin());

-- 3. user-avatars policies
DROP POLICY IF EXISTS "Allow public select on user-avatars" ON storage.objects;
CREATE POLICY "Allow public select on user-avatars"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'user-avatars');

DROP POLICY IF EXISTS "Allow authenticated to manage their own avatar" ON storage.objects;
CREATE POLICY "Allow authenticated to manage their own avatar"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- 6. Insert Default / Seed Data
-- =========================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('registration-docs', 'registration-docs', true),
    ('asset-images', 'asset-images', true),
    ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Insert default registration fields
INSERT INTO public.registration_fields (field_name, label, field_type, is_required) VALUES
('departemen', 'Departemen / Divisi Kerja', 'text', true),
('no_wa', 'Nomor WhatsApp Aktif', 'tel', true),
('no_npwp', 'Nomor NPWP', 'text', false),
('dokumen_ktp', 'Unggah Dokumen KTP', 'file', true)
ON CONFLICT (field_name) DO NOTHING;

-- Insert default categories
INSERT INTO public.categories (name) VALUES
('IT & Elektronik'),
('Kendaraan Operasional'),
('Furniture'),
('Lainnya')
ON CONFLICT (name) DO NOTHING;

-- Insert default assets
INSERT INTO public.assets (kode_aset, jenis_aset, nama_aset, deskripsi, gambar_url, harga_buka, waktu_mulai, waktu_selesai, status_lelang, kelipatan_bid) VALUES
('BMS/DEL/KND/2026/001', 'Kendaraan Operasional', 'Toyota Hilux Single Cabin', '| L 9853 AR | 2016 | Rusak |', ARRAY['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80'], 16485000, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 100000),
('BMS/DEL/KND/2026/002', 'Kendaraan Operasional', 'Kijang Innova G Diesel Matic', '| L 1402 FA | 2013 | Rusak |', ARRAY['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80'], 62160000, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 100000),
('BMS/DEL/KND/2026/003', 'Kendaraan Operasional', 'Kijang lnnova G Diesel Matic', '| L 1530 PM | 2014 | Beroprasi |', ARRAY['https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=800&q=80'], 90300000, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 100000),
('BMS/DEL/IT/2026/001', 'IT & Elektronik', 'PC Laptop Toshiba Portege R930', '| Tahun 2013 | Rusak |', ARRAY['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/002', 'IT & Elektronik', 'PC Laptop ASUS A46C', '| Tahun 2013 | Rusak |', ARRAY['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/003', 'IT & Elektronik', 'PC Laptop Lenovo G400s', '| Tahun 2013 | Rusak |', ARRAY['https://images.unsplash.com/photo-1618424181497-157f25b6ddd5?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/004', 'IT & Elektronik', 'PC Laptop Lenovo ThinkPad L421', '| Tahun 2014 | Rusak |', ARRAY['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/005', 'IT & Elektronik', 'PC Laptop HP Pavilion 14-v204TX', '| Tahun 2015 | Rusak |', ARRAY['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/006', 'IT & Elektronik', 'Unit PC Laptop Lenovo U41-70', '| Tahun 2016 | Rusak |', ARRAY['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/007', 'IT & Elektronik', 'Unit PC Laptop Lenovo U41-70', '| Tahun 2016 | Rusak |', ARRAY['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/008', 'IT & Elektronik', 'Unit PC Laptop Lenovo U41-70', '| Tahun 2016 | Rusak |', ARRAY['https://images.unsplash.com/photo-1618424181497-157f25b6ddd5?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/009', 'IT & Elektronik', 'PC Laptop HP Envy 13-D027TU', '| Tahun 2016 | Rusak |', ARRAY['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/010', 'IT & Elektronik', 'PC Laptop ASUS A456UQ', '| Tahun 2017 | Rusak |', ARRAY['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/011', 'IT & Elektronik', 'PC Laptop Lenovo ldeapad 31 O', '| Tahun 2017 | Rusak |', ARRAY['https://images.unsplash.com/photo-1618424181497-157f25b6ddd5?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/012', 'IT & Elektronik', 'PC Laptop ASUS Vivobook S14S410U', '| Tahun 2018 | Rusak |', ARRAY['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/013', 'IT & Elektronik', 'PC Laptop HP Pavilion 14-CE3010TX', '| Tahun 2020 | Rusak |', ARRAY['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80'], 99750, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/014', 'IT & Elektronik', 'PC Desktop HP Pro 3330 Micro Tower PC LFOS 35 PA', '| Tahun 2014 | Rusak |', ARRAY['https://images.unsplash.com/photo-1587831990711-23ca6441447b?auto=format&fit=crop&w=800&q=80'], 82950, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/015', 'IT & Elektronik', 'PC Desktop HP 280 G1 Microtower PC', '| Tahun 2016 | Rusak |', ARRAY['https://images.unsplash.com/photo-1587831990711-23ca6441447b?auto=format&fit=crop&w=800&q=80'], 82950, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('BMS/DEL/IT/2026/016', 'IT & Elektronik', 'PC Desktop HP 280 G1 Microtower PC', '| Tahun 2016 | Rusak |', ARRAY['https://images.unsplash.com/photo-1587831990711-23ca6441447b?auto=format&fit=crop&w=800&q=80'], 82950, to_timestamp('06/07/2026 11:00:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('09/07/2026 00:00:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 5000),
('ast-knd1', 'Kendaraan Operasional', 'testting', '232321', ARRAY['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80'], 15000000, to_timestamp('03/07/2026 14:17:00', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp('10/07/2026 14:17:00', 'DD/MM/YYYY HH24:MI:SS'), 'OPEN', 100000)
ON CONFLICT (kode_aset) DO UPDATE SET gambar_url = EXCLUDED.gambar_url;

-- =========================================================================
-- 7. Grant Permissions to Client Roles
-- =========================================================================

-- Grant usage on schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant select, insert, update, delete on all tables in public schema
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Grant all on all sequences (for ID generation)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

