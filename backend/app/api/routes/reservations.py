from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
import uuid
from pydantic import BaseModel

from ..deps import get_db, RoleChecker, get_current_user
from .sse import sse_manager
from ...models.base_models import (
    Reservation, ReservationItem, ReservationSlot,
    ReservationStatus, User, UserRole, ItemModel, Laboratory
)
from ...schemas.reservation_schemas import (
    ReservationCreate, ReservationReview, AddReservationItemsRequest, ReservationUpdate
)

router = APIRouter(prefix="/api/v1/reservations", tags=["reservas"])

# Roles que recebem notificações de reserva além do professor dono
_STAFF_ROLES = [
    UserRole.DTI_ESTAGIARIO.value,
    UserRole.DTI_TECNICO.value,
    UserRole.PROGEX.value,
]


async def _notify_reservation(db: Session, professor_id: int, event_type: str, payload: dict) -> None:
    """Envia evento SSE apenas para o professor dono da reserva + todos DTI/PROGEX ativos.
    Inclui 'professor_id' no payload para que o frontend possa validar por conta própria."""
    staff_ids = [
        row[0] for row in db.query(User.id).filter(
            User.role.in_(_STAFF_ROLES),
            User.is_active == True,
        ).all()
    ]
    recipient_ids = list({professor_id} | set(staff_ids))
    await sse_manager.send_to_users(recipient_ids, event_type, {**payload, "professor_id": professor_id})


class GroupSwapRequest(BaseModel):
    new_lab_id: Optional[int] = None
    new_user_id: Optional[int] = None


# Statuses que "bloqueiam" um slot — só estes causam conflito ao aprovar
_BLOCKING_STATUSES = [
    ReservationStatus.APROVADO.value,
    ReservationStatus.APROVADO_COM_RESSALVAS.value,
    ReservationStatus.AGUARDANDO_SOFTWARE.value,
    ReservationStatus.EM_USO.value,
]

# Statuses que requerem verificação de conflito ao transicionar para eles
_APPROVAL_TRANSITIONS = [
    ReservationStatus.APROVADO,
    ReservationStatus.APROVADO_COM_RESSALVAS,
    ReservationStatus.AGUARDANDO_SOFTWARE,
]


def _find_approval_conflict(
    db: Session,
    lab_id: int,
    res_date,
    slot_ids: list,
    exclude_ids: list = None,
):
    """Retorna a primeira reserva ativa que conflite com lab+data+slots, se houver."""
    if not slot_ids:
        return None
    q = (
        db.query(Reservation)
        .options(joinedload(Reservation.user), joinedload(Reservation.laboratory))
        .join(ReservationSlot, ReservationSlot.reservation_id == Reservation.id)
        .filter(
            Reservation.lab_id == lab_id,
            Reservation.date == res_date,
            Reservation.status.in_(_BLOCKING_STATUSES),
            ReservationSlot.slot_id.in_(slot_ids),
        )
    )
    if exclude_ids:
        q = q.filter(Reservation.id.notin_(exclude_ids))
    return q.first()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_reservation(
    reservation_in: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROFESSOR, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    if not reservation_in.dates:
        raise HTTPException(status_code=400, detail="É necessário informar pelo menos uma data.")

    active_statuses = [
        ReservationStatus.PENDENTE.value,
        ReservationStatus.APROVADO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value,
        ReservationStatus.EM_USO.value
    ]

    conflict = db.query(Reservation).join(ReservationSlot).filter(
        Reservation.lab_id == reservation_in.lab_id,
        Reservation.date.in_(reservation_in.dates),
        Reservation.status.in_(active_statuses),
        ReservationSlot.slot_id.in_(reservation_in.slot_ids)
    ).first()

    if conflict:
        raise HTTPException(
            status_code=400,
            detail=f"Conflito de agenda: O laboratório já está reservado no dia {conflict.date.strftime('%d/%m/%Y')} para os horários selecionados."
        )

    group_id = uuid.uuid4().hex if len(reservation_in.dates) > 1 else None
    created_ids = []

    for r_date in reservation_in.dates:
        new_reservation = Reservation(
            lab_id=reservation_in.lab_id,
            date=r_date,
            user_id=current_user.id,
            status=ReservationStatus.PENDENTE.value,
            requested_softwares=reservation_in.requested_softwares,
            software_installation_required=reservation_in.software_installation_required,
            group_id=group_id
        )
        db.add(new_reservation)
        db.flush()

        for slot_id in reservation_in.slot_ids:
            db.add(ReservationSlot(reservation_id=new_reservation.id, slot_id=slot_id))

        for item_in in reservation_in.items:
            db.add(ReservationItem(
                reservation_id=new_reservation.id,
                item_model_id=item_in.item_model_id,
                quantity_requested=item_in.quantity_requested,
            ))

        created_ids.append(new_reservation.id)

    db.commit()
    await _notify_reservation(db, current_user.id, "RESERVATION_CREATED", {"ids": created_ids, "group_id": group_id, "lab_id": reservation_in.lab_id})
    return {
        "message": f"{len(created_ids)} reserva(s) enviada(s) com sucesso.",
        "group_id": group_id,
        "ids": created_ids
    }


@router.get("/pending")
async def list_pending_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    status_list = [
        ReservationStatus.PENDENTE.value,
        ReservationStatus.APROVADO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value
    ]
    return db.query(Reservation).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.user),
        joinedload(Reservation.laboratory)
    ).filter(
        Reservation.status.in_(status_list)
    ).order_by(Reservation.created_at.desc()).all()


