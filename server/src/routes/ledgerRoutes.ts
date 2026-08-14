import { Router } from "express";
import { processLedgerPayment } from "../controllers/ledgerController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// /api/ledger
router.post("/", authenticateToken, processLedgerPayment);

export default router;
