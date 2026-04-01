import { useState, useEffect, useCallback, useRef } from "react";
import { ApiError } from "../api/client";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// 🔹 Adicionado o parâmetro 'listenToSSE' com valor padrão false
export function useFetch<T>(
  fetcher: () => Promise<T>, 
  deps: unknown[] = [], 
  listenToSSE: boolean = false
): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const depsRef = useRef(deps);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => {
        if (!cancelled) {
          if (err instanceof ApiError) setError(err.message);
          else setError("Erro ao carregar dados.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...depsRef.current]);

  useEffect(() => {
    if (!listenToSSE) return;

    const handleSseUpdate = () => {
      console.log("🔥 SINAL RECEBIDO! Recarregando a tabela pela API...");
      refetch();
    };

    window.addEventListener("sse-update", handleSseUpdate);
    return () => window.removeEventListener("sse-update", handleSseUpdate);
  }, [listenToSSE, refetch]);

  return { data, loading, error, refetch };
}