from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel

from ..deps import get_db, RoleChecker, get_current_user
from ...models.base_models import (
    Laboratory, Software as SoftwareModel, LessonSlot,
    Reservation, ReservationSlot, ReservationStatus, User, UserRole
)
from ...schemas.reservation_schemas import LaboratoryCreate, LaboratoryUpdate, SoftwareCreate

router = APIRouter(prefix="/api/v1", tags=["laboratórios"])


class LabAvailabilityRequest(BaseModel):
    dates: List[str]
    slot_ids: List[int]
    block: Optional[str] = None


@router.post("/labs/available")
async def get_available_labs(
    req: LabAvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime as _dt
    if not req.dates or not req.slot_ids:
        raise HTTPException(status_code=400, detail="Datas e horários são obrigatórios.")

    parsed_dates = []
    for d in req.dates:
        try:
            parsed_dates.append(_dt.strptime(d, "%Y-%m-%d").date())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Data inválida: {d}")

    active_statuses = [
        ReservationStatus.PENDENTE.value,
        ReservationStatus.APROVADO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value,
        ReservationStatus.EM_USO.value,
    ]

    conflicting_rows = (
        db.query(Reservation.lab_id)
        .join(ReservationSlot, ReservationSlot.reservation_id == Reservation.id)
        .filter(
            Reservation.date.in_(parsed_dates),
            Reservation.status.in_(active_statuses),
            ReservationSlot.slot_id.in_(req.slot_ids),
        )
        .distinct()
        .all()
    )
    conflicting_ids = {row.lab_id for row in conflicting_rows}

    query = db.query(Laboratory).options(joinedload(Laboratory.softwares))
    if req.block:
        query = query.filter(Laboratory.block == req.block)
    if conflicting_ids:
        query = query.filter(Laboratory.id.notin_(conflicting_ids))

    return query.order_by(Laboratory.name).all()


@router.get("/labs")
async def list_labs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Laboratory).options(
        joinedload(Laboratory.softwares)
    ).all()


@router.get("/labs/{lab_id}")
async def get_lab(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lab = db.query(Laboratory).options(
        joinedload(Laboratory.softwares)
    ).filter(Laboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratório não encontrado.")
    return lab


@router.post("/labs", status_code=status.HTTP_201_CREATED)
async def create_lab(
    payload: LaboratoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    VALID_BLOCKS = {"Bloco A", "Bloco B", "Bloco C"}
    if payload.block not in VALID_BLOCKS:
        raise HTTPException(status_code=400, detail=f"Bloco inválido: {payload.block}. Use: {', '.join(sorted(VALID_BLOCKS))}")
    lab = Laboratory(
        name=payload.name, block=payload.block, room_number=payload.room_number,
        capacity=payload.capacity, is_practical=payload.is_practical,
        description=payload.description,
    )
    db.add(lab)
    db.flush()
    for sw_id in payload.software_ids:
        sw = db.query(SoftwareModel).filter(SoftwareModel.id == sw_id).first()
        if sw:
            lab.softwares.append(sw)
    db.commit()
    db.refresh(lab)
    return {"message": "Laboratório criado.", "id": lab.id}


@router.put("/labs/{lab_id}")
async def update_lab(
    lab_id: int,
    payload: LaboratoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    lab = db.query(Laboratory).options(joinedload(Laboratory.softwares)).filter(Laboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratório não encontrado.")

    VALID_BLOCKS = {"Bloco A", "Bloco B", "Bloco C"}
    if payload.name        is not None: lab.name        = payload.name
    if payload.block       is not None:
        if payload.block not in VALID_BLOCKS:
            raise HTTPException(status_code=400, detail=f"Bloco inválido: {payload.block}. Use: {', '.join(sorted(VALID_BLOCKS))}")
        lab.block = payload.block
    if payload.room_number  is not None: lab.room_number  = payload.room_number
    if payload.capacity     is not None: lab.capacity     = payload.capacity
    if payload.is_practical is not None: lab.is_practical = payload.is_practical
    if payload.description  is not None: lab.description  = payload.description
    if payload.is_active    is not None: lab.is_active    = payload.is_active
    if payload.software_ids is not None:
        lab.softwares = []
        for sw_id in payload.software_ids:
            sw = db.query(SoftwareModel).filter(SoftwareModel.id == sw_id).first()
            if sw: lab.softwares.append(sw)
    db.commit()
    return {"message": "Laboratório atualizado."}


@router.delete("/labs/{lab_id}")
async def delete_lab(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    lab = db.query(Laboratory).filter(Laboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratório não encontrado.")
    db.delete(lab)
    db.commit()
    return {"message": "Laboratório excluído."}


@router.get("/slots")
async def list_slots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(LessonSlot).order_by(LessonSlot.code).all()


@router.get("/softwares")
async def list_softwares(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(SoftwareModel).all()


@router.post("/softwares", status_code=status.HTTP_201_CREATED)
async def create_software(
    payload: SoftwareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.ADMINISTRADOR]))
):
    sw = SoftwareModel(name=payload.name, version=payload.version)
    db.add(sw)
    db.commit()
    db.refresh(sw)
    return {"message": "Software cadastrado.", "id": sw.id}


@router.delete("/softwares/{sw_id}")
async def delete_software(
    sw_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.ADMINISTRADOR]))
):
    sw = db.query(SoftwareModel).filter(SoftwareModel.id == sw_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Software não encontrado.")
    db.delete(sw)
    db.commit()
    return {"message": "Software removido."}
