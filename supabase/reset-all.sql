-- 1. Mevcut tum firmalari sil
DELETE FROM cash_transactions WHERE firm_id IN (SELECT id FROM firms);
DELETE FROM bank_transactions WHERE firm_id IN (SELECT id FROM firms);
DELETE FROM transactions WHERE firm_id IN (SELECT id FROM firms);
DELETE FROM checks WHERE firm_id IN (SELECT id FROM firms);
DELETE FROM projects WHERE firm_id IN (SELECT id FROM firms);
DELETE FROM cash_registers WHERE firm_id IN (SELECT id FROM firms);
DELETE FROM bank_accounts WHERE firm_id IN (SELECT id FROM firms);
DELETE FROM firms;

-- 2. 2 Firma ekle (type: both)
INSERT INTO firms (code, name, tax_number, phone, email, address, type, is_active) VALUES
('D.0001', 'Dere Insaat Ltd.', '1234567890', '0212 555 1234', 'info@dereinsaat.com', 'Istanbul, Levent Mah.', 'both', true),
('Y.0001', 'Yildiz Tekstil A.S.', '9876543210', '0216 444 5678', 'info@yildiztekstil.com', 'Istanbul, Kadikoy', 'both', true);

-- 3. 2 Cari ekle (farkli firmalar - bagimsiz)
INSERT INTO firms (code, name, tax_number, phone, email, address, type, is_active) VALUES
('A.0001', 'Ahmet Metal Sanayi', '5551234567', '0312 333 1111', 'info@ahmetmetal.com', 'Ankara, Ivedik OSB', 'supplier', true),
('M.0001', 'Mehmet Gida Dagitim', '6667890123', '0312 222 3333', 'info@mehmetgida.com', 'Ankara, Cankaya', 'customer', true);

-- 4. Firmalara proje ekle
INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'Rezidans Projesi', id, 'active', 500000, 'Luks konut insaati'
FROM firms WHERE name = 'Dere Insaat Ltd.';

INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'AVM Insaati', id, 'active', 1200000, 'Alisveris merkezi yapimi'
FROM firms WHERE name = 'Dere Insaat Ltd.';

INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'Yazlik Koleksiyonu', id, 'active', 300000, '2026 yaz koleksiyonu uretimi'
FROM firms WHERE name = 'Yildiz Tekstil A.S.';

INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'Ihracat Siparisi', id, 'active', 750000, 'Almanya icin ihracat siparisi'
FROM firms WHERE name = 'Yildiz Tekstil A.S.';

-- 5. Firmalara kasa ekle
INSERT INTO cash_registers (name, current_balance, opening_balance, firm_id, currency, is_active)
SELECT 'Ana Kasa', 100000, 100000, id, 'TRY', true
FROM firms WHERE name = 'Dere Insaat Ltd.';

INSERT INTO cash_registers (name, current_balance, opening_balance, firm_id, currency, is_active)
SELECT 'Ana Kasa', 50000, 50000, id, 'TRY', true
FROM firms WHERE name = 'Yildiz Tekstil A.S.';

-- 6. Firmalara banka hesabi ekle
INSERT INTO bank_accounts (bank_name, branch, iban, current_balance, opening_balance, firm_id, currency, is_active)
SELECT 'Ziraat Bankasi', 'Levent Subesi', 'TR123456789012345678901234', 250000, 250000, id, 'TRY', true
FROM firms WHERE name = 'Dere Insaat Ltd.';

INSERT INTO bank_accounts (bank_name, branch, iban, current_balance, opening_balance, firm_id, currency, is_active)
SELECT 'Is Bankasi', 'Kadikoy Subesi', 'TR987654321098765432109876', 180000, 180000, id, 'TRY', true
FROM firms WHERE name = 'Yildiz Tekstil A.S.';
