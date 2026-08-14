import { Router } from "express";
import {
  getExpenses,
  createExpense,
} from "../controllers/expenseController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// /api/expenses
router.get("/", authenticateToken, getExpenses);
router.post("/", authenticateToken, createExpense);

export default router;
