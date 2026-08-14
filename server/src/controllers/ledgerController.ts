import { Response } from "express";
import {
  Invoice,
  BankAccount,
  ChartOfAccounts,
  JournalEntry,
  JournalLine,
  Product,
  Receipt,
} from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function processLedgerPayment(req: AuthenticatedRequest, res: Response) {
  const { invoice_id, payment_method, bank_account_id, payment_amount } = req.body;
  try {
    const invoice = await Invoice.findById(invoice_id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Invoice already fully paid" });
    }

    const currentPaid = Number(invoice.amount_paid || 0);
    const remainingBalance = Math.max(0, invoice.total - currentPaid);
    const amountToPay = payment_amount !== undefined ? Math.min(Number(payment_amount), remainingBalance) : remainingBalance;

    if (amountToPay <= 0) {
      return res.status(400).json({ message: "No balance due for this invoice" });
    }

    const bank = await BankAccount.findById(bank_account_id);
    if (!bank) return res.status(400).json({ message: "Invalid bank / register ID" });

    const cashAcct = await ChartOfAccounts.findOne({ code: "1000" });
    const assetAcctId = bank.account_id || cashAcct?.id;

    const revAcct = await ChartOfAccounts.findOne({ code: "4000" });
    const taxAcct = await ChartOfAccounts.findOne({ code: "2100" });
    const cogsAcct = await ChartOfAccounts.findOne({ code: "5000" });
    const invAcct = await ChartOfAccounts.findOne({ code: "1200" });

    if (!assetAcctId || !revAcct || !taxAcct || !cogsAcct || !invAcct) {
      return res.status(500).json({ message: "Required system chart of accounts missing" });
    }

    // 2. Create double-entry journal entry
    const entry = await JournalEntry.create({
      entry_date: new Date(),
      memo: `Invoice ${invoice.invoice_number} payment (${amountToPay >= remainingBalance ? "Full" : "Deposit/Partial"})`,
      reference_type: "invoice",
      reference_id: invoice.id,
      created_by: req.user?.id,
    });

    // Line A: Debit register (Increases Asset by amount paid)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: assetAcctId,
      debit: amountToPay,
      credit: 0,
    });

    // Line B & C: Credit Revenue & Sales Tax proportionally
    const taxRatio = invoice.total > 0 ? invoice.tax_amount / invoice.total : 0;
    const taxPortion = parseFloat((amountToPay * taxRatio).toFixed(2));
    const revPortion = parseFloat((amountToPay - taxPortion).toFixed(2));

    await JournalLine.create({
      entry_id: entry.id,
      account_id: revAcct.id,
      debit: 0,
      credit: revPortion,
    });

    if (taxPortion > 0) {
      await JournalLine.create({
        entry_id: entry.id,
        account_id: taxAcct.id,
        debit: 0,
        credit: taxPortion,
      });
    }

    // 3. Compute cost of goods sold (COGS) & Inventory adjustments on first payment/deposit
    if (!invoice.stock_committed) {
      let totalCost = 0;
      for (const item of invoice.line_items) {
        if (item.product_id) {
          const prod = await Product.findById(item.product_id);
          if (prod) {
            totalCost += item.quantity * prod.unit_cost;
            prod.quantity = Math.max(0, prod.quantity - item.quantity);
            await prod.save();
          }
        }
      }

      if (totalCost > 0) {
        await JournalLine.create({
          entry_id: entry.id,
          account_id: cogsAcct.id,
          debit: totalCost,
          credit: 0,
        });

        await JournalLine.create({
          entry_id: entry.id,
          account_id: invAcct.id,
          debit: 0,
          credit: totalCost,
        });
      }
      invoice.stock_committed = true;
    }

    // 4. Update Cash register live balance
    bank.balance = bank.balance + amountToPay;
    await bank.save();

    // 5. Update Invoice status & paid amount
    const newTotalPaid = currentPaid + amountToPay;
    invoice.amount_paid = newTotalPaid;
    const isPaidInFull = newTotalPaid >= (invoice.total - 0.01);
    invoice.status = isPaidInFull ? "paid" : "partially_paid";
    invoice.payment_method = payment_method;
    invoice.bank_account_id = bank_account_id;
    if (isPaidInFull) {
      invoice.paid_at = new Date();
    }
    await invoice.save();

    // 6. Log Receipt log
    await Receipt.create({
      invoice_id: invoice.id,
      amount_paid: amountToPay,
      payment_method,
      createdBy: req.user?.id,
    });

    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
