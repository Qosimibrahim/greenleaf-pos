import { Router } from "express";
import { uploadFile } from "../controllers/storageController.js";
import { authenticateToken } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

// /api/storage/upload
router.post("/upload", authenticateToken, upload.single("file"), uploadFile);

export default router;
