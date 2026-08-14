import { api } from "./client";
import { StaffPayroll, PayrollRun, PayrollRunItem, User } from "../types";

export const payrollApi = {
  getStaffPayroll: () =>
    api.get<StaffPayroll[]>("/staff-payroll"),

  saveStaffPayroll: (data: StaffPayroll) =>
    api.post<StaffPayroll>("/staff-payroll", data),

  getPayrollRuns: () =>
    api.get<PayrollRun[]>("/payroll-runs"),

  createPayrollRun: (data: { period_month: string; bank_account_id: string; total_gross: number }) =>
    api.post<PayrollRun>("/payroll-runs", data),

  createPayrollRunItems: (items: PayrollRunItem[]) =>
    api.post<PayrollRunItem[]>("/payroll-run-items", items),

  getUserRoles: () =>
    api.get<{ user_id: string; role: string }[]>("/user_roles"),

  getProfiles: () =>
    api.get<User[]>("/profiles"),
};
