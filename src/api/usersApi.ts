import { api } from "./client";
import { UserRole } from "../types";

export interface UserFull {
  id: number;
  registration_number: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface CreateUserPayload {
  registration_number: string;
  full_name: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;
}

export const usersApi = {
  list:       ()                              => api.get<UserFull[]>("/api/v1/users"),
  create:     (p: CreateUserPayload)          => api.post<{ id: number; message: string }>("/api/v1/users", p),
  update:     (id: number, p: UpdateUserPayload) => api.patch<{ message: string }>(`/api/v1/users/${id}`, p),
  deactivate: (id: number)                   => api.patch<{ message: string }>(`/api/v1/users/${id}`, { is_active: false }),
};
