from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
import uuid
from pydantic import BaseModel
from datetime import date as dt_date

from .schemas.reservation_schemas import (
    ReservationCreate, ReservationReview,
    CheckoutRequest, CheckinRequest
)
from .api.deps import get_db, RoleChecker, get_current_user
from .models.base_models import (
    Reservation, ReservationItem, ReservationSlot,
    ReservationStatus, User, UserRole, PhysicalItem, ItemStatus
)
from .api.routes import auth
from .core.security import get_password_hash

app = FastAPI(
    title="LabManager Pro API",
    description="API de gerenciamento de laboratórios e almoxarifado universitário.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])


# ------------------------------------------------------------------
# Health
# ------------------------------------------------------------------

@app.get("/api/v1/health", tags=["health"])
def health_check():
    return {"status": "online", "version": "1.0.0"}


# ------------------------------------------------------------------
# Reservas
# ------------------------------------------------------------------

@app.post("/api/v1/reservations", status_code=status.HTTP_201_CREATED, tags=["reservas"])
async def create_reservation(
    reservation_in: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROFESSOR, UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    if not reservation_in.dates:
        raise HTTPException(status_code=400, detail="É necessário informar pelo menos uma data.")

    # 1. TRAVA DE OVERBOOKING EM LOTE (Checa todas as datas de uma vez)
    active_statuses = [
        ReservationStatus.PENDENTE.value,
        ReservationStatus.APROVADO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value,
        ReservationStatus.EM_USO.value
    ]

    conflict = db.query(Reservation).join(ReservationSlot).filter(
        Reservation.lab_id == reservation_in.lab_id,
        Reservation.date.in_(reservation_in.dates), # Magia aqui: procura conflito em todo o array de datas
        Reservation.status.in_(active_statuses),
        ReservationSlot.slot_id.in_(reservation_in.slot_ids)
    ).first()

    if conflict:
        raise HTTPException(
            status_code=400, 
            detail=f"Conflito de agenda: O laboratório já está reservado no dia {conflict.date.strftime('%d/%m/%Y')} para os horários selecionados."
        )

    # 2. Geração do ID do Lote (Apenas se for mais de uma data, ou seja, semestral/múltipla)
    group_id = uuid.uuid4().hex if len(reservation_in.dates) > 1 else None
    
    created_ids = []

    # 3. Transação Atômica: Cria todas as reservas do lote na mesma viagem ao banco
    for r_date in reservation_in.dates:
        new_reservation = Reservation(
            lab_id=reservation_in.lab_id,
            date=r_date,
            user_id=current_user.id,
            status=ReservationStatus.PENDENTE.value,
            requested_softwares=reservation_in.requested_softwares,
            software_installation_required=reservation_in.software_installation_required,
            group_id=group_id # Amarra a reserva ao lote
        )
        db.add(new_reservation)
        db.flush() # Gera o ID temporário sem comittar

        for slot_id in reservation_in.slot_ids:
            db.add(ReservationSlot(reservation_id=new_reservation.id, slot_id=slot_id))

        for item_in in reservation_in.items:
            db.add(ReservationItem(
                reservation_id=new_reservation.id,
                item_model_id=item_in.item_model_id,
                quantity_requested=item_in.quantity_requested,
            ))
        
        created_ids.append(new_reservation.id)

    # Se falhar em qualquer data, o banco descarta tudo. Nenhuma reserva vira "fantasma".
    db.commit()
    
    return {
        "message": f"{len(created_ids)} reserva(s) enviada(s) com sucesso.", 
        "group_id": group_id,
        "ids": created_ids
    }

@app.get("/api/v1/reservations/pending", tags=["reservas"])
async def list_pending_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    status_list = [
        ReservationStatus.PENDENTE.value, # Correção: .value inserido
        ReservationStatus.APROVADO.value, # Correção: .value inserido
        ReservationStatus.AGUARDANDO_SOFTWARE.value # Correção: .value inserido
    ]
    return db.query(Reservation).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.user),
        joinedload(Reservation.laboratory)

    ).filter(
        Reservation.status.in_(status_list)
    ).order_by(Reservation.created_at.desc()).all()


@app.get("/api/v1/reservations/awaiting-software", tags=["reservas"])
async def list_awaiting_software(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    return db.query(Reservation).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.user),
        joinedload(Reservation.laboratory)
    ).filter(
        Reservation.status == ReservationStatus.AGUARDANDO_SOFTWARE.value # Correção: .value inserido
    ).all()


