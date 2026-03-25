export enum UserRole {
  PROFESSOR = "professor",
  DTI_ESTAGIARIO = "dti_estagiario",
  DTI_TECNICO = "dti_tecnico",
  PROGEX = "progex",
  ADMINISTRADOR = "administrador",
}

export enum ReservationStatus {
  PENDENTE = "pendente",
  APROVADO = "aprovado",
  REJEITADO = "rejeitado",
  EM_USO = "em_uso",
  CONCLUIDO = "concluido",
  CANCELADO = "cancelado",
  AGUARDANDO_SOFTWARE = "aguardando_software",
  APROVADO_COM_RESSALVAS = "aprovado_com_ressalvas",
}

export enum LaboratoryBlock {
  BLOCO_A = "Bloco A",
  BLOCO_B = "Bloco B",
  BLOCO_C = "Bloco C",
}

export enum ItemCategory {
  ELETRICA = "eletrica",
  ELETRONICA = "eletronica",
  FISICA = "fisica",
  COMPONENTES = "componentes",
}

export enum ItemStatus {
  DISPONIVEL = "disponivel",
  MANUTENCAO = "manutencao",
  EM_USO = "em_uso",
  BAIXADO = "baixado",
}

export interface User {
  id: number;
  registration_number: string;
  full_name: string;
  role: UserRole;
}

export interface Laboratory {
  id: number;
  name: string;
  block: LaboratoryBlock;
  room_number: string;
  capacity: number;
  is_practical: boolean;
  description?: string;
  softwares?: Software[];
}

export interface Software {
  id: number;
  name: string;
  version?: string;
}

export interface ItemModel {
  id: number;
  name: string;
  category: ItemCategory;
  description?: string;
  image_url?: string;
  total_stock: number;
}

export interface Reservation {
  id: number;
  user_id: number;
  lab_id?: number;
  date: string;
  status: ReservationStatus;
  requested_softwares?: string;  // ex: 'AutoCAD, VS Code'
  software_installation_required: boolean;
  approval_notes?: string;
  rejection_reason?: string;
  created_at: string;
  slots: LessonSlot[];
  items: ReservationItem[];
  user?: User;
  laboratory?: Laboratory;
  group_id?: string | null;
}

export interface LessonSlot {
  id: number;
  code: string;
  start_time: string;
  end_time: string;
}

export interface ReservationItem {
  id: number;
  reservation_id: number;
  item_model_id: number;
  quantity_requested: number;
  quantity_returned?: number;
  return_status?: ItemStatus | string;
  damage_observation?: string;
  model?: ItemModel;
}

export interface AvailableItemModel extends ItemModel {
  available_qty: number;
}

export interface InstitutionLoan {
  id: number;
  item_model_id: number;
  requester_name: string;
  quantity_delivered: number;
  quantity_returned: number;
  return_date?: string;
  no_return_reason?: string;
  status: "em_aberto" | "devolvido" | "devolvido_com_avaria";
  damage_observation?: string;
  is_operational?: boolean;
  created_at: string;
  returned_at?: string;
  model?: ItemModel;
}

export interface StockItem extends ItemModel {
  in_use: number;
  in_loans: number;
  available_qty: number;
}

export interface InventoryMovement {
  id: number;
  item_model_id: number;
  action: "saida" | "entrada" | "emprestimo" | "devolucao";
  quantity: number;
  operator_id: number;
  target: string;
  reservation_id?: number;
  loan_id?: number;
  observation?: string;
  created_at: string;
  model?: { id: number; name: string; category: string };
  operator?: { id: number; full_name: string; role: string };
}