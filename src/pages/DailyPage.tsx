import React, { useState, useRef, useEffect, useMemo } from "react";
import { Monitor, Package, CheckCircle2, Check, X, Scan, ChevronDown, ChevronUp, Building2, Clock, LayoutGrid, CalendarDays } from "lucide-react";
import { Reservation, ReservationStatus, Laboratory } from "../types";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi } from "../api/reservationsApi";
import { inventoryApi } from "../api/inventoryApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { ApiError } from "../api/client";

// ── Helper: Status real baseado no horário E NA DATA atual ──────────────────
function getDisplayStatus(r: any): {
  label: string;
  variant: "active" | "pending" | "past" | "other";
} {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Tratamento de data seguro contra fuso horário (UTC)
  const resDate = new Date(r.date + "T00:00:00");
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const isPastDay = resDate.getTime() < todayDate.getTime();
  const isToday = resDate.getTime() === todayDate.getTime();

  if (isPastDay) return { label: "ENCERRADA", variant: "past" };

  if (!isToday) {
    if (r.status === ReservationStatus.APROVADO || r.status === ReservationStatus.EM_USO) {
      return { label: "CONFIRMADA", variant: "pending" };
    }
    return { label: r.status.replace(/_/g, " "), variant: "other" };
  }

  const firstBlock = r.timeBlocks?.[0];
  const lastBlock  = r.timeBlocks?.[r.timeBlocks.length - 1];

  if (firstBlock && lastBlock) {
    const startStr = firstBlock.split(" às ")[0];
    const endStr   = lastBlock.split(" às ")[1];

    if (startStr && endStr) {
      const [sh, sm] = startStr.split(":").map(Number);
      const [eh, em] = endStr.split(":").map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes   = eh * 60 + em;

      if (currentMinutes >= endMinutes) return { label: "ENCERRADA", variant: "past" };
      if (currentMinutes >= startMinutes) return { label: "EM AULA", variant: "active" };
      if (r.status === ReservationStatus.APROVADO || r.status === ReservationStatus.EM_USO) {
        return { label: "CONFIRMADA", variant: "pending" };
      }
    }
  }

  if (r.status === ReservationStatus.EM_USO)   return { label: "EM AULA",    variant: "active"  };
  if (r.status === ReservationStatus.APROVADO) return { label: "CONFIRMADA", variant: "pending" };
  return { label: r.status.replace(/_/g, " "), variant: "other" };
}

