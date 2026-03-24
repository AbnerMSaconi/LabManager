/**
 * Tela de Reservas — visão do PROGEX (Coordenador de Programa)
 *
 * Funcionalidades:
 * - Painel de indicadores rápidos (pendentes, aguardando software, total ativo)
 * - Lista todas as reservas com filtros completos
 * - Aprova / rejeita reservas individuais e em lote
 * - Botão "Nova Reserva" (PROGEX pode solicitar reservas diretamente)
 * - Acessa o Verificador de Grade
 */
import React, { useState, useMemo } from "react";
import {
  CheckCircle2, XCircle, Calendar, Layers, ChevronDown, ChevronUp,
  CalendarDays, Search, AlertTriangle, Clock, Monitor, Plus,
} from "lucide-react";
import { ReservationStatus, Reservation } from "../types";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi, ReviewPayload } from "../api/reservationsApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { StatusBadge, WEEKDAY_NAMES, TimetableWizard } from "./reservationShared";

const ITEMS_PER_PAGE = 15;

// ─── Indicadores ─────────────────────────────────────────────────────────────

function IndicatorsBar({ data }: { data: Reservation[] }) {
  const pendentes         = data.filter(r => r.status === ReservationStatus.PENDENTE).length;
  const aguardandoSoft    = data.filter(r => r.status === ReservationStatus.AGUARDANDO_SOFTWARE).length;
  const aprovadas         = data.filter(r => r.status === ReservationStatus.APROVADO || r.status === ReservationStatus.EM_USO).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-white rounded-2xl border border-amber-200 p-4 flex items-center gap-3">
        <div className="bg-amber-50 p-2.5 rounded-xl"><Clock size={18} className="text-amber-500" /></div>
        <div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Pendentes</p>
          <p className="text-2xl font-bold text-neutral-900">{pendentes}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-purple-200 p-4 flex items-center gap-3">
        <div className="bg-purple-50 p-2.5 rounded-xl"><AlertTriangle size={18} className="text-purple-500" /></div>
        <div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Aguard. Software</p>
          <p className="text-2xl font-bold text-neutral-900">{aguardandoSoft}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-emerald-200 p-4 flex items-center gap-3">
        <div className="bg-emerald-50 p-2.5 rounded-xl"><CheckCircle2 size={18} className="text-emerald-500" /></div>
        <div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Aprovadas / Em Uso</p>
          <p className="text-2xl font-bold text-neutral-900">{aprovadas}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Linha avulsa ─────────────────────────────────────────────────────────────

function TableRow({
  r,
  onApprove,
  onReject,
}: {
  key?:      React.Key;
  r:         Reservation;
  onApprove: (id: number) => void | Promise<void>;
  onReject:  (id: number) => void | Promise<void>;
}) {
  return (
    <tr className="hover:bg-neutral-50 transition-colors border-b border-neutral-100">
      <td className="px-6 py-4">
        <p className="font-bold text-sm text-neutral-900">{r.user?.full_name}</p>
        <p className="text-xs text-neutral-400 mt-0.5">#{r.id}</p>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-800">{r.laboratory?.name}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{r.laboratory?.block}</p>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm font-medium text-neutral-600 flex items-center gap-1.5">
          <CalendarDays size={14} className="text-neutral-400" />
          {new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR")}
        </span>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-700">{r.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {r.items && r.items.length > 0 && (
            <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Materiais</span>
          )}
          {r.requested_softwares && (
            <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">Software</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
      <td className="px-6 py-4 text-right">
        {r.status === ReservationStatus.PENDENTE && (
          <div className="flex justify-end gap-2">
            <button onClick={() => onApprove(r.id)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Aprovar">
              <CheckCircle2 size={16} />
            </button>
            <button onClick={() => onReject(r.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Rejeitar">
              <XCircle size={16} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Linha de lote ────────────────────────────────────────────────────────────

function GroupRow({
  group,
  onApproveGroup,
  onRejectGroup,
}: {
  key?:           React.Key;
  group:          Reservation[];
  onApproveGroup: (gid: string) => void | Promise<void>;
  onRejectGroup:  (gid: string) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const first      = group[0];
  const firstDay   = new Date(first.date + "T12:00:00").getDay();
  const isSemestral = group.every(r => new Date(r.date + "T12:00:00").getDay() === firstDay) && group.length >= 4;

  return (
    <tr className="border-b border-neutral-200 bg-neutral-50/30 hover:bg-neutral-50 transition-colors">
      <td className="px-6 py-4">
        <p className="font-bold text-sm text-neutral-900">{first.user?.full_name}</p>
        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
          <Layers size={10} /> {isSemestral ? "LOTE SEMESTRAL" : "LOTE PONTUAL"} ({group.length})
        </span>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-800">{first.laboratory?.name}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{first.laboratory?.block}</p>
      </td>
      <td className="px-6 py-4 relative">
        {isSemestral ? (
          <span className="text-sm font-bold text-neutral-700 flex items-center gap-1.5">
            <CalendarDays size={14} className="text-blue-500" />Toda {WEEKDAY_NAMES[firstDay]}
          </span>
        ) : (
          <div className="relative">
            <button onClick={() => setExpanded(!expanded)}
              className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors">
              <CalendarDays size={14} /> Múltiplas Datas {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <div className={`absolute top-full left-0 z-30 mt-2 bg-white border border-neutral-200 rounded-xl shadow-xl w-56 overflow-hidden transition-all duration-200 origin-top-left ${expanded ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}>
              <div className="bg-neutral-50 border-b border-neutral-100 px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Datas Solicitadas</div>
              <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                {group.map(r => (
                  <div key={r.id} className="text-xs font-medium text-neutral-700 px-3 py-2 hover:bg-neutral-50 rounded-lg flex items-center justify-between">
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
        <p className="text-sm font-bold text-neutral-700">{first.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {first.items && first.items.length > 0 && (
            <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Materiais</span>
          )}
          {first.requested_softwares && (
            <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">Software</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4"><StatusBadge status={first.status} /></td>
      <td className="px-6 py-4 text-right">
        {first.status === ReservationStatus.PENDENTE && (
          <div className="flex justify-end gap-2">
            <button onClick={() => onApproveGroup(first.group_id as string)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-xs hover:bg-emerald-100 transition-colors border border-emerald-200">
              <CheckCircle2 size={14} /> Aprovar Lote
            </button>
            <button onClick={() => onRejectGroup(first.group_id as string)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-bold text-xs hover:bg-red-100 transition-colors border border-red-200">
              <XCircle size={14} /> Rejeitar Lote
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReservationPageProgex({ onNewReservation }: { onNewReservation: () => void }) {
  const { showToast, ToastComponent } = useToast();
  const { data, loading, error, refetch } = useFetch(reservationsApi.listAll);

  const [filter, setFilter]             = useState<string>("all");
  const [viewMode, setViewMode]         = useState<"list" | "timetable">("list");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all")
      return data.filter(r => r.status !== ReservationStatus.REJEITADO && r.status !== ReservationStatus.CANCELADO);
    return data.filter(r => r.status === filter);
  }, [data, filter]);

  const paginated = filtered.slice(0, visibleCount);
  const hasMore   = visibleCount < filtered.length;

  const { groups, singles } = useMemo(() => {
    const grps: Record<string, Reservation[]> = {};
    const sgls: Reservation[] = [];
    paginated.forEach(r => {
      if (r.group_id) {
        if (!grps[r.group_id]) grps[r.group_id] = [];
        grps[r.group_id].push(r);
      } else {
        sgls.push(r);
      }
    });
    Object.keys(grps).forEach(k => {
      grps[k].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    return { groups: grps, singles: sgls };
  }, [paginated]);

  const handleApprove = async (id: number) => {
    try {
      await reservationsApi.review(id, { status: ReservationStatus.APROVADO });
      showToast("Reserva aprovada.", "success");
      refetch();
    } catch { showToast("Erro ao aprovar.", "error"); }
  };

  const handleReject = async (id: number) => {
    try {
      await reservationsApi.review(id, { status: ReservationStatus.REJEITADO, rejection_reason: "Indisponibilidade" });
      showToast("Reserva rejeitada.", "success");
      refetch();
    } catch { showToast("Erro ao rejeitar.", "error"); }
  };

  const handleApproveGroup = async (gid: string) => {
    try {
      await reservationsApi.reviewGroup(gid, { status: ReservationStatus.APROVADO });
      showToast("Lote aprovado.", "success");
      refetch();
    } catch { showToast("Erro ao aprovar lote.", "error"); }
  };

  const handleRejectGroup = async (gid: string) => {
    try {
      await reservationsApi.reviewGroup(gid, { status: ReservationStatus.REJEITADO, rejection_reason: "Indisponibilidade no Semestre" });
      showToast("Lote rejeitado.", "success");
      refetch();
    } catch { showToast("Erro ao rejeitar lote.", "error"); }
  };

  if (viewMode === "timetable") return <TimetableWizard onClose={() => setViewMode("list")} />;

  return (
    <div className="space-y-6 pb-12">
      {ToastComponent}

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Controle de Reservas</h2>
          <p className="text-sm text-neutral-500 mt-1">Gerencie, aprove e acompanhe todos os agendamentos da universidade.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNewReservation}
            className="bg-neutral-900 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-colors shadow-sm"
          >
            <Plus size={18} /> Nova Reserva
          </button>
          <button
            onClick={() => setViewMode("timetable")}
            className="bg-white border border-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-50 transition-colors shadow-sm"
          >
            <Search size={18} /> Verificar Grade
          </button>
        </div>
      </div>

      {/* Indicadores */}
      {!loading && data && <IndicatorsBar data={data} />}

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {([
          "all",
          ReservationStatus.PENDENTE,
          ReservationStatus.APROVADO,
          ReservationStatus.AGUARDANDO_SOFTWARE,
          ReservationStatus.CONCLUIDO,
        ] as const).map(s => (
          <button key={s} onClick={() => { setFilter(s); setVisibleCount(ITEMS_PER_PAGE); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${filter === s ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}>
            {s === "all" ? "Aprovadas / Pendentes" : s.replace(/_/g, " ").toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {loading && <LoadingSpinner label="Carregando matriz de reservas..." />}
        {error   && <ErrorMessage message={error} onRetry={refetch} />}

        {!loading && !error && (
          filtered.length === 0 ? (
            <div className="p-16 text-center space-y-4 bg-neutral-50/50">
              <Calendar className="mx-auto text-neutral-300" size={56} />
              <p className="text-neutral-500 font-medium text-lg">Nenhuma reserva encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Professor</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Laboratório</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Horários</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Ações</th>
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

              <div className="p-5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <span className="text-sm text-neutral-500 font-medium flex items-center gap-2">
                  <Layers size={16} /> Exibindo {paginated.length} de {filtered.length} registros
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
