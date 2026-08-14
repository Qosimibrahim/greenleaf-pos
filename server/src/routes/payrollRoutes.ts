import { Router } from "express";
import {
  getStaffPayroll,
  saveStaffPayroll,
  getPayrollRuns,
  createPayrollRun,
  createPayrollRunItems,
  getUserRoles,
} from "../controllers/payrollController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// /api/staff-payroll
router.get("/", authenticateToken, getStaffPayroll);
router.post("/", authenticateToken, saveStaffPayroll);

export default router;

export const payrollRunsRouter = Router();
payrollRunsRouter.get("/", authenticateToken, getPayrollRuns);
payrollRunsRouter.post("/", authenticateToken, createPayrollRun);

export const payrollRunItemsRouter = Router();
payrollRunItemsRouter.post("/", authenticateToken, createPayrollRunItems);

export const userRolesRouter = Router();
userRolesRouter.get("/", authenticateToken, getUserRoles);