@router.get("/awaiting-software")
async def list_awaiting_software(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    return db.query(Reservation).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.user),
        joinedload(Reservation.laboratory)
    ).filter(
        Reservation.status == ReservationStatus.AGUARDANDO_SOFTWARE.value
    ).all()


@router.get("/today")
async def list_today_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    from datetime import date
    status_list = [
        ReservationStatus.APROVADO.value,
        ReservationStatus.EM_USO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value
    ]
    return db.query(Reservation).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.user),
        joinedload(Reservation.laboratory)
    ).filter(
        Reservation.date == date.today(),
        Reservation.status.in_(status_list)
    ).all()


@router.get("/my")
async def list_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Reservation).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.user),
        joinedload(Reservation.laboratory)
    ).filter(
        Reservation.user_id == current_user.id
    ).order_by(Reservation.created_at.desc()).all()


@router.get("/my/practical")
async def list_my_practical_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROFESSOR])),
):
    active_statuses = [
        ReservationStatus.PENDENTE.value, ReservationStatus.APROVADO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value, ReservationStatus.APROVADO_COM_RESSALVAS.value,
    ]
    return db.query(Reservation).join(Laboratory, Reservation.lab_id == Laboratory.id).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.laboratory),
        joinedload(Reservation.user),
    ).filter(
        Reservation.user_id == current_user.id,
        Reservation.status.in_(active_statuses),
        Laboratory.block == "Bloco C",
    ).order_by(Reservation.date).all()


@router.get("/date/{query_date}")
async def list_reservations_by_date(
    query_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime
    try:
        parsed_date = datetime.strptime(query_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD.")
    status_list = [
        ReservationStatus.PENDENTE.value,
        ReservationStatus.APROVADO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value,
        ReservationStatus.EM_USO.value
    ]
    return db.query(Reservation).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.laboratory),
        joinedload(Reservation.user),
    ).filter(
        Reservation.date == parsed_date,
        Reservation.status.in_(status_list)
    ).all()


@router.get("/")
async def list_all_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    return db.query(Reservation).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items).joinedload(ReservationItem.model),
        joinedload(Reservation.user),
        joinedload(Reservation.laboratory)
    ).order_by(Reservation.date.desc()).all()


