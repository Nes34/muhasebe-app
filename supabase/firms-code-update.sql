-- Firmalara code alanı ekle
ALTER TABLE firms ADD COLUMN IF NOT EXISTS code TEXT;

-- Mevcut firmalara otomatik kod ata
DO $$
DECLARE
  rec RECORD;
  prefix TEXT;
  next_num INT;
  cur_code TEXT;
BEGIN
  FOR rec IN SELECT id, name FROM firms ORDER BY created_at LOOP
    -- İlk harfi al
    prefix := UPPER(SUBSTRING(regexp_replace(rec.name, '[^a-zA-ZçğıöşüÇĞIİÖŞÜ]', '', 'g') FROM 1 FOR 1));
    IF prefix IS NULL OR prefix = '' THEN
      prefix := 'X';
    END IF;
    
    -- Sıradaki numarayı bul
    SELECT MAX(CAST(SUBSTRING(code FROM '\d+') AS INT)) INTO next_num
    FROM firms WHERE code LIKE prefix || '.%';
    
    next_num := COALESCE(next_num, 0) + 1;
    cur_code := prefix || '.' || LPAD(next_num::TEXT, 4, '0');
    
    UPDATE firms SET code = cur_code WHERE id = rec.id;
  END LOOP;
END $$;

-- Benzersiz index ekle
CREATE UNIQUE INDEX IF NOT EXISTS idx_firms_code ON firms(code) WHERE code IS NOT NULL;

-- RLS politikası
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all firms' AND tablename = 'firms') THEN
    CREATE POLICY "Allow all firms" ON firms FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
