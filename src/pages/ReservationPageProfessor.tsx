/**
 * Tela de Reservas — visão do PROFESSOR
 *
 * Funcionalidades:
 * - Lista apenas as próprias reservas (reservationsApi.listMy)
 * - Layout em cards com agrupamento de lotes semestrais
 * - Painel de estatísticas rápidas (total, pendentes, aprovadas)
 * - Botão "Nova Reserva" para abrir o wizard
 */
import React, { useMemo } from "react";
import {
  Monitor, Calendar, Layers, CalendarDays, Building2,
  Plus, ClipboardList, CheckCircle2, Clock,
} from "lucide-react";
import { ReservationStatus, Reservation } from "../types";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi } from "../api/reservationsApi";
import { LoadingSpinner, ErrorMessage } from "../components/ui";
import { STATUS_STYLES, WEEKDAY_NAMES, StatusBadge } from "./reservationShared";

// ─── Painel de estatísticas ───────────────────────────────────────────────────

function StatsBar({ data }: { data: Reservation[] }) {
  const total     = data.length;
  const pendentes = data.filter(r => r.status === ReservationStatus.PENDENTE).length;
  const aprovadas = data.filter(
    r => r.status === ReservationStatus.APROVADO || r.status === ReservationStatus.EM_USO,
  ).length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-center gap-3">
        <div className="bg-neutral-100 p-2.5 rounded-xl"><ClipboardList size={18} className="text-neutral-500" /></div>
        <div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-neutral-900">{total}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-center gap-3">
        <div className="bg-amber-50 p-2.5 rounded-xl"><Clock size={18} className="text-amber-500" /></div>
        <div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Pendentes</p>
          <p className="text-2xl font-bold text-neutral-900">{pendentes}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-center gap-3">
        <div className="bg-emerald-50 p-2.5 rounded-xl"><CheckCircle2 size={18} className="text-emerald-500" /></div>
        <div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Aprovadas</p>
          <p className="text-2xl font-bold text-neutral-900">{aprovadas}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Card individual de reserva ───────────────────────────────────────────────

type CardItem = {
  id: string;
  isGroup: boolean;
  labName?: string;
  blockName?: string;
  status: ReservationStatus;
  dateDisplay: string;
  timeDisplay: string;
};

function ReservationCard({ res }: { res: CardItem; key?: React.Key }) {
  const borderAccent: Record<string, string> = {
    [ReservationStatus.APROVADO]:            "border-l-4 border-l-emerald-400",
    [ReservationStatus.PENDENTE]:            "border-l-4 border-l-amber-400",
    [ReservationStatus.REJEITADO]:           "border-l-4 border-l-red-400",
    [ReservationStatus.EM_USO]:              "border-l-4 border-l-blue-400",
    [ReservationStatus.AGUARDANDO_SOFTWARE]: "border-l-4 border-l-purple-400",
    [ReservationStatus.CANCELADO]:           "border-l-4 border-l-neutral-300",
    [ReservationStatus.CONCLUIDO]:           "border-l-4 border-l-neutral-300",
  };

  return (
    <div className={`bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow ${borderAccent[res.status] ?? ""}`}>
      <div className="flex justify-between items-start gap-2 mb-4">
        <StatusBadge status={res.status} />
        {res.isGroup && (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase">
            <Layers size={10} className="inline mr-1 -mt-0.5" />Lote
          </span>
        )}
      </div>

      <div>
        <h3 className="font-bold text-neutral-900 text-lg leading-tight mb-1">{res.timeDisplay}</h3>
        <p className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
          <Monitor size={14} className="text-neutral-400" /> {res.labName ?? "—"}
        </p>
        <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1.5">
          <Building2 size={12} className="text-neutral-400" /> {res.blockName ?? "—"}
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-100">
        <span className="text-xs font-bold text-neutral-500 flex items-center gap-1.5">
          <CalendarDays size={14} className="text-neutral-400" /> {res.dateDisplay}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReservationPageProfessor({ onNewReservation }: { onNewReservation: () => void }) {
  const { data, loading, error, refetch } = useFetch(reservationsApi.listMy);

  const cards = useMemo<CardItem[]>(() => {
    if (!data) return [];
    const groups: Record<string, Reservation[]> = {};
    const singles: Reservation[] = [];

    data.forEach(r => {
      if (r.group_id) {
        if (!groups[r.group_id]) groups[r.group_id] = [];
        groups[r.group_id].push(r);
      } else {
        singles.push(r);
      }
    });

    const result: CardItem[] = [
      ...Object.values(groups).map(g => {
        const firstDay    = new Date(g[0].date + "T12:00:00").getDay();
        const isSemestral = g.every(r => new Date(r.date + "T12:00:00").getDay() === firstDay) && g.length >= 4;
        return {
          id:          g[0].group_id as string,
          isGroup:     true,
          labName:     g[0].laboratory?.name,
          blockName:   g[0].laboratory?.block,
          status:      g[0].status,
          dateDisplay: isSemestral
            ? `Toda ${WEEKDAY_NAMES[firstDay]} (${g.length} aulas)`
            : `Múltiplas Datas (${g.length} aulas)`,
          timeDisplay: g[0].slots?.map(sl => sl.code).join(", ") || "—",
          rawDate:     new Date(g[0].created_at),
        };
      }),
      ...singles.map(s => ({
        id:          s.id.toString(),
        isGroup:     false,
        labName:     s.laboratory?.name,
        blockName:   s.laboratory?.block,
        status:      s.status,
        dateDisplay: new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR"),
        timeDisplay: s.slots?.map(sl => sl.code).join(", ") || "—",
        rawDate:     new Date(s.created_at),
      })),
    ];

    type CardItemWithDate = CardItem & { rawDate: Date };
    return (result as CardItemWithDate[])
      .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
      .map(({ rawDate: _rawDate, ...rest }): CardItem => rest as CardItem);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Minhas Reservas</h2>
          <p className="text-sm text-neutral-500 mt-1">Acompanhe o status das aulas que você solicitou.</p>
        </div>
        <button
          onClick={onNewReservation}
          className="bg-neutral-900 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-colors shadow-sm"
        >
          <Plus size={18} /> Nova Reserva
        </button>
      </div>

      {/* Estatísticas */}
      {!loading && data && <StatsBar data={data} />}

      {loading && <LoadingSpinner label="Carregando suas reservas..." />}
      {error   && <ErrorMessage message={error} onRetry={refetch} />}

      {/* Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-dashed border-neutral-200 p-12 text-center">
              <Calendar className="mx-auto text-neutral-200 mb-4" size={48} />
              <p className="text-neutral-500 font-medium">Você ainda não possui reservas.</p>
              <button
                onClick={onNewReservation}
                className="mt-4 text-sm font-bold text-neutral-700 underline underline-offset-2 hover:text-neutral-900 transition-colors"
              >
                Criar sua primeira reserva
              </button>
            </div>
          ) : (
            cards.map(res => <ReservationCard key={res.id} res={res} />)
          )}
        </div>
      )}
    </div>
  );
}
