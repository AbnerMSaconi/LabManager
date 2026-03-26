#!/bin/sh
set -e

echo "⏳ Aguardando banco de dados ficar disponível..."
until pg_isready -h db -U "${POSTGRES_USER:-labmanager}"; do
  echo "   banco ainda não pronto — aguardando 2s..."
  sleep 2
done
echo "✅ Banco disponível."

echo "🔄 Rodando migrações Alembic..."
alembic upgrade head

echo "🌱 Populando dados iniciais..."
python -m backend.seed || echo "⚠️  Seed concluído com avisos (dados já existentes ou erro não-fatal)."

echo "🚀 Iniciando servidor com Gunicorn..."
exec gunicorn backend.app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
