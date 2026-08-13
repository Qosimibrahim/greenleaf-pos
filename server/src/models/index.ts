import mongoose, { Schema, Document } from "mongoose";

// Set global JSON options to convert _id to id and remove __v
mongoose.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});
mongoose.set("toObject", {
  virtuals: true,
});

// 1. User Schema
export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: "admin" | "staff";
  fullName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "staff"], default: "staff" },
    fullName: { type: String },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

// 2. ProductCategory Schema
export interface IProductCategory extends Document {
  name: string;
  createdBy?: string;
  createdAt: Date;
}
const ProductCategorySchema = new Schema<IProductCategory>(
  {
    name: { type: String, required: true, unique: true },
    createdBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 3. Product Schema
export interface IProduct extends Document {
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
  createdAt: Date;
  updatedAt: Date;
}
const ProductSchema = new Schema<IProduct>(
  {
    sku: { type: String, required: true, unique: true },
    barcode: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    unit_cost: { type: Number, default: 0 },
    selling_price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    low_stock_threshold: { type: Number, default: 5 },
    description: { type: String },
    category_id: { type: String }, // references ProductCategory id
    imageUrl: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true }
);

// 4. ProductImage Schema
export interface IProductImage extends Document {
  product_id: string;
  storage_path: string;
  is_primary: boolean;
  createdAt: Date;
}
const ProductImageSchema = new Schema<IProductImage>(
  {
    product_id: { type: String, required: true },
    storage_path: { type: String, required: true },
    is_primary: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 5. ProductDocument Schema
export interface IProductDocument extends Document {
  product_id: string;
  storage_path: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  createdAt: Date;
}
const ProductDocumentSchema = new Schema<IProductDocument>(
  {
    product_id: { type: String, required: true },
    storage_path: { type: String, required: true },
    file_name: { type: String, required: true },
    file_type: { type: String },
    file_size: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 6. Client Schema
export interface IClient extends Document {
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true },
    email: { type: String },
    company: { type: String },
    phone: { type: String },
    address: { type: String },
    notes: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true }
);

// 7. Invoice Schema
export interface IInvoiceLineItem {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}
export interface IInvoice extends Document {
  invoice_number: string;
  client_id: string;
  status: "draft" | "paid" | "partially_paid" | "unpaid";
  delivery_status: "pending" | "delivered";
  issue_date: Date;
  due_date?: Date;
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
  paid_at?: Date;
  stock_committed: boolean;
  createdBy?: string;
  line_items: IInvoiceLineItem[];
  createdAt: Date;
  updatedAt: Date;
}
const InvoiceSchema = new Schema<IInvoice>(
  {
    invoice_number: { type: String, required: true, unique: true },
    client_id: { type: String, required: true },
    status: { type: String, enum: ["draft", "paid", "partially_paid", "unpaid"], default: "draft" },
    delivery_status: { type: String, enum: ["pending", "delivered"], default: "pending" },
    issue_date: { type: Date, default: Date.now },
    due_date: { type: Date },
    subtotal: { type: Number, default: 0 },
    tax_rate: { type: Number, default: 0 },
    tax_amount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    discount_type: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    discount_value: { type: Number, default: 0 },
    discount_amount: { type: Number, default: 0 },
    amount_paid: { type: Number, default: 0 },
    payment_method: { type: String },
    bank_account_id: { type: String },
    notes: { type: String },
    custom_client: {
      name: { type: String },
      company: { type: String },
      phone: { type: String },
      address: { type: String },
    },
    custom_bank_details: {
      bank_name: { type: String },
      account_name: { type: String },
      account_number: { type: String },
    },
    paid_at: { type: Date },
    stock_committed: { type: Boolean, default: false },
    createdBy: { type: String },
    line_items: [
      {
        product_id: { type: String },
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit_price: { type: Number, required: true },
        line_total: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

// 8. TaxSettings Schema
export interface ITaxSettings extends Document {
  rate: number;
  currency: string;
  exchange_rate: number;
  currency_symbol: string;
  updatedAt: Date;
}
const TaxSettingsSchema = new Schema<ITaxSettings>(
  {
    rate: { type: Number, default: 0.075 },
    currency: { type: String, default: "NGN" },
    exchange_rate: { type: Number, default: 1 },
    currency_symbol: { type: String, default: "₦" },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 9. BankAccount Schema
export interface IBankAccount extends Document {
  name: string;
  kind: "cash" | "bank" | "mobile";
  account_id?: string; // references ChartOfAccounts id
  balance: number;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const BankAccountSchema = new Schema<IBankAccount>(
  {
    name: { type: String, required: true },
    kind: { type: String, enum: ["cash", "bank", "mobile"], default: "cash" },
    account_id: { type: String },
    balance: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 10. ChartOfAccounts Schema
export interface IChartOfAccounts extends Document {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  is_system: boolean;
  createdAt: Date;
}
const ChartOfAccountsSchema = new Schema<IChartOfAccounts>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["asset", "liability", "equity", "revenue", "expense"], required: true },
    is_system: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 11. JournalEntry Schema
export interface IJournalEntry extends Document {
  entry_date: Date;
  memo?: string;
  reference_type?: string;
  reference_id?: string;
  created_by?: string;
  createdAt: Date;
}
const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    entry_date: { type: Date, default: Date.now },
    memo: { type: String },
    reference_type: { type: String },
    reference_id: { type: String },
    created_by: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 12. JournalLine Schema
export interface IJournalLine extends Document {
  entry_id: string; // references JournalEntry id
  account_id: string; // references ChartOfAccounts id
  debit: number;
  credit: number;
  createdAt: Date;
}
const JournalLineSchema = new Schema<IJournalLine>(
  {
    entry_id: { type: String, required: true },
    account_id: { type: String, required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 13. StaffPayroll Schema
export interface IStaffPayroll extends Document {
  user_id: string; // references User id
  base_salary: number;
  hourly_rate: number;
  hours_per_month: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const StaffPayrollSchema = new Schema<IStaffPayroll>(
  {
    user_id: { type: String, required: true, unique: true },
    base_salary: { type: Number, default: 0 },
    hourly_rate: { type: Number, default: 0 },
    hours_per_month: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 14. PayrollRun Schema
export interface IPayrollRun extends Document {
  period_month: Date;
  bank_account_id: string; // references BankAccount id
  total_gross: number;
  run_at: Date;
  run_by?: string;
}
const PayrollRunSchema = new Schema<IPayrollRun>(
  {
    period_month: { type: Date, required: true },
    bank_account_id: { type: String, required: true },
    total_gross: { type: Number, default: 0 },
    run_at: { type: Date, default: Date.now },
    run_by: { type: String },
  },
  { timestamps: false }
);

// 15. PayrollRunItem Schema
export interface IPayrollRunItem extends Document {
  run_id: string; // references PayrollRun id
  user_id: string; // references User id
  gross_pay: number;
}
const PayrollRunItemSchema = new Schema<IPayrollRunItem>(
  {
    run_id: { type: String, required: true },
    user_id: { type: String, required: true },
    gross_pay: { type: Number, default: 0 },
  },
  { timestamps: false }
);

// 16. Receipt Schema
export interface IReceipt extends Document {
  invoice_id: string; // references Invoice id
  amount_paid: number;
  payment_method: string;
  createdBy?: string;
  createdAt: Date;
}
const ReceiptSchema = new Schema<IReceipt>(
  {
    invoice_id: { type: String, required: true },
    amount_paid: { type: Number, required: true },
    payment_method: { type: String, required: true },
    createdBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 17. Expense Schema
export interface IExpense extends Document {
  expense_date: Date;
  description: string;
  amount: number;
  bank_account_id: string; // references BankAccount id
  expense_account_id: string; // references ChartOfAccounts id
  created_by?: string;
  createdAt: Date;
}
const ExpenseSchema = new Schema<IExpense>(
  {
    expense_date: { type: Date, default: Date.now },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    bank_account_id: { type: String, required: true },
    expense_account_id: { type: String, required: true },
    created_by: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Register and export Models
export const User = mongoose.model<IUser>("User", UserSchema);
export const ProductCategory = mongoose.model<IProductCategory>("ProductCategory", ProductCategorySchema);
export const Product = mongoose.model<IProduct>("Product", ProductSchema);
export const ProductImage = mongoose.model<IProductImage>("ProductImage", ProductImageSchema);
export const ProductDocument = mongoose.model<IProductDocument>("ProductDocument", ProductDocumentSchema);
export const Client = mongoose.model<IClient>("Client", ClientSchema);
export const Invoice = mongoose.model<IInvoice>("Invoice", InvoiceSchema);
export const TaxSettings = mongoose.model<ITaxSettings>("TaxSettings", TaxSettingsSchema);
export const BankAccount = mongoose.model<IBankAccount>("BankAccount", BankAccountSchema);
export const ChartOfAccounts = mongoose.model<IChartOfAccounts>("ChartOfAccounts", ChartOfAccountsSchema);
export const JournalEntry = mongoose.model<IJournalEntry>("JournalEntry", JournalEntrySchema);
export const JournalLine = mongoose.model<IJournalLine>("JournalLine", JournalLineSchema);
export const StaffPayroll = mongoose.model<IStaffPayroll>("StaffPayroll", StaffPayrollSchema);
export const PayrollRun = mongoose.model<IPayrollRun>("PayrollRun", PayrollRunSchema);
export const PayrollRunItem = mongoose.model<IPayrollRunItem>("PayrollRunItem", PayrollRunItemSchema);
export const Receipt = mongoose.model<IReceipt>("Receipt", ReceiptSchema);
export const Expense = mongoose.model<IExpense>("Expense", ExpenseSchema);
