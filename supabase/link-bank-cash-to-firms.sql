-- Banka hesaplarını firmalara bağla
UPDATE bank_accounts SET firm_id = (SELECT id FROM firms WHERE name = 'Dere Insaat Ltd.' AND is_active = true LIMIT 1)
WHERE bank_name = 'Ziraat Bankasi' AND firm_id IS NULL;

UPDATE bank_accounts SET firm_id = (SELECT id FROM firms WHERE name = 'Yildiz Tekstil A.S.' AND is_active = true LIMIT 1)
WHERE bank_name = 'Is Bankasi' AND firm_id IS NULL;

-- Kasaları bakiyelerine göre firmalara bağla
-- 100000 bakiyeli kasa → Derek İnşaat
UPDATE cash_registers SET firm_id = (SELECT id FROM firms WHERE name = 'Dere Insaat Ltd.' AND is_active = true LIMIT 1)
WHERE name = 'Ana Kasa' AND opening_balance = 100000 AND firm_id IS NULL;

-- 50000 bakiyeli kasa → Yıldız Tekstil
UPDATE cash_registers SET firm_id = (SELECT id FROM firms WHERE name = 'Yildiz Tekstil A.S.' AND is_active = true LIMIT 1)
WHERE name = 'Ana Kasa' AND opening_balance = 50000 AND firm_id IS NULL;

-- Firm_id'si hâlâ boş olan kasaları Derek İnşaat'a bağla
UPDATE cash_registers SET firm_id = (SELECT id FROM firms WHERE name = 'Dere Insaat Ltd.' AND is_active = true LIMIT 1)
WHERE firm_id IS NULL;

-- Doğrulama
SELECT cr.name, cr.opening_balance, f.name as firm_name FROM cash_registers cr LEFT JOIN firms f ON f.id = cr.firm_id WHERE cr.is_active = true;
SELECT ba.bank_name, ba.iban, f.name as firm_name FROM bank_accounts ba LEFT JOIN firms f ON f.id = ba.firm_id WHERE ba.is_active = true;
