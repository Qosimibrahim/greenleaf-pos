import { api } from "./client";
import { Expense, BankAccount, ChartOfAccount, TaxSettings } from "../types";

export const expensesApi = {
  getAll: () =>
    api.get<Expense[]>("/expenses"),

  create: (data: {
    expense_date: string;
    description: string;
    amount: number;
    bank_account_id: string;
    expense_account_id: string;
  }) =>
    api.post<Expense>("/expenses", data),

  getBankAccounts: () =>
    api.get<BankAccount[]>("/bank-accounts"),

  createBankAccount: (data: Partial<BankAccount>) =>
    api.post<BankAccount>("/bank-accounts", data),

  getChartOfAccounts: () =>
    api.get<ChartOfAccount[]>("/chart-of-accounts"),

  getTaxSettings: () =>
    api.get<TaxSettings>("/tax_settings"),

  updateTaxSettings: (data: Partial<TaxSettings>) =>
    api.post<TaxSettings>("/tax_settings", data),
};
