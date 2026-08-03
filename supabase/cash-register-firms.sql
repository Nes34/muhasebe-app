-- Kasa-Firma ilişkisi için ara tablo
CREATE TABLE IF NOT EXISTS cash_register_firms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id UUID REFERENCES cash_registers(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cash_register_id, firm_id)
);

-- Mevcut kasaların firm_id'lerini yeni tabloya taşı
INSERT INTO cash_register_firms (cash_register_id, firm_id)
SELECT id, firm_id FROM cash_registers WHERE firm_id IS NOT NULL;

-- RLS
ALTER TABLE cash_register_firms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes okuyabilir" ON cash_register_firms FOR SELECT USING (true);
CREATE POLICY "Herkes yazabilir" ON cash_register_firms FOR ALL USING (true);

-- Ana Kasa'yı tüm firmalara bağla
INSERT INTO cash_register_firms (cash_register_id, firm_id)
SELECT cr.id, f.id
FROM cash_registers cr, firms f
WHERE cr.name = 'Ana Kasa' AND f.is_active = true
ON CONFLICT (cash_register_id, firm_id) DO NOTHING;

-- Doğrulama
SELECT cr.name, array_agg(f.name) as firmalar
FROM cash_register_firms crf
JOIN cash_registers cr ON cr.id = crf.cash_register_id
JOIN firms f ON f.id = crf.firm_id
GROUP BY cr.name;
