import { Router } from "express";
import { getReports } from "../controllers/reportController.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = Router();

// /api/reports
router.get("/", authenticateToken, requireAdmin, getReports);

export default router;
