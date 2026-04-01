import { api } from "./client";

export interface Ticket {
  id: number;
  title: string;
  description: string;
  lab_id?: number;
  lab_name?: string;
  physical_item_id?: number;
  opened_by?: string;
  status: "aberto" | "em_andamento" | "resolvido";
  severity: "baixo" | "medio" | "critico";
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  lab_id?: number;
  physical_item_id?: number;
  severity: "baixo" | "medio" | "critico";
}

export interface ResolveTicketPayload {
  resolution_notes: string;
  status: "em_andamento" | "resolvido";
}

export const maintenanceApi = {
  list:    ()                                      => api.get<Ticket[]>("/api/v1/maintenance"),
  create:  (p: CreateTicketPayload)                => api.post<{ id: number; message: string }>("/api/v1/maintenance", p),
  resolve: (id: number, p: ResolveTicketPayload)   => api.patch<{ message: string }>(`/api/v1/maintenance/${id}`, p),
};
