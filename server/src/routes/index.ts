import { Router } from "express";
import authRoutes, { adminUserRouter, usersRouter } from "./authRoutes.js";
import productRoutes, {
  categoryRouter,
  productImageRouter,
  productDocumentRouter,
} from "./productRoutes.js";
import clientRoutes from "./clientRoutes.js";
import invoiceRoutes from "./invoiceRoutes.js";
import bankAccountRoutes, { coaRouter } from "./bankAccountRoutes.js";
import expenseRoutes from "./expenseRoutes.js";
import payrollRoutes, {
  payrollRunsRouter,
  payrollRunItemsRouter,
  userRolesRouter,
} from "./payrollRoutes.js";
import receiptRoutes from "./receiptRoutes.js";
import taxRoutes from "./taxRoutes.js";
import ledgerRoutes from "./ledgerRoutes.js";
import reportRoutes from "./reportRoutes.js";
import storageRoutes from "./storageRoutes.js";

const apiRouter = Router();

// Health check endpoint -> GET /api/health
apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Greenleaf POS API",
  });
});

// Domain Routes
apiRouter.use("/auth", authRoutes);
apiRouter.use("/admin", adminUserRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/profiles", usersRouter);

apiRouter.use("/products", productRoutes);
apiRouter.use("/product_categories", categoryRouter);
apiRouter.use("/product_images", productImageRouter);
apiRouter.use("/product_documents", productDocumentRouter);

apiRouter.use("/clients", clientRoutes);
apiRouter.use("/invoices", invoiceRoutes);

apiRouter.use("/bank-accounts", bankAccountRoutes);
apiRouter.use("/chart-of-accounts", coaRouter);

apiRouter.use("/expenses", expenseRoutes);

apiRouter.use("/staff-payroll", payrollRoutes);
apiRouter.use("/payroll-runs", payrollRunsRouter);
apiRouter.use("/payroll-run-items", payrollRunItemsRouter);
apiRouter.use("/user_roles", userRolesRouter);

apiRouter.use("/receipts", receiptRoutes);
apiRouter.use("/tax_settings", taxRoutes);
apiRouter.use("/ledger", ledgerRoutes);
apiRouter.use("/reports", reportRoutes);
apiRouter.use("/storage", storageRoutes);

export default apiRouter;
