import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";

export function uploadFile(req: AuthenticatedRequest, res: Response) {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ path: req.file.filename, url: fileUrl });
}
