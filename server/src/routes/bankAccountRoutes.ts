import { Router } from "express";
import {
  getBankAccounts,
  createBankAccount,
  getChartOfAccounts,
} from "../controllers/bankAccountController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// /api/bank-accounts
router.get("/", authenticateToken, getBankAccounts);
router.post("/", authenticateToken, createBankAccount);

export default router;

export const coaRouter = Router();
coaRouter.get("/", authenticateToken, getChartOfAccounts);
