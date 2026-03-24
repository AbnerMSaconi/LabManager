import enum
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Integer, String, ForeignKey, DateTime, Date, Text, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# --- ENUMS Python (usados apenas no código, não como tipo no banco) ---

class UserRole(enum.Enum):
    PROFESSOR      = "professor"
    DTI_ESTAGIARIO = "dti_estagiario"
    DTI_TECNICO    = "dti_tecnico"
    PROGEX         = "progex"
    ADMINISTRADOR   = "administrador"

class ReservationStatus(enum.Enum):
    PENDENTE               = "pendente"
    APROVADO               = "aprovado"
    REJEITADO              = "rejeitado"
    EM_USO                 = "em_uso"
    CONCLUIDO              = "concluido"
    CANCELADO              = "cancelado"
    AGUARDANDO_SOFTWARE    = "aguardando_software"
    APROVADO_COM_RESSALVAS = "aprovado_com_ressalvas"

class LaboratoryBlock(enum.Enum):
    BLOCO_A = "Bloco A"
    BLOCO_B = "Bloco B"
    BLOCO_C_INDO = "Bloco C - INFO"
    BLOCO_C_ESP = "Bloco C - Específicos"
    BLOCO_M = "Bloco M"
class ItemCategory(enum.Enum):
    ELETRICA   = "eletrica"
    ELETRONICA = "eletronica"
    FISICA     = "fisica"
    COMPONENTES = "componentes"

class ItemStatus(enum.Enum):
    DISPONIVEL = "disponivel"
    MANUTENCAO = "manutencao"
    EM_USO     = "em_uso"
    BAIXADO    = "baixado"


# --- MODELS (colunas usam String, não Enum do banco) ---

class User(Base):
    __tablename__ = "users"
    id:                  Mapped[int]           = mapped_column(primary_key=True)
    registration_number: Mapped[str]           = mapped_column(String(50), unique=True, index=True)
    email:               Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    hashed_password:     Mapped[str]           = mapped_column(String(255))
    full_name:           Mapped[str]           = mapped_column(String(255))
    role:                Mapped[str]           = mapped_column(String(30), default="professor")
    is_active:           Mapped[bool]          = mapped_column(default=True)


class LessonSlot(Base):
    __tablename__ = "lesson_slots"
    id:         Mapped[int] = mapped_column(primary_key=True)
    code:       Mapped[str] = mapped_column(String(10), unique=True)
    start_time: Mapped[str] = mapped_column(String(5))
    end_time:   Mapped[str] = mapped_column(String(5))


class Laboratory(Base):
    __tablename__ = "laboratories"
    id:           Mapped[int]           = mapped_column(primary_key=True)
    name:         Mapped[str]           = mapped_column(String(100))
    block:        Mapped[str]           = mapped_column(String(30))
    room_number:  Mapped[str]           = mapped_column(String(20))
    capacity:     Mapped[int]           = mapped_column(Integer)
    is_practical: Mapped[bool]          = mapped_column(default=False)
    description:  Mapped[Optional[str]] = mapped_column(Text)
    is_active:    Mapped[bool]          = mapped_column(default=True)
    softwares: Mapped[List["Software"]] = relationship(secondary="lab_softwares", back_populates="laboratories")
    hardwares: Mapped[List["Hardware"]] = relationship(secondary="lab_hardwares", back_populates="laboratories")


class Software(Base):
    __tablename__ = "softwares"
    id:      Mapped[int]           = mapped_column(primary_key=True)
    name:    Mapped[str]           = mapped_column(String(100))
    version: Mapped[Optional[str]] = mapped_column(String(50))
    laboratories: Mapped[List["Laboratory"]] = relationship(secondary="lab_softwares", back_populates="softwares")


class Hardware(Base):
    __tablename__ = "hardwares"
    id:             Mapped[int]           = mapped_column(primary_key=True)
    name:           Mapped[str]           = mapped_column(String(100))
    specifications: Mapped[Optional[str]] = mapped_column(Text)
    laboratories: Mapped[List["Laboratory"]] = relationship(secondary="lab_hardwares", back_populates="hardwares")


class LabSoftware(Base):
    __tablename__ = "lab_softwares"
    lab_id:      Mapped[int] = mapped_column(ForeignKey("laboratories.id"), primary_key=True)
    software_id: Mapped[int] = mapped_column(ForeignKey("softwares.id"),    primary_key=True)


class LabHardware(Base):
    __tablename__ = "lab_hardwares"
    lab_id:      Mapped[int] = mapped_column(ForeignKey("laboratories.id"), primary_key=True)
    hardware_id: Mapped[int] = mapped_column(ForeignKey("hardwares.id"),    primary_key=True)


class ItemModel(Base):
    __tablename__ = "item_models"
    id:          Mapped[int]           = mapped_column(primary_key=True)
    name:        Mapped[str]           = mapped_column(String(255))
    category:    Mapped[str]           = mapped_column(String(30))
    description: Mapped[Optional[str]] = mapped_column(Text)
    image_url:   Mapped[Optional[str]] = mapped_column(String(512))
    total_stock: Mapped[int]           = mapped_column(Integer, default=0)
    physical_items: Mapped[List["PhysicalItem"]] = relationship(back_populates="model")


