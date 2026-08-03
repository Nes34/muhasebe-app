-- Tüm kasaları ve hareketlerini sil
DELETE FROM cash_transactions;
DELETE FROM cash_registers;

-- Sadece bir tane "Ana Kasa" oluştur (firmasız, tüm firmalar ortak)
INSERT INTO cash_registers (name, current_balance, opening_balance, currency, is_active)
VALUES ('Ana Kasa', 150000, 150000, 'TRY', true);

-- Kasa adına benzersizlik kısıtlaması ekle
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_registers_name_unique') THEN
    ALTER TABLE cash_registers ADD CONSTRAINT cash_registers_name_unique UNIQUE (name);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Doğrulama
SELECT * FROM cash_registers;
