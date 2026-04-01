import { api } from "./client";
import { AttendanceRow, AttendanceBatchItem } from "../types";

export interface AttendanceFilters {
  date?: string;
  date_from?: string;
  date_to?: string;
  weekday?: number;
  lab_id?: number;
}

export const attendanceApi = {
  list: (filters: AttendanceFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.date) params.set("date", filters.date);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    if (filters.weekday !== undefined) params.set("weekday", String(filters.weekday));
    if (filters.lab_id !== undefined) params.set("lab_id", String(filters.lab_id));
    const qs = params.toString();
    return api.get<AttendanceRow[]>(`/api/v1/attendance${qs ? "?" + qs : ""}`);
  },
  batch: (records: AttendanceBatchItem[]) =>
    api.post<{ saved: number }>("/api/v1/attendance/batch", { records }),
};
