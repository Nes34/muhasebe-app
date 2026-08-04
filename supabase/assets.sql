-- =============================================
-- DEMİRBAŞ MODÜLÜ - VERİTABANI TABLOLARI
-- =============================================

-- 1. DEMİRBAŞLAR
CREATE TABLE IF NOT EXISTS fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'other',
  purchase_date DATE,
  purchase_price DECIMAL(15,2) DEFAULT 0,
  current_value DECIMAL(15,2) DEFAULT 0,
  depreciation_rate DECIMAL(5,2) DEFAULT 0,
  useful_life INTEGER DEFAULT 5,
  location VARCHAR(200),
  department VARCHAR(100),
  project_id UUID REFERENCES projects(id),
  firm_id UUID REFERENCES firms(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'maintenance')),
  serial_number VARCHAR(100),
  barcode VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ARAÇ DETAYLARI
CREATE TABLE IF NOT EXISTS vehicle_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE NOT NULL,
  plate_number VARCHAR(20) UNIQUE NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  color VARCHAR(50),
  engine_type VARCHAR(50),
  fuel_type VARCHAR(50) DEFAULT 'diesel',
  current_km INTEGER DEFAULT 0,
  last_maintenance_km INTEGER DEFAULT 0,
  next_maintenance_km INTEGER DEFAULT 10000,
  insurance_company VARCHAR(200),
  insurance_policy_no VARCHAR(100),
  insurance_start DATE,
  insurance_end DATE,
  insurance_premium DECIMAL(15,2) DEFAULT 0,
  inspection_date DATE,
  next_inspection_date DATE,
  assigned_to UUID REFERENCES personnel(id),
  assignment_date DATE,
  assignment_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. KM KAYITLARI
CREATE TABLE IF NOT EXISTS vehicle_km_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE NOT NULL,
  record_date DATE NOT NULL,
  km_value INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. YAKIT KAYITLARI
CREATE TABLE IF NOT EXISTS vehicle_fuel_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE NOT NULL,
  fuel_date DATE NOT NULL,
  fuel_type VARCHAR(50) DEFAULT 'diesel',
  liters DECIMAL(10,2) DEFAULT 0,
  amount DECIMAL(15,2) DEFAULT 0,
  km_at_fuel INTEGER,
  station VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ZİMMET GEÇMİŞİ
CREATE TABLE IF NOT EXISTS vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE NOT NULL,
  personnel_id UUID REFERENCES personnel(id) NOT NULL,
  assignment_date DATE NOT NULL,
  return_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CEZALAR
CREATE TABLE IF NOT EXISTS vehicle_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE NOT NULL,
  penalty_date DATE NOT NULL,
  penalty_type VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  points INTEGER DEFAULT 0,
  description TEXT,
  status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. MTV (MOTORLU TAŞITLAR VERGİSİ)
CREATE TABLE IF NOT EXISTS vehicle_mtv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  installment_1_amount DECIMAL(15,2) DEFAULT 0,
  installment_1_due DATE,
  installment_1_paid BOOLEAN DEFAULT false,
  installment_1_payment_date DATE,
  installment_2_amount DECIMAL(15,2) DEFAULT 0,
  installment_2_due DATE,
  installment_2_paid BOOLEAN DEFAULT false,
  installment_2_payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(asset_id, year)
);

-- =============================================
-- INDEXLER
-- =============================================

CREATE INDEX IF NOT EXISTS idx_fixed_assets_firm ON fixed_assets(firm_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_project ON fixed_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON fixed_assets(category);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_details_asset ON vehicle_details(asset_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_details_plate ON vehicle_details(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicle_km_asset ON vehicle_km_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_fuel_asset ON vehicle_fuel_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_asset ON vehicle_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_penalties_asset ON vehicle_penalties(asset_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_mtv_asset ON vehicle_mtv(asset_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_km_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_mtv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_assets_select" ON fixed_assets FOR SELECT USING (true);
CREATE POLICY "fixed_assets_insert" ON fixed_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "fixed_assets_update" ON fixed_assets FOR UPDATE USING (true);
CREATE POLICY "fixed_assets_delete" ON fixed_assets FOR DELETE USING (true);

CREATE POLICY "vehicle_details_select" ON vehicle_details FOR SELECT USING (true);
CREATE POLICY "vehicle_details_insert" ON vehicle_details FOR INSERT WITH CHECK (true);
CREATE POLICY "vehicle_details_update" ON vehicle_details FOR UPDATE USING (true);

CREATE POLICY "vehicle_km_select" ON vehicle_km_records FOR SELECT USING (true);
CREATE POLICY "vehicle_km_insert" ON vehicle_km_records FOR INSERT WITH CHECK (true);

CREATE POLICY "vehicle_fuel_select" ON vehicle_fuel_records FOR SELECT USING (true);
CREATE POLICY "vehicle_fuel_insert" ON vehicle_fuel_records FOR INSERT WITH CHECK (true);

CREATE POLICY "vehicle_assignments_select" ON vehicle_assignments FOR SELECT USING (true);
CREATE POLICY "vehicle_assignments_insert" ON vehicle_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "vehicle_assignments_update" ON vehicle_assignments FOR UPDATE USING (true);

CREATE POLICY "vehicle_penalties_select" ON vehicle_penalties FOR SELECT USING (true);
CREATE POLICY "vehicle_penalties_insert" ON vehicle_penalties FOR INSERT WITH CHECK (true);
CREATE POLICY "vehicle_penalties_update" ON vehicle_penalties FOR UPDATE USING (true);

CREATE POLICY "vehicle_mtv_select" ON vehicle_mtv FOR SELECT USING (true);
CREATE POLICY "vehicle_mtv_insert" ON vehicle_mtv FOR INSERT WITH CHECK (true);
CREATE POLICY "vehicle_mtv_update" ON vehicle_mtv FOR UPDATE USING (true);
