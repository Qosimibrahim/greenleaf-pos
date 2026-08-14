import { Router } from "express";
import {
  getReceipts,
  createReceipt,
} from "../controllers/receiptController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// /api/receipts
router.get("/", authenticateToken, getReceipts);
router.post("/", authenticateToken, createReceipt);

export default router;
