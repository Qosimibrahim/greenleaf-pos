import { api } from "./client";
import { Receipt } from "../types";

export const receiptsApi = {
  getAll: () =>
    api.get<Receipt[]>("/receipts"),

  create: (data: Partial<Receipt>) =>
    api.post<Receipt>("/receipts", data),
};
