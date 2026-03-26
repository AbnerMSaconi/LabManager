import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getToken } from '../api/client';
import { Toast, ToastType } from './ui';
import { getNotifPrefs, NotifKey, NOTIF_LABELS } from '../pages/SettingsPage';
import { UserRole } from '../types';

const EVENT_NOTIF_MAP: Record<string, { key: NotifKey; type: ToastType }> = {
  RESERVATION_CREATED: { key: "reservation_created", type: "warning" },
  RESERVATION_UPDATED: { key: "reservation_updated", type: "success" },
  MAINTENANCE_CREATED: { key: "maintenance_created", type: "warning" },
  MAINTENANCE_UPDATED: { key: "maintenance_updated", type: "success" },
  INVENTORY_UPDATED:   { key: "inventory_updated",   type: "success" },
  CHECKOUT:            { key: "checkout",            type: "success" },
  CHECKIN:             { key: "checkin",             type: "success" },
  LOAN_CREATED:        { key: "loan_created",        type: "warning" },
  LOAN_RETURNED:       { key: "loan_returned",       type: "success" },
};

export function SSEListener() {
  // 1. Pegamos o 'user' apenas para saber se a tela atual está logada
  const { user } = useAuth();
  const [notif, setNotif] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    if (!user) return;

    // 2. Buscamos o texto real do Token direto da API
    const token = getToken();
    
    if (!token) {
      console.warn("SSEListener: Token não encontrado no localStorage.");
      return;
    }

    console.log("🚀 Iniciando conexão SSE em tempo real...");

    // 3. Agora sim, o token vai como uma string (texto) limpa
    const eventSource = new EventSource(`/api/v1/events?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        if (event.data === ": keepalive") return;

        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          console.log("⚡ SSE Conectado via Proxy! Sincronização em tempo real ativa.");
          return;
        }

        window.dispatchEvent(new CustomEvent("sse-update", { detail: data }));
        const mapping = EVENT_NOTIF_MAP[data.type];
        if (mapping && user) {
          const prefs = getNotifPrefs(user.id, user.role as UserRole);
          if (prefs[mapping.key]) {
            setNotif({ message: NOTIF_LABELS[mapping.key], type: mapping.type });
          }
        }
      } catch (err) {
        console.error("Erro ao processar mensagem SSE:", err);
      }
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error('SSE: conexão recusada (token pode ter expirado ou é inválido).');
        eventSource.close();
      } else {
        console.warn('SSE: conexão oscilou. Reconectando...');
      }
    };

    return () => {
      eventSource.close();
    };
  }, [user]); // Refaz a conexão se o usuário deslogar/logar

  return notif ? (
    <Toast message={notif.message} type={notif.type} onClose={() => setNotif(null)} />
  ) : null;
}