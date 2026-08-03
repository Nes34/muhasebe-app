-- Mevcut tüm kasaları sil
DELETE FROM cash_transactions;
DELETE FROM cash_registers;

-- Test verisiyle yeniden aç
INSERT INTO cash_registers (name, current_balance, opening_balance, firm_id, currency, is_active)
SELECT 'Ana Kasa', 100000, 100000, id, 'TRY', true
FROM firms WHERE name = 'Dere Insaat Ltd.';

INSERT INTO cash_registers (name, current_balance, opening_balance, firm_id, currency, is_active)
SELECT 'Ana Kasa', 50000, 50000, id, 'TRY', true
FROM firms WHERE name = 'Yildiz Tekstil A.S.';

-- Doğrulama
SELECT cr.name, cr.current_balance, cr.opening_balance, f.name as firm_name
FROM cash_registers cr
LEFT JOIN firms f ON f.id = cr.firm_id;
