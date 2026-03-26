from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import auth, health, users, maintenance, reservations, logistics, labs, inventory

app = FastAPI(
    title="LabManager Pro API",
    description="API de gerenciamento de laboratórios e almoxarifado universitário.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,         prefix="/api/v1/auth",   tags=["auth"])
app.include_router(health.router)
app.include_router(users.router)
app.include_router(maintenance.router)
app.include_router(reservations.router)
app.include_router(logistics.router)
app.include_router(labs.router)
app.include_router(inventory.router)
