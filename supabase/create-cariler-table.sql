-- =============================================
-- YENİ CARİLER TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS cariler (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  tax_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  type TEXT DEFAULT 'both' CHECK (type IN ('customer', 'supplier', 'both')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- firms tablosundaki cari niteliğindeki kayıtları cariler tablosuna taşı
INSERT INTO cariler (id, code, name, tax_number, address, phone, email, type, is_active)
SELECT id, code, name, tax_number, address, phone, email, type, is_active
FROM firms
WHERE type IN ('customer', 'supplier')
ON CONFLICT DO NOTHING;

-- cari_id sütunu ekle (yoksa)
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS cari_id UUID REFERENCES cariler(id);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS cari_id UUID REFERENCES cariler(id);
ALTER TABLE checks ADD COLUMN IF NOT EXISTS cari_id UUID REFERENCES cariler(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cari_id UUID REFERENCES cariler(id);

-- checks tablosunda firm_id → cari_id eşleştirmesi (firms tablosundaki customer/supplier kayıtları cari_id'ye taşı)
UPDATE checks SET cari_id = firm_id
WHERE cari_id IS NULL
  AND firm_id IN (SELECT id FROM firms WHERE type IN ('customer', 'supplier'));

-- transactions tablosunda firm_id → cari_id eşleştirmesi
UPDATE transactions SET cari_id = firm_id
WHERE cari_id IS NULL
  AND firm_id IN (SELECT id FROM firms WHERE type IN ('customer', 'supplier'));

-- RLS
ALTER TABLE cariler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes okuyabilir" ON cariler FOR SELECT USING (true);
CREATE POLICY "Herkes yazabilir" ON cariler FOR ALL USING (true);

-- İndeks
CREATE INDEX IF NOT EXISTS idx_cariler_name ON cariler(name);
CREATE INDEX IF NOT EXISTS idx_cariler_code ON cariler(code);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_cari ON cash_transactions(cari_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_cari ON bank_transactions(cari_id);
CREATE INDEX IF NOT EXISTS idx_checks_cari ON checks(cari_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cari ON transactions(cari_id);
