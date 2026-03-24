import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2, Monitor, CheckCircle2, XCircle,
  Search, AlertTriangle, Info, ChevronLeft, ChevronRight, X, CalendarDays, Repeat
} from "lucide-react";
import { LaboratoryBlock, Laboratory, LessonSlot, ItemModel, Software, Reservation } from "../types";
import { useFetch } from "../hooks/useFetch";
import { labsApi } from "../api/labsApi";
import { inventoryApi } from "../api/inventoryApi";
import { reservationsApi } from "../api/reservationsApi";
import { LoadingSpinner, useToast } from "../components/ui";
import { ApiError } from "../api/client";

interface CartItem { item: ItemModel; qty: number }

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export function ReservationWizard({ onComplete, onCancel }: Props) {
  const { showToast, ToastComponent } = useToast();

  // Dados da API
  const { data: labs, loading: labsLoading }     = useFetch(labsApi.list);
  const { data: slots, loading: slotsLoading }   = useFetch(labsApi.listSlots);
  const { data: softwares }                      = useFetch(labsApi.listSoftwares);
  const { data: items, loading: itemsLoading }   = useFetch(inventoryApi.listModels);

  // --- ESTADO DO WIZARD ---
  const [step, setStep] = useState(1);
  const [selectedBlock, setSelectedBlock] = useState<LaboratoryBlock | null>(null);
  
  // Gerenciamento de Datas (Lote)
  const [reservationType, setReservationType] = useState<"pontual" | "semestral">("pontual");
  const [dates, setDates] = useState<string[]>([]);
  
  // Auxiliares para cálculo
  const [singleDateInput, setSingleDateInput] = useState("");
  const [semStartDate, setSemStartDate] = useState("");
  const [semEndDate, setSemEndDate] = useState("");
  const [semDayOfWeek, setSemDayOfWeek] = useState<number>(1); // 1 = Segunda, 2 = Terça...

  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>([]);
  const [selectedLab, setSelectedLab] = useState<Laboratory | null>(null);
  
  const [needsSoftware, setNeedsSoftware] = useState<boolean | null>(null);
  const [softwareSearch, setSoftwareSearch] = useState("");
  const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<number[]>([]);
  const [customSoftwares, setCustomSoftwares] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  
  const [needsMaterials, setNeedsMaterials] = useState<boolean | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [activeReservations, setActiveReservations] = useState<Reservation[]>([]);
  const [availableLabIds, setAvailableLabIds] = useState<number[]>([]);
  const [fetchingAvailability, setFetchingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- LÓGICA DE DATAS ---
  const handleAddSingleDate = () => {
    if (!singleDateInput) return;
    if (!dates.includes(singleDateInput)) setDates(prev => [...prev, singleDateInput].sort());
    setSingleDateInput("");
  };

  const handleRemoveDate = (d: string) => {
    setDates(prev => prev.filter(x => x !== d));
  };

  const handleGenerateSemester = () => {
    if (!semStartDate || !semEndDate) {
      showToast("Preencha a data de início e fim do semestre.", "warning");
      return;
    }
    const start = new Date(semStartDate + "T12:00:00");
    const end = new Date(semEndDate + "T12:00:00");
    
    if (start > end) {
      showToast("Data de fim deve ser posterior à data de início.", "error");
      return;
    }

    const generated: string[] = [];
    let current = new Date(start);
    
    while (current <= end) {
      if (current.getDay() === semDayOfWeek) {
        generated.push(current.toISOString().split("T")[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    
    if (generated.length === 0) {
      showToast("Nenhuma data encontrada para este dia da semana no período.", "warning");
    } else {
      setDates(generated);
      showToast(`${generated.length} datas geradas com sucesso!`, "success");
    }
  };

  // --- LÓGICA GERAL ---
  const toggleSlot = (slot: LessonSlot) => {
    setSelectedSlotIds(prev => prev.includes(slot.id) ? prev.filter(id => id !== slot.id) : [...prev, slot.id]);
  };

  const addToCart = (item: ItemModel) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { item, qty: 1 }];
    });
  };

  const checkAvailabilityAndProceed = async () => {
    setFetchingAvailability(true);
    try {
      // Busca reservas ativas por data (para marcar labs ocupados individualmente)
      const [dateResponses, availableResponse] = await Promise.all([
        Promise.all(dates.map(d => reservationsApi.listByDate(d))),
        labsApi.checkAvailability({
          dates,
          slot_ids: selectedSlotIds,
          // sem filtro de bloco: retorna disponíveis de todos os blocos
        }),
      ]);
      setActiveReservations(dateResponses.flat());
      setAvailableLabIds(availableResponse.map(l => l.id));
      setStep(3);
    } catch (e) {
      showToast("Erro ao verificar disponibilidade. Tente novamente.", "error");
    } finally {
      setFetchingAvailability(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedLab || dates.length === 0 || selectedSlotIds.length === 0) return;
    setSubmitting(true);
    try {
      const allSoftwares = [
        ...selectedSoftwareIds.map(id => softwares?.find(s => s.id === id)?.name ?? "").filter(Boolean),
        ...customSoftwares,
      ];
      await reservationsApi.create({
        lab_id: selectedLab.id,
        dates: dates, // <- O payload agora envia o Array de datas
        slot_ids: selectedSlotIds,
        items: cart.map(c => ({ item_model_id: c.item.id, quantity_requested: c.qty })),
        requested_softwares: allSoftwares.length ? allSoftwares.join(", ") : undefined,
        software_installation_required: needsSoftware === true && allSoftwares.length > 0,
      });
      showToast(`Lote de ${dates.length} reserva(s) enviado com sucesso!`, "success");
      setTimeout(onComplete, 1500);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Erro ao enviar reserva.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const labsForBlock = (labs ?? []).filter(l => l.block === selectedBlock);
  const selectedSlots = (slots ?? []).filter(s => selectedSlotIds.includes(s.id));
  const STEPS = 6;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {ToastComponent}

      <div className="mb-8">
        <button onClick={onCancel} className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 font-bold transition-colors">
          <ChevronLeft size={20} /> Cancelar e Voltar
        </button>
      </div>

      <header className="text-center">
        <h1 className="text-3xl font-bold text-neutral-900">Solicitar Agendamento</h1>
        <p className="text-neutral-500">Siga os passos para reservar o laboratório.</p>
      </header>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-4">
        {Array.from({ length: STEPS }, (_, i) => i + 1).map(s => (
          <React.Fragment key={s}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              step >= s ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-500"
            }`}>{s}</div>
            {s < STEPS && <div className={`h-1 w-8 rounded-full ${step > s ? "bg-neutral-900" : "bg-neutral-200"}`} />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* STEP 1 — Bloco */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <h2 className="text-xl font-bold text-center">1. Selecione o Bloco</h2>
            {labsLoading ? <LoadingSpinner /> : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[LaboratoryBlock.BLOCO_A, LaboratoryBlock.BLOCO_B, LaboratoryBlock.BLOCO_C].map(block => (
                  <button key={block} onClick={() => { setSelectedBlock(block); setSelectedLab(null); setStep(2); }}
                    className="bg-white p-8 rounded-2xl border-2 border-neutral-100 hover:border-neutral-900 transition-all text-center group">
                    <div className="bg-neutral-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                      <Building2 size={32} />
                    </div>
                    <span className="font-bold text-lg">{block}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 2 — Data e Slots */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-6 bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
            <h2 className="text-xl font-bold">2. Data(s) e Horários</h2>
            
            {/* Toggle Tipo de Reserva */}
            <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl">
              <button onClick={() => { setReservationType("pontual"); setDates([]); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${reservationType === "pontual" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}>
                <CalendarDays size={16} /> Pontual (1 ou mais dias)
              </button>
              <button onClick={() => { setReservationType("semestral"); setDates([]); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${reservationType === "semestral" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}>
                <Repeat size={16} /> Lote Semestral
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Coluna Esquerda: Definição de Datas */}
              <div className="space-y-4">
                {reservationType === "pontual" ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-neutral-500 uppercase">Adicionar Data</label>
                    <div className="flex gap-2">
                      <input type="date" value={singleDateInput} min={new Date().toISOString().split("T")[0]}
                        onChange={e => setSingleDateInput(e.target.value)}
                        className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-4 focus:ring-2 focus:ring-neutral-900 outline-none text-sm" />
                      <button onClick={handleAddSingleDate} disabled={!singleDateInput}
                        className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40">Add</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 border border-neutral-200 rounded-xl bg-neutral-50">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Início do Semestre</label>
                        <input type="date" value={semStartDate} onChange={e => setSemStartDate(e.target.value)}
                          className="w-full bg-white border border-neutral-200 rounded-lg py-2 px-3 outline-none text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Fim do Semestre</label>
                        <input type="date" value={semEndDate} onChange={e => setSemEndDate(e.target.value)}
                          className="w-full bg-white border border-neutral-200 rounded-lg py-2 px-3 outline-none text-xs" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Dia da Semana</label>
                      <select value={semDayOfWeek} onChange={e => setSemDayOfWeek(Number(e.target.value))}
                        className="w-full bg-white border border-neutral-200 rounded-lg py-2 px-3 outline-none text-sm font-medium">
                        <option value={1}>Segunda-feira</option>
                        <option value={2}>Terça-feira</option>
                        <option value={3}>Quarta-feira</option>
                        <option value={4}>Quinta-feira</option>
                        <option value={5}>Sexta-feira</option>
                        <option value={6}>Sábado</option>
                      </select>
                    </div>
                    <button onClick={handleGenerateSemester} className="w-full bg-neutral-900 text-white py-2 rounded-lg text-sm font-bold">
                      Gerar Cronograma
                    </button>
                  </div>
                )}

                {/* Exibição das Datas Selecionadas */}
                {dates.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-bold text-neutral-500 uppercase mb-2">{dates.length} Data(s) selecionada(s):</p>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                      {dates.map(d => (
                        <span key={d} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-bold">
                          {new Date(d + "T12:00:00").toLocaleDateString("pt-BR").slice(0, 5)}
                          <button onClick={() => handleRemoveDate(d)} className="text-emerald-500 hover:text-emerald-900"><X size={12}/></button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Coluna Direita: Horários */}
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                  Horários ({selectedSlotIds.length} selecionados)
                </label>
                {slotsLoading ? <LoadingSpinner /> : (
                  <div className="grid grid-cols-3 gap-2">
                    {(slots ?? []).map(slot => (
                      <button key={slot.id} onClick={() => toggleSlot(slot)}
                        className={`py-2 px-3 border rounded-lg text-sm font-bold transition-all ${
                          selectedSlotIds.includes(slot.id)
                            ? "bg-neutral-900 text-white border-neutral-900"
                            : "border-neutral-200 hover:border-neutral-900"
                        }`}>
                        <span>{slot.code}</span>
                        <span className="block text-[10px] font-normal opacity-70">{slot.start_time}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-neutral-100">
              <button onClick={() => setStep(1)} className="px-6 py-2 font-bold text-neutral-500 hover:text-neutral-900">Voltar</button>
              <button onClick={checkAvailabilityAndProceed} disabled={dates.length === 0 || selectedSlotIds.length === 0 || fetchingAvailability}
                className="bg-neutral-900 text-white px-8 py-2 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                {fetchingAvailability ? "Verificando Lote..." : "Continuar"}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3 — Laboratório */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">3. Laboratórios Disponíveis</h2>
              <p className="text-sm text-neutral-500 mt-1">
                {dates.length > 1
                  ? "O laboratório precisa estar livre em TODAS as datas do lote."
                  : "Disponibilidade para a data escolhida."}
              </p>
            </div>

            {labsLoading ? <LoadingSpinner /> : (() => {
              const allLabs = labs ?? [];
              const freeLabs     = allLabs.filter(l => availableLabIds.includes(l.id));
              const occupiedInBlock = labsForBlock.filter(l => !availableLabIds.includes(l.id));

              // Agrupa disponíveis por bloco
              const byBlock = freeLabs.reduce<Record<string, Laboratory[]>>((acc, l) => {
                (acc[l.block] ??= []).push(l);
                return acc;
              }, {});

              // Coloca o bloco selecionado primeiro
              const blockOrder = [
                selectedBlock,
                ...Object.keys(byBlock).filter(b => b !== selectedBlock),
              ].filter((b): b is string => !!b && !!byBlock[b]);

              return (
                <div className="space-y-6">
                  {/* Disponíveis — todos os blocos */}
                  {freeLabs.length === 0 ? (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                      <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                      <p className="text-sm text-amber-800 font-medium">
                        Nenhum laboratório está livre para os horários e datas selecionados. Ajuste os horários ou as datas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 px-1">
                        <CheckCircle2 size={13} />
                        {freeLabs.length} laboratório{freeLabs.length > 1 ? "s disponíveis" : " disponível"} nos horários selecionados
                      </p>
                      {blockOrder.map(block => (
                        <div key={block} className="space-y-2">
                          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest px-1">
                            {block} {block === selectedBlock ? "(bloco selecionado)" : ""}
                          </p>
                          {byBlock[block].map(lab => (
                            <button key={lab.id}
                              onClick={() => { setSelectedLab(lab); setStep(4); }}
                              className="w-full p-5 rounded-2xl border bg-white border-neutral-200 hover:border-neutral-900 hover:shadow-sm transition-all flex items-center justify-between text-left group">
                              <div className="flex items-center gap-4">
                                <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                                  <Monitor size={22} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-base">{lab.name}</h4>
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                                      Disponível
                                    </span>
                                  </div>
                                  <p className="text-sm text-neutral-500 mt-0.5">
                                    Capacidade: {lab.capacity} • Sala {lab.room_number}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight size={20} className="text-neutral-300 group-hover:text-neutral-900 shrink-0" />
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ocupados do bloco selecionado */}
                  {occupiedInBlock.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest px-1">
                        Ocupados em {selectedBlock}
                      </p>
                      {occupiedInBlock.map(lab => (
                        <div key={lab.id}
                          className="w-full p-5 rounded-2xl border bg-neutral-50 border-neutral-200 opacity-60 flex items-center gap-4">
                          <div className="p-3.5 rounded-xl bg-neutral-100 text-neutral-400">
                            <Monitor size={22} />
                          </div>
                          <div>
                            <h4 className="font-bold text-base text-neutral-600">{lab.name}</h4>
                            <p className="text-xs font-medium text-neutral-400 mt-0.5 flex items-center gap-1">
                              <AlertTriangle size={11} /> Ocupado nos horários selecionados
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <button onClick={() => setStep(2)} className="px-6 py-2 font-bold text-neutral-500 hover:text-neutral-900">Voltar</button>
          </motion.div>
        )}

        {/* STEP 4 — Software */}
        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">4. Precisa de Software Específico?</h2>
              <p className="text-neutral-500">O DTI será notificado para garantir as instalações para todas as datas.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <button onClick={() => { setNeedsSoftware(false); setSelectedSoftwareIds([]); setCustomSoftwares([]); setStep(5); }}
                className="bg-white p-10 rounded-2xl border border-neutral-200 hover:border-neutral-900 transition-all text-center group">
                <XCircle size={48} className="mx-auto mb-4 text-neutral-200 group-hover:text-red-500 transition-colors" />
                <span className="font-bold text-lg">Não</span>
              </button>
              <button onClick={() => setNeedsSoftware(true)}
                className={`bg-white p-10 rounded-2xl border transition-all text-center group ${
                  needsSoftware ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200 hover:border-neutral-900"
                }`}>
                <CheckCircle2 size={48} className={`mx-auto mb-4 transition-colors ${needsSoftware ? "text-emerald-500" : "text-neutral-200 group-hover:text-emerald-500"}`} />
                <span className="font-bold text-lg">Sim</span>
              </button>
            </div>

            {needsSoftware && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {(selectedSoftwareIds.length > 0 || customSoftwares.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSoftwareIds.map(id => {
                      const sw = softwares?.find(s => s.id === id);
                      return (
                        <span key={id} className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700">
                          {sw?.name}
                          <button onClick={() => setSelectedSoftwareIds(prev => prev.filter(x => x !== id))}
                            className="ml-1 opacity-60 hover:opacity-100"><X size={12}/></button>
                        </span>
                      );
                    })}
                    {customSoftwares.map((name, i) => (
                      <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700">
                        {name} (novo)
                        <button onClick={() => setCustomSoftwares(prev => prev.filter((_, j) => j !== i))}
                          className="ml-1 opacity-60 hover:opacity-100"><X size={12}/></button>
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase mb-2 text-neutral-500">Selecionar do catálogo</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input type="text" placeholder="Buscar software cadastrado..."
                      value={softwareSearch} onChange={e => setSoftwareSearch(e.target.value)}
                      className="w-full rounded-xl py-3 pl-10 pr-4 border border-neutral-200 bg-neutral-50 text-sm" />
                  </div>
                  {softwareSearch.length > 0 && (
                    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden mt-1">
                      {(softwares ?? []).filter(sw => sw.name.toLowerCase().includes(softwareSearch.toLowerCase()) && !selectedSoftwareIds.includes(sw.id)).length === 0 ? (
                        <p className="px-4 py-3 text-sm text-neutral-400">Nenhum resultado.</p>
                      ) : (softwares ?? []).filter(sw => sw.name.toLowerCase().includes(softwareSearch.toLowerCase()) && !selectedSoftwareIds.includes(sw.id)).map(sw => (
                        <button key={sw.id} onClick={() => { setSelectedSoftwareIds(prev => [...prev, sw.id]); setSoftwareSearch(""); }}
                          className="w-full text-left px-4 py-2.5 text-sm flex justify-between items-center hover:bg-neutral-50">
                          <span>{sw.name}</span>
                          {sw.version && <span className="text-xs text-neutral-400">{sw.version}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase mb-2 text-neutral-500">Adicionar não cadastrado</p>
                  <div className="flex gap-2">
                    <input value={customInput} onChange={e => setCustomInput(e.target.value)}
                      placeholder="Ex: MATLAB R2024a"
                      className="flex-1 rounded-xl py-2.5 px-4 border border-neutral-200 bg-neutral-50 text-sm"
                      onKeyDown={e => {
                        if (e.key === "Enter" && customInput.trim()) {
                          e.preventDefault();
                          setCustomSoftwares(prev => [...prev, customInput.trim()]);
                          setCustomInput("");
                        }
                      }} />
                    <button onClick={() => { if (customInput.trim()) { setCustomSoftwares(prev => [...prev, customInput.trim()]); setCustomInput(""); } }}
                      disabled={!customInput.trim()}
                      className="px-4 py-2.5 rounded-xl font-bold text-sm bg-neutral-900 text-white disabled:opacity-40">
                      Adicionar
                    </button>
                  </div>
                </div>

                <button onClick={() => setStep(5)}
                  disabled={selectedSoftwareIds.length === 0 && customSoftwares.length === 0}
                  className="w-full py-3 rounded-xl font-bold bg-neutral-900 text-white disabled:opacity-40">
                  Confirmar e Continuar
                </button>
              </motion.div>
            )}
            {!needsSoftware && (
              <div className="flex justify-center">
                <button onClick={() => setStep(3)} className="px-6 py-2 font-bold text-neutral-500 hover:text-neutral-900">Voltar</button>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 5 — Materiais */}
        {step === 5 && (
          <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">5. Materiais do Almoxarifado?</h2>
            </div>
            {!selectedLab?.is_practical ? (
              <div className="bg-neutral-100 p-8 rounded-2xl text-center space-y-4">
                <Info className="mx-auto text-neutral-400" size={32} />
                <p className="text-neutral-600 font-medium">Este laboratório não permite solicitação de materiais via sistema.</p>
                <button onClick={() => setStep(6)} className="bg-neutral-900 text-white px-8 py-3 rounded-xl font-bold">Pular para Revisão</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <button onClick={() => { setNeedsMaterials(false); setCart([]); setStep(6); }}
                    className="bg-white p-10 rounded-2xl border border-neutral-200 hover:border-neutral-900 transition-all text-center group">
                    <XCircle size={48} className="mx-auto mb-4 text-neutral-200 group-hover:text-red-500 transition-colors" />
                    <span className="font-bold text-lg">Não</span>
                  </button>
                  <button onClick={() => setNeedsMaterials(true)}
                    className={`bg-white p-10 rounded-2xl border transition-all text-center group ${needsMaterials ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200 hover:border-neutral-900"}`}>
                    <CheckCircle2 size={48} className={`mx-auto mb-4 transition-colors ${needsMaterials ? "text-emerald-500" : "text-neutral-200 group-hover:text-emerald-500"}`} />
                    <span className="font-bold text-lg">Sim</span>
                  </button>
                </div>

                {needsMaterials && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {itemsLoading ? <LoadingSpinner /> : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                        {(items ?? []).filter(item => item.total_stock > 0).map(item => {
                          const inCart = cart.find(c => c.item.id === item.id);
                          return (
                            <div key={item.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between">
                              <div>
                                <p className="font-bold text-sm">{item.name}</p>
                                <p className="text-xs text-neutral-400">{item.total_stock} disponíveis</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {inCart ? (
                                  <>
                                    <button onClick={() => removeFromCart(item.id)}
                                      className="w-7 h-7 rounded-lg border border-neutral-200 flex items-center justify-center text-red-500 hover:bg-red-50 font-bold text-lg">-</button>
                                    <span className="w-6 text-center font-bold text-sm">{inCart.qty}</span>
                                    <button onClick={() => addToCart(item)}
                                      className="w-7 h-7 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 font-bold text-lg">+</button>
                                  </>
                                ) : (
                                  <button onClick={() => addToCart(item)} className="bg-neutral-900 text-white px-3 py-1 rounded-lg text-sm font-bold">Add</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button onClick={() => setStep(6)} disabled={cart.length === 0}
                      className="w-full bg-neutral-900 text-white py-3 rounded-xl font-bold disabled:opacity-40">
                      Confirmar {cart.length > 0 ? `(${cart.length} itens)` : ""} e Continuar
                    </button>
                  </motion.div>
                )}
              </div>
            )}
            <div className="flex justify-center">
              <button onClick={() => setStep(4)} className="px-6 py-2 font-bold text-neutral-500 hover:text-neutral-900">Voltar</button>
            </div>
          </motion.div>
        )}

        {/* STEP 6 — Revisão */}
        {step === 6 && (
          <motion.div key="s6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-8 bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
            <h2 className="text-2xl font-bold text-center">6. Revisar Solicitação ({dates.length} Dias)</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Detalhes do Lote</h3>
                <div className="space-y-3">
                  {[
                    { label: "Laboratório", value: selectedLab?.name },
                    { label: "Datas", value: `${dates.length} aula(s) programada(s)` },
                    { label: "Horários", value: selectedSlots.map(s => `${s.code} (${s.start_time})`).join(", ") || "—" },
                    { label: "Software(s)", value: [
                        ...selectedSoftwareIds.map(id => softwares?.find(s => s.id === id)?.name ?? "").filter(Boolean),
                        ...customSoftwares,
                      ].join(", ") || "Nenhum" },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 border-b border-neutral-50">
                      <span className="text-neutral-500">{row.label}</span>
                      <span className="font-bold text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Materiais Solicitados</h3>
                {cart.length > 0 ? (
                  <div className="space-y-2">
                    {cart.map(c => (
                      <div key={c.item.id} className="flex justify-between text-sm">
                        <span>{c.item.name}</span>
                        <span className="font-bold">x{c.qty}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 italic">Nenhum material solicitado.</p>
                )}
              </div>
            </div>

            <div className="pt-8 border-t border-neutral-100 flex flex-col gap-3">
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full bg-neutral-900 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-neutral-900/20 disabled:opacity-50 flex justify-center items-center gap-2">
                {submitting ? <LoadingSpinner label="" /> : `Confirmar Criação do Lote (${dates.length})`}
              </button>
              <button onClick={() => setStep(5)} className="text-sm font-bold text-neutral-500 hover:text-neutral-900 text-center w-full">
                Voltar e Editar
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}