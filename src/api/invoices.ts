import { api } from "./client";
import { Invoice } from "../types";

export const invoicesApi = {
  getAll: () =>
    api.get<Invoice[]>("/invoices"),

  getById: (id: string) =>
    api.get<Invoice>(`/invoices/${id}`),

  create: (data: Partial<Invoice>) =>
    api.post<Invoice>("/invoices", data),

  update: (id: string, data: Partial<Invoice>) =>
    api.put<Invoice>(`/invoices/${id}`, data),

  updateDeliveryStatus: (id: string, delivery_status: "pending" | "delivered") =>
    api.patch<Invoice>(`/invoices/${id}/delivery-status`, { delivery_status }),

  processPayment: (data: {
    invoice_id: string;
    payment_method: string;
    bank_account_id: string;
    payment_amount?: number;
  }) =>
    api.post<Invoice>("/ledger", data),
};
