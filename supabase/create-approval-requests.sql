-- =============================================
-- ONAY TALEPLERİ TABLOSU
-- Bu SQL'i Supabase SQL Editor'da çalıştırın
-- =============================================

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('firm_merge')),
  requested_by UUID REFERENCES auth.users(id),
  requested_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  reject_reason TEXT
);

-- RLS
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "approval_requests_select" ON approval_requests FOR SELECT USING (true);

-- Sadece authenticated kullanıcılar ekleyebilir
CREATE POLICY "approval_requests_insert" ON approval_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Sadece authenticated kullanıcılar güncelleyebilir
CREATE POLICY "approval_requests_update" ON approval_requests FOR UPDATE USING (auth.role() = 'authenticated');

-- İndeks
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(type);
