# LabManager Pro — Decisões Arquiteturais

## ORM e Banco de Dados

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| **Backend (API)** | **SQLAlchemy** (Python) | **Fonte de verdade do schema** — cria e migra as tabelas |
| **Frontend** | React + TypeScript | Consome a API via fetch |
| **Schema de referência** | `prisma/schema.prisma` | Documentação do schema para consulta rápida (não executa migrações) |

### Por que não usar o Prisma para o banco?

O backend é **Python/FastAPI**, e o Prisma só tem client para Node.js/TypeScript.
Usar os dois gerando migrações para o mesmo SQLite causaria conflitos de schema.

**Regra:** só o SQLAlchemy (`backend/app/models/base_models.py`) cria e altera tabelas.
O `prisma/schema.prisma` é atualizado manualmente para manter a documentação em sincronia, mas **nunca** execute `prisma migrate` ou `prisma db push` neste projeto.

## Como iniciar o banco em desenvolvimento

```bash
# 1. Instalar dependências Python
pip install fastapi uvicorn sqlalchemy passlib[bcrypt] python-jose

# 2. Popular banco com dados iniciais (cria as tabelas automaticamente)
python3 -m backend.seed

# 3. Iniciar a API
uvicorn backend.app.main:app --reload --port 8000

# 4. Iniciar o frontend (em outro terminal)
npm install && npm run dev
```

## Stack resumida

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 + Vite
- **Backend:** Python 3.11+ + FastAPI + SQLAlchemy + JWT
- **Banco:** SQLite (dev) — substituível por PostgreSQL em produção alterando `DATABASE_URL`
- **Auth:** JWT Bearer token, renovação automática no frontend
