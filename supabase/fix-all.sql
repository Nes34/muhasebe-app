-- 1. Opening balance sutunlarini ekle
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;

-- 2. Eksik kasa varsa ekle (Yildiz Tekstil icin)
INSERT INTO cash_registers (name, current_balance, opening_balance, firm_id, currency, is_active)
SELECT 'Ana Kasa', 50000, 50000, id, 'TRY', true
FROM firms WHERE name = 'Yildiz Tekstil A.S.'
AND NOT EXISTS (
  SELECT 1 FROM cash_registers WHERE firm_id = (SELECT id FROM firms WHERE name = 'Yildiz Tekstil A.S.')
);

-- 3. Tum kasalarin acilis bakiyesini guncelle
UPDATE cash_registers SET opening_balance = current_balance WHERE opening_balance IS NULL OR opening_balance = 0;
UPDATE cash_registers SET current_balance = opening_balance WHERE current_balance = 0 AND opening_balance > 0;

-- 4. Tum bankalarin acilis bakiyesini guncelle
UPDATE bank_accounts SET opening_balance = current_balance WHERE opening_balance IS NULL OR opening_balance = 0;
UPDATE bank_accounts SET current_balance = opening_balance WHERE current_balance = 0 AND opening_balance > 0;

-- 5. Dogrulama: Kac kasa var?
SELECT name, current_balance, opening_balance, firm_id FROM cash_registers;
SELECT bank_name, current_balance, opening_balance, firm_id FROM bank_accounts;
