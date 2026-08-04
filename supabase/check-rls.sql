-- RLS politikalarını kontrol et
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'transactions';

-- Tüm politikaları kaldır ve test et
-- ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Geçici test: RLS'yi kapat, Dashboard'da gider görünür mü?
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;
