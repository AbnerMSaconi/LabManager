#!/bin/bash

# Iniciar daemon Ruflo
echo "🌊 Iniciando Ruflo daemon..."
npx ruflo daemon start

# Iniciar swarm
echo "🐝 Iniciando swarm de desenvolvimento..."
npx ruflo swarm init --topology hierarchical --max-agents 6

# Iniciar containers Docker
echo "🐳 Iniciando containers..."
docker compose up -d

# Aguardar PostgreSQL
echo "⏳ Aguardando PostgreSQL..."
sleep 5

# Executar migrações
echo "📊 Executando migrações..."
docker compose exec backend alembic upgrade head

# Logs
echo "📋 Acompanhando logs..."
docker compose logs -f
