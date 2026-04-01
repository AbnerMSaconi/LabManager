import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# SQL Server em produção (Docker) e desenvolvimento
# Formato: mssql+pyodbc://user:password@server:1433/database?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mssql+pyodbc://SA:LabManager_2024!@localhost:1433/labmanager?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    fast_executemany=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
