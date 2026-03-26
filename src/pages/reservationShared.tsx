/**
 * Shared constants, types and components used across reservation pages.
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Monitor, CalendarDays, Building2, Layers, ChevronLeft, ChevronDown,
  Info, XCircle, Edit, Trash2, X, Package,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ReservationStatus, Reservation, Laboratory, ReservationItem } from "../types";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi } from "../api/reservationsApi";
import { labsApi } from "../api/labsApi";
import { LoadingSpinner, useToast } from "../components/ui";

// ─── Constants ───────────────────────────────────────────────────────────────

export const STATUS_STYLES: Record<string, string> = {
  [ReservationStatus.APROVADO]:            "bg-emerald-100 text-emerald-700 border-emerald-200",
  [ReservationStatus.PENDENTE]:            "bg-amber-100 text-amber-700 border-amber-200",
  [ReservationStatus.REJEITADO]:           "bg-red-100 text-red-700 border-red-200",
  [ReservationStatus.EM_USO]:              "bg-blue-100 text-blue-700 border-blue-200",
  [ReservationStatus.CONCLUIDO]:           "bg-neutral-100 text-neutral-500 border-neutral-200",
  [ReservationStatus.AGUARDANDO_SOFTWARE]: "bg-purple-100 text-purple-700 border-purple-200",
  [ReservationStatus.CANCELADO]:           "bg-neutral-100 text-neutral-400 border-neutral-200",
};

export const TIME_SLOTS = [
  "M1","M2","M3","M4","M5","M6",
  "T1","T2","T3","T4","T5","T6",
  "N1","N2","N3","N4",
];

export const WEEK_DAYS = [
  { id: 1, label: "Segunda" }, { id: 2, label: "Terça" }, { id: 3, label: "Quarta" },
  { id: 4, label: "Quinta" }, { id: 5, label: "Sexta" }, { id: 6, label: "Sábado" },
];

export const WEEKDAY_NAMES = [
  "Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado",
];

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── SoftwareBadge ───────────────────────────────────────────────────────────

export function SoftwareBadge({ softwares, label = "Software" }: { softwares: string; label?: string }) {
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

  const list = softwares.split(",").map(s => s.trim()).filter(Boolean);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="flex items-center gap-0.5 text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
      >
        {label} <ChevronDown size={9} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden min-w-[160px]">
          <div className="bg-purple-50 border-b border-purple-100 px-3 py-2 text-[10px] font-bold text-purple-700 uppercase tracking-widest">
            Softwares ({list.length})
          </div>
          <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">
            {list.map((sw, i) => (
              <div key={i} className="px-3 py-2 text-xs font-medium text-neutral-700 flex items-center gap-2 hover:bg-neutral-50">
                <Monitor size={11} className="text-purple-400 flex-shrink-0" />
                {sw}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MaterialsBadge ──────────────────────────────────────────────────────────

export function MaterialsBadge({ items }: { items: ReservationItem[] }) {
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

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="flex items-center gap-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
      >
        Materiais <ChevronDown size={9} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
          <div className="bg-amber-50 border-b border-amber-100 px-3 py-2 text-[10px] font-bold text-amber-700 uppercase tracking-widest">
            Materiais ({items.length})
          </div>
          <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">
            {items.map(item => (
              <div key={item.id} className="px-3 py-2 text-xs font-medium text-neutral-700 flex items-center justify-between gap-3 hover:bg-neutral-50">
                <span className="flex items-center gap-2">
                  <Package size={11} className="text-amber-400 flex-shrink-0" />
                  {item.model?.name ?? `Item #${item.item_model_id}`}
                </span>
                <span className="text-neutral-400 font-bold">x{item.quantity_requested}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TimetableWizard ─────────────────────────────────────────────────────────

export function TimetableWizard({ onClose }: { onClose: () => void }) {
  const { showToast, ToastComponent } = useToast();
  const { data: labs, loading: labsLoading } = useFetch(labsApi.list);
  const { data: allReservations, loading: resLoading } = useFetch(reservationsApi.listAll, [], true);

  const [step, setStep]                             = useState(1);
  const [selectedBlock, setSelectedBlock]           = useState<string | null>(null);
  const [selectedLab, setSelectedLab]               = useState<Laboratory | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

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

  const weekReservations = useMemo(() => {
    if (!selectedLab || !allReservations) return [];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 5);
    return allReservations.filter(r => {
      if (r.lab_id !== selectedLab.id) return false;
      const rDate = new Date(r.date + "T00:00:00");
      return (
        rDate >= startOfWeek &&
        rDate <= endOfWeek &&
        r.status !== ReservationStatus.REJEITADO &&
        r.status !== ReservationStatus.CANCELADO
      );
    });
  }, [allReservations, selectedLab]);

  return (
    <div className="space-y-6 pb-12">
      {ToastComponent}

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
            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 font-bold text-sm bg-white px-4 py-2 rounded-xl border border-neutral-200 w-fit shadow-sm">
              <ChevronLeft size={16} /> Voltar aos Laboratórios
            </button>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-neutral-100 bg-neutral-50">
                <h3 className="font-bold text-lg text-neutral-800">Grade Semanal: {selectedLab.name}</h3>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-white border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest w-20 text-center">Horário</th>
                      {WEEK_DAYS.map(day => (
                        <th key={day.id} className="px-4 py-4 text-xs font-bold text-neutral-800 uppercase text-center border-l border-neutral-100">{day.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {resLoading ? (
                      <tr><td colSpan={7} className="p-12 text-center"><LoadingSpinner label="Buscando agendamentos..." /></td></tr>
                    ) : (
                      TIME_SLOTS.map(slotCode => (
                        <tr key={slotCode} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-neutral-500 bg-neutral-50/50 border-r border-neutral-100 text-center">{slotCode}</td>
                          {WEEK_DAYS.map(day => {
                            const res = weekReservations.find(r => {
                              const rDay = new Date(r.date + "T00:00:00").getDay();
                              return rDay === day.id && r.slots?.some(s => s.code === slotCode);
                            });
                            return (
                              <td key={`${day.id}-${slotCode}`} className="border-l border-neutral-100 p-1.5">
                                {res ? (
                                  <div onClick={() => setSelectedReservation(res)}
                                    className={`cursor-pointer h-full p-2.5 rounded-xl border text-center transition-all hover:shadow-md ${STATUS_STYLES[res.status] || "bg-neutral-100"}`}>
                                    <p className="text-[11px] font-bold truncate leading-tight" title={res.user?.full_name}>{res.user?.full_name}</p>
                                    {res.group_id && <p className="text-[9px] font-bold opacity-70 mt-1 uppercase tracking-widest"><Layers size={10} className="inline mr-0.5 -mt-0.5" /> Lote</p>}
                                  </div>
                                ) : (
                                  <div className="h-full w-full min-h-[48px] rounded-xl border border-dashed border-transparent hover:border-neutral-200 transition-colors bg-transparent" />
                                )}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md ring-1 ring-black/5 p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Info size={20} className="text-neutral-400" /> Detalhes</h3>
              <button onClick={() => setSelectedReservation(null)} className="text-neutral-400 hover:text-neutral-900"><XCircle size={24} /></button>
            </div>
            <div className="space-y-3 bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-neutral-400 uppercase">Professor</span><span className="text-sm font-bold text-neutral-900">{selectedReservation.user?.full_name}</span></div>
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-neutral-400 uppercase">Data</span><span className="text-sm font-bold text-neutral-900">{new Date(selectedReservation.date + "T12:00:00").toLocaleDateString("pt-BR")}</span></div>
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-neutral-400 uppercase">Horários</span><span className="text-sm font-bold text-neutral-900">{selectedReservation.slots?.map(s => s.code).join(", ")}</span></div>
              <div className="flex justify-between items-center pt-2 border-t border-neutral-100"><span className="text-xs font-bold text-neutral-400 uppercase">Status</span><StatusBadge status={selectedReservation.status} /></div>
            </div>
            <div className="pt-2 flex gap-3">
              <button onClick={() => { showToast("Rota de edição será conectada na próxima atualização", "info"); setSelectedReservation(null); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 border border-neutral-200">
                <Edit size={16} /> Editar
              </button>
              <button onClick={() => { showToast("Rota de exclusão será conectada na próxima atualização", "info"); setSelectedReservation(null); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 border border-red-100">
                <Trash2 size={16} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
