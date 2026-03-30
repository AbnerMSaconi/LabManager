import React, { useState } from "react";
import { Plus, AlertTriangle, CheckCircle2, Clock, Wrench, X, Monitor, Filter } from "lucide-react";
import { UserRole } from "../types";
import { Ticket, CreateTicketPayload, maintenanceApi } from "../api/maintenanceApi";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { labsApi } from "../api/labsApi";
import { useToast, LoadingSpinner, ErrorMessage } from "../components/ui";
import { CustomDropdown } from "./reservationShared";
import { ApiError } from "../api/client";

const SEVERITY_STYLES = {
  baixo:   "bg-blue-50 text-blue-700 border-blue-200",
  medio:   "bg-amber-50 text-amber-700 border-amber-200",
  critico: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_STYLES = {
  aberto:       "bg-red-50 text-red-700 border-red-200",
  em_andamento: "bg-amber-50 text-amber-700 border-amber-200",
  resolvido:    "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_ICONS = {
  aberto:       <AlertTriangle size={14} />,
  em_andamento: <Clock size={14} />,
  resolvido:    <CheckCircle2 size={14} />,
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-start">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-neutral-900 truncate leading-tight">{ticket.title}</h3>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Ticket #{ticket.id}</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors ml-2 shrink-0"><X size={20} /></button>
        </div>
        
        <div className="p-6 space-y-6 bg-white">
          <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 text-sm text-neutral-600 font-medium">
             {ticket.description}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Alterar Status Operacional</label>
            <div className="flex gap-2">
              {(["em_andamento", "resolvido"] as const).map(s => (
                <button key={s} onClick={() => setNewStatus(s)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] shadow-sm ${newStatus === s ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}>
                  {s === "em_andamento" ? "Em andamento" : "Resolvido"}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Nota Técnica / Resolução</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} required
              placeholder="Descreva a solução aplicada ou os achados técnicos da investigação..."
              className="w-full bg-white border border-neutral-200 shadow-sm rounded-xl py-3 px-4 focus:ring-2 focus:ring-neutral-900 outline-none text-sm resize-none transition-shadow" />
          </div>
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">Cancelar</button>
          <button onClick={handleSave} disabled={!notes.trim() || saving}
            className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
            {saving ? <LoadingSpinner label="" /> : "Confirmar Alteração"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface NewTicketModalProps {
  labs: { id: number; name: string; block: string }[];
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-neutral-900">Novo Chamado (Ticket)</h3>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto custom-scrollbar bg-white">
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Título do Chamado *</label>
            <input required value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Ex: PC-03 não liga — LabInf 1"
              className="w-full bg-neutral-50 border border-neutral-200 shadow-sm rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-neutral-900 text-sm transition-shadow" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Descrição do Problema *</label>
            <textarea required rows={3} value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Descreva o problema ou erro apresentado na máquina..."
              className="w-full bg-neutral-50 border border-neutral-200 shadow-sm rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-neutral-900 text-sm resize-none transition-shadow" />
          </div>
          <div className="z-50 relative">
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Laboratório Atingido</label>
            <CustomDropdown 
              value={form.lab_id ?? ""} 
              options={[{ value: "", label: "— Geral (Nenhum Específico) —" }, ...labs.map(l => ({ value: l.id, label: `${l.name} (${l.block})` }))]} 
              onChange={v => set("lab_id", v ? Number(v) : undefined)} 
              icon={Monitor} 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Nível de Severidade</label>
            <div className="flex gap-2">
              {(["baixo", "medio", "critico"] as const).map(s => (
                <button type="button" key={s} onClick={() => set("severity", s)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] shadow-sm ${form.severity === s ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
              {saving ? <LoadingSpinner label="" /> : "Abrir Chamado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MaintenancePage() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useFetch(maintenanceApi.list, [], true);
  const { data: labs } = useFetch(labsApi.list);
  const { showToast, ToastComponent } = useToast();
  const [resolveTarget, setResolveTarget] = useState<Ticket | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("aberto");

  // PROGEX Removido
  const canManage = user?.role === UserRole.DTI_TECNICO || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMINISTRADOR;

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
    <div className="space-y-8 pb-12">
      {ToastComponent}
      {resolveTarget && <ResolveModal ticket={resolveTarget} onSave={handleResolve} onClose={() => setResolveTarget(null)} />}
      {showNew && <NewTicketModal labs={labs ?? []} onSave={handleCreate} onClose={() => setShowNew(false)} />}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 border border-neutral-200 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shadow-inner shrink-0">
             <Wrench size={24} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Painel de Manutenção</h1>
            <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-widest">Chamados e Ocorrências DTI</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} className="bg-neutral-900 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-all active:scale-95 shadow-md shadow-neutral-900/20">
          <Plus size={18} /> Novo Chamado
        </button>
      </header>

      {/* Sumário */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { key: "aberto",       label: "Ocorrências Abertas",  color: "text-red-600", bg: "bg-red-50/50", border: "border-red-200" },
          { key: "em_andamento", label: "Em Andamento DTI",     color: "text-amber-600", bg: "bg-amber-50/50", border: "border-amber-200" },
          { key: "resolvido",    label: "Tickets Resolvidos",   color: "text-emerald-600", bg: "bg-emerald-50/50", border: "border-emerald-200" },
        ].map(s => (
          <button key={s.key} onClick={() => setFilterStatus(s.key)}
            className={`p-6 rounded-3xl border transition-all text-left shadow-sm active:scale-[0.99] ${filterStatus === s.key ? `${s.border} ${s.bg} ring-2 ring-neutral-900/10` : "bg-white border-neutral-200 hover:shadow-md"}`}>
            <p className="text-[10px] md:text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">{s.label}</p>
            <p className={`text-4xl font-black ${s.color}`}>{counts[s.key as keyof typeof counts]}</p>
          </button>
        ))}
      </div>

      {/* Filtro rápido */}
      <div className="flex gap-2 bg-neutral-100 p-1.5 rounded-xl w-fit overflow-x-auto custom-scrollbar">
        {["todos", "aberto", "em_andamento", "resolvido"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap shadow-sm ${filterStatus === s ? "bg-white text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}>
            {s === "todos" ? "Todos os Tickets" : s === "em_andamento" ? "Em andamento" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner label="Atualizando lista de chamados..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.length === 0 ? (
            <div className="col-span-full bg-white rounded-3xl border border-dashed border-neutral-200 p-16 text-center text-neutral-400">
              <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4" />
              <p className="font-bold text-lg text-neutral-600">Caixa de chamados zerada</p>
              <p className="font-medium mt-1">Nenhum chamado {filterStatus !== "todos" ? `com status "${filterStatus}"` : "registrado no sistema"}.</p>
            </div>
          ) : filtered.map(ticket => (
            <div key={ticket.id} className="bg-white rounded-3xl border border-neutral-200/80 shadow-sm p-6 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h4 className="font-black text-lg text-neutral-900 leading-tight truncate" title={ticket.title}>{ticket.title}</h4>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Ticket #{ticket.id}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 border shadow-sm ${SEVERITY_STYLES[ticket.severity]}`}>
                  <AlertTriangle size={12} /> {ticket.severity}
                </span>
              </div>

              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 flex-1 mb-4">
                <p className="text-sm text-neutral-600 font-medium leading-relaxed line-clamp-3" title={ticket.description}>{ticket.description}</p>
                {ticket.lab_name && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50/50 w-fit px-2.5 py-1.5 rounded-lg border border-blue-100">
                    <Monitor size={14} /> {ticket.lab_name}
                  </div>
                )}
                {ticket.resolution_notes && (
                  <div className="mt-3 p-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-700 leading-relaxed shadow-sm">
                    <span className="font-black text-[10px] uppercase tracking-widest text-emerald-600 block mb-1">Nota de Resolução</span>
                    {ticket.resolution_notes}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-neutral-100 flex justify-between items-center">
                <div>
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5 w-fit border shadow-sm ${STATUS_STYLES[ticket.status]}`}>
                    {STATUS_ICONS[ticket.status]} {ticket.status.replace("_", " ")}
                  </span>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    {new Date(ticket.created_at).toLocaleDateString("pt-BR")} • Por {ticket.opened_by}
                  </p>
                </div>
                {canManage && ticket.status !== "resolvido" && (
                  <button onClick={() => setResolveTarget(ticket)}
                    className="text-xs bg-neutral-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
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