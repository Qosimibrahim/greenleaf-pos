import { Response } from "express";
import { JournalEntry, JournalLine, ChartOfAccounts, BankAccount } from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function getReports(req: AuthenticatedRequest, res: Response) {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "From and To parameters are required" });
  }

  try {
    const fromDate = new Date(from.toString() + "T00:00:00.000Z");
    const toDate = new Date(to.toString() + "T23:59:59.999Z");

    const rawEntries = await JournalEntry.find({
      entry_date: { $gte: fromDate, $lte: toDate },
    }).sort({ entry_date: -1 });

    const entriesList = [];

    for (const e of rawEntries) {
      const lines = await JournalLine.find({ entry_id: e.id });
      const formattedLines = [];

      for (const line of lines) {
        const coa = await ChartOfAccounts.findById(line.account_id);
        formattedLines.push({
          debit: line.debit,
          credit: line.credit,
          account_id: line.account_id,
          chart_of_accounts: coa
            ? {
                code: coa.code,
                name: coa.name,
                type: coa.type,
              }
            : null,
        });
      }

      entriesList.push({
        id: e.id,
        entry_date: e.entry_date,
        memo: e.memo,
        journal_lines: formattedLines,
      });
    }

    const accounts = await ChartOfAccounts.find().sort({ code: 1 });
    const banks = await BankAccount.find().sort({ name: 1 });

    res.json({
      entries: entriesList,
      accounts,
      banks,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
