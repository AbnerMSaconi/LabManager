from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_db, RoleChecker
from .sse import broadcast
from ...models.base_models import (
    Reservation, ReservationItem, ReservationStatus,
    User, UserRole, PhysicalItem, ItemStatus, ItemModel,
    InstitutionLoan, InventoryMovement
)
from ...schemas.reservation_schemas import (
    CheckoutRequest, CheckinRequest, InstitutionLoanCreate, InstitutionLoanReturn
)

router = APIRouter(prefix="/api/v1/logistics", tags=["logística"])

_ALL_DTI = [UserRole.DTI_ESTAGIARIO, UserRole.DTI_TECNICO, UserRole.PROGEX, UserRole.ADMINISTRADOR]
_MANAGERS = [UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR]


@router.post("/checkout")
async def checkout_items(
    request: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_ALL_DTI))
):
    reservation = db.query(Reservation).filter(Reservation.id == request.reservation_id).first()
    if not reservation or reservation.status != ReservationStatus.APROVADO.value:
        raise HTTPException(status_code=400, detail="Reserva inválida ou não aprovada para checkout.")

    for item_in in request.items:
        res_item = db.query(ReservationItem).filter(
            ReservationItem.id == item_in.reservation_item_id,
            ReservationItem.reservation_id == reservation.id
        ).first()
        if not res_item:
            raise HTTPException(status_code=404, detail=f"Item {item_in.reservation_item_id} não encontrado na reserva.")

        if item_in.patrimony_id:
            phys_item = db.query(PhysicalItem).filter(
                PhysicalItem.patrimony_id == item_in.patrimony_id
            ).first()
            if not phys_item or phys_item.status != ItemStatus.DISPONIVEL.value:
                raise HTTPException(status_code=400, detail=f"Equipamento '{item_in.patrimony_id}' indisponível.")
            phys_item.status = ItemStatus.EM_USO.value
            res_item.physical_item_id = phys_item.id
            res_item.quantity_requested = 1
        elif item_in.quantity_delivered is not None:
            res_item.quantity_requested = item_in.quantity_delivered

        prof_name = reservation.user.full_name if reservation.user else f"Usuário #{reservation.user_id}"
        db.add(InventoryMovement(
            item_model_id=res_item.item_model_id,
            action="saida",
            quantity=res_item.quantity_requested,
            operator_id=current_user.id,
            target=prof_name,
            reservation_id=reservation.id,
        ))

    reservation.status = ReservationStatus.EM_USO.value
    db.commit()
    await broadcast("CHECKOUT", {"reservation_id": request.reservation_id})
    return {"message": "Checkout realizado com sucesso."}


@router.post("/checkin")
async def checkin_items(
    request: CheckinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_ALL_DTI))
):
    reservation = db.query(Reservation).filter(Reservation.id == request.reservation_id).first()
    if not reservation or reservation.status != ReservationStatus.EM_USO.value:
        raise HTTPException(status_code=400, detail="Apenas reservas 'em_uso' podem receber devolução.")

    for item_in in request.items:
        res_item = db.query(ReservationItem).filter(
            ReservationItem.id == item_in.reservation_item_id,
            ReservationItem.reservation_id == reservation.id
        ).first()
        if not res_item:
            raise HTTPException(status_code=404, detail=f"Item {item_in.reservation_item_id} não encontrado.")

        status_val = item_in.new_status.value if hasattr(item_in.new_status, 'value') else item_in.new_status
        res_item.return_status = status_val
        res_item.damage_observation = item_in.damage_observation
        if item_in.quantity_returned is not None:
            res_item.quantity_returned = item_in.quantity_returned

        qty_returned = item_in.quantity_returned if item_in.quantity_returned is not None else res_item.quantity_requested
        prof_name = reservation.user.full_name if reservation.user else f"Usuário #{reservation.user_id}"
        obs = item_in.damage_observation if item_in.damage_observation else None
        db.add(InventoryMovement(
            item_model_id=res_item.item_model_id,
            action="entrada",
            quantity=qty_returned,
            operator_id=current_user.id,
            target=prof_name,
            reservation_id=reservation.id,
            observation=obs,
        ))

        if res_item.physical_item_id:
            phys_item = db.query(PhysicalItem).filter(
                PhysicalItem.id == res_item.physical_item_id
            ).first()
            if phys_item:
                phys_item.status = status_val

    reservation.status = ReservationStatus.CONCLUIDO.value
    db.commit()
    await broadcast("CHECKIN", {"reservation_id": request.reservation_id})
    return {"message": "Devolução registrada e inventário atualizado."}


