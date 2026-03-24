import React, { useState, useMemo } from "react";
import { Calendar, Package, Monitor, ChevronRight, Map, Building2, LayoutGrid, Wrench, Users } from "lucide-react";
import { UserRole, ReservationStatus, Reservation } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi } from "../api/reservationsApi";
import { labsApi } from "../api/labsApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";

const STATUS_STYLES: Record<string, string> = {
  [ReservationStatus.APROVADO]:           "bg-emerald-100 text-emerald-700 border-emerald-200",
  [ReservationStatus.PENDENTE]:           "bg-amber-100 text-amber-700 border-amber-200",
  [ReservationStatus.REJEITADO]:          "bg-red-100 text-red-700 border-red-200",
  [ReservationStatus.EM_USO]:             "bg-blue-100 text-blue-700 border-blue-200",
  [ReservationStatus.CONCLUIDO]:          "bg-neutral-100 text-neutral-500 border-neutral-200",
  [ReservationStatus.AGUARDANDO_SOFTWARE]:"bg-purple-100 text-purple-700 border-purple-200",
  [ReservationStatus.CANCELADO]:          "bg-neutral-100 text-neutral-400 border-neutral-200",
};

// ============================================================================
// HELPERS
// ============================================================================
function formatContinuousSlots(slots: any[]) {
  if (!slots || slots.length === 0) return "—";
  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const blocks: string[] = [];
  let current = { start: sorted[0].start_time, end: sorted[0].end_time };

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_time === current.end) {
      current.end = sorted[i].end_time;
    } else {
      blocks.push(`${current.start} às ${current.end}`);
      current = { start: sorted[i].start_time, end: sorted[i].end_time };
    }
  }
  blocks.push(`${current.start} às ${current.end}`);
  return blocks.join(" | ");
}

// ============================================================================
// COMPONENTE COMPARTILHADO: MAPA DE LABORATÓRIOS EM TEMPO REAL
// ============================================================================
interface LiveLabMapProps {
  onTitleClick?: () => void;
  inverted?: boolean;
  customTitle?: string;
}

