from fastapi import APIRouter

# Centralizamos o prefixo e a tag no router para não repeti-los em cada rota
router = APIRouter(prefix="/api/v1/health", tags=["health"])

@router.get("/")
def health_check():
    return {"status": "online", "version": "1.0.0"}