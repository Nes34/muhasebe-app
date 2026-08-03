-- ============================================
-- ORNEK TEST VERILERI
-- Bu SQL'i Supabase SQL Editor'da calistirin
-- ============================================

-- 1. ORNEK FIRMLAR (2 adet)
INSERT INTO firms (code, name, tax_number, phone, email, address, type, is_active) VALUES
('F.0001', 'Dere Insaat Ltd.', '1234567890', '0212 555 1234', 'info@dereinsaat.com', 'Istanbul, Levent Mah.', 'both', true),
('F.0002', 'Yildiz Tekstil A.S.', '9876543210', '0216 444 5678', 'info@yildiztekstil.com', 'Istanbul, Kadikoy', 'both', true)
ON CONFLICT DO NOTHING;

-- 2. FIRMLARA PROJELER (her firmaya 2 proje)
INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'Rezidans Projesi', id, 'active', 500000, 'Luks konut insaati'
FROM firms WHERE name = 'Dere Insaat Ltd.'
AND NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Rezidans Projesi');

INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'AVM Insaati', id, 'active', 1200000, 'Alisveris merkezi yapimi'
FROM firms WHERE name = 'Dere Insaat Ltd.'
AND NOT EXISTS (SELECT 1 FROM projects WHERE name = 'AVM Insaati');

INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'Yazlik Koleksiyonu', id, 'active', 300000, '2026 yaz koleksiyonu uretimi'
FROM firms WHERE name = 'Yildiz Tekstil A.S.'
AND NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Yazlik Koleksiyonu');

INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'Ihracat Siparisi', id, 'active', 750000, 'Almanya icin ihracat siparisi'
FROM firms WHERE name = 'Yildiz Tekstil A.S.'
AND NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Ihracat Siparisi');

-- 3. ORNEK CARILER (2 adet)
INSERT INTO firms (code, name, tax_number, phone, email, address, type, is_active) VALUES
('C.0001', 'Ahmet Metal Sanayi', '5551234567', '0312 333 1111', 'info@ahmetmetal.com', 'Ankara, Ivedik OSB', 'supplier', true),
('C.0002', 'Mehmet Gida Dagitim', '6667890123', '0312 222 3333', 'info@mehmetgida.com', 'Ankara, Cankaya', 'customer', true)
ON CONFLICT DO NOTHING;

-- 4. KASA TANIMLARI (test icin)
INSERT INTO cash_registers (name, current_balance, firm_id, currency, is_active)
SELECT 'Ana Kasa', 100000, id, 'TRY', true
FROM firms WHERE name = 'Dere Insaat Ltd.'
AND NOT EXISTS (SELECT 1 FROM cash_registers WHERE name = 'Ana Kasa');

INSERT INTO cash_registers (name, current_balance, firm_id, currency, is_active)
SELECT 'Ana Kasa', 50000, id, 'TRY', true
FROM firms WHERE name = 'Yildiz Tekstil A.S.'
AND NOT EXISTS (SELECT 1 FROM cash_registers WHERE name = 'Ana Kasa');

-- 5. BANKA HESAPLARI (test icin)
INSERT INTO bank_accounts (bank_name, branch, iban, current_balance, firm_id, currency, is_active)
SELECT 'Ziraat Bankasi', 'Levent Subesi', 'TR123456789012345678901234', 250000, id, 'TRY', true
FROM firms WHERE name = 'Dere Insaat Ltd.'
AND NOT EXISTS (SELECT 1 FROM bank_accounts WHERE bank_name = 'Ziraat Bankasi');

INSERT INTO bank_accounts (bank_name, branch, iban, current_balance, firm_id, currency, is_active)
SELECT 'Is Bankasi', 'Kadikoy Subesi', 'TR987654321098765432109876', 180000, id, 'TRY', true
FROM firms WHERE name = 'Yildiz Tekstil A.S.'
AND NOT EXISTS (SELECT 1 FROM bank_accounts WHERE bank_name = 'Is Bankasi');
