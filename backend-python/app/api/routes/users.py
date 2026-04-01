from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..deps import get_db, RoleChecker
from ...models.base_models import User, UserRole
from ...schemas.reservation_schemas import UserCreate, UserUpdate
from ...core.security import get_password_hash

router = APIRouter(prefix="/api/v1/users", tags=["usuários"])

MANAGERS = [UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]

@router.get("/")
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN]))
):
    users = db.query(User).filter(User.deleted_at == None).all()
    return [
        {
            "id": u.id,
            "registration_number": u.registration_number,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
        }
        for u in users
    ]

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(MANAGERS))
):
    if db.query(User).filter(User.registration_number == payload.registration_number).first():
        raise HTTPException(status_code=400, detail="Registro já cadastrado.")

    role_val = payload.role.value if hasattr(payload.role, 'value') else payload.role
    current_role_val = current_user.role.value if hasattr(current_user.role, 'value') else current_user.role

    # Restrição PROGEX: Só pode criar PROFESSOR ou PROGEX
    if current_role_val == UserRole.PROGEX.value:
        if role_val not in [UserRole.PROFESSOR.value, UserRole.PROGEX.value]:
            raise HTTPException(status_code=403, detail="PROGEX só pode cadastrar Professores ou usuários PROGEX.")

    user = User(
        registration_number=payload.registration_number,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=role_val,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Usuário criado com sucesso.", "id": user.id}

@router.patch("/{user_id}")
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(MANAGERS))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    current_role_val = current_user.role.value if hasattr(current_user.role, 'value') else current_user.role
    target_role_val = user.role.value if hasattr(user.role, 'value') else user.role

    # Restrições PROGEX para atualização
    if current_role_val == UserRole.PROGEX.value:
        if target_role_val not in [UserRole.PROFESSOR.value, UserRole.PROGEX.value]:
            raise HTTPException(status_code=403, detail="Você não tem permissão para alterar este usuário.")
        if payload.role:
            new_role_val = payload.role.value if hasattr(payload.role, 'value') else payload.role
            if new_role_val not in [UserRole.PROFESSOR.value, UserRole.PROGEX.value]:
                raise HTTPException(status_code=403, detail="PROGEX só pode atribuir os papéis de Professor ou PROGEX.")

    if payload.full_name is not None: user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role.value if hasattr(payload.role, 'value') else payload.role
    if payload.is_active is not None: user.is_active = payload.is_active
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)

    db.commit()
    return {"message": "Usuário atualizado."}

@router.delete("/{user_id}")
async def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    # PROGEX REMOVIDO: Apenas Administradores podem desativar usuários agora
    current_user: User = Depends(RoleChecker([UserRole.ADMINISTRADOR, UserRole.SUPER_ADMIN])) 
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode desativar sua própria conta.")
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    user.is_active = False
    user.deleted_at = func.now()
    db.commit()
    return {"message": "Usuário movido para a quarentena."}