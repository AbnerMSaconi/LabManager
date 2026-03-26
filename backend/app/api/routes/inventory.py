from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..deps import get_db, RoleChecker, get_current_user
from ...models.base_models import (
    ItemModel, Reservation, ReservationItem, ReservationStatus,
    User, UserRole, InstitutionLoan, InventoryMovement
)
from ...schemas.reservation_schemas import ItemModelCreate, ItemModelUpdate

router = APIRouter(prefix="/api/v1/inventory", tags=["inventário"])

_ALMOX = [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR]


@router.get("/models")
async def list_item_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(ItemModel).all()


@router.get("/models/available")
async def list_available_models(
    date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime as _dt
    try:
        target_date = _dt.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use YYYY-MM-DD.")

    active_statuses = [
        ReservationStatus.PENDENTE.value, ReservationStatus.APROVADO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value, ReservationStatus.EM_USO.value,
        ReservationStatus.APROVADO_COM_RESSALVAS.value,
    ]
    reserved_rows = db.query(
        ReservationItem.item_model_id,
        func.sum(ReservationItem.quantity_requested).label("total_reserved"),
    ).join(Reservation).filter(
        Reservation.date == target_date,
        Reservation.status.in_(active_statuses),
    ).group_by(ReservationItem.item_model_id).all()

    reserved_map = {row.item_model_id: row.total_reserved for row in reserved_rows}
    models = db.query(ItemModel).all()
    return [
        {
            "id": m.id, "name": m.name, "category": m.category,
            "description": m.description, "image_url": m.image_url,
            "total_stock": m.total_stock,
            "available_qty": max(0, m.total_stock - reserved_map.get(m.id, 0)),
        }
        for m in models
    ]


@router.post("/item-models", status_code=status.HTTP_201_CREATED)
async def create_item_model(
    payload: ItemModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_ALMOX)),
):
    cat_val = payload.category.value if hasattr(payload.category, "value") else payload.category
    model = ItemModel(
        name=payload.name, category=cat_val, description=payload.description,
        image_url=payload.image_url, total_stock=payload.total_stock,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


@router.patch("/item-models/{model_id}")
async def update_item_model(
    model_id: int,
    payload: ItemModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_ALMOX)),
):
    model = db.query(ItemModel).filter(ItemModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Modelo não encontrado.")
    if payload.name        is not None: model.name        = payload.name
    if payload.category    is not None: model.category    = payload.category.value if hasattr(payload.category, "value") else payload.category
    if payload.description is not None: model.description = payload.description
    if payload.image_url   is not None: model.image_url   = payload.image_url
    if payload.total_stock is not None: model.total_stock = payload.total_stock
    db.commit()
    return model


@router.get("/stock")
async def get_realtime_stock(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    in_use_rows = db.query(
        ReservationItem.item_model_id,
        func.sum(ReservationItem.quantity_requested).label("total"),
    ).join(Reservation).filter(
        Reservation.status == ReservationStatus.EM_USO.value,
    ).group_by(ReservationItem.item_model_id).all()
    in_use_map = {r.item_model_id: r.total for r in in_use_rows}

    loan_rows = db.query(
        InstitutionLoan.item_model_id,
        func.sum(InstitutionLoan.quantity_delivered - InstitutionLoan.quantity_returned).label("total"),
    ).filter(InstitutionLoan.status == "em_aberto").group_by(InstitutionLoan.item_model_id).all()
    loan_map = {r.item_model_id: r.total for r in loan_rows}

    models = db.query(ItemModel).all()
    return [
        {
            "id": m.id, "name": m.name, "category": m.category,
            "description": m.description, "image_url": m.image_url,
            "total_stock": m.total_stock,
            "in_use": in_use_map.get(m.id, 0),
            "in_loans": loan_map.get(m.id, 0),
            "available_qty": max(0, m.total_stock - in_use_map.get(m.id, 0) - loan_map.get(m.id, 0)),
        }
        for m in models
    ]


@router.get("/movements")
async def list_inventory_movements(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_ALMOX)),
):
    movements = db.query(InventoryMovement).options(
        joinedload(InventoryMovement.model),
        joinedload(InventoryMovement.operator),
    ).order_by(InventoryMovement.created_at.desc()).limit(1000).all()
    return [
        {
            "id": m.id,
            "item_model_id": m.item_model_id,
            "action": m.action,
            "quantity": m.quantity,
            "operator_id": m.operator_id,
            "target": m.target,
            "reservation_id": m.reservation_id,
            "loan_id": m.loan_id,
            "observation": m.observation,
            "created_at": m.created_at.isoformat(),
            "model": {"id": m.model.id, "name": m.model.name, "category": m.model.category} if m.model else None,
            "operator": {"id": m.operator.id, "full_name": m.operator.full_name, "role": m.operator.role.value if hasattr(m.operator.role, 'value') else str(m.operator.role)} if m.operator else None,
        }
        for m in movements
    ]


@router.get("/pending-requests")
async def list_pending_material_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_ALMOX)),
):
    approved_statuses = [ReservationStatus.APROVADO.value, ReservationStatus.APROVADO_COM_RESSALVAS.value]
    reservations = db.query(Reservation).options(
        joinedload(Reservation.items).joinedload(ReservationItem.model),
        joinedload(Reservation.user),
        joinedload(Reservation.laboratory),
        joinedload(Reservation.slots),
    ).filter(
        Reservation.status.in_(approved_statuses),
        Reservation.items.any(),
    ).order_by(Reservation.date).all()
    return [
        {
            "id": r.id,
            "date": r.date.isoformat() if r.date else None,
            "status": r.status,
            "group_id": r.group_id,
            "user": {"id": r.user.id, "full_name": r.user.full_name, "role": r.user.role} if r.user else None,
            "laboratory": {"id": r.laboratory.id, "name": r.laboratory.name, "block": r.laboratory.block} if r.laboratory else None,
            "slots": [{"id": s.id, "code": s.code, "start_time": s.start_time, "end_time": s.end_time} for s in r.slots],
            "items": [
                {
                    "id": i.id,
                    "item_model_id": i.item_model_id,
                    "physical_item_id": i.physical_item_id,
                    "quantity_requested": i.quantity_requested,
                    "quantity_returned": i.quantity_returned,
                    "return_status": i.return_status,
                    "damage_observation": i.damage_observation,
                    "model": {"id": i.model.id, "name": i.model.name, "category": i.model.category} if i.model else None,
                }
                for i in r.items
            ],
        }
        for r in reservations
    ]
