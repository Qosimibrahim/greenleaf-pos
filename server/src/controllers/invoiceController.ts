import { Response } from "express";
import { Invoice, Client, User } from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function getInvoices(_req: AuthenticatedRequest, res: Response) {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
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
}

export async function getInvoiceById(req: AuthenticatedRequest, res: Response) {
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
}

export async function createInvoice(req: AuthenticatedRequest, res: Response) {
  try {
    const activeUser = await User.findById(req.user?.id);
    const creatorName = activeUser?.fullName || activeUser?.email?.split("@")[0] || "Cashier";

    let invoiceNumber = req.body.invoice_number;
    if (!invoiceNumber) {
      const count = await Invoice.countDocuments();
      invoiceNumber = `INV-2026-${(count + 1).toString().padStart(5, "0")}`;
    }

    const invoice = await Invoice.create({
      ...req.body,
      invoice_number: invoiceNumber,
      createdBy: req.user?.id,
      created_by: creatorName,
    });
    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateInvoice(req: AuthenticatedRequest, res: Response) {
  try {
    let invoice = await Invoice.findById(req.params.id).catch(() => null);
    if (!invoice) {
      invoice = await Invoice.findOne({ invoice_number: req.params.id });
    }
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

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
        "line_items",
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
}

export async function updateDeliveryStatus(req: AuthenticatedRequest, res: Response) {
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
}
