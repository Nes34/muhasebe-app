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
}

export interface Check {
  id: string;
  check_number: string;
  check_type: 'received' | 'given';
  firm_id: string;
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
  project_id?: string;
  amount: number;
  description?: string;
  created_at: string;
  cash_register?: CashRegister;
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
  project_id?: string;
  amount: number;
  description?: string;
  created_at: string;
  bank_account?: BankAccount;
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
  vat_rate?: number;
  vat_amount?: number;
  withholding_rate?: number;  // Tevkifat oranı (%)
  withholding_amount?: number; // Tevkifat tutarı
  stopaj_rate?: number;       // Stopaj oranı (%)
  stopaj_amount?: number;     // Stopaj tutarı
  discount_rate?: number;
  discount_amount?: number;
  sort_order?: number;
}

export interface CheckInput {
  check_number: string;
  check_type: 'received' | 'given';
  firm_id: string;
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