"""
Script de teste de integracao - testa todos os endpoints do backend via HTTP.
Executar dentro do container Docker: python /app/scripts/test_api.py
"""
import urllib.request, urllib.parse, json, sys

BASE = "http://localhost:8000/api/v1"
PASS_RESULTS = []
FAIL_RESULTS = []


def req(method, path, data=None, headers=None):
    url = BASE + path
    h = headers or {}
    body = None
    if data is not None and method in ("POST", "PUT", "PATCH", "DELETE"):
        if "Content-Type" not in h:
            h["Content-Type"] = "application/json"
        body = json.dumps(data).encode()
    req_obj = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req_obj, timeout=10) as resp:
            try:
                resp_data = json.loads(resp.read())
            except Exception:
                resp_data = {}
            return resp.status, resp_data
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read())
        except Exception:
            err_body = {}
        return e.code, err_body


def form_post(path, fields):
    data = urllib.parse.urlencode(fields).encode()
    req_obj = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req_obj, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}


def chk(label, status, expected=(200, 201, 204), extra=""):
    ok = status in expected
    sym = "✅" if ok else "❌"
    print(f"  {sym} {label}: HTTP {status} {extra}")
    if ok:
        PASS_RESULTS.append(label)
    else:
        FAIL_RESULTS.append(f"{label} -> HTTP {status}")
    return ok


# ── HEALTH ─────────────────────────────────────────────────────
print("=== HEALTH ===")
s, d = req("GET", "/health/")
chk("GET /health", s)

# ── AUTH ───────────────────────────────────────────────────────
print("\n=== AUTH ===")
s, d = form_post("/auth/login", {"username": "SA001", "password": "admin123"})
chk("POST /auth/login (super_admin)", s)
TOKEN_SA = d.get("access_token", "")

s, d = form_post("/auth/login", {"username": "RA2024000", "password": "professor123"})
chk("POST /auth/login (professor)", s)
TOKEN_PROF = d.get("access_token", "")

s, d = form_post("/auth/login", {"username": "RF002", "password": "tecnico123"})
chk("POST /auth/login (dti_tecnico)", s)
TOKEN_DTI = d.get("access_token", "")

s, d = form_post("/auth/login", {"username": "RF001", "password": "progex123"})
chk("POST /auth/login (progex)", s)
TOKEN_PROGEX = d.get("access_token", "")

SA   = {"Authorization": f"Bearer {TOKEN_SA}"}
PROF = {"Authorization": f"Bearer {TOKEN_PROF}"}
DTI  = {"Authorization": f"Bearer {TOKEN_DTI}"}
PGX  = {"Authorization": f"Bearer {TOKEN_PROGEX}"}

s, d = req("GET", "/auth/me", headers=SA)
chk("GET /auth/me (super_admin)", s, extra=f"role={d.get('role')}")

s, d = req("GET", "/auth/me", headers=PROF)
chk("GET /auth/me (professor)", s, extra=f"role={d.get('role')}")

# ── USERS ──────────────────────────────────────────────────────
print("\n=== USERS ===")
s, d = req("GET", "/users/", headers=SA)
chk("GET /users (listar - SA)", s, extra=f"{len(d)} usuarios")

s, d = req("GET", "/users/", headers=DTI)
chk("GET /users (listar - DTI)", s)

s, d = req("GET", "/users/", headers=PROF)
chk("GET /users (professor bloqueado)", s, (403,))

s, d = req("POST", "/users/", {
    "registration_number": "TEST_U99",
    "full_name": "Test User Integracao",
    "password": "test123",
    "role": "professor"
}, headers=SA)
# pode ser 400 se já existe do run anterior
chk("POST /users (criar - SA)", s, (201, 400))
test_user_id = d.get("id")

if test_user_id:
    s, d = req("PATCH", f"/users/{test_user_id}", {
        "full_name": "Test User Atualizado",
        "role": "professor"
    }, headers=SA)
    chk(f"PATCH /users/{test_user_id} (atualizar)", s)

# ── LABS ───────────────────────────────────────────────────────
print("\n=== LABORATORIES ===")
# prefix /api/v1 (não /labs)
s, d = req("GET", "/labs", headers=SA)
chk("GET /labs (listar)", s, extra=f"{len(d)} labs")
lab_id = d[0]["id"] if d else None

s, d = req("GET", "/slots", headers=SA)
chk("GET /slots (horários de aula)", s, extra=f"{len(d)} slots")
slot_ids = [x["id"] for x in d[:2]] if d else []

s, d = req("GET", "/softwares", headers=SA)
chk("GET /softwares (listar)", s, extra=f"{len(d)} softwares")

