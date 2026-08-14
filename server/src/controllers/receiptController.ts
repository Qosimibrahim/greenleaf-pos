import { Response } from "express";
import { Receipt } from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function getReceipts(_req: AuthenticatedRequest, res: Response) {
  try {
    const receipts = await Receipt.find().sort({ createdAt: -1 });
    res.json(receipts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createReceipt(req: AuthenticatedRequest, res: Response) {
  try {
    const receipt = await Receipt.create({
      ...req.body,
      createdBy: req.user?.id,
    });
    res.status(201).json(receipt);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