@app.get("/api/v1/reservations/today", tags=["reservas"])
async def list_today_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR]))
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

@app.get("/api/v1/reservations/my", tags=["reservas"])
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


@app.get("/api/v1/reservations/date/{query_date}", tags=["reservas"])
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
    ).filter(Reservation.date == parsed_date, 
             Reservation.status.in_(status_list)
             ).all()
class GroupSwapRequest(BaseModel):
    new_lab_id: Optional[int] = None
    new_user_id: Optional[int] = None


# ------------------------------------------------------------------
# Helper: verificação de conflito de agenda na aprovação
# ------------------------------------------------------------------

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


@app.patch("/api/v1/reservations/{reservation_id}/review", tags=["reservas"])
async def review_reservation(
    reservation_id: int,
    review: ReservationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR]))
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
        )

    # ── Trava dupla de overbooking na aprovação ──────────────────────────────
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
    return {"message": f"Reserva {reservation_id} atualizada para '{review.status.value}'."}


@app.patch("/api/v1/reservations/group/{group_id}/review", tags=["reservas_semestrais"])
async def review_reservation_group(
    group_id: str,
    review: ReservationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR]))
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

    # ── Trava dupla de overbooking na aprovação do lote ─────────────────────
    if review.status in _APPROVAL_TRANSITIONS:
        ids_in_group = [r.id for r in reservations]
        conflicts: list[str] = []
        for res in reservations:
            allowed_now = valid_transitions.get(res.status, [])
            if review.status not in allowed_now:
                continue  # Só checa datas que seriam aprovadas
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
        # Atualiza apenas as reservas do lote que estão em um status válido para essa transição
        if review.status in allowed:
            res.status = review.status.value
            res.approved_by_id = current_user.id
            if review.status == ReservationStatus.REJEITADO:
                res.rejection_reason = review.rejection_reason
            if review.approval_notes:
                res.approval_notes = review.approval_notes
            updated_count += 1

    db.commit()
    return {"message": f"{updated_count} reservas do lote atualizadas para '{review.status.value}'."}

