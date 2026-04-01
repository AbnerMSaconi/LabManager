import React, { useState, useMemo } from "react";
import { Calendar, Package, Monitor, ChevronRight, Map, Building2, LayoutGrid, Wrench, Users, Filter } from "lucide-react";
import { UserRole, ReservationStatus, Reservation } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi } from "../api/reservationsApi";
import { labsApi } from "../api/labsApi";
import { maintenanceApi } from "../api/maintenanceApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { CustomDropdown } from "./reservationShared";

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
  const { data: labs, loading: labsLoading } = useFetch(labsApi.list, [], true);
  const { data: today, loading: todayLoading } = useFetch(reservationsApi.listToday, [], true);
  
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
    <section className="space-y-5 bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
        <div 
          onClick={onTitleClick} 
          className={`flex items-center gap-3 w-fit ${onTitleClick ? 'cursor-pointer hover:text-blue-600 transition-colors group' : ''}`}
          title={onTitleClick ? "Ir para Agenda do Dia" : undefined}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            {inverted ? <Users className="text-blue-600" size={20} /> : <Map className="text-blue-600" size={20} />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 leading-tight">{customTitle}</h2>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mt-0.5">Visão Espacial</p>
          </div>
          {onTitleClick && <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-transform transform translate-x-0 group-hover:translate-x-1 text-blue-500 ml-1" />}
        </div>

        {availableBlocks.length > 0 && (
          <div className="w-full sm:w-auto">
            <CustomDropdown 
              value={blockFilter} 
              options={[{ value: "all", label: "Todos os blocos" }, ...availableBlocks.map(b => ({ value: b, label: b }))]} 
              onChange={setBlockFilter} 
              icon={Building2} 
            />
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {displayedLabs.map(lab => {
        // 1. Horário atual em minutos
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // 2. Pegamos TODAS as reservas deste laboratório para hoje
        // (A API 'listToday' já traz apenas Aprovado, Em Uso e Aguardando Software)
        const labReservations = today?.filter(r => r.lab_id === lab.id) || [];

        // 3. Cruzamos o horário atual com o horário dos slots da reserva
        const currentRes = labReservations.find(r => {
          if (!r.slots || r.slots.length === 0) return false;
          
          // Pega o início da primeira aula e o fim da última aula daquele bloco
          const sortedSlots = [...r.slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
          
          const [startH, startM] = sortedSlots[0].start_time.split(':').map(Number);
          const startMins = startH * 60 + startM;
          
          const [endH, endM] = sortedSlots[sortedSlots.length - 1].end_time.split(':').map(Number);
          const endMins = endH * 60 + endM;
          
          // Está em aula se o relógio estiver entre 15 min ANTES do início até 60 min DEPOIS do fim
          return currentMinutes >= (startMins - 15) && currentMinutes <= (endMins + 60);
        });

        const isOccupied = !!currentRes;

        return (
          <div key={lab.id} className={`p-4 rounded-2xl border transition-all flex flex-col justify-between min-h-[110px] ${isOccupied ? "bg-blue-50/50 border-blue-200 shadow-sm" : "bg-neutral-50 border-neutral-200 hover:border-neutral-300"}`}>
            <div className="flex justify-between items-start mb-2 gap-2">
              <span className={`font-bold text-sm truncate ${inverted && isOccupied ? "text-blue-800" : "text-neutral-800"}`} title={inverted && isOccupied ? currentRes.user?.full_name : lab.name}>
                {inverted && isOccupied ? currentRes.user?.full_name : lab.name}
              </span>
              {isOccupied ? (
                  <span className="flex h-2.5 w-2.5 relative shrink-0 mt-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
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
                <p className={`mt-1 text-[10px] uppercase tracking-wider ${inverted ? "text-blue-600 font-bold" : "opacity-80 font-bold"}`}>
                  {inverted ? "Em aula agora" : "Em aula agora"}
                </p>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 mt-auto font-bold uppercase tracking-wider">{inverted ? "Sem professor" : "Livre"}</p>
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
  const { data: pending }  = useFetch(reservationsApi.listPending, [], true);
  const { data: today }    = useFetch(reservationsApi.listToday, [], true);
  const { data: software } = useFetch(reservationsApi.listAwaitingSoftware, [], true);
  const { data: tickets }  = useFetch(maintenanceApi.list, [], true);

  return (
    <div className="space-y-8 pb-12 w-full">
      <header>
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Painel DTI</h1>
        <p className="text-neutral-500 font-medium mt-1">Visão geral da operação e infraestrutura.</p>
      </header>

      {/* SEÇÃO 1: MAPA EM TEMPO REAL */}
      <LiveLabMap onTitleClick={() => onNavigate?.('daily')} />

      {/* SEÇÃO 2: ESTATÍSTICAS OPERACIONAIS */}
      <section className="space-y-5 pt-4">
        <div 
          onClick={() => onNavigate?.('reservations')} 
          className="flex items-center gap-3 w-fit cursor-pointer hover:text-blue-600 transition-colors group"
          title="Ir para Gerenciamento de Reservas"
        >
          <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-inner">
            <LayoutGrid className="text-white" size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Resumo Operacional</h2>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mt-0.5">Reservas</p>
          </div>
          <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-transform transform translate-x-0 group-hover:translate-x-1 text-blue-500 ml-1" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Pendentes (Aprovação)", value: pending?.filter(r => r.status === ReservationStatus.PENDENTE).length ?? "—" },
            { label: "Agendamentos p/ Hoje",  value: today?.length ?? "—" },
            { label: "Aguardando Software",   value: software?.length ?? "—" },
          ].map(stat => (
            <div key={stat.label} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[10px] md:text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-4xl font-black text-neutral-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO 3: RESUMO DE MANUTENÇÃO */}
      <section className="space-y-5 pt-4">
        <div 
          onClick={() => onNavigate?.('maintenance')} 
          className="flex items-center gap-3 w-fit cursor-pointer hover:text-blue-600 transition-colors group"
          title="Ir para Controle de Manutenção"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors shadow-inner">
            <Wrench className="text-amber-600" size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Infraestrutura</h2>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mt-0.5">Tickets de Manutenção</p>
          </div>
          <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-transform transform translate-x-0 group-hover:translate-x-1 text-blue-500 ml-1" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Tickets Abertos", value: tickets?.filter(t => t.status === "aberto").length ?? "—" },
            { label: "Em Andamento",    value: tickets?.filter(t => t.status === "em_andamento").length ?? "—" },
            { label: "Críticos",        value: tickets?.filter(t => t.severity === "critico" && t.status !== "resolvido").length ?? "—", highlight: true },
          ].map(stat => (
            <div key={stat.label} className={`bg-white p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all ${stat.highlight ? 'border-red-200 bg-red-50/50' : 'border-neutral-200'}`}>
              <p className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1 ${stat.highlight ? 'text-red-600' : 'text-neutral-400'}`}>{stat.label}</p>
              <p className={`text-4xl font-black ${stat.highlight ? 'text-red-700' : 'text-neutral-900'}`}>{stat.value}</p>
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
  const { data, loading, error, refetch } = useFetch(reservationsApi.listMy, [], true);
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
      filtered = filtered.filter(r => new Date(r.date + "T12:00:00").getDay().toString() === weekdayFilter);
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
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Início</h1>
        <p className="text-neutral-500 font-medium mt-1">Gerencie suas aulas e solicitações de laboratório.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div onClick={onNewReservation} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex items-center gap-4">
          <div className="bg-neutral-900 text-white w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-inner">
            <Calendar size={22} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-neutral-900">Nova Reserva</h3>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Agendar Lab</p>
          </div>
        </div>

        <div onClick={handleMateriaisAvulsos} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-emerald-100">
            <Package size={22} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-neutral-900">Materiais Avulsos</h3>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Equipar aulas</p>
          </div>
        </div>

        <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-200 opacity-60 cursor-not-allowed flex items-center gap-4">
          <div className="bg-neutral-200 text-neutral-500 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0">
            <Monitor size={22} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-neutral-700">Consultar Labs</h3>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Desativado</p>
          </div>
        </div>
      </div>

      <section className="space-y-5 pt-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-neutral-100 pb-4">
          <h2 className="font-bold text-xl text-neutral-900">Minhas Reservas</h2>
          
          <div className="w-full sm:w-auto">
            <CustomDropdown 
              value={weekdayFilter} 
              options={WEEKDAYS} 
              onChange={setWeekdayFilter} 
              icon={Filter} 
            />
          </div>
        </div>

        {loading && <LoadingSpinner label="Carregando reservas..." />}
        {error && <ErrorMessage message={error} onRetry={refetch} />}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {groupedReservations.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl border border-dashed border-neutral-200 p-12 text-center">
                <Calendar className="mx-auto text-neutral-200 mb-4" size={56} />
                <p className="text-neutral-500 font-bold text-lg">Nenhuma reserva encontrada para este filtro.</p>
                <button
                  onClick={onNewReservation}
                  className="mt-4 text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  Criar sua primeira reserva
                </button>
              </div>
            ) : (
              groupedReservations.map(res => (
                <div key={res.id} className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start gap-2 mb-5">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${STATUS_STYLES[res.status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
                      {res.status.replace("_", " ")}
                    </span>
                    {res.isGroup && <span className="bg-neutral-100 text-neutral-500 border border-neutral-200 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase">LOTE</span>}
                  </div>
                  
                  <div>
                    <h3 className="font-black text-neutral-900 text-xl leading-tight mb-2">{res.timeDisplay}</h3>
                    <p className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                      <Monitor size={14} className="text-neutral-400" />
                      {res.labName ?? "Laboratório não definido"}
                    </p>
                    <p className="text-xs font-bold text-neutral-500 mt-1 flex items-center gap-2 uppercase tracking-widest">
                      <Building2 size={12} className="text-neutral-400" />
                      {res.blockName ?? "Sem Bloco"}
                    </p>
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-400">{res.dateDisplay}</span>
                    <button className="text-blue-600 hover:text-blue-800 text-[10px] font-bold uppercase tracking-wider transition-colors bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100">Ver Detalhes</button>
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
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Visão Executiva</h1>
        <p className="text-neutral-500 font-medium mt-1">Monitoramento global da ocupação e infraestrutura.</p>
      </header>
      
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
  if (user.role === UserRole.PROGEX || user.role === UserRole.ADMINISTRADOR || user.role === UserRole.SUPER_ADMIN) return <ProgexDashboard onNavigate={onNavigate} />;
  return <DTIDashboard onNavigate={onNavigate} />;
}