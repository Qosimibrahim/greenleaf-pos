import { Router } from "express";
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  updateDeliveryStatus,
} from "../controllers/invoiceController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// /api/invoices
router.get("/", authenticateToken, getInvoices);
router.get("/:id", authenticateToken, getInvoiceById);
router.post("/", authenticateToken, createInvoice);
router.put("/:id", authenticateToken, updateInvoice);
router.patch("/:id/delivery-status", authenticateToken, updateDeliveryStatus);

export default router;
