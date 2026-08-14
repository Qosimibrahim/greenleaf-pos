import { Response } from "express";
import { TaxSettings } from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function getTaxSettings(_req: AuthenticatedRequest, res: Response) {
  try {
    const settings = await TaxSettings.findOne();
    res.json(settings || { rate: 0.075, currency: "NGN", exchange_rate: 1, currency_symbol: "₦" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateTaxSettings(req: AuthenticatedRequest, res: Response) {
  const { rate, currency, exchange_rate, currency_symbol } = req.body;
  try {
    const updateObj: any = {};
    if (rate !== undefined) updateObj.rate = Number(rate);
    if (currency !== undefined) updateObj.currency = currency;
    if (exchange_rate !== undefined) updateObj.exchange_rate = Number(exchange_rate);
    if (currency_symbol !== undefined) updateObj.currency_symbol = currency_symbol;

    const settings = await TaxSettings.findOneAndUpdate(
      {},
      updateObj,
      { upsert: true, new: true }
    );
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
