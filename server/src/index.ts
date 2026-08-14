import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { connectDB } from "./db.js";
import {
  User,
  Product,
  ProductCategory,
  Client,
  Invoice,
  TaxSettings,
  BankAccount,
  ChartOfAccounts,
  JournalEntry,
  JournalLine,
  StaffPayroll,
  PayrollRun,
  PayrollRunItem,
  Receipt,
  Expense,
  ProductImage,
  ProductDocument,
} from "./models/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "greenleaf-secret-key-12345";

// Multer storage for uploads
const uploadDir = path.join(process.cwd(), "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

// Authentication Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

// Admin only checking helper
function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Connect to MongoDB
connectDB();

// ================= AUTH ENDPOINTS =================

app.post("/api/auth/signup", async (req: any, res: any) => {
  const { email, password, fullName } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    // Public signup creates a standalone store Admin instance
    const user = await User.create({
      email,
      passwordHash,
      role: "admin",
      fullName: fullName || email.split("@")[0],
    });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.fullName, demo_role: user.role },
      },
      access_token: token,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/auth/signin", async (req: any, res: any) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.fullName, demo_role: user.role },
      },
      access_token: token,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Used to fetch session state
app.get("/api/auth/session", (req: any, res: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.json({ session: null });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, payload: any) => {
    if (err) return res.json({ session: null });
    try {
      const user = await User.findById(payload.id);
      if (!user) return res.json({ session: null });
      res.json({
        session: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { full_name: user.fullName, demo_role: user.role },
          },
          access_token: token,
        },
      });
    } catch {
      res.json({ session: null });
    }
  });
});

app.get("/api/auth/me", authenticateToken, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Admin endpoint to create user
app.post("/api/admin/create-user", authenticateToken, requireAdmin, async (req: any, res: any) => {
  const { email, password, role, full_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ message: "Email, password, and full name are required" });
  }
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      role: role || "staff",
      fullName: full_name.trim(),
    });

    res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Profiles / Users directory endpoints
app.get(["/api/profiles", "/api/users"], authenticateToken, async (req: any, res: any) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.fullName || u.email.split("@")[0],
      full_name: u.fullName || u.email.split("@")[0],
      createdAt: u.createdAt,
    }));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user endpoint
