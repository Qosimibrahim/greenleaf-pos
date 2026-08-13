import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  User,
  ChartOfAccounts,
  BankAccount,
  TaxSettings,
  Product,
  Client,
  ProductCategory,
} from "./models/index.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/greenleaf-stockroom";

export async function connectDB() {
  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB Connected Successfully.");
    await seedDB();
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

async function seedDB() {
  try {
    // 1. Chart of Accounts
    const coaCount = await ChartOfAccounts.countDocuments();
    if (coaCount === 0) {
      console.log("Seeding Chart of Accounts...");
      await ChartOfAccounts.insertMany([
        { code: "1000", name: "Cash on Hand", type: "asset", is_system: true },
        { code: "1010", name: "Store Bank Account", type: "asset", is_system: true },
        { code: "1020", name: "Mobile Money / POS", type: "asset", is_system: true },
        { code: "1200", name: "Inventory", type: "asset", is_system: true },
        { code: "1300", name: "Accounts Receivable", type: "asset", is_system: true },
        { code: "2100", name: "Sales Tax Payable", type: "liability", is_system: true },
        { code: "3000", name: "Owner Equity", type: "equity", is_system: true },
        { code: "4000", name: "Sales Revenue", type: "revenue", is_system: true },
        { code: "5000", name: "Cost of Goods Sold", type: "expense", is_system: true },
        { code: "6100", name: "Rent Expense", type: "expense", is_system: true },
        { code: "6200", name: "Utilities Expense", type: "expense", is_system: true },
        { code: "6300", name: "Payroll Expense", type: "expense", is_system: true },
        { code: "6900", name: "Other Expense", type: "expense", is_system: true },
      ]);
    }

    // 2. Bank Registers
    const bankCount = await BankAccount.countDocuments();
    if (bankCount === 0) {
      console.log("Seeding Cash Registers & Bank Accounts...");
      const cashAcct = await ChartOfAccounts.findOne({ code: "1000" });
      const bankAcct = await ChartOfAccounts.findOne({ code: "1010" });
      const mobileAcct = await ChartOfAccounts.findOne({ code: "1020" });

      await BankAccount.insertMany([
        {
          name: "Main Cash Drawer",
          kind: "cash",
          account_id: cashAcct?.id,
          balance: 193.49, // Seed with initial transaction total
          is_active: true,
        },
        {
          name: "Store Bank Account",
          kind: "bank",
          account_id: bankAcct?.id,
          balance: 0,
          is_active: true,
        },
        {
          name: "Mobile Money / POS",
          kind: "mobile",
          account_id: mobileAcct?.id,
          balance: 0,
          is_active: true,
        },
      ]);
    }

    // 3. Tax Settings
    const taxCount = await TaxSettings.countDocuments();
    if (taxCount === 0) {
      console.log("Seeding Tax settings...");
      await TaxSettings.create({ rate: 0.075 });
    }

    // 4. ProductCategory
    let catId: string | undefined = undefined;
    const catCount = await ProductCategory.countDocuments();
    if (catCount === 0) {
      console.log("Seeding Categories...");
      const category = await ProductCategory.create({ name: "Accessories" });
      catId = category.id;
    } else {
      const category = await ProductCategory.findOne();
      catId = category?.id;
    }

    // 5. Products
    const prodCount = await Product.countDocuments();
    if (prodCount === 0) {
      console.log("Seeding Products...");

      // Get or create extra categories
      const catElec = await ProductCategory.findOneAndUpdate(
        { name: "Electronics" },
        { name: "Electronics" },
        { upsert: true, new: true }
      );
      const catHousehold = await ProductCategory.findOneAndUpdate(
        { name: "Household" },
        { name: "Household" },
        { upsert: true, new: true }
      );
      const catGrocery = await ProductCategory.findOneAndUpdate(
        { name: "Grocery" },
        { name: "Grocery" },
        { upsert: true, new: true }
      );
      const catFashion = await ProductCategory.findOneAndUpdate(
        { name: "Fashion" },
        { name: "Fashion" },
        { upsert: true, new: true }
      );
      const catHealth = await ProductCategory.findOneAndUpdate(
        { name: "Health & Beauty" },
        { name: "Health & Beauty" },
        { upsert: true, new: true }
      );

      await Product.insertMany([
        {
          sku: "SKU-1111",
          barcode: "1111",
          name: "Premium Wireless Headset",
          quantity: 23,
          low_stock_threshold: 5,
          unit_cost: 12000,
          selling_price: 28500,
          category_id: catElec.id,
          description: "Noise-cancelling wireless overhead headset with 30hr battery.",
          imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
        },
        {
          sku: "SKU-2222",
          barcode: "2222",
          name: "Ergonomic Office Chair",
          quantity: 12,
          low_stock_threshold: 3,
          unit_cost: 35000,
          selling_price: 75000,
          category_id: catHousehold.id,
          description: "High-back mesh chair with lumbar support and adjustable armrests.",
          imageUrl: "https://images.unsplash.com/photo-1541558869434-2840d308329a?w=400&q=80",
        },
        {
          sku: "SKU-3333",
          barcode: "3333",
          name: "Ultra-Thin Laptop Sleeve",
          quantity: 39,
          low_stock_threshold: 10,
          unit_cost: 3500,
          selling_price: 8500,
          category_id: catElec.id,
          description: "Water-resistant protective neoprene sleeve fits 13-15 inch laptops.",
          imageUrl: "https://images.unsplash.com/photo-1618478594486-c65b899c4936?w=400&q=80",
        },
        {
          sku: "SKU-4444",
          barcode: "4444",
          name: "Stainless Steel Water Bottle",
          quantity: 55,
          low_stock_threshold: 10,
          unit_cost: 1800,
          selling_price: 4500,
          category_id: catHousehold.id,
          description: "Double-walled 750ml vacuum insulated bottle. Keeps cold 24hrs.",
          imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&q=80",
        },
        {
          sku: "SKU-5555",
          barcode: "5555",
          name: "Organic Shea Butter Lotion",
          quantity: 80,
          low_stock_threshold: 15,
          unit_cost: 800,
          selling_price: 2200,
          category_id: catHealth.id,
          description: "100% natural moisturising lotion with shea butter and vitamin E.",
          imageUrl: "https://images.unsplash.com/photo-1570194065650-d99fb4d8a609?w=400&q=80",
        },
        {
          sku: "SKU-6666",
          barcode: "6666",
          name: "Men's Classic Polo Shirt",
          quantity: 30,
          low_stock_threshold: 5,
          unit_cost: 2500,
          selling_price: 7500,
          category_id: catFashion.id,
          description: "Premium cotton pique polo shirt, available in multiple colours.",
          imageUrl: "https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=400&q=80",
        },
        {
          sku: "SKU-7777",
          barcode: "7777",
          name: "Bluetooth Portable Speaker",
          quantity: 18,
          low_stock_threshold: 4,
          unit_cost: 8000,
          selling_price: 22000,
          category_id: catElec.id,
          description: "360° sound, IPX7 waterproof, 12hr playtime. Pairs with any device.",
          imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80",
        },
        {
          sku: "SKU-8888",
          barcode: "8888",
          name: "Premium Basmati Rice (5kg)",
          quantity: 100,
          low_stock_threshold: 20,
          unit_cost: 3200,
          selling_price: 6500,
          category_id: catGrocery.id,
          description: "Long-grain aged basmati rice. Ideal for jollof, pilaf, and more.",
          imageUrl: "https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=400&q=80",
        },
        {
          sku: "SKU-9999",
          barcode: "9999",
          name: "USB-C Fast Charging Cable (2m)",
          quantity: 60,
          low_stock_threshold: 10,
          unit_cost: 700,
          selling_price: 2000,
          category_id: catElec.id,
          description: "Nylon braided 100W USB-C to USB-C cable. 2-metre length.",
          imageUrl: "https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=400&q=80",
        },
        {
          sku: "SKU-0001",
          barcode: "0001",
          name: "Facial Sunscreen SPF 50",
          quantity: 45,
          low_stock_threshold: 8,
          unit_cost: 1500,
          selling_price: 4000,
          category_id: catHealth.id,
          description: "Lightweight, non-greasy SPF 50 PA+++ sunscreen for daily use.",
          imageUrl: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&q=80",
        },
      ]);
    }

    // 6. Clients
    let clientId: string | undefined = undefined;
    const clientCount = await Client.countDocuments();
    if (clientCount === 0) {
      console.log("Seeding Clients...");
      const client = await Client.create({
        name: "Demo Retail Customer",
        email: "demo@customer.example",
        company: "Demo Co",
        phone: "+1 555-0199",
        address: "123 Retail Lane, Commerce City",
        notes: "Pre-seeded system customer",
      });
      clientId = client.id;
    } else {
      const client = await Client.findOne();
      clientId = client?.id;
    }

    // 7. Users & Roles
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("Seeding Users...");
      const adminHash = bcrypt.hashSync("AdminDemo123!", 10);
      const cashierHash = bcrypt.hashSync("CashierDemo123!", 10);

      await User.insertMany([
        {
          email: "admin@clientapp.demo",
          passwordHash: adminHash,
          role: "admin",
          fullName: "Admin User",
        },
        {
          email: "cashier@clientapp.demo",
          passwordHash: cashierHash,
          role: "staff",
          fullName: "Cashier Staff",
        },
      ]);
    }
  } catch (err) {
    console.error("Seeding database failed:", err);
  }
}
