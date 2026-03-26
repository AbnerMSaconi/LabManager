import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export function SSEListener() {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    // 🔹 CORREÇÃO: Usando caminho relativo para o Vite/Nginx fazer o proxy automático!
    const eventSource = new EventSource(`/api/v1/events?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          console.log("⚡ SSE Conectado via Proxy! Sincronização em tempo real ativa.");
          return;
        }

        window.dispatchEvent(new CustomEvent("sse-update", { detail: data }));
      } catch (err) {
        console.error("Erro ao processar mensagem SSE:", err);
      }
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error('SSE: conexão recusada (token pode ter expirado).');
        eventSource.close();
      } else {
        console.warn('SSE: conexão oscilou. Reconectando...');
      }
    };

    return () => {
      eventSource.close();
    };
  }, [token]);

  return null;
}