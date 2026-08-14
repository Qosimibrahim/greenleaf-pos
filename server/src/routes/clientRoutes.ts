import { Router } from "express";
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
} from "../controllers/clientController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// /api/clients
router.get("/", authenticateToken, getClients);
router.post("/", authenticateToken, createClient);
router.put("/:id", authenticateToken, updateClient);
router.delete("/:id", authenticateToken, deleteClient);

export default router;
