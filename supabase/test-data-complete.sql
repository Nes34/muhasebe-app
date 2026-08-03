-- ============================================
-- ÖRNEK TEST VERİLERİ
-- Bu SQL'i Supabase SQL Editor'da çalıştırın
-- ============================================

-- 1. ÖRNEK FİRMALAR (2 adet)
INSERT INTO firms (code, name, tax_number, phone, email, address, type, is_active) VALUES
('F.0001', 'Dere İnşaat Ltd.', '1234567890', '0212 555 1234', 'info@dereinsaat.com', 'İstanbul, Levent Mah.', 'both', true),
('F.0002', 'Yıldız Tekstil A.Ş.', '9876543210', '0216 444 5678', 'info@yildiztekstil.com', 'İstanbul, Kadıköy', 'both', true)
ON CONFLICT DO NOTHING;

-- 2. FİRMALARA PROJELER (her firmaya 2 proje)
INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'Rezidans Projesi', id, 'active', 500000, 'Lüks konut inşaatı'
FROM firms WHERE name = 'Dere İnşaat Ltd.'
AND NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Rezidans Projesi' AND firm_id = (SELECT id FROM firms WHERE name = 'Dere İnşaat Ltd.'));

INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'AVM İnşaatı', id, 'active', 1200000, 'Alışveriş merkezi yapımı'
FROM firms WHERE name = 'Dere İnşaat Ltd.'
AND NOT EXISTS (SELECT 1 FROM projects WHERE name = 'AVM İnşaatı' AND firm_id = (SELECT id FROM firms WHERE name = 'Dere İnşaat Ltd.'));

INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'Yazlık Koleksiyonu', id, 'active', 300000, '2026 yaz koleksiyonu üretimi'
FROM firms WHERE name = 'Yıldız Tekstil A.Ş.'
AND NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Yazlık Koleksiyonu' AND firm_id = (SELECT id FROM firms WHERE name = 'Yıldız Tekstil A.Ş.'));

INSERT INTO projects (name, firm_id, status, budget, description)
SELECT 'İhracat Siparişi', id, 'active', 750000, 'Almanya'ya ihracat siparişi'
FROM firms WHERE name = 'Yıldız Tekstil A.Ş.'
AND NOT EXISTS (SELECT 1 FROM projects WHERE name = 'İhracat Siparişi' AND firm_id = (SELECT id FROM firms WHERE name = 'Yıldız Tekstil A.Ş.'));

-- 3. ÖRNEK CARİLER (2 adet)
INSERT INTO firms (code, name, tax_number, phone, email, address, type, is_active) VALUES
('C.0001', 'Ahmet Metal Sanayi', '5551234567', '0312 333 1111', 'info@ahmetmetal.com', 'Ankara, İvedik OSB', 'supplier', true),
('C.0002', 'Mehmet Gıda Dağıtım', '6667890123', '0312 222 3333', 'info@mehmetgida.com', 'Ankara, Çankaya', 'customer', true)
ON CONFLICT DO NOTHING;

-- 4. KASA TANIMLARI (test için)
INSERT INTO cash_registers (name, current_balance, firm_id)
SELECT 'Ana Kasa', 100000, id
FROM firms WHERE name = 'Dere İnşaat Ltd.'
AND NOT EXISTS (SELECT 1 FROM cash_registers WHERE name = 'Ana Kasa' AND firm_id = (SELECT id FROM firms WHERE name = 'Dere İnşaat Ltd.'));

INSERT INTO cash_registers (name, current_balance, firm_id)
SELECT 'Ana Kasa', 50000, id
FROM firms WHERE name = 'Yıldız Tekstil A.Ş.'
AND NOT EXISTS (SELECT 1 FROM cash_registers WHERE name = 'Ana Kasa' AND firm_id = (SELECT id FROM firms WHERE name = 'Yıldız Tekstil A.Ş.'));

-- 5. BANKA HESAPLARI (test için)
INSERT INTO bank_accounts (bank_name, branch_name, iban, current_balance, firm_id)
SELECT 'Ziraat Bankası', 'Levent Şubesi', 'TR123456789012345678901234', 250000, id
FROM firms WHERE name = 'Dere İnşaat Ltd.'
AND NOT EXISTS (SELECT 1 FROM bank_accounts WHERE bank_name = 'Ziraat Bankası' AND firm_id = (SELECT id FROM firms WHERE name = 'Dere İnşaat Ltd.'));

INSERT INTO bank_accounts (bank_name, branch_name, iban, current_balance, firm_id)
SELECT 'İş Bankası', 'Kadıköy Şubesi', 'TR987654321098765432109876', 180000, id
FROM firms WHERE name = 'Yıldız Tekstil A.Ş.'
AND NOT EXISTS (SELECT 1 FROM bank_accounts WHERE bank_name = 'İş Bankası' AND firm_id = (SELECT id FROM firms WHERE name = 'Yıldız Tekstil A.Ş.'));
