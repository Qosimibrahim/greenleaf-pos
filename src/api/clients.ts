import { api } from "./client";
import { Client } from "../types";

export const clientsApi = {
  getAll: () =>
    api.get<Client[]>("/clients"),

  create: (data: Partial<Client>) =>
    api.post<Client>("/clients", data),

  update: (id: string, data: Partial<Client>) =>
    api.put<Client>(`/clients/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/clients/${id}`),
};
