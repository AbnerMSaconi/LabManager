#!/usr/bin/env python3
"""
Configura o Keycloak do zero: realm, client, roles e usuários de exemplo.

Uso:
    python scripts/seed_keycloak.py
    python scripts/seed_keycloak.py --url http://localhost:8080 --password MinhaSenh@

Requer: pip install requests
"""

import argparse
import sys
import requests

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

REALM = "ucdb"

CLIENT_ID = "labmanager-client"

# URLs permitidas para redirect (ajuste conforme ambiente)
REDIRECT_URIS = [
    "http://localhost/*",        # Docker (porta 80)
    "http://localhost:80/*",     # Docker explícito
    "http://localhost:3000/*",   # dev React
    "http://localhost:5173/*",   # dev Vite
]

WEB_ORIGINS = [
    "http://localhost",
    "http://localhost:80",
    "http://localhost:3000",
    "http://localhost:5173",
]

ROLES = [
    "professor",
    "dti_estagiario",
    "dti_tecnico",
    "progex",
    "administrador",
    "super_admin",
]

USERS = [
    {
        "username": "professor01",
        "firstName": "Carlos",
        "lastName": "Andrade",
        "email": "professor01@ucdb.br",
        "password": "Senha@123",
        "role": "professor",
    },
    {
        "username": "estagiario01",
        "firstName": "Julia",
        "lastName": "Ferreira",
        "email": "estagiario01@ucdb.br",
        "password": "Senha@123",
        "role": "dti_estagiario",
    },
    {
        "username": "tecnico01",
        "firstName": "Roberto",
        "lastName": "Lima",
        "email": "tecnico01@ucdb.br",
        "password": "Senha@123",
        "role": "dti_tecnico",
    },
    {
        "username": "progex01",
        "firstName": "Ana",
        "lastName": "Souza",
        "email": "progex01@ucdb.br",
        "password": "Senha@123",
        "role": "progex",
    },
    {
        "username": "RF001",
        "firstName": "Marcos",
        "lastName": "Oliveira",
        "email": "RF001@ucdb.br",
        "password": "Senha@123",
        "role": "administrador",
    },
    {
        "username": "RF002",
        "firstName": "Patricia",
        "lastName": "Santos",
        "email": "RF002@ucdb.br",
        "password": "Senha@123",
        "role": "super_admin",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_admin_token(base_url: str, admin_user: str, admin_pass: str) -> str:
    resp = requests.post(
        f"{base_url}/realms/master/protocol/openid-connect/token",
        data={
            "client_id": "admin-cli",
            "username": admin_user,
            "password": admin_pass,
            "grant_type": "password",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Realm
# ---------------------------------------------------------------------------

def ensure_realm(base_url: str, realm: str, token: str):
    resp = requests.get(f"{base_url}/admin/realms/{realm}", headers=headers(token), timeout=15)
    if resp.status_code == 200:
        print(f"  [realm] '{realm}' já existe — ignorado")
        return

    payload = {
        "realm": realm,
        "displayName": "UCDB - LabManager",
        "enabled": True,
        "registrationAllowed": False,
        "loginWithEmailAllowed": True,
        "duplicateEmailsAllowed": False,
        "resetPasswordAllowed": False,
        "editUsernameAllowed": False,
        "bruteForceProtected": True,
        "sslRequired": "none",
    }
    resp = requests.post(
        f"{base_url}/admin/realms",
        headers=headers(token),
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    print(f"  [realm] '{realm}' criado")


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

def ensure_client(base_url: str, realm: str, token: str):
    # Busca pelo clientId
    resp = requests.get(
        f"{base_url}/admin/realms/{realm}/clients",
        headers=headers(token),
        params={"clientId": CLIENT_ID},
        timeout=15,
    )
    resp.raise_for_status()
    existing = resp.json()

    payload = {
        "clientId": CLIENT_ID,
        "name": "LabManager React App",
        "enabled": True,
        "publicClient": True,           # SPA: sem client secret
        "standardFlowEnabled": True,    # Authorization Code
        "implicitFlowEnabled": False,
        "directAccessGrantsEnabled": False,
        "serviceAccountsEnabled": False,
        "protocol": "openid-connect",
        "redirectUris": REDIRECT_URIS,
        "webOrigins": WEB_ORIGINS,
        "attributes": {
            "pkce.code.challenge.method": "S256",   # PKCE obrigatório
        },
    }

    if existing:
        client_uuid = existing[0]["id"]
        resp = requests.put(
            f"{base_url}/admin/realms/{realm}/clients/{client_uuid}",
            headers=headers(token),
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        print(f"  [client] '{CLIENT_ID}' atualizado (id={client_uuid})")
    else:
        resp = requests.post(
            f"{base_url}/admin/realms/{realm}/clients",
            headers=headers(token),
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        location = resp.headers.get("Location", "")
        client_uuid = location.rstrip("/").split("/")[-1]
        print(f"  [client] '{CLIENT_ID}' criado (id={client_uuid})")


# ---------------------------------------------------------------------------
# Roles
# ---------------------------------------------------------------------------

def ensure_roles(base_url: str, realm: str, token: str) -> dict:
    """Cria roles ausentes. Retorna mapa nome→id."""
    resp = requests.get(f"{base_url}/admin/realms/{realm}/roles", headers=headers(token), timeout=15)
    resp.raise_for_status()
    existing = {r["name"]: r["id"] for r in resp.json()}

    for role_name in ROLES:
        if role_name in existing:
            print(f"  [role] '{role_name}' já existe — ignorado")
            continue
        r = requests.post(
            f"{base_url}/admin/realms/{realm}/roles",
            headers=headers(token),
            json={"name": role_name},
            timeout=15,
        )
        if r.status_code == 409:
            print(f"  [role] '{role_name}' já existe (409) — ignorado")
        else:
            r.raise_for_status()
            print(f"  [role] '{role_name}' criado")

    # Recarrega para retornar IDs atualizados
    resp = requests.get(f"{base_url}/admin/realms/{realm}/roles", headers=headers(token), timeout=15)
    resp.raise_for_status()
    return {r["name"]: r["id"] for r in resp.json()}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def get_or_create_user(base_url: str, realm: str, token: str, user: dict) -> str:
    search = requests.get(
        f"{base_url}/admin/realms/{realm}/users",
        headers=headers(token),
        params={"username": user["username"], "exact": "true"},
        timeout=15,
    )
    search.raise_for_status()
    found = search.json()

    if found:
        uid = found[0]["id"]
        print(f"  [user] '{user['username']}' já existe (id={uid}) — atualizando senha")
    else:
        payload = {
            "username": user["username"],
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "email": user["email"],
            "enabled": True,
            "emailVerified": True,
        }
        resp = requests.post(
            f"{base_url}/admin/realms/{realm}/users",
            headers=headers(token),
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        location = resp.headers.get("Location", "")
        uid = location.rstrip("/").split("/")[-1]
        print(f"  [user] '{user['username']}' criado (id={uid})")

    # Reset de senha (sempre, para garantir consistência)
    pwd = requests.put(
        f"{base_url}/admin/realms/{realm}/users/{uid}/reset-password",
        headers=headers(token),
        json={"type": "password", "value": user["password"], "temporary": False},
        timeout=15,
    )
    pwd.raise_for_status()

    return uid


def assign_role(base_url: str, realm: str, token: str, user_id: str, role_name: str, role_id: str):
    resp = requests.post(
        f"{base_url}/admin/realms/{realm}/users/{user_id}/role-mappings/realm",
        headers=headers(token),
        json=[{"id": role_id, "name": role_name}],
        timeout=15,
    )
    if resp.status_code not in (200, 204, 409):
        resp.raise_for_status()
    status = "já atribuída — ignorado" if resp.status_code == 409 else "atribuída"
    print(f"    role '{role_name}' {status}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Configura Keycloak: realm, client, roles e usuários")
    parser.add_argument("--url", default="http://localhost:8080", help="URL base do Keycloak")
    parser.add_argument("--realm", default=REALM, help="Nome do realm")
    parser.add_argument("--admin-user", default="admin", help="Usuário admin do Keycloak")
    parser.add_argument("--password", default="admin", help="Senha do admin do Keycloak")
    args = parser.parse_args()

    print(f"\n=== Seed Keycloak | {args.url} | realm: {args.realm} ===\n")

    try:
        print("1. Obtendo token de admin...")
        token = get_admin_token(args.url, args.admin_user, args.password)
        print("   Token obtido.\n")

        print("2. Configurando realm...")
        ensure_realm(args.url, args.realm, token)
        print()

        print("3. Configurando client...")
        ensure_client(args.url, args.realm, token)
        print()

        print("4. Criando roles...")
        role_map = ensure_roles(args.url, args.realm, token)
        print()

        print("5. Criando usuários...")
        for user in USERS:
            print(f"\n  Processando '{user['username']}' (role: {user['role']})...")
            uid = get_or_create_user(args.url, args.realm, token, user)
            assign_role(args.url, args.realm, token, uid, user["role"], role_map[user["role"]])

        print("\n\n=== Configuração concluída com sucesso! ===\n")
        print(f"  Realm    : {args.realm}")
        print(f"  Client   : {CLIENT_ID}")
        print(f"  Redirects: {', '.join(REDIRECT_URIS)}\n")
        print(f"  {'USERNAME':<15} {'ROLE':<20} SENHA")
        print(f"  {'-'*55}")
        for u in USERS:
            print(f"  {u['username']:<15} {u['role']:<20} {u['password']}")
        print()

    except requests.HTTPError as e:
        print(f"\nErro HTTP {e.response.status_code}: {e}")
        print(f"Resposta: {e.response.text}")
        sys.exit(1)
    except requests.ConnectionError:
        print(f"\nErro de conexão: não foi possível conectar em {args.url}")
        print("Verifique se o Keycloak está rodando: docker compose up keycloak")
        sys.exit(1)


if __name__ == "__main__":
    main()
