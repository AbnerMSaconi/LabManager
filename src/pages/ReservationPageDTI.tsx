/**
 * Tela de Reservas — visão do DTI (Técnico e Estagiário)
 *
 * DTI_TECNICO — ações disponíveis:
 *   PENDENTE              → Aprovar | Aprovar com Ressalvas | Agendar Software | Rejeitar
 *   APROVADO_COM_RESSALVAS → Aprovar (definitivo)
 *   AGUARDANDO_SOFTWARE   → Confirmar Instalação de Software
 *
 * DTI_ESTAGIARIO — somente leitura (banner informativo)
 */
import React, { useState, useMemo } from "react";
import {
  CheckCircle2, XCircle, Calendar, Layers, ChevronDown, ChevronUp,
  CalendarDays, Search, Building2, Monitor, Eye, AlertTriangle,
  Download, SoftwareIcon, Wrench, CheckCheck, X, Info,
} from "lucide-react";
import { Monitor as MonitorIcon } from "lucide-react";
import { UserRole, ReservationStatus, Reservation } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi, ReviewPayload } from "../api/reservationsApi";
import { maintenanceApi } from "../api/maintenanceApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { StatusBadge, WEEKDAY_NAMES, TimetableWizard } from "./reservationShared";
import { ApiError } from "../api/client";

const ITEMS_PER_PAGE = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detecta se as datas de um lote formam cadência semanal (diferença de 7 dias entre todas). */
function isWeeklyCadence(dates: string[]): boolean {
  if (dates.length < 4) return false;
  const sorted = [...dates].sort();
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T12:00:00").getTime();
    const curr = new Date(sorted[i]     + "T12:00:00").getTime();
    const diffDays = Math.round((curr - prev) / 86_400_000);
    if (diffDays !== 7) return false;
  }
  return true;
}

function groupLabel(group: Reservation[]): { type: "semestral" | "pontual"; weekday?: string } {
  const dates = group.map(r => r.date);
  if (isWeeklyCadence(dates)) {
    const day = new Date(dates[0] + "T12:00:00").getDay();
    return { type: "semestral", weekday: WEEKDAY_NAMES[day] };
  }
  return { type: "pontual" };
}

// ─── Modal: Aprovar com Ressalvas ─────────────────────────────────────────────

