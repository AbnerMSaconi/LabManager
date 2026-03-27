/**
 * Tela de Reservas — visão do PROFESSOR
 */
import React, { useMemo, useState } from "react";
import {
  Monitor, Calendar, Layers, CalendarDays, Building2,
  Plus, ClipboardList, CheckCircle2, Clock, Filter
} from "lucide-react";
import { ReservationStatus, Reservation } from "../types";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi } from "../api/reservationsApi";
import { LoadingSpinner, ErrorMessage } from "../components/ui";
import { STATUS_STYLES, WEEKDAY_NAMES, StatusBadge, CustomDropdown } from "./reservationShared";

function StatsBar({ data }: { data: Reservation[] }) {
  const total     = data.length;
  const pendentes = data.filter(r => r.status === ReservationStatus.PENDENTE).length;
  const aprovadas = data.filter(r => r.status === ReservationStatus.APROVADO || r.status === ReservationStatus.EM_USO).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="bg-neutral-100 p-3 rounded-2xl shadow-inner"><ClipboardList size={22} className="text-neutral-500" /></div>
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Total</p>
          <p className="text-3xl font-black text-neutral-900">{total}</p>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="bg-amber-100 p-3 rounded-2xl shadow-inner"><Clock size={22} className="text-amber-600" /></div>
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Pendentes</p>
          <p className="text-3xl font-black text-neutral-900">{pendentes}</p>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="bg-emerald-100 p-3 rounded-2xl shadow-inner"><CheckCircle2 size={22} className="text-emerald-600" /></div>
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Aprovadas</p>
          <p className="text-3xl font-black text-neutral-900">{aprovadas}</p>
        </div>
      </div>
    </div>
  );
}

type CardItem = {
  id: string; isGroup: boolean; labName?: string; blockName?: string;
  status: ReservationStatus; dateDisplay: string; timeDisplay: string;
};

function ReservationCard({ res }: { res: CardItem }) {
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
    <div className={`bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow ${borderAccent[res.status] ?? ""}`}>
      <div className="flex justify-between items-start gap-2 mb-5">
        <StatusBadge status={res.status} />
        {res.isGroup && (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase shadow-sm">
            <Layers size={10} className="inline mr-1 -mt-0.5" />Lote
          </span>
        )}
      </div>
      <div>
        <h3 className="font-black text-neutral-900 text-xl leading-tight mb-2">{res.timeDisplay}</h3>
        <p className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
          <Monitor size={14} className="text-neutral-400" /> {res.labName ?? "—"}
        </p>
        <p className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
          <Building2 size={12} className="text-neutral-400" /> {res.blockName ?? "—"}
        </p>
      </div>
      <div className="mt-5 pt-4 border-t border-neutral-100 bg-neutral-50/50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
        <span className="text-xs font-bold text-neutral-500 flex items-center gap-2">
          <CalendarDays size={14} className="text-neutral-400" /> {res.dateDisplay}
        </span>
      </div>
    </div>
  );
}

export function ReservationPageProfessor({ onNewReservation }: { onNewReservation: () => void }) {
  const { data, loading, error, refetch } = useFetch(reservationsApi.listMy, [], true);
  const [weekdayFilter, setWeekdayFilter] = useState<string>("all");

  const WEEKDAYS = [
    { value: "all", label: "Todos os dias" },
    { value: "1", label: "Segunda" }, { value: "2", label: "Terça" },
    { value: "3", label: "Quarta" }, { value: "4", label: "Quinta" },
    { value: "5", label: "Sexta" }, { value: "6", label: "Sábado" },
  ];

  const cards = useMemo<CardItem[]>(() => {
    let filtered = data || [];
    if (weekdayFilter !== "all") {
      filtered = filtered.filter(r => new Date(r.date + "T12:00:00").getDay().toString() === weekdayFilter);
    }

    const groups: Record<string, Reservation[]> = {};
    const singles: Reservation[] = [];

    filtered.forEach(r => {
      if (r.group_id) {
        if (!groups[r.group_id]) groups[r.group_id] = [];
        groups[r.group_id].push(r);
      } else { singles.push(r); }
    });

    const result: CardItem[] = [
      ...Object.values(groups).map(g => {
        const firstDay = new Date(g[0].date + "T12:00:00").getDay();
        const isSemestral = g.every(r => new Date(r.date + "T12:00:00").getDay() === firstDay) && g.length >= 4;
        return {
          id: g[0].group_id as string, isGroup: true, labName: g[0].laboratory?.name, blockName: g[0].laboratory?.block, status: g[0].status,
          dateDisplay: isSemestral ? `Toda ${WEEKDAY_NAMES[firstDay]} (${g.length} aulas)` : `Múltiplas Datas (${g.length} aulas)`,
          timeDisplay: g[0].slots?.map(sl => sl.code).join(", ") || "—", rawDate: new Date(g[0].created_at),
        };
      }),
      ...singles.map(s => ({
        id: s.id.toString(), isGroup: false, labName: s.laboratory?.name, blockName: s.laboratory?.block, status: s.status,
        dateDisplay: new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR"),
        timeDisplay: s.slots?.map(sl => sl.code).join(", ") || "—", rawDate: new Date(s.created_at),
      })),
    ];

    type CardItemWithDate = CardItem & { rawDate: Date };
    return (result as CardItemWithDate[]).sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime()).map(({ rawDate: _rawDate, ...rest }): CardItem => rest as CardItem);
  }, [data, weekdayFilter]);

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 border border-neutral-200 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center shadow-inner shrink-0">
             <Calendar size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Minhas Reservas</h1>
            <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-widest">Acompanhamento e Histórico</p>
          </div>
        </div>
        <button onClick={onNewReservation} className="bg-neutral-900 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-all active:scale-95 shadow-md shadow-neutral-900/20">
          <Plus size={18} /> Nova Reserva
        </button>
      </header>

      {!loading && data && <StatsBar data={data} />}

      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-neutral-100 pb-2">
        <h2 className="font-bold text-xl text-neutral-900">Listagem de Agendamentos</h2>
        <div className="w-full sm:w-auto">
          <CustomDropdown value={weekdayFilter} options={WEEKDAYS} onChange={setWeekdayFilter} icon={Filter} />
        </div>
      </div>

      {loading && <LoadingSpinner label="Carregando suas reservas..." />}
      {error   && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.length === 0 ? (
            <div className="col-span-full bg-white rounded-3xl border border-dashed border-neutral-200 p-16 text-center">
              <Calendar className="mx-auto text-neutral-200 mb-4" size={56} />
              <p className="text-neutral-500 font-bold text-lg">Você ainda não possui reservas.</p>
              <button onClick={onNewReservation} className="mt-4 text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors">
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