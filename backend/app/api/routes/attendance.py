from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from ..deps import get_db, RoleChecker, get_current_user
from ...models.base_models import (
    TeacherAttendance, Reservation, User, UserRole,
)

router = APIRouter(prefix="/api/v1/attendance", tags=["presença"])

_DTI_ROLES = [
    UserRole.DTI_ESTAGIARIO,
    UserRole.DTI_TECNICO,
    UserRole.ADMINISTRADOR,
    UserRole.SUPER_ADMIN,
]

_ACTIVE_STATUSES = [
    "aprovado",
    "aprovado_com_ressalvas",
    "aguardando_software",
    "em_uso",
    "concluido",
]

_VALID_STATUSES = {"presente", "falta", "adiado", "justificada", "feriado"}


def _consecutive_absences(user_id: int, db: Session) -> int:
    records = (
        db.query(TeacherAttendance.status, Reservation.date)
        .join(Reservation, TeacherAttendance.reservation_id == Reservation.id)
        .filter(Reservation.user_id == user_id)
        .order_by(Reservation.date.desc(), Reservation.id.desc())
        .all()
    )
    count = 0
    for status, _ in records:
        if status == "falta":
            count += 1
        else:
            break
    return count


@router.get("")
def list_attendance(
    date: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    weekday: Optional[int] = Query(None),
    lab_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(RoleChecker(_DTI_ROLES)),
):
    query = (
        db.query(Reservation)
        .options(
            joinedload(Reservation.user),
            joinedload(Reservation.laboratory),
            joinedload(Reservation.slots),
        )
        .filter(Reservation.status.in_(_ACTIVE_STATUSES))
        .filter(Reservation.lab_id.isnot(None))
    )

    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
        query = query.filter(Reservation.date == target_date)
    elif date_from or date_to:
        if date_from:
            query = query.filter(Reservation.date >= datetime.strptime(date_from, "%Y-%m-%d").date())
        if date_to:
            query = query.filter(Reservation.date <= datetime.strptime(date_to, "%Y-%m-%d").date())

    if lab_id:
        query = query.filter(Reservation.lab_id == lab_id)

    reservations = query.order_by(Reservation.date.asc(), Reservation.id).all()

    # weekday filter applied in Python (0=Sun..6=Sat JS convention)
    if weekday is not None and date is None:
        # JS weekday 0=Sun → Python weekday() 6=Sun
        py_wd = (weekday - 1) % 7
        reservations = [r for r in reservations if r.date.weekday() == py_wd]

    reservation_ids = [r.id for r in reservations]
    attendance_map: dict = {}
    if reservation_ids:
        att_records = (
            db.query(TeacherAttendance)
            .filter(TeacherAttendance.reservation_id.in_(reservation_ids))
            .all()
        )
        attendance_map = {a.reservation_id: a.status for a in att_records}

    consec_cache: dict = {}
    result = []
    for r in reservations:
        uid = r.user_id
        if uid not in consec_cache:
            consec_cache[uid] = _consecutive_absences(uid, db)
        consec = consec_cache[uid]
        result.append({
            "reservation_id": r.id,
            "professor_id": r.user_id,
            "professor_name": r.user.full_name if r.user else "—",
            "lab_id": r.lab_id,
            "lab_name": r.laboratory.name if r.laboratory else None,
            "date": str(r.date),
            "slots": [
                {"id": s.id, "code": s.code, "start_time": s.start_time, "end_time": s.end_time}
                for s in sorted(r.slots, key=lambda s: s.start_time)
            ],
            "attendance_status": attendance_map.get(r.id),
            "consecutive_absences": consec,
            "alert": consec >= 4,
        })

    return result


class BatchItem(BaseModel):
    reservation_id: int
    status: str


class BatchRequest(BaseModel):
    records: List[BatchItem]


@router.post("/batch")
def register_batch(
    payload: BatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_DTI_ROLES)),
):
    saved = 0
    for item in payload.records:
        if item.status not in _VALID_STATUSES:
            continue
        reservation = db.query(Reservation).filter(Reservation.id == item.reservation_id).first()
        if not reservation:
            continue
        existing = (
            db.query(TeacherAttendance)
            .filter(TeacherAttendance.reservation_id == item.reservation_id)
            .first()
        )
        if existing:
            existing.status = item.status
            existing.registered_by_id = current_user.id
            existing.registered_at = datetime.utcnow()
        else:
            db.add(TeacherAttendance(
                reservation_id=item.reservation_id,
                status=item.status,
                registered_by_id=current_user.id,
                registered_at=datetime.utcnow(),
            ))
        saved += 1

    db.commit()
    return {"saved": saved}
