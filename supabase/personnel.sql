-- =============================================
-- PERSONEL MODÜLÜ - VERİTABANI TABLOLARI
-- =============================================

-- 1. PERSONEL TABLOSU
CREATE TABLE IF NOT EXISTS personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id),
  tc_number VARCHAR(11) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  position VARCHAR(100),
  taseron VARCHAR(200) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resigned', 'on_leave')),
  is_protected BOOLEAN DEFAULT false,
  gross_salary DECIMAL(15,2),
  net_salary DECIMAL(15,2),
  bank_name VARCHAR(100),
  bank_iban VARCHAR(50),
  sgk_number VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PERSONEL NAKİL GEÇMİŞİ
CREATE TABLE IF NOT EXISTS personnel_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID REFERENCES personnel(id) NOT NULL,
  transfer_date DATE NOT NULL,
  old_firm_id UUID REFERENCES firms(id),
  new_firm_id UUID REFERENCES firms(id),
  old_project_id UUID REFERENCES projects(id),
  new_project_id UUID REFERENCES projects(id),
  old_taseron VARCHAR(200),
  new_taseron VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  salary_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. BORDRO DÖNEMLERİ
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  minimum_wage DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(firm_id, year, month)
);

-- 4. BORDRO KAYITLARI
CREATE TABLE IF NOT EXISTS payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID REFERENCES personnel(id) NOT NULL,
  period_id UUID REFERENCES payroll_periods(id) NOT NULL,
  firm_id UUID REFERENCES firms(id) NOT NULL,
  project_id UUID REFERENCES projects(id),
  gross_salary DECIMAL(15,2) NOT NULL,
  net_salary DECIMAL(15,2),
  overtime_hours DECIMAL(10,2) DEFAULT 0,
  overtime_pay DECIMAL(15,2) DEFAULT 0,
  holiday_overtime_hours DECIMAL(10,2) DEFAULT 0,
  holiday_overtime_pay DECIMAL(15,2) DEFAULT 0,
  missing_days INTEGER DEFAULT 0,
  missing_deduction DECIMAL(15,2) DEFAULT 0,
  bonus DECIMAL(15,2) DEFAULT 0,
  advance_deduction DECIMAL(15,2) DEFAULT 0,
  sgk_employee DECIMAL(15,2) DEFAULT 0,
  income_tax DECIMAL(15,2) DEFAULT 0,
  stamp_tax DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  net_pay DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(personnel_id, period_id)
);

-- 5. PUANTAJ KAYITLARI
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID REFERENCES personnel(id) NOT NULL,
  date DATE NOT NULL,
  overtime_hours DECIMAL(10,2) DEFAULT 0,
  is_holiday BOOLEAN DEFAULT false,
  missing_days DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(personnel_id, date)
);

-- 6. İZİN TALEPLERİ
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID REFERENCES personnel(id) NOT NULL,
  leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('annual', 'sick', 'unpaid', 'maternity', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. KIDEM/İHBAR HESAPLAMALARI
CREATE TABLE IF NOT EXISTS severance_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID REFERENCES personnel(id) NOT NULL,
  calculation_type VARCHAR(20) NOT NULL CHECK (calculation_type IN ('severance', 'notice')),
  calculation_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  years_worked DECIMAL(5,2) NOT NULL,
  gross_salary DECIMAL(15,2) NOT NULL,
  daily_rate DECIMAL(15,2) NOT NULL,
  total_days INTEGER NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  ceiling_amount DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. ASGARİ ÜCRET GEÇMİŞİ
CREATE TABLE IF NOT EXISTS minimum_wage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  gross_amount DECIMAL(15,2) NOT NULL,
  net_amount DECIMAL(15,2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year, month)
);

-- =============================================
-- INDEXLER
-- =============================================

CREATE INDEX IF NOT EXISTS idx_personnel_tc ON personnel(tc_number);
CREATE INDEX IF NOT EXISTS idx_personnel_firm ON personnel(firm_id);
CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel(status);
CREATE INDEX IF NOT EXISTS idx_transfers_personnel ON personnel_transfers(personnel_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_period ON payrolls(period_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_personnel ON payrolls(personnel_id);
CREATE INDEX IF NOT EXISTS idx_attendance_personnel ON attendance(personnel_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_leave_personnel ON leave_requests(personnel_id);
CREATE INDEX IF NOT EXISTS idx_severance_personnel ON severance_calculations(personnel_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE severance_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE minimum_wage_history ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "personnel_select" ON personnel FOR SELECT USING (true);
CREATE POLICY "personnel_transfers_select" ON personnel_transfers FOR SELECT USING (true);
CREATE POLICY "payroll_periods_select" ON payroll_periods FOR SELECT USING (true);
CREATE POLICY "payrolls_select" ON payrolls FOR SELECT USING (true);
CREATE POLICY "attendance_select" ON attendance FOR SELECT USING (true);
CREATE POLICY "leave_requests_select" ON leave_requests FOR SELECT USING (true);
CREATE POLICY "severance_select" ON severance_calculations FOR SELECT USING (true);
CREATE POLICY "minimum_wage_select" ON minimum_wage_history FOR SELECT USING (true);

-- Yetkili kullanıcılar yazabilir
CREATE POLICY "personnel_insert" ON personnel FOR INSERT WITH CHECK (true);
CREATE POLICY "personnel_update" ON personnel FOR UPDATE USING (true);
CREATE POLICY "personnel_transfers_insert" ON personnel_transfers FOR INSERT WITH CHECK (true);
CREATE POLICY "payroll_periods_insert" ON payroll_periods FOR INSERT WITH CHECK (true);
CREATE POLICY "payroll_periods_update" ON payroll_periods FOR UPDATE USING (true);
CREATE POLICY "payrolls_insert" ON payrolls FOR INSERT WITH CHECK (true);
CREATE POLICY "payrolls_update" ON payrolls FOR UPDATE USING (true);
CREATE POLICY "attendance_insert" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "attendance_update" ON attendance FOR UPDATE USING (true);
CREATE POLICY "leave_requests_insert" ON leave_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE USING (true);
CREATE POLICY "severance_insert" ON severance_calculations FOR INSERT WITH CHECK (true);
CREATE POLICY "minimum_wage_insert" ON minimum_wage_history FOR INSERT WITH CHECK (true);