function LiveLabMap({ onTitleClick, inverted = false, customTitle = "Ocupação em Tempo Real" }: LiveLabMapProps) {
  const { data: labs, loading: labsLoading } = useFetch(labsApi.list);
  const { data: today, loading: todayLoading } = useFetch(reservationsApi.listToday);
  
  const [blockFilter, setBlockFilter] = useState<string>("all");

  const availableBlocks = useMemo(() => {
    if (!labs) return [];
    const blocks = new Set<string>();
    labs.forEach(l => { if (l.block) blocks.add(l.block); });
    return Array.from(blocks).sort();
  }, [labs]);

  const displayedLabs = useMemo(() => {
    if (!labs) return [];
    let filtered = labs;
    if (blockFilter !== "all") {
      filtered = filtered.filter(l => l.block === blockFilter);
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [labs, blockFilter]);

  if (labsLoading || todayLoading) return <LoadingSpinner label="Carregando mapa em tempo real..." />;

  return (
    <section className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div 
          onClick={onTitleClick} 
          className={`flex items-center gap-2 w-fit ${onTitleClick ? 'cursor-pointer hover:text-blue-600 transition-colors group' : ''}`}
          title={onTitleClick ? "Ir para Agenda do Dia" : undefined}
        >
          {inverted ? <Users className={`text-neutral-400 ${onTitleClick ? 'group-hover:text-blue-500' : ''}`} size={20} /> : <Map className={`text-neutral-400 ${onTitleClick ? 'group-hover:text-blue-500' : ''}`} size={20} />}
          <h2 className="text-lg font-bold">{customTitle}</h2>
          {onTitleClick && <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 -ml-1" />}
        </div>

        {availableBlocks.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <div className="flex items-center gap-1.5 shrink-0 text-neutral-400 mr-1">
              <Building2 size={14} />
            </div>
            <button
              onClick={() => setBlockFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all border ${
                blockFilter === "all" ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"
              }`}
            >
              Todos
            </button>
            {availableBlocks.map(block => (
              <button
                key={block}
                onClick={() => setBlockFilter(block)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all border ${
                  blockFilter === block ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"
                }`}
              >
                {block}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {displayedLabs.map(lab => {
          const currentRes = today?.find(r => r.lab_id === lab.id && r.status === ReservationStatus.EM_USO);
          const isOccupied = !!currentRes;

          return (
            <div key={lab.id} className={`p-4 rounded-xl border transition-all flex flex-col justify-between min-h-[100px] ${isOccupied ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-white border-neutral-200 hover:border-neutral-300"}`}>
               <div className="flex justify-between items-start mb-2 gap-2">
                 <span className={`font-bold text-sm truncate ${inverted && isOccupied ? "text-blue-800" : "text-neutral-800"}`} title={inverted && isOccupied ? currentRes.user?.full_name : lab.name}>
                   {inverted && isOccupied ? currentRes.user?.full_name : lab.name}
                 </span>
                 {isOccupied ? (
                    <span className="flex h-2.5 w-2.5 relative shrink-0 mt-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                    </span>
                 ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 mt-1" title="Livre"></span>
                 )}
               </div>
               
               {isOccupied ? (
                 <div className={`text-xs mt-1 ${inverted ? "text-neutral-600" : "text-blue-800"}`}>
                   <p className="font-medium truncate" title={inverted ? lab.name : currentRes.user?.full_name}>
                     {inverted ? <><Building2 size={10} className="inline mr-1 -mt-0.5"/>{lab.name}</> : currentRes.user?.full_name}
                   </p>
                   <p className={`mt-0.5 ${inverted ? "text-blue-600 font-bold" : "opacity-80"}`}>
                     {inverted ? "Em aula agora" : "Em aula agora"}
                   </p>
                 </div>
               ) : (
                 <p className="text-xs text-neutral-400 mt-auto font-medium">{inverted ? "Sem professor alocado" : "Livre"}</p>
               )}
            </div>
          )
        })}
        {displayedLabs.length === 0 && (
          <div className="col-span-full text-center py-12 text-neutral-400 text-sm border-2 border-dashed border-neutral-200 rounded-2xl">
            Nenhum laboratório encontrado para este bloco.
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// DASHBOARD DTI
// ============================================================================
function DTIDashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: pending } = useFetch(reservationsApi.listPending);
  const { data: today }   = useFetch(reservationsApi.listToday);
  const { data: software } = useFetch(reservationsApi.listAwaitingSoftware);

  return (
    <div className="space-y-8 pb-12 w-full">
      <header>
        <h1 className="text-3xl font-bold text-neutral-900">Painel DTI</h1>
        <p className="text-neutral-500">Visão geral da operação e infraestrutura.</p>
      </header>

      {/* SEÇÃO 1: MAPA EM TEMPO REAL */}
      <LiveLabMap onTitleClick={() => onNavigate?.('daily')} />

      {/* SEÇÃO 2: ESTATÍSTICAS OPERACIONAIS */}
      <section className="space-y-4 pt-4 border-t border-neutral-200">
        <div 
          onClick={() => onNavigate?.('reservations')} 
          className="flex items-center gap-2 w-fit cursor-pointer hover:text-blue-600 transition-colors group"
          title="Ir para Gerenciamento de Reservas"
        >
          <LayoutGrid className="text-neutral-400 group-hover:text-blue-500 transition-colors" size={20} />
          <h2 className="text-lg font-bold">Resumo Operacional</h2>
          <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 -ml-1" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Pendentes (Aprovação)", value: pending?.filter(r => r.status === ReservationStatus.PENDENTE).length ?? "—" },
            { label: "Agendamentos p/ Hoje",  value: today?.length ?? "—" },
            { label: "Aguardando Software",   value: software?.length ?? "—" },
          ].map(stat => (
            <div key={stat.label} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition-colors">
              <p className="text-[10px] md:text-xs font-bold text-neutral-400 uppercase mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-neutral-800">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO 3: RESUMO DE MANUTENÇÃO */}
      <section className="space-y-4 pt-4 border-t border-neutral-200">
        <div 
          onClick={() => onNavigate?.('maintenance')} 
          className="flex items-center gap-2 w-fit cursor-pointer hover:text-blue-600 transition-colors group"
          title="Ir para Controle de Manutenção"
        >
          <Wrench className="text-neutral-400 group-hover:text-blue-500 transition-colors" size={20} />
          <h2 className="text-lg font-bold">Resumo de Manutenção</h2>
          <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 -ml-1" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Tickets Abertos", value: "0" },
            { label: "Em Andamento",    value: "0" },
            { label: "Críticos",        value: "0", highlight: true },
          ].map(stat => (
            <div key={stat.label} className={`bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all ${stat.highlight ? 'border-red-200 bg-red-50/50' : 'border-neutral-200'}`}>
              <p className={`text-[10px] md:text-xs font-bold uppercase mb-1 ${stat.highlight ? 'text-red-500' : 'text-neutral-400'}`}>{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.highlight ? 'text-red-600' : 'text-neutral-800'}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// DASHBOARD DO PROFESSOR
// ============================================================================
function ProfessorDashboard({ onNewReservation }: { onNewReservation: () => void }) {
  const { data, loading, error, refetch } = useFetch(reservationsApi.listMy);
  const { showToast, ToastComponent } = useToast();
  
  const [weekdayFilter, setWeekdayFilter] = useState<string>("all");

  const WEEKDAYS = [
    { value: "all", label: "Todos os dias" },
    { value: "1", label: "Segunda" },
    { value: "2", label: "Terça" },
    { value: "3", label: "Quarta" },
    { value: "4", label: "Quinta" },
    { value: "5", label: "Sexta" },
    { value: "6", label: "Sábado" },
  ];

  const groupedReservations = useMemo(() => {
    let filtered = data || [];
    if (weekdayFilter !== "all") {
      filtered = filtered.filter(r => new Date(r.date).getDay().toString() === weekdayFilter);
    }

    const groups: Record<string, Reservation[]> = {};
    const singles: Reservation[] = [];

    filtered.forEach(r => {
      if (r.group_id) {
        if (!groups[r.group_id]) groups[r.group_id] = [];
        groups[r.group_id].push(r);
      } else {
        singles.push(r);
      }
    });

    const result = [
      ...Object.values(groups).map(g => ({
        id: g[0].group_id as string,
        isGroup: true,
        title: "Lote Semestral",
        labName: g[0].laboratory?.name,
        blockName: g[0].laboratory?.block,
        status: g[0].status,
        dateDisplay: `Cronograma Semestral (${g.length} aulas)`,
        timeDisplay: formatContinuousSlots(g[0].slots || []),
        rawDate: new Date(g[0].created_at) 
      })),
      ...singles.map(s => ({
        id: s.id.toString(),
        isGroup: false,
        title: "Aula Avulsa",
        labName: s.laboratory?.name,
        blockName: s.laboratory?.block,
        status: s.status,
        dateDisplay: new Date(s.date).toLocaleDateString("pt-BR"),
        timeDisplay: formatContinuousSlots(s.slots || []),
        rawDate: new Date(s.created_at)
      }))
    ];

    return result.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }, [data, weekdayFilter]);

  const handleMateriaisAvulsos = () => {
    showToast("A solicitação de materiais avulsos será disponibilizada na próxima atualização.", "info");
  };

  return (
    <div className="space-y-8">
      {ToastComponent}
      <header>
        <h1 className="text-3xl font-bold text-neutral-900">Início</h1>
        <p className="text-neutral-500">Gerencie suas aulas e solicitações de laboratório.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div onClick={onNewReservation} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-800">Nova Reserva</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Solicitar laboratório</p>
          </div>
        </div>

        <div onClick={handleMateriaisAvulsos} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Package size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-800">Materiais Avulsos</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Equipar aulas ativas</p>
          </div>
        </div>

        <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 opacity-60 cursor-not-allowed flex items-center gap-4">
          <div className="bg-neutral-200 text-neutral-500 w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
            <Monitor size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-700">Consultar Labs</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Desativado</p>
          </div>
        </div>
      </div>

      <section className="space-y-4 pt-4 border-t border-neutral-200">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <h2 className="font-bold text-lg">Minhas Reservas</h2>
          
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {WEEKDAYS.map(day => (
              <button key={day.value} onClick={() => setWeekdayFilter(day.value)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${
                  weekdayFilter === day.value ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"
                }`}>
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <LoadingSpinner label="Carregando reservas..." />}
        {error && <ErrorMessage message={error} onRetry={refetch} />}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groupedReservations.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl border border-dashed border-neutral-200 p-12 text-center">
                <Calendar className="mx-auto text-neutral-200 mb-4" size={48} />
                <p className="text-neutral-500 font-medium">Nenhuma reserva encontrada para este filtro.</p>
              </div>
            ) : (
              groupedReservations.map(res => (
                <div key={res.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase ${STATUS_STYLES[res.status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
                      {res.status.replace("_", " ")}
                    </span>
                    {res.isGroup && <span className="bg-neutral-100 text-neutral-500 border border-neutral-200 px-2 py-1 rounded-md text-[10px] font-bold">LOTE</span>}
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-neutral-900 text-lg leading-tight mb-1">{res.timeDisplay}</h3>
                    <p className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
                      <Monitor size={14} className="text-neutral-400" />
                      {res.labName ?? "Laboratório não definido"}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1.5">
                      <Building2 size={12} className="text-neutral-400" />
                      {res.blockName ?? "Sem Bloco"}
                    </p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-400">{res.dateDisplay}</span>
                    <button className="text-blue-600 hover:text-blue-800 text-[10px] font-bold uppercase tracking-wider transition-colors">Ver Detalhes</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// DASHBOARD PROGEX
// ============================================================================
function ProgexDashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  return (
    <div className="space-y-8 pb-12 w-full">
      <header>
        <h1 className="text-3xl font-bold text-neutral-900">Visão Executiva</h1>
        <p className="text-neutral-500">Monitoramento global da ocupação e infraestrutura.</p>
      </header>
      
      {/* Progex: Mapa invertido dando foco no Professor */}
      <LiveLabMap inverted={true} customTitle="Professores Ativos Agora" onTitleClick={() => onNavigate?.('daily')} />
    </div>
  );
}

// ============================================================================
// ENTRYPOINT / ROUTER
// ============================================================================
export function DashboardPage({ onNewReservation, onNavigate }: { onNewReservation: () => void, onNavigate?: (page: string) => void }) {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === UserRole.PROFESSOR) return <ProfessorDashboard onNewReservation={onNewReservation} />;
  if (user.role === UserRole.PROGEX) return <ProgexDashboard onNavigate={onNavigate} />;
  return <DTIDashboard onNavigate={onNavigate} />;
}