import React, { useState } from "react";
import { Plus, Pencil, Trash2, Monitor, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import { UserRole, Laboratory, LaboratoryBlock, Software, Reservation } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { labsApi, CreateLabPayload, UpdateLabPayload } from "../api/labsApi";
import { reservationsApi } from "../api/reservationsApi";
import { useToast, LoadingSpinner, ErrorMessage } from "../components/ui";
import { ApiError } from "../api/client";

const BLOCKS = ["Bloco A", "Bloco B", "Bloco C"];

const BLOCK_COLORS: Record<string, string> = {
  "Bloco A": "var(--info-bg)",
  "Bloco B": "var(--purple-bg)",
  "Bloco C": "var(--success-bg)",
};
const BLOCK_TEXT: Record<string, string> = {
  "Bloco A": "var(--info-text)",
  "Bloco B": "var(--purple-text)",
  "Bloco C": "var(--success-text)",
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: "var(--text-secondary)" }}>Nome do Laboratório</label>
          <input required value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="Ex: LabInf 4"
            className="w-full rounded-xl py-2.5 px-4 border text-sm"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: "var(--text-secondary)" }}>Bloco</label>
          <select value={form.block} onChange={e => set("block", e.target.value)}
            className="w-full rounded-xl py-2.5 px-4 border text-sm"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
            {BLOCKS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: "var(--text-secondary)" }}>Número da Sala</label>
          <input required value={form.room_number} onChange={e => set("room_number", e.target.value)}
            placeholder="Ex: 201"
            className="w-full rounded-xl py-2.5 px-4 border text-sm"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: "var(--text-secondary)" }}>Capacidade (máquinas)</label>
          <input type="number" required min={1} value={form.capacity}
            onChange={e => set("capacity", Number(e.target.value))}
            className="w-full rounded-xl py-2.5 px-4 border text-sm"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: "var(--text-secondary)" }}>Descrição (opcional)</label>
        <textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)}
          placeholder="Descreva o laboratório..."
          className="w-full rounded-xl py-2.5 px-4 border text-sm resize-none"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="practical" checked={form.is_practical}
          onChange={e => set("is_practical", e.target.checked)}
          className="w-4 h-4 rounded" />
        <label htmlFor="practical" className="text-sm" style={{ color: "var(--text-primary)" }}>
          Laboratório prático (permite solicitação de materiais do almoxarifado)
        </label>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--text-secondary)" }}>Softwares instalados</label>
        <div className="flex flex-wrap gap-2">
          {softwares.map(sw => {
            const sel = form.software_ids.includes(sw.id);
            return (
              <button key={sw.id} type="button" onClick={() => toggleSoftware(sw.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5"
                style={{
                  background: sel ? "var(--ucdb-blue)" : "var(--bg-secondary)",
                  color: sel ? "#fff" : "var(--text-secondary)",
                  borderColor: sel ? "var(--ucdb-blue)" : "var(--border)",
                }}>
                {sel && <Check size={11} />}
                {sw.name} {sw.version ? `(${sw.version})` : ""}
              </button>
            );
          })}
          {softwares.length === 0 && (
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Nenhum software cadastrado ainda.</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
          style={{ background: "var(--ucdb-blue)", color: "#fff" }}>
          {saving ? "Salvando..." : initial ? "Salvar alterações" : "Criar laboratório"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2.5 rounded-xl font-bold text-sm border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function LabCard({
  lab, softwares, canEdit, onEdit, onDelete, activeReservations
}: {
  lab: Laboratory;
  softwares: Software[];
  canEdit: boolean;
  onEdit: (l: Laboratory) => void;
  onDelete: (l: Laboratory) => void;
  activeReservations?: Reservation[];
}) {
  const [expanded, setExpanded] = useState(false);
  const block = lab.block as string;

  // Descobre se o lab está em uso AGORA
  const currentReservation = activeReservations?.find(r => 
    r.lab_id === lab.id && r.status === "em_uso"
  );
  
  const pendingOrApproved = activeReservations?.filter(r => 
    r.lab_id === lab.id && (r.status === "aprovado" || r.status === "pendente")
  );

  return (
    <div className="rounded-2xl border overflow-hidden shadow-sm transition-all"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-3 rounded-xl shrink-0"
              style={{ background: BLOCK_COLORS[block] ?? "var(--bg-secondary)" }}>
              <Monitor size={20} style={{ color: BLOCK_TEXT[block] ?? "var(--text-primary)" }} />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-base truncate" style={{ color: "var(--text-primary)" }}>{lab.name}</h4>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {lab.block} · Sala {lab.room_number} · {lab.capacity} máquinas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: BLOCK_COLORS[block], color: BLOCK_TEXT[block] }}>
              {block}
            </span>
            {lab.is_practical && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: "var(--warning-bg)", color: "var(--warning-text)" }}>
                PRÁTICO
              </span>
            )}
          </div>
        </div>

        {currentReservation && (
          <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <p className="text-xs font-bold text-blue-800">
              EM USO AGORA • {currentReservation.user?.full_name ?? "Professor"}
            </p>
          </div>
        )}
        
        {!currentReservation && pendingOrApproved && pendingOrApproved.length > 0 && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-xs font-bold text-amber-800">
              Reservado para hoje ({pendingOrApproved.length} agendamento{pendingOrApproved.length > 1 ? 's' : ''})
            </p>
          </div>
        )}

        {lab.softwares && lab.softwares.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {lab.softwares.map(sw => (
              <span key={sw.id} className="px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                style={{ background: "var(--info-bg)", color: "var(--info-text)" }}>
                {sw.name}
              </span>
            ))}
          </div>
        )}

        {lab.description && (
          <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>{lab.description}</p>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? "Menos detalhes" : "Mais detalhes"}
          </button>
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={() => onEdit(lab)}
                className="p-2 rounded-xl border transition-all"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>
                <Pencil size={14} />
              </button>
              <button onClick={() => onDelete(lab)}
                className="p-2 rounded-xl border transition-all"
                style={{ borderColor: "var(--danger-bg)", color: "var(--danger-text)", background: "var(--danger-bg)" }}>
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold">ID:</span> #{lab.id}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold">Tipo:</span> {lab.is_practical ? "Laboratório Prático" : "Laboratório de Informática"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold">Softwares:</span>{" "}
              {lab.softwares?.length ? lab.softwares.map(s => s.name).join(", ") : "Nenhum"}
            </p>
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

  const canEdit = user?.role === UserRole.PROGEX;

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
    <div className="space-y-6">
      {ToastComponent}

      {/* Modal de form */}
      {(showForm || editTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--bg-card)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {editTarget ? "Editar Laboratório" : "Novo Laboratório"}
              </h3>
              <button onClick={() => { setShowForm(false); setEditTarget(null); }}
                style={{ color: "var(--text-tertiary)" }}>
                <X size={20} />
              </button>
            </div>
            <LabForm
              initial={editTarget ?? undefined}
              softwares={softwares ?? []}
              onSave={editTarget ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditTarget(null); }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Laboratórios</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {filtered.length} laboratório{filtered.length !== 1 ? "s" : ""} cadastrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setShowForm(true); setEditTarget(null); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
            style={{ background: "var(--ucdb-blue)", color: "#fff" }}>
            <Plus size={16} /> Novo Laboratório
          </button>
        )}
      </div>

      {/* Software rápido (só Progex) */}
      {canEdit && (
        <div className="rounded-2xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
            Cadastrar novo software
          </p>
          <div className="flex gap-2">
            <input value={newSwName} onChange={e => setNewSwName(e.target.value)}
              placeholder="Ex: AutoCAD 2024"
              className="flex-1 rounded-xl py-2 px-3 border text-sm"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddSoftware())} />
            <button onClick={handleAddSoftware} disabled={!newSwName.trim()}
              className="px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
              style={{ background: "var(--ucdb-gold)", color: "var(--ucdb-blue-dark)" }}>
              Adicionar
            </button>
          </div>
          {softwares && softwares.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {softwares.map(sw => (
                <span key={sw.id} className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                  style={{ background: "var(--info-bg)", color: "var(--info-text)" }}>
                  {sw.name} {sw.version ? `(${sw.version})` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtro por bloco */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...BLOCKS].map(b => (
          <button key={b} onClick={() => setFilterBlock(b)}
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
            style={{
              background: filterBlock === b ? "var(--ucdb-blue)" : "var(--bg-card)",
              color: filterBlock === b ? "#fff" : "var(--text-secondary)",
              borderColor: filterBlock === b ? "var(--ucdb-blue)" : "var(--border)",
            }}>
            {b === "all" ? "Todos" : b}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner label="Carregando laboratórios..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-2 rounded-2xl border p-12 text-center"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
              <Monitor size={40} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-tertiary)" }} />
              <p style={{ color: "var(--text-tertiary)" }}>Nenhum laboratório cadastrado.</p>
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