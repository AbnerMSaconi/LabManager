from typing import Generator, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from ..core.database import SessionLocal
from ..core.security import ALGORITHM, SECRET_KEY
from ..models.base_models import User
from typing import Any

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

async def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

class RoleChecker:
    # Mudamos de List[str] para List[Any] para aceitar os Enums que vêm do main.py
    def __init__(self, allowed_roles: List[Any]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)):
        # 1. Garante que a role do usuário seja lida como string
        user_role_val = user.role.value if hasattr(user.role, 'value') else str(user.role)
        
        # 2. Garante que as roles permitidas (Enums) sejam convertidas para string
        allowed_roles_val = [
            r.value if hasattr(r, 'value') else str(r) 
            for r in self.allowed_roles
        ]

        if user_role_val not in allowed_roles_val:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para executar esta ação."
            )
        return user