#!/bin/bash
set -e

echo "[init-db] Criando bancos de dados necessários..."

/opt/mssql-tools18/bin/sqlcmd \
  -S db -U SA -P "$MSSQL_SA_PASSWORD" -C \
  -Q "
    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'keycloak')
      CREATE DATABASE [keycloak];
    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'labmanager')
      CREATE DATABASE [labmanager];
  "

echo "[init-db] Bancos 'keycloak' e 'labmanager' prontos."
