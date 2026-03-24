import { api } from "./client";
import { Reservation, ReservationStatus } from "../types";

export interface CreateReservationPayload {
  lab_id?: number;
  date: string;
  slot_ids: number[];
  items: { item_model_id: number; quantity_requested: number }[];
  requested_software_id?: number;
  software_installation_required?: boolean;
}

export interface ReviewPayload {
  status: ReservationStatus;
  rejection_reason?: string;
  approval_notes?: string;
}


export const reservationsApi = {
  listMy: () => api.get<Reservation[]>("/api/v1/reservations/my"),
  listPending: () => api.get<Reservation[]>("/api/v1/reservations/pending"),
  listToday: () => api.get<Reservation[]>("/api/v1/reservations/today"),
  listByDate: (date: string) => api.get<Reservation[]>(`/api/v1/reservations/date/${date}`),
  listAwaitingSoftware: () => api.get<Reservation[]>("/api/v1/reservations/awaiting-software"),
  create: (payload: CreateReservationPayload) => api.post<{ id: number; message: string }>("/api/v1/reservations", payload),
  review: (id: number, payload: ReviewPayload) => api.patch<{ message: string }>(`/api/v1/reservations/${id}/review`, payload),
  reviewGroup: (groupId: string, payload: ReviewPayload) => 
    api.patch<{ message: string }>(`/api/v1/reservations/group/${groupId}/review`, payload),
  listAll: () => api.get<Reservation[]>("/api/v1/reservations"),
};