if lab_id:
    s, d = req("GET", f"/labs/{lab_id}", headers=SA)
    chk(f"GET /labs/{lab_id} (buscar)", s)

s, d = req("POST", "/labs", {
    "name": "Lab Teste Integracao 99",
    "block": "Bloco A",
    "room_number": "T99",
    "capacity": 20,
    "is_practical": False,
    "description": "Teste de integracao",
    "software_ids": []
}, headers=SA)
chk("POST /labs (criar - SA)", s, (201, 400))
test_lab_id = d.get("id")

if test_lab_id:
    s, d = req("PUT", f"/labs/{test_lab_id}", {
        "name": "Lab Teste Editado",
        "block": "Bloco A",
        "room_number": "T99",
        "capacity": 25,
        "is_practical": False,
        "software_ids": []
    }, headers=SA)
    chk(f"PUT /labs/{test_lab_id} (editar - SA)", s)

s, d = req("POST", "/labs", {
    "name": "Lab Teste Prof BLOQUEADO",
    "block": "Bloco A",
    "room_number": "T98",
    "capacity": 10,
    "is_practical": False,
    "software_ids": []
}, headers=PROF)
chk("POST /labs (professor bloqueado)", s, (403,))

# ── INVENTORY ──────────────────────────────────────────────────
print("\n=== INVENTORY ===")
s, d = req("GET", "/inventory/stock", headers=SA)
chk("GET /inventory/stock (estoque)", s, extra=f"{len(d)} modelos")

s, d = req("GET", "/inventory/models", headers=SA)
chk("GET /inventory/models (listar modelos)", s)

s, d = req("GET", "/inventory/models/available?date=2026-05-01", headers=SA)
chk("GET /inventory/models/available (disponíveis)", s, extra=f"{len(d)} modelos")

s, d = req("POST", "/inventory/item-models", {
    "name": "Item Integracao 99",
    "category": "eletrica",
    "description": "Item de teste",
    "total_stock": 10,
    "maintenance_stock": 2
}, headers=SA)
chk("POST /inventory/item-models (criar - SA)", s, (201, 400))
test_item_id = d.get("id")

if test_item_id:
    s, d = req("PATCH", f"/inventory/item-models/{test_item_id}", {"total_stock": 15}, headers=SA)
    chk(f"PATCH /inventory/item-models/{test_item_id} (editar - SA)", s)

s, d = req("GET", "/inventory/movements", headers=SA)
chk("GET /inventory/movements (SA)", s, extra=f"{len(d)} movs")

s, d = req("GET", "/inventory/movements", headers=PROF)
chk("GET /inventory/movements (professor bloqueado)", s, (403,))

# ── RESERVATIONS ───────────────────────────────────────────────
print("\n=== RESERVATIONS ===")
s, d = req("GET", "/reservations/", headers=SA)
chk("GET /reservations (listar todas - SA)", s, extra=f"{len(d)} total")

s, d = req("GET", "/reservations/my", headers=PROF)
chk("GET /reservations/my (professor)", s)

s, d = req("GET", "/reservations/pending", headers=DTI)
chk("GET /reservations/pending (DTI)", s)

s, d = req("GET", "/reservations/today", headers=SA)
chk("GET /reservations/today (SA)", s)

test_res_id = None
if TOKEN_PROF and slot_ids and lab_id:
    s, d = req("POST", "/reservations/", {
        "lab_id": lab_id,
        "dates": ["2026-05-10"],
        "slot_ids": slot_ids,
        "software_installation_required": False,
        "item_requests": []
    }, headers=PROF)
    chk("POST /reservations (criar - professor)", s, (200, 201, 400))
    test_res_id = d.get("id") or (d[0].get("id") if isinstance(d, list) else None)

    if test_res_id:
        s, d = req("GET", f"/reservations/{test_res_id}", headers=PROF)
        chk(f"GET /reservations/{test_res_id} (buscar)", s)

# Criar outra para aprovar
res_to_approve = None
if TOKEN_PROF and slot_ids and lab_id:
    s, d = req("POST", "/reservations/", {
        "lab_id": lab_id,
        "dates": ["2026-05-11"],
        "slot_ids": slot_ids,
        "software_installation_required": False,
        "item_requests": []
    }, headers=PROF)
    chk("POST /reservations (criar para aprovar)", s, (200, 201, 400))
    ids = d if isinstance(d, list) else [d]
    res_to_approve = ids[0].get("id") if ids else None

    if res_to_approve and TOKEN_DTI:
        s, d = req("PATCH", f"/reservations/{res_to_approve}/review", {
            "status": "aprovado",
            "approval_notes": "Aprovado via teste de integracao"
        }, headers=DTI)
        chk(f"PATCH /reservations/{res_to_approve}/review (DTI aprova)", s)