// ── Modal de Checkout ───────────────────────────────────────────────────────
function CheckoutModal({ reservation, onClose, onDone }: { reservation: Reservation; onClose: () => void; onDone: () => void; }) {
  const { showToast, ToastComponent } = useToast();
  const [patrimonyInputs, setPatrimonyInputs] = useState<Record<number, string>>({});
  const [quantities, setQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(reservation.items.map(i => [i.id, i.quantity_requested]))
  );
  const [saving, setSaving] = useState(false);
  const [scanTarget, setScanTarget] = useState<number | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (scanTarget !== null) scanRef.current?.focus(); }, [scanTarget]);

  const handleCheckout = async () => {
    setSaving(true);
    try {
      await inventoryApi.checkout({
        reservation_id: reservation.id,
        items: reservation.items.map(item => ({
          reservation_item_id: item.id,
          patrimony_id: patrimonyInputs[item.id] || undefined,
          quantity_delivered: patrimonyInputs[item.id] ? undefined : quantities[item.id],
        })),
      });
      showToast("Checkout realizado com sucesso.", "success");
      setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro no checkout.", "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div>
            <h3 className="text-xl font-bold text-neutral-900">Liberar Materiais</h3>
            <p className="text-xs font-medium text-neutral-500 mt-1">{reservation.user?.full_name} • {reservation.laboratory?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar bg-neutral-50/30">
          {reservation.items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/60 transition-all hover:border-neutral-300">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Package size={14} /></div>
                  <p className="font-bold text-sm text-neutral-900">{item.model?.name}</p>
                </div>
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md uppercase tracking-wider">
                  Qtd. Solicitada: {item.quantity_requested}
                </span>
              </div>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    ref={scanTarget === item.id ? scanRef : undefined} 
                    value={patrimonyInputs[item.id] ?? ""} 
                    onChange={e => setPatrimonyInputs(p => ({ ...p, [item.id]: e.target.value }))} 
                    placeholder="Escanear Patrimônio (QR)..." 
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
                  />
                </div>
                <button 
                  onClick={() => setScanTarget(scanTarget === item.id ? null : item.id)} 
                  className={`px-3 rounded-xl border transition-all flex items-center justify-center ${scanTarget === item.id ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                  title="Escanear QR Code"
                >
                  <Scan size={18} />
                </button>
              </div>
              
              {!patrimonyInputs[item.id] && (
                <div className="flex items-center justify-between bg-neutral-50 border border-neutral-100 p-2 rounded-xl mt-3">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider px-2">Entrega Manual</span>
                  <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-0.5 shadow-sm">
                    <button onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(1, (q[item.id] ?? 1) - 1) }))} className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all">-</button>
                    <span className="w-8 text-center font-bold text-sm text-neutral-900">{quantities[item.id] ?? item.quantity_requested}</span>
                    <button onClick={() => setQuantities(q => ({ ...q, [item.id]: (q[item.id] ?? 1) + 1 }))} className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all">+</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="p-6 bg-white border-t border-neutral-100">
          <button onClick={handleCheckout} disabled={saving} className="w-full bg-neutral-900 hover:bg-neutral-800 text-white py-3.5 rounded-xl font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
            {saving ? <LoadingSpinner label="" /> : <><CheckCircle2 size={18} /> Confirmar Liberação</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de Check-in ───────────────────────────────────────────────────────
function CheckinModal({ reservation, onClose, onDone }: { reservation: Reservation; onClose: () => void; onDone: () => void; }) {
  const { showToast, ToastComponent } = useToast();
  const [itemStatuses, setItemStatuses] = useState<Record<number, string>>(() => Object.fromEntries(reservation.items.map(i => [i.id, "disponivel"])));
  const [quantities, setQuantities] = useState<Record<number, number>>(() => Object.fromEntries(reservation.items.map(i => [i.id, i.quantity_requested])));
  const [saving, setSaving] = useState(false);

  const handleCheckin = async () => {
    setSaving(true);
    try {
      await inventoryApi.checkin({
        reservation_id: reservation.id,
        items: reservation.items.map(item => ({ reservation_item_id: item.id, new_status: itemStatuses[item.id] ?? "disponivel", quantity_returned: quantities[item.id] })),
      });
      showToast("Check-in realizado com sucesso.", "success");
      setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro no check-in.", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div>
            <h3 className="text-xl font-bold text-neutral-900">Devolução de Materiais</h3>
            <p className="text-xs font-medium text-neutral-500 mt-1">{reservation.user?.full_name} • {reservation.laboratory?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar bg-neutral-50/30">
          {reservation.items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/60 transition-all hover:border-neutral-300">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><RotateCcw size={14} /></div>
                <p className="font-bold text-sm text-neutral-900">{item.model?.name}</p>
              </div>
              
              <div className="flex gap-2 mb-3">
                {[{ value: "disponivel", label: "Perfeito Estado", color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" }, { value: "manutencao", label: "Avariado", color: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" }].map(opt => (
                  <button key={opt.value} onClick={() => setItemStatuses(s => ({ ...s, [item.id]: opt.value }))} 
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${itemStatuses[item.id] === opt.value ? opt.color + " shadow-sm ring-1 ring-black/5" : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center justify-between bg-neutral-50 border border-neutral-100 p-2 rounded-xl">
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider px-2">Qtd Devolvida</span>
                <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-0.5 shadow-sm">
                  <button onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] ?? 1) - 1) }))} className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all">-</button>
                  <span className="w-8 text-center font-bold text-sm text-neutral-900">{quantities[item.id]}</span>
                  <button onClick={() => setQuantities(q => ({ ...q, [item.id]: (q[item.id] ?? 0) + 1 }))} className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all">+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-6 bg-white border-t border-neutral-100">
          <button onClick={handleCheckin} disabled={saving} className="w-full bg-neutral-900 hover:bg-neutral-800 text-white py-3.5 rounded-xl font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
            {saving ? <LoadingSpinner label="" /> : <><CheckCircle2 size={18} /> Confirmar Devolução</>}
          </button>
        </div>
      </div>
    </div>
  );
}

import { RotateCcw } from "lucide-react"; 

// ── Dropdown Customizado (Substitui o <select> nativo) ──────────────────────
function CustomDropdown({
  value,
  options,
  onChange,
  icon: Icon,
  prefix = ""
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  icon: React.ElementType;
  prefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div className="relative w-full sm:w-auto" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full sm:w-auto flex items-center justify-between gap-3 bg-white border border-neutral-200 text-neutral-800 py-2.5 px-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm hover:bg-neutral-50 transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-neutral-500" />
          <span className="truncate max-w-[140px] text-left">{prefix}{selectedLabel}</span>
        </div>
        <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 w-full sm:min-w-[180px] mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] z-50 overflow-hidden py-1.5">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors flex items-center justify-between ${
                  value === opt.value
                    ? "bg-blue-50 text-blue-700"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                <span className="truncate pr-2">{prefix}{opt.label}</span>
                {value === opt.value && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linha Compacta de Reserva (Resolução do problema de enquadramento) ──────
function CompactReservationRow({ r, setCheckout, setCheckin }: { r: any; setCheckout: any; setCheckin: any }) {
  const hasMaterials = r.items && r.items.length > 0;
  const timeStr = r.timeBlocks?.join(" | ") || "—";
  const displayStatus = getDisplayStatus(r);
  
  const canCheckout = r.status === ReservationStatus.APROVADO && displayStatus.variant !== "past" && hasMaterials;
  const canCheckin  = r.status === ReservationStatus.EM_USO   && displayStatus.variant !== "past" && hasMaterials;

  let dotColor = "bg-neutral-200"; 
  let dotGlow = "";
  let dotTitle = "Encerrada / Vago";
  let textColor = "text-neutral-500";

  if (displayStatus.variant !== "past") {
    if (canCheckout) {
      dotColor = "bg-amber-400"; 
      dotGlow = "shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse";
      dotTitle = "Aguardando liberação de material";
      textColor = "text-amber-700";
    } else if (canCheckin) {
      dotColor = "bg-blue-500"; 
      dotGlow = "shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse";
      dotTitle = "Aguardando devolução de material";
      textColor = "text-blue-700";
    } else {
      dotColor = "bg-emerald-500"; 
      dotTitle = "Em andamento / Confirmada";
      textColor = "text-emerald-700";
    }
  }

  const handleClick = () => {
    if (canCheckout) setCheckout(r);
    if (canCheckin) setCheckin(r);
  };

  const isClickable = canCheckout || canCheckin;

  return (
    <div 
      onClick={isClickable ? handleClick : undefined}
      className={`p-3 border border-neutral-100 transition-all mb-2 last:mb-0 rounded-xl ${
        isClickable ? "cursor-pointer bg-white hover:border-neutral-300 hover:shadow-sm active:scale-[0.99]" : "bg-neutral-50/50"
      }`}
      title={isClickable ? "Clique para gerenciar materiais desta aula" : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className={`text-sm font-bold leading-snug ${displayStatus.variant === "past" ? "text-neutral-400" : "text-neutral-900"}`}>
          {timeStr}
        </p>
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          {isClickable && <span className={`text-[9px] font-bold uppercase tracking-wider ${textColor}`}>{canCheckout ? "Liberar" : "Devolver"}</span>}
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor} ${dotGlow}`} title={dotTitle} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <p className={`text-xs font-medium truncate ${displayStatus.variant === "past" ? "text-neutral-400" : "text-neutral-600"}`}>
          {r.user?.full_name}
        </p>
        {hasMaterials && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${displayStatus.variant === "past" ? "bg-neutral-100 text-neutral-400" : "bg-neutral-100 text-neutral-600"}`} title={`${r.items.length} pacote(s) de material atrelado`}>
            <Package size={10} /> {r.items.length}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Constantes do Filtro Semanal ────────────────────────────────────────────
const WEEKDAYS = [
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" },
];

// ── Página Principal ────────────────────────────────────────────────────────
export function DailyPage() {
  const { data, loading, error, refetch } = useFetch(reservationsApi.listAll, [], true);
  const { ToastComponent } = useToast();

  const [checkoutTarget, setCheckoutTarget] = useState<Reservation | null>(null);
  const [checkinTarget,  setCheckinTarget]  = useState<Reservation | null>(null);
  const [expandedLabs,   setExpandedLabs]   = useState<Record<string, boolean>>({});
  
  const [weekdayFilter, setWeekdayFilter] = useState<string>(() => {
    const today = new Date().getDay();
    return today === 0 ? "1" : today.toString(); 
  });

  const [shiftFilter, setShiftFilter] = useState<"all" | "manha" | "tarde" | "noite">("all");
  const [blockFilter, setBlockFilter] = useState<string>("all");

  const labKey = (lab: Laboratory) => `lab-${lab.id ?? lab.name}`;
  const toggleLab = (key: string) => setExpandedLabs(prev => ({ ...prev, [key]: !prev[key] }));

  const availableBlocks = useMemo(() => {
    if (!data) return [];
    const blocks = new Set<string>();
    data.forEach(res => { if (res.laboratory?.block) blocks.add(res.laboratory.block); });
    return Array.from(blocks).sort();
  }, [data]);

  const groupedLabs = useMemo(() => {
    if (!data) return [];

    const dataFilteredByDay = data.filter((res: any) => {
      const resDate = new Date(res.date + "T00:00:00");
      return resDate.getDay().toString() === weekdayFilter;
    });

    const groups: Record<number, { lab: Laboratory; reservations: any[] }> = {};
    const mergedMap = new Map<string, any>();

    dataFilteredByDay.forEach((res: any) => {
      const key = `${res.lab_id}-${res.user_id}-${res.status}`;
      if (!mergedMap.has(key)) mergedMap.set(key, { ...res, slots: [...(res.slots || [])] });
      else {
        const existing = mergedMap.get(key);
        res.slots?.forEach((s: any) => {
          if (!existing.slots.find((es: any) => es.code === s.code)) existing.slots.push(s);
        });
      }
    });

    Array.from(mergedMap.values()).forEach(res => {
      const sortedSlots = res.slots.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

      const displaySlots = shiftFilter === "all" ? sortedSlots : sortedSlots.filter((slot: any) => {
        const [hours, minutes] = slot.start_time.split(":").map(Number);
        const floatTime = hours + minutes / 60;
        let slotShift = "manha";
        if (floatTime >= 17 + 50 / 60) slotShift = "noite";
        else if (floatTime >= 12) slotShift = "tarde";
        return slotShift === shiftFilter;
      });

      if (displaySlots.length === 0) return;

      const timeBlocks: string[] = [];
      let currentBlock = { start: displaySlots[0].start_time, end: displaySlots[0].end_time };
      for (let i = 1; i < displaySlots.length; i++) {
        if (displaySlots[i].start_time === currentBlock.end) {
          currentBlock.end = displaySlots[i].end_time;
        } else {
          timeBlocks.push(`${currentBlock.start} às ${currentBlock.end}`);
          currentBlock = { start: displaySlots[i].start_time, end: displaySlots[i].end_time };
        }
      }
      timeBlocks.push(`${currentBlock.start} às ${currentBlock.end}`);
      res.timeBlocks = timeBlocks;

      const labId = res.laboratory?.id ?? -1;
      if (!groups[labId]) groups[labId] = { lab: res.laboratory as Laboratory, reservations: [] };
      groups[labId].reservations.push(res);
    });

    let resultList = Object.values(groups).map(group => {
      group.reservations.sort((a, b) => (a.timeBlocks?.[0] || "").localeCompare(b.timeBlocks?.[0] || ""));
      return group;
    });

    resultList = resultList.sort((a, b) => a.lab.name.localeCompare(b.lab.name));
    if (blockFilter !== "all") resultList = resultList.filter(g => g.lab.block === blockFilter);

    return resultList;
  }, [data, weekdayFilter, shiftFilter, blockFilter]);

  const getPrimaryAndOthers = (reservations: any[]) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

    let primaryIdx = reservations.findIndex(r => {
      const start = r.timeBlocks?.[0]?.split(" às ")[0];
      const end   = r.timeBlocks?.[r.timeBlocks.length - 1]?.split(" às ")[1];
      if (!start || !end) return false;
      return toMins(start) <= currentMinutes && currentMinutes < toMins(end);
    });

    if (primaryIdx === -1) {
      primaryIdx = reservations.findIndex(r => {
        const start = r.timeBlocks?.[0]?.split(" às ")[0];
        if (!start) return false;
        return toMins(start) > currentMinutes;
      });
    }

    if (primaryIdx === -1) primaryIdx = reservations.length - 1;
    if (primaryIdx < 0)    primaryIdx = 0;

    return {
      primary: reservations[primaryIdx],
      others:  reservations.filter((_, idx) => idx !== primaryIdx),
    };
  };

  const hasActiveBlockFilter = blockFilter !== "all";

  return (
    <div className="space-y-6 pb-12 w-full px-2 md:px-0">
      {ToastComponent}
      {checkoutTarget && <CheckoutModal reservation={checkoutTarget} onClose={() => setCheckoutTarget(null)} onDone={refetch} />}
      {checkinTarget  && <CheckinModal  reservation={checkinTarget}  onClose={() => setCheckinTarget(null)}  onDone={refetch} />}

      {/* ── Barra Superior Fixa (Header & Filtros) com Agrupamento Dropdown ─ */}
      <div className="sticky top-0 z-20 -mx-2 md:mx-0 px-2 md:px-0 pt-2 pb-4 bg-[#f1f4f8]/80 backdrop-blur-md">
        <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-sm ring-1 ring-black/5">
          
          <div className="flex flex-col lg:flex-row justify-between gap-4 px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 rounded-t-2xl">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0 shadow-inner">
                <LayoutGrid size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900 leading-tight">Agenda de Aulas</h2>
                <p className="text-[11px] text-neutral-500 uppercase tracking-widest mt-0.5 font-semibold">
                  Monitoramento em Tempo Real
                </p>
              </div>
            </div>

            {/* Grupo de Filtros com Componente Customizado (100% Nativo, Estilo Moderno) */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Dia da Semana */}
              <CustomDropdown
                value={weekdayFilter}
                options={WEEKDAYS.map(day => ({ value: String(day.value), label: day.label }))}
                onChange={setWeekdayFilter}
                icon={CalendarDays}
              />

              {/* Turnos */}
              <CustomDropdown
                value={shiftFilter}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "manha", label: "Manhã" },
                  { value: "tarde", label: "Tarde" },
                  { value: "noite", label: "Noite" }
                ]}
                onChange={setShiftFilter as any}
                icon={Clock}
                prefix="Turno: "
              />

              {/* Blocos */}
              {availableBlocks.length > 0 && (
                <div className="flex gap-2 w-full sm:w-auto">
                  <CustomDropdown
                    value={blockFilter}
                    options={[
                      { value: "all", label: "Todos" },
                      ...availableBlocks.map(b => ({ value: b, label: b }))
                    ]}
                    onChange={setBlockFilter}
                    icon={Building2}
                    prefix="Bloco: "
                  />
                  {hasActiveBlockFilter && (
                    <button 
                      onClick={() => setBlockFilter("all")} 
                      className="shrink-0 flex items-center justify-center px-3 bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 rounded-xl transition-colors shadow-sm" 
                      title="Remover filtro de bloco"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white px-6 py-3.5 flex flex-wrap items-center gap-5 text-[10px] font-bold text-neutral-500 uppercase tracking-widest rounded-b-2xl">
             <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" /> Liberar Mat.</div>
             <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" /> Devolver Mat.</div>
             <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> Em Aula / Conf.</div>
             <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-neutral-200 shadow-sm" /> Encerrada / Vago</div>
          </div>
        </div>
      </div>

      {loading && <LoadingSpinner label="Sincronizando grade..." />}
      {error   && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && groupedLabs.length === 0 && (
        <div className="text-center py-24 bg-white border border-dashed border-neutral-200 rounded-3xl">
          <Monitor size={48} className="mx-auto mb-4 text-neutral-200" />
          <p className="text-lg font-bold text-neutral-600">Nenhuma aula programada</p>
          <p className="text-sm text-neutral-400 mt-1">
            Não há registros para a combinação de filtros selecionada.
          </p>
        </div>
      )}

      {/* ── Grid de Laboratórios ─────────────────────────────────────────── */}
      {!loading && !error && groupedLabs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 items-start">
          {groupedLabs.map(({ lab, reservations }) => {
            const { primary, others } = getPrimaryAndOthers(reservations);
            const key = labKey(lab);
            const isExpanded = expandedLabs[key];

            return (
              <div key={key} className={`relative ${isExpanded ? "z-40" : "z-0"}`}>
                <div className={`bg-white border flex flex-col transition-all duration-300 ${
                  isExpanded 
                    ? "border-neutral-900 shadow-xl rounded-t-2xl rounded-b-none border-b-0" 
                    : "border-neutral-200/80 shadow-sm hover:shadow-md hover:border-neutral-300 rounded-2xl"
                }`}>
                  
                  {/* Lab Header */}
                  <div className={`px-4 py-4 border-b border-neutral-100 flex items-center gap-3 bg-neutral-50/50 ${isExpanded ? "rounded-t-2xl" : "rounded-t-2xl"}`}>
                    <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200/60 flex items-center justify-center shrink-0 shadow-sm">
                      <Monitor size={18} className="text-neutral-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base text-neutral-900 truncate">{lab.name}</h3>
                      <span className="flex items-center gap-1 text-xs font-semibold text-neutral-500 mt-0.5 truncate">
                        <Building2 size={12} />
                        {lab.block} • Sl. {lab.room_number}
                      </span>
                    </div>
                  </div>

                  {/* Primary Reservation */}
                  <div className="p-3 bg-white">
                    <CompactReservationRow r={primary} setCheckout={setCheckoutTarget} setCheckin={setCheckinTarget} />
                  </div>

                  {/* Toggle Others */}
                  {others.length > 0 && (
                    <button
                      onClick={() => toggleLab(key)}
                      className={`w-full py-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                        isExpanded 
                          ? "bg-neutral-900 text-white border-none rounded-b-none" 
                          : "bg-neutral-50 border-t border-neutral-100 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-b-2xl"
                      }`}
                    >
                      {isExpanded
                        ? <><ChevronUp size={14} /> Fechar grade diária</>
                        : <><ChevronDown size={14} /> Ver {others.length} aula(s) seguintes</>
                      }
                    </button>
                  )}
                </div>

                {/* Dropdown Others (Fusão Visual Perfeita) */}
                <div 
                  className={`absolute top-full left-0 right-0 transition-all duration-200 ease-out origin-top ${
                    isExpanded ? "opacity-100 scale-y-100 pointer-events-auto z-30" : "opacity-0 scale-y-95 pointer-events-none -z-10"
                  }`}
                >
                  <div className="bg-white border border-neutral-900 border-t-0 rounded-b-2xl shadow-[0_15px_30px_-5px_rgba(0,0,0,0.15)] overflow-hidden">
                    <div className="bg-neutral-50 border-b border-neutral-100 px-4 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      Próximas Aulas
                    </div>
                    <div className="p-3 max-h-[300px] overflow-y-auto custom-scrollbar space-y-1">
                      {others.map((r, i) => (
                        <CompactReservationRow key={i} r={r} setCheckout={setCheckoutTarget} setCheckin={setCheckinTarget} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}