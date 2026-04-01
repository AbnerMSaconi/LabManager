/**
 * Tela de Reservas — visão do PROGEX e Admin
 */
import React, { useState, useMemo } from "react";
import {
  CheckCircle2, XCircle, Calendar, Layers, ChevronDown, ChevronUp,
  CalendarDays, Search, AlertTriangle, Clock, Plus, X, List, Monitor, MoreHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ReservationStatus, Reservation, UserRole } from "../types";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi } from "../api/reservationsApi";
import { useAuth } from "../hooks/useAuth";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { StatusBadge, WEEKDAY_NAMES, TimetableWizard, SoftwareBadge, MaterialsBadge } from "./reservationShared";
import { ApiError } from "../api/client";

const ITEMS_PER_PAGE = 15;

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

  const actions: ActionItem[] = [];

  if (status === ReservationStatus.PENDENTE) {
    actions.push({ label: "Aprovar", Icon: CheckCircle2, color: "emerald", onClick: onApprove });
    actions.push({ label: "Aprovar com Ressalvas", Icon: AlertTriangle, color: "amber", onClick: onCaveats });
    if (hasSW) actions.push({ label: "Agendar Software", Icon: Monitor, color: "purple", onClick: onScheduleSW });
    actions.push({ label: "Rejeitar", Icon: XCircle, color: "red", onClick: onReject });
  } else if (status === ReservationStatus.APROVADO_COM_RESSALVAS) {
    actions.push({ label: "Confirmar Aprovação", Icon: CheckCircle2, color: "emerald", onClick: onApprove });
    actions.push({ label: "Rejeitar", Icon: XCircle, color: "red", onClick: onReject });
  }

  if (actions.length === 0) return null;

  return (
    <>
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200 ml-auto`}>
        <MoreHorizontal size={14} /> Ações
      </button>
      
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }} className="bg-white rounded-3xl w-full max-w-xs flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-5 bg-neutral-50/50 border-b border-neutral-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-neutral-900">Ações da Reserva</h3>
                <button onClick={() => setOpen(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
              </div>
              <div className="p-5 space-y-3 bg-white">
                {actions.map(({ label, Icon, color, onClick }) => (
                  <button key={label} onClick={() => { setOpen(false); onClick(); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-left transition-colors border border-neutral-100 bg-neutral-50 ${ACTION_COLORS[color]}`}>
                    <Icon size={18} /> {label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function TableRow({ r, onApprove, onReject, canReview }: { key?: React.Key; r: Reservation; onApprove: (id: number) => void; onReject: (id: number) => void; canReview: boolean }) {
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
          <MaterialsBadge items={r.items || []} />
          <SoftwareBadge softwares={r.requested_softwares} label={r.software_installation_required ? "Instalar SW" : "SW Solicitado"} />
        </div>
      </td>
      <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
      <td className="px-6 py-4 text-right whitespace-nowrap align-middle">
        {r.status === ReservationStatus.PENDENTE && canReview && (
          <ActionPopover status={r.status} hasSW={!!r.requested_softwares && !!r.software_installation_required} onApprove={() => onApprove(r.id)} onCaveats={() => {}} onScheduleSW={() => {}} onReject={() => onReject(r.id)} />
        )}
        {r.status === ReservationStatus.PENDENTE && !canReview && (
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200">Em Avaliação</span>
        )}
      </td>
    </tr>
  );
}

