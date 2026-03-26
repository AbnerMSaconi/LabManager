from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

# Ajuste os imports relativos conforme a estrutura real
from ..deps import get_db, RoleChecker
from ...models.base_models import MaintenanceTicket, User, UserRole
from ...schemas.reservation_schemas import TicketCreate, TicketResolve

router = APIRouter(prefix="/api/v1/maintenance", tags=["manutenção"])

MANAGERS = [UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.ADMINISTRADOR]
ALL_DTI   = [UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR]

@router.get("/")
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

@router.post("/", status_code=status.HTTP_201_CREATED)
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

@router.patch("/{ticket_id}")
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