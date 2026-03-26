from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ...api.deps import get_db, get_current_user
from ...core import security
from ...models.base_models import User

router = APIRouter()

@router.post("/login")
async def login(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    # 1. Buscar por número de registro (RA/RF)
    user = db.query(User).filter(User.registration_number == form_data.username).first()

    # 2. Verificar existência e senha
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Registro ou senha incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Verificar se a conta está ativa antes de gerar token
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Conta desativada. Contate o administrador.",
        )

    # 4. Gerar Token
    access_token = security.create_access_token(subject=user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "registration_number": user.registration_number,
            "full_name": user.full_name,
            "role": user.role,
        },
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "registration_number": current_user.registration_number,
        "full_name": current_user.full_name,
        "role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
    }
