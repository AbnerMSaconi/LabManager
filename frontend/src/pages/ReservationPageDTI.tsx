/**
 * Tela de Reservas — visão do DTI (Técnico e Estagiário)
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  CheckCircle2, XCircle, Calendar, Layers,
  ChevronDown, ChevronUp, CalendarDays, Search,
  Eye, AlertTriangle, CheckCheck, X, Info, Monitor, MoreHorizontal,
  SortAsc, SortDesc, Building2, Check, Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserRole, ReservationStatus, Reservation, Software } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi, ReviewPayload } from "../api/reservationsApi";
import { maintenanceApi } from "../api/maintenanceApi";
import { labsApi } from "../api/labsApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { StatusBadge, WEEKDAY_NAMES, TimetableWizard, SoftwareBadge, MaterialsBadge } from "./reservationShared";
import { api, ApiError } from "../api/client";

const ITEMS_PER_PAGE = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isWeeklyCadence(dates: string[]): boolean {
  if (dates.length < 4) return false;
  const sorted = [...dates].sort();
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round(
      (new Date(sorted[i] + "T12:00:00").getTime() -
       new Date(sorted[i - 1] + "T12:00:00").getTime()) / 86_400_000
    );
    if (diff !== 7) return false;
  }
  return true;
}

function groupLabel(group: Reservation[]) {
  const dates = group.map(r => r.date);
  if (isWeeklyCadence(dates)) {
    const day = new Date(dates[0] + "T12:00:00").getDay();
    return { type: "semestral" as const, weekday: WEEKDAY_NAMES[day] };
  }
  return { type: "pontual" as const };
}

// ─── Dropdown Customizado ─────────────────────────────────────────────────────
function CustomDropdown({
  value, options, onChange, icon: Icon, prefix = "", placeholder = "Selecione"
}: {
  value: string | number; options: { value: string | number; label: string }[];
  onChange: (val: any) => void; icon: React.ElementType; prefix?: string; placeholder?: string;
}) {
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
    <div className="relative w-full sm:w-auto" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full sm:w-auto flex items-center justify-between gap-3 bg-white border border-neutral-200 py-2 px-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-all active:scale-[0.98] ${open ? "ring-2 ring-neutral-200" : "hover:bg-neutral-50"}`}
      >
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-neutral-500" />
          <span className="truncate max-w-[160px] text-left text-neutral-700">
            {selectedLabel ? <>{prefix}<span className="font-bold">{selectedLabel}</span></> : <span className="text-neutral-400">{placeholder}</span>}
          </span>
        </div>
        <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 w-full sm:min-w-[200px] mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] z-50 py-1.5">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm font-bold transition-colors flex items-center justify-between ${
                  String(value) === String(opt.value) ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
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

// ─── Componentes de Modal Compartilhados ──────────────────────────────────────
const ModalOverlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl shadow-2xl w-full max-w-md ring-1 ring-black/5 p-6 flex flex-col max-h-[90vh]"
      onClick={e => e.stopPropagation()}
    >
      {children}
    </motion.div>
  </motion.div>
);

function TextModal({ title, subtitle, placeholder, confirmLabel, confirmClass, icon, onConfirm, onClose, loading, required = true }: {
  title: string; subtitle: string; placeholder: string; confirmLabel: string; confirmClass: string; icon: React.ReactNode; onConfirm: (text: string) => void; onClose: () => void; loading: boolean; required?: boolean;
}) {
  const [text, setText] = useState("");
  const canSubmit = required ? text.trim().length > 0 : true;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">{icon}{title}</h3>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 mt-0.5"><X size={20} /></button>
      </div>
      <p className="text-sm text-neutral-600 mb-4">{subtitle}</p>
      <textarea
        value={text} onChange={e => setText(e.target.value)} rows={4} placeholder={placeholder}
        className="w-full border border-neutral-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300 mb-4"
      />
      <div className="flex gap-3 mt-auto">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">Cancelar</button>
        <button onClick={() => canSubmit && onConfirm(text.trim())} disabled={!canSubmit || loading} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-all ${confirmClass}`}>
          {loading ? "Aguarde…" : confirmLabel}
        </button>
      </div>
    </ModalOverlay>
  );
}

function SwModal({ labName, professor, softwares, onConfirm, onClose, loading }: {
  labName?: string; professor?: string; softwares?: string; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Monitor size={20} className="text-purple-500" /> Agendar Instalação</h3>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 mt-0.5"><X size={20} /></button>
      </div>
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-2 text-sm mb-4">
        <p><span className="font-bold text-purple-700">Laboratório:</span> {labName ?? "—"}</p>
        <p><span className="font-bold text-purple-700">Professor:</span> {professor ?? "—"}</p>
        <p><span className="font-bold text-purple-700">Softwares:</span> {softwares ?? "—"}</p>
      </div>
      <p className="text-sm text-neutral-600 mb-6">Um ticket de manutenção será criado e a reserva passará para <strong>Aguardando Software</strong> até a confirmação da instalação.</p>
      <div className="flex gap-3 mt-auto">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">Cancelar</button>
        <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-all">
          {loading ? "Criando ticket…" : "Confirmar Ticket"}
        </button>
      </div>
    </ModalOverlay>
  );
}

function ConfirmInstallModal({ 
  target, softwares, onClose, onConfirm, onSoftwareAdded
}: { 
  target: { id: number | string, requested: string, isGroup: boolean, labName: string }; 
  softwares: Software[]; onClose: () => void; onConfirm: (ids: number[]) => Promise<void>; onSoftwareAdded: () => void;
}) {
  const { showToast, ToastComponent } = useToast();
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [swSearch, setSwSearch] = useState("");
  
  const [swForm, setSwForm] = useState({ name: "", version: "" });
  const [savingSw, setSavingSw] = useState(false);

  const toggle = (id: number) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const filteredSoftwares = softwares.filter(sw => 
    sw.name.toLowerCase().includes(swSearch.toLowerCase()) || 
    (sw.version && sw.version.toLowerCase().includes(swSearch.toLowerCase()))
  );

  const handleCreateSoftware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swForm.name.trim()) return;
    setSavingSw(true);
    try {
      await api.post("/softwares", { name: swForm.name.trim(), version: swForm.version.trim() || undefined });
      showToast("Software cadastrado no catálogo.", "success");
      setSwForm({ name: "", version: "" });
      onSoftwareAdded();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao cadastrar software.", "error");
    } finally {
      setSavingSw(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {ToastComponent}
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }} className="bg-white rounded-3xl w-full max-w-4xl flex flex-col overflow-hidden shadow-2xl max-h-[90vh]">
        
        <div className="px-6 py-5 bg-blue-50/50 border-b border-blue-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-blue-900">Confirmar Instalação</h3>
            <p className="text-xs font-bold text-blue-700 mt-0.5 tracking-wide uppercase">{target.labName}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-blue-100/50 text-blue-500 hover:bg-blue-200 rounded-full transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white overflow-y-auto custom-scrollbar">
          
          <div className="space-y-5">
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">O professor solicitou:</p>
              <p className="text-sm font-bold text-amber-900">{target.requested || "Nenhum software específico detalhado."}</p>
            </div>
            
            <div>
              <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                Selecione o que foi instalado:
                <span className="bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">{selected.length} selecionado(s)</span>
              </p>
              
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Pesquisar no catálogo..."
                  value={swSearch}
                  onChange={e => setSwSearch(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm transition-shadow"
                />
              </div>

              <div className="max-h-[32vh] overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                {filteredSoftwares.map(sw => {
                  const sel = selected.includes(sw.id);
                  return (
                    <button key={sw.id} onClick={() => toggle(sw.id)} className={`px-3 py-2.5 rounded-xl text-left text-xs font-bold border transition-all flex items-start gap-2 ${sel ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"}`}>
                      <div className="mt-0.5 shrink-0">{sel ? <Check size={14} className="text-white"/> : <Monitor size={14} className="text-neutral-400"/>}</div>
                      <span className="leading-tight">{sw.name} {sw.version ? <span className="block text-[9px] font-medium opacity-70 mt-0.5">v.{sw.version}</span> : ""}</span>
                    </button>
                  )
                })}
              </div>
              {filteredSoftwares.length === 0 && <p className="text-xs font-bold text-neutral-400 text-center py-4">Nenhum software atende à busca.</p>}
            </div>
          </div>

          <div className="space-y-4 lg:border-l border-neutral-100 lg:pl-8">
             <div>
               <h3 className="font-black text-lg text-neutral-900">Novo Software</h3>
               <p className="text-xs font-medium text-neutral-500 mt-1 leading-relaxed">Adicione programas ao catálogo caso não os encontre na lista ao lado.</p>
             </div>
             
             <form onSubmit={handleCreateSoftware} className="space-y-4">
               <div>
                 <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Nome do Software *</label>
                 <input required value={swForm.name} onChange={e => setSwForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: AutoCAD" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow shadow-sm" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Versão / Ano (Opcional)</label>
                 <input value={swForm.version} onChange={e => setSwForm(f => ({ ...f, version: e.target.value }))} placeholder="Ex: 2024.1" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow shadow-sm" />
               </div>
               <button type="submit" disabled={savingSw} className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all shadow-md active:scale-[0.98] disabled:opacity-50">
                 {savingSw ? <LoadingSpinner label="" /> : "Registrar no Catálogo"}
               </button>
             </form>
          </div>

        </div>

        <div className="p-6 border-t border-neutral-100 flex gap-3 bg-neutral-50 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-all shadow-sm">Cancelar</button>
          <button onClick={async () => { setSaving(true); await onConfirm(selected); setSaving(false); }} disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95">
            {saving ? "Aguarde..." : "Concluir e Aprovar Aula"}
          </button>
        </div>

      </motion.div>
    </motion.div>
  )
}

// ─── Botões de Ações Rápidas (Inline) ───────────────────────────────────
function ActionPopover({
  status, hasSW, onApprove, onCaveats, onScheduleSW, onReject,
}: {
  status: ReservationStatus; hasSW: boolean;
  onApprove: () => void; onCaveats: () => void; onScheduleSW: () => void; onReject: () => void;
}) {
  if (status === ReservationStatus.PENDENTE) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button onClick={onApprove} title="Aprovar" className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200 shadow-sm active:scale-95">
          <CheckCircle2 size={16} strokeWidth={2.5} />
        </button>
        <button onClick={onCaveats} title="Aprovar com Ressalvas" className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all border border-amber-200 shadow-sm active:scale-95">
          <AlertTriangle size={16} strokeWidth={2.5} />
        </button>
        {hasSW && (
          <button onClick={onScheduleSW} title="Agendar Instalação de Software" className="p-2.5 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-600 hover:text-white transition-all border border-purple-200 shadow-sm active:scale-95">
            <Monitor size={16} strokeWidth={2.5} />
          </button>
        )}
        <button onClick={onReject} title="Rejeitar" className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-200 shadow-sm active:scale-95">
          <XCircle size={16} strokeWidth={2.5} />
        </button>
      </div>
    );
  }
  
  if (status === ReservationStatus.APROVADO_COM_RESSALVAS) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button onClick={onApprove} title="Confirmar Aprovação Definitiva" className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200 shadow-sm active:scale-95">
          <CheckCheck size={16} strokeWidth={2.5} />
        </button>
        <button onClick={onReject} title="Rejeitar" className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-200 shadow-sm active:scale-95">
          <XCircle size={16} strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return null;
}

// ─── Linhas da Tabela ────────────────────────────────────────────────────────
function SingleRow({
  r, canApprove, canInstallSW, onApprove, onCaveats, onScheduleSW, onConfirmSW, onReject,
}: {
  r: Reservation; canApprove: boolean; canInstallSW: boolean;
  onApprove: () => void; onCaveats: () => void; onScheduleSW: () => void; onConfirmSW: () => void; onReject: () => void;
}) {
  return (
    <tr className="hover:bg-neutral-50 transition-colors border-b border-neutral-100">
      <td className="px-4 py-4">
        <p className="font-bold text-sm text-neutral-900">{r.user?.full_name}</p>
        <p className="text-xs text-neutral-400 mt-0.5">#{r.id} · Avulsa</p>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-bold text-neutral-800">{r.laboratory?.name ?? "—"}</p>
        <p className="text-xs text-neutral-500">{r.laboratory?.block}</p>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-medium text-neutral-700 flex items-center gap-1.5"><CalendarDays size={13} className="text-neutral-400" />{new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" })}</p>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-bold text-neutral-700">{r.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          <MaterialsBadge items={r.items || []} />
          <SoftwareBadge softwares={r.requested_softwares} label={r.software_installation_required ? "Instalar SW" : "SW Solicitado"} />
        </div>
        {r.approval_notes && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1" title={r.approval_notes}><Info size={10} /> {r.approval_notes.length > 50 ? r.approval_notes.slice(0, 50) + "…" : r.approval_notes}</p>}
      </td>
      <td className="px-4 py-4"><StatusBadge status={r.status} /></td>
      
      <td className="px-4 py-4 text-right align-middle">
        {r.status === ReservationStatus.AGUARDANDO_SOFTWARE && canInstallSW ? (
          <button onClick={onConfirmSW} className="inline-flex whitespace-nowrap items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-md active:scale-95 ml-auto">
            <Download size={14} /> Concluir Instalação
          </button>
        ) : canApprove && (r.status === ReservationStatus.PENDENTE || r.status === ReservationStatus.APROVADO_COM_RESSALVAS) ? (
          <ActionPopover status={r.status} hasSW={!!r.requested_softwares && !!r.software_installation_required} onApprove={onApprove} onCaveats={onCaveats} onScheduleSW={onScheduleSW} onReject={onReject} />
        ) : r.status === ReservationStatus.PENDENTE && !canApprove ? (
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200 whitespace-nowrap">Em Avaliação</span>
        ) : null}
      </td>
    </tr>
  );
}

function GroupRow({
  group, canApprove, canInstallSW, onApprove, onCaveats, onScheduleSW, onConfirmSW, onReject,
}: {
  group: Reservation[]; canApprove: boolean; canInstallSW: boolean;
  onApprove: () => void; onCaveats: () => void; onScheduleSW: () => void; onConfirmSW: () => void; onReject: () => void;
}) {
  const [openDates, setOpenDates] = useState(false);
  const first = group[0];
  const { type, weekday } = groupLabel(group);
  const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <tr className="border-b border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
      <td className="px-4 py-4">
        <p className="font-bold text-sm text-neutral-900">{first.user?.full_name}</p>
        <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded border ${type === "semestral" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
          <Layers size={10} /> {type === "semestral" ? "SEMESTRAL" : "LOTE PONTUAL"} · {group.length} aulas
        </span>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-bold text-neutral-800">{first.laboratory?.name ?? "—"}</p>
        <p className="text-xs text-neutral-500">{first.laboratory?.block}</p>
      </td>
      <td className="px-4 py-4">
        {type === "semestral" ? (
          <div>
            <p className="text-sm font-bold text-neutral-700 flex items-center gap-1.5"><CalendarDays size={13} className="text-indigo-500" /> Toda {weekday}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{new Date(sorted[0].date + "T12:00:00").toLocaleDateString("pt-BR")} → {new Date(sorted[sorted.length - 1].date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
          </div>
        ) : (
          <>
            <button onClick={() => setOpenDates(true)} className="flex items-center gap-1.5 text-sm font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors">
              <CalendarDays size={13} /> {group.length} datas <ChevronDown size={13} />
            </button>
            <AnimatePresence>
              {openDates && (
                <ModalOverlay onClose={() => setOpenDates(false)}>
                  <div className="-mx-6 -mt-6 px-6 py-5 bg-neutral-50/50 border-b border-neutral-100 flex justify-between items-center mb-4 rounded-t-2xl">
                    <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><CalendarDays size={20} className="text-sky-500" /> Datas Solicitadas</h3>
                    <button onClick={() => setOpenDates(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  <div className="overflow-y-auto max-h-[50vh] custom-scrollbar space-y-2 flex-1 pr-1">
                    <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-1">Resumo do Lote</p>
                      <p className="text-sm font-bold text-sky-900">{group.length} aulas · Laboratório {first.laboratory?.name}</p>
                    </div>
                    {sorted.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-neutral-100 bg-neutral-50 hover:bg-neutral-100 transition-colors text-sm font-medium text-neutral-700">
                        <span className="flex items-center gap-2"><CalendarDays size={14} className="text-neutral-400" />{new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-neutral-100 mt-4 flex justify-end">
                    <button onClick={() => setOpenDates(false)} className="px-6 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-sm">Fechar</button>
                  </div>
                </ModalOverlay>
              )}
            </AnimatePresence>
          </>
        )}
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-bold text-neutral-700">{first.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          <MaterialsBadge items={first.items || []} />
          <SoftwareBadge softwares={first.requested_softwares} label={first.software_installation_required ? "Instalar SW" : "SW Solicitado"} />
        </div>
        {first.approval_notes && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1" title={first.approval_notes}><Info size={10} /> {first.approval_notes.length > 50 ? first.approval_notes.slice(0, 50) + "…" : first.approval_notes}</p>}
      </td>
      <td className="px-4 py-4"><StatusBadge status={first.status} /></td>
      
      <td className="px-4 py-4 text-right align-middle">
        {first.status === ReservationStatus.AGUARDANDO_SOFTWARE && canInstallSW ? (
          <button onClick={onConfirmSW} className="inline-flex whitespace-nowrap items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-md active:scale-95 ml-auto">
            <Download size={14} /> Concluir Instalação
          </button>
        ) : canApprove && (first.status === ReservationStatus.PENDENTE || first.status === ReservationStatus.APROVADO_COM_RESSALVAS) ? (
          <ActionPopover status={first.status} hasSW={!!first.requested_softwares && !!first.software_installation_required} onApprove={onApprove} onCaveats={onCaveats} onScheduleSW={onScheduleSW} onReject={onReject} />
        ) : first.status === ReservationStatus.PENDENTE && !canApprove ? (
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200 whitespace-nowrap">Em Avaliação</span>
        ) : null}
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "caveats";   id: number; groupId?: string }
  | { type: "reject";    id: number; groupId?: string }
  | { type: "sw"; id: number; groupId?: string; labId?: number; labName?: string; professor?: string; softwares?: string };

export function ReservationPageDTI() {
  const { user } = useAuth();
  
  const canApprove = user?.role === UserRole.DTI_TECNICO || user?.role === UserRole.ADMINISTRADOR || user?.role === UserRole.SUPER_ADMIN;
  const canInstallSW = canApprove || user?.role === UserRole.DTI_ESTAGIARIO;

  const { showToast, ToastComponent } = useToast();
  const { data, loading, error, refetch } = useFetch(reservationsApi.listAll, [], true);
  const { data: softwaresList, refetch: refetchSoftwares } = useFetch(labsApi.listSoftwares, [], true);

  const [filter, setFilter]             = useState<string>(ReservationStatus.PENDENTE);
  const [viewMode, setViewMode]         = useState<"list" | "timetable">("list");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [modal, setModal]               = useState<ModalState>({ type: "none" });
  const [busy, setBusy]                 = useState(false);
  const [conflictWarning, setConflict]  = useState<string | null>(null);
  const [sortOrder, setSortOrder]       = useState<"desc" | "asc">("desc");
  const [filterBlock, setFilterBlock]   = useState<string>("");
  const [filterLab, setFilterLab]       = useState<string>("");
  const [searchProf, setSearchProf]     = useState<string>("");
  const [installTarget, setInstallTarget] = useState<{ id: string | number, requested: string, isGroup: boolean, labName: string } | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = filter === "all"
      ? data.filter(r => r.status !== ReservationStatus.REJEITADO && r.status !== ReservationStatus.CANCELADO)
      : data.filter(r => r.status === filter);
    if (filterBlock) result = result.filter(r => r.laboratory?.block === filterBlock);
    if (filterLab)   result = result.filter(r => r.laboratory?.name  === filterLab);
    if (searchProf.trim()) {
      const q = searchProf.trim().toLowerCase();
      result = result.filter(r => r.user?.full_name?.toLowerCase().includes(q));
    }
    return result;
  }, [data, filter, filterBlock, filterLab, searchProf]);

  const { blockOptions, labOptions } = useMemo(() => {
    if (!data) return { blockOptions: [], labOptions: [] };
    let base = filter === "all"
      ? data.filter(r => r.status !== ReservationStatus.REJEITADO && r.status !== ReservationStatus.CANCELADO)
      : data.filter(r => r.status === filter);
    if (filterBlock) base = base.filter(r => r.laboratory?.block === filterBlock);
    const blocks = [...new Set(base.map(r => r.laboratory?.block).filter(Boolean))] as string[];
    const labs   = [...new Set(base.map(r => r.laboratory?.name).filter(Boolean))]  as string[];
    return { blockOptions: blocks.sort(), labOptions: labs.sort() };
  }, [data, filter, filterBlock]);

  const { allGroups, allSingles } = useMemo(() => {
    const grps: Record<string, Reservation[]> = {};
    const sgls: Reservation[] = [];
    filtered.forEach(r => {
      if (r.group_id) { grps[r.group_id] = grps[r.group_id] ?? []; grps[r.group_id].push(r); } 
      else { sgls.push(r); }
    });
    Object.values(grps).forEach(g => g.sort((a, b) => a.date.localeCompare(b.date)));
    return { allGroups: grps, allSingles: sgls };
  }, [filtered]);

  const units = useMemo(() => {
    const groupUnits = Object.keys(allGroups).map(id => ({ kind: "group" as const, id, _ts: allGroups[id].reduce((max, r) => r.created_at > max ? r.created_at : max, "") }));
    const singleUnits = allSingles.map(r => ({ kind: "single" as const, r, _ts: r.created_at }));
    const all = [...groupUnits, ...singleUnits];
    all.sort((a, b) => sortOrder === "desc" ? b._ts.localeCompare(a._ts) : a._ts.localeCompare(b._ts));
    return all;
  }, [allGroups, allSingles, sortOrder]);

  const visible = units.slice(0, visibleCount);
  const hasMore = visibleCount < units.length;

  const doReview = (payload: ReviewPayload, id?: number, gid?: string) => gid ? reservationsApi.reviewGroup(gid, payload) : reservationsApi.review(id!, payload);

  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true); setConflict(null);
    try { await fn(); showToast(msg, "success"); refetch(); setModal({ type: "none" }); }
    catch (e) {
      if (e instanceof ApiError && e.status === 409) { setConflict(e.message); setModal({ type: "none" }); } 
      else { showToast(e instanceof ApiError ? e.message : "Erro. Tente novamente.", "error"); }
    }
    finally { setBusy(false); }
  };

  const approve    = (id: number, gid?: string) => run(() => doReview({ status: ReservationStatus.APROVADO }, id, gid), "Reserva aprovada.");
  const submitCaveats = (notes: string) => { if (modal.type === "caveats") run(() => doReview({ status: ReservationStatus.APROVADO_COM_RESSALVAS, approval_notes: notes }, modal.id, modal.groupId), "Aprovado com ressalvas. O professor foi notificado."); };
  const submitReject = (reason: string) => { if (modal.type === "reject") run(() => doReview({ status: ReservationStatus.REJEITADO, rejection_reason: reason }, modal.id, modal.groupId), "Reserva rejeitada."); };

  const submitSW = () => {
    if (modal.type !== "sw") return;
    run(async () => {
      await maintenanceApi.create({
        title: `Instalação de Software — ${modal.labName ?? "Laboratório"}`,
        description: `Softwares solicitados: ${modal.softwares ?? "não especificado"}.\nProfessor: ${modal.professor ?? "—"}.\nReserva #${modal.id}${modal.groupId ? ` (Lote ${modal.groupId.slice(0, 8)}…)` : ""}.`,
        lab_id: modal.labId, severity: "medio",
      });
      await doReview({ status: ReservationStatus.AGUARDANDO_SOFTWARE }, modal.id, modal.groupId);
    }, "Ticket de instalação criado. Reserva aguardando software.");
  };

  const handleConfirmInstallation = async (software_ids: number[]) => {
    if (!installTarget) return;
    setBusy(true);
    try {
      if (installTarget.isGroup) {
        await reservationsApi.confirmGroupInstallation(String(installTarget.id), { software_ids });
      } else {
        await reservationsApi.confirmInstallation(Number(installTarget.id), { software_ids });
      }
      showToast("Instalação concluída e vinculada ao laboratório.", "success");
      setInstallTarget(null);
      refetch();
    } catch (e) { 
      showToast(e instanceof ApiError ? e.message : "Erro ao confirmar instalação.", "error"); 
    } finally {
      setBusy(false);
    }
  };

  if (viewMode === "timetable") return <TimetableWizard onClose={() => setViewMode("list")} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
      {ToastComponent}

      <AnimatePresence>
        {installTarget && (
          <ConfirmInstallModal 
            target={installTarget} 
            softwares={softwaresList ?? []} 
            onClose={() => setInstallTarget(null)} 
            onConfirm={handleConfirmInstallation} 
            onSoftwareAdded={refetchSoftwares}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal.type === "caveats" && <TextModal title="Aprovar com Ressalvas" subtitle="Descreva a ressalva — ela ficará visível ao professor no card da reserva." placeholder="Ex: Laboratório disponível a partir das 14h. Aguarde confirmação do técnico." confirmLabel="Confirmar Aprovação" confirmClass="bg-amber-500 hover:bg-amber-600" icon={<AlertTriangle size={20} className="text-amber-500" />} onConfirm={submitCaveats} onClose={() => setModal({ type: "none" })} loading={busy} />}
        {modal.type === "reject" && <TextModal title={modal.groupId ? "Rejeitar Lote" : "Rejeitar Reserva"} subtitle="Informe o motivo da rejeição — ele será exibido ao professor." placeholder="Ex: Laboratório indisponível no período solicitado." confirmLabel="Confirmar Rejeição" confirmClass="bg-red-500 hover:bg-red-600" icon={<XCircle size={20} className="text-red-500" />} onConfirm={submitReject} onClose={() => setModal({ type: "none" })} loading={busy} />}
        {modal.type === "sw" && <SwModal labName={modal.labName} professor={modal.professor} softwares={modal.softwares} onConfirm={submitSW} onClose={() => setModal({ type: "none" })} loading={busy} />}
      </AnimatePresence>

      <AnimatePresence>
        {conflictWarning && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 overflow-hidden">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-800">Conflito de Agenda Detectado</p>
              <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{conflictWarning}</p>
            </div>
            <button onClick={() => setConflict(null)} className="text-red-400 hover:text-red-700 shrink-0 mt-0.5"><X size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">{canApprove ? "Gerenciar Solicitações" : "Solicitações de Reserva"}</h2>
          <p className="text-sm text-neutral-500 mt-1">{canApprove ? "Aprove, rejeite e acompanhe os agendamentos. Ações disponíveis em cada linha." : "Visualize as solicitações de reserva em andamento."}</p>
        </div>
        <button onClick={() => setViewMode("timetable")} className="bg-white border border-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-50 transition-colors shadow-sm self-start">
          <Search size={18} /> Verificar Grade
        </button>
      </header>

      {!canApprove && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3">
          <Eye size={18} className="text-blue-500 shrink-0" />
          <p className="text-sm font-medium text-blue-700">Modo Estagiário: Você não possui permissão para aprovar ou rejeitar reservas, mas <span className="font-bold">pode concluir instalações de software</span>.</p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { value: ReservationStatus.PENDENTE,               label: "Pendentes" },
          { value: ReservationStatus.AGUARDANDO_SOFTWARE,    label: "Aguard. Software" },
          { value: ReservationStatus.APROVADO_COM_RESSALVAS, label: "Com Ressalvas" },
          { value: "all",                                    label: "Todas Ativas" },
          { value: ReservationStatus.APROVADO,               label: "Aprovadas" },
        ].map(s => (
          <button key={s.value} onClick={() => { setFilter(s.value); setFilterBlock(""); setFilterLab(""); setVisibleCount(ITEMS_PER_PAGE); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${filter === s.value ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Barra de filtros avançados ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input type="text" value={searchProf} onChange={e => { setSearchProf(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }} placeholder="Buscar professor…" className="w-full pl-8 pr-3 py-2 text-sm font-medium border border-neutral-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300 placeholder:text-neutral-400 shadow-sm transition-shadow" />
        </div>

        <CustomDropdown 
          value={filterBlock} 
          options={[{ value: "", label: "Todos os blocos" }, ...blockOptions.map(b => ({ value: b, label: b }))]} 
          onChange={v => { setFilterBlock(v); setFilterLab(""); setVisibleCount(ITEMS_PER_PAGE); }} 
          icon={Building2} 
          placeholder="Bloco" 
        />
        <CustomDropdown 
          value={filterLab} 
          options={[{ value: "", label: "Todos os laboratórios" }, ...labOptions.map(l => ({ value: l, label: l }))]} 
          onChange={v => { setFilterLab(v); setVisibleCount(ITEMS_PER_PAGE); }} 
          icon={Monitor} 
          placeholder="Laboratório" 
        />

        <button onClick={() => { setSortOrder(v => v === "desc" ? "asc" : "desc"); setVisibleCount(ITEMS_PER_PAGE); }} title={sortOrder === "desc" ? "Mais recente primeiro" : "Mais antigo primeiro"} className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold border border-neutral-200 rounded-xl bg-white text-neutral-700 hover:bg-neutral-50 shadow-sm transition-all active:scale-[0.98] whitespace-nowrap">
          {sortOrder === "desc" ? <SortDesc size={15} /> : <SortAsc size={15} />}
          {sortOrder === "desc" ? "Mais recente" : "Mais antigo"}
        </button>

        {(filterBlock || filterLab || searchProf) && (
          <button onClick={() => { setFilterBlock(""); setFilterLab(""); setSearchProf(""); setVisibleCount(ITEMS_PER_PAGE); }} className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold border border-red-200 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {/* ── Tabela ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {loading && <LoadingSpinner label="Carregando reservas…" />}
        {error   && <ErrorMessage message={error} onRetry={refetch} />}

        {!loading && !error && (
          units.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Calendar className="mx-auto text-neutral-200" size={56} />
              <p className="text-neutral-500 font-medium">Nenhuma reserva encontrada para este filtro.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Professor</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Laboratório</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Data / Período</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Horários</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right w-48">
                      {canInstallSW ? "Ações" : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(unit => {
                    if (unit.kind === "group") {
                      const group = allGroups[unit.id];
                      const first = group[0];
                      return (
                        <GroupRow key={unit.id} group={group} canApprove={canApprove} canInstallSW={canInstallSW}
                          onApprove={() => approve(first.id, unit.id)}
                          onCaveats={() => setModal({ type: "caveats", id: first.id, groupId: unit.id })}
                          onScheduleSW={() => setModal({ type: "sw", id: first.id, groupId: unit.id,
                            labId: first.lab_id, labName: first.laboratory?.name,
                            professor: first.user?.full_name, softwares: first.requested_softwares ?? undefined })}
                          onConfirmSW={() => setInstallTarget({ id: first.group_id as string, isGroup: true, requested: first.requested_softwares || "", labName: first.laboratory?.name || "Laboratório" })}
                          onReject={() => setModal({ type: "reject", id: first.id, groupId: unit.id })}
                        />
                      );
                    }
                    const r = unit.r;
                    return (
                      <SingleRow key={r.id} r={r} canApprove={canApprove} canInstallSW={canInstallSW}
                        onApprove={() => approve(r.id)}
                        onCaveats={() => setModal({ type: "caveats", id: r.id })}
                        onScheduleSW={() => setModal({ type: "sw", id: r.id,
                          labId: r.lab_id, labName: r.laboratory?.name,
                          professor: r.user?.full_name, softwares: r.requested_softwares ?? undefined })}
                        onConfirmSW={() => setInstallTarget({ id: r.id, isGroup: false, requested: r.requested_softwares || "", labName: r.laboratory?.name || "Laboratório" })}
                        onReject={() => setModal({ type: "reject", id: r.id })}
                      />
                    );
                  })}
                </tbody>
              </table>

              <div className="px-4 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <span className="text-sm text-neutral-500 flex items-center gap-2">
                  <Layers size={15} />
                  {visible.length} de {units.length} registros
                  {units.length !== filtered.length && (
                    <span className="text-neutral-400 text-xs">({filtered.length} reservas individuais)</span>
                  )}
                </span>
                {hasMore && (
                  <button onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)}
                    className="px-5 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-colors">
                    Carregar mais
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </motion.div>
  );
}