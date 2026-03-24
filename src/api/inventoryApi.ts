import { api } from "./client";
import { ItemModel } from "../types";

export interface CheckoutPayload {
  reservation_id: number;
  items: {
    reservation_item_id: number;
    patrimony_id?: string;
    quantity_delivered?: number;
  }[];
}

export interface CheckinPayload {
  reservation_id: number;
  items: {
    reservation_item_id: number;
    new_status: string;
    damage_observation?: string;
    quantity_returned?: number;
  }[];
}

export const inventoryApi = {
  listModels: () => api.get<ItemModel[]>("/api/v1/inventory/models"),
  checkout: (payload: CheckoutPayload) => api.post<{ message: string }>("/api/v1/logistics/checkout", payload),
  checkin:  (payload: CheckinPayload)  => api.post<{ message: string }>("/api/v1/logistics/checkin", payload),
};
