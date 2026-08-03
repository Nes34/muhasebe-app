-- =============================================
-- KASA VE BANKA BAKİYELERİNİ YENİDEN HESAPLA
-- SQL injection riski yoktur, sadece mevcut veriyi kullanır
-- =============================================

-- 1. Kasa bakiyelerini yeniden hesapla
UPDATE cash_registers cr
SET current_balance = COALESCE(cr.opening_balance, 0) + COALESCE((
  SELECT 
    COALESCE(SUM(CASE WHEN ct.transaction_type = 'in' THEN ct.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN ct.transaction_type = 'out' THEN ct.amount ELSE 0 END), 0)
  FROM cash_transactions ct
  WHERE ct.cash_register_id = cr.id
), 0);

-- 2. Banka hesapı bakiyelerini yeniden hesapla
UPDATE bank_accounts ba
SET current_balance = COALESCE(ba.opening_balance, 0) + COALESCE((
  SELECT 
    COALESCE(SUM(CASE WHEN bt.transaction_type = 'in' THEN bt.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN bt.transaction_type = 'out' THEN bt.amount ELSE 0 END), 0)
  FROM bank_transactions bt
  WHERE bt.bank_account_id = ba.id
), 0);

-- 3. Sonuçları göster
SELECT 
  'KASA' as tip,
  cr.name as hesap,
  cr.opening_balance as acilis,
  cr.current_balance as guncel_bakiye,
  (cr.current_balance - COALESCE(cr.opening_balance, 0)) as hareket_net
FROM cash_registers cr
WHERE cr.is_active = true

UNION ALL

SELECT 
  'BANKA' as tip,
  ba.bank_name || ' - ' || COALESCE(ba.branch, '') as hesap,
  ba.opening_balance as acilis,
  ba.current_balance as guncel_bakiye,
  (ba.current_balance - COALESCE(ba.opening_balance, 0)) as hareket_net
FROM bank_accounts ba
WHERE ba.is_active = true

ORDER BY tip, hesap;
