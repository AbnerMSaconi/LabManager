from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import date, datetime
from typing import List, Optional

# Alias to avoid Pydantic v2 field-name/type-name collision in ReservationUpdate
# (Python 3.12 + Pydantic v2 resolves 'date' in Optional[date] using the class
# namespace where the field default 'date=None' shadows the datetime.date class)
_DateType = date
from ..models.base_models import UserRole, ReservationStatus, ItemCategory, ItemStatus

# --- SCHEMAS DE RESERVA ---

class ReservationItemBase(BaseModel):
    item_model_id: int
    quantity_requested: int = Field(gt=0)


class ReservationCreate(BaseModel):
    lab_id: Optional[int] = None
    dates: List[date] = Field(..., min_length=1)
    slot_ids: List[int] = Field(..., min_length=1)
    items: List[ReservationItemBase] = Field(default_factory=list)

    requested_softwares: Optional[str] = None   # ex: "AutoCAD, VS Code"
    software_installation_required: bool = False

    # 🔒 Evita datas duplicadas
    @field_validator("dates")
    @classmethod
    def validate_dates(cls, v):
        if len(set(v)) != len(v):
            raise ValueError("Datas duplicadas não são permitidas.")
        return v

    # 🔒 Evita slots duplicados
    @field_validator("slot_ids")
    @classmethod
    def validate_slots(cls, v):
        if len(set(v)) != len(v):
            raise ValueError("Horários (slots) duplicados não são permitidos.")
        return v

    # 🔒 Regra de consistência
    @model_validator(mode="after")
    def validate_context(self):
        if not self.lab_id and not self.items:
            raise ValueError("Informe um laboratório ou pelo menos um item.")
        return self


class ReservationReview(BaseModel):
    # Transições permitidas:
    # PENDENTE -> APROVADO | REJEITADO
    # APROVADO -> AGUARDANDO_SOFTWARE
    # AGUARDANDO_SOFTWARE -> APROVADO
    status: ReservationStatus
    rejection_reason: Optional[str] = None
    approval_notes: Optional[str] = None


# --- SCHEMAS DE LOGÍSTICA ---

class CheckoutItem(BaseModel):
    reservation_item_id: int
    patrimony_id: Optional[str] = None
    quantity_delivered: Optional[int] = None


class CheckoutRequest(BaseModel):
    reservation_id: int
    items: List[CheckoutItem] = Field(..., min_length=1)


class CheckinItem(BaseModel):
    reservation_item_id: int
    new_status: ItemStatus
    damage_observation: Optional[str] = None
    quantity_returned: Optional[int] = None


class CheckinRequest(BaseModel):
    reservation_id: int
    items: List[CheckinItem] = Field(..., min_length=1)


# --- SCHEMAS DE RESPOSTA ---

class UserRead(BaseModel):
    id: int
    registration_number: str
    full_name: str
    role: UserRole

    class Config:
        from_attributes = True


# --- SCHEMAS DE USUÁRIOS ---

class UserCreate(BaseModel):
    registration_number: str
    full_name: str
    password: str
    role: UserRole = UserRole.PROFESSOR


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserReadFull(BaseModel):
    id: int
    registration_number: str
    full_name: str
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True


# --- SCHEMAS DE MANUTENÇÃO ---

class TicketCreate(BaseModel):
    title: str
    description: str
    lab_id: Optional[int] = None
    physical_item_id: Optional[int] = None
    severity: str = "medio"  # baixo | medio | critico


class TicketResolve(BaseModel):
    resolution_notes: str
    status: str = "resolvido"  # em_andamento | resolvido


# --- SCHEMAS DE LABORATÓRIO ---

class LaboratoryCreate(BaseModel):
    name: str
    block: str  # "Bloco A" | "Bloco B" | "Bloco C"
    room_number: str
    capacity: int
    is_practical: bool = False
    description: Optional[str] = None
    software_ids: List[int] = []


class LaboratoryUpdate(BaseModel):
    name: Optional[str] = None
    block: Optional[str] = None
    room_number: Optional[str] = None
    capacity: Optional[int] = None
    is_practical: Optional[bool] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    software_ids: Optional[List[int]] = None


# --- SCHEMAS DE SOFTWARE ---

class SoftwareCreate(BaseModel):
    name: str
    version: Optional[str] = None


# --- SCHEMAS DE INVENTÁRIO ---

class ItemModelCreate(BaseModel):
    name: str
    category: ItemCategory
    description: Optional[str] = None
    model_number: Optional[str] = None
    image_url: Optional[str] = None
    total_stock: int = Field(ge=0, default=0)


class ItemModelUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[ItemCategory] = None
    description: Optional[str] = None
    model_number: Optional[str] = None
    image_url: Optional[str] = None
    total_stock: Optional[int] = Field(ge=0, default=None)
    maintenance_stock: Optional[int] = Field(ge=0, default=None)
    

class AddReservationItemsRequest(BaseModel):
    items: List[ReservationItemBase] = Field(..., min_length=1)
    


class InstitutionLoanCreate(BaseModel):
    item_model_id: int
    requester_name: str
    quantity_delivered: int = Field(gt=0)
    return_date: Optional[date] = None
    no_return_reason: Optional[str] = None


class InstitutionLoanReturn(BaseModel):
    all_returned: bool
    quantity_returned: int = Field(ge=0)
    has_damage: bool = False
    is_operational: Optional[bool] = None
    damage_observation: Optional[str] = None

class ReservationUpdate(BaseModel):
    lab_id: Optional[int] = None
    date: Optional[_DateType] = None
    slot_ids: Optional[List[int]] = None

    @field_validator("date", mode="before")
    @classmethod
    def coerce_empty_date(cls, v: object) -> object:
        """Pydantic v2 rejeita string vazia para date; converte para None."""
        if v == "" or v == "null":
            return None
        return v

    @field_validator("lab_id", mode="before")
    @classmethod
    def coerce_zero_lab(cls, v: object) -> object:
        """0 não é um lab_id válido; converte para None."""
        if v == 0:
            return None
        return v