function CaveatsModal({
  onConfirm, onClose, loading,
}: {
  onConfirm: (notes: string) => void;
  onClose:   () => void;
  loading:   boolean;
}) {
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md ring-1 ring-black/5 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" /> Aprovar com Ressalvas
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X size={20} /></button>
        </div>
        <p className="text-sm text-neutral-600">
          Descreva a ressalva que será visível ao professor na tela de reservas.
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          placeholder="Ex: O laboratório estará disponível a partir das 14h. Aguarde confirmação do técnico responsável."
          className="w-full border border-neutral-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => { if (notes.trim()) onConfirm(notes.trim()); }}
            disabled={!notes.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Enviando…" : "Aprovar com Ressalvas"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Rejeitar ─────────────────────────────────────────────────────────

function RejectModal({
  onConfirm, onClose, loading, isGroup,
}: {
  onConfirm: (reason: string) => void;
  onClose:   () => void;
  loading:   boolean;
  isGroup:   boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md ring-1 ring-black/5 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <XCircle size={20} className="text-red-500" /> Rejeitar {isGroup ? "Lote" : "Reserva"}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X size={20} /></button>
        </div>
        <p className="text-sm text-neutral-600">Informe o motivo da rejeição para o professor.</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Ex: Laboratório indisponível no período solicitado."
          className="w-full border border-neutral-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
        />
        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => { if (reason.trim()) onConfirm(reason.trim()); }}
            disabled={!reason.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Rejeitando…" : "Confirmar Rejeição"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Botões de ação de uma linha avulsa ───────────────────────────────────────

function SingleActions({
  r,
  onApprove,
  onCaveats,
  onScheduleSW,
  onConfirmSW,
  onReject,
}: {
  r:            Reservation;
  onApprove:    () => void;
  onCaveats:    () => void;
  onScheduleSW: () => void;
  onConfirmSW:  () => void;
  onReject:     () => void;
}) {
  const hasSW = !!r.requested_softwares && r.software_installation_required;

  if (r.status === ReservationStatus.PENDENTE) {
    return (
      <div className="flex justify-end gap-1.5 flex-wrap">
        <button onClick={onApprove}
          title="Aprovar"
          className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200">
          <CheckCircle2 size={15} />
        </button>
        <button onClick={onCaveats}
          title="Aprovar com Ressalvas"
          className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200">
          <AlertTriangle size={15} />
        </button>
        {hasSW && (
          <button onClick={onScheduleSW}
            title="Agendar Instalação de Software"
            className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200">
            <MonitorIcon size={15} />
          </button>
        )}
        <button onClick={onReject}
          title="Rejeitar"
          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200">
          <XCircle size={15} />
        </button>
      </div>
    );
  }

  if (r.status === ReservationStatus.APROVADO_COM_RESSALVAS) {
    return (
      <button onClick={onApprove}
        title="Aprovar Definitivamente"
        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-xs hover:bg-emerald-100 transition-colors border border-emerald-200">
        <CheckCheck size={13} /> Aprovar
      </button>
    );
  }

  if (r.status === ReservationStatus.AGUARDANDO_SOFTWARE) {
    return (
      <button onClick={onConfirmSW}
        title="Confirmar Instalação de Software"
        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors border border-blue-200">
        <CheckCheck size={13} /> Software OK
      </button>
    );
  }

  return null;
}

// ─── Botões de ação de um lote ────────────────────────────────────────────────

function GroupActions({
  group,
  onApproveGroup,
  onCaveatsGroup,
  onScheduleSWGroup,
  onConfirmSWGroup,
  onRejectGroup,
}: {
  group:              Reservation[];
  onApproveGroup:     () => void;
  onCaveatsGroup:     () => void;
  onScheduleSWGroup:  () => void;
  onConfirmSWGroup:   () => void;
  onRejectGroup:      () => void;
}) {
  const first = group[0];
  const hasSW = !!first.requested_softwares && first.software_installation_required;
  // lote: usa o status mais representativo (maioria PENDENTE, etc.)
  const allPendente     = group.every(r => r.status === ReservationStatus.PENDENTE);
  const allCaveats      = group.every(r => r.status === ReservationStatus.APROVADO_COM_RESSALVAS);
  const allAwaitingSW   = group.every(r => r.status === ReservationStatus.AGUARDANDO_SOFTWARE);

  if (allPendente) {
    return (
      <div className="flex justify-end gap-1.5 flex-wrap">
        <button onClick={onApproveGroup}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-xs hover:bg-emerald-100 border border-emerald-200">
          <CheckCircle2 size={13} /> Aprovar
        </button>
        <button onClick={onCaveatsGroup}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-bold text-xs hover:bg-amber-100 border border-amber-200">
          <AlertTriangle size={13} /> Ressalvas
        </button>
        {hasSW && (
          <button onClick={onScheduleSWGroup}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg font-bold text-xs hover:bg-purple-100 border border-purple-200">
            <MonitorIcon size={13} /> Software
          </button>
        )}
        <button onClick={onRejectGroup}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg font-bold text-xs hover:bg-red-100 border border-red-200">
          <XCircle size={13} /> Rejeitar
        </button>
      </div>
    );
  }

  if (allCaveats) {
    return (
      <button onClick={onApproveGroup}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-xs hover:bg-emerald-100 border border-emerald-200">
        <CheckCheck size={13} /> Aprovar
      </button>
    );
  }

  if (allAwaitingSW) {
    return (
      <button onClick={onConfirmSWGroup}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-bold text-xs hover:bg-blue-100 border border-blue-200">
        <CheckCheck size={13} /> Software OK
      </button>
    );
  }

  return null;
}

// ─── Linha avulsa ─────────────────────────────────────────────────────────────

function TableRow({
  r, canApprove,
  onApprove, onCaveats, onScheduleSW, onConfirmSW, onReject,
}: {
  r: Reservation; canApprove: boolean;
  onApprove: () => void; onCaveats: () => void;
  onScheduleSW: () => void; onConfirmSW: () => void; onReject: () => void;
}) {
  return (
    <tr className="hover:bg-neutral-50 transition-colors border-b border-neutral-100">
      <td className="px-6 py-4">
        <p className="font-bold text-sm text-neutral-900">{r.user?.full_name}</p>
        <p className="text-xs text-neutral-400 mt-0.5">#{r.id}</p>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-800">{r.laboratory?.name ?? "—"}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{r.laboratory?.block}</p>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm font-medium text-neutral-600 flex items-center gap-1.5">
          <CalendarDays size={14} className="text-neutral-400" />
          {new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR")}
        </span>
        <p className="text-xs text-neutral-400 mt-0.5">Aula avulsa</p>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-700">{r.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {r.items && r.items.length > 0 && (
            <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Materiais</span>
          )}
          {r.requested_softwares && (
            <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200" title={r.requested_softwares}>
              {r.software_installation_required ? "Instalar SW" : "SW Solicitado"}
            </span>
          )}
        </div>
        {r.approval_notes && (
          <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
            <Info size={10} /> {r.approval_notes}
          </p>
        )}
      </td>
      <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
      <td className="px-6 py-4 text-right">
        {canApprove && (
          <SingleActions
            r={r}
            onApprove={onApprove}
            onCaveats={onCaveats}
            onScheduleSW={onScheduleSW}
            onConfirmSW={onConfirmSW}
            onReject={onReject}
          />
        )}
      </td>
    </tr>
  );
}

// ─── Linha de lote ────────────────────────────────────────────────────────────

function GroupRow({
  group, canApprove,
  onApproveGroup, onCaveatsGroup, onScheduleSWGroup, onConfirmSWGroup, onRejectGroup,
}: {
  group: Reservation[]; canApprove: boolean;
  onApproveGroup: () => void; onCaveatsGroup: () => void;
  onScheduleSWGroup: () => void; onConfirmSWGroup: () => void; onRejectGroup: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const first  = group[0];
  const { type, weekday } = groupLabel(group);

  // ordena datas para exibição
  const sortedDates = [...group].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <tr className="border-b border-neutral-200 bg-neutral-50/40 hover:bg-neutral-50 transition-colors">
      <td className="px-6 py-4">
        <p className="font-bold text-sm text-neutral-900">{first.user?.full_name}</p>
        <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
          type === "semestral"
            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
            : "bg-sky-50 text-sky-700 border-sky-200"
        }`}>
          <Layers size={10} />
          {type === "semestral" ? "SEMESTRAL" : "LOTE PONTUAL"} · {group.length} aulas
        </span>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-800">{first.laboratory?.name ?? "—"}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{first.laboratory?.block}</p>
      </td>
      <td className="px-6 py-4">
        {type === "semestral" ? (
          <div>
            <span className="text-sm font-bold text-neutral-700 flex items-center gap-1.5">
              <CalendarDays size={14} className="text-indigo-500" />
              Toda {weekday}
            </span>
            <span className="text-xs text-neutral-400 mt-0.5 block">
              {new Date(sortedDates[0].date + "T12:00:00").toLocaleDateString("pt-BR")} →{" "}
              {new Date(sortedDates[sortedDates.length - 1].date + "T12:00:00").toLocaleDateString("pt-BR")}
            </span>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm font-bold text-sky-600 flex items-center gap-1.5 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100 transition-colors"
            >
              <CalendarDays size={14} />
              {group.length} datas
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {expanded && (
              <div className="absolute top-full left-0 z-30 mt-2 bg-white border border-neutral-200 rounded-xl shadow-xl w-60 overflow-hidden">
                <div className="bg-neutral-50 border-b border-neutral-100 px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  Datas do Lote ({group.length})
                </div>
                <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
                  {sortedDates.map(r => (
                    <div key={r.id} className="text-xs font-medium text-neutral-700 px-3 py-2 rounded-lg flex items-center justify-between gap-2 hover:bg-neutral-50">
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
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-700">{first.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {first.items && first.items.length > 0 && (
            <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Materiais</span>
          )}
          {first.requested_softwares && (
            <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200" title={first.requested_softwares}>
              {first.software_installation_required ? "Instalar SW" : "SW Solicitado"}
            </span>
          )}
        </div>
        {first.approval_notes && (
          <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
            <Info size={10} /> {first.approval_notes}
          </p>
        )}
      </td>
      <td className="px-6 py-4"><StatusBadge status={first.status} /></td>
      <td className="px-6 py-4 text-right">
        {canApprove && (
          <GroupActions
            group={group}
            onApproveGroup={onApproveGroup}
            onCaveatsGroup={onCaveatsGroup}
            onScheduleSWGroup={onScheduleSWGroup}
            onConfirmSWGroup={onConfirmSWGroup}
            onRejectGroup={onRejectGroup}
          />
        )}
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "caveats";   id: number; groupId?: string }
  | { type: "reject";    id: number; groupId?: string }
  | { type: "scheduleSW"; id: number; groupId?: string; labId?: number; labName?: string; professor?: string; softwares?: string };

export function ReservationPageDTI() {
  const { user } = useAuth();
  const canApprove = user?.role === UserRole.DTI_TECNICO;

  const { showToast, ToastComponent } = useToast();
  const { data, loading, error, refetch } = useFetch(reservationsApi.listAll);

  const [filter, setFilter]         = useState<string>("all");
  const [viewMode, setViewMode]     = useState<"list" | "timetable">("list");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [modal, setModal]           = useState<ModalState>({ type: "none" });
  const [actionLoading, setActionLoading] = useState(false);

  // ── Filtragem ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all")
      return data.filter(r => r.status !== ReservationStatus.REJEITADO && r.status !== ReservationStatus.CANCELADO);
    return data.filter(r => r.status === filter);
  }, [data, filter]);

  // ── Agrupamento sobre TODA a lista filtrada (não sobre paginated) ──────────
  const { allGroups, allSingles } = useMemo(() => {
    const grps: Record<string, Reservation[]> = {};
    const sgls: Reservation[] = [];
    filtered.forEach(r => {
      if (r.group_id) {
        if (!grps[r.group_id]) grps[r.group_id] = [];
        grps[r.group_id].push(r);
      } else {
        sgls.push(r);
      }
    });
    Object.keys(grps).forEach(k =>
      grps[k].sort((a, b) => a.date.localeCompare(b.date))
    );
    return { allGroups: grps, allSingles: sgls };
  }, [filtered]);

  // ── Paginação por unidade (grupo = 1 unidade, avulsa = 1 unidade) ─────────
  const units: Array<{ kind: "group"; id: string } | { kind: "single"; r: Reservation }> = useMemo(() => {
    const list: Array<{ kind: "group"; id: string } | { kind: "single"; r: Reservation }> = [
      ...Object.keys(allGroups).map(id => ({ kind: "group" as const, id })),
      ...allSingles.map(r => ({ kind: "single" as const, r })),
    ];
    return list;
  }, [allGroups, allSingles]);

  const visibleUnits = units.slice(0, visibleCount);
  const hasMore      = visibleCount < units.length;

  // ── Ações individuais ──────────────────────────────────────────────────────

  const doReview = async (payload: ReviewPayload, id?: number, groupId?: string) => {
    if (groupId) {
      await reservationsApi.reviewGroup(groupId, payload);
    } else if (id) {
      await reservationsApi.review(id, payload);
    }
  };

  const handleApprove = async (id: number) => {
    setActionLoading(true);
    try {
      await reservationsApi.review(id, { status: ReservationStatus.APROVADO });
      showToast("Reserva aprovada com sucesso.", "success");
      refetch();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao aprovar.", "error");
    } finally { setActionLoading(false); }
  };

  const handleApproveGroup = async (gid: string) => {
    setActionLoading(true);
    try {
      await reservationsApi.reviewGroup(gid, { status: ReservationStatus.APROVADO });
      showToast("Lote aprovado com sucesso.", "success");
      refetch();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao aprovar lote.", "error");
    } finally { setActionLoading(false); }
  };

  const handleConfirmSW = async (id: number) => {
    setActionLoading(true);
    try {
      await reservationsApi.review(id, { status: ReservationStatus.APROVADO });
      showToast("Instalação confirmada. Reserva aprovada.", "success");
      refetch();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao confirmar.", "error");
    } finally { setActionLoading(false); }
  };

  const handleConfirmSWGroup = async (gid: string) => {
    setActionLoading(true);
    try {
      await reservationsApi.reviewGroup(gid, { status: ReservationStatus.APROVADO });
      showToast("Instalação confirmada. Lote aprovado.", "success");
      refetch();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao confirmar.", "error");
    } finally { setActionLoading(false); }
  };

  // ── Confirmar modal de Ressalvas ──────────────────────────────────────────
  const submitCaveats = async (notes: string) => {
    if (modal.type !== "caveats") return;
    setActionLoading(true);
    try {
      await doReview(
        { status: ReservationStatus.APROVADO_COM_RESSALVAS, approval_notes: notes },
        modal.id, modal.groupId,
      );
      showToast("Aprovado com ressalvas. O professor será notificado.", "success");
      setModal({ type: "none" });
      refetch();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao aprovar com ressalvas.", "error");
    } finally { setActionLoading(false); }
  };

  // ── Confirmar modal de Rejeição ───────────────────────────────────────────
  const submitReject = async (reason: string) => {
    if (modal.type !== "reject") return;
    setActionLoading(true);
    try {
      await doReview(
        { status: ReservationStatus.REJEITADO, rejection_reason: reason },
        modal.id, modal.groupId,
      );
      showToast("Reserva rejeitada.", "success");
      setModal({ type: "none" });
      refetch();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao rejeitar.", "error");
    } finally { setActionLoading(false); }
  };

  // ── Agendar instalação de software ────────────────────────────────────────
  const submitScheduleSW = async () => {
    if (modal.type !== "scheduleSW") return;
    setActionLoading(true);
    try {
      // 1. Cria ticket de manutenção
      await maintenanceApi.create({
        title: `Instalação de Software — ${modal.labName ?? "Laboratório"}`,
        description:
          `Softwares solicitados: ${modal.softwares ?? "não especificado"}.\n` +
          `Professor: ${modal.professor ?? "—"}.\n` +
          `Reserva #${modal.id}${modal.groupId ? ` (Lote ${modal.groupId.slice(0, 8)}…)` : ""}.`,
        lab_id: modal.labId,
        severity: "medio",
      });
      // 2. Move reserva para AGUARDANDO_SOFTWARE
      await doReview(
        { status: ReservationStatus.AGUARDANDO_SOFTWARE },
        modal.id, modal.groupId,
      );
      showToast("Ticket de instalação criado. Reserva aguardando software.", "success");
      setModal({ type: "none" });
      refetch();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao agendar instalação.", "error");
    } finally { setActionLoading(false); }
  };

  if (viewMode === "timetable") return <TimetableWizard onClose={() => setViewMode("list")} />;

  return (
    <div className="space-y-6 pb-12">
      {ToastComponent}

      {/* Modais */}
      {modal.type === "caveats" && (
        <CaveatsModal
          onConfirm={submitCaveats}
          onClose={() => setModal({ type: "none" })}
          loading={actionLoading}
        />
      )}
      {modal.type === "reject" && (
        <RejectModal
          onConfirm={submitReject}
          onClose={() => setModal({ type: "none" })}
          loading={actionLoading}
          isGroup={!!modal.groupId}
        />
      )}
      {modal.type === "scheduleSW" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md ring-1 ring-black/5 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <MonitorIcon size={20} className="text-purple-500" /> Agendar Instalação de Software
              </h3>
              <button onClick={() => setModal({ type: "none" })} className="text-neutral-400 hover:text-neutral-700"><X size={20} /></button>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-1.5 text-sm">
              <p><span className="font-bold text-purple-700">Lab:</span> <span className="text-neutral-700">{modal.labName ?? "—"}</span></p>
              <p><span className="font-bold text-purple-700">Professor:</span> <span className="text-neutral-700">{modal.professor ?? "—"}</span></p>
              <p><span className="font-bold text-purple-700">Softwares:</span> <span className="text-neutral-700">{modal.softwares ?? "—"}</span></p>
            </div>
            <p className="text-sm text-neutral-600">
              Um ticket de manutenção será gerado e a reserva passará para <strong>Aguardando Software</strong> até a confirmação da instalação.
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModal({ type: "none" })}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50">
                Cancelar
              </button>
              <button onClick={submitScheduleSW} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
                {actionLoading ? "Criando…" : "Criar Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">
            {canApprove ? "Gerenciar Solicitações" : "Solicitações de Reserva"}
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            {canApprove
              ? "Aprove, rejeite e acompanhe os agendamentos da universidade."
              : "Visualize as solicitações de reserva em andamento."}
          </p>
        </div>
        <button
          onClick={() => setViewMode("timetable")}
          className="bg-white border border-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-50 transition-colors shadow-sm"
        >
          <Search size={18} /> Verificar Grade
        </button>
      </div>

      {/* Banner somente leitura */}
      {!canApprove && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3">
          <Eye size={18} className="text-blue-500 shrink-0" />
          <p className="text-sm font-medium text-blue-700">
            Você está no <span className="font-bold">modo de visualização</span>. Estagiários DTI não possuem permissão para aprovar ou rejeitar reservas.
          </p>
        </div>
      )}

      {/* Legenda de ações */}
      {canApprove && (
        <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg">
            <CheckCircle2 size={13} className="text-emerald-500" /> Aprovar
          </span>
          <span className="flex items-center gap-1.5 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg">
            <AlertTriangle size={13} className="text-amber-500" /> Aprovar com Ressalvas
          </span>
          <span className="flex items-center gap-1.5 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg">
            <MonitorIcon size={13} className="text-purple-500" /> Agendar Instalação de Software
          </span>
          <span className="flex items-center gap-1.5 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg">
            <CheckCheck size={13} className="text-blue-500" /> Confirmar Software Instalado
          </span>
          <span className="flex items-center gap-1.5 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg">
            <XCircle size={13} className="text-red-500" /> Rejeitar
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {([
          { value: "all",                                 label: "Ativas" },
          { value: ReservationStatus.PENDENTE,            label: "Pendentes" },
          { value: ReservationStatus.APROVADO,            label: "Aprovadas" },
          { value: ReservationStatus.AGUARDANDO_SOFTWARE, label: "Aguard. Software" },
          { value: ReservationStatus.APROVADO_COM_RESSALVAS, label: "Com Ressalvas" },
        ] as const).map(s => (
          <button key={s.value} onClick={() => { setFilter(s.value); setVisibleCount(ITEMS_PER_PAGE); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${
              filter === s.value
                ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {loading && <LoadingSpinner label="Carregando reservas..." />}
        {error   && <ErrorMessage message={error} onRetry={refetch} />}

        {!loading && !error && (
          units.length === 0 ? (
            <div className="p-16 text-center space-y-4 bg-neutral-50/50">
              <Calendar className="mx-auto text-neutral-300" size={56} />
              <p className="text-neutral-500 font-medium text-lg">Nenhuma reserva encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[1100px]">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Professor</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Laboratório</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Data / Período</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Horários / Extras</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right min-w-[160px]">
                      {canApprove ? "Ações" : ""}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {visibleUnits.map(unit => {
                    if (unit.kind === "group") {
                      const group = allGroups[unit.id];
                      const first = group[0];
                      return (
                        <GroupRow
                          key={unit.id}
                          group={group}
                          canApprove={canApprove}
                          onApproveGroup={() => handleApproveGroup(unit.id)}
                          onCaveatsGroup={() => setModal({ type: "caveats", id: first.id, groupId: unit.id })}
                          onScheduleSWGroup={() => setModal({
                            type: "scheduleSW",
                            id: first.id,
                            groupId: unit.id,
                            labId: first.lab_id,
                            labName: first.laboratory?.name,
                            professor: first.user?.full_name,
                            softwares: first.requested_softwares ?? undefined,
                          })}
                          onConfirmSWGroup={() => handleConfirmSWGroup(unit.id)}
                          onRejectGroup={() => setModal({ type: "reject", id: first.id, groupId: unit.id })}
                        />
                      );
                    }
                    const r = unit.r;
                    return (
                      <TableRow
                        key={r.id}
                        r={r}
                        canApprove={canApprove}
                        onApprove={() => handleApprove(r.id)}
                        onCaveats={() => setModal({ type: "caveats", id: r.id })}
                        onScheduleSW={() => setModal({
                          type: "scheduleSW",
                          id: r.id,
                          labId: r.lab_id,
                          labName: r.laboratory?.name,
                          professor: r.user?.full_name,
                          softwares: r.requested_softwares ?? undefined,
                        })}
                        onConfirmSW={() => handleConfirmSW(r.id)}
                        onReject={() => setModal({ type: "reject", id: r.id })}
                      />
                    );
                  })}
                </tbody>
              </table>

              <div className="p-5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <span className="text-sm text-neutral-500 font-medium flex items-center gap-2">
                  <Layers size={16} />
                  Exibindo {visibleUnits.length} de {units.length} registros
                  {units.length !== filtered.length && (
                    <span className="text-neutral-400">({filtered.length} reservas individuais)</span>
                  )}
                </span>
                {hasMore && (
                  <button onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                    className="px-6 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-sm">
                    Carregar Mais
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
