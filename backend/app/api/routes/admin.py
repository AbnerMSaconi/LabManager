import os
import json
import shutil
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..deps import get_db, RoleChecker, get_current_user
from ...models.base_models import (
    User, UserRole, Laboratory, Software, ItemModel,
    AuditLog, SystemBackup,
    Reservation, ReservationSlot, ReservationItem,
    MaintenanceTicket, InventoryMovement, InstitutionLoan,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

SUPER_ADMIN_ONLY = RoleChecker([UserRole.SUPER_ADMIN])
# O backend lê/serve de /app/backups; o SQL Server escreve em /var/opt/mssql/backup
# Ambos apontam para o mesmo volume Docker (backup_data)
BACKUP_DIR = os.getenv("BACKUP_DIR", "/app/backups")
MSSQL_BACKUP_DIR = os.getenv("MSSQL_BACKUP_DIR", "/var/opt/mssql/backup")


# --------------------------------------------------------------------------- #
#  UTILITÁRIO: resolve o model SQLAlchemy pelo nome da tabela
# --------------------------------------------------------------------------- #
_TABLE_MODEL_MAP = {
    "users":        User,
    "laboratories": Laboratory,
    "softwares":    Software,
    "item_models":  ItemModel,
}


# --------------------------------------------------------------------------- #
#  QUARENTENA - Listagem
# --------------------------------------------------------------------------- #

@router.get("/quarantine")
async def list_quarantine(
    db: Session = Depends(get_db),
    current_user: User = Depends(SUPER_ADMIN_ONLY),
):
    """Lista todos os registros em quarentena (deleted_at != NULL) nas tabelas principais."""
    results = {}
    for table_name, Model in _TABLE_MODEL_MAP.items():
        records = db.query(Model).filter(Model.deleted_at != None).all()
        results[table_name] = [
            {"id": r.id, "deleted_at": r.deleted_at.isoformat() if r.deleted_at else None,
             "name": getattr(r, "name", getattr(r, "full_name", str(r.id)))}
            for r in records
        ]
    return results


# --------------------------------------------------------------------------- #
#  QUARENTENA - Restaurar
# --------------------------------------------------------------------------- #

@router.post("/restore/{table_name}/{record_id}", status_code=status.HTTP_200_OK)
async def restore_record(
    table_name: str,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(SUPER_ADMIN_ONLY),
):
    """Restaura um registro da quarentena setando deleted_at = NULL."""
    Model = _TABLE_MODEL_MAP.get(table_name)
    if not Model:
        raise HTTPException(status_code=400, detail=f"Tabela '{table_name}' não suportada.")
    record = db.query(Model).filter(Model.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    if record.deleted_at is None:
        raise HTTPException(status_code=400, detail="Este registro não está na quarentena.")
    record.deleted_at = None
    db.commit()
    return {"message": f"Registro {record_id} da tabela '{table_name}' restaurado com sucesso."}


# --------------------------------------------------------------------------- #
#  QUARENTENA - Destruir agora (hard delete imediato)
# --------------------------------------------------------------------------- #

@router.delete("/destroy/{table_name}/{record_id}", status_code=status.HTTP_200_OK)
async def destroy_record(
    table_name: str,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(SUPER_ADMIN_ONLY),
):
    """Apaga permanentemente um registro em quarentena."""
    Model = _TABLE_MODEL_MAP.get(table_name)
    if not Model:
        raise HTTPException(status_code=400, detail=f"Tabela '{table_name}' não suportada.")
    record = db.query(Model).filter(Model.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    db.delete(record)
    db.commit()
    return {"message": f"Registro {record_id} da tabela '{table_name}' destruído permanentemente."}


# --------------------------------------------------------------------------- #
#  AUDITORIA - Listagem
# --------------------------------------------------------------------------- #

@router.get("/audit-logs")
async def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(SUPER_ADMIN_ONLY),
):
    """Lista logs de auditoria mais recentes."""
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "old_data": json.loads(log.old_data) if log.old_data else None,
            "new_data": json.loads(log.new_data) if log.new_data else None,
            "user_id": log.user_id,
            "author_name": log.author.full_name if log.author else None,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


# --------------------------------------------------------------------------- #
#  AUDITORIA - Desfazer alteração
# --------------------------------------------------------------------------- #

@router.post("/revert-edit/{audit_id}", status_code=status.HTTP_200_OK)
async def revert_edit(
    audit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(SUPER_ADMIN_ONLY),
):
    """Reverte uma edição restaurando o old_data de um log de auditoria."""
    audit = db.query(AuditLog).filter(AuditLog.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Log de auditoria não encontrado.")
    if not audit.old_data:
        raise HTTPException(status_code=400, detail="Este log não possui dados anteriores para restaurar.")

    Model = _TABLE_MODEL_MAP.get(audit.table_name)
    if not Model:
        raise HTTPException(status_code=400, detail=f"Tabela '{audit.table_name}' não suportada para reversão.")

    record = db.query(Model).filter(Model.id == audit.record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro original não encontrado.")

    old = json.loads(audit.old_data)
    for key, value in old.items():
        if hasattr(record, key):
            setattr(record, key, value)

    db.commit()
    return {"message": f"Alteração revertida com sucesso para {audit.table_name}#{audit.record_id}."}


# --------------------------------------------------------------------------- #
#  BACKUP
# --------------------------------------------------------------------------- #

class PasswordConfirmBody(BaseModel):
    password: str


@router.post("/backup", status_code=status.HTTP_201_CREATED)
async def create_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(SUPER_ADMIN_ONLY),
):
    """Gera um backup JSON de todas as tabelas e registra na tabela system_backups."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.json"
    filepath = os.path.join(BACKUP_DIR, filename)
    size_mb = None

    try:
        from ...models.base_models import (
            LessonSlot, Laboratory, Software, LabSoftware,
            PhysicalItem, Reservation, ReservationSlot, ReservationItem,
            InstitutionLoan, MaintenanceTicket, InventoryMovement,
        )

        def rows_to_list(model):
            rows = db.query(model).all()
            result = []
            for row in rows:
                d = {}
                for col in model.__table__.columns:
                    val = getattr(row, col.name)
                    if hasattr(val, "isoformat"):
                        val = val.isoformat()
                    d[col.name] = val
                result.append(d)
            return result

        backup_payload = {
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": current_user.registration_number,
            "tables": {
                "users": rows_to_list(User),
                "lesson_slots": rows_to_list(LessonSlot),
                "laboratories": rows_to_list(Laboratory),
                "softwares": rows_to_list(Software),
                "item_models": rows_to_list(ItemModel),
                "physical_items": rows_to_list(PhysicalItem),
                "reservations": rows_to_list(Reservation),
                "reservation_items": rows_to_list(ReservationItem),
                "institution_loans": rows_to_list(InstitutionLoan),
                "maintenance_tickets": rows_to_list(MaintenanceTicket),
                "inventory_movements": rows_to_list(InventoryMovement),
            },
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(backup_payload, f, ensure_ascii=False, indent=2, default=str)

        if os.path.exists(filepath):
            size_mb = round(os.path.getsize(filepath) / (1024 * 1024), 2)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar backup: {str(e)}")

    backup_record = SystemBackup(
        filename=filename,
        size_mb=size_mb,
        triggered_by_id=current_user.id,
    )
    db.add(backup_record)
    db.commit()
    db.refresh(backup_record)
    return {"message": "Backup gerado com sucesso.", "filename": filename, "size_mb": size_mb}


@router.get("/backups")
async def list_backups(
    db: Session = Depends(get_db),
    current_user: User = Depends(SUPER_ADMIN_ONLY),
):
    """Lista todos os backups registrados."""
    backups = db.query(SystemBackup).order_by(SystemBackup.created_at.desc()).all()
    return [
        {
            "id": b.id,
            "filename": b.filename,
            "created_at": b.created_at.isoformat(),
            "size_mb": b.size_mb,
            "triggered_by_id": b.triggered_by_id,
        }
        for b in backups
    ]


@router.get("/backups/{backup_id}/download")
async def download_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(SUPER_ADMIN_ONLY),
):
    """Faz download de um arquivo de backup."""
    backup = db.query(SystemBackup).filter(SystemBackup.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup não encontrado.")
    filepath = os.path.join(BACKUP_DIR, backup.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Arquivo de backup não encontrado no disco.")
    return FileResponse(filepath, filename=backup.filename, media_type="application/octet-stream")


# --------------------------------------------------------------------------- #
#  RESET SEMESTRAL
# --------------------------------------------------------------------------- #

@router.post("/semester-reset", status_code=status.HTTP_200_OK)
async def semester_reset(
    body: PasswordConfirmBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(SUPER_ADMIN_ONLY),
):
    """
    Executa a limpeza semestral cirúrgica.
    Requer senha do Super Admin para confirmar.
    """
    from ...core.security import verify_password
    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(status_code=403, detail="Senha incorreta.")

    try:
        # 1. Movimentações vinculadas a reservas (apagar antes das reservas)
        db.query(InventoryMovement).filter(
            InventoryMovement.reservation_id != None
        ).delete(synchronize_session=False)

        # 2. Reservas (CASCADE apaga reservation_slots e reservation_items automaticamente)
        db.query(Reservation).delete(synchronize_session=False)

        # 3. Tickets de manutenção APENAS os resolvidos
        db.query(MaintenanceTicket).filter(
            MaintenanceTicket.status == "resolvido"
        ).delete(synchronize_session=False)

        # 4. Empréstimos institucionais APENAS os finalizados
        db.query(InstitutionLoan).filter(
            InstitutionLoan.status.in_(["devolvido", "devolvido_com_avaria"])
        ).delete(synchronize_session=False)

        db.commit()
        return {"message": "Reset semestral executado com sucesso."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro durante o reset semestral: {str(e)}")
