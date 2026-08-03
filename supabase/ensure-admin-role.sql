-- Admin kullanıcının rolünü garanti altına al
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Mevcut admin kullanıcısının rolünü kontrol et ve ayarla
INSERT INTO user_profiles (id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'admin@muhasebe.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 2. Eğer user_profiles tablosunda kayıt yoksa ekle
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@muhasebe.com')) THEN
    INSERT INTO user_profiles (id, role)
    SELECT id, 'admin' FROM auth.users WHERE email = 'admin@muhasebe.com';
  END IF;
END $$;