@router.patch("/{reservation_id}/review")
async def review_reservation(
    reservation_id: int,
    review: ReservationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva não encontrada.")

    valid_transitions = {
        ReservationStatus.PENDENTE.value: [
            ReservationStatus.APROVADO,
            ReservationStatus.APROVADO_COM_RESSALVAS,
            ReservationStatus.REJEITADO,
            ReservationStatus.AGUARDANDO_SOFTWARE,
        ],
        ReservationStatus.APROVADO.value: [ReservationStatus.AGUARDANDO_SOFTWARE],
        ReservationStatus.APROVADO_COM_RESSALVAS.value: [ReservationStatus.APROVADO],
        ReservationStatus.AGUARDANDO_SOFTWARE.value: [ReservationStatus.APROVADO],
    }
    allowed = valid_transitions.get(reservation.status, [])
    if review.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transição inválida: {reservation.status} → {review.status.value}. "
                   f"Permitidas: {[s.value for s in allowed]}"
        )

    if review.status in _APPROVAL_TRANSITIONS:
        slot_ids = [rs.slot_id for rs in db.query(ReservationSlot).filter(ReservationSlot.reservation_id == reservation_id).all()]
        conflict = _find_approval_conflict(db, reservation.lab_id, reservation.date, slot_ids, exclude_ids=[reservation_id])
        if conflict:
            prof = conflict.user.full_name if conflict.user else "outro professor"
            lab  = conflict.laboratory.name if conflict.laboratory else "o mesmo laboratório"
            date_fmt = conflict.date.strftime("%d/%m/%Y") if hasattr(conflict.date, "strftime") else str(conflict.date)
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Conflito de agenda: {prof} já possui reserva ativa ({conflict.status}) "
                    f"em {lab} no dia {date_fmt} para os mesmos horários. "
                    f"Sugestão: rejeite esta solicitação ou remaneje para outro laboratório/horário."
                ),
            )

    reservation.status = review.status.value
    reservation.approved_by_id = current_user.id
    if review.status == ReservationStatus.REJEITADO:
        reservation.rejection_reason = review.rejection_reason
    if review.approval_notes:
        reservation.approval_notes = review.approval_notes

    db.commit()
    await _notify_reservation(db, reservation.user_id, "RESERVATION_UPDATED", {"id": reservation_id, "status": review.status.value})
    return {"message": f"Reserva {reservation_id} atualizada para '{review.status.value}'."}


@router.patch("/group/{group_id}/review", tags=["reservas_semestrais"])
async def review_reservation_group(
    group_id: str,
    review: ReservationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    reservations = db.query(Reservation).filter(Reservation.group_id == group_id).all()
    if not reservations:
        raise HTTPException(status_code=404, detail="Lote não encontrado.")

    valid_transitions = {
        ReservationStatus.PENDENTE.value: [
            ReservationStatus.APROVADO,
            ReservationStatus.APROVADO_COM_RESSALVAS,
            ReservationStatus.REJEITADO,
            ReservationStatus.AGUARDANDO_SOFTWARE,
        ],
        ReservationStatus.APROVADO.value: [ReservationStatus.AGUARDANDO_SOFTWARE],
        ReservationStatus.APROVADO_COM_RESSALVAS.value: [ReservationStatus.APROVADO],
        ReservationStatus.AGUARDANDO_SOFTWARE.value: [ReservationStatus.APROVADO],
    }

    if review.status in _APPROVAL_TRANSITIONS:
        ids_in_group = [r.id for r in reservations]
        conflicts: list[str] = []
        for res in reservations:
            allowed_now = valid_transitions.get(res.status, [])
            if review.status not in allowed_now:
                continue
            slot_ids = [rs.slot_id for rs in db.query(ReservationSlot).filter(ReservationSlot.reservation_id == res.id).all()]
            c = _find_approval_conflict(db, res.lab_id, res.date, slot_ids, exclude_ids=ids_in_group)
            if c:
                prof = c.user.full_name if c.user else "outro professor"
                date_fmt = res.date.strftime("%d/%m/%Y") if hasattr(res.date, "strftime") else str(res.date)
                conflicts.append(f"• {date_fmt}: conflito com {prof} ({c.status})")
        if conflicts:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Conflito de agenda em {len(conflicts)} data(s) do lote:\n"
                    + "\n".join(conflicts)
                    + "\nSugestão: rejeite este lote ou remaneje para outro laboratório/horário."
                ),
            )

    updated_count = 0
    for res in reservations:
        allowed = valid_transitions.get(res.status, [])
        if review.status in allowed:
            res.status = review.status.value
            res.approved_by_id = current_user.id
            if review.status == ReservationStatus.REJEITADO:
                res.rejection_reason = review.rejection_reason
            if review.approval_notes:
                res.approval_notes = review.approval_notes
            updated_count += 1

    db.commit()
    professor_id = reservations[0].user_id if reservations else 0
    await _notify_reservation(db, professor_id, "RESERVATION_UPDATED", {"group_id": group_id, "status": review.status.value, "count": updated_count})
    return {"message": f"{updated_count} reservas do lote atualizadas para '{review.status.value}'."}


