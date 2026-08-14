import { Response } from "express";
import { Expense, BankAccount, ChartOfAccounts, JournalEntry, JournalLine } from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function createExpense(req: AuthenticatedRequest, res: Response) {
  const { expense_date, description, amount, bank_account_id, expense_account_id } = req.body;
  try {
    const expense = await Expense.create({
      expense_date,
      description,
      amount,
      bank_account_id,
      expense_account_id,
      created_by: req.user?.id,
    });

    const bank = await BankAccount.findById(bank_account_id);
    if (!bank) return res.status(400).json({ message: "Invalid bank account ID" });
    const cashAcctId = bank.account_id;

    // Create journal entry
    const entry = await JournalEntry.create({
      entry_date: expense_date,
      memo: description,
      reference_type: "expense",
      reference_id: expense.id,
      created_by: req.user?.id,
    });

    // Debit Expense account (increases expense)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: expense_account_id,
      debit: amount,
      credit: 0,
    });

    // Credit Bank register account (decreases asset)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: cashAcctId,
      debit: 0,
      credit: amount,
    });

    // Update bank balance
    bank.balance = bank.balance - amount;
    await bank.save();

    res.status(201).json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function getExpenses(_req: AuthenticatedRequest, res: Response) {
  try {
    const list = await Expense.find().sort({ expense_date: -1 }).limit(20);
    const coas = await ChartOfAccounts.find();
    const coaMap = new Map(coas.map((c) => [c.id, c]));
    const banks = await BankAccount.find();
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    const formatted = list.map((exp) => {
      const obj: Record<string, any> = exp.toJSON();
      obj.chart_of_accounts = coaMap.get(exp.expense_account_id);
      obj.bank_accounts = bankMap.get(exp.bank_account_id);
      return obj;
    });

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