@app.patch("/api/v1/reservations/group/{group_id}/swap", tags=["reservas_semestrais"])
async def swap_reservation_group(
    group_id: str,
    payload: GroupSwapRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    if not payload.new_lab_id and not payload.new_user_id:
        raise HTTPException(status_code=400, detail="Nenhuma alteração solicitada.")

    # Busca todas as reservas ativas desse lote a partir de HOJE
    reservations = db.query(Reservation).filter(
        Reservation.group_id == group_id,
        Reservation.date >= dt_date.today(),
        Reservation.status.in_([ReservationStatus.PENDENTE.value, ReservationStatus.APROVADO.value, ReservationStatus.AGUARDANDO_SOFTWARE.value])
    ).all()

    if not reservations:
        raise HTTPException(status_code=404, detail="Lote não encontrado ou não há reservas futuras pendentes/aprovadas para alterar.")

    # Se for trocar de lab, temos que checar conflito DE TODAS AS DATAS primeiro!
    if payload.new_lab_id:
        active_statuses = [ReservationStatus.PENDENTE.value, ReservationStatus.APROVADO.value, ReservationStatus.AGUARDANDO_SOFTWARE.value, ReservationStatus.EM_USO.value]
        
        for res in reservations:
            slot_ids = [s.id for s in res.slots]
            conflict = db.query(Reservation).join(ReservationSlot).filter(
                Reservation.lab_id == payload.new_lab_id,
                Reservation.date == res.date,
                Reservation.status.in_(active_statuses),
                ReservationSlot.slot_id.in_(slot_ids),
                Reservation.id != res.id # ignora a própria reserva
            ).first()
            if conflict:
                raise HTTPException(status_code=400, detail=f"Conflito! O novo laboratório já está ocupado no dia {res.date.strftime('%d/%m/%Y')}.")

    count = 0
    for res in reservations:
        if payload.new_lab_id: res.lab_id = payload.new_lab_id
        if payload.new_user_id: res.user_id = payload.new_user_id
        count += 1

    db.commit()
    return {"message": f"{count} reservas futuras deste semestre foram transferidas com sucesso."}
# ------------------------------------------------------------------
# Logística — Checkout e Checkin
# ------------------------------------------------------------------

@app.post("/api/v1/logistics/checkout", tags=["logística"])
async def checkout_items(
    request: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_ESTAGIARIO, UserRole.DTI_TECNICO, UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    reservation = db.query(Reservation).filter(Reservation.id == request.reservation_id).first()
    # Correção: .value adicionado
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
            # Correção: .value adicionado
            if not phys_item or phys_item.status != ItemStatus.DISPONIVEL.value:
                raise HTTPException(status_code=400, detail=f"Equipamento '{item_in.patrimony_id}' indisponível.")
            phys_item.status = ItemStatus.EM_USO.value # Correção
            res_item.physical_item_id = phys_item.id
            res_item.quantity_requested = 1
        elif item_in.quantity_delivered is not None:
            res_item.quantity_requested = item_in.quantity_delivered

    reservation.status = ReservationStatus.EM_USO.value # Correção
    db.commit()
    return {"message": "Checkout realizado com sucesso."}


@app.post("/api/v1/logistics/checkin", tags=["logística"])
async def checkin_items(
    request: CheckinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_ESTAGIARIO, UserRole.DTI_TECNICO, UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    reservation = db.query(Reservation).filter(Reservation.id == request.reservation_id).first()
    # Correção: .value adicionado
    if not reservation or reservation.status != ReservationStatus.EM_USO.value:
        raise HTTPException(status_code=400, detail="Apenas reservas 'em_uso' podem receber devolução.")

    for item_in in request.items:
        res_item = db.query(ReservationItem).filter(
            ReservationItem.id == item_in.reservation_item_id,
            ReservationItem.reservation_id == reservation.id
        ).first()
        if not res_item:
            raise HTTPException(status_code=404, detail=f"Item {item_in.reservation_item_id} não encontrado.")

        # Garantindo que extraia valor se new_status for um Enum do Pydantic
        status_val = item_in.new_status.value if hasattr(item_in.new_status, 'value') else item_in.new_status
        res_item.return_status = status_val
        res_item.damage_observation = item_in.damage_observation
        if item_in.quantity_returned is not None:
            res_item.quantity_returned = item_in.quantity_returned

        if res_item.physical_item_id:
            phys_item = db.query(PhysicalItem).filter(
                PhysicalItem.id == res_item.physical_item_id
            ).first()
            if phys_item:
                phys_item.status = status_val

    reservation.status = ReservationStatus.CONCLUIDO.value # Correção
    db.commit()
    return {"message": "Devolução registrada e inventário atualizado."}


# ------------------------------------------------------------------
# Auth/me
# ------------------------------------------------------------------

@app.get("/api/v1/auth/me", tags=["auth"])
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "registration_number": current_user.registration_number,
        "full_name": current_user.full_name,
        "email": current_user.email,
        # Defesa contra falha, dependendo se vem string ou enum
        "role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
    }


# ------------------------------------------------------------------
# Laboratórios
# ------------------------------------------------------------------

from .models.base_models import Laboratory, Software as SoftwareModel, LessonSlot

class LabAvailabilityRequest(BaseModel):
    dates: List[str]
    slot_ids: List[int]
    block: Optional[str] = None


@app.post("/api/v1/labs/available", tags=["laboratórios"])
async def get_available_labs(
    req: LabAvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna os laboratórios sem nenhuma reserva ativa para as datas e horários informados.
    Usado pelo wizard do professor para sugerir laboratórios disponíveis.
    """
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

    # Lab IDs que têm pelo menos uma reserva conflitante em qualquer das datas/slots
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

    from .models.base_models import Laboratory
    query = db.query(Laboratory).options(joinedload(Laboratory.softwares))
    if req.block:
        query = query.filter(Laboratory.block == req.block)
    if conflicting_ids:
        query = query.filter(Laboratory.id.notin_(conflicting_ids))

    return query.order_by(Laboratory.name).all()


@app.get("/api/v1/labs", tags=["laboratórios"])
async def list_labs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Laboratory).options(
        joinedload(Laboratory.softwares)
    ).all()


@app.get("/api/v1/labs/{lab_id}", tags=["laboratórios"])
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


@app.get("/api/v1/slots", tags=["laboratórios"])
async def list_slots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(LessonSlot).order_by(LessonSlot.code).all()


@app.get("/api/v1/softwares", tags=["laboratórios"])
async def list_softwares(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(SoftwareModel).all()


# ------------------------------------------------------------------
# Inventário
# ------------------------------------------------------------------

from .models.base_models import ItemModel

@app.get("/api/v1/inventory/models", tags=["inventário"])
async def list_item_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(ItemModel).all()


@app.get("/api/v1/inventory/models/available", tags=["inventário"])
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


from .schemas.reservation_schemas import ItemModelCreate, ItemModelUpdate, AddReservationItemsRequest, InstitutionLoanCreate, InstitutionLoanReturn
from .models.base_models import InstitutionLoan


@app.post("/api/v1/inventory/item-models", status_code=status.HTTP_201_CREATED, tags=["inventário"])
async def create_item_model(
    payload: ItemModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR])),
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


@app.patch("/api/v1/inventory/item-models/{model_id}", tags=["inventário"])
async def update_item_model(
    model_id: int,
    payload: ItemModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR])),
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


@app.get("/api/v1/reservations/my/practical", tags=["reservas"])
async def list_my_practical_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROFESSOR])),
):
    active_statuses = [
        ReservationStatus.PENDENTE.value, ReservationStatus.APROVADO.value,
        ReservationStatus.AGUARDANDO_SOFTWARE.value, ReservationStatus.APROVADO_COM_RESSALVAS.value,
    ]
    from .models.base_models import Laboratory as Lab
    return db.query(Reservation).join(Lab, Reservation.lab_id == Lab.id).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.laboratory),
        joinedload(Reservation.user),
    ).filter(
        Reservation.user_id == current_user.id,
        Reservation.status.in_(active_statuses),
        Lab.block == "Bloco C",
    ).order_by(Reservation.date).all()


@app.post("/api/v1/reservations/{reservation_id}/add-items", tags=["reservas"])
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
    return {"message": "Materiais adicionados à reserva com sucesso."}


@app.get("/api/v1/inventory/pending-requests", tags=["inventário"])
async def list_pending_material_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR])),
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
    return reservations


@app.post("/api/v1/logistics/loans", status_code=status.HTTP_201_CREATED, tags=["logística"])
async def create_institution_loan(
    payload: InstitutionLoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR])),
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
    db.commit()
    db.refresh(loan)
    return {"message": "Empréstimo registrado.", "id": loan.id}


@app.get("/api/v1/logistics/loans", tags=["logística"])
async def list_institution_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR])),
):
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


@app.patch("/api/v1/logistics/loans/{loan_id}/return", tags=["logística"])
async def return_institution_loan(
    loan_id: int,
    payload: InstitutionLoanReturn,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR])),
):
    from datetime import datetime as _dt
    loan = db.query(InstitutionLoan).filter(InstitutionLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")
    if loan.status != "em_aberto":
        raise HTTPException(status_code=400, detail="Este empréstimo já foi encerrado.")
    if payload.has_damage and not payload.damage_observation:
        raise HTTPException(status_code=400, detail="Descreva a avaria ocorrida.")

    loan.quantity_returned = payload.quantity_returned if not payload.all_returned else loan.quantity_delivered
    loan.damage_observation = payload.damage_observation if payload.has_damage else None
    loan.is_operational = payload.is_operational if payload.has_damage else None
    loan.returned_at = _dt.utcnow()
    loan.status = "devolvido_com_avaria" if payload.has_damage else "devolvido"
    db.commit()
    return {"message": "Devolução registrada com sucesso."}


# ------------------------------------------------------------------
# Usuários
# ------------------------------------------------------------------

from .schemas.reservation_schemas import (
    UserCreate, UserUpdate, UserReadFull,
    TicketCreate, TicketResolve
)
from .models.base_models import MaintenanceTicket

MANAGERS = [UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.ADMINISTRADOR]
ALL_DTI   = [UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR]


@app.get("/api/v1/users", tags=["usuários"])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, 
        UserRole.DTI_TECNICO, 
        UserRole.DTI_ESTAGIARIO, 
        UserRole.ADMINISTRADOR]))
):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "registration_number": u.registration_number,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role, # Já estava correto de acordo com a nossa última correção
            "is_active": u.is_active,
        }
        for u in users
    ]


@app.post("/api/v1/users", status_code=status.HTTP_201_CREATED, tags=["usuários"])
async def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(MANAGERS))
):
    if db.query(User).filter(User.registration_number == payload.registration_number).first():
        raise HTTPException(status_code=400, detail="Registro já cadastrado.")
    if payload.email and db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    # Garantindo extração do valor do enum Pydantic
    role_val = payload.role.value if hasattr(payload.role, 'value') else payload.role

    user = User(
        registration_number=payload.registration_number,
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=role_val,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Usuário criado com sucesso.", "id": user.id}


@app.patch("/api/v1/users/{user_id}", tags=["usuários"])
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(MANAGERS))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if payload.full_name  is not None: user.full_name  = payload.full_name
    if payload.email      is not None: user.email      = payload.email
    if payload.role       is not None: 
        user.role = payload.role.value if hasattr(payload.role, 'value') else payload.role
    if payload.is_active  is not None: user.is_active  = payload.is_active
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)

    db.commit()
    return {"message": "Usuário atualizado."}


@app.delete("/api/v1/users/{user_id}", tags=["usuários"])
async def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode desativar sua própria conta.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    user.is_active = False
    db.commit()
    return {"message": "Usuário desativado."}


# ------------------------------------------------------------------
# Manutenção
# ------------------------------------------------------------------

@app.get("/api/v1/maintenance", tags=["manutenção"])
async def list_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(ALL_DTI))
):
    tickets = db.query(MaintenanceTicket).options(
        joinedload(MaintenanceTicket.laboratory),
        joinedload(MaintenanceTicket.opened_by),
    ).order_by(MaintenanceTicket.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "lab_id": t.lab_id,
            "lab_name": t.laboratory.name if t.laboratory else None,
            "physical_item_id": t.physical_item_id,
            "opened_by": t.opened_by.full_name if t.opened_by else None,
            "status": t.status,
            "severity": t.severity,
            "resolution_notes": t.resolution_notes,
            "created_at": t.created_at.isoformat(),
            "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
        }
        for t in tickets
    ]


@app.post("/api/v1/maintenance", status_code=status.HTTP_201_CREATED, tags=["manutenção"])
async def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(ALL_DTI))
):
    ticket = MaintenanceTicket(
        title=payload.title,
        description=payload.description,
        lab_id=payload.lab_id,
        physical_item_id=payload.physical_item_id,
        severity=payload.severity,
        opened_by_id=current_user.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {"message": "Chamado aberto com sucesso.", "id": ticket.id}


@app.patch("/api/v1/maintenance/{ticket_id}", tags=["manutenção"])
async def resolve_ticket(
    ticket_id: int,
    payload: TicketResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(MANAGERS))
):
    ticket = db.query(MaintenanceTicket).filter(MaintenanceTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")
    from datetime import datetime as dt
    ticket.status = payload.status
    ticket.resolution_notes = payload.resolution_notes
    ticket.resolved_by_id = current_user.id
    if payload.status == "resolvido":
        ticket.resolved_at = dt.utcnow()
    db.commit()
    return {"message": "Chamado atualizado."}


# ------------------------------------------------------------------
# Laboratórios — CRUD completo (Progex)
# ------------------------------------------------------------------

from .schemas.reservation_schemas import LaboratoryCreate, LaboratoryUpdate, SoftwareCreate


@app.post("/api/v1/labs", status_code=status.HTTP_201_CREATED, tags=["laboratórios"])
async def create_lab(
    payload: LaboratoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    VALID_BLOCKS = {"Bloco A", "Bloco B", "Bloco C"}
    if payload.block not in VALID_BLOCKS:
        raise HTTPException(status_code=400, detail=f"Bloco inválido: {payload.block}. Use: {', '.join(sorted(VALID_BLOCKS))}")
    block = payload.block
    lab = Laboratory(
        name=payload.name, block=block, room_number=payload.room_number,
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


@app.put("/api/v1/labs/{lab_id}", tags=["laboratórios"])
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


@app.delete("/api/v1/labs/{lab_id}", tags=["laboratórios"])
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


# ------------------------------------------------------------------
# Softwares
# ------------------------------------------------------------------

@app.post("/api/v1/softwares", status_code=status.HTTP_201_CREATED, tags=["laboratórios"])
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


@app.delete("/api/v1/softwares/{sw_id}", tags=["laboratórios"])
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

@app.get("/api/v1/reservations", tags=["reservas"])
async def list_all_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.PROGEX, UserRole.ADMINISTRADOR]))
):
    # Retorna o "bolão" de reservas com todas as relações carregadas para o Frontend filtrar
    return db.query(Reservation).options(
        joinedload(Reservation.slots),
        joinedload(Reservation.items),
        joinedload(Reservation.user),
        joinedload(Reservation.laboratory)
    ).order_by(Reservation.date.desc()).all()