# ── LOGISTICS ──────────────────────────────────────────────────
print("\n=== LOGISTICS ===")
s, d = req("GET", "/logistics/loans", headers=SA)
chk("GET /logistics/loans (SA)", s, extra=f"{len(d)} emprestimos")

test_loan_id = None
if test_item_id:
    s, d = req("POST", "/logistics/loans", {
        "item_model_id": test_item_id,
        "requester_name": "Instituicao Teste Integracao",
        "quantity_delivered": 2,
        "return_date": "2026-06-01"
    }, headers=DTI)
    chk("POST /logistics/loans (criar emprestimo - DTI)", s, (200, 201))
    test_loan_id = d.get("id")

    if test_loan_id:
        s, d = req("PATCH", f"/logistics/loans/{test_loan_id}/return", {
            "all_returned": True,
            "quantity_returned": 2,
            "has_damage": False
        }, headers=DTI)
        chk(f"PATCH /logistics/loans/{test_loan_id}/return (devolver)", s)

# ── MAINTENANCE ────────────────────────────────────────────────
print("\n=== MAINTENANCE ===")
s, d = req("GET", "/maintenance/", headers=SA)
chk("GET /maintenance (listar - SA)", s, extra=f"{len(d)} tickets")

s, d = req("POST", "/maintenance/", {
    "title": "Ticket Teste Integracao 99",
    "description": "Problema de teste de integracao",
    "severity": "baixo"
}, headers=DTI)
chk("POST /maintenance (criar ticket - DTI)", s, (200, 201))
test_ticket_id = d.get("id")

if test_ticket_id:
    s, d = req("PATCH", f"/maintenance/{test_ticket_id}", {
        "status": "resolvido",
        "resolution_notes": "Resolvido via teste de integracao"
    }, headers=DTI)
    chk(f"PATCH /maintenance/{test_ticket_id} (resolver)", s)

# ── ADMIN ──────────────────────────────────────────────────────
print("\n=== ADMIN (SUPER_ADMIN) ===")
if not TOKEN_SA:
    print("  ⚠️  Sem token SA — pulando testes admin")
else:
    s, d = req("GET", "/admin/quarantine", headers=SA)
    extra = f"users={len(d.get('users',[]))} labs={len(d.get('laboratories',[]))} sw={len(d.get('softwares',[]))} items={len(d.get('item_models',[]))}"
    chk("GET /admin/quarantine (SA)", s, extra=extra)

    s, d = req("GET", "/admin/audit-logs", headers=SA)
    chk("GET /admin/audit-logs (SA)", s, extra=f"{len(d)} logs de auditoria")

    s, d = req("GET", "/admin/backups", headers=SA)
    chk("GET /admin/backups (SA)", s, extra=f"{len(d)} backups")

    s, d = req("POST", "/admin/backup", headers=SA)
    chk("POST /admin/backup (gerar backup)", s, (200, 201))

    # Soft-delete e quarentena
    if test_lab_id:
        s, d = req("DELETE", f"/labs/{test_lab_id}", headers=SA)
        chk(f"DELETE /labs/{test_lab_id} (soft delete)", s, (200, 204))

        s, d = req("GET", "/admin/quarantine", headers=SA)
        labs_q = d.get("laboratories", [])
        found = any(x["id"] == test_lab_id for x in labs_q)
        sym = "✅" if found else "❌"
        print(f"  {sym} Soft-delete verificado na quarentena: lab {test_lab_id} {'encontrado' if found else 'NAO encontrado'}")
        if found:
            PASS_RESULTS.append("Soft-delete -> quarentena verificada no banco")

            s, d = req("POST", f"/admin/restore/laboratories/{test_lab_id}", headers=SA)
            chk(f"POST /admin/restore/laboratories/{test_lab_id} (restaurar)", s)
        else:
            FAIL_RESULTS.append(f"Soft-delete lab {test_lab_id} NAO apareceu na quarentena")

    # Acesso bloqueado para professor
    s, d = req("GET", "/admin/quarantine", headers=PROF)
    chk("GET /admin/quarantine (professor deve ser BLOQUEADO)", s, (403, 401))

# ── RESUMO ─────────────────────────────────────────────────────
print()
print("=" * 60)
print(f"PASSOU: {len(PASS_RESULTS)}  |  FALHOU: {len(FAIL_RESULTS)}")
if FAIL_RESULTS:
    print("\n❌ FALHAS DETECTADAS:")
    for f in FAIL_RESULTS:
        print(f"   - {f}")
    sys.exit(1)
else:
    print("🎉 Todos os endpoints responderam corretamente!")
