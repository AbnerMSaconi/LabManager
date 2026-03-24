from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ...api.deps import get_db
from ...core import security
from ...models.base_models import User

router = APIRouter()

@router.post("/login")
async def login(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    # 1. Buscar por e-mail ou número de registro (RA/RF)
    user = (
        db.query(User)
        .filter(
            (User.email == form_data.username) |
            (User.registration_number == form_data.username)
        )
        .first()
    )
    
    # 2. Verificar existência e senha
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
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
            "email": user.email,
            "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
        },
    }