class PhysicalItem(Base):
    __tablename__ = "physical_items"
    id:              Mapped[int]           = mapped_column(primary_key=True)
    model_id:        Mapped[int]           = mapped_column(ForeignKey("item_models.id"))
    patrimony_id:    Mapped[str]           = mapped_column(String(50), unique=True, index=True)
    status:          Mapped[str]           = mapped_column(String(30), default="disponivel")
    current_lab_id:  Mapped[Optional[int]] = mapped_column(ForeignKey("laboratories.id"))
    model: Mapped["ItemModel"] = relationship(back_populates="physical_items")


class Reservation(Base):
    __tablename__ = "reservations"
    id:                            Mapped[int]                      =   mapped_column(primary_key=True)
    group_id:                      Mapped[Optional[str]]            =   mapped_column(String(50), index=True)
    user_id:                       Mapped[int]                      =   mapped_column(ForeignKey("users.id"))
    lab_id:                        Mapped[Optional[int]]            =   mapped_column(ForeignKey("laboratories.id"))
    date:                          Mapped[datetime.date]            =   mapped_column(Date)
    status:                        Mapped[str]                      =   mapped_column(String(30), default="pendente")
    requested_softwares:           Mapped[Optional[str]]            =   mapped_column(Text)
    software_installation_required:Mapped[bool]                     =   mapped_column(default=False)
    approval_notes:                Mapped[Optional[str]]            =   mapped_column(Text)
    approved_by_id:                Mapped[Optional[int]]            =   mapped_column(ForeignKey("users.id"))
    rejection_reason:              Mapped[Optional[str]]            =   mapped_column(Text)
    created_at:                    Mapped[datetime]                 =   mapped_column(default=datetime.utcnow)
    slots:                         Mapped[List["LessonSlot"]]       =   relationship(secondary="reservation_slots")
    items:                         Mapped[List["ReservationItem"]]  =   relationship(back_populates="reservation")
    user:                          Mapped["User"]                   =   relationship(foreign_keys=[user_id])
    laboratory:                    Mapped[Optional["Laboratory"]]   =   relationship(foreign_keys=[lab_id])
    group_id:                      Mapped[Optional[str]]            =   mapped_column(String(50), index=True)

class ReservationSlot(Base):
    __tablename__ = "reservation_slots"
    reservation_id: Mapped[int] = mapped_column(ForeignKey("reservations.id"), primary_key=True)
    slot_id:        Mapped[int] = mapped_column(ForeignKey("lesson_slots.id"), primary_key=True)


class ReservationItem(Base):
    __tablename__ = "reservation_items"
    id:                 Mapped[int]           = mapped_column(primary_key=True)
    reservation_id:     Mapped[int]           = mapped_column(ForeignKey("reservations.id"))
    item_model_id:      Mapped[int]           = mapped_column(ForeignKey("item_models.id"))
    physical_item_id:   Mapped[Optional[int]] = mapped_column(ForeignKey("physical_items.id"))
    quantity_requested: Mapped[int]           = mapped_column(Integer, default=1)
    quantity_returned:  Mapped[int]           = mapped_column(Integer, default=0)
    return_status:      Mapped[Optional[str]] = mapped_column(String(30))
    damage_observation: Mapped[Optional[str]] = mapped_column(Text)
    reservation: Mapped["Reservation"] = relationship(back_populates="items")


class MaintenanceTicket(Base):
    __tablename__ = "maintenance_tickets"
    id:               Mapped[int]            = mapped_column(primary_key=True)
    title:            Mapped[str]            = mapped_column(String(200))
    description:      Mapped[str]            = mapped_column(Text)
    lab_id:           Mapped[Optional[int]]  = mapped_column(ForeignKey("laboratories.id"))
    physical_item_id: Mapped[Optional[int]]  = mapped_column(ForeignKey("physical_items.id"))
    opened_by_id:     Mapped[int]            = mapped_column(ForeignKey("users.id"))
    resolved_by_id:   Mapped[Optional[int]]  = mapped_column(ForeignKey("users.id"))
    status:           Mapped[str]            = mapped_column(String(30), default="aberto")
    severity:         Mapped[str]            = mapped_column(String(20), default="medio")
    resolution_notes: Mapped[Optional[str]]  = mapped_column(Text)
    created_at:       Mapped[datetime]       = mapped_column(default=datetime.utcnow)
    resolved_at:      Mapped[Optional[datetime]] = mapped_column(nullable=True)
    laboratory:    Mapped[Optional["Laboratory"]]  = relationship(foreign_keys=[lab_id])
    physical_item: Mapped[Optional["PhysicalItem"]]= relationship(foreign_keys=[physical_item_id])
    opened_by:     Mapped["User"]                  = relationship(foreign_keys=[opened_by_id])
    resolved_by:   Mapped[Optional["User"]]        = relationship(foreign_keys=[resolved_by_id])
