import { Router } from "express";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkImportProducts,
  getCategories,
  createCategory,
  getProductImages,
  createProductImage,
  deleteProductImage,
  getProductDocuments,
  createProductDocument,
  deleteProductDocument,
} from "../controllers/productController.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = Router();

// /api/products
router.get("/", authenticateToken, getProducts);
router.post("/", authenticateToken, createProduct);
router.post("/bulk", authenticateToken, requireAdmin, bulkImportProducts);
router.put("/:id", authenticateToken, updateProduct);
router.delete("/:id", authenticateToken, deleteProduct);

export default router;

export const categoryRouter = Router();
categoryRouter.get("/", authenticateToken, getCategories);
categoryRouter.post("/", authenticateToken, createCategory);

export const productImageRouter = Router();
productImageRouter.get("/", authenticateToken, getProductImages);
productImageRouter.post("/", authenticateToken, createProductImage);
productImageRouter.delete("/", authenticateToken, deleteProductImage);

export const productDocumentRouter = Router();
productDocumentRouter.get("/", authenticateToken, getProductDocuments);
productDocumentRouter.post("/", authenticateToken, createProductDocument);
productDocumentRouter.delete("/", authenticateToken, deleteProductDocument);
