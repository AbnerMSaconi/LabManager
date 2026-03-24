import React, { useState } from "react";
import { Plus, AlertTriangle, CheckCircle2, Clock, Wrench, X } from "lucide-react";
import { UserRole } from "../types";
import { Ticket, CreateTicketPayload, maintenanceApi } from "../api/maintenanceApi";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { labsApi } from "../api/labsApi";
import { useToast, LoadingSpinner, ErrorMessage } from "../components/ui";
import { ApiError } from "../api/client";

const SEVERITY_STYLES = {
  baixo:   "bg-blue-50 text-blue-700",
  medio:   "bg-amber-50 text-amber-700",
  critico: "bg-red-50 text-red-700",
};

const STATUS_STYLES = {
  aberto:       "bg-red-50 text-red-700",
  em_andamento: "bg-amber-50 text-amber-700",
  resolvido:    "bg-emerald-50 text-emerald-700",
};

const STATUS_ICONS = {
  aberto:       <AlertTriangle size={16} />,
  em_andamento: <Clock size={16} />,
  resolvido:    <CheckCircle2 size={16} />,
};

interface ResolveModalProps {
  ticket: Ticket;
  onSave: (notes: string, status: "em_andamento" | "resolvido") => Promise<void>;
  onClose: () => void;
}

