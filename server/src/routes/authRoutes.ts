import { Router } from "express";
import {
  signup,
  signin,
  getSession,
  getMe,
  createUser,
  getUsers,
  deleteUser,
} from "../controllers/authController.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Auth Endpoints -> Mounted at /api/auth
router.post("/signup", signup);
router.post("/signin", signin);
router.get("/session", getSession);
router.get("/me", authenticateToken, getMe);

export default router;

export const adminUserRouter = Router();
adminUserRouter.post("/create-user", authenticateToken, requireAdmin, createUser);
adminUserRouter.delete("/users/:id", authenticateToken, requireAdmin, deleteUser);

export const usersRouter = Router();
usersRouter.get("/", authenticateToken, getUsers);
usersRouter.delete("/:id", authenticateToken, requireAdmin, deleteUser);
