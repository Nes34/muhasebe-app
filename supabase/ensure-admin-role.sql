-- Admin kullanicisinin rolu garanti altina al
-- Bu SQL'i Supabase SQL Editor'da calistirin

-- 1. Mevcut admin kullanicisinin rolu kontrol et ve ayarla
INSERT INTO user_profiles (id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'admin@muhasebe.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 2. Eger user_profiles tablosunda kayit yoksa ekle
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@muhasebe.com')) THEN
    INSERT INTO user_profiles (id, role)
    SELECT id, 'admin' FROM auth.users WHERE email = 'admin@muhasebe.com';
  END IF;
END $$;