function ResolveModal({ ticket, onSave, onClose }: ResolveModalProps) {
  const [notes, setNotes] = useState(ticket.resolution_notes ?? "");
  const [newStatus, setNewStatus] = useState<"em_andamento" | "resolvido">("resolvido");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    await onSave(notes, newStatus);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">{ticket.title}</h3>
            <p className="text-sm text-neutral-500">{ticket.description}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 ml-4"><X size={20} /></button>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Atualizar status</label>
          <div className="flex gap-2">
            {(["em_andamento", "resolvido"] as const).map(s => (
              <button key={s} onClick={() => setNewStatus(s)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${newStatus === s ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-200 text-neutral-500"}`}>
                {s === "em_andamento" ? "Em andamento" : "Resolvido"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Observações / resolução</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} required
            placeholder="Descreva o que foi feito ou o que está sendo investigado..."
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-neutral-900 outline-none text-sm resize-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={!notes.trim() || saving}
            className="flex-1 bg-neutral-900 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-40">
            {saving ? "Salvando..." : "Confirmar"}
          </button>
          <button onClick={onClose} className="px-6 py-2.5 border border-neutral-200 rounded-xl font-bold text-sm hover:bg-neutral-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

interface NewTicketModalProps {
  labs: { id: number; name: string }[];
  onSave: (p: CreateTicketPayload) => Promise<void>;
  onClose: () => void;
}

function NewTicketModal({ labs, onSave, onClose }: NewTicketModalProps) {
  const [form, setForm] = useState<CreateTicketPayload>({ title: "", description: "", severity: "medio" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof CreateTicketPayload, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Abrir Chamado de Manutenção</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X size={20} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Título</label>
            <input required value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Ex: PC-03 não liga — LabInf 1"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-neutral-900 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Descrição do problema</label>
            <textarea required rows={3} value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Descreva o problema com detalhes..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-neutral-900 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Laboratório (opcional)</label>
            <select value={form.lab_id ?? ""} onChange={e => set("lab_id", e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-neutral-900 text-sm">
              <option value="">— Nenhum —</option>
              {labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Severidade</label>
            <div className="flex gap-2">
              {(["baixo", "medio", "critico"] as const).map(s => (
                <button type="button" key={s} onClick={() => set("severity", s)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${form.severity === s ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-200 text-neutral-500 hover:border-neutral-400"}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-neutral-900 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-40">
              {saving ? "Abrindo..." : "Abrir Chamado"}
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2.5 border border-neutral-200 rounded-xl font-bold text-sm hover:bg-neutral-50">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MaintenancePage() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useFetch(maintenanceApi.list);
  const { data: labs } = useFetch(labsApi.list);
  const { showToast, ToastComponent } = useToast();
  const [resolveTarget, setResolveTarget] = useState<Ticket | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("aberto");

  const canManage = user?.role === UserRole.PROGEX || user?.role === UserRole.DTI_TECNICO;

  const handleCreate = async (p: CreateTicketPayload) => {
    try {
      await maintenanceApi.create(p);
      showToast("Chamado aberto com sucesso.", "success");
      setShowNew(false);
      refetch();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };

  const handleResolve = async (notes: string, status: "em_andamento" | "resolvido") => {
    if (!resolveTarget) return;
    try {
      await maintenanceApi.resolve(resolveTarget.id, { resolution_notes: notes, status });
      showToast("Chamado atualizado.", "success");
      setResolveTarget(null);
      refetch();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };

  const filtered = (data ?? []).filter(t => filterStatus === "todos" || t.status === filterStatus);

  const counts = {
    aberto:       (data ?? []).filter(t => t.status === "aberto").length,
    em_andamento: (data ?? []).filter(t => t.status === "em_andamento").length,
    resolvido:    (data ?? []).filter(t => t.status === "resolvido").length,
  };

  return (
    <div className="space-y-6">
      {ToastComponent}
      {resolveTarget && <ResolveModal ticket={resolveTarget} onSave={handleResolve} onClose={() => setResolveTarget(null)} />}
      {showNew && <NewTicketModal labs={labs ?? []} onSave={handleCreate} onClose={() => setShowNew(false)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Controle de Manutenção</h2>
          <p className="text-sm text-neutral-500">Chamados de problemas em laboratórios e equipamentos.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-neutral-800">
          <Plus size={16} /> Abrir Chamado
        </button>
      </div>

      {/* Sumário */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: "aberto",       label: "Em aberto",     color: "text-red-600" },
          { key: "em_andamento", label: "Em andamento",  color: "text-amber-600" },
          { key: "resolvido",    label: "Resolvidos",    color: "text-emerald-600" },
        ].map(s => (
          <button key={s.key} onClick={() => setFilterStatus(s.key)}
            className={`bg-white p-4 rounded-2xl border transition-all text-left ${filterStatus === s.key ? "border-neutral-900 shadow-md" : "border-neutral-200"}`}>
            <p className="text-xs font-bold text-neutral-400 uppercase mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{counts[s.key as keyof typeof counts]}</p>
          </button>
        ))}
      </div>

      {/* Filtro rápido */}
      <div className="flex gap-2">
        {["todos", "aberto", "em_andamento", "resolvido"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${filterStatus === s ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-500"}`}>
            {s === "todos" ? "Todos" : s === "em_andamento" ? "Em andamento" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner label="Carregando chamados..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-3 bg-white rounded-2xl border border-neutral-200 p-12 text-center text-neutral-400">
              Nenhum chamado {filterStatus !== "todos" ? `com status "${filterStatus}"` : ""}.
            </div>
          ) : filtered.map(ticket => (
            <div key={ticket.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 space-y-3 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className={`p-2 rounded-xl ${SEVERITY_STYLES[ticket.severity]}`}>
                  <Wrench size={18} />
                </div>
                <div className="flex gap-1.5 ml-auto flex-wrap justify-end">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${SEVERITY_STYLES[ticket.severity]}`}>
                    {ticket.severity.toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${STATUS_STYLES[ticket.status]}`}>
                    {STATUS_ICONS[ticket.status]}
                    {ticket.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <h4 className="font-bold text-neutral-900">{ticket.title}</h4>
                <p className="text-sm text-neutral-500 mt-1">{ticket.description}</p>
                {ticket.lab_name && (
                  <p className="text-xs text-neutral-400 mt-2">📍 {ticket.lab_name}</p>
                )}
                {ticket.resolution_notes && (
                  <div className="mt-2 p-2 bg-neutral-50 rounded-lg text-xs text-neutral-600">
                    <span className="font-bold">Obs:</span> {ticket.resolution_notes}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-neutral-100 flex justify-between items-center">
                <div>
                  <p className="text-xs text-neutral-400">
                    {ticket.opened_by} • {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  {ticket.resolved_at && (
                    <p className="text-xs text-emerald-600">
                      Resolvido em {new Date(ticket.resolved_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                {canManage && ticket.status !== "resolvido" && (
                  <button onClick={() => setResolveTarget(ticket)}
                    className="text-sm font-bold text-blue-600 hover:underline">
                    Atualizar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
