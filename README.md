<div align="center">

# 🏛️ LabManager Pro

**Sistema de Gerenciamento de Laboratórios e Almoxarifado Universitário — UCDB**

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)

</div>

---

## ⚡ Instalação rápida (Docker)

```bash
git clone https://github.com/seu-usuario/labmanager-pro.git
cd labmanager-pro
cp .env.example .env
docker compose up -d --build
```

Acesse **http://localhost:8088**

> Sem Docker? Veja a seção [Desenvolvimento local](#-desenvolvimento-local-sem-docker).

---

## 🔑 Usuários padrão

| Registro | Senha | Papel |
|---|---|---|
| `RF001` | `progex123` | Progex (Admin) |
| `RF002` | `tecnico123` | DTI Técnico |
| `RF003` | `estagiario123` | DTI Estagiário |
| `RA2024001` | `professor123` | Professor |

---

## 🐳 Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose v2](https://docs.docker.com/compose/install/)

Verifique com:
```bash
docker --version
docker compose version
```

---

## ⚙️ Configuração

```bash
cp .env.example .env
```

Edite o `.env` para produção:

```env
POSTGRES_PASSWORD=sua-senha-forte
SECRET_KEY=chave-gerada-com-secrets-token-hex-32
FRONTEND_PORT=8088
```

Gere a SECRET_KEY:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 🚀 Executando

```bash
# Primeira vez (build + seed automático)
docker compose up -d --build

# Execuções seguintes
docker compose up -d

# Ver logs
docker compose logs -f

# Parar
docker compose down
```

### URLs disponíveis

| Endereço | Descrição |
|---|---|
| `http://localhost:8088` | Aplicação |
| `http://localhost:8088/api/v1/health` | Status da API |
| `http://localhost:8088/api/docs` | Swagger (documentação) |

---

## 🔄 Atualizando o sistema

```bash
git pull
docker compose up -d --build
```

As migrações do banco são aplicadas automaticamente no startup.

---

## 🖥️ Desenvolvimento local (sem Docker)

### Pré-requisitos
- Python 3.10+
- Node.js 18+
- PostgreSQL (ou use SQLite removendo a DATABASE_URL do .env)

### Windows
```powershell
pip install -r requirements.txt
alembic upgrade head
python -m backend.seed
npm install
```

### Linux / Mac
```bash
pip3 install -r requirements.txt
alembic upgrade head
python3 -m backend.seed
npm install
```

### Rodando (dois terminais)

**Terminal 1:**
```bash
# Windows
python -m uvicorn backend.app.main:app --reload --port 8000
# Linux/Mac
python3 -m uvicorn backend.app.main:app --reload --port 8000
```

**Terminal 2:**
```bash
npx tsx server.ts
```

Acesse **http://localhost:3000**

---

## 🗄️ Banco de dados

- **Produção (Docker):** PostgreSQL 16 em container dedicado com volume persistente
- **Dev local:** SQLite (sem configurar DATABASE_URL) ou PostgreSQL local

### Migrações (Alembic)

```bash
# Aplicar todas as migrações pendentes
alembic upgrade head

# Ver histórico
alembic history

# Criar nova migração após alterar os models
alembic revision --autogenerate -m "descricao da mudanca"
```

---

## 🔐 RBAC — Permissões por papel

| Funcionalidade | Professor | DTI Estagiário | DTI Técnico | Progex |
|---|:---:|:---:|:---:|:---:|
| Criar reservas | ✅ | ❌ | ❌ | ✅ |
| Aprovar / rejeitar | ❌ | ❌ | ✅ | ✅ |
| Aprovar com ressalvas | ❌ | ❌ | ✅ | ✅ |
| Checkout / checkin | ❌ | ❌ | ✅ | ✅ |
| CRUD de laboratórios | ❌ | ❌ | ❌ | ✅ |
| Criar / editar usuários | ❌ | ❌ | ✅ | ✅ |
| Desativar usuários | ❌ | ❌ | ❌ | ✅ |

---

## 🤝 Contribuindo

```bash
git checkout -b feature/minha-feature
git commit -m "feat: descrição"
git push origin feature/minha-feature
# Abra um Pull Request
```
