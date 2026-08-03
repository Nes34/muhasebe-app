-- cash_registers tablosuna firm_id ekle
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id);

-- Mevcut kasaları ilk firmaya ata (varsa)
UPDATE cash_registers SET firm_id = (SELECT id FROM firms WHERE type = 'both' LIMIT 1) WHERE firm_id IS NULL;

-- RLS politikası
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all cash_registers' AND tablename = 'cash_registers') THEN
    CREATE POLICY "Allow all cash_registers" ON cash_registers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
