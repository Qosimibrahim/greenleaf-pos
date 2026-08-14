import { Response } from "express";
import { Product, ProductCategory, ProductImage, ProductDocument } from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

// Products CRUD
export async function getProducts(req: AuthenticatedRequest, res: Response) {
  const { sku } = req.query;
  try {
    if (sku) {
      const product = await Product.findOne({
        $or: [{ sku: sku.toString() }, { barcode: sku.toString() }],
      });
      if (!product) return res.status(404).json({ message: "Product not found" });
      return res.json(product);
    }
    const products = await Product.find().sort({ name: 1 });
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const product = await Product.create({
      ...req.body,
      createdBy: req.user?.id,
    });
    res.status(201).json(product);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteProduct(req: AuthenticatedRequest, res: Response) {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Bulk ERP import
export async function bulkImportProducts(req: AuthenticatedRequest, res: Response) {
  const { products: items } = req.body;
  try {
    let createdCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      let categoryId = null;
      if (item.categoryName && item.categoryName.trim()) {
        const catName = item.categoryName.trim();
        let cat = await ProductCategory.findOne({ name: { $regex: new RegExp(`^${catName}$`, "i") } });
        if (!cat) {
          cat = await ProductCategory.create({ name: catName, createdBy: req.user?.id });
        }
        categoryId = cat.id;
      }

      const queryArr = [];
      if (item.sku) queryArr.push({ sku: item.sku });
      if (item.barcode) queryArr.push({ barcode: item.barcode });

      let existing = null;
      if (queryArr.length > 0) {
        existing = await Product.findOne({ $or: queryArr });
      }

      if (existing) {
        if (item.unit_cost !== undefined) existing.unit_cost = item.unit_cost;
        if (item.selling_price !== undefined) existing.selling_price = item.selling_price;
        if (item.quantity !== undefined) existing.quantity += item.quantity;
        if (categoryId) existing.category_id = categoryId;
        if (item.description) existing.description = item.description;
        await existing.save();
        updatedCount++;
      } else {
        await Product.create({
          sku: item.sku || `SKU-${Date.now()}-${Math.round(Math.random() * 1000)}`,
          barcode: item.barcode || undefined,
          name: item.name,
          unit_cost: item.unit_cost || 0,
          selling_price: item.selling_price || 0,
          quantity: item.quantity || 0,
          low_stock_threshold: item.low_stock_threshold || 5,
          category_id: categoryId,
          description: item.description,
          createdBy: req.user?.id,
        });
        createdCount++;
      }
    }

    res.json({ createdCount, updatedCount });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Categories
export async function getCategories(_req: AuthenticatedRequest, res: Response) {
  try {
    const categories = await ProductCategory.find().sort({ name: 1 });
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const category = await ProductCategory.create({
      name: req.body.name,
      createdBy: req.user?.id,
    });
    res.status(201).json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Images
export async function getProductImages(req: AuthenticatedRequest, res: Response) {
  try {
    const images = await ProductImage.find({ product_id: req.query.product_id as string });
    res.json(images);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createProductImage(req: AuthenticatedRequest, res: Response) {
  try {
    const image = await ProductImage.create(req.body);
    res.status(201).json(image);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteProductImage(req: AuthenticatedRequest, res: Response) {
  try {
    await ProductImage.deleteOne({ id: req.query.id as string });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Documents
export async function getProductDocuments(req: AuthenticatedRequest, res: Response) {
  try {
    const docs = await ProductDocument.find({ product_id: req.query.product_id as string });
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createProductDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const doc = await ProductDocument.create(req.body);
    res.status(201).json(doc);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteProductDocument(req: AuthenticatedRequest, res: Response) {
  try {
    await ProductDocument.deleteOne({ id: req.query.id as string });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
