import { api } from "./client";
import { ChartOfAccount, BankAccount } from "../types";

export interface JournalLineReport {
  debit: number;
  credit: number;
  account_id: string;
  chart_of_accounts: {
    code: string;
    name: string;
    type: string;
  } | null;
}

export interface JournalEntryReport {
  id: string;
  entry_date: string;
  memo?: string;
  journal_lines: JournalLineReport[];
}

export interface ReportsResponse {
  entries: JournalEntryReport[];
  accounts: ChartOfAccount[];
  banks: BankAccount[];
}

export const reportsApi = {
  getFinancialReport: (from: string, to: string) =>
    api.get<ReportsResponse>(`/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};
