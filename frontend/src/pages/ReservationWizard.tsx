import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2, Monitor, CheckCircle2, XCircle,
  Search, Info, ChevronLeft, X, CalendarDays, Repeat
} from "lucide-react";
import { Laboratory, LessonSlot, ItemModel } from "../types";
import { useFetch } from "../hooks/useFetch";
import { labsApi } from "../api/labsApi";
import { inventoryApi } from "../api/inventoryApi";
import { reservationsApi } from "../api/reservationsApi";
import { LoadingSpinner, useToast } from "../components/ui";
import { ApiError } from "../api/client";

interface CartItem { item: ItemModel; qty: number }
interface Props { onComplete: () => void; onCancel: () => void; }

export function ReservationWizard({ onComplete, onCancel }: Props) {
  const { showToast, ToastComponent } = useToast();

  const { data: labs, loading: labsLoading }   = useFetch(labsApi.list);
  const { data: slots, loading: slotsLoading } = useFetch(labsApi.listSlots);
  const { data: softwares }                    = useFetch(labsApi.listSoftwares);
  const { data: items, loading: itemsLoading } = useFetch(inventoryApi.listModels);

  const [step, setStep] = useState(1);

  // Modo lote
  const [batchMode, setBatchMode] = useState(false);
  const [reservationType, setReservationType] = useState<"pontual" | "semestral">("pontual");

  // Datas
  const [singleDateInput, setSingleDateInput] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [semStartDate, setSemStartDate] = useState("");
  const [semEndDate, setSemEndDate] = useState("");
  const [semDayOfWeek, setSemDayOfWeek] = useState(1);

  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>([]);
  const [selectedLab, setSelectedLab] = useState<Laboratory | null>(null);

  const [needsSoftware, setNeedsSoftware] = useState<boolean | null>(null);
  const [softwareSearch, setSoftwareSearch] = useState("");
  const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<number[]>([]);
  const [customSoftwares, setCustomSoftwares] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");

  const [needsMaterials, setNeedsMaterials] = useState<boolean | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [availableLabIds, setAvailableLabIds] = useState<number[]>([]);
  const [fetchingAvailability, setFetchingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blockFilter, setBlockFilter] = useState<string>("todos");

  // --- Lógica de Datas ---
  const handleAddSingleDate = () => {
    if (!singleDateInput || dates.includes(singleDateInput)) return;
    setDates(prev => [...prev, singleDateInput].sort());
    setSingleDateInput("");
  };

  const handleRemoveDate = (d: string) => setDates(prev => prev.filter(x => x !== d));

  const handleGenerateSemester = () => {
    if (!semStartDate || !semEndDate) { showToast("Preencha a data de início e fim.", "warning"); return; }
    const start = new Date(semStartDate + "T12:00:00");
    const end = new Date(semEndDate + "T12:00:00");
    if (start > end) { showToast("Data de fim deve ser posterior ao início.", "error"); return; }
    const generated: string[] = [];
    let cur = new Date(start);
    while (cur <= end) {
      if (cur.getDay() === semDayOfWeek) generated.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    if (generated.length === 0) showToast("Nenhuma data encontrada para o período.", "warning");
    else { setDates(generated); showToast(`${generated.length} datas geradas!`, "success"); }
  };

  // --- Lógica Geral ---
  const toggleSlot = (slot: LessonSlot) =>
    setSelectedSlotIds(prev => prev.includes(slot.id) ? prev.filter(id => id !== slot.id) : [...prev, slot.id]);

  const addToCart = (item: ItemModel) =>
    setCart(prev => {
      const ex = prev.find(i => i.item.id === item.id);
      return ex ? prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { item, qty: 1 }];
    });

  const removeFromCart = (item: ItemModel) =>
    setCart(prev => {
      const ex = prev.find(i => i.item.id === item.id);
      if (!ex) return prev;
      return ex.qty <= 1 ? prev.filter(i => i.item.id !== item.id) : prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty - 1 } : i);
    });

  const activeDates = batchMode ? dates : (singleDateInput ? [singleDateInput] : []);
  const canProceed = activeDates.length > 0 && selectedSlotIds.length > 0;

  const checkAvailabilityAndProceed = async () => {
    if (!canProceed) return;
    setFetchingAvailability(true);
    try {
      const available = await labsApi.checkAvailability({ dates: activeDates, slot_ids: selectedSlotIds });
      if (available.length === 0) {
        showToast("Nenhum laboratório disponível para o horário e data selecionados. Tente outra opção.", "warning");
        return;
      }
      if (!batchMode) setDates(activeDates);
      setAvailableLabIds(available.map(l => l.id));
      setBlockFilter("todos");
      setStep(2);
    } catch {
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
        dates,
        slot_ids: selectedSlotIds,
        items: cart.map(c => ({ item_model_id: c.item.id, quantity_requested: c.qty })),
        requested_softwares: allSoftwares.length ? allSoftwares.join(", ") : undefined,
        software_installation_required: needsSoftware === true && allSoftwares.length > 0,
      });
      showToast(`${dates.length} reserva(s) enviada(s) com sucesso!`, "success");
      setTimeout(onComplete, 1500);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Erro ao enviar reserva.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSlots = (slots ?? []).filter(s => selectedSlotIds.includes(s.id));
  const STEPS = 5;

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

        {/* STEP 1 — Data e Horários */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-6 bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
            <h2 className="text-xl font-bold">1. Data e Horários</h2>

            {/* Toggle Reserva em Lote */}
            <label className="flex items-center gap-3 cursor-pointer select-none p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="relative shrink-0">
                <input type="checkbox" checked={batchMode}
                  onChange={e => { setBatchMode(e.target.checked); setDates([]); setSingleDateInput(""); }}
                  className="sr-only peer" />
                <div className="w-11 h-6 bg-neutral-300 rounded-full peer-checked:bg-neutral-900 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow" />
              </div>
              <div>
                <span className="font-bold text-sm text-neutral-800">Reserva em Lote</span>
                <span className="block text-xs text-neutral-400">Habilite para múltiplas datas ou reserva semestral</span>
              </div>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Coluna Esquerda: Data(s) */}
              <div className="space-y-4">
                {!batchMode ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-neutral-500 uppercase">Data da Reserva</label>
                    <input type="date" value={singleDateInput} min={new Date().toISOString().split("T")[0]}
                      onChange={e => setSingleDateInput(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-neutral-900 outline-none text-sm" />
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl">
                      <button onClick={() => { setReservationType("pontual"); setDates([]); setSingleDateInput(""); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${reservationType === "pontual" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500"}`}>
                        <CalendarDays size={13} /> Múltiplas Datas
                      </button>
                      <button onClick={() => { setReservationType("semestral"); setDates([]); setSingleDateInput(""); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${reservationType === "semestral" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500"}`}>
                        <Repeat size={13} /> Semestral
                      </button>
                    </div>

                    {reservationType === "pontual" ? (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-neutral-500 uppercase">Adicionar Data</label>
                        <div className="flex gap-2">
                          <input type="date" value={singleDateInput} min={new Date().toISOString().split("T")[0]}
                            onChange={e => setSingleDateInput(e.target.value)}
                            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-4 outline-none text-sm" />
                          <button onClick={handleAddSingleDate} disabled={!singleDateInput}
                            className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40">Add</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4 border border-neutral-200 rounded-xl bg-neutral-50">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Início</label>
                            <input type="date" value={semStartDate} onChange={e => setSemStartDate(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-lg py-2 px-3 outline-none text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Fim</label>
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
                        <button onClick={handleGenerateSemester}
                          className="w-full bg-neutral-900 text-white py-2 rounded-lg text-sm font-bold">
                          Gerar Cronograma
                        </button>
                      </div>
                    )}

                    {dates.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-neutral-500 uppercase mb-2">{dates.length} Data(s) selecionada(s)</p>
                        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-1">
                          {dates.map(d => (
                            <span key={d} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-bold">
                              {new Date(d + "T12:00:00").toLocaleDateString("pt-BR").slice(0, 5)}
                              <button onClick={() => handleRemoveDate(d)} className="text-emerald-500 hover:text-emerald-900"><X size={12}/></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
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

            <div className="flex justify-end pt-6 border-t border-neutral-100">
              <button onClick={checkAvailabilityAndProceed} disabled={!canProceed || fetchingAvailability}
                className="bg-neutral-900 text-white px-8 py-2 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                {fetchingAvailability ? "Verificando..." : "Ver Laboratórios Disponíveis"}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2 — Laboratórios */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">2. Laboratórios Disponíveis</h2>
              <p className="text-sm text-neutral-500 mt-1">
                {dates.length > 1
                  ? `Laboratórios livres em todas as ${dates.length} datas selecionadas.`
                  : `Disponibilidade para ${dates[0] ? new Date(dates[0] + "T12:00:00").toLocaleDateString("pt-BR") : "a data selecionada"}.`}
              </p>
            </div>

            {labsLoading ? <LoadingSpinner /> : (() => {
              const allLabs = labs ?? [];
              const byBlock = allLabs.reduce<Record<string, Laboratory[]>>((acc, l) => {
                (acc[l.block] ??= []).push(l); return acc;
              }, {});
              const blockKeys = Object.keys(byBlock).sort();
              const filteredKeys = blockFilter === "todos" ? blockKeys : blockKeys.filter(b => b === blockFilter);

              return (
                <div className="space-y-5">
                  {/* Filtro por bloco */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setBlockFilter("todos")}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${blockFilter === "todos" ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-200 text-neutral-500 hover:border-neutral-900"}`}>
                      Todos
                    </button>
                    {blockKeys.map(b => (
                      <button key={b} onClick={() => setBlockFilter(b)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${blockFilter === b ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-200 text-neutral-500 hover:border-neutral-900"}`}>
                        {b}
                      </button>
                    ))}
                  </div>

                  {filteredKeys.map(block => (
                    <div key={block} className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <Building2 size={13} className="text-neutral-400" />
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{block}</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {byBlock[block].map(lab => {
                          const isAvailable = availableLabIds.includes(lab.id);
                          return (
                            <button key={lab.id}
                              onClick={() => { if (isAvailable) { setSelectedLab(lab); setStep(3); } }}
                              disabled={!isAvailable}
                              className={`p-4 rounded-2xl border text-left transition-all ${
                                isAvailable
                                  ? "bg-white border-neutral-200 hover:border-neutral-900 hover:shadow-md cursor-pointer"
                                  : "bg-neutral-50 border-neutral-100 opacity-50 cursor-not-allowed"
                              }`}>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                                isAvailable ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-300"
                              }`}>
                                <Monitor size={20} />
                              </div>
                              <h4 className="font-bold text-sm leading-tight">{lab.name}</h4>
                              <p className="text-xs text-neutral-400 mt-1">{lab.block} · Sala {lab.room_number}</p>
                              <span className={`text-xs font-bold mt-2 block ${isAvailable ? "text-emerald-600" : "text-red-500"}`}>
                                {isAvailable ? "● Disponível" : "● Indisponível"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <button onClick={() => setStep(1)} className="px-6 py-2 font-bold text-neutral-500 hover:text-neutral-900">Voltar</button>
          </motion.div>
        )}

        {/* STEP 3 — Software */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">3. Precisa de Software Específico?</h2>
              <p className="text-neutral-500">O DTI será notificado para garantir as instalações.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <button onClick={() => { setNeedsSoftware(false); setSelectedSoftwareIds([]); setCustomSoftwares([]); setStep(4); }}
                className="bg-white p-10 rounded-2xl border border-neutral-200 hover:border-neutral-900 transition-all text-center group">
                <XCircle size={48} className="mx-auto mb-4 text-neutral-200 group-hover:text-red-500 transition-colors" />
                <span className="font-bold text-lg">Não</span>
              </button>
              <button onClick={() => setNeedsSoftware(true)}
                className={`bg-white p-10 rounded-2xl border transition-all text-center group ${needsSoftware ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200 hover:border-neutral-900"}`}>
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
                          e.preventDefault(); setCustomSoftwares(prev => [...prev, customInput.trim()]); setCustomInput("");
                        }
                      }} />
                    <button onClick={() => { if (customInput.trim()) { setCustomSoftwares(prev => [...prev, customInput.trim()]); setCustomInput(""); } }}
                      disabled={!customInput.trim()}
                      className="px-4 py-2.5 rounded-xl font-bold text-sm bg-neutral-900 text-white disabled:opacity-40">
                      Adicionar
                    </button>
                  </div>
                </div>

                <button onClick={() => setStep(4)}
                  disabled={selectedSoftwareIds.length === 0 && customSoftwares.length === 0}
                  className="w-full py-3 rounded-xl font-bold bg-neutral-900 text-white disabled:opacity-40">
                  Confirmar e Continuar
                </button>
              </motion.div>
            )}
            {!needsSoftware && (
              <div className="flex justify-center">
                <button onClick={() => setStep(2)} className="px-6 py-2 font-bold text-neutral-500 hover:text-neutral-900">Voltar</button>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 4 — Materiais */}
        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">4. Materiais do Almoxarifado?</h2>
            </div>
            {!selectedLab?.is_practical ? (
              <div className="bg-neutral-100 p-8 rounded-2xl text-center space-y-4">
                <Info className="mx-auto text-neutral-400" size={32} />
                <p className="text-neutral-600 font-medium">Este laboratório não permite solicitação de materiais via sistema.</p>
                <button onClick={() => setStep(5)} className="bg-neutral-900 text-white px-8 py-3 rounded-xl font-bold">Pular para Revisão</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <button onClick={() => { setNeedsMaterials(false); setCart([]); setStep(5); }}
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
                                    <button onClick={() => removeFromCart(item)}
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
                    <button onClick={() => setStep(5)} disabled={cart.length === 0}
                      className="w-full bg-neutral-900 text-white py-3 rounded-xl font-bold disabled:opacity-40">
                      Confirmar {cart.length > 0 ? `(${cart.length} itens)` : ""} e Continuar
                    </button>
                  </motion.div>
                )}
              </div>
            )}
            <div className="flex justify-center">
              <button onClick={() => setStep(3)} className="px-6 py-2 font-bold text-neutral-500 hover:text-neutral-900">Voltar</button>
            </div>
          </motion.div>
        )}

        {/* STEP 5 — Revisão */}
        {step === 5 && (
          <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-8 bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
            <h2 className="text-2xl font-bold text-center">5. Revisar Solicitação ({dates.length} Dia{dates.length > 1 ? "s" : ""})</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Detalhes</h3>
                <div className="space-y-3">
                  {[
                    { label: "Laboratório", value: selectedLab?.name },
                    { label: "Local", value: selectedLab ? `${selectedLab.block} · Sala ${selectedLab.room_number}` : "—" },
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
                {submitting ? <LoadingSpinner label="" /> : `Confirmar Reserva${dates.length > 1 ? ` (${dates.length} dias)` : ""}`}
              </button>
              <button onClick={() => setStep(4)} className="text-sm font-bold text-neutral-500 hover:text-neutral-900 text-center w-full">
                Voltar e Editar
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
