-- 1. Mevcut trigger'i sil
DROP TRIGGER IF EXISTS trg_generate_firm_code ON firms;

-- 2. Trigger fonksiyonu
CREATE OR REPLACE FUNCTION generate_firm_code()
RETURNS TRIGGER AS $$
DECLARE
  first_letter TEXT;
  next_num INT;
  new_code TEXT;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code != '' THEN
    RETURN NEW;
  END IF;

  first_letter := UPPER(SUBSTRING(NEW.name FROM 1 FOR 1));

  CASE first_letter
    WHEN 'İ' THEN first_letter := 'I'
    WHEN 'Ş' THEN first_letter := 'S'
    WHEN 'Ç' THEN first_letter := 'C'
    WHEN 'Ö' THEN first_letter := 'O'
    WHEN 'Ü' THEN first_letter := 'U'
    WHEN 'Ğ' THEN first_letter := 'G'
    ELSE NULL
  END CASE;

  IF first_letter !~ '[A-Z]' THEN first_letter := 'X'; END IF;

  SELECT COUNT(*) + 1 INTO next_num
  FROM firms WHERE code LIKE first_letter || '.%';

  new_code := first_letter || '.' || LPAD(next_num::TEXT, 4, '0');
  NEW.code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger
CREATE TRIGGER trg_generate_firm_code
  BEFORE INSERT ON firms
  FOR EACH ROW
  EXECUTE FUNCTION generate_firm_code();

-- 4. Mevcut firmalari sifirla ve koda gore ata
UPDATE firms SET code = NULL;

DO $$
DECLARE
  rec RECORD;
  fl TEXT;
  nn INT;
  nc TEXT;
BEGIN
  FOR rec IN SELECT id, name FROM firms ORDER BY name LOOP
    fl := UPPER(SUBSTRING(rec.name FROM 1 FOR 1));
    CASE fl
      WHEN 'İ' THEN fl := 'I'
      WHEN 'Ş' THEN fl := 'S'
      WHEN 'Ç' THEN fl := 'C'
      WHEN 'Ö' THEN fl := 'O'
      WHEN 'Ü' THEN fl := 'U'
      WHEN 'Ğ' THEN fl := 'G'
      ELSE NULL
    END CASE;
    IF fl !~ '[A-Z]' THEN fl := 'X'; END IF;
    SELECT COUNT(*) + 1 INTO nn FROM firms WHERE code LIKE fl || '.%';
    nc := fl || '.' || LPAD(nn::TEXT, 4, '0');
    UPDATE firms SET code = nc WHERE id = rec.id;
  END LOOP;
END $$;

-- 5. Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_firms_code ON firms(code) WHERE code IS NOT NULL;
