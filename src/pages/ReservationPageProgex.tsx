/**
 * Tela de Reservas — visão do PROGEX (Coordenador de Programa)
 */
import React, { useState, useMemo } from "react";
import {
  CheckCircle2, XCircle, Calendar, Layers, ChevronDown, ChevronUp,
  CalendarDays, Search, AlertTriangle, Clock, Plus, X, List
} from "lucide-react";
import { ReservationStatus, Reservation } from "../types";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi } from "../api/reservationsApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { StatusBadge, WEEKDAY_NAMES, TimetableWizard, SoftwareBadge, MaterialsBadge } from "./reservationShared";
import { ApiError } from "../api/client";

const ITEMS_PER_PAGE = 15;

// ─── Indicadores ─────────────────────────────────────────────────────────────

function IndicatorsBar({ data }: { data: Reservation[] }) {
  const pendentes      = data.filter(r => r.status === ReservationStatus.PENDENTE).length;
  const aguardandoSoft = data.filter(r => r.status === ReservationStatus.AGUARDANDO_SOFTWARE).length;
  const aprovadas      = data.filter(r => r.status === ReservationStatus.APROVADO || r.status === ReservationStatus.EM_USO).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="bg-amber-100 p-3 rounded-2xl shadow-inner"><Clock size={22} className="text-amber-600" /></div>
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Pendentes</p>
          <p className="text-3xl font-black text-neutral-900">{pendentes}</p>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="bg-purple-100 p-3 rounded-2xl shadow-inner"><AlertTriangle size={22} className="text-purple-600" /></div>
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Aguardando Software</p>
          <p className="text-3xl font-black text-neutral-900">{aguardandoSoft}</p>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="bg-emerald-100 p-3 rounded-2xl shadow-inner"><CheckCircle2 size={22} className="text-emerald-600" /></div>
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Aprovadas / Uso</p>
          <p className="text-3xl font-black text-neutral-900">{aprovadas}</p>
        </div>
      </div>
    </div>
  );
}

