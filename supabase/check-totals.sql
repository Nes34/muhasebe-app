-- Gelir/Gider toplamlarını kontrol et

-- 1. transactions tablosu
SELECT 'transactions gelir' as tip, SUM(amount) as toplam
FROM transactions
WHERE transaction_type IN ('income', 'invoice');

SELECT 'transactions gider (expense + purchase + salary + other)' as tip, SUM(amount) as toplam
FROM transactions
WHERE transaction_type NOT IN ('income', 'invoice', 'transfer_in', 'transfer_out');

SELECT 'transactions transfer' as tip, transaction_type, COUNT(*), SUM(amount)
FROM transactions
WHERE transaction_type IN ('transfer_in', 'transfer_out')
GROUP BY transaction_type;

-- 2. cash_transactions (bağımsız, transaction_id IS NULL)
SELECT 'kasa gider (bağımsız)' as tip, SUM(amount) as toplam
FROM cash_transactions
WHERE transaction_type = 'out' AND transaction_id IS NULL;

SELECT 'kasa gelir (bağımsız)' as tip, SUM(amount) as toplam
FROM cash_transactions
WHERE transaction_type = 'in' AND transaction_id IS NULL;

-- 3. bank_transactions (bağımsız, transaction_id IS NULL)
SELECT 'banka gider (bağımsız)' as tip, SUM(amount) as toplam
FROM bank_transactions
WHERE transaction_type = 'out' AND transaction_id IS NULL;

SELECT 'banka gelir (bağımsız)' as tip, SUM(amount) as toplam
FROM bank_transactions
WHERE transaction_type = 'in' AND transaction_id IS NULL;

-- 4. Tüm cash/bank transaction tipleri
SELECT 'cash_transactions tüm tipler' as tip, transaction_type, COUNT(*), SUM(amount)
FROM cash_transactions
GROUP BY transaction_type;

SELECT 'bank_transactions tüm tipler' as tip, transaction_type, COUNT(*), SUM(amount)
FROM bank_transactions
GROUP BY transaction_type;

-- 5. transaction_type'ları listele
SELECT DISTINCT transaction_type, COUNT(*), SUM(amount)
FROM transactions
GROUP BY transaction_type;

-- 6. Açılış bakiyeleri
SELECT 'kasa açılış' as tip, name, opening_balance
FROM cash_registers;

SELECT 'banka açılış' as tip, bank_name, opening_balance
FROM bank_accounts;
