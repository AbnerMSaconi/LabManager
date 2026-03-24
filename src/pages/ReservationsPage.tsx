import React, { useState, useMemo } from "react";
import { 
  Monitor, CheckCircle2, XCircle, Calendar, AlertTriangle, Layers, 
  ChevronDown, ChevronUp, CalendarDays, Search, Trash2, Edit, Package, Building2, ChevronLeft, Info 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserRole, ReservationStatus, Reservation, LaboratoryBlock, Laboratory } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { reservationsApi, ReviewPayload } from "../api/reservationsApi";
import { labsApi } from "../api/labsApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";

const STATUS_STYLES: Record<string, string> = {
  [ReservationStatus.APROVADO]:            "bg-emerald-100 text-emerald-700 border-emerald-200",
  [ReservationStatus.PENDENTE]:            "bg-amber-100 text-amber-700 border-amber-200",
  [ReservationStatus.REJEITADO]:           "bg-red-100 text-red-700 border-red-200",
  [ReservationStatus.EM_USO]:              "bg-blue-100 text-blue-700 border-blue-200",
  [ReservationStatus.CONCLUIDO]:           "bg-neutral-100 text-neutral-500 border-neutral-200",
  [ReservationStatus.AGUARDANDO_SOFTWARE]: "bg-purple-100 text-purple-700 border-purple-200",
  [ReservationStatus.CANCELADO]:           "bg-neutral-100 text-neutral-400 border-neutral-200",
};

const TIME_SLOTS = ["M1", "M2", "M3", "M4", "M5", "M6", "T1", "T2", "T3", "T4", "T5", "T6", "N1", "N2", "N3", "N4"];
const WEEK_DAYS = [
  { id: 1, label: "Segunda" }, { id: 2, label: "Terça" }, { id: 3, label: "Quarta" },
  { id: 4, label: "Quinta" }, { id: 5, label: "Sexta" }, { id: 6, label: "Sábado" }
];

const WEEKDAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function StatusBadge({ status }: { status: string }) {
  if (!status) return null; // Trava de segurança extra
  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ============================================================================
// 1. VISUALIZAÇÃO DO PROFESSOR (CARDS)
// ============================================================================
function ProfessorReservations({ onNewReservation }: { onNewReservation: () => void }) {
  const { data, loading, error, refetch } = useFetch(reservationsApi.listMy);
  
  const groupedReservations = useMemo(() => {
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

    const result = [
      ...Object.values(groups).map(g => {
        const firstDay = new Date(g[0].date + "T12:00:00").getDay();
        const isSemestral = g.every(r => new Date(r.date + "T12:00:00").getDay() === firstDay) && g.length >= 4;
        
        return {
          id: g[0].group_id as string,
          isGroup: true,
          labName: g[0].laboratory?.name,
          blockName: g[0].laboratory?.block,
          status: g[0].status,
          dateDisplay: isSemestral ? `Toda ${WEEKDAY_NAMES[firstDay]} (${g.length} aulas)` : `Múltiplas Datas (${g.length} aulas)`,
          timeDisplay: g[0].slots?.map(sl => sl.code).join(", ") || "—",
          rawDate: new Date(g[0].created_at)
        };
      }),
      ...singles.map(s => ({
        id: s.id.toString(),
        isGroup: false,
        labName: s.laboratory?.name,
        blockName: s.laboratory?.block,
        status: s.status,
        dateDisplay: new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR"),
        timeDisplay: s.slots?.map(sl => sl.code).join(", ") || "—",
        rawDate: new Date(s.created_at)
      }))
    ];

    return result.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Minhas Solicitações</h2>
          <p className="text-sm text-neutral-500 mt-1">Acompanhe as aulas agendadas por você.</p>
        </div>
        <button onClick={onNewReservation} className="bg-neutral-900 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-colors shadow-sm">
          <Plus size={18} /> Nova Reserva
        </button>
      </div>

      {loading && <LoadingSpinner label="Carregando suas reservas..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groupedReservations.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-dashed border-neutral-200 p-12 text-center">
              <Calendar className="mx-auto text-neutral-200 mb-4" size={48} />
              <p className="text-neutral-500 font-medium">Você ainda não possui reservas.</p>
            </div>
          ) : (
            groupedReservations.map(res => (
              <div key={res.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start gap-2 mb-4">
                  <StatusBadge status={res.status} />
                  {res.isGroup && <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase"><Layers size={10} className="inline mr-1 -mt-0.5"/>Lote</span>}
                </div>
                
                <div>
                  <h3 className="font-bold text-neutral-900 text-lg leading-tight mb-1">{res.timeDisplay}</h3>
                  <p className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5"><Monitor size={14} className="text-neutral-400" /> {res.labName ?? "—"}</p>
                  <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1.5"><Building2 size={12} className="text-neutral-400" /> {res.blockName ?? "—"}</p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 flex items-center gap-1.5"><CalendarDays size={14} className="text-neutral-400"/> {res.dateDisplay}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================================
// 2. TIMETABLE WIZARD (Passo a Passo)
// ============================================================================
function TimetableWizard({ onClose }: { onClose: () => void }) {
  const { showToast, ToastComponent } = useToast();
  const { data: labs, loading: labsLoading } = useFetch(labsApi.list);
  const { data: allReservations, loading: resLoading } = useFetch(reservationsApi.listAll);

  const [step, setStep] = useState(1);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [selectedLab, setSelectedLab] = useState<Laboratory | null>(null);
  
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [actionConfirm, setActionConfirm] = useState<"edit" | "delete" | null>(null);

  const availableBlocks = useMemo(() => {
    if (!labs) return [];
    const blocks = new Set<string>();
    labs.forEach(l => { if (l.block) blocks.add(l.block); });
    return Array.from(blocks).sort();
  }, [labs]);

  const filteredLabs = useMemo(() => (labs || []).filter(l => l.block === selectedBlock), [labs, selectedBlock]);

  const weekReservations = useMemo(() => {
    if (!selectedLab || !allReservations) return [];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 5);

    return allReservations.filter(r => {
      if (r.lab_id !== selectedLab.id) return false;
      const rDate = new Date(r.date + "T00:00:00");
      return rDate >= startOfWeek && rDate <= endOfWeek && r.status !== ReservationStatus.REJEITADO && r.status !== ReservationStatus.CANCELADO;
    });
  }, [allReservations, selectedLab]);

  const handleMockAction = (action: string) => {
    showToast(`O endpoint de ${action} precisa ser configurado no backend primeiro.`, "warning");
    setActionConfirm(null);
    setSelectedReservation(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {ToastComponent}
      
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-2"><CalendarDays /> Verificador de Grade</h2>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 font-bold px-4 py-2 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors"><X size={18} className="inline mr-1"/> Fechar</button>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-neutral-900">1. Selecione o Bloco</h3>
              <p className="text-neutral-500 text-sm mt-1">Escolha o bloco para ver os laboratórios disponíveis.</p>
            </div>
            {labsLoading ? <LoadingSpinner /> : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                {availableBlocks.map(b => (
                  <button key={b} onClick={() => { setSelectedBlock(b); setStep(2); }}
                    className="p-6 rounded-2xl border-2 border-neutral-100 hover:border-neutral-900 transition-all text-center group bg-neutral-50 hover:bg-white">
                    <Building2 size={32} className="mx-auto mb-3 text-neutral-300 group-hover:text-neutral-900 transition-colors" />
                    <span className="font-bold text-sm">{b}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 text-neutral-400 hover:text-neutral-900 font-bold text-sm mb-4"><ChevronLeft size={16}/> Voltar aos Blocos</button>
            <div className="text-center">
              <h3 className="text-xl font-bold text-neutral-900">2. Selecione o Laboratório ({selectedBlock})</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {filteredLabs.map(l => (
                <button key={l.id} onClick={() => { setSelectedLab(l); setStep(3); }}
                  className="p-4 rounded-xl border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg border border-neutral-100 shadow-sm"><Monitor size={20} className="text-blue-500"/></div>
                  <div>
                    <p className="font-bold text-sm text-neutral-800">{l.name}</p>
                    <p className="text-xs text-neutral-500">Sala {l.room_number}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && selectedLab && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 font-bold text-sm bg-white px-4 py-2 rounded-xl border border-neutral-200 w-fit shadow-sm"><ChevronLeft size={16}/> Voltar aos Laboratórios</button>
            
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-neutral-100 bg-neutral-50">
                <h3 className="font-bold text-lg text-neutral-800">Grade Semanal: {selectedLab.name}</h3>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-white border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest w-20 text-center">Horário</th>
                      {WEEK_DAYS.map(day => (
                        <th key={day.id} className="px-4 py-4 text-xs font-bold text-neutral-800 uppercase text-center border-l border-neutral-100">{day.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {resLoading ? (
                       <tr><td colSpan={7} className="p-12 text-center"><LoadingSpinner label="Buscando agendamentos..." /></td></tr>
                    ) : (
                      TIME_SLOTS.map(slotCode => (
                        <tr key={slotCode} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-neutral-500 bg-neutral-50/50 border-r border-neutral-100 text-center">{slotCode}</td>
                          {WEEK_DAYS.map(day => {
                            const res = weekReservations.find(r => {
                              const rDay = new Date(r.date + "T00:00:00").getDay();
                              return rDay === day.id && r.slots?.some(s => s.code === slotCode);
                            });
                            return (
                              <td key={`${day.id}-${slotCode}`} className="border-l border-neutral-100 p-1.5">
                                {res ? (
                                  <div onClick={() => setSelectedReservation(res)} className={`cursor-pointer h-full p-2.5 rounded-xl border text-center transition-all hover:shadow-md ${STATUS_STYLES[res.status] || "bg-neutral-100"}`}>
                                    <p className="text-[11px] font-bold truncate leading-tight" title={res.user?.full_name}>{res.user?.full_name}</p>
                                    {res.group_id && <p className="text-[9px] font-bold opacity-70 mt-1 uppercase tracking-widest"><Layers size={10} className="inline mr-0.5 -mt-0.5"/> Lote</p>}
                                  </div>
                                ) : (
                                  <div className="h-full w-full min-h-[48px] rounded-xl border border-dashed border-transparent hover:border-neutral-200 transition-colors bg-transparent"></div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes da Grade */}
      {selectedReservation && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-black/5 p-6 space-y-5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Info size={20} className="text-neutral-400"/> Detalhes</h3>
              <button onClick={() => setSelectedReservation(null)} className="text-neutral-400 hover:text-neutral-900"><XCircle size={24}/></button>
            </div>
            <div className="space-y-3 bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-neutral-400 uppercase">Professor</span><span className="text-sm font-bold text-neutral-900">{selectedReservation.user?.full_name}</span></div>
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-neutral-400 uppercase">Data</span><span className="text-sm font-bold text-neutral-900">{new Date(selectedReservation.date + "T12:00:00").toLocaleDateString('pt-BR')}</span></div>
              <div className="flex justify-between items-center"><span className="text-xs font-bold text-neutral-400 uppercase">Horários</span><span className="text-sm font-bold text-neutral-900">{selectedReservation.slots?.map(s => s.code).join(", ")}</span></div>
              <div className="flex justify-between items-center pt-2 border-t border-neutral-100"><span className="text-xs font-bold text-neutral-400 uppercase">Status</span><StatusBadge status={selectedReservation.status} /></div>
            </div>
            <div className="pt-2 flex gap-3">
              <button onClick={() => { showToast("Rota de edição será conectada na próxima atualização", "info"); setSelectedReservation(null); }} className="flex-1 flex items-center justify-center gap-2 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 border border-neutral-200"><Edit size={16}/> Editar</button>
              <button onClick={() => { showToast("Rota de exclusão será conectada na próxima atualização", "info"); setSelectedReservation(null); }} className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 border border-red-100"><Trash2 size={16}/> Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. VISUALIZAÇÃO DO ADMINISTRADOR (TABELA)
// ============================================================================
function AdminReservations() {
  const { showToast, ToastComponent } = useToast();
  const { data, loading, error, refetch } = useFetch(reservationsApi.listAll);

  const [filter, setFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "timetable">("list");
  
  const ITEMS_PER_PAGE = 15;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") {
      return data.filter(r => r.status !== ReservationStatus.REJEITADO && r.status !== ReservationStatus.CANCELADO);
    }
    return data.filter(r => r.status === filter);
  }, [data, filter]);

  const paginatedData = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const { groups, singles } = useMemo(() => {
    const grps: Record<string, Reservation[]> = {};
    const sgls: Reservation[] = [];
    
    paginatedData.forEach(r => {
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
  }, [paginatedData]);

  const handleReviewSingle = async (id: number, payload: ReviewPayload) => {
    try {
      await reservationsApi.review(id, payload);
      showToast("Reserva atualizada com sucesso.", "success");
      refetch();
    } catch (err) { showToast("Erro ao atualizar.", "error"); }
  };

  const handleReviewGroup = async (groupId: string, payload: ReviewPayload) => {
    try {
      await reservationsApi.reviewGroup(groupId, payload);
      showToast("Lote atualizado com sucesso.", "success");
      refetch();
    } catch (err) { showToast("Erro ao atualizar lote.", "error"); }
  };

  // Sub-componente Row para avulsas
  const TableRow = ({ r }: { r: Reservation }) => {
    return (
      <tr className="hover:bg-neutral-50 transition-colors border-b border-neutral-100">
        <td className="px-6 py-4"><p className="font-bold text-sm text-neutral-900">{r.user?.full_name}</p></td>
        <td className="px-6 py-4">
          <p className="text-sm font-bold text-neutral-800">{r.laboratory?.name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{r.laboratory?.block}</p>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm font-medium text-neutral-600 flex items-center gap-1.5"><CalendarDays size={14} className="text-neutral-400"/>{new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
        </td>
        <td className="px-6 py-4">
          <p className="text-sm font-bold text-neutral-700">{r.slots?.map(s => s.code).join(", ") || "—"}</p>
          <div className="flex gap-2 mt-1">
            {r.items && r.items.length > 0 && <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Materiais</span>}
            {r.requested_softwares && <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">Software</span>}
          </div>
        </td>
        <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
        <td className="px-6 py-4 text-right">
          {r.status === ReservationStatus.PENDENTE && (
            <div className="flex justify-end gap-2">
              <button onClick={() => handleReviewSingle(r.id, { status: ReservationStatus.APROVADO })} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"><CheckCircle2 size={16}/></button>
              <button onClick={() => handleReviewSingle(r.id, { status: ReservationStatus.REJEITADO, rejection_reason: "Indisponibilidade" })} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><XCircle size={16}/></button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  // Sub-componente Row para Lotes (Semestrais ou Pontuais)
  const GroupRow = ({ group }: { group: Reservation[] }) => {
    const [expanded, setExpanded] = useState(false);
    const first = group[0];
    
    const firstDay = new Date(first.date + "T12:00:00").getDay();
    const isSemestral = group.every(r => new Date(r.date + "T12:00:00").getDay() === firstDay) && group.length >= 4;

    return (
      <tr className="border-b border-neutral-200 bg-neutral-50/30 hover:bg-neutral-50 transition-colors">
        <td className="px-6 py-4">
          <p className="font-bold text-sm text-neutral-900">{first.user?.full_name}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200"><Layers size={10}/> {isSemestral ? "LOTE SEMESTRAL" : "LOTE PONTUAL"} ({group.length})</span>
        </td>
        <td className="px-6 py-4">
          <p className="text-sm font-bold text-neutral-800">{first.laboratory?.name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{first.laboratory?.block}</p>
        </td>
        <td className="px-6 py-4 relative">
          {isSemestral ? (
            <span className="text-sm font-bold text-neutral-700 flex items-center gap-1.5"><CalendarDays size={14} className="text-blue-500"/>Toda {WEEKDAY_NAMES[firstDay]}</span>
          ) : (
            <div className="relative">
              <button onClick={() => setExpanded(!expanded)} className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors">
                <CalendarDays size={14} /> Múltiplas Datas {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </button>
              <div className={`absolute top-full left-0 z-30 mt-2 bg-white border border-neutral-200 rounded-xl shadow-xl w-56 overflow-hidden transition-all duration-200 origin-top-left ${expanded ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
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
          <div className="flex gap-2 mt-1">
            {first.items && first.items.length > 0 && <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Materiais</span>}
            {first.requested_softwares && <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">Software</span>}
          </div>
        </td>
        <td className="px-6 py-4"><StatusBadge status={first.status} /></td>
        <td className="px-6 py-4 text-right">
          {first.status === ReservationStatus.PENDENTE && (
            <div className="flex justify-end gap-2">
              <button onClick={() => handleReviewGroup(first.group_id as string, { status: ReservationStatus.APROVADO })} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-xs hover:bg-emerald-100 transition-colors border border-emerald-200"><CheckCircle2 size={14}/> Aprovar Lote</button>
              <button onClick={() => handleReviewGroup(first.group_id as string, { status: ReservationStatus.REJEITADO, rejection_reason: "Indisponibilidade no Semestre" })} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-bold text-xs hover:bg-red-100 transition-colors border border-red-200"><XCircle size={14}/> Rejeitar Lote</button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  if (viewMode === "timetable") return <TimetableWizard onClose={() => setViewMode("list")} />;

  return (
    <div className="space-y-6 pb-12">
      {ToastComponent}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Gerenciar Solicitações</h2>
          <p className="text-sm text-neutral-500 mt-1">Controle de aprovações e agendamentos da universidade.</p>
        </div>
        <button onClick={() => setViewMode("timetable")} className="bg-white border border-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-50 transition-colors shadow-sm">
          <Search size={18} /> Verificar Grade
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {(["all", ReservationStatus.PENDENTE, ReservationStatus.APROVADO, ReservationStatus.AGUARDANDO_SOFTWARE] as const).map(s => (
          <button key={s} onClick={() => { setFilter(s); setVisibleCount(ITEMS_PER_PAGE); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${filter === s ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}>
            {s === "all" ? "Aprovadas / Pendentes" : s.replace(/_/g, " ").toUpperCase()}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {loading && <LoadingSpinner label="Carregando matriz de reservas..." />}
        {error && <ErrorMessage message={error} onRetry={refetch} />}

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
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Nome do Professor</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Laboratório Solicitado</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Dias da Reserva</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Blocos de Horários</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {Object.entries(groups).map(([groupId, group]) => <GroupRow key={groupId} group={group} />)}
                  {singles.map(r => <TableRow key={r.id} r={r} />)}
                </tbody>
              </table>

              <div className="p-5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <span className="text-sm text-neutral-500 font-medium flex items-center gap-2"><Layers size={16} /> Exibindo {paginatedData.length} de {filtered.length} registros</span>
                {hasMore && <button onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)} className="px-6 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-sm">Carregar Mais Registros</button>}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ENTRY POINT
// ============================================================================
export function ReservationsPage({ onNewReservation }: { onNewReservation: () => void }) {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === UserRole.PROFESSOR) {
    return <ProfessorReservations onNewReservation={onNewReservation} />;
  }

  return <AdminReservations />;
}