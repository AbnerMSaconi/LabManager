"""
Seed inicial do banco de dados — LabManager Pro
(Infraestrutura Real & Teste de Estresse SEMANAL MÁXIMO)
"""
from backend.app.core.database import SessionLocal
from backend.app.models.base_models import (
    LessonSlot, User, Laboratory, Software, ItemModel,
    Reservation, ReservationSlot, ReservationItem, 
    ReservationStatus, PhysicalItem, ItemStatus
)
from passlib.context import CryptContext
from datetime import date, timedelta
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_data():
    db = SessionLocal()
    try:
        print("🌱 Iniciando o plantio de dados (Carga Semanal - 5 Dias)...")

        # ---------------------------------------------------------
        # 1. SLOTS DE AULA
        # ---------------------------------------------------------
        slots_data = [
            {"code": "M1", "start_time": "07:30", "end_time": "08:20"},
            {"code": "M2", "start_time": "08:20", "end_time": "09:10"},
            {"code": "M3", "start_time": "09:25", "end_time": "10:15"},
            {"code": "M4", "start_time": "10:15", "end_time": "11:05"},
            {"code": "M5", "start_time": "11:10", "end_time": "12:00"},
            {"code": "M6", "start_time": "12:00", "end_time": "12:50"},
            
            {"code": "T1", "start_time": "13:20", "end_time": "14:10"},
            {"code": "T2", "start_time": "14:10", "end_time": "15:00"},
            {"code": "T3", "start_time": "15:10", "end_time": "16:00"},
            {"code": "T4", "start_time": "16:00", "end_time": "16:50"},
            {"code": "T5", "start_time": "17:00", "end_time": "17:50"},
            {"code": "T6", "start_time": "17:50", "end_time": "18:40"},
            
            {"code": "N1", "start_time": "18:50", "end_time": "19:40"},
            {"code": "N2", "start_time": "19:40", "end_time": "20:30"},
            {"code": "N3", "start_time": "20:45", "end_time": "21:35"},
            {"code": "N4", "start_time": "21:35", "end_time": "22:25"},
        ]
        for s in slots_data:
            if not db.query(LessonSlot).filter_by(code=s["code"]).first():
                db.add(LessonSlot(**s))
        db.commit()

        # ---------------------------------------------------------
        # 2. USUÁRIOS (40 Professores)
        # ---------------------------------------------------------
        base_users = [
            {"registration_number": "RF001", "email": "progex@universidade.edu", "full_name": "Coordenação Progex", "role": "progex", "hashed_password": pwd_context.hash("progex123")},
            {"registration_number": "RF002", "email": "tecnico@universidade.edu", "full_name": "Carlos Técnico DTI", "role": "dti_tecnico", "hashed_password": pwd_context.hash("tecnico123")},
            {"registration_number": "RF003", "email": "estagiario@universidade.edu", "full_name": "Ana Estagiária DTI", "role": "dti_estagiario","hashed_password": pwd_context.hash("estagiario123")},
        ]
        
        professores_nomes = [
            "Alan Turing", "Ada Lovelace", "Nikola Tesla", "Marie Curie", "Linus Torvalds",
            "Albert Einstein", "Isaac Newton", "Grace Hopper", "Edsger Dijkstra", "Donald Knuth",
            "John von Neumann", "Claude Shannon", "Richard Feynman", "Stephen Hawking", "Werner Heisenberg",
            "Erwin Schrödinger", "Paul Dirac", "James Gosling", "Tim Berners-Lee", "Dennis Ritchie",
            "Ken Thompson", "Bjarne Stroustrup", "Guido van Rossum", "Margaret Hamilton", "Katherine Johnson",
            "Carl Sagan", "Niels Bohr", "Max Planck", "Galileo Galilei", "Johannes Kepler",
            "Michael Faraday", "James Clerk Maxwell", "Charles Babbage", "George Boole", "John McCarthy",
            "Richard Stallman", "Brian Kernighan", "Vint Cerf", "Radia Perlman", "Barbara Liskov"
        ]

        prof_users = []
        for idx, nome in enumerate(professores_nomes):
            prof_users.append({
                "registration_number": f"RA2024{idx:03d}",
                "email": f"prof{idx}@universidade.edu",
                "full_name": f"Prof. {nome}",
                "role": "professor",
                "hashed_password": pwd_context.hash("professor123")
            })

        for u in base_users + prof_users:
            if not db.query(User).filter_by(registration_number=u["registration_number"]).first():
                db.add(User(**u))
        db.commit()

        # ---------------------------------------------------------
        # 3. SOFTWARES E LABORATÓRIOS
        # ---------------------------------------------------------
        softwares_data = [
            {"name": "Visual Studio Code", "version": "1.88"},
            {"name": "AutoCAD",            "version": "2024"},
            {"name": "Packet Tracer",      "version": "8.2"},
        ]
        for sw in softwares_data:
            if not db.query(Software).filter_by(name=sw["name"]).first():
                db.add(Software(**sw))
        db.commit()

        labs_data = [
            {"name": "INFO A1", "block": "Bloco A", "room_number": "A-INFO01", "capacity": 30, "is_practical": False},
            {"name": "INFO A2", "block": "Bloco A", "room_number": "A-INFO02", "capacity": 30, "is_practical": False},
            {"name": "INFO A3", "block": "Bloco A", "room_number": "A-INFO03", "capacity": 30, "is_practical": False},
            {"name": "INFO B1", "block": "Bloco B", "room_number": "B-INFO01", "capacity": 30, "is_practical": False},
            {"name": "INFO B2", "block": "Bloco B", "room_number": "B-INFO02", "capacity": 30, "is_practical": False},
            {"name": "INFO B3", "block": "Bloco B", "room_number": "B-INFO03", "capacity": 30, "is_practical": False},
            {"name": "INFO B4", "block": "Bloco B", "room_number": "B-INFO04", "capacity": 30, "is_practical": False},
            {"name": "INFO C1 (Pesquisa)", "block": "Bloco C - INFO", "room_number": "C-INFO01", "capacity": 20, "is_practical": False},
            {"name": "INFO C2", "block": "Bloco C - INFO", "room_number": "C-INFO02", "capacity": 30, "is_practical": False},
            {"name": "INFO C3", "block": "Bloco C - INFO", "room_number": "C-INFO03", "capacity": 30, "is_practical": False},
            {"name": "INFO C4", "block": "Bloco C - INFO", "room_number": "C-INFO04", "capacity": 30, "is_practical": False},
            {"name": "INFO C5", "block": "Bloco C - INFO", "room_number": "C-INFO05", "capacity": 30, "is_practical": False},
            {"name": "INFO C6", "block": "Bloco C - INFO", "room_number": "C-INFO06", "capacity": 30, "is_practical": False},
            {"name": "Lab Automação e Controle", "block": "Bloco C - Específicos", "room_number": "C-AUT", "capacity": 25, "is_practical": True},
            {"name": "Lab Fisica 1", "block": "Bloco C - Específicos", "room_number": "C-FIS1", "capacity": 25, "is_practical": True},
            {"name": "Lab Fisica 2", "block": "Bloco C - Específicos", "room_number": "C-FIS2", "capacity": 25, "is_practical": True},
            {"name": "LabHard", "block": "Bloco C - Específicos", "room_number": "C-HARD", "capacity": 20, "is_practical": True},
            {"name": "LabRedesComp", "block": "Bloco C - Específicos", "room_number": "C-REDES", "capacity": 30, "is_practical": True},
            {"name": "Promove", "block": "Bloco C - Específicos", "room_number": "C-PROMOVE", "capacity": 30, "is_practical": False},
            {"name": "Geoprocessamento", "block": "Bloco M", "room_number": "M-GEO", "capacity": 30, "is_practical": True},
            {"name": "INFO M1 (A38)", "block": "Bloco M", "room_number": "A38", "capacity": 30, "is_practical": False},
            {"name": "INFO M2 (A37)", "block": "Bloco M", "room_number": "A37", "capacity": 30, "is_practical": False},
            {"name": "INFO M3 (A36 - Redação)", "block": "Bloco M", "room_number": "A36", "capacity": 30, "is_practical": False},
        ]
        for l in labs_data:
            if not db.query(Laboratory).filter_by(name=l["name"]).first():
                db.add(Laboratory(**l))
        db.commit()

        # ---------------------------------------------------------
        # 4. ALMOXARIFADO
        # ---------------------------------------------------------
        items_data = [
            {"name": "Multímetro Digital",     "category": "eletronica",  "total_stock": 50},
            {"name": "Kit Arduino Uno",        "category": "componentes", "total_stock": 50},
            {"name": "Kit de Ferramentas",     "category": "fisica",      "total_stock": 30},
        ]
        for i in items_data:
            model = db.query(ItemModel).filter_by(name=i["name"]).first()
            if not model:
                model = ItemModel(**i)
                db.add(model)
                db.flush()
                for num in range(1, 4):
                    patrimony = f"PAT-{model.id}00{num}"
                    db.add(PhysicalItem(model_id=model.id, patrimony_id=patrimony, status=ItemStatus.DISPONIVEL.value))
        db.commit()

        # ---------------------------------------------------------
        # 5. POVOAMENTO MASSIVO SEMANAL (Segunda a Sexta)
        # ---------------------------------------------------------
        users = {u.full_name: u.id for u in db.query(User).all() if u.role == "professor"}
        labs = {l.name: l.id for l in db.query(Laboratory).all()}
        slots = {s.code: s.id for s in db.query(LessonSlot).all()}
        items = {i.name: i.id for i in db.query(ItemModel).all()}
        
        today = date.today()
        # Calcula a Segunda-feira da semana atual
        start_of_week = today - timedelta(days=today.weekday())
        # Cria uma lista de 5 dias úteis (Segunda a Sexta)
        week_dates = [start_of_week + timedelta(days=d) for d in range(5)]

        prof_list = list(users.keys()) # 40 Professores
        lab_names = list(labs.keys())  # 23 Laboratórios

        time_blocks = [
            ["M1", "M2"], ["M3", "M4"], ["M5", "M6"],
            ["T1", "T2"], ["T3", "T4"], ["T5", "T6"],
            ["N1", "N2"], ["N3", "N4"]
        ]

        def create_res(lab_name, user_name, target_date, status, slot_codes, group_id=None, req_soft=None, inst_req=False, app_notes=None, req_items=None):
            r = Reservation(
                lab_id=labs[lab_name], user_id=users[user_name], date=target_date, status=status,
                group_id=group_id, requested_softwares=req_soft, software_installation_required=inst_req,
                approval_notes=app_notes
            )
            db.add(r)
            db.flush()
            for code in slot_codes:
                db.add(ReservationSlot(reservation_id=r.id, slot_id=slots[code]))
            if req_items:
                for item_name, qty in req_items.items():
                    db.add(ReservationItem(reservation_id=r.id, item_model_id=items[item_name], quantity_requested=qty))

        total_reservas = 0

        for j, slot_codes in enumerate(time_blocks):
            for i, lab in enumerate(lab_names):
                
                # Define se esta combinação Lab+Horário será um "Lote Semestral" (se repete na semana)
                is_lote = (i + j) % 2 == 0
                group_id = uuid.uuid4().hex if is_lote else None
                base_prof_idx = (i + (j * len(lab_names))) % len(prof_list)

                for day_offset, target_date in enumerate(week_dates):
                    # Se for lote, mantém o mesmo professor a semana toda. Senão, muda o professor por dia.
                    if is_lote:
                        prof = prof_list[base_prof_idx]
                    else:
                        prof = prof_list[(base_prof_idx + (day_offset * 7)) % len(prof_list)]

                    # Dinamismo de UI
                    status_val = ReservationStatus.APROVADO.value
                    req_items = None
                    req_soft = None
                    inst_req = False
                    
                    pseudo_rand = i + j + day_offset

                    if pseudo_rand % 4 == 0:
                        # Só fica EM_USO se a data for hoje ou no passado. Se for amanhã, fica APROVADO.
                        status_val = ReservationStatus.EM_USO.value if target_date <= today else ReservationStatus.APROVADO.value
                        req_items = {"Multímetro Digital": 2}
                    elif pseudo_rand % 5 == 0:
                        status_val = ReservationStatus.APROVADO.value
                        req_items = {"Kit Arduino Uno": 5}
                    elif pseudo_rand % 7 == 0:
                        status_val = ReservationStatus.AGUARDANDO_SOFTWARE.value
                        req_soft = "Visual Studio Code"
                        inst_req = True
                    elif pseudo_rand % 11 == 0:
                        status_val = ReservationStatus.PENDENTE.value

                    create_res(lab, prof, target_date, status_val, slot_codes, group_id, req_soft, inst_req, None, req_items)
                    total_reservas += 1

        db.commit()
        print(f"✅ ESTRESSE MÁXIMO SEMANAL: {total_reservas} reservas processadas!")
        print("   Todos os laboratórios estão ocupados de Segunda a Sexta, mesclando Lotes Semestrais e Aulas Avulsas.")

    except Exception as e:
        print(f"❌ Erro grave no seed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()