import { Router } from "express";
import {
  getTaxSettings,
  updateTaxSettings,
} from "../controllers/taxController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// /api/tax_settings
router.get("/", authenticateToken, getTaxSettings);
router.post("/", authenticateToken, updateTaxSettings);

export default router;
