-- Ürünlere firm_id ekle (tüm ürünler mevcut firmalara atanacak)
ALTER TABLE products ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id);

-- Banka hesaplarına firm_id ekle
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id);

-- Mevcut banka hesaplarını ilk firmaya ata (varsa)
UPDATE bank_accounts SET firm_id = (SELECT id FROM firms LIMIT 1) WHERE firm_id IS NULL;

-- Mevcut ürünleri ilk firmaya ata (varsa)
UPDATE products SET firm_id = (SELECT id FROM firms LIMIT 1) WHERE firm_id IS NULL;

-- Mevcut kasa işlemlerine firm_id ekle (yoksa)
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id);
UPDATE cash_transactions SET firm_id = (SELECT id FROM firms LIMIT 1) WHERE firm_id IS NULL;

-- Mevcut banka işlemlerine firm_id ekle (yoksa)
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id);
UPDATE bank_transactions SET firm_id = (SELECT id FROM firms LIMIT 1) WHERE firm_id IS NULL;

-- RLS politikaları
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilsin (anon key ile)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read products' AND tablename = 'products') THEN
    CREATE POLICY "Allow read products" ON products FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read bank_accounts' AND tablename = 'bank_accounts') THEN
    CREATE POLICY "Allow read bank_accounts" ON bank_accounts FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read cash_transactions' AND tablename = 'cash_transactions') THEN
    CREATE POLICY "Allow read cash_transactions" ON cash_transactions FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read bank_transactions' AND tablename = 'bank_transactions') THEN
    CREATE POLICY "Allow read bank_transactions" ON bank_transactions FOR SELECT USING (true);
  END IF;
END $$;

-- Tüm CRUD izinleri (anon key)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all products' AND tablename = 'products') THEN
    CREATE POLICY "Allow all products" ON products FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all bank_accounts' AND tablename = 'bank_accounts') THEN
    CREATE POLICY "Allow all bank_accounts" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all cash_transactions' AND tablename = 'cash_transactions') THEN
    CREATE POLICY "Allow all cash_transactions" ON cash_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all bank_transactions' AND tablename = 'bank_transactions') THEN
    CREATE POLICY "Allow all bank_transactions" ON bank_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
