/**
 * Shared constants, types and components used across reservation pages.
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Monitor, CalendarDays, Building2, Layers, ChevronLeft, ChevronDown,
  Info, XCircle, Edit, Trash2, X, Package, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ReservationStatus, Reservation, Laboratory, ReservationItem } from "../types";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi } from "../api/reservationsApi";
import { labsApi } from "../api/labsApi";
import { LoadingSpinner, useToast } from "../components/ui";
import { ApiError } from "../api/client";

// ... [Ocultei as CONSTANTES, TIME_SLOTS, e BADGES para economizar texto aqui, MANTENHA AS MESMAS DO CÓDIGO ORIGINAL!] ...

export const STATUS_STYLES: Record<string, string> = {
  [ReservationStatus.APROVADO]:            "bg-emerald-100 text-emerald-700 border-emerald-200",
  [ReservationStatus.PENDENTE]:            "bg-amber-100 text-amber-700 border-amber-200",
  [ReservationStatus.REJEITADO]:           "bg-red-100 text-red-700 border-red-200",
  [ReservationStatus.EM_USO]:              "bg-blue-100 text-blue-700 border-blue-200",
  [ReservationStatus.CONCLUIDO]:           "bg-neutral-100 text-neutral-500 border-neutral-200",
  [ReservationStatus.AGUARDANDO_SOFTWARE]: "bg-purple-100 text-purple-700 border-purple-200",
  [ReservationStatus.CANCELADO]:           "bg-neutral-100 text-neutral-400 border-neutral-200",
};

export const TIME_SLOTS = ["M1","M2","M3","M4","M5","M6","T1","T2","T3","T4","T5","T6","N1","N2","N3","N4"];
export const SLOT_TIMES: Record<string, string> = { "M1": "07:30", "M2": "08:20", "M3": "09:25", "M4": "10:15", "M5": "11:10", "M6": "12:00", "T1": "13:20", "T2": "14:10", "T3": "15:10", "T4": "16:00", "T5": "17:00", "T6": "17:50", "N1": "18:50", "N2": "19:40", "N3": "20:45", "N4": "21:35" };
export const WEEK_DAYS = [{ id: 1, label: "Segunda" }, { id: 2, label: "Terça" }, { id: 3, label: "Quarta" }, { id: 4, label: "Quinta" }, { id: 5, label: "Sexta" }, { id: 6, label: "Sábado" }];
export const WEEKDAY_NAMES = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

export function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  return <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{status.replace(/_/g, " ")}</span>;
}

export function SoftwareBadge({ softwares, label = "Software" }: { softwares: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  const list = softwares.split(",").map(s => s.trim()).filter(Boolean);
  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={e => { e.stopPropagation(); setOpen(v => !v); }} className="flex items-center gap-0.5 text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer">{label} <ChevronDown size={9} /></button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden min-w-[160px]">
          <div className="bg-purple-50 border-b border-purple-100 px-3 py-2 text-[10px] font-bold text-purple-700 uppercase tracking-widest">Softwares ({list.length})</div>
          <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">{list.map((sw, i) => (<div key={i} className="px-3 py-2 text-xs font-medium text-neutral-700 flex items-center gap-2 hover:bg-neutral-50"><Monitor size={11} className="text-purple-400 flex-shrink-0" />{sw}</div>))}</div>
        </div>
      )}
    </div>
  );
}

export function MaterialsBadge({ items }: { items: ReservationItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={e => { e.stopPropagation(); setOpen(v => !v); }} className="flex items-center gap-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer">Materiais <ChevronDown size={9} /></button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
          <div className="bg-amber-50 border-b border-amber-100 px-3 py-2 text-[10px] font-bold text-amber-700 uppercase tracking-widest">Materiais ({items.length})</div>
          <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">{items.map(item => (<div key={item.id} className="px-3 py-2 text-xs font-medium text-neutral-700 flex items-center justify-between gap-3 hover:bg-neutral-50"><span className="flex items-center gap-2"><Package size={11} className="text-amber-400 flex-shrink-0" />{item.model?.name ?? `Item #${item.item_model_id}`}</span><span className="text-neutral-400 font-bold">x{item.quantity_requested}</span></div>))}</div>
        </div>
      )}
    </div>
  );
}

// ─── Dropdown Customizado (Injetado) ──────────────────────────────────────────

export function CustomDropdown({ value, options, onChange, icon: Icon, prefix = "", placeholder = "Selecione" }: { value: string | number; options: { value: string | number; label: string }[]; onChange: (val: any) => void; icon: React.ElementType; prefix?: string; placeholder?: string; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label;

  return (
    <div className="relative w-full" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between gap-3 bg-white border border-neutral-200 py-2.5 px-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-all active:scale-[0.99] ${open ? "ring-2 ring-neutral-200" : "hover:bg-neutral-50"}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <Icon size={16} className="text-neutral-500 shrink-0" />
          <span className="truncate text-left text-neutral-700">{selectedLabel ? <>{prefix}<span className="font-bold">{selectedLabel}</span></> : <span className="text-neutral-400">{placeholder}</span>}</span>
        </div>
        <ChevronDown size={14} className={`text-neutral-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 w-full mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-xl z-[70] py-1.5">
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {options.map((opt) => (
              <button type="button" key={String(opt.value)} onClick={() => { onChange(opt.value); setOpen(false); }} className={`w-full text-left px-3 py-2.5 text-sm font-bold transition-colors flex items-center justify-between ${String(value) === String(opt.value) ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"}`}>
                <span className="truncate pr-2">{prefix}{opt.label}</span>
                {String(value) === String(opt.value) && <Check size={14} className="text-neutral-900 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal de Edição (Estilizado) ─────────────────────────────────────────────

function EditReservationModal({ reservation, onClose, onSaved }: { reservation: Reservation, onClose: () => void, onSaved: () => void }) {
  const { showToast, ToastComponent } = useToast();
  const { data: labs } = useFetch(labsApi.list);
  const { data: slots } = useFetch(labsApi.listSlots);

  const formatDateForInput = (d?: string) => {
    if (!d) return "";
    if (d.includes("T")) return d.split("T")[0];
    return d;
  };

  const safeSlots = reservation.slots ? reservation.slots.map(s => { const slotId = typeof s === "number" ? s : (s as any).slot_id || s.id; return Number(slotId); }).filter(id => !isNaN(id) && id > 0) : [];

  const [form, setForm] = useState({
    lab_id: reservation.lab_id ? Number(reservation.lab_id) : "",
    date: formatDateForInput(reservation.date),
    slot_ids: safeSlots
  });
  const [saving, setSaving] = useState(false);

  const toggleSlot = (id: number) => {
    setForm(f => ({ ...f, slot_ids: f.slot_ids.includes(id) ? f.slot_ids.filter(x => x !== id) : [...f.slot_ids, id] }));
  }

  const handleSave = async () => {
    if(!form.lab_id || !form.date || form.slot_ids.length === 0) {
      showToast("Preencha laboratório, data e ao menos um horário.", "error"); return;
    }
    setSaving(true);
    try {
      const payload = { lab_id: Number(form.lab_id), date: form.date, slot_ids: form.slot_ids.map(Number) };
      await reservationsApi.update(reservation.id, payload);
      showToast("Reserva atualizada com sucesso.", "success");
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao atualizar a reserva.", "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <h3 className="text-xl font-bold text-neutral-900">Editar Reserva #{reservation.id}</h3>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-6 space-y-5 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Nova Data</label>
              <div className="relative flex items-center bg-white border border-neutral-200 rounded-xl px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-neutral-300 transition-shadow">
                <CalendarDays size={16} className="text-neutral-400 shrink-0 mr-2" />
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="appearance-none bg-transparent text-neutral-800 text-sm font-bold focus:outline-none w-full cursor-pointer" />
              </div>
            </div>
            <div className="z-[70]">
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Laboratório</label>
              <CustomDropdown 
                value={form.lab_id} 
                options={labs?.map(l => ({ value: l.id, label: `${l.name} (${l.block})` })) || []} 
                onChange={v => setForm(f => ({ ...f, lab_id: v }))} 
                icon={Building2} 
                placeholder="Selecione..." 
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center justify-between">
              Horários
              <span className="bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md">{form.slot_ids.length} selecionado(s)</span>
            </label>
            <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-3">
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {slots?.map(s => (
                  <button key={s.id} onClick={() => toggleSlot(s.id)} className={`py-2 border rounded-xl text-xs font-bold transition-all active:scale-95 ${form.slot_ids.includes(s.id) ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900"}`}>
                    {s.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-neutral-200 font-bold text-sm text-neutral-600 hover:bg-neutral-100 transition-colors bg-white">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-neutral-900 text-white font-bold text-sm disabled:opacity-50 shadow-md hover:bg-neutral-800 transition-colors active:scale-[0.98]">
            {saving ? <LoadingSpinner label="" /> : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TimetableWizard ─────────────────────────────────────────────────────────

export function TimetableWizard({ onClose }: { onClose: () => void }) {
  const { showToast, ToastComponent } = useToast();
  const { data: labs, loading: labsLoading } = useFetch(labsApi.list);
  const { data: allReservations, loading: resLoading, refetch: refetchRes } = useFetch(reservationsApi.listAll, [], true);

  const [step, setStep]                             = useState(1);
  const [selectedBlock, setSelectedBlock]           = useState<string | null>(null);
  const [selectedLab, setSelectedLab]               = useState<Laboratory | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation]   = useState<Reservation | null>(null);

  const availableBlocks = useMemo(() => {
    if (!labs) return [];
    const blocks = new Set<string>();
    labs.forEach(l => { if (l.block) blocks.add(l.block); });
    return Array.from(blocks).sort();
  }, [labs]);

  const filteredLabs = useMemo(
    () => (labs || []).filter(l => l.block === selectedBlock),
    [labs, selectedBlock],
  );

  const confirmedStatuses = [
    ReservationStatus.APROVADO,
    ReservationStatus.EM_USO,
    ReservationStatus.AGUARDANDO_SOFTWARE,
    ReservationStatus.APROVADO_COM_RESSALVAS
  ];

  const weekReservations = useMemo(() => {
    if (!selectedLab || !allReservations) return [];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 5);
    return allReservations.filter(r => {
      if (r.lab_id !== selectedLab.id) return false;
      if (!confirmedStatuses.includes(r.status)) return false; 
      const rDate = new Date(r.date + "T00:00:00");
      return (rDate >= startOfWeek && rDate <= endOfWeek);
    });
  }, [allReservations, selectedLab]);

  const handleDelete = async (id: number) => {
    if(!confirm("Atenção: Tem certeza que deseja cancelar e excluir esta reserva?")) return;
    try {
      await reservationsApi.delete(id);
      showToast("Reserva cancelada com sucesso.", "success");
      setSelectedReservation(null);
      refetchRes();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao excluir.", "error");
    }
  };

  const gridMatrix = useMemo(() => {
    const matrix = TIME_SLOTS.map(() => WEEK_DAYS.map(() => ({
      res: null as Reservation | null,
      rowSpan: 1,
      skip: false
    })));

    if (!weekReservations.length) return matrix;

    TIME_SLOTS.forEach((slotCode, rIdx) => {
      WEEK_DAYS.forEach((day, cIdx) => {
         const res = weekReservations.find(r => {
            const rDay = new Date(r.date + "T00:00:00").getDay();
            return rDay === day.id && r.slots?.some(s => s.code === slotCode);
         });
         matrix[rIdx][cIdx].res = res || null;
      });
    });

    WEEK_DAYS.forEach((_, cIdx) => {
      let rIdx = 0;
      while (rIdx < TIME_SLOTS.length) {
        const currentRes = matrix[rIdx][cIdx].res;
        if (currentRes) {
          let span = 1;
          while (rIdx + span < TIME_SLOTS.length && matrix[rIdx + span][cIdx].res?.id === currentRes.id) {
            matrix[rIdx + span][cIdx].skip = true;
            span++;
          }
          matrix[rIdx][cIdx].rowSpan = span;
          rIdx += span;
        } else {
          rIdx++;
        }
      }
    });

    return matrix;
  }, [weekReservations]);

  return (
    <div className="space-y-6 pb-12">
      {ToastComponent}
      {editingReservation && (
        <EditReservationModal 
          reservation={editingReservation} 
          onClose={() => setEditingReservation(null)} 
          onSaved={() => { setEditingReservation(null); refetchRes(); }} 
        />
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-2"><CalendarDays /> Verificador de Grade</h2>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 font-bold px-4 py-2 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors">
          <X size={18} className="inline mr-1" /> Fechar
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-neutral-900">1. Selecione o Bloco</h3>
              <p className="text-neutral-500 text-sm mt-1">Escolha o bloco para ver os laboratórios disponíveis.</p>
            </div>
            {labsLoading ? <LoadingSpinner /> : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                {availableBlocks.map(b => (
                  <button key={b} onClick={() => { setSelectedBlock(b); setStep(2); }}
                    className="p-6 rounded-2xl border-2 border-neutral-100 hover:border-neutral-900 transition-all text-center group bg-neutral-50 hover:bg-white">
                    <Building2 size={32} className="mx-auto mb-3 text-neutral-300 group-hover:text-neutral-900 transition-colors" />
                    <span className="font-bold text-sm">{b}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 text-neutral-400 hover:text-neutral-900 font-bold text-sm mb-4">
              <ChevronLeft size={16} /> Voltar aos Blocos
            </button>
            <div className="text-center">
              <h3 className="text-xl font-bold text-neutral-900">2. Selecione o Laboratório ({selectedBlock})</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {filteredLabs.map(l => (
                <button key={l.id} onClick={() => { setSelectedLab(l); setStep(3); }}
                  className="p-4 rounded-xl border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg border border-neutral-100 shadow-sm"><Monitor size={20} className="text-blue-500" /></div>
                  <div>
                    <p className="font-bold text-sm text-neutral-800">{l.name}</p>
                    <p className="text-xs text-neutral-500">Sala {l.room_number}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && selectedLab && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 font-bold text-sm bg-white px-4 py-2 rounded-xl border border-neutral-200 w-fit shadow-sm transition-colors">
              <ChevronLeft size={16} /> Voltar aos Laboratórios
            </button>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
                <h3 className="font-bold text-base text-neutral-800">Grade Semanal: {selectedLab.name}</h3>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left min-w-[800px] border-collapse">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-2 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest w-12 text-center border-b border-neutral-200">Aula</th>
                      <th className="px-2 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest w-16 text-center border-b border-r border-neutral-200">Início</th>
                      {WEEK_DAYS.map(day => (
                        <th key={day.id} className="px-2 py-3 text-[11px] font-bold text-neutral-800 uppercase text-center border-l border-b border-neutral-200">{day.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resLoading ? (
                      <tr><td colSpan={8} className="p-12 text-center"><LoadingSpinner label="Buscando agendamentos..." /></td></tr>
                    ) : (
                      TIME_SLOTS.map((slotCode, rIdx) => (
                        <tr key={slotCode} className="hover:bg-neutral-50/30 transition-colors">
                          <td className="px-2 py-1.5 text-[10px] font-bold text-neutral-500 bg-neutral-50/50 border-b border-neutral-200 text-center">{slotCode}</td>
                          <td className="px-2 py-1.5 text-[10px] font-bold text-neutral-500 bg-neutral-50/50 border-r border-b border-neutral-200 text-center">{SLOT_TIMES[slotCode]}</td>
                          {WEEK_DAYS.map((day, cIdx) => {
                            const cell = gridMatrix[rIdx][cIdx];
                            if (cell.skip) return null;

                            if (cell.res) {
                              return (
                                <td key={`${day.id}-${slotCode}`} rowSpan={cell.rowSpan} className="border-l border-b border-neutral-200 p-1.5">
                                  <div onClick={() => setSelectedReservation(cell.res!)}
                                    className={`cursor-pointer h-full w-full p-3 rounded-xl border border-black/5 shadow-sm text-center transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-center items-center min-h-[48px] ${STATUS_STYLES[cell.res.status] || "bg-neutral-100"}`}
                                  >
                                    <p className="text-xs font-bold leading-tight w-full" title={cell.res.user?.full_name}>{cell.res.user?.full_name}</p>
                                    {cell.res.group_id && <p className="text-[10px] font-bold opacity-75 mt-1 uppercase tracking-widest"><Layers size={10} className="inline mr-0.5 -mt-0.5" /> Lote</p>}
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={`${day.id}-${slotCode}`} className="border-l border-b border-neutral-200 p-1.5">
                                <div className="h-full w-full min-h-[48px] rounded-xl border border-dashed border-transparent hover:border-neutral-300 transition-colors bg-transparent" />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detalhe da reserva na grade */}
      {selectedReservation && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md ring-1 ring-black/5 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2"><Info size={20} className="text-neutral-500" /> Detalhes da Aula</h3>
              <button onClick={() => setSelectedReservation(null)} className="text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 bg-white">
              <div className="space-y-3 bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                <div className="flex justify-between items-center"><span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Professor</span><span className="text-sm font-bold text-neutral-900">{selectedReservation.user?.full_name}</span></div>
                <div className="flex justify-between items-center"><span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Data</span><span className="text-sm font-bold text-neutral-900">{new Date(selectedReservation.date + "T12:00:00").toLocaleDateString("pt-BR")}</span></div>
                <div className="flex justify-between items-center"><span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Horários</span><span className="text-sm font-bold text-neutral-900">{selectedReservation.slots?.map(s => s.code).join(", ")}</span></div>
                <div className="flex justify-between items-center pt-3 border-t border-neutral-200/60"><span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Status</span><StatusBadge status={selectedReservation.status} /></div>
              </div>
            </div>
            <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
              <button onClick={() => { setEditingReservation(selectedReservation); setSelectedReservation(null); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-neutral-700 rounded-xl font-bold hover:bg-neutral-100 border border-neutral-200 transition-colors shadow-sm active:scale-95">
                <Edit size={16} /> Editar
              </button>
              <button onClick={() => handleDelete(selectedReservation.id)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 border border-red-100 transition-colors shadow-sm active:scale-95">
                <Trash2 size={16} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}