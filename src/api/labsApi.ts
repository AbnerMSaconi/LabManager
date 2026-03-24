import { api } from "./client";
import { Laboratory, LessonSlot, Software } from "../types";

export interface CreateLabPayload {
  name: string;
  block: string;
  room_number: string;
  capacity: number;
  is_practical: boolean;
  description?: string;
  software_ids: number[];
}

export interface UpdateLabPayload {
  name?: string;
  block?: string;
  room_number?: string;
  capacity?: number;
  is_practical?: boolean;
  description?: string;
  is_active?: boolean;
  software_ids?: number[];
}

export const labsApi = {
  list:            ()                              => api.get<Laboratory[]>("/api/v1/labs"),
  get:             (id: number)                   => api.get<Laboratory>(`/api/v1/labs/${id}`),
  create:          (p: CreateLabPayload)          => api.post<{ id: number; message: string }>("/api/v1/labs", p),
  update:          (id: number, p: UpdateLabPayload) => api.put<{ message: string }>(`/api/v1/labs/${id}`, p),
  delete:          (id: number)                   => api.delete<{ message: string }>(`/api/v1/labs/${id}`),
  listSlots:       ()                              => api.get<LessonSlot[]>("/api/v1/slots"),
  listSoftwares:   ()                              => api.get<Software[]>("/api/v1/softwares"),
  createSoftware:  (name: string, version?: string) => api.post<{ id: number }>("/api/v1/softwares", { name, version }),
  deleteSoftware:  (id: number)                   => api.delete<{ message: string }>(`/api/v1/softwares/${id}`),
};
