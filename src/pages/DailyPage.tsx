import React, { useState, useRef, useEffect, useMemo } from "react";
import { Monitor, Package, CheckCircle2, X, Scan, ChevronDown, ChevronUp, Building2, Clock, LayoutGrid, CalendarDays } from "lucide-react";
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

  // 1. Se a reserva é de um dia que já passou
  if (isPastDay) {
    return { label: "ENCERRADA", variant: "past" };
  }

  // 2. Se a reserva é de um dia futuro
  if (!isToday) {
    if (r.status === ReservationStatus.APROVADO || r.status === ReservationStatus.EM_USO) {
      return { label: "CONFIRMADA", variant: "pending" };
    }
    return { label: r.status.replace(/_/g, " "), variant: "other" };
  }

  // 3. Se a reserva é HOJE, calculamos os minutos exatos
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

      if (currentMinutes >= endMinutes) {
        return { label: "ENCERRADA", variant: "past" };
      }
      if (currentMinutes >= startMinutes) {
        return { label: "EM AULA", variant: "active" };
      }
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
interface CheckoutModalProps { reservation: Reservation; onClose: () => void; onDone: () => void; }
function CheckoutModal({ reservation, onClose, onDone }: CheckoutModalProps) {
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      {ToastComponent}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Check-out de Materiais</h3>
            <p className="text-xs text-neutral-500">{reservation.user?.full_name} • {reservation.laboratory?.name}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {reservation.items.map(item => (
            <div key={item.id} className="bg-neutral-50 rounded-xl p-3 space-y-2 border border-neutral-100">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-neutral-800">{item.model?.name}</p>
                <span className="text-xs font-bold text-neutral-500 bg-neutral-200 px-2 py-0.5 rounded">Qtd: {item.quantity_requested}</span>
              </div>
              <div className="flex gap-2">
                <input ref={scanTarget === item.id ? scanRef : undefined} value={patrimonyInputs[item.id] ?? ""} onChange={e => setPatrimonyInputs(p => ({ ...p, [item.id]: e.target.value }))} placeholder="Patrimônio (QR Code)..." className="flex-1 bg-white border border-neutral-200 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-neutral-900 outline-none" />
                <button onClick={() => setScanTarget(scanTarget === item.id ? null : item.id)} className={`p-1.5 rounded-lg border transition-all ${scanTarget === item.id ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-200 hover:bg-neutral-100"}`}><Scan size={18} /></button>
              </div>
              {!patrimonyInputs[item.id] && (
                <div className="flex items-center justify-between bg-white border border-neutral-200 p-1.5 rounded-lg">
                  <span className="text-xs font-bold text-neutral-400 uppercase px-2">Quantidade</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(1, (q[item.id] ?? 1) - 1) }))} className="w-6 h-6 bg-neutral-100 rounded flex items-center justify-center font-bold text-neutral-600">-</button>
                    <span className="w-6 text-center font-bold text-sm">{quantities[item.id] ?? item.quantity_requested}</span>
                    <button onClick={() => setQuantities(q => ({ ...q, [item.id]: (q[item.id] ?? 1) + 1 }))} className="w-6 h-6 bg-neutral-100 rounded flex items-center justify-center font-bold text-neutral-600">+</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={handleCheckout} disabled={saving} className="w-full bg-neutral-900 text-white py-3 rounded-xl font-bold disabled:opacity-40 flex items-center justify-center gap-2 mt-4"><Package size={16} /> Confirmar Saída</button>
      </div>
    </div>
  );
}

