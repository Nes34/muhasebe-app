-- Banka hesapları için çoklu firma desteği
CREATE TABLE IF NOT EXISTS bank_account_firms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bank_account_id, firm_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_account_firms_account ON bank_account_firms(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_firms_firm ON bank_account_firms(firm_id);

ALTER TABLE bank_account_firms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON bank_account_firms FOR ALL USING (true);