@router.post("/loans", status_code=status.HTTP_201_CREATED)
async def create_institution_loan(
    payload: InstitutionLoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_MANAGERS)),
):
    model = db.query(ItemModel).filter(ItemModel.id == payload.item_model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    loan = InstitutionLoan(
        item_model_id=payload.item_model_id,
        requester_name=payload.requester_name,
        quantity_delivered=payload.quantity_delivered,
        return_date=payload.return_date,
        no_return_reason=payload.no_return_reason,
        created_by_id=current_user.id,
    )
    db.add(loan)
    db.flush()
    db.add(InventoryMovement(
        item_model_id=payload.item_model_id,
        action="emprestimo",
        quantity=payload.quantity_delivered,
        operator_id=current_user.id,
        target=payload.requester_name,
        loan_id=loan.id,
    ))
    db.commit()
    db.refresh(loan)
    await broadcast("LOAN_CREATED", {"id": loan.id, "item_model_id": payload.item_model_id})
    return {"message": "Empréstimo registrado.", "id": loan.id}


@router.get("/loans")
async def list_institution_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_MANAGERS)),
):
    from sqlalchemy.orm import joinedload
    loans = db.query(InstitutionLoan).options(
        joinedload(InstitutionLoan.model),
    ).order_by(InstitutionLoan.created_at.desc()).all()
    return [
        {
            "id": l.id,
            "item_model_id": l.item_model_id,
            "requester_name": l.requester_name,
            "quantity_delivered": l.quantity_delivered,
            "quantity_returned": l.quantity_returned,
            "return_date": str(l.return_date) if l.return_date else None,
            "no_return_reason": l.no_return_reason,
            "status": l.status,
            "damage_observation": l.damage_observation,
            "is_operational": l.is_operational,
            "created_at": l.created_at.isoformat(),
            "returned_at": l.returned_at.isoformat() if l.returned_at else None,
            "model": {"id": l.model.id, "name": l.model.name, "category": l.model.category} if l.model else None,
        }
        for l in loans
    ]


@router.patch("/loans/{loan_id}/return")
async def return_institution_loan(
    loan_id: int,
    payload: InstitutionLoanReturn,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_MANAGERS)),
):
    from datetime import datetime as _dt
    loan = db.query(InstitutionLoan).filter(InstitutionLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")
    if loan.status != "em_aberto":
        raise HTTPException(status_code=400, detail="Este empréstimo já foi encerrado.")
    if payload.has_damage and not payload.damage_observation:
        raise HTTPException(status_code=400, detail="Descreva a avaria ocorrida.")

    qty_ret = payload.quantity_returned if not payload.all_returned else loan.quantity_delivered
    loan.quantity_returned = qty_ret
    loan.damage_observation = payload.damage_observation if payload.has_damage else None
    loan.is_operational = payload.is_operational if payload.has_damage else None
    loan.returned_at = _dt.utcnow()
    loan.status = "devolvido_com_avaria" if payload.has_damage else "devolvido"
    obs = payload.damage_observation if payload.has_damage else None
    db.add(InventoryMovement(
        item_model_id=loan.item_model_id,
        action="devolucao",
        quantity=qty_ret,
        operator_id=current_user.id,
        target=loan.requester_name,
        loan_id=loan_id,
        observation=obs,
    ))
    db.commit()
    await broadcast("LOAN_RETURNED", {"loan_id": loan_id})
    return {"message": "Devolução registrada com sucesso."}
