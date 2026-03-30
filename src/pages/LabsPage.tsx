import React, { useState, useRef } from "react";
import { Plus, Pencil, Trash2, Monitor, X, Check, Building2, AppWindow, FileSpreadsheet, Upload, AlertTriangle } from "lucide-react";
import { UserRole, Laboratory, Software, Reservation } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { labsApi, CreateLabPayload, UpdateLabPayload, ImportedSoftwareLab } from "../api/labsApi";
import { reservationsApi } from "../api/reservationsApi";
import { useToast, LoadingSpinner, ErrorMessage } from "../components/ui";
import { api as apiClient, ApiError } from "../api/client";
import { CustomDropdown } from "./reservationShared";

const BLOCKS = ["Bloco A", "Bloco B", "Bloco C", "Bloco M"];

// ── ImportSoftwaresModal ──────────────────────────────────────────────────────

function ImportSoftwaresModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { showToast, ToastComponent } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ labs: ImportedSoftwareLab[]; total_softwares: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [labMapping, setLabMapping] = useState<Record<string, number | null>>({});
  const [activeLabTab, setActiveLabTab] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: systemLabs } = useFetch(labsApi.list);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    setStep(1);
  };

  const handlePreview = async () => {
    if (!file) { showToast("Selecione um arquivo .xlsx.", "error"); return; }
    setLoading(true);
    try {
      const result = await labsApi.importSoftwaresPreview(file);
      setPreview(result);
      const initialMapping: Record<string, number | null> = {};
      result.labs.forEach(lab => {
        // Try to auto-match by name
        const match = (systemLabs ?? []).find(
          sl => sl.name.toLowerCase() === lab.lab_name.toLowerCase()
        );
        initialMapping[lab.lab_name] = match?.id ?? null;
      });
      setLabMapping(initialMapping);
      if (result.labs.length > 0) setActiveLabTab(result.labs[0].lab_name);
      setStep(2);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao processar arquivo.", "error");
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!preview?.labs.length) return;
    setConfirming(true);
    try {
      const items: ImportedSoftwareLab[] = preview.labs.map(lab => ({
        ...lab,
        lab_id: labMapping[lab.lab_name] ?? null,
      }));
      const result = await labsApi.importSoftwaresConfirm(items);
      showToast(`Importação concluída: ${result.created} softwares criados, ${result.linked} vínculos realizados.`, "success");
      setTimeout(() => { onImported(); onClose(); }, 1000);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao importar.", "error");
    } finally { setConfirming(false); }
  };

  const activeLabData = preview?.labs.find(l => l.lab_name === activeLabTab);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Importar Softwares via Excel</h2>
            <p className="text-xs font-medium text-neutral-500 mt-1">
              {step === 1 ? "Passo 1: Selecione o arquivo .xlsx" : `Passo 2: Confirme os ${preview?.total_softwares ?? 0} softwares em ${preview?.labs.length ?? 0} lab(s)`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar space-y-5">
          {step === 1 && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-200 rounded-2xl p-10 text-center cursor-pointer hover:border-neutral-400 hover:bg-neutral-50 transition-all"
              >
                <FileSpreadsheet size={40} className="mx-auto text-neutral-300 mb-3" />
                <p className="font-bold text-neutral-700">{file ? file.name : "Clique para selecionar o arquivo"}</p>
                <p className="text-xs text-neutral-400 mt-1">Formato: .xlsx · Abas por laboratório com coluna de softwares</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </div>
              <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 text-xs text-neutral-600 space-y-1">
                <p className="font-bold text-neutral-700 mb-2">Formato esperado da planilha:</p>
                <p>- Cada <span className="font-bold">aba</span> da planilha representa um laboratório (nome da aba = nome do lab)</p>
                <p>- Coluna <span className="font-mono bg-white border border-neutral-200 px-1 rounded">Software</span> ou <span className="font-mono bg-white border border-neutral-200 px-1 rounded">Nome</span> — nome do software</p>
              </div>
            </>
          )}

          {step === 2 && preview && (
            <>
              {preview.labs.length === 0 ? (
                <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                  <AppWindow size={36} className="mx-auto text-neutral-300 mb-3" />
                  <p className="font-bold text-neutral-600">Nenhum software encontrado na planilha.</p>
                </div>
              ) : (
                <>
                  {/* Lab tabs */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {preview.labs.map(lab => (
                      <button
                        key={lab.lab_name}
                        onClick={() => setActiveLabTab(lab.lab_name)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${activeLabTab === lab.lab_name ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"}`}
                      >
                        {lab.lab_name} <span className="ml-1 opacity-60">({lab.softwares.length})</span>
                      </button>
                    ))}
                  </div>

                  {activeLabData && (
                    <div className="space-y-4">
                      {/* Lab mapping dropdown */}
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <label className="block text-[11px] font-bold text-blue-700 uppercase tracking-widest mb-2">
                          Mapear "{activeLabData.lab_name}" para laboratório do sistema
                        </label>
                        <select
                          value={labMapping[activeLabData.lab_name] ?? ""}
                          onChange={e => setLabMapping(m => ({ ...m, [activeLabData.lab_name]: e.target.value ? Number(e.target.value) : null }))}
                          className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                        >
                          <option value="">-- Não vincular a nenhum lab --</option>
                          {(systemLabs ?? []).map(sl => (
                            <option key={sl.id} value={sl.id}>{sl.name} ({sl.block})</option>
                          ))}
                        </select>
                        {!labMapping[activeLabData.lab_name] && (
                          <p className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                            <AlertTriangle size={10} /> Softwares serão criados mas não vinculados a nenhum laboratório.
                          </p>
                        )}
                      </div>

                      {/* Software list */}
                      <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                        <div className="bg-neutral-50 border-b border-neutral-100 px-4 py-2.5">
                          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">{activeLabData.softwares.length} software(s) encontrado(s)</p>
                        </div>
                        <div className="divide-y divide-neutral-100 max-h-52 overflow-y-auto custom-scrollbar">
                          {activeLabData.softwares.map((sw, i) => (
                            <div key={i} className="px-4 py-2.5 flex items-center gap-2">
                              <AppWindow size={13} className="text-neutral-400 shrink-0" />
                              <span className="text-sm font-medium text-neutral-800">{sw}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          {step === 2 && (
            <button onClick={() => setStep(1)} className="px-4 py-3 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">
              ← Voltar
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-3 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">Cancelar</button>
          {step === 1 && (
            <button onClick={handlePreview} disabled={!file || loading}
              className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20 flex items-center justify-center gap-2">
              {loading ? <LoadingSpinner label="" /> : <><Upload size={16}/> Analisar Planilha</>}
            </button>
          )}
          {step === 2 && preview && preview.labs.length > 0 && (
            <button onClick={handleConfirm} disabled={confirming}
              className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20 flex items-center justify-center gap-2">
              {confirming ? <LoadingSpinner label="" /> : <>Confirmar Importação</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const BLOCK_COLORS: Record<string, string> = {
  "Bloco A": "bg-blue-50 text-blue-700 border-blue-200",
  "Bloco B": "bg-purple-50 text-purple-700 border-purple-200",
  "Bloco C": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Bloco M": "bg-amber-50 text-amber-700 border-amber-200",
};

interface LabFormProps {
  initial?: Laboratory;
  softwares: Software[];
  onSave: (p: CreateLabPayload | UpdateLabPayload) => Promise<void>;
  onCancel: () => void;
}

function LabForm({ initial, softwares, onSave, onCancel }: LabFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    block: initial?.block ?? "Bloco A",
    room_number: initial?.room_number ?? "",
    capacity: initial?.capacity ?? 20,
    is_practical: initial?.is_practical ?? false,
    description: initial?.description ?? "",
    software_ids: initial?.softwares?.map(s => s.id) ?? [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const toggleSoftware = (id: number) => {
    setForm(f => ({ ...f, software_ids: f.software_ids.includes(id) ? f.software_ids.filter(x => x !== id) : [...f.software_ids, id] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form as any); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Nome do Laboratório *</label>
          <input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: LabInf 4" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm transition-shadow" />
        </div>
        <div className="z-[70]">
          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Bloco</label>
          <CustomDropdown value={form.block} options={BLOCKS.map(b => ({ value: b, label: b }))} onChange={v => set("block", v)} icon={Building2} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Número da Sala *</label>
          <input required value={form.room_number} onChange={e => set("room_number", e.target.value)} placeholder="Ex: 201" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm transition-shadow" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Capacidade (máquinas)</label>
          <input type="number" required min={1} value={form.capacity} onChange={e => set("capacity", Number(e.target.value))} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm transition-shadow" />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Descrição (opcional)</label>
        <textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descreva o laboratório..." className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none shadow-sm transition-shadow" />
      </div>

      <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
        <input type="checkbox" id="practical" checked={form.is_practical} onChange={e => set("is_practical", e.target.checked)} className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer" />
        <label htmlFor="practical" className="text-sm font-bold text-neutral-700 cursor-pointer select-none">
          Laboratório prático <span className="font-medium text-neutral-500">(permite uso de materiais do almoxarifado)</span>
        </label>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center justify-between">
          Softwares Instalados
          <span className="bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md">{form.software_ids.length} selecionado(s)</span>
        </label>
        <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-3">
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {softwares.map(sw => {
              const sel = form.software_ids.includes(sw.id);
              return (
                <button key={sw.id} type="button" onClick={() => toggleSoftware(sw.id)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border active:scale-95 ${sel ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100"}`}>
                  {sel && <Check size={12} />} {sw.name} {sw.version ? `(${sw.version})` : ""}
                </button>
              );
            })}
            {softwares.length === 0 && <p className="text-xs text-neutral-400 font-bold p-2">Nenhum software cadastrado no sistema ainda.</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl border border-neutral-200 font-bold text-sm text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">Cancelar</button>
        <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-neutral-900 text-white font-bold text-sm disabled:opacity-50 shadow-md hover:bg-neutral-800 transition-all active:scale-[0.98]">{saving ? <LoadingSpinner label="" /> : initial ? "Salvar alterações" : "Criar laboratório"}</button>
      </div>
    </form>
  );
}

function LabCard({ lab, softwares, canEdit, onEdit, onDelete, activeReservations }: { lab: Laboratory; softwares: Software[]; canEdit: boolean; onEdit: (l: Laboratory) => void; onDelete: (l: Laboratory) => void; activeReservations?: Reservation[]; }) {
  const [expanded, setExpanded] = useState(false);
  const block = lab.block as string;
  const currentReservation = activeReservations?.find(r => r.lab_id === lab.id && r.status === "em_uso");
  const pendingOrApproved = activeReservations?.filter(r => r.lab_id === lab.id && (r.status === "aprovado" || r.status === "pendente"));

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-3 rounded-2xl shrink-0 shadow-inner border ${BLOCK_COLORS[block] ?? "bg-neutral-100 text-neutral-500 border-neutral-200"}`}>
              <Monitor size={24} />
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-lg text-neutral-900 truncate">{lab.name}</h4>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-0.5">{lab.block} · Sala {lab.room_number} · {lab.capacity} maq.</p>
            </div>
          </div>
          {lab.is_practical && <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-sm shrink-0">Prático</span>}
        </div>

        {currentReservation ? (
          <div className="mt-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 shadow-sm">
            <span className="flex h-2.5 w-2.5 relative shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span></span>
            <div><p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Em uso agora</p><p className="text-xs font-bold text-blue-700 mt-0.5">{currentReservation.user?.full_name ?? "Professor"}</p></div>
          </div>
        ) : (
          pendingOrApproved && pendingOrApproved.length > 0 && (
            <div className="mt-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div><p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Reservado hoje</p><p className="text-xs font-bold text-emerald-700 mt-0.5">{pendingOrApproved.length} agendamento(s)</p></div>
            </div>
          )
        )}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-neutral-100">
          <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors">
            {expanded ? "Ocultar Sistema" : "Ver Sistema"}
          </button>
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={() => onEdit(lab)} className="p-2 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-900 hover:text-white transition-all shadow-sm active:scale-95" title="Editar"><Pencil size={14} /></button>
              <button onClick={() => onDelete(lab)} className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95" title="Excluir"><Trash2 size={14} /></button>
            </div>
          )}
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2 bg-neutral-50/50 p-4 rounded-xl">
            <p className="text-xs text-neutral-500"><span className="font-bold uppercase tracking-widest text-[9px] mr-2">Catálogo SW</span> {lab.softwares?.length ? lab.softwares.map(s => s.name).join(", ") : "Nenhum software instalado"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function LabsPage() {
  const { user } = useAuth();
  const { data: labs, loading, error, refetch } = useFetch(labsApi.list, [], true);
  const { data: softwares, refetch: refetchSW } = useFetch(labsApi.listSoftwares);
  const { data: todayReservations } = useFetch(reservationsApi.listToday, [], true);
  const { showToast, ToastComponent } = useToast();

  const [activeTab, setActiveTab] = useState<"labs" | "softwares">("labs");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Laboratory | null>(null);
  const [filterBlock, setFilterBlock] = useState<string>("all");

  const [swForm, setSwForm] = useState({ name: "", version: "" });
  const [savingSw, setSavingSw] = useState(false);
  const [showImportSw, setShowImportSw] = useState(false);

  const canEdit = user?.role === UserRole.ADMINISTRADOR || user?.role === UserRole.SUPER_ADMIN;

  const handleCreateLab = async (p: any) => {
    try { await labsApi.create(p); showToast("Laboratório criado.", "success"); setShowForm(false); refetch(); } 
    catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao criar.", "error"); }
  };

  const handleUpdateLab = async (p: any) => {
    if (!editTarget) return;
    try { await labsApi.update(editTarget.id, p); showToast("Laboratório atualizado.", "success"); setEditTarget(null); refetch(); } 
    catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao atualizar.", "error"); }
  };

  const handleDeleteLab = async (lab: Laboratory) => {
    if (!confirm(`Excluir "${lab.name}" permanentemente?`)) return;
    try { await labsApi.delete(lab.id); showToast("Laboratório excluído.", "warning"); refetch(); } 
    catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao excluir.", "error"); }
  };

  const handleCreateSoftware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swForm.name.trim()) return;
    setSavingSw(true);
    try {
      await apiClient.post("/softwares", { name: swForm.name.trim(), version: swForm.version.trim() || undefined });
      showToast("Software cadastrado no catálogo.", "success");
      setSwForm({ name: "", version: "" });
      refetchSW();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao cadastrar software.", "error"); } 
    finally { setSavingSw(false); }
  };

  const handleDeleteSoftware = async (sw: Software) => {
    if (!confirm(`Excluir ${sw.name} do catálogo permanentemente?`)) return;
    try {
      await apiClient.delete(`/softwares/${sw.id}`);
      showToast("Software removido.", "warning");
      refetchSW();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao remover software.", "error"); }
  };

  const filteredLabs = (labs ?? []).filter(l => filterBlock === "all" || l.block === filterBlock);

  return (
    <div className="space-y-6 pb-12">
      {ToastComponent}

      {/* Modal de Importação de Softwares */}
      {showImportSw && (
        <ImportSoftwaresModal onClose={() => setShowImportSw(false)} onImported={refetchSW} />
      )}

      {/* Modal de Laboratório */}
      {(showForm || editTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 bg-neutral-50/50">
              <h3 className="text-xl font-bold text-neutral-900">{editTarget ? "Editar Laboratório" : "Novo Laboratório"}</h3>
              <button onClick={() => { setShowForm(false); setEditTarget(null); }} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
              <LabForm initial={editTarget ?? undefined} softwares={softwares ?? []} onSave={editTarget ? handleUpdateLab : handleCreateLab} onCancel={() => { setShowForm(false); setEditTarget(null); }} />
            </div>
          </div>
        </div>
      )}

      {/* Header Geral */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 border border-neutral-200 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center shadow-inner shrink-0">
             {activeTab === "labs" ? <Building2 size={24} className="text-white" /> : <AppWindow size={24} className="text-white" />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">{activeTab === "labs" ? "Laboratórios" : "Catálogo de Softwares"}</h1>
            <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-widest">Infraestrutura Institucional</p>
          </div>
        </div>
      </header>

      {/* Abas */}
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
        <button onClick={() => setActiveTab("labs")} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border whitespace-nowrap active:scale-[0.98] ${activeTab === "labs" ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:text-neutral-800"}`}>
          Salas e Laboratórios
        </button>
        <button onClick={() => setActiveTab("softwares")} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border whitespace-nowrap active:scale-[0.98] ${activeTab === "softwares" ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:text-neutral-800"}`}>
          Catálogo Geral de Softwares
        </button>
      </div>

      {/* Conteúdo: Laboratórios */}
      {activeTab === "labs" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <CustomDropdown value={filterBlock} options={[{ value: "all", label: "Todos os Blocos" }, ...BLOCKS.map(b => ({ value: b, label: b }))]} onChange={setFilterBlock} icon={Building2} />
            {canEdit && (
              <button onClick={() => { setShowForm(true); setEditTarget(null); }} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all bg-neutral-900 text-white hover:bg-neutral-800 shadow-md active:scale-95 shrink-0">
                <Plus size={14} /> Cadastrar Lab
              </button>
            )}
          </div>
          {loading && <LoadingSpinner label="Sincronizando laboratórios..." />}
          {error && <ErrorMessage message={error} onRetry={refetch} />}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredLabs.length === 0 ? (
                <div className="col-span-full rounded-3xl bg-white border border-dashed border-neutral-200 p-16 text-center"><Monitor size={48} className="mx-auto mb-4 text-neutral-200" /><p className="text-lg font-bold text-neutral-600">Nenhum laboratório mapeado.</p></div>
              ) : filteredLabs.map(lab => (
                <LabCard key={lab.id} lab={lab} softwares={softwares ?? []} canEdit={canEdit} onEdit={setEditTarget} onDelete={handleDeleteLab} activeReservations={todayReservations} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo: Softwares */}
      {activeTab === "softwares" && (
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Form */}
            {canEdit && (
              <div className="w-full lg:w-1/3 space-y-4 lg:border-r border-neutral-100 lg:pr-8">
                <div>
                  <h3 className="font-black text-lg text-neutral-900">Novo Software</h3>
                  <p className="text-xs font-medium text-neutral-500 mt-1 leading-relaxed">Adicione programas ao catálogo para que eles fiquem disponíveis para vínculo nos laboratórios.</p>
                </div>
                <form onSubmit={handleCreateSoftware} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Nome do Software *</label>
                    <input required value={swForm.name} onChange={e => setSwForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: AutoCAD" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Versão / Ano (Opcional)</label>
                    <input value={swForm.version} onChange={e => setSwForm(f => ({ ...f, version: e.target.value }))} placeholder="Ex: 2024.1" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neutral-900 outline-none transition-shadow shadow-sm" />
                  </div>
                  <button type="submit" disabled={savingSw} className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all shadow-md active:scale-[0.98] disabled:opacity-50">
                    {savingSw ? <LoadingSpinner label="" /> : "Registrar no Catálogo"}
                  </button>
                </form>
              </div>
            )}
            {/* Lista */}
            <div className={`w-full ${canEdit ? "lg:w-2/3" : ""}`}>
              <h3 className="font-black text-lg text-neutral-900 mb-5 flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-3">
                  Softwares Homologados na Instituição
                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-1 rounded-md border border-neutral-200">{softwares?.length || 0} registrados</span>
                </span>
                {canEdit && (
                  <button onClick={() => setShowImportSw(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">
                    <FileSpreadsheet size={14} /> Importar Softwares
                  </button>
                )}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[65vh] overflow-y-auto custom-scrollbar pr-2">
                {softwares?.map(sw => (
                  <div key={sw.id} className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl flex flex-col justify-between group hover:border-neutral-300 hover:shadow-md transition-all">
                    <div>
                      <p className="font-bold text-sm text-neutral-900 leading-tight">{sw.name}</p>
                      {sw.version && <p className="text-[10px] font-bold text-neutral-500 mt-1 bg-white border border-neutral-200 px-1.5 py-0.5 rounded w-fit">v.{sw.version}</p>}
                    </div>
                    {canEdit && (
                      <button onClick={() => handleDeleteSoftware(sw)} className="mt-4 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-700 w-fit opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Trash2 size={12} /> Remover
                      </button>
                    )}
                  </div>
                ))}
                {softwares?.length === 0 && <p className="col-span-full text-center text-sm font-bold text-neutral-400 py-10">O catálogo está vazio.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}