// ── Modal de Check-in ───────────────────────────────────────────────────────
interface CheckinModalProps { reservation: Reservation; onClose: () => void; onDone: () => void; }
function CheckinModal({ reservation, onClose, onDone }: CheckinModalProps) {
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      {ToastComponent}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div><h3 className="text-lg font-bold">Devolução de Materiais</h3><p className="text-xs text-neutral-500">{reservation.laboratory?.name}</p></div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          {reservation.items.map(item => (
            <div key={item.id} className="bg-neutral-50 rounded-xl p-3 space-y-3 border border-neutral-100">
              <p className="font-bold text-sm text-neutral-800">{item.model?.name}</p>
              <div className="flex gap-2">
                {[{ value: "disponivel", label: "OK", color: "bg-emerald-100 text-emerald-700 border-emerald-200" }, { value: "manutencao", label: "Avaria", color: "bg-amber-100 text-amber-700 border-amber-200" }].map(opt => (
                  <button key={opt.value} onClick={() => setItemStatuses(s => ({ ...s, [item.id]: opt.value }))} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${itemStatuses[item.id] === opt.value ? opt.color : "bg-white border-neutral-200 text-neutral-500"}`}>{opt.label}</button>
                ))}
              </div>
              <div className="flex items-center justify-between bg-white border border-neutral-200 p-1.5 rounded-lg">
                <span className="text-xs font-bold text-neutral-400 uppercase px-2">Qtd Devolvida</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] ?? 1) - 1) }))} className="w-6 h-6 bg-neutral-100 rounded flex items-center justify-center font-bold text-neutral-600">-</button>
                  <span className="w-6 text-center font-bold text-sm">{quantities[item.id]}</span>
                  <button onClick={() => setQuantities(q => ({ ...q, [item.id]: (q[item.id] ?? 0) + 1 }))} className="w-6 h-6 bg-neutral-100 rounded flex items-center justify-center font-bold text-neutral-600">+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={handleCheckin} disabled={saving} className="w-full bg-neutral-900 text-white py-3 rounded-xl font-bold disabled:opacity-40 flex items-center justify-center gap-2 mt-4"><CheckCircle2 size={16} /> Confirmar Devolução</button>
      </div>
    </div>
  );
}

// ── Linha Compacta de Reserva (Com Sinalizadores) ───────────────────────────
function CompactReservationRow({ r, setCheckout, setCheckin }: { r: any; setCheckout: any; setCheckin: any }) {
  const hasMaterials = r.items && r.items.length > 0;
  const timeStr = r.timeBlocks?.join(" | ") || "—";
  const displayStatus = getDisplayStatus(r);
  
  const canCheckout = r.status === ReservationStatus.APROVADO && displayStatus.variant !== "past" && hasMaterials;
  const canCheckin  = r.status === ReservationStatus.EM_USO   && displayStatus.variant !== "past" && hasMaterials;

  let dotColor = "bg-neutral-300"; 
  let dotTitle = "Encerrada / Vago";

  if (displayStatus.variant !== "past") {
    if (canCheckout) {
      dotColor = "bg-yellow-400"; 
      dotTitle = "Aguardando liberação de material";
    } else if (canCheckin) {
      dotColor = "bg-blue-500"; 
      dotTitle = "Aguardando devolução de material";
    } else {
      dotColor = "bg-emerald-500"; 
      dotTitle = "Em andamento / Confirmada";
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
      className={`py-2 border-t border-neutral-100 transition-colors ${
        isClickable ? "cursor-pointer hover:bg-neutral-100 rounded-lg px-2 -mx-2" : "px-2 -mx-2"
      }`}
      title={isClickable ? "Clique para gerenciar materiais desta aula" : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-neutral-900 truncate">{timeStr}</p>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${dotColor}`} title={dotTitle} />
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <p className="text-xs text-neutral-500 truncate">{r.user?.full_name}</p>
        {hasMaterials && (
          <Package size={12} className="text-neutral-400 shrink-0" title={`${r.items.length} pacote(s) de material atrelado`} />
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
  const { data, loading, error, refetch } = useFetch(reservationsApi.listAll);
  const { ToastComponent } = useToast();

  const [checkoutTarget, setCheckoutTarget] = useState<Reservation | null>(null);
  const [checkinTarget,  setCheckinTarget]  = useState<Reservation | null>(null);
  const [expandedLabs,   setExpandedLabs]   = useState<Record<string, boolean>>({});
  
  // 1. Estado do Dia da Semana (Inicia com o dia de hoje)
  const [weekdayFilter, setWeekdayFilter] = useState<string>(() => {
    const today = new Date().getDay();
    return today === 0 ? "1" : today.toString(); // Se for domingo(0), pula pra segunda(1)
  });

  const [shiftFilter, setShiftFilter] = useState<"all" | "manha" | "tarde" | "noite">("all");
  const [blockFilter, setBlockFilter] = useState<string>("all");

  const labKey = (lab: Laboratory) => `lab-${lab.id ?? lab.name}`;

  const toggleLab = (key: string) =>
    setExpandedLabs(prev => ({ ...prev, [key]: !prev[key] }));

  const availableBlocks = useMemo(() => {
    if (!data) return [];
    const blocks = new Set<string>();
    data.forEach(res => { if (res.laboratory?.block) blocks.add(res.laboratory.block); });
    return Array.from(blocks).sort();
  }, [data]);

  // 2. CÉREBRO: Filtragem em Cascata (Dia -> Agrupamento -> Turno -> Bloco)
  const groupedLabs = useMemo(() => {
    if (!data) return [];

    // Filtra rigidamente pela DATA selecionada antes de montar a interface
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

    if (blockFilter !== "all") {
      resultList = resultList.filter(g => g.lab.block === blockFilter);
    }

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
    <div className="space-y-4 pb-8 w-full px-2 md:px-0">
      {ToastComponent}
      {checkoutTarget && <CheckoutModal reservation={checkoutTarget} onClose={() => setCheckoutTarget(null)} onDone={refetch} />}
      {checkinTarget  && <CheckinModal  reservation={checkinTarget}  onClose={() => setCheckinTarget(null)}  onDone={refetch} />}

      {/* ── Barra Superior (Filtro de Dia da Semana) ─────────────────────────── */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm sticky top-0 z-10 overflow-hidden">
        
        {/* Linha 1: Título e Filtro de Dias da Semana */}
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
              <LayoutGrid size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 leading-tight">Agenda DTI</h2>
              <p className="text-[11px] text-neutral-400 uppercase tracking-widest mt-0.5">
                Controle Operacional
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full xl:w-auto">
            <CalendarDays size={16} className="text-neutral-400 shrink-0 hidden md:block mr-1" />
            {WEEKDAYS.map(day => (
              <button
                key={day.value}
                onClick={() => setWeekdayFilter(day.value)}
                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                  weekdayFilter === day.value
                    ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                    : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 2: Turnos, Blocos e Legenda */}
        <div className="flex flex-col 3xl:flex-row 2xl:items-center justify-between gap-4 px-5 py-3">
          
          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full 2xl:w-auto overflow-x-auto no-scrollbar">
            {/* Filtros de Turno */}
            <div className="flex items-center gap-2 shrink-0">
              <Clock size={14} className="text-neutral-400 shrink-0" />
              {[{ id: "all", label: "Geral" }, { id: "manha", label: "Manhã" }, { id: "tarde", label: "Tarde" }, { id: "noite", label: "Noite" }].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setShiftFilter(opt.id as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                    shiftFilter === opt.id ? "bg-neutral-200 text-neutral-800" : "bg-transparent text-neutral-500 hover:bg-neutral-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-neutral-200 mx-2 hidden md:block"></div>

            {/* Filtros de Bloco */}
            {availableBlocks.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <Building2 size={14} className="text-neutral-400 shrink-0" />
                <button
                  onClick={() => setBlockFilter("all")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                    blockFilter === "all" ? "bg-neutral-200 text-neutral-800" : "bg-transparent text-neutral-500 hover:bg-neutral-100"
                  }`}
                >
                  Todos
                </button>
                {availableBlocks.map(block => (
                  <button
                    key={block}
                    onClick={() => setBlockFilter(block)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                      blockFilter === block ? "bg-neutral-200 text-neutral-800" : "bg-transparent text-neutral-500 hover:bg-neutral-100"
                    }`}
                  >
                    {block}
                  </button>
                ))}
                {hasActiveBlockFilter && (
                  <button onClick={() => setBlockFilter("all")} className="shrink-0 flex items-center gap-1 text-xs font-bold text-neutral-400 hover:text-neutral-700 transition-colors ml-2">
                    <X size={14} /> Limpar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pt-2 2xl:pt-0 border-t 2xl:border-none border-neutral-100">
            <div className="flex items-center gap-1.5 shrink-0"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm" /> <span className="text-[10px] font-bold text-neutral-500 uppercase">Liberar Mat.</span></div>
            <div className="flex items-center gap-1.5 shrink-0"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" /> <span className="text-[10px] font-bold text-neutral-500 uppercase">Devolver Mat.</span></div>
            <div className="flex items-center gap-1.5 shrink-0"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> <span className="text-[10px] font-bold text-neutral-500 uppercase">Em Aula/Conf.</span></div>
            <div className="flex items-center gap-1.5 shrink-0"><div className="w-2.5 h-2.5 rounded-full bg-neutral-300 shadow-sm" /> <span className="text-[10px] font-bold text-neutral-500 uppercase">Encerrada</span></div>
          </div>
        </div>
      </div>

      {loading && <LoadingSpinner label="Buscando matriz..." />}
      {error   && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && groupedLabs.length === 0 && (
        <div className="text-center py-20 text-neutral-400">
          <Monitor size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-base font-bold text-neutral-500">Nenhum laboratório encontrado</p>
          <p className="text-sm mt-1">
            Não há aulas previstas para os filtros selecionados.
          </p>
        </div>
      )}

      {/* ── Grid de Laboratórios ─────────────────────────────────────────── */}
      {!loading && !error && groupedLabs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mt-6 items-start">
          {groupedLabs.map(({ lab, reservations }) => {
            const { primary, others } = getPrimaryAndOthers(reservations);
            const key = labKey(lab);
            const isExpanded = expandedLabs[key];

            return (
              <div key={key} className="relative">
                <div className={`bg-white border border-neutral-200 rounded-2xl shadow-sm flex flex-col transition-all duration-300 ${isExpanded ? "ring-2 ring-neutral-900 border-neutral-900 z-40 relative" : "hover:shadow-md"}`}>
                  <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-3 rounded-t-2xl bg-neutral-50">
                    <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shrink-0 shadow-sm">
                      <Monitor size={20} className="text-neutral-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm md:text-base text-neutral-800 truncate">{lab.name}</h3>
                      <span className="flex items-center gap-1 text-[11px] md:text-xs font-semibold text-neutral-500 mt-0.5 truncate">
                        <Building2 size={12} />
                        {lab.block} • Sala {lab.room_number}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <CompactReservationRow r={primary} setCheckout={setCheckoutTarget} setCheckin={setCheckinTarget} />
                  </div>

                  {others.length > 0 && (
                    <button
                      onClick={() => toggleLab(key)}
                      className={`w-full py-2.5 flex items-center justify-center gap-1 text-xs font-bold transition-colors rounded-b-2xl border-t ${
                        isExpanded 
                          ? "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800" 
                          : "border-neutral-100 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50"
                      }`}
                    >
                      {isExpanded
                        ? <><ChevronUp size={14} /> Fechar grade de horários</>
                        : <><ChevronDown size={14} /> Ver {others.length} aula(s) seguintes</>
                      }
                    </button>
                  )}
                </div>

                <div 
                  className={`absolute top-full left-0 right-0 z-30 pt-2 transition-all duration-300 ease-out origin-top ${
                    isExpanded ? "opacity-100 scale-y-100 pointer-events-auto" : "opacity-0 scale-y-95 pointer-events-none"
                  }`}
                >
                  <div className="bg-white border border-neutral-200 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5">
                    <div className="px-3 py-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {others.map((r, i) => (
                        <CompactReservationRow key={i} r={r} setCheckout={setCheckoutTarget} setCheckin={setCheckinTarget} />
                      ))}
                    </div>
                    <div className="bg-neutral-50 border-t border-neutral-100 p-2">
                       <button
                         onClick={() => toggleLab(key)}
                         className="w-full py-2 bg-white border border-neutral-200 rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors shadow-sm"
                       >
                         <ChevronUp size={14} /> Recolher
                       </button>
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