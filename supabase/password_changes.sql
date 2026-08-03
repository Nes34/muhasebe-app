-- Şifre değişikliklerini takip etmek için tablo
CREATE TABLE IF NOT EXISTS password_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by TEXT DEFAULT 'user'
);

-- RLS politikaları
ALTER TABLE password_changes ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi şifre değişikliklerini görebilir
CREATE POLICY "Users can view own password changes" ON password_changes
  FOR SELECT USING (auth.uid() = user_id);

-- Adminler tüm şifre değişikliklerini görebilir
CREATE POLICY "Admins can view all password changes" ON password_changes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Kullanıcılar kendi şifre değişikliklerini ekleyebilir
CREATE POLICY "Users can insert own password changes" ON password_changes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
