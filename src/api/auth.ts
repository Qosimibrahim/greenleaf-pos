import { api } from "./client";
import { User, AuthSession } from "../types";

export const authApi = {
  signin: (email: string, password: string) =>
    api.post<AuthSession>("/auth/signin", { email, password }),

  signup: (email: string, password: string, fullName?: string) =>
    api.post<AuthSession>("/auth/signup", { email, password, fullName }),

  getSession: () =>
    api.get<{ session: { user: User; access_token: string } | null }>("/auth/session"),

  getMe: () =>
    api.get<User>("/auth/me"),

  getUsers: () =>
    api.get<User[]>("/users"),

  createUser: (data: { email: string; password: string; role?: string; full_name: string }) =>
    api.post<User>("/admin/create-user", data),

  deleteUser: (id: string) =>
    api.delete<{ message: string; id: string }>(`/users/${id}`),
};
