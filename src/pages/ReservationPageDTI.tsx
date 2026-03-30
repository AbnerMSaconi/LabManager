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
import { UserRole, ReservationStatus, Reservation, Software } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi, ReviewPayload } from "../api/reservationsApi";
import { maintenanceApi } from "../api/maintenanceApi";
import { labsApi } from "../api/labsApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { StatusBadge, WEEKDAY_NAMES, TimetableWizard, SoftwareBadge, MaterialsBadge } from "./reservationShared";
import { ApiError } from "../api/client";

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

// ─── Modal genérico de texto ──────────────────────────────────────────────────
function TextModal({
  title, subtitle, placeholder, confirmLabel, confirmClass, icon, onConfirm, onClose, loading, required = true,
}: {
  title: string; subtitle: string; placeholder: string; confirmLabel: string; confirmClass: string;
  icon: React.ReactNode; onConfirm: (text: string) => void; onClose: () => void; loading: boolean; required?: boolean;
}) {
  const [text, setText] = useState("");
  const canSubmit = required ? text.trim().length > 0 : true;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md ring-1 ring-black/5 p-6 space-y-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">{icon}{title}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 mt-0.5"><X size={20} /></button>
        </div>
        <p className="text-sm text-neutral-600">{subtitle}</p>
        <textarea
          value={text} onChange={e => setText(e.target.value)} rows={4} placeholder={placeholder}
          className="w-full border border-neutral-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300"
        />
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50">Cancelar</button>
          <button onClick={() => canSubmit && onConfirm(text.trim())} disabled={!canSubmit || loading} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${confirmClass}`}>
            {loading ? "Aguarde…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de agendamento de software ────────────────────────────────────────
function SwModal({
  labName, professor, softwares, onConfirm, onClose, loading,
}: {
  labName?: string; professor?: string; softwares?: string; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md ring-1 ring-black/5 p-6 space-y-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Monitor size={20} className="text-purple-500" /> Agendar Instalação de Software</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 mt-0.5"><X size={20} /></button>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-2 text-sm">
          <p><span className="font-bold text-purple-700">Laboratório:</span> {labName ?? "—"}</p>
          <p><span className="font-bold text-purple-700">Professor:</span> {professor ?? "—"}</p>
          <p><span className="font-bold text-purple-700">Softwares:</span> {softwares ?? "—"}</p>
        </div>
        <p className="text-sm text-neutral-600">Um ticket de manutenção será criado e a reserva passará para <strong>Aguardando Software</strong> até a confirmação da instalação.</p>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50">Cancelar</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
            {loading ? "Criando ticket…" : "Confirmar e Criar Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Confirmação de Instalação (Catálogo) ───────────────────────────
function ConfirmInstallModal({ 
  target, softwares, onClose, onConfirm 
}: { 
  target: { id: number | string, requested: string, isGroup: boolean, labName: string }; 
  softwares: Software[]; onClose: () => void; onConfirm: (ids: number[]) => Promise<void> 
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const toggle = (id: number) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl">
        <div className="px-6 py-5 bg-blue-50/50 border-b border-blue-100 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-blue-900">Confirmar Instalação</h3>
            <p className="text-xs font-bold text-blue-700 mt-0.5 tracking-wide uppercase">{target.labName}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-blue-100/50 text-blue-500 hover:bg-blue-200 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-5 bg-white">
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">O professor solicitou:</p>
            <p className="text-sm font-bold text-amber-900">{target.requested || "Nenhum software específico detalhado."}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-3">O que foi instalado e homologado no laboratório?</p>
            <div className="max-h-56 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-2 pr-1">
              {softwares.map(sw => {
                const sel = selected.includes(sw.id);
                return (
                  <button key={sw.id} onClick={() => toggle(sw.id)} className={`px-3 py-2.5 rounded-xl text-left text-xs font-bold border transition-all flex items-start gap-2 ${sel ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-400 hover:bg-white"}`}>
                    <div className="mt-0.5 shrink-0">{sel ? <Check size={14} className="text-white"/> : <Monitor size={14} className="text-neutral-400"/>}</div>
                    <span className="leading-tight">{sw.name} {sw.version ? <span className="block text-[9px] font-medium opacity-70 mt-0.5">v.{sw.version}</span> : ""}</span>
                  </button>
                )
              })}
            </div>
            {softwares.length === 0 && <p className="text-xs font-bold text-neutral-400 text-center">Nenhum software cadastrado no catálogo do sistema.</p>}
          </div>
        </div>
        <div className="p-6 border-t border-neutral-100 flex gap-3 bg-neutral-50">
          <button onClick={onClose} className="flex-1 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-all shadow-sm">Cancelar</button>
          <button onClick={async () => { setSaving(true); await onConfirm(selected); setSaving(false); }} disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95">
            {saving ? "Aguarde..." : "Concluir e Aprovar Aula"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Popover de ações (Apenas para aprovação/rejeição) ───────────────────────
const ACTION_COLORS: Record<string, string> = {
  emerald: "text-emerald-700 hover:bg-emerald-50", amber: "text-amber-700 hover:bg-amber-50",
  purple: "text-purple-700 hover:bg-purple-50", red: "text-red-600 hover:bg-red-50", blue: "text-blue-700 hover:bg-blue-50",
};

type ActionItem = { label: string; Icon: React.ElementType; color: string; onClick: () => void; };

function ActionPopover({
  status, hasSW, onApprove, onCaveats, onScheduleSW, onReject,
}: {
  status: ReservationStatus; hasSW: boolean;
  onApprove: () => void; onCaveats: () => void; onScheduleSW: () => void; onReject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const actions: ActionItem[] = [];

  if (status === ReservationStatus.PENDENTE) {
    actions.push({ label: "Aprovar", Icon: CheckCircle2, color: "emerald", onClick: onApprove });
    actions.push({ label: "Aprovar com Ressalvas", Icon: AlertTriangle, color: "amber", onClick: onCaveats });
    if (hasSW) actions.push({ label: "Agendar Software", Icon: Monitor, color: "purple", onClick: onScheduleSW });
    actions.push({ label: "Rejeitar", Icon: XCircle, color: "red", onClick: onReject });
  } else if (status === ReservationStatus.APROVADO_COM_RESSALVAS) {
    actions.push({ label: "Confirmar Aprovação", Icon: CheckCheck, color: "emerald", onClick: onApprove });
    actions.push({ label: "Rejeitar", Icon: XCircle, color: "red", onClick: onReject });
  }

  if (actions.length === 0) return null;

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${open ? "bg-neutral-900 text-white border-neutral-900" : "bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200"}`}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden w-52">
          <div className="py-1">
            {actions.map(({ label, Icon, color, onClick }) => (
              <button key={label} onClick={() => { onClick(); setOpen(false); }} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-left transition-colors ${ACTION_COLORS[color]}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Linha avulsa ─────────────────────────────────────────────────────────────
function SingleRow({
  r, canApprove, onApprove, onCaveats, onScheduleSW, onConfirmSW, onReject,
}: {
  r: Reservation; canApprove: boolean;
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
          {r.items && r.items.length > 0 && <MaterialsBadge items={r.items} />}
          {r.requested_softwares && <SoftwareBadge softwares={r.requested_softwares} label={r.software_installation_required ? "Instalar SW" : "SW Solicitado"} />}
        </div>
        {r.approval_notes && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1" title={r.approval_notes}><Info size={10} /> {r.approval_notes.length > 50 ? r.approval_notes.slice(0, 50) + "…" : r.approval_notes}</p>}
      </td>
      <td className="px-4 py-4"><StatusBadge status={r.status} /></td>
      
      <td className="px-4 py-4 text-right align-middle">
        {/* Aqui garantimos que o botão azul aparece 100% das vezes que for AGUARDANDO SOFTWARE nesta tela */}
        {r.status === ReservationStatus.AGUARDANDO_SOFTWARE ? (
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

// ─── Linha de lote ─────────────────────────────────────────────────────────────
function GroupRow({
  group, canApprove, onApprove, onCaveats, onScheduleSW, onConfirmSW, onReject,
}: {
  group: Reservation[]; canApprove: boolean;
  onApprove: () => void; onCaveats: () => void; onScheduleSW: () => void; onConfirmSW: () => void; onReject: () => void;
}) {
  const [open, setOpen] = useState(false);
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
          <div className="relative">
            <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 text-sm font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors">
              <CalendarDays size={13} /> {group.length} datas {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {open && (
              <div className="absolute top-full left-0 z-30 mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl w-64">
                <div className="bg-neutral-50 border-b border-neutral-100 px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Todas as datas ({group.length})</div>
                <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
                  {sorted.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-neutral-50 text-xs font-medium text-neutral-700">
                      <span>{new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-bold text-neutral-700">{first.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          {first.items && first.items.length > 0 && <MaterialsBadge items={first.items} />}
          {first.requested_softwares && <SoftwareBadge softwares={first.requested_softwares} label={first.software_installation_required ? "Instalar SW" : "SW Solicitado"} />}
        </div>
        {first.approval_notes && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1" title={first.approval_notes}><Info size={10} /> {first.approval_notes.length > 50 ? first.approval_notes.slice(0, 50) + "…" : first.approval_notes}</p>}
      </td>
      <td className="px-4 py-4"><StatusBadge status={first.status} /></td>
      
      <td className="px-4 py-4 text-right align-middle">
        {/* A mesma trava direta e garantida para os lotes */}
        {first.status === ReservationStatus.AGUARDANDO_SOFTWARE ? (
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
  
  // DTI_ESTAGIARIO não aprova.
  const canApprove = user?.role === UserRole.DTI_TECNICO || user?.role === UserRole.ADMINISTRADOR || user?.role === UserRole.SUPER_ADMIN;

  const { showToast, ToastComponent } = useToast();
  const { data, loading, error, refetch } = useFetch(reservationsApi.listAll, [], true);
  const { data: softwaresList } = useFetch(labsApi.listSoftwares, [], true);

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
    <div className="space-y-6 pb-12">
      {ToastComponent}

      {installTarget && (
        <ConfirmInstallModal 
          target={installTarget} 
          softwares={softwaresList ?? []} 
          onClose={() => setInstallTarget(null)} 
          onConfirm={handleConfirmInstallation} 
        />
      )}

      {modal.type === "caveats" && <TextModal title="Aprovar com Ressalvas" subtitle="Descreva a ressalva — ela ficará visível ao professor no card da reserva." placeholder="Ex: Laboratório disponível a partir das 14h. Aguarde confirmação do técnico." confirmLabel="Confirmar Aprovação" confirmClass="bg-amber-500 hover:bg-amber-600" icon={<AlertTriangle size={20} className="text-amber-500" />} onConfirm={submitCaveats} onClose={() => setModal({ type: "none" })} loading={busy} />}
      {modal.type === "reject" && <TextModal title={modal.groupId ? "Rejeitar Lote" : "Rejeitar Reserva"} subtitle="Informe o motivo da rejeição — ele será exibido ao professor." placeholder="Ex: Laboratório indisponível no período solicitado." confirmLabel="Confirmar Rejeição" confirmClass="bg-red-500 hover:bg-red-600" icon={<XCircle size={20} className="text-red-500" />} onConfirm={submitReject} onClose={() => setModal({ type: "none" })} loading={busy} />}
      {modal.type === "sw" && <SwModal labName={modal.labName} professor={modal.professor} softwares={modal.softwares} onConfirm={submitSW} onClose={() => setModal({ type: "none" })} loading={busy} />}

      {conflictWarning && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">Conflito de Agenda Detectado</p>
            <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{conflictWarning}</p>
          </div>
          <button onClick={() => setConflict(null)} className="text-red-400 hover:text-red-700 shrink-0 mt-0.5"><X size={18} /></button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">{canApprove ? "Gerenciar Solicitações" : "Solicitações de Reserva"}</h2>
          <p className="text-sm text-neutral-500 mt-1">{canApprove ? "Aprove, rejeite e acompanhe os agendamentos. Ações disponíveis em cada linha." : "Visualize as solicitações de reserva em andamento."}</p>
        </div>
        <button onClick={() => setViewMode("timetable")} className="bg-white border border-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-50 transition-colors shadow-sm self-start">
          <Search size={18} /> Verificar Grade
        </button>
      </div>

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
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(unit => {
                    if (unit.kind === "group") {
                      const group = allGroups[unit.id];
                      const first = group[0];
                      return (
                        <GroupRow key={unit.id} group={group} canApprove={canApprove}
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
                      <SingleRow key={r.id} r={r} canApprove={canApprove}
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
    </div>
  );
}