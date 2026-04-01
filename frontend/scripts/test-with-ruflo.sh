#!/bin/bash

# Executar testes backend
echo "🧪 Executando testes backend..."
npx ruflo agent spawn -t tester --task "Executar pytest com coverage no backend"
docker compose exec backend pytest --cov=backend --cov-report=html

# Executar testes frontend
echo "🧪 Executando testes frontend..."
npx ruflo agent spawn -t tester --task "Executar vitest no frontend"
npm run test

# Gerar relatório
echo "📊 Gerando relatório de testes..."
npx ruflo hooks post-task --analyze-performance --generate-report