function GroupRow({ group, onApproveGroup, onRejectGroup, canReview }: { key?: React.Key; group: Reservation[]; onApproveGroup: (gid: string) => void; onRejectGroup: (gid: string) => void; canReview: boolean }) {
  const [openDates, setOpenDates] = useState(false);
  const first = group[0];
  const { type, weekday } = groupLabel(group);
  const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <tr className="border-b border-neutral-200 bg-blue-50/20 hover:bg-blue-50/50 transition-colors">
      <td className="px-6 py-4">
        <p className="font-bold text-sm text-neutral-900">{first.user?.full_name}</p>
        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200 shadow-sm uppercase tracking-wider">
          <Layers size={10} /> {type === "semestral" ? "SEMESTRAL" : "LOTE PONTUAL"} ({group.length})
        </span>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-neutral-800">{first.laboratory?.name}</p>
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">{first.laboratory?.block}</p>
      </td>
      <td className="px-6 py-4 relative">
        {type === "semestral" ? (
          <span className="text-sm font-bold text-blue-700 flex items-center gap-2">
            <CalendarDays size={14} className="text-blue-500" />Toda {weekday}
          </span>
        ) : (
          <>
            <button onClick={() => setOpenDates(true)} className="text-xs font-bold text-blue-700 flex items-center gap-1.5 hover:text-blue-900 bg-white px-3 py-2 rounded-xl border border-blue-200 transition-all shadow-sm active:scale-95">
              <CalendarDays size={14} /> Múltiplas Datas <ChevronDown size={14} />
            </button>

            <AnimatePresence>
              {openDates && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setOpenDates(false); }}>
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }} className="bg-white rounded-3xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="px-6 py-5 bg-neutral-50/50 border-b border-neutral-100 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                        <CalendarDays size={20} className="text-sky-500" /> Datas Solicitadas
                      </h3>
                      <button onClick={() => setOpenDates(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar space-y-2 bg-white">
                      <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-1">Resumo do Lote</p>
                        <p className="text-sm font-bold text-sky-900">{group.length} aulas · Laboratório {first.laboratory?.name}</p>
                      </div>
                      {sorted.map(r => (
                        <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-neutral-100 bg-neutral-50 hover:bg-neutral-100 transition-colors text-sm font-medium text-neutral-700">
                          <span className="flex items-center gap-2">
                            <CalendarDays size={14} className="text-neutral-400" />
                            {new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
                          </span>
                          <StatusBadge status={r.status} />
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex justify-end">
                      <button onClick={() => setOpenDates(false)} className="px-6 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-sm">
                        Fechar
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-black text-neutral-700">{first.slots?.map(s => s.code).join(", ") || "—"}</p>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          <MaterialsBadge items={first.items || []} />
          <SoftwareBadge softwares={first.requested_softwares} label={first.software_installation_required ? "Instalar SW" : "SW Solicitado"} />
        </div>
      </td>
      <td className="px-6 py-4"><StatusBadge status={first.status} /></td>
      <td className="px-6 py-4 text-right align-middle">
        {first.status === ReservationStatus.PENDENTE && canReview && (
          <ActionPopover status={first.status} hasSW={!!first.requested_softwares && !!first.software_installation_required} onApprove={() => onApproveGroup(first.group_id as string)} onCaveats={() => {}} onScheduleSW={() => {}} onReject={() => onRejectGroup(first.group_id as string)} />
        )}
        {first.status === ReservationStatus.PENDENTE && !canReview && (
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200 whitespace-nowrap">Em Avaliação</span>
        )}
      </td>
    </tr>
  );
}

export function ReservationPageProgex({ onNewReservation }: { onNewReservation: () => void }) {
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const { data, loading, error, refetch } = useFetch(reservationsApi.listAll, [], true);

  const [filter, setFilter]             = useState<string>("all");
  const [viewMode, setViewMode]         = useState<"list" | "timetable">("list");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [conflictWarning, setConflict]  = useState<string | null>(null);

  // Apenas Admins e Super Admins podem aprovar aqui.
  const canReview = user?.role === UserRole.ADMINISTRADOR || user?.role === UserRole.SUPER_ADMIN;

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

      <AnimatePresence>
        {conflictWarning && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-3xl p-6 shadow-sm overflow-hidden">
            <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-red-800 tracking-tight">Conflito de Agenda Detectado</p>
              <p className="text-sm font-medium text-red-700 mt-1 whitespace-pre-line">{conflictWarning}</p>
            </div>
            <button onClick={() => setConflict(null)} className="text-red-400 hover:text-red-700 hover:bg-red-100 p-2 rounded-full transition-colors shrink-0 mt-0.5">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 border border-neutral-200 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center shadow-inner shrink-0">
             <List size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Controle de Reservas</h1>
            <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-widest">{user?.role === UserRole.PROGEX ? "Painel do Progex" : "Painel Administrativo"}</p>
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
                    <GroupRow key={gid} group={group} onApproveGroup={handleApproveGroup} onRejectGroup={handleRejectGroup} canReview={canReview} />
                  ))}
                  {(singles as Reservation[]).map((r: Reservation) => (
                    <TableRow key={r.id} r={r} onApprove={handleApprove} onReject={handleReject} canReview={canReview} />
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