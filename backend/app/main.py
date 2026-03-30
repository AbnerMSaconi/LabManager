import os
import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import auth, health, users, maintenance, reservations, logistics, labs, inventory, sse, admin, attendance

logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost"
).split(",")

app = FastAPI(
    title="LabManager Pro API",
    description="API de gerenciamento de laboratórios e almoxarifado universitário.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = None
    try:
        body = await request.body()
        body = body.decode("utf-8")
    except Exception:
        pass
    logger.error(
        "422 Validation error on %s %s — body: %s — errors: %s",
        request.method, request.url.path, body, exc.errors()
    )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.include_router(auth.router,         prefix="/api/v1/auth",   tags=["auth"])
app.include_router(health.router)
app.include_router(users.router)
app.include_router(maintenance.router)
app.include_router(reservations.router)
app.include_router(logistics.router)
app.include_router(labs.router)
app.include_router(inventory.router)
app.include_router(sse.router)
app.include_router(admin.router)
app.include_router(attendance.router)

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta

def purge_quarantine():
    """Remove definitivamente registros na quarentena há mais de 3 dias."""
    from .core.database import SessionLocal
    from .models.base_models import User, Laboratory, Software, ItemModel
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=3)
        for Model in [User, Laboratory, Software, ItemModel]:
            old_records = db.query(Model).filter(
                Model.deleted_at != None,
                Model.deleted_at < cutoff
            ).all()
            for record in old_records:
                db.delete(record)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Erro na purga de quarentena: {e}")
    finally:
        db.close()

scheduler = BackgroundScheduler()
scheduler.add_job(purge_quarantine, CronTrigger(hour=3, minute=0))
scheduler.start()

import atexit
atexit.register(lambda: scheduler.shutdown())


@app.on_event("startup")
async def startup_db():
    from .core.database import engine
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE item_models ADD model_number NVARCHAR(100) NULL"))
            conn.commit()
    except Exception:
        pass  # Column already exists
