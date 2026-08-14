import { Response } from "express";
import {
  StaffPayroll,
  PayrollRun,
  PayrollRunItem,
  BankAccount,
  ChartOfAccounts,
  JournalEntry,
  JournalLine,
  User,
} from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function getStaffPayroll(_req: AuthenticatedRequest, res: Response) {
  try {
    const list = await StaffPayroll.find();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function saveStaffPayroll(req: AuthenticatedRequest, res: Response) {
  const { user_id, base_salary, hourly_rate, hours_per_month, active } = req.body;
  try {
    const payroll = await StaffPayroll.findOneAndUpdate(
      { user_id },
      { base_salary, hourly_rate, hours_per_month, active },
      { upsert: true, new: true }
    );
    res.json(payroll);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function getPayrollRuns(_req: AuthenticatedRequest, res: Response) {
  try {
    const runs = await PayrollRun.find().sort({ run_at: -1 }).limit(12);
    const banks = await BankAccount.find();
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    const formatted = runs.map((run) => {
      const obj: Record<string, any> = run.toJSON();
      obj.bank_accounts = bankMap.get(run.bank_account_id);
      return obj;
    });

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createPayrollRun(req: AuthenticatedRequest, res: Response) {
  const { period_month, bank_account_id, total_gross } = req.body;
  try {
    const run = await PayrollRun.create({
      period_month,
      bank_account_id,
      total_gross,
      run_by: req.user?.id,
    });

    const bank = await BankAccount.findById(bank_account_id);
    if (!bank) return res.status(400).json({ message: "Invalid bank register" });
    const cashAcctId = bank.account_id;

    const payrollAcct = await ChartOfAccounts.findOne({ code: "6300" });
    if (!payrollAcct) return res.status(500).json({ message: "Payroll expense account 6300 not found" });

    // Create journal entry
    const entry = await JournalEntry.create({
      entry_date: new Date(),
      memo: `Payroll Payout Period: ${new Date(period_month).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
      reference_type: "payroll",
      reference_id: run.id,
      created_by: req.user?.id,
    });

    // Debit Payroll Expense (increases expense)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: payrollAcct.id,
      debit: total_gross,
      credit: 0,
    });

    // Credit Cash account (decreases asset)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: cashAcctId,
      debit: 0,
      credit: total_gross,
    });

    // Deduct from bank
    bank.balance = bank.balance - total_gross;
    await bank.save();

    res.status(201).json(run);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createPayrollRunItems(req: AuthenticatedRequest, res: Response) {
  try {
    const items = await PayrollRunItem.insertMany(req.body);
    res.status(201).json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function getUserRoles(_req: AuthenticatedRequest, res: Response) {
  try {
    const users = await User.find();
    const formatted = users.map((u) => ({
      user_id: u.id,
      role: u.role,
    }));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
