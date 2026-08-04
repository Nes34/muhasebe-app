export interface Firm {
  id: string;
  code?: string;
  name: string;
  tax_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  type: 'customer' | 'supplier' | 'both';
  is_active: boolean;
  created_at: string;
}

export interface Cari {
  id: string;
  code?: string;
  name: string;
  tax_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  type: 'customer' | 'supplier' | 'both';
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  firm_id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  firm?: Firm;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  parent_id?: string;
  is_active: boolean;
}

export interface Transaction {
  id: string;
  transaction_number: number;
  transaction_date: string;
  transaction_type: 'income' | 'expense' | 'invoice' | 'delivery_note' | 'transfer' | 'stock_transfer' | 'cash_transfer' | 'bank_transfer';
  firm_id?: string;
  cari_id?: string;
  expense_category_id?: string;
  project_id?: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  invoice_number?: string;
  delivery_note_number?: string;
  is_exception: boolean;
  exception_reason?: string;
  description?: string;
  receipt_image_url?: string;
  created_by?: string;
  created_at: string;
  firm?: Firm;
  cari?: Cari;
  project?: Project;
  expense_category?: ExpenseCategory;
  items?: TransactionItem[];
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  vat_rate: number;
  vat_amount: number;
  discount_rate: number;
  discount_amount: number;
  sort_order: number;
  created_at: string;
  product?: Product;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  stock_quantity: number;
  unit: string;
  unit_price: number;
  firm_id?: string;
  is_active: boolean;
  created_at: string;
  barcode?: string;
  min_stock_level?: number;
  category?: string;
}

export interface Check {
  id: string;
  check_number: string;
  check_type: 'received' | 'given';
  firm_id: string;
  cari_id?: string;
  project_id?: string;
  bank_name?: string;
  bank_branch?: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: 'pending' | 'collected' | 'paid' | 'bounced' | 'cancelled' | 'endorsed';
  endorsed_to?: string;
  endorsed_date?: string;
  endorsed_by?: string;
  transaction_id?: string;
  notes?: string;
  created_at: string;
  firm?: Firm;
  cari?: Cari;
}

export interface CashRegister {
  id: string;
  name: string;
  firm_id?: string;
  current_balance: number;
  opening_balance?: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  firms?: Firm[];
}

export interface CashTransaction {
  id: string;
  cash_register_id: string;
  transaction_id?: string;
  transaction_type: 'in' | 'out';
  firm_id?: string;
  cari_id?: string;
  project_id?: string;
  amount: number;
  description?: string;
  created_at: string;
  cash_register?: CashRegister;
  cari?: Cari;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  branch?: string;
  account_number?: string;
  iban?: string;
  current_balance: number;
  opening_balance?: number;
  currency: string;
  firm_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_id?: string;
  transaction_type: 'in' | 'out';
  firm_id?: string;
  cari_id?: string;
  project_id?: string;
  amount: number;
  description?: string;
  created_at: string;
  bank_account?: BankAccount;
  cari?: Cari;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  role: 'admin' | 'accountant' | 'viewer';
  firm_id?: string;
  is_active: boolean;
}

