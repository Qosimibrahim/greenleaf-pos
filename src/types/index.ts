export type AppRole = "admin" | "staff";

export interface User {
  id: string;
  email: string;
  role: AppRole;
  fullName?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  user: User;
  access_token: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  createdBy?: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  unit_cost: number;
  selling_price: number;
  quantity: number;
  low_stock_threshold: number;
  description?: string;
  category_id?: string;
  imageUrl?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  is_primary: boolean;
  createdAt?: string;
}

export interface ProductDocument {
  id: string;
  product_id: string;
  storage_path: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceLineItem {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  status: "draft" | "paid" | "partially_paid" | "unpaid";
  delivery_status: "pending" | "delivered";
  issue_date: string;
  due_date?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  discount_amount: number;
  amount_paid: number;
  payment_method?: string;
  bank_account_id?: string;
  notes?: string;
  custom_client?: {
    name?: string;
    company?: string;
    phone?: string;
    address?: string;
  };
  custom_bank_details?: {
    bank_name?: string;
    account_name?: string;
    account_number?: string;
  };
  paid_at?: string;
  stock_committed: boolean;
  createdBy?: string;
  created_by?: string;
  created_by_user?: {
    fullName?: string;
    email?: string;
    role?: string;
  };
  clients?: Client;
  line_items: InvoiceLineItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  kind: "cash" | "bank" | "mobile";
  account_id?: string;
  balance: number;
  is_active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  is_system: boolean;
  createdAt?: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  bank_account_id: string;
  expense_account_id: string;
  created_by?: string;
  chart_of_accounts?: ChartOfAccount;
  bank_accounts?: BankAccount;
  createdAt?: string;
}

export interface TaxSettings {
  rate: number;
  currency: string;
  exchange_rate: number;
  currency_symbol: string;
  updatedAt?: string;
}

export interface StaffPayroll {
  id?: string;
  user_id: string;
  base_salary: number;
  hourly_rate: number;
  hours_per_month: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PayrollRun {
  id: string;
  period_month: string;
  bank_account_id: string;
  total_gross: number;
  run_at: string;
  run_by?: string;
  bank_accounts?: BankAccount;
}

export interface PayrollRunItem {
  id?: string;
  run_id: string;
  user_id: string;
  gross_pay: number;
}

export interface Receipt {
  id: string;
  invoice_id: string;
  amount_paid: number;
  payment_method: string;
  createdBy?: string;
  createdAt?: string;
}
