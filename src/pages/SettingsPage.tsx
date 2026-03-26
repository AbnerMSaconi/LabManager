import { useState, useCallback } from "react";
import { Bell, BellOff, Save } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui";
import { UserRole } from "../types";

export type NotifKey =
  | "reservation_created"
  | "reservation_updated"
  | "maintenance_created"
  | "maintenance_updated"
  | "inventory_updated"
  | "checkout"
  | "checkin"
  | "loan_created"
  | "loan_returned";

export type NotifPrefs = Record<NotifKey, boolean>;

export const NOTIF_LABELS: Record<NotifKey, string> = {
  reservation_created: "Nova reserva cadastrada",
  reservation_updated: "Status de reserva alterado",
  maintenance_created: "Nova solicitação de manutenção",
  maintenance_updated: "Manutenção atualizada",
  inventory_updated: "Inventário atualizado",
  checkout: "Equipamento retirado (checkout)",
  checkin: "Equipamento devolvido (checkin)",
  loan_created: "Novo empréstimo registrado",
  loan_returned: "Empréstimo devolvido",
};

const ROLE_AVAILABLE_KEYS: Record<UserRole, NotifKey[]> = {
  [UserRole.PROFESSOR]: [
    "reservation_updated",
  ],
  [UserRole.DTI_ESTAGIARIO]: [
    "reservation_created",
    "reservation_updated",
    "maintenance_created",
    "maintenance_updated",
  ],
  [UserRole.DTI_TECNICO]: [
    "reservation_created",
    "reservation_updated",
    "maintenance_created",
    "maintenance_updated",
    "checkout",
    "checkin",
    "loan_created",
    "loan_returned",
  ],
  [UserRole.PROGEX]: [
    "reservation_created",
    "reservation_updated",
    "maintenance_created",
    "maintenance_updated",
    "inventory_updated",
    "checkout",
    "checkin",
    "loan_created",
    "loan_returned",
  ],
  [UserRole.ADMINISTRADOR]: [
    "reservation_created",
    "reservation_updated",
    "maintenance_created",
    "maintenance_updated",
    "inventory_updated",
    "checkout",
    "checkin",
    "loan_created",
    "loan_returned",
  ],
};

const ROLE_DEFAULT_ENABLED: Record<UserRole, NotifKey[]> = {
  [UserRole.PROFESSOR]: ["reservation_updated"],
  [UserRole.DTI_ESTAGIARIO]: ["reservation_created", "reservation_updated", "maintenance_created"],
  [UserRole.DTI_TECNICO]: [
    "reservation_created",
    "reservation_updated",
    "maintenance_created",
    "maintenance_updated",
    "checkout",
    "checkin",
  ],
  [UserRole.PROGEX]: [
    "reservation_created",
    "reservation_updated",
    "maintenance_created",
    "maintenance_updated",
    "inventory_updated",
  ],
  [UserRole.ADMINISTRADOR]: [
    "reservation_created",
    "reservation_updated",
    "maintenance_created",
    "maintenance_updated",
    "inventory_updated",
  ],
};

export function getNotifPrefs(userId: number, role: UserRole): NotifPrefs {
  const stored = localStorage.getItem(`labmanager_notif_${userId}`);
  if (stored) {
    try {
      return JSON.parse(stored) as NotifPrefs;
    } catch {
      // fall through to defaults
    }
  }
  const defaults = {} as NotifPrefs;
  const allKeys = Object.keys(NOTIF_LABELS) as NotifKey[];
  const enabledByDefault = ROLE_DEFAULT_ENABLED[role] ?? [];
  for (const key of allKeys) {
    defaults[key] = enabledByDefault.includes(key);
  }
  return defaults;
}

function saveNotifPrefs(userId: number, prefs: NotifPrefs): void {
  localStorage.setItem(`labmanager_notif_${userId}`, JSON.stringify(prefs));
}

export function SettingsPage() {
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const role = user?.role as UserRole;
  const userId = user?.id as number;

  const availableKeys = ROLE_AVAILABLE_KEYS[role] ?? [];
  const [prefs, setPrefs] = useState<NotifPrefs>(() => getNotifPrefs(userId, role));

  const toggle = useCallback((key: NotifKey) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSave = useCallback(() => {
    saveNotifPrefs(userId, prefs);
    showToast("Preferências de notificações salvas.", "success");
  }, [userId, prefs, showToast]);

  return (
    <div className="space-y-8 max-w-2xl">
      {ToastComponent}
      <div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
          Configurações
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
          Escolha quais alertas em tempo real deseja receber.
        </p>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Bell size={16} style={{ color: "var(--text-secondary)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>
            Notificações em tempo real
          </span>
        </div>

        {availableKeys.length === 0 ? (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--text-tertiary)",
              fontSize: "0.875rem",
            }}
          >
            <BellOff size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
            Nenhuma notificação disponível para seu perfil.
          </div>
        ) : (
          <div>
            {availableKeys.map((key, idx) => (
              <label
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.875rem 1.25rem",
                  cursor: "pointer",
                  borderBottom: idx < availableKeys.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover, #f9f9f9)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <input
                  type="checkbox"
                  checked={prefs[key] ?? false}
                  onChange={() => toggle(key)}
                  style={{ width: "1rem", height: "1rem", accentColor: "var(--accent, #111)", cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>
                  {NOTIF_LABELS[key]}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.625rem 1.25rem",
          background: "var(--text-primary, #111)",
          color: "#fff",
          border: "none",
          borderRadius: "0.5rem",
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: "pointer",
        }}
      >
        <Save size={15} />
        Salvar preferências
      </button>
    </div>
  );
}
