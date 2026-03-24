import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning";

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

const TOAST_STYLES: Record<ToastType, { bg: string; text: string; icon: React.ReactNode }> = {
  success: {
    bg: "var(--success-bg)", text: "var(--success-text)",
    icon: <CheckCircle2 size={18} />,
  },
  error: {
    bg: "var(--danger-bg)", text: "var(--danger-text)",
    icon: <XCircle size={18} />,
  },
  warning: {
    bg: "var(--warning-bg)", text: "var(--warning-text)",
    icon: <AlertTriangle size={18} />,
  },
};

export function Toast({ message, type = "success", onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const s = TOAST_STYLES[type];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 px-4 py-3 rounded-2xl shadow-xl max-w-sm border"
      style={{ background: s.bg, color: s.text, borderColor: "rgba(0,0,0,0.06)" }}>
      {s.icon}
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

export function LoadingSpinner({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-2 rounded-full animate-spin"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--ucdb-blue)" }} />
      <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{label}</p>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <XCircle size={40} style={{ color: "var(--danger-text)", opacity: 0.4 }} />
      <p className="text-sm text-center max-w-xs" style={{ color: "var(--text-secondary)" }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="px-4 py-2 text-sm font-bold rounded-xl"
          style={{ background: "var(--ucdb-blue)", color: "#fff" }}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

interface ToastState { message: string; type: ToastType }

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);
  const ToastComponent = toast
    ? <Toast message={toast.message} type={toast.type} onClose={closeToast} />
    : null;
  return { showToast, ToastComponent };
}
