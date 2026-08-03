-- Trigger'i sil ve yeniden olustur
DROP TRIGGER IF EXISTS trg_generate_firm_code ON firms;

CREATE OR REPLACE FUNCTION generate_firm_code()
RETURNS TRIGGER AS $$
DECLARE
  first_letter TEXT;
  next_num INT;
  new_code TEXT;
  clean_name TEXT;
BEGIN
  -- Firmalar (type: 'both') kod almaz
  IF NEW.type = 'both' THEN
    NEW.code := NULL;
    RETURN NEW;
  END IF;

  -- Zaten kod varsa dokunma
  IF NEW.code IS NOT NULL AND NEW.code != '' THEN
    RETURN NEW;
  END IF;

  -- Turkce karakter donusumu
  clean_name := translate(NEW.name,
    'ıişçöüğİİŞÇÖÜĞ',
    'iiscoogIISCOOG'
  );

  first_letter := UPPER(SUBSTRING(clean_name FROM 1 FOR 1));
  IF first_letter !~ '[A-Z]' THEN first_letter := 'X'; END IF;

  -- Sadece cariler (customer/supplier) arasinda say
  SELECT COUNT(*) + 1 INTO next_num FROM firms WHERE code LIKE first_letter || '.%' AND type IN ('customer', 'supplier');
  new_code := first_letter || '.' || LPAD(next_num::TEXT, 4, '0');
  NEW.code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_firm_code
  BEFORE INSERT ON firms
  FOR EACH ROW
  EXECUTE FUNCTION generate_firm_code();

-- Mevcut firmalarin kodlarini temizle (firmalardan kodu kaldir)
UPDATE firms SET code = NULL WHERE type = 'both';

-- Cariler icin kod ata
DO $$
DECLARE
  rec RECORD;
  fl TEXT;
  nn INT;
  nc TEXT;
  clean_name TEXT;
BEGIN
  FOR rec IN SELECT id, name FROM firms WHERE type IN ('customer', 'supplier') AND (code IS NULL OR code = '') ORDER BY name LOOP
    clean_name := translate(rec.name,
      'ıişçöüğİİŞÇÖÜĞ',
      'iiscoogIISCOOG'
    );
    fl := UPPER(SUBSTRING(clean_name FROM 1 FOR 1));
    IF fl !~ '[A-Z]' THEN fl := 'X'; END IF;
    SELECT COUNT(*) + 1 INTO nn FROM firms WHERE code LIKE fl || '.%' AND type IN ('customer', 'supplier');
    nc := fl || '.' || LPAD(nn::TEXT, 4, '0');
    UPDATE firms SET code = nc WHERE id = rec.id;
  END LOOP;
END $$;
