-- 1. Firmalara otomatik kod trigger'i
CREATE OR REPLACE FUNCTION generate_firm_code()
RETURNS TRIGGER AS $$
DECLARE
  first_letter TEXT;
  next_num INT;
  new_code TEXT;
BEGIN
  -- Eger kod zaten varsa dokunma
  IF NEW.code IS NOT NULL AND NEW.code != '' THEN
    RETURN NEW;
  END IF;

  -- Ismin ilk harfini al (Turkce karakter destegi)
  first_letter := UPPER(
    CASE
      WHEN SUBSTRING(NEW.name FROM 1 FOR 1) ~ '[A-Z]' THEN SUBSTRING(NEW.name FROM 1 FOR 1)
      WHEN SUBSTRING(NEW.name FROM 1 FOR 1) = 'İ' THEN 'I'
      WHEN SUBSTRING(NEW.name FROM 1 FOR 1) = 'I' THEN 'I'
      WHEN SUBSTRING(NEW.name FROM 1 FOR 1) = 'Ş' THEN 'S'
      WHEN SUBSTRING(NEW.name FROM 1 FOR 1) = 'Ç' THEN 'C'
      WHEN SUBSTRING(NEW.name FROM 1 FOR 1) = 'Ö' THEN 'O'
      WHEN SUBSTRING(NEW.name FROM 1 FOR 1) THEN 'U'
      ELSE 'X'
    END
  );

  -- Ayni harfle baslayan kac firma var
  SELECT COUNT(*) + 1 INTO next_num
  FROM firms
  WHERE code LIKE first_letter || '.%';

  new_code := first_letter || '.' || LPAD(next_num::TEXT, 4, '0');
  NEW.code := new_code;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'i olustur (varsa oncekilini sil)
DROP TRIGGER IF EXISTS trg_generate_firm_code ON firms;
CREATE TRIGGER trg_generate_firm_code
  BEFORE INSERT ON firms
  FOR EACH ROW
  EXECUTE FUNCTION generate_firm_code();

-- 2. Mevcut firmalara kod ata (henuz kodu olmayanlara)
DO $$
DECLARE
  rec RECORD;
  first_letter TEXT;
  next_num INT;
  new_code TEXT;
BEGIN
  FOR rec IN SELECT id, name FROM firms WHERE code IS NULL OR code = '' ORDER BY created_at LOOP
    first_letter := UPPER(
      CASE
        WHEN SUBSTRING(rec.name FROM 1 FOR 1) ~ '[A-Z]' THEN SUBSTRING(rec.name FROM 1 FOR 1)
        WHEN SUBSTRING(rec.name FROM 1 FOR 1) = 'İ' THEN 'I'
        WHEN SUBSTRING(rec.name FROM 1 FOR 1) = 'I' THEN 'I'
        WHEN SUBSTRING(rec.name FROM 1 FOR 1) = 'Ş' THEN 'S'
        WHEN SUBSTRING(rec.name FROM 1 FOR 1) = 'Ç' THEN 'C'
        WHEN SUBSTRING(rec.name FROM 1 FOR 1) = 'Ö' THEN 'O'
        WHEN SUBSTRING(rec.name FROM 1 FOR 1) = 'Ü' THEN 'U'
        ELSE 'X'
      END
    );

    SELECT COUNT(*) + 1 INTO next_num
    FROM firms
    WHERE code LIKE first_letter || '.%';

    new_code := first_letter || '.' || LPAD(next_num::TEXT, 4, '0');

    UPDATE firms SET code = new_code WHERE id = rec.id;
  END LOOP;
END $$;

-- 3. Benzersiz index (yoksa)
CREATE UNIQUE INDEX IF NOT EXISTS idx_firms_code ON firms(code) WHERE code IS NOT NULL;

-- 4. RLS - firmalari herkes gorebilsin
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all firms' AND tablename = 'firms') THEN
    CREATE POLICY "Allow all firms" ON firms FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Proje, kasa, banka icin de RLS kontrol
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all projects' AND tablename = 'projects') THEN
    CREATE POLICY "Allow all projects" ON projects FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all cash_registers' AND tablename = 'cash_registers') THEN
    CREATE POLICY "Allow all cash_registers" ON cash_registers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all bank_accounts' AND tablename = 'bank_accounts') THEN
    CREATE POLICY "Allow all bank_accounts" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
