#!/bin/sh
set -e

echo "⏳ Aguardando banco de dados ficar disponível..."
sleep 3

echo "🔄 Rodando migrações Alembic..."
alembic upgrade head

echo "🌱 Populando dados iniciais..."
python -m backend.seed

echo "🚀 Iniciando servidor com Gunicorn..."
exec gunicorn backend.app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
