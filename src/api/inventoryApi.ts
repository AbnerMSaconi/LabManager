import { api } from "./client";
import { ItemModel, AvailableItemModel, InstitutionLoan, Reservation, StockItem, InventoryMovement } from "../types";

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

export interface ItemModelPayload {
  name: string;
  category: string;
  description?: string;
  image_url?: string;
  total_stock: number;
  maintenance_stock?: number;
}

export interface LoanCreatePayload {
  item_model_id: number;
  requester_name: string;
  quantity_delivered: number;
  return_date?: string;
  no_return_reason?: string;
}

export interface LoanReturnPayload {
  all_returned: boolean;
  quantity_returned: number;
  has_damage: boolean;
  is_operational?: boolean;
  damage_observation?: string;
}
export interface MaintenanceResolvePayload {
  qty_repaired: number;
  qty_discarded: number;
  observation?: string;
}

export const inventoryApi = {
  listModels:              ()                    => api.get<ItemModel[]>("/api/v1/inventory/models"),
  listAvailable:           (date: string)        => api.get<AvailableItemModel[]>(`/api/v1/inventory/models/available?date=${date}`),
  createModel:             (p: ItemModelPayload) => api.post<ItemModel>("/api/v1/inventory/item-models", p),
  updateModel:             (id: number, p: Partial<ItemModelPayload>) => api.patch<ItemModel>(`/api/v1/inventory/item-models/${id}`, p),
  pendingRequests:         ()                    => api.get<Reservation[]>("/api/v1/inventory/pending-requests"),
  myPracticalReservations: ()                    => api.get<Reservation[]>("/api/v1/reservations/my/practical"),
  addReservationItems:     (id: number, items: { item_model_id: number; quantity_requested: number }[]) =>
                             api.post<{ message: string }>(`/api/v1/reservations/${id}/add-items`, { items }),
  createLoan:              (p: LoanCreatePayload)           => api.post<{ message: string; id: number }>("/api/v1/logistics/loans", p),
  listLoans:               ()                               => api.get<InstitutionLoan[]>("/api/v1/logistics/loans"),
  returnLoan:              (id: number, p: LoanReturnPayload) => api.patch<{ message: string }>(`/api/v1/logistics/loans/${id}/return`, p),
  checkout:       (payload: CheckoutPayload) => api.post<{ message: string }>("/api/v1/logistics/checkout", payload),
  checkin:        (payload: CheckinPayload)  => api.post<{ message: string }>("/api/v1/logistics/checkin", payload),
  listStock:      ()                         => api.get<StockItem[]>("/api/v1/inventory/stock"),
  listMovements:  ()                         => api.get<InventoryMovement[]>("/api/v1/inventory/movements"),
  resolveMaintenance: (id: number, p: MaintenanceResolvePayload) => 
  api.post<{ message: string }>(`/api/v1/inventory/item-models/${id}/resolve-maintenance`, p),
};