function TableRow({ r, onApprove, onReject }: { key?: React.Key; r: Reservation; onApprove: (id: number) => void; onReject: (id: number) => void; }) {
  return (
    <tr className="hover:bg-neutral-50/50 transition-colors border-b border-neutral-100">
      <td className="px-6 py-4">
        <p className="font-bold text-sm text-neutral-900">{r.user?.full_name}</p>
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Reserva #{r.id}</p>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-800">{r.laboratory?.name}</p>
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">{r.laboratory?.block}</p>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm font-bold text-neutral-700 flex items-center gap-2">
          <CalendarDays size={14} className="text-neutral-400" />
          {new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR")}
        </span>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-black text-neutral-700">{r.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {r.items && r.items.length > 0 && <MaterialsBadge items={r.items} />}
          {r.requested_softwares && <SoftwareBadge softwares={r.requested_softwares} />}
        </div>
      </td>
      <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
      <td className="px-6 py-4 text-right whitespace-nowrap">
        {r.status === ReservationStatus.PENDENTE && (
          <div className="flex justify-end gap-2">
            <button onClick={() => onApprove(r.id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 border border-emerald-100" title="Aprovar">
              <CheckCircle2 size={16} />
            </button>
            <button onClick={() => onReject(r.id)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95 border border-red-100" title="Rejeitar">
              <XCircle size={16} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function GroupRow({ group, onApproveGroup, onRejectGroup }: { key?: React.Key; group: Reservation[]; onApproveGroup: (gid: string) => void; onRejectGroup: (gid: string) => void; }) {
  const [expanded, setExpanded] = useState(false);
  const first = group[0];
  const firstDay = new Date(first.date + "T12:00:00").getDay();
  const isSemestral = group.every(r => new Date(r.date + "T12:00:00").getDay() === firstDay) && group.length >= 4;

  return (
    <tr className="border-b border-neutral-200 bg-blue-50/20 hover:bg-blue-50/50 transition-colors">
      <td className="px-6 py-4">
        <p className="font-bold text-sm text-neutral-900">{first.user?.full_name}</p>
        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200 shadow-sm uppercase tracking-wider">
          <Layers size={10} /> {isSemestral ? "LOTE SEMESTRAL" : "LOTE PONTUAL"} ({group.length})
        </span>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-800">{first.laboratory?.name}</p>
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">{first.laboratory?.block}</p>
      </td>
      <td className="px-6 py-4 relative">
        {isSemestral ? (
          <span className="text-sm font-bold text-blue-700 flex items-center gap-2">
            <CalendarDays size={14} className="text-blue-500" />Toda {WEEKDAY_NAMES[firstDay]}
          </span>
        ) : (
          <div className="relative">
            <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-blue-700 flex items-center gap-1.5 hover:text-blue-900 bg-white px-3 py-2 rounded-xl border border-blue-200 transition-all shadow-sm active:scale-95">
              <CalendarDays size={14} /> Múltiplas Datas {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <div className={`absolute top-full left-0 z-30 mt-2 bg-white border border-neutral-200 rounded-xl shadow-2xl w-56 overflow-hidden transition-all duration-200 origin-top-left ${expanded ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}>
              <div className="bg-neutral-50 border-b border-neutral-100 px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Datas Solicitadas</div>
              <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                {group.map(r => (
                  <div key={r.id} className="text-xs font-bold text-neutral-700 px-3 py-2.5 hover:bg-neutral-50 rounded-lg flex items-center justify-between">
                    {new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-black text-neutral-700">{first.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {first.items && first.items.length > 0 && <MaterialsBadge items={first.items} />}
          {first.requested_softwares && <SoftwareBadge softwares={first.requested_softwares} />}
        </div>
      </td>
      <td className="px-6 py-4"><StatusBadge status={first.status} /></td>
      <td className="px-6 py-4 text-right">
        {first.status === ReservationStatus.PENDENTE && (
          <div className="flex justify-end gap-2">
            <button onClick={() => onApproveGroup(first.group_id as string)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200 shadow-sm active:scale-95">
              <CheckCircle2 size={14} /> Aprovar Lote
            </button>
            <button onClick={() => onRejectGroup(first.group_id as string)} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-xl font-bold text-xs hover:bg-red-600 hover:text-white transition-all border border-red-200 shadow-sm active:scale-95">
              <XCircle size={14} /> Rejeitar Lote
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function ReservationPageProgex({ onNewReservation }: { onNewReservation: () => void }) {
  const { showToast, ToastComponent } = useToast();
  const { data, loading, error, refetch } = useFetch(reservationsApi.listAll, [], true);

  const [filter, setFilter]             = useState<string>("all");
  const [viewMode, setViewMode]         = useState<"list" | "timetable">("list");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [conflictWarning, setConflict]  = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.filter(r => r.status !== ReservationStatus.REJEITADO && r.status !== ReservationStatus.CANCELADO);
    return data.filter(r => r.status === filter);
  }, [data, filter]);

  const paginated = filtered.slice(0, visibleCount);
  const hasMore   = visibleCount < filtered.length;

  const { groups, singles } = useMemo(() => {
    const grps: Record<string, Reservation[]> = {};
    const sgls: Reservation[] = [];
    paginated.forEach(r => { if (r.group_id) { if (!grps[r.group_id]) grps[r.group_id] = []; grps[r.group_id].push(r); } else { sgls.push(r); } });
    Object.keys(grps).forEach(k => { grps[k].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); });
    return { groups: grps, singles: sgls };
  }, [paginated]);

  const handleApprove = async (id: number) => {
    setConflict(null);
    try { await reservationsApi.review(id, { status: ReservationStatus.APROVADO }); showToast("Reserva aprovada.", "success"); refetch(); }
    catch (e) { if (e instanceof ApiError && e.status === 409) setConflict(e.message); else showToast(e instanceof ApiError ? e.message : "Erro ao aprovar.", "error"); }
  };

  const handleReject = async (id: number) => {
    try { await reservationsApi.review(id, { status: ReservationStatus.REJEITADO, rejection_reason: "Indisponibilidade" }); showToast("Reserva rejeitada.", "success"); refetch(); }
    catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao rejeitar.", "error"); }
  };

  const handleApproveGroup = async (gid: string) => {
    setConflict(null);
    try { await reservationsApi.reviewGroup(gid, { status: ReservationStatus.APROVADO }); showToast("Lote aprovado.", "success"); refetch(); }
    catch (e) { if (e instanceof ApiError && e.status === 409) setConflict(e.message); else showToast(e instanceof ApiError ? e.message : "Erro ao aprovar lote.", "error"); }
  };

  const handleRejectGroup = async (gid: string) => {
    try { await reservationsApi.reviewGroup(gid, { status: ReservationStatus.REJEITADO, rejection_reason: "Indisponibilidade no Semestre" }); showToast("Lote rejeitado.", "success"); refetch(); }
    catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao rejeitar lote.", "error"); }
  };

  if (viewMode === "timetable") return <TimetableWizard onClose={() => setViewMode("list")} />;

  return (
    <div className="space-y-8 pb-12">
      {ToastComponent}

      {conflictWarning && (
        <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-3xl p-6 shadow-sm">
          <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-red-800 tracking-tight">Conflito de Agenda Detectado</p>
            <p className="text-sm font-medium text-red-700 mt-1 whitespace-pre-line">{conflictWarning}</p>
          </div>
          <button onClick={() => setConflict(null)} className="text-red-400 hover:text-red-700 hover:bg-red-100 p-2 rounded-full transition-colors shrink-0 mt-0.5">
            <X size={20} />
          </button>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 border border-neutral-200 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center shadow-inner shrink-0">
             <List size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Controle de Reservas</h1>
            <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-widest">Painel Executivo Progex</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setViewMode("timetable")} className="bg-white border border-neutral-200 text-neutral-700 px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-50 transition-all active:scale-95 shadow-sm">
            <Search size={18} /> Verificar Grade
          </button>
          <button onClick={onNewReservation} className="bg-neutral-900 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-all active:scale-95 shadow-md shadow-neutral-900/20">
            <Plus size={18} /> Nova Reserva
          </button>
        </div>
      </header>

      {!loading && data && <IndicatorsBar data={data} />}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {(["all", ReservationStatus.PENDENTE, ReservationStatus.APROVADO, ReservationStatus.AGUARDANDO_SOFTWARE, ReservationStatus.CONCLUIDO] as const).map(s => (
          <button key={s} onClick={() => { setFilter(s); setVisibleCount(ITEMS_PER_PAGE); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border active:scale-[0.98] ${filter === s ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"}`}>
            {s === "all" ? "Aprovadas / Pendentes" : s.replace(/_/g, " ").toUpperCase()}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        {loading && <LoadingSpinner label="Carregando matriz de reservas..." />}
        {error   && <ErrorMessage message={error} onRetry={refetch} />}

        {!loading && !error && (
          filtered.length === 0 ? (
            <div className="p-20 text-center space-y-4 bg-neutral-50/50">
              <Calendar className="mx-auto text-neutral-300" size={56} />
              <p className="text-neutral-500 font-bold text-lg">Nenhuma reserva encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Professor</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Laboratório</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Data</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Horários / Demanda</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest text-right">Ações de Aprovação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(Object.entries(groups) as [string, Reservation[]][]).map(([gid, group]) => (
                    <GroupRow key={gid} group={group} onApproveGroup={handleApproveGroup} onRejectGroup={handleRejectGroup} />
                  ))}
                  {(singles as Reservation[]).map((r: Reservation) => (
                    <TableRow key={r.id} r={r} onApprove={handleApprove} onReject={handleReject} />
                  ))}
                </tbody>
              </table>

              <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Layers size={16} /> Exibindo {paginated.length} de {filtered.length} registros
                </span>
                {hasMore && (
                  <button onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                    className="px-6 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-sm active:scale-95">
                    Carregar Mais Histórico
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