app.delete(["/api/users/:id", "/api/admin/users/:id"], authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    const deletedUser = await User.findByIdAndDelete(targetUserId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully", id: targetUserId });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= CLIENTS ENDPOINTS =================

app.get("/api/clients", authenticateToken, async (req: any, res: any) => {
  try {
    const clients = await Client.find().sort({ name: 1 });
    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/clients", authenticateToken, async (req: any, res: any) => {
  try {
    const client = await Client.create({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json(client);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/clients/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(client);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/clients/:id", authenticateToken, async (req: any, res: any) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: "Client deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= CATEGORIES ENDPOINTS =================

app.get("/api/product_categories", authenticateToken, async (req: any, res: any) => {
  try {
    const categories = await ProductCategory.find().sort({ name: 1 });
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/product_categories", authenticateToken, async (req: any, res: any) => {
  try {
    const category = await ProductCategory.create({
      name: req.body.name,
      createdBy: req.user.id,
    });
    res.status(201).json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= PRODUCTS ENDPOINTS =================

// Bulk import ERP CSV upsert engine
app.post("/api/products/bulk", authenticateToken, requireAdmin, async (req: any, res: any) => {
  const { products: items } = req.body;
  try {
    let createdCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      // 1. Resolve category
      let categoryId = null;
      if (item.categoryName && item.categoryName.trim()) {
        const catName = item.categoryName.trim();
        let cat = await ProductCategory.findOne({ name: { $regex: new RegExp(`^${catName}$`, "i") } });
        if (!cat) {
          cat = await ProductCategory.create({ name: catName, createdBy: req.user.id });
        }
        categoryId = cat.id;
      }

      // 2. Check for matches by SKU or Barcode
      const queryArr = [];
      if (item.sku) queryArr.push({ sku: item.sku });
      if (item.barcode) queryArr.push({ barcode: item.barcode });

      let existing = null;
      if (queryArr.length > 0) {
        existing = await Product.findOne({ $or: queryArr });
      }

      if (existing) {
        // Upsert: update prices, increment stock, map category and description
        if (item.unit_cost !== undefined) existing.unit_cost = item.unit_cost;
        if (item.selling_price !== undefined) existing.selling_price = item.selling_price;
        if (item.quantity !== undefined) existing.quantity += item.quantity;
        if (categoryId) existing.category_id = categoryId;
        if (item.description) existing.description = item.description;
        await existing.save();
        updatedCount++;
      } else {
        // Create brand new product
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
          createdBy: req.user.id,
        });
        createdCount++;
      }
    }

    res.json({ createdCount, updatedCount });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/products", authenticateToken, async (req: any, res: any) => {
  const { sku } = req.query;
  try {
    if (sku) {
      // Find single product by SKU or Barcode (used by scanning hooks)
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
});

app.post("/api/products", authenticateToken, async (req: any, res: any) => {
  try {
    const product = await Product.create({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json(product);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/products/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/products/:id", authenticateToken, async (req: any, res: any) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= IMAGES & ATTACHMENTS =================

app.get("/api/product_images", authenticateToken, async (req: any, res: any) => {
  try {
    const images = await ProductImage.find({ product_id: req.query.product_id });
    res.json(images);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/product_images", authenticateToken, async (req: any, res: any) => {
  try {
    const image = await ProductImage.create(req.body);
    res.status(201).json(image);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/product_images", authenticateToken, async (req: any, res: any) => {
  try {
    await ProductImage.deleteOne({ id: req.query.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/product_documents", authenticateToken, async (req: any, res: any) => {
  try {
    const docs = await ProductDocument.find({ product_id: req.query.product_id });
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/product_documents", authenticateToken, async (req: any, res: any) => {
  try {
    const doc = await ProductDocument.create(req.body);
    res.status(201).json(doc);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/product_documents", authenticateToken, async (req: any, res: any) => {
  try {
    await ProductDocument.deleteOne({ id: req.query.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// File upload endpoints (Multer)
app.post("/api/storage/upload", authenticateToken, upload.single("file"), (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ path: req.file.filename, url: fileUrl });
});

// ================= INVOICES ENDPOINTS =================

app.get("/api/invoices", authenticateToken, async (req: any, res: any) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    // Join manually since client_id and createdBy are strings
    const clients = await Client.find();
    const users = await User.find();
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    
    const formatted = invoices.map((inv) => {
      const obj: Record<string, any> = inv.toJSON();
      obj.clients = clientMap.get(inv.client_id);
      const creator = inv.createdBy ? userMap.get(inv.createdBy) : null;
      obj.created_by_user = {
        fullName: creator?.fullName || (inv as any).created_by || "System",
        email: creator?.email,
        role: creator?.role || "staff",
      };
      obj.created_by = (inv as any).created_by || creator?.fullName || "System";
      return obj;
    });

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/invoices/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const client = await Client.findById(invoice.client_id);
    const creator = invoice.createdBy ? await User.findById(invoice.createdBy) : null;
    const result: Record<string, any> = invoice.toJSON();
    result.clients = client;
    result.created_by_user = {
      fullName: creator?.fullName || (invoice as any).created_by || "System",
      email: creator?.email,
      role: creator?.role || "staff",
    };
    result.created_by = (invoice as any).created_by || creator?.fullName || "System";

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/invoices", authenticateToken, async (req: any, res: any) => {
  try {
    // Fetch active session user's details for accurate attribution
    const activeUser = await User.findById(req.user.id);
    const creatorName = activeUser?.fullName || activeUser?.email?.split("@")[0] || "Cashier";

    // Generate invoice number if not provided
    let invoiceNumber = req.body.invoice_number;
    if (!invoiceNumber) {
      const count = await Invoice.countDocuments();
      invoiceNumber = `INV-2026-${(count + 1).toString().padStart(5, "0")}`;
    }

    const invoice = await Invoice.create({
      ...req.body,
      invoice_number: invoiceNumber,
      createdBy: req.user.id,
      created_by: creatorName,
    });
    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Update invoice financials / fields / metadata
app.put("/api/invoices/:id", authenticateToken, async (req: any, res: any) => {
  try {
    let invoice = await Invoice.findById(req.params.id).catch(() => null);
    if (!invoice) {
      invoice = await Invoice.findOne({ invoice_number: req.params.id });
    }
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Always allowed metadata / delivery fields (works for paid, partially_paid, unpaid, draft)
    if (req.body.delivery_status !== undefined) {
      if (["pending", "delivered"].includes(req.body.delivery_status)) {
        invoice.delivery_status = req.body.delivery_status;
      }
    }
    if (req.body.custom_client !== undefined) {
      invoice.custom_client = req.body.custom_client;
      invoice.markModified("custom_client");
    }
    if (req.body.custom_bank_details !== undefined) {
      invoice.custom_bank_details = req.body.custom_bank_details;
      invoice.markModified("custom_bank_details");
    }
    if (req.body.notes !== undefined) {
      invoice.notes = req.body.notes;
    }

    // Financial / line items editable when not fully paid
    if (invoice.status !== "paid") {
      const allowed = [
        "discount_type",
        "discount_value",
        "discount_amount",
        "tax_amount",
        "tax_rate",
        "total",
        "due_date",
        "amount_paid",
        "status",
        "subtotal",
        "line_items"
      ];
      for (const key of allowed) {
        if (req.body[key] !== undefined) (invoice as any)[key] = req.body[key];
      }
    }

    await invoice.save();
    return res.status(200).json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.patch("/api/invoices/:id/delivery-status", authenticateToken, async (req: any, res: any) => {
  try {
    let invoice = await Invoice.findById(req.params.id).catch(() => null);
    if (!invoice) {
      invoice = await Invoice.findOne({ invoice_number: req.params.id });
    }
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const { delivery_status } = req.body;
    if (delivery_status && ["pending", "delivered"].includes(delivery_status)) {
      invoice.delivery_status = delivery_status;
      await invoice.save();
    }
    return res.status(200).json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= BANK & REGISTER ENDPOINTS =================

app.get("/api/bank-accounts", authenticateToken, async (req: any, res: any) => {
  try {
    const registers = await BankAccount.find().sort({ name: 1 });
    res.json(registers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/bank-accounts", authenticateToken, async (req: any, res: any) => {
  try {
    const cashAcct = await ChartOfAccounts.findOne({ code: "1000" });
    const register = await BankAccount.create({
      ...req.body,
      account_id: cashAcct?.id,
    });
    res.status(201).json(register);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= COA & LEDGER ENDPOINTS =================

app.get("/api/chart-of-accounts", authenticateToken, async (req: any, res: any) => {
  try {
    const list = await ChartOfAccounts.find().sort({ code: 1 });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Expense tracking + posting Double Entry ledger
app.post("/api/expenses", authenticateToken, async (req: any, res: any) => {
  const { expense_date, description, amount, bank_account_id, expense_account_id } = req.body;
  try {
    const expense = await Expense.create({
      expense_date,
      description,
      amount,
      bank_account_id,
      expense_account_id,
      created_by: req.user.id,
    });

    const bank = await BankAccount.findById(bank_account_id);
    if (!bank) return res.status(400).json({ message: "Invalid bank account ID" });
    const cashAcctId = bank.account_id;

    // Create journal entry
    const entry = await JournalEntry.create({
      entry_date: expense_date,
      memo: description,
      reference_type: "expense",
      reference_id: expense.id,
      created_by: req.user.id,
    });

    // Debit Expense account (increases expense)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: expense_account_id,
      debit: amount,
      credit: 0,
    });

    // Credit Bank register account (decreases asset)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: cashAcctId,
      debit: 0,
      credit: amount,
    });

    // Update bank balance
    bank.balance = bank.balance - amount;
    await bank.save();

    res.status(201).json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/expenses", authenticateToken, async (req: any, res: any) => {
  try {
    const list = await Expense.find().sort({ expense_date: -1 }).limit(20);
    // manual joins
    const coas = await ChartOfAccounts.find();
    const coaMap = new Map(coas.map((c) => [c.id, c]));
    const banks = await BankAccount.find();
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    const formatted = list.map((exp) => {
      const obj: Record<string, any> = exp.toJSON();
      obj.chart_of_accounts = coaMap.get(exp.expense_account_id);
      obj.bank_accounts = bankMap.get(exp.bank_account_id);
      return obj;
    });

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Payroll configuration + Processing Payout runs
app.get("/api/staff-payroll", authenticateToken, async (req: any, res: any) => {
  try {
    const list = await StaffPayroll.find();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/staff-payroll", authenticateToken, async (req: any, res: any) => {
  const { user_id, base_salary, hourly_rate, hours_per_month, active } = req.body;
  try {
    const payroll = await StaffPayroll.findOneAndUpdate(
      { user_id },
      { base_salary, hourly_rate, hours_per_month, active },
      { upsert: true, new: true }
    );
    res.json(payroll);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/payroll-runs", authenticateToken, async (req: any, res: any) => {
  try {
    const runs = await PayrollRun.find().sort({ run_at: -1 }).limit(12);
    // Join bank manually
    const banks = await BankAccount.find();
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    const formatted = runs.map((run) => {
      const obj: Record<string, any> = run.toJSON();
      obj.bank_accounts = bankMap.get(run.bank_account_id);
      return obj;
    });

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/payroll-runs", authenticateToken, async (req: any, res: any) => {
  const { period_month, bank_account_id, total_gross } = req.body;
  try {
    const run = await PayrollRun.create({
      period_month,
      bank_account_id,
      total_gross,
      run_by: req.user.id,
    });

    const bank = await BankAccount.findById(bank_account_id);
    if (!bank) return res.status(400).json({ message: "Invalid bank register" });
    const cashAcctId = bank.account_id;

    const payrollAcct = await ChartOfAccounts.findOne({ code: "6300" });
    if (!payrollAcct) return res.status(500).json({ message: "Payroll expense account 6300 not found" });

    // Create journal entry
    const entry = await JournalEntry.create({
      entry_date: new Date(),
      memo: `Payroll Payout Period: ${new Date(period_month).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
      reference_type: "payroll",
      reference_id: run.id,
      created_by: req.user.id,
    });

    // Debit Payroll Expense (increases expense)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: payrollAcct.id,
      debit: total_gross,
      credit: 0,
    });

    // Credit Cash account (decreases asset)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: cashAcctId,
      debit: 0,
      credit: total_gross,
    });

    // Deduct from bank
    bank.balance = bank.balance - total_gross;
    await bank.save();

    res.status(201).json(run);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/payroll-run-items", authenticateToken, async (req: any, res: any) => {
  try {
    // Bulk insert items
    const items = await PayrollRunItem.insertMany(req.body);
    res.status(201).json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Profiles list for payroll management
app.get("/api/profiles", authenticateToken, async (req: any, res: any) => {
  try {
    const users = await User.find().sort({ email: 1 });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/user_roles", authenticateToken, async (req: any, res: any) => {
  try {
    const users = await User.find();
    const formatted = users.map((u) => ({
      user_id: u.id,
      role: u.role,
    }));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= RECEIPTS ENDPOINTS =================

app.get("/api/receipts", authenticateToken, async (req: any, res: any) => {
  try {
    const receipts = await Receipt.find().sort({ createdAt: -1 });
    res.json(receipts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/receipts", authenticateToken, async (req: any, res: any) => {
  try {
    const receipt = await Receipt.create({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json(receipt);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= TAX SETTINGS ENDPOINTS =================

app.get("/api/tax_settings", authenticateToken, async (req: any, res: any) => {
  try {
    const settings = await TaxSettings.findOne();
    res.json(settings || { rate: 0.075, currency: "NGN", exchange_rate: 1, currency_symbol: "₦" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/tax_settings", authenticateToken, async (req: any, res: any) => {
  const { rate, currency, exchange_rate, currency_symbol } = req.body;
  try {
    const updateObj: any = {};
    if (rate !== undefined) updateObj.rate = Number(rate);
    if (currency !== undefined) updateObj.currency = currency;
    if (exchange_rate !== undefined) updateObj.exchange_rate = Number(exchange_rate);
    if (currency_symbol !== undefined) updateObj.currency_symbol = currency_symbol;

    const settings = await TaxSettings.findOneAndUpdate(
      {},
      updateObj,
      { upsert: true, new: true }
    );
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= DOUBLE-ENTRY LEDGER PROCESSING =================

// Mark Invoice Paid / Record Deposit Payment -> Writes balancing debits to Asset accounts and credits to Revenue/Liability dynamically
app.post("/api/ledger", authenticateToken, async (req: any, res: any) => {
  const { invoice_id, payment_method, bank_account_id, payment_amount } = req.body;
  try {
    const invoice = await Invoice.findById(invoice_id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Invoice already fully paid" });
    }

    const currentPaid = Number(invoice.amount_paid || 0);
    const remainingBalance = Math.max(0, invoice.total - currentPaid);
    const amountToPay = payment_amount !== undefined ? Math.min(Number(payment_amount), remainingBalance) : remainingBalance;

    if (amountToPay <= 0) {
      return res.status(400).json({ message: "No balance due for this invoice" });
    }

    const bank = await BankAccount.findById(bank_account_id);
    if (!bank) return res.status(400).json({ message: "Invalid bank / register ID" });

    // 1. Fetch needed System Accounts
    const cashAcct = await ChartOfAccounts.findOne({ code: "1000" }); // Default cash on hand or the bank register account
    const assetAcctId = bank.account_id || cashAcct?.id;

    const revAcct = await ChartOfAccounts.findOne({ code: "4000" }); // Sales revenue
    const taxAcct = await ChartOfAccounts.findOne({ code: "2100" }); // Sales tax payable
    const cogsAcct = await ChartOfAccounts.findOne({ code: "5000" }); // Cost of Goods Sold
    const invAcct = await ChartOfAccounts.findOne({ code: "1200" }); // Inventory

    if (!assetAcctId || !revAcct || !taxAcct || !cogsAcct || !invAcct) {
      return res.status(500).json({ message: "Required system chart of accounts missing" });
    }

    // 2. Create double-entry journal entry
    const entry = await JournalEntry.create({
      entry_date: new Date(),
      memo: `Invoice ${invoice.invoice_number} payment (${amountToPay >= remainingBalance ? "Full" : "Deposit/Partial"})`,
      reference_type: "invoice",
      reference_id: invoice.id,
      created_by: req.user.id,
    });

    // Line A: Debit register (Increases Asset by amount paid)
    await JournalLine.create({
      entry_id: entry.id,
      account_id: assetAcctId,
      debit: amountToPay,
      credit: 0,
    });

    // Line B & C: Credit Revenue & Sales Tax proportionally
    const taxRatio = invoice.total > 0 ? invoice.tax_amount / invoice.total : 0;
    const taxPortion = parseFloat((amountToPay * taxRatio).toFixed(2));
    const revPortion = parseFloat((amountToPay - taxPortion).toFixed(2));

    await JournalLine.create({
      entry_id: entry.id,
      account_id: revAcct.id,
      debit: 0,
      credit: revPortion,
    });

    if (taxPortion > 0) {
      await JournalLine.create({
        entry_id: entry.id,
        account_id: taxAcct.id,
        debit: 0,
        credit: taxPortion,
      });
    }

    // 3. Compute cost of goods sold (COGS) & Inventory adjustments on first payment/deposit
    if (!invoice.stock_committed) {
      let totalCost = 0;
      for (const item of invoice.line_items) {
        if (item.product_id) {
          const prod = await Product.findById(item.product_id);
          if (prod) {
            totalCost += item.quantity * prod.unit_cost;
            // Decrement stock levels in inventory
            prod.quantity = Math.max(0, prod.quantity - item.quantity);
            await prod.save();
          }
        }
      }

      if (totalCost > 0) {
        await JournalLine.create({
          entry_id: entry.id,
          account_id: cogsAcct.id,
          debit: totalCost,
          credit: 0,
        });

        await JournalLine.create({
          entry_id: entry.id,
          account_id: invAcct.id,
          debit: 0,
          credit: totalCost,
        });
      }
      invoice.stock_committed = true;
    }

    // 4. Update Cash register live balance
    bank.balance = bank.balance + amountToPay;
    await bank.save();

    // 5. Update Invoice status & paid amount
    const newTotalPaid = currentPaid + amountToPay;
    invoice.amount_paid = newTotalPaid;
    const isPaidInFull = newTotalPaid >= (invoice.total - 0.01);
    invoice.status = isPaidInFull ? "paid" : "partially_paid";
    invoice.payment_method = payment_method;
    invoice.bank_account_id = bank_account_id;
    if (isPaidInFull) {
      invoice.paid_at = new Date();
    }
    await invoice.save();

    // 6. Log Receipt log
    await Receipt.create({
      invoice_id: invoice.id,
      amount_paid: amountToPay,
      payment_method,
      createdBy: req.user.id,
    });

    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ================= REPORTS & METRICS ENDPOINTS =================

// Admin only financial report utilizing MongoDB aggregation pipelines
app.get("/api/reports", authenticateToken, requireAdmin, async (req: any, res: any) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "From and To parameters are required" });
  }

  try {
    const fromDate = new Date(from.toString() + "T00:00:00.000Z");
    const toDate = new Date(to.toString() + "T23:59:59.999Z");

    // 1. Fetch raw matching journal entries
    const rawEntries = await JournalEntry.find({
      entry_date: { $gte: fromDate, $lte: toDate },
    }).sort({ entry_date: -1 });

    const entriesList = [];

    // For each entry, find journal lines manually and build expected object structure
    for (const e of rawEntries) {
      const lines = await JournalLine.find({ entry_id: e.id });
      const formattedLines = [];

      for (const line of lines) {
        const coa = await ChartOfAccounts.findById(line.account_id);
        formattedLines.push({
          debit: line.debit,
          credit: line.credit,
          account_id: line.account_id,
          chart_of_accounts: coa
            ? {
                code: coa.code,
                name: coa.name,
                type: coa.type,
              }
            : null,
        });
      }

      entriesList.push({
        id: e.id,
        entry_date: e.entry_date,
        memo: e.memo,
        journal_lines: formattedLines,
      });
    }

    // 2. Fetch Chart of Accounts & Banks for display
    const accounts = await ChartOfAccounts.find().sort({ code: 1 });
    const banks = await BankAccount.find().sort({ name: 1 });

    res.json({
      entries: entriesList,
      accounts,
      banks,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running alongside Vite on http://localhost:${PORT}`);
});