@router.patch("/group/{group_id}/swap", tags=["reservas_semestrais"])
async def swap_reservation_group(
    group_id: str,
    payload: GroupSwapRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    from datetime import date as dt_date
    if not payload.new_lab_id and not payload.new_user_id:
        raise HTTPException(status_code=400, detail="Nenhuma alteração solicitada.")

    reservations = db.query(Reservation).filter(
        Reservation.group_id == group_id,
        Reservation.date >= dt_date.today(),
        Reservation.status.in_([ReservationStatus.PENDENTE.value, ReservationStatus.APROVADO.value, ReservationStatus.AGUARDANDO_SOFTWARE.value])
    ).all()

    if not reservations:
        raise HTTPException(status_code=404, detail="Lote não encontrado ou não há reservas futuras pendentes/aprovadas para alterar.")

    if payload.new_lab_id:
        active_statuses = [ReservationStatus.PENDENTE.value, ReservationStatus.APROVADO.value, ReservationStatus.AGUARDANDO_SOFTWARE.value, ReservationStatus.EM_USO.value]
        for res in reservations:
            slot_ids = [s.id for s in res.slots]
            conflict = db.query(Reservation).join(ReservationSlot).filter(
                Reservation.lab_id == payload.new_lab_id,
                Reservation.date == res.date,
                Reservation.status.in_(active_statuses),
                ReservationSlot.slot_id.in_(slot_ids),
                Reservation.id != res.id
            ).first()
            if conflict:
                raise HTTPException(status_code=400, detail=f"Conflito! O novo laboratório já está ocupado no dia {res.date.strftime('%d/%m/%Y')}.")

    count = 0
    for res in reservations:
        if payload.new_lab_id: res.lab_id = payload.new_lab_id
        if payload.new_user_id: res.user_id = payload.new_user_id
        count += 1

    db.commit()
    professor_id = reservations[0].user_id if reservations else 0
    await _notify_reservation(db, professor_id, "RESERVATION_UPDATED", {"group_id": group_id, "action": "swap", "count": count})
    return {"message": f"{count} reservas futuras deste semestre foram transferidas com sucesso."}


@router.post("/{reservation_id}/add-items")
async def add_items_to_reservation(
    reservation_id: int,
    payload: AddReservationItemsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reservation = db.query(Reservation).filter(
        Reservation.id == reservation_id,
        Reservation.user_id == current_user.id,
    ).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva não encontrada.")
    if reservation.status in [ReservationStatus.REJEITADO.value, ReservationStatus.CANCELADO.value, ReservationStatus.CONCLUIDO.value]:
        raise HTTPException(status_code=400, detail="Esta reserva não aceita mais materiais.")

    active_statuses = [
        ReservationStatus.PENDENTE.value, ReservationStatus.APROVADO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value, ReservationStatus.EM_USO.value,
        ReservationStatus.APROVADO_COM_RESSALVAS.value,
    ]
    for item_in in payload.items:
        model = db.query(ItemModel).filter(ItemModel.id == item_in.item_model_id).first()
        if not model:
            raise HTTPException(status_code=404, detail=f"Item {item_in.item_model_id} não encontrado.")
        reserved = db.query(func.sum(ReservationItem.quantity_requested)).join(Reservation).filter(
            ReservationItem.item_model_id == item_in.item_model_id,
            Reservation.date == reservation.date,
            Reservation.status.in_(active_statuses),
            Reservation.id != reservation_id,
        ).scalar() or 0
        available = model.total_stock - reserved
        if item_in.quantity_requested > available:
            raise HTTPException(
                status_code=400,
                detail=f"Quantidade insuficiente de '{model.name}'. Disponível: {available}",
            )
        existing = db.query(ReservationItem).filter(
            ReservationItem.reservation_id == reservation_id,
            ReservationItem.item_model_id == item_in.item_model_id,
        ).first()
        if existing:
            existing.quantity_requested = item_in.quantity_requested
        else:
            db.add(ReservationItem(
                reservation_id=reservation_id,
                item_model_id=item_in.item_model_id,
                quantity_requested=item_in.quantity_requested,
            ))
    db.commit()
    await _notify_reservation(db, current_user.id, "RESERVATION_UPDATED", {"id": reservation_id, "action": "items_added"})
    return {"message": "Materiais adicionados à reserva com sucesso."}

@router.put("/{reservation_id}", tags=["reservas"])
async def update_reservation(
    reservation_id: int,
    payload: ReservationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva não encontrada.")

    target_lab_id = payload.lab_id if payload.lab_id is not None else reservation.lab_id
    target_date = payload.date if payload.date is not None else reservation.date
    target_slots = payload.slot_ids if payload.slot_ids is not None else [s.id for s in reservation.slots]

    # Regra de Conflito: DTI tem prioridade máxima.
    blocking_statuses = [
        ReservationStatus.APROVADO.value, 
        ReservationStatus.AGUARDANDO_SOFTWARE.value, 
        ReservationStatus.EM_USO.value, 
        ReservationStatus.APROVADO_COM_RESSALVAS.value
    ]
    
    conflict = db.query(Reservation).join(ReservationSlot).filter(
        Reservation.id != reservation_id,
        Reservation.lab_id == target_lab_id,
        Reservation.date == target_date,
        Reservation.status.in_(blocking_statuses),
        ReservationSlot.slot_id.in_(target_slots)
    ).first()

    if conflict:
        raise HTTPException(status_code=409, detail=f"Conflito! O horário desejado já está ocupado pela reserva confirmada #{conflict.id}.")

    # Executa a alteração
    if payload.lab_id is not None:
        reservation.lab_id = payload.lab_id
    if payload.date is not None:
        reservation.date = payload.date
    if payload.slot_ids is not None:
        db.query(ReservationSlot).filter(ReservationSlot.reservation_id == reservation_id).delete()
        for slot_id in payload.slot_ids:
            db.add(ReservationSlot(reservation_id=reservation_id, slot_id=slot_id))

    db.commit()
    # CORREÇÃO AQUI: Passando db e reservation.user_id para a notificação não dar erro 500
    await _notify_reservation(db, reservation.user_id, "RESERVATION_UPDATED", {"id": reservation_id, "action": "updated"})
    return {"message": "Reserva atualizada com sucesso."}


@router.delete("/{reservation_id}", tags=["reservas"])
async def delete_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva não encontrada.")

    professor_id = reservation.user_id
    db.query(ReservationSlot).filter(ReservationSlot.reservation_id == reservation_id).delete()
    db.query(ReservationItem).filter(ReservationItem.reservation_id == reservation_id).delete()
    db.delete(reservation)
    db.commit()
    await _notify_reservation(db, professor_id, "RESERVATION_UPDATED", {"id": reservation_id, "action": "deleted"})
    return {"message": f"Reserva {reservation_id} excluída com sucesso."}