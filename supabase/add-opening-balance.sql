-- Banka ve kasalara opening_balance ekle
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;

-- Mevcut bakiyeleri acilis bakiyesi olarak ata
UPDATE bank_accounts SET opening_balance = current_balance WHERE opening_balance = 0 OR opening_balance IS NULL;
UPDATE cash_registers SET opening_balance = current_balance WHERE opening_balance = 0 OR opening_balance IS NULL;