export interface TransactionType {
  id: string;
  name: string;
  value: string;
  icon: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface StockUnit {
  id: string;
  name: string;
  symbol: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  type: 'check_due' | 'reminder' | 'info';
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface TransactionInput {
  transaction_date: string;
  transaction_type: 'income' | 'expense' | 'invoice' | 'delivery_note' | 'transfer' | 'stock_transfer' | 'cash_transfer' | 'bank_transfer';
  firm_id?: string;
  cari_id?: string;
  expense_category_id?: string;
  project_id?: string;
  amount: number;
  currency?: string;
  exchange_rate?: number;
  invoice_number?: string;
  delivery_note_number?: string;
  is_exception?: boolean;
  exception_reason?: string;
  description?: string;
  items?: TransactionItemInput[];
}

export interface TransactionItemInput {
  product_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  order_unit_price?: number;
  vat_rate?: number;
  vat_amount?: number;
  withholding_rate?: number;
  withholding_amount?: number;
  stopaj_rate?: number;
  stopaj_amount?: number;
  discount_rate?: number;
  discount_amount?: number;
  discount_rate_2?: number;
  discount_amount_2?: number;
  discount_rate_3?: number;
  discount_amount_3?: number;
  sort_order?: number;
}

export interface CheckInput {
  check_number: string;
  check_type: 'received' | 'given';
  firm_id: string;
  cari_id?: string;
  project_id?: string;
  bank_name?: string;
  bank_branch?: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status?: 'pending' | 'collected' | 'paid' | 'bounced' | 'cancelled';
  transaction_id?: string;
  notes?: string;
}

export interface AccountStatement {
  firm_id: string;
  firm_name: string;
  project_id?: string;
  project_name?: string;
  transactions: Transaction[];
  total_debt: number;
  total_credit: number;
  balance: number;
}

// =============================================
// SİPARİŞ YÖNETİMİ TİPLERİ
// =============================================

export interface Order {
  id: string;
  order_number: number;
  order_date: string;
  firm_id?: string;
  cari_id?: string;
  project_id?: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_amount: number;
  currency: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  firm?: Firm;
  cari?: Cari;
  project?: Project;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  delivered_quantity: number;
  invoiced_quantity: number;
  sort_order: number;
  created_at: string;
  product?: Product;
}

export interface OrderDelivery {
  id: string;
  order_id: string;
  delivery_number: string;
  delivery_date: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_by?: string;
  created_at: string;
  items?: OrderDeliveryItem[];
}

export interface OrderDeliveryItem {
  id: string;
  delivery_id: string;
  order_item_id: string;
  quantity: number;
  notes?: string;
  created_at: string;
  order_item?: OrderItem;
}

export interface OrderInvoice {
  id: string;
  order_id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_by?: string;
  created_at: string;
  items?: OrderInvoiceItem[];
}

export interface OrderInvoiceItem {
  id: string;
  invoice_id: string;
  order_item_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
  order_item?: OrderItem;
}

// =============================================
// PERSONEL MODÜLÜ TİPLERİ
// =============================================

export interface Personnel {
  id: string;
  firm_id?: string;
  tc_number: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  address?: string;
  position?: string;
  taseron: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'resigned' | 'on_leave';
  is_protected: boolean;
  gross_salary?: number;
  net_salary?: number;
  bank_name?: string;
  bank_iban?: string;
  sgk_number?: string;
  created_at: string;
  updated_at: string;
  firm?: Firm;
}

export interface PersonnelTransfer {
  id: string;
  personnel_id: string;
  transfer_date: string;
  old_firm_id?: string;
  new_firm_id?: string;
  old_project_id?: string;
  new_project_id?: string;
  old_taseron?: string;
  new_taseron?: string;
  is_active: boolean;
  salary_paid: boolean;
  created_at: string;
  personnel?: Personnel;
  old_firm?: Firm;
  new_firm?: Firm;
  old_project?: Project;
  new_project?: Project;
}

export interface PayrollPeriod {
  id: string;
  firm_id: string;
  year: number;
  month: number;
  minimum_wage: number;
  status: 'draft' | 'approved' | 'paid';
  created_at: string;
  firm?: Firm;
}

export interface Payroll {
  id: string;
  personnel_id: string;
  period_id: string;
  firm_id: string;
  project_id?: string;
  gross_salary: number;
  net_salary?: number;
  overtime_hours: number;
  overtime_pay: number;
  holiday_overtime_hours: number;
  holiday_overtime_pay: number;
  missing_days: number;
  missing_deduction: number;
  bonus: number;
  advance_deduction: number;
  sgk_employee: number;
  income_tax: number;
  stamp_tax: number;
  total_deductions: number;
  net_pay: number;
  status: 'draft' | 'approved' | 'paid';
  created_at: string;
  personnel?: Personnel;
  period?: PayrollPeriod;
}

export interface Attendance {
  id: string;
  personnel_id: string;
  date: string;
  overtime_hours: number;
  is_holiday: boolean;
  missing_days: number;
  notes?: string;
  created_at: string;
  personnel?: Personnel;
}

export interface LeaveRequest {
  id: string;
  personnel_id: string;
  leave_type: 'annual' | 'sick' | 'unpaid' | 'maternity' | 'other';
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  created_at: string;
  personnel?: Personnel;
}

export interface SeveranceCalculation {
  id: string;
  personnel_id: string;
  calculation_type: 'severance' | 'notice';
  calculation_date: string;
  start_date: string;
  end_date?: string;
  years_worked: number;
  gross_salary: number;
  daily_rate: number;
  total_days: number;
  total_amount: number;
  ceiling_amount?: number;
  notes?: string;
  created_at: string;
  personnel?: Personnel;
}

// =============================================
// DEMİRBAŞ MODÜLÜ TİPLERİ
// =============================================

export interface FixedAsset {
  id: string;
  asset_code: string;
  name: string;
  description?: string;
  category: string;
  purchase_date?: string;
  purchase_price: number;
  current_value: number;
  depreciation_rate: number;
  useful_life: number;
  location?: string;
  department?: string;
  project_id?: string;
  firm_id?: string;
  status: 'active' | 'disposed' | 'maintenance';
  serial_number?: string;
  barcode?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  firm?: Firm;
  project?: Project;
  vehicle?: VehicleDetail;
}

export interface VehicleDetail {
  id: string;
  asset_id: string;
  plate_number: string;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  engine_type?: string;
  fuel_type: string;
  current_km: number;
  last_maintenance_km: number;
  next_maintenance_km: number;
  insurance_company?: string;
  insurance_policy_no?: string;
  insurance_start?: string;
  insurance_end?: string;
  insurance_premium: number;
  inspection_date?: string;
  next_inspection_date?: string;
  assigned_to?: string;
  assignment_date?: string;
  assignment_notes?: string;
  created_at: string;
  updated_at: string;
  assigned_personnel?: Personnel;
}

export interface VehicleKmRecord {
  id: string;
  asset_id: string;
  record_date: string;
  km_value: number;
  notes?: string;
  created_at: string;
}

export interface VehicleFuelRecord {
  id: string;
  asset_id: string;
  fuel_date: string;
  fuel_type: string;
  liters: number;
  amount: number;
  km_at_fuel?: number;
  station?: string;
  notes?: string;
  created_at: string;
}

export interface VehicleAssignment {
  id: string;
  asset_id: string;
  personnel_id: string;
  assignment_date: string;
  return_date?: string;
  notes?: string;
  created_at: string;
  personnel?: Personnel;
}

export interface VehiclePenalty {
  id: string;
  asset_id: string;
  penalty_date: string;
  penalty_type: string;
  amount: number;
  points: number;
  description?: string;
  status: 'paid' | 'unpaid';
  payment_date?: string;
  created_at: string;
}

export interface VehicleMtv {
  id: string;
  asset_id: string;
  year: number;
  installment_1_amount: number;
  installment_1_due?: string;
  installment_1_paid: boolean;
  installment_1_payment_date?: string;
  installment_2_amount: number;
  installment_2_due?: string;
  installment_2_paid: boolean;
  installment_2_payment_date?: string;
  created_at: string;
}