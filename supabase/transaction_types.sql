-- İşlem tipleri tablosu
CREATE TABLE IF NOT EXISTS transaction_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'file-text',
  color TEXT DEFAULT 'blue',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Varsayılan işlem tiplerini ekle
INSERT INTO transaction_types (name, value, icon, color, sort_order) VALUES
  ('Gelir', 'income', 'arrow-up-circle', 'green', 1),
  ('Gider', 'expense', 'arrow-down-circle', 'red', 2),
  ('Fatura', 'invoice', 'file-text', 'blue', 3),
  ('İrsaliye', 'delivery_note', 'truck', 'purple', 4),
  ('Nakit', 'cash', 'banknote', 'yellow', 5),
  ('Banka', 'bank', 'building', 'indigo', 6),
  ('Çek', 'check', 'credit-card', 'orange', 7);

-- RLS aktif et
ALTER TABLE transaction_types ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "Herkes okuyabilir" ON transaction_types
  FOR SELECT USING (true);

-- Sadece admin ekleyebilir/silebilir
CREATE POLICY "Admin ekleyebilir" ON transaction_types
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin güncelleyebilir" ON transaction_types
  FOR UPDATE USING (true);

CREATE POLICY "Admin silebilir" ON transaction_types
  FOR DELETE USING (true);
