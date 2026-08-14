import { Response } from "express";
import { BankAccount, ChartOfAccounts } from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function getBankAccounts(_req: AuthenticatedRequest, res: Response) {
  try {
    const registers = await BankAccount.find().sort({ name: 1 });
    res.json(registers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createBankAccount(req: AuthenticatedRequest, res: Response) {
  try {
    const cashAcct = await ChartOfAccounts.findOne({ code: "1000" });
    const register = await BankAccount.create({
      ...req.body,
      account_id: cashAcct?.id,
    });
    res.status(201).json(register);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function getChartOfAccounts(_req: AuthenticatedRequest, res: Response) {
  try {
    const list = await ChartOfAccounts.find().sort({ code: 1 });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
