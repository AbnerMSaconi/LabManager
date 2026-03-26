"""
SSE — Server-Sent Events
Transmite eventos em tempo real para todos os clientes conectados.

Nota: requer --workers 1 no Gunicorn, pois asyncio.Queue não atravessa processos.
"""
import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from ..deps import get_db
from ...core.security import SECRET_KEY, ALGORITHM
from ...models.base_models import User

router = APIRouter(prefix="/api/v1", tags=["events"])

# ---------------------------------------------------------------------------
# Manager
# ---------------------------------------------------------------------------

class SSEManager:
    """Mantém uma fila asyncio por cliente conectado."""

    def __init__(self) -> None:
        self._queues: list[asyncio.Queue] = []

    async def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._queues.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._queues.remove(q)
        except ValueError:
            pass

    async def broadcast(self, event_type: str, payload: dict = {}) -> None:
        if not self._queues:
            return
        msg = json.dumps({"type": event_type, "payload": payload})
        for q in list(self._queues):
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass  # cliente lento — descarta


sse_manager = SSEManager()


async def broadcast(event_type: str, payload: dict = {}) -> None:
    """Atalho para os route handlers emitirem eventos SSE."""
    await sse_manager.broadcast(event_type, payload)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/events")
async def event_stream(
    token: str = Query(..., description="JWT Bearer token"),
    db: Session = Depends(get_db),
):
    """
    Abre um stream SSE autenticado.
    O cliente passa o token JWT como query param:
      GET /api/v1/events?token=<jwt>
    """
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(data.get("sub", 0))
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido.")

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado ou inativo.")

    async def generator() -> AsyncGenerator[str, None]:
        q = await sse_manager.subscribe()
        try:
            # Evento de conexão confirmada
            yield f"data: {json.dumps({'type': 'connected', 'payload': {'user_id': user_id}})}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=25.0)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive — evita que proxies fechem a conexão idle
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_manager.unsubscribe(q)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # desativa buffer do Nginx
            "Connection": "keep-alive",
        },
    )
