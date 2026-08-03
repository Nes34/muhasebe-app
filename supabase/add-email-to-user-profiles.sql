-- user_profiles tablosuna email ekle
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Mevcut kullanıcıların e-postalarını auth.users'dan güncelle
UPDATE user_profiles SET email = (SELECT email FROM auth.users WHERE auth.users.id = user_profiles.id) WHERE email IS NULL;
