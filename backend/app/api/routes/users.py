from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_db, RoleChecker
from ...models.base_models import User, UserRole
from ...schemas.reservation_schemas import UserCreate, UserUpdate
from ...core.security import get_password_hash

router = APIRouter(prefix="/api/v1/users", tags=["usuários"])

MANAGERS = [UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.ADMINISTRADOR]

@router.get("/")
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([UserRole.PROGEX, UserRole.DTI_TECNICO, UserRole.DTI_ESTAGIARIO, UserRole.ADMINISTRADOR]))
):
    users = db.query(User).all()
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

    if payload.full_name  is not None: user.full_name  = payload.full_name
    if payload.role       is not None:
        user.role = payload.role.value if hasattr(payload.role, 'value') else payload.role
    if payload.is_active  is not None: user.is_active  = payload.is_active
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)

    db.commit()
    return {"message": "Usuário atualizado."}

@router.delete("/{user_id}")
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