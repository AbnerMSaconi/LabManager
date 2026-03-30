import React, { useState } from "react";
import { Plus, Pencil, Trash2, Monitor, ChevronDown, ChevronUp, X, Check, Building2 } from "lucide-react";
import { UserRole, Laboratory, Software, Reservation } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { labsApi, CreateLabPayload, UpdateLabPayload } from "../api/labsApi";
import { reservationsApi } from "../api/reservationsApi";
import { useToast, LoadingSpinner, ErrorMessage } from "../components/ui";
import { ApiError } from "../api/client";
import { CustomDropdown } from "./reservationShared";

const BLOCKS = ["Bloco A", "Bloco B", "Bloco C", "Bloco M"];

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
    setForm(f => ({
      ...f,
      software_ids: f.software_ids.includes(id)
        ? f.software_ids.filter(x => x !== id)
        : [...f.software_ids, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form as any); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Nome do Laboratório *</label>
          <input required value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="Ex: LabInf 4"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm transition-shadow" />
        </div>
        <div className="z-[70]">
          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Bloco</label>
          <CustomDropdown 
            value={form.block} 
            options={BLOCKS.map(b => ({ value: b, label: b }))} 
            onChange={v => set("block", v)} 
            icon={Building2} 
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Número da Sala *</label>
          <input required value={form.room_number} onChange={e => set("room_number", e.target.value)}
            placeholder="Ex: 201"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm transition-shadow" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Capacidade (máquinas)</label>
          <input type="number" required min={1} value={form.capacity}
            onChange={e => set("capacity", Number(e.target.value))}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm transition-shadow" />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Descrição (opcional)</label>
        <textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)}
          placeholder="Descreva o laboratório..."
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none shadow-sm transition-shadow" />
      </div>

      <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
        <input type="checkbox" id="practical" checked={form.is_practical}
          onChange={e => set("is_practical", e.target.checked)}
          className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer" />
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
                <button key={sw.id} type="button" onClick={() => toggleSoftware(sw.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border active:scale-95 ${
                    sel ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                  }`}>
                  {sel && <Check size={12} />}
                  {sw.name} {sw.version ? `(${sw.version})` : ""}
                </button>
              );
            })}
            {softwares.length === 0 && (
              <p className="text-xs text-neutral-400 font-bold p-2">Nenhum software cadastrado no sistema ainda.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-neutral-200 font-bold text-sm text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-3 rounded-xl bg-neutral-900 text-white font-bold text-sm disabled:opacity-50 shadow-md hover:bg-neutral-800 transition-all active:scale-[0.98]">
          {saving ? <LoadingSpinner label="" /> : initial ? "Salvar alterações" : "Criar laboratório"}
        </button>
      </div>
    </form>
  );
}

function LabCard({
  lab, softwares, canEdit, onEdit, onDelete, activeReservations
}: {
  lab: Laboratory; softwares: Software[]; canEdit: boolean;
  onEdit: (l: Laboratory) => void; onDelete: (l: Laboratory) => void; activeReservations?: Reservation[];
}) {
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
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-0.5">
                {lab.block} · Sala {lab.room_number} · {lab.capacity} maq.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lab.is_practical && (
              <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                Prático
              </span>
            )}
          </div>
        </div>

        {currentReservation ? (
          <div className="mt-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 shadow-sm">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>
            <div>
              <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Em uso agora</p>
              <p className="text-xs font-bold text-blue-700 mt-0.5">{currentReservation.user?.full_name ?? "Professor"}</p>
            </div>
          </div>
        ) : (
          pendingOrApproved && pendingOrApproved.length > 0 && (
            <div className="mt-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Reservado hoje</p>
                <p className="text-xs font-bold text-emerald-700 mt-0.5">{pendingOrApproved.length} agendamento(s)</p>
              </div>
            </div>
          )
        )}

        {lab.softwares && lab.softwares.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {lab.softwares.map(sw => (
              <span key={sw.id} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 shadow-sm">
                {sw.name}
              </span>
            ))}
          </div>
        )}

        {lab.description && (
          <p className="text-xs font-medium text-neutral-500 mt-4 leading-relaxed line-clamp-2">{lab.description}</p>
        )}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-neutral-100">
          <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors">
            {expanded ? "Ocultar Sistema" : "Ver Sistema"} {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={() => onEdit(lab)} className="p-2 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-900 hover:text-white transition-all shadow-sm active:scale-95" title="Editar">
                <Pencil size={14} />
              </button>
              <button onClick={() => onDelete(lab)} className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95" title="Excluir">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2 bg-neutral-50/50 p-4 rounded-xl">
            <p className="text-xs text-neutral-500"><span className="font-bold uppercase tracking-widest text-[9px] mr-2">ID Sistema</span> #{lab.id}</p>
            <p className="text-xs text-neutral-500"><span className="font-bold uppercase tracking-widest text-[9px] mr-2">Tipo Perfil</span> {lab.is_practical ? "Prático (Componentes)" : "Informática Padrão"}</p>
            <p className="text-xs text-neutral-500"><span className="font-bold uppercase tracking-widest text-[9px] mr-2">Catálogo SW</span> {lab.softwares?.length ? lab.softwares.map(s => s.name).join(", ") : "Nenhum"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function LabsPage() {
  const { user } = useAuth();
  const { data: labs,      loading, error, refetch }  = useFetch(labsApi.list, [], true);
  const { data: softwares, refetch: refetchSW }        = useFetch(labsApi.listSoftwares);
  const { data: todayReservations } = useFetch(reservationsApi.listToday, [], true);
  const { showToast, ToastComponent } = useToast();

  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState<Laboratory | null>(null);
  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [newSwName, setNewSwName]   = useState("");

  const canEdit = user?.role === UserRole.PROGEX || user?.role === UserRole.ADMINISTRADOR || user?.role === UserRole.SUPER_ADMIN;

  const handleCreate = async (p: any) => {
    try {
      await labsApi.create(p);
      showToast("Laboratório criado com sucesso.", "success");
      setShowForm(false);
      refetch();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao criar.", "error"); }
  };

  const handleUpdate = async (p: any) => {
    if (!editTarget) return;
    try {
      await labsApi.update(editTarget.id, p);
      showToast("Laboratório atualizado.", "success");
      setEditTarget(null);
      refetch();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao atualizar.", "error"); }
  };

  const handleDelete = async (lab: Laboratory) => {
    if (!confirm(`Excluir "${lab.name}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    try {
      await labsApi.delete(lab.id);
      showToast("Laboratório excluído.", "warning");
      refetch();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao excluir.", "error"); }
  };

  const handleAddSoftware = async () => {
    if (!newSwName.trim()) return;
    try {
      await labsApi.createSoftware(newSwName.trim());
      showToast("Software cadastrado.", "success");
      setNewSwName("");
      refetchSW();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };

  const filtered = (labs ?? []).filter(l =>
    filterBlock === "all" || l.block === filterBlock
  );

  return (
    <div className="space-y-6 pb-12">
      {ToastComponent}

      {/* Modal de form */}
      {(showForm || editTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 bg-neutral-50/50">
              <h3 className="text-xl font-bold text-neutral-900">
                {editTarget ? "Editar Laboratório" : "Novo Laboratório"}
              </h3>
              <button onClick={() => { setShowForm(false); setEditTarget(null); }} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
              <LabForm
                initial={editTarget ?? undefined}
                softwares={softwares ?? []}
                onSave={editTarget ? handleUpdate : handleCreate}
                onCancel={() => { setShowForm(false); setEditTarget(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 border border-neutral-200 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center shadow-inner shrink-0">
             <Building2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Laboratórios</h1>
            <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-widest">
              {filtered.length} laboratório{filtered.length !== 1 ? "s" : ""} registrado{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <CustomDropdown 
            value={filterBlock} 
            options={[{ value: "all", label: "Todos os Blocos" }, ...BLOCKS.map(b => ({ value: b, label: b }))]} 
            onChange={setFilterBlock} 
            icon={Building2} 
          />
          {canEdit && (
            <button onClick={() => { setShowForm(true); setEditTarget(null); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all bg-neutral-900 text-white hover:bg-neutral-800 shadow-md shadow-neutral-900/20 active:scale-95">
              <Plus size={14} /> <span className="hidden sm:inline">Cadastrar Lab</span>
            </button>
          )}
        </div>
      </header>

      {/* Software rápido (só Progex/Admin) */}
      {canEdit && (
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-4">
            Módulo Rápido: Cadastrar Novo Software
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input value={newSwName} onChange={e => setNewSwName(e.target.value)}
              placeholder="Ex: AutoCAD 2024"
              className="flex-1 rounded-xl py-2.5 px-4 text-sm bg-neutral-50 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow"
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddSoftware())} />
            <button onClick={handleAddSoftware} disabled={!newSwName.trim()}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-neutral-900 text-white disabled:opacity-40 hover:bg-neutral-800 transition-all shadow-md active:scale-95">
              Registrar Software
            </button>
          </div>
          {softwares && softwares.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100 max-h-32 overflow-y-auto custom-scrollbar">
              {softwares.map(sw => (
                <span key={sw.id} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white text-neutral-600 border border-neutral-200 shadow-sm">
                  {sw.name} {sw.version ? <span className="text-neutral-400 font-medium ml-1">v.{sw.version}</span> : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <LoadingSpinner label="Sincronizando infraestrutura..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-3xl bg-white border border-dashed border-neutral-200 p-16 text-center">
              <Monitor size={48} className="mx-auto mb-4 text-neutral-200" />
              <p className="text-lg font-bold text-neutral-600">Nenhum laboratório mapeado.</p>
              <p className="text-sm text-neutral-400 mt-1">Utilize o botão acima para começar a mapear a infraestrutura.</p>
            </div>
          ) : filtered.map(lab => (
            <LabCard key={lab.id} lab={lab} softwares={softwares ?? []}
              canEdit={canEdit} onEdit={setEditTarget} onDelete={handleDelete}
              activeReservations={todayReservations} />
          ))}
        </div>
      )}
    </div>
  );
}