import React, { useState, useMemo } from "react";
import {
  ArrowUpRight, ArrowDownLeft, Handshake, RotateCcw,
  Search, Filter, Package, Wrench, Trash2,
  List, LayoutGrid
} from "lucide-react";
import { InventoryMovement } from "../types";
import { useFetch } from "../hooks/useFetch";
import { inventoryApi } from "../api/inventoryApi";
import { LoadingSpinner, ErrorMessage } from "../components/ui";
import { CustomDropdown } from "./reservationShared";

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  saida:      { label: "Saída",      icon: ArrowUpRight,  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  entrada:    { label: "Entrada",    icon: ArrowDownLeft, badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  emprestimo: { label: "Empréstimo", icon: Handshake,     badge: "bg-blue-50 text-blue-700 border-blue-200" },
  devolucao:  { label: "Devolução",  icon: RotateCcw,     badge: "bg-violet-50 text-violet-700 border-violet-200" },
  reparo:     { label: "Reparo",     icon: Wrench,        badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  descarte:   { label: "Descarte",   icon: Trash2,        badge: "bg-red-50 text-red-700 border-red-200" },
};

const ROLE_LABELS: Record<string, string> = {
  dti_tecnico:    "DTI Técnico",
  dti_estagiario: "DTI Estagiário",
  administrador:  "Administrador",
  professor:      "Professor",
  progex:         "Progex",
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function MovementsPage() {
  const { data, loading, error, refetch } = useFetch(inventoryApi.listMovements, [], true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((m: InventoryMovement) => {
      const matchAction = actionFilter === "all" || m.action === actionFilter;
      const q = search.toLowerCase();
      const matchSearch = !q
        || m.model?.name?.toLowerCase().includes(q)
        || m.target?.toLowerCase().includes(q)
        || m.operator?.full_name?.toLowerCase().includes(q);
      return matchAction && matchSearch;
    });
  }, [data, search, actionFilter]);

  const actionOptions = [
    { value: "all", label: "Todas as Ações" },
    ...Object.entries(ACTION_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* ── Cabeçalho Moderno ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 border border-neutral-200 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center shadow-inner shrink-0">
             <RotateCcw size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Movimentações</h1>
            <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-widest">Rastreabilidade do Almoxarifado</p>
          </div>
        </div>
      </header>

      {/* ── Barra de Filtros e Controles ── */}
      <div className="flex flex-col xl:flex-row gap-4 items-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por item, operador ou destinatário..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
          <div className="w-full sm:w-auto">
            <CustomDropdown 
              value={actionFilter} 
              options={actionOptions} 
              onChange={setActionFilter} 
              icon={Filter} 
            />
          </div>

          {/* Toggle de Visualização */}
          <div className="flex items-center bg-neutral-100 p-1.5 rounded-xl shrink-0 self-start">
            <button 
              onClick={() => setViewMode("list")} 
              className={`p-1.5 rounded-lg transition-all active:scale-95 ${viewMode === "list" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-700"}`} 
              title="Modo Lista">
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode("grid")} 
              className={`p-1.5 rounded-lg transition-all active:scale-95 ${viewMode === "grid" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-700"}`} 
              title="Modo Grid">
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      {loading && <LoadingSpinner label="Carregando histórico de movimentações..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-24 bg-white border border-dashed border-neutral-200 rounded-3xl">
              <Package size={48} className="text-neutral-200 mx-auto mb-4" />
              <p className="text-lg font-bold text-neutral-600">Nenhuma movimentação encontrada.</p>
              {(search || actionFilter !== "all") && (
                <button onClick={() => { setSearch(""); setActionFilter("all"); }}
                  className="mt-3 text-sm text-blue-600 hover:underline font-bold">
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">{filtered.length} registro(s) listados</p>
              </div>

              {viewMode === "list" ? (
                /* ── Modo Lista (Tabela Moderna) ── */
                <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar">
                  <table className="w-full text-sm min-w-[1000px]">
                    <thead className="bg-neutral-50 border-b border-neutral-100">
                      <tr>
                        <th className="text-left px-5 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Data/Hora</th>
                        <th className="text-left px-4 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Ação</th>
                        <th className="text-left px-4 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Item</th>
                        <th className="text-center px-4 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Qtd</th>
                        <th className="text-left px-4 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Operador (DTI)</th>
                        <th className="text-left px-4 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Para / De</th>
                        <th className="text-left px-4 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Referência</th>
                        <th className="text-left px-4 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Observação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filtered.map((m: InventoryMovement) => {
                        const cfg = ACTION_CONFIG[m.action];
                        const Icon = cfg?.icon ?? Package;
                        return (
                          <tr key={m.id} className="hover:bg-neutral-50/50 transition-colors">
                            <td className="px-5 py-3 text-neutral-500 whitespace-nowrap font-mono text-[11px] font-bold">
                              {fmtDateTime(m.created_at)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider font-bold shadow-sm ${cfg?.badge ?? ""}`}>
                                <Icon size={12} />
                                {cfg?.label ?? m.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-neutral-900 text-sm">
                              {m.model?.name ?? `#${m.item_model_id}`}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span className="font-black text-neutral-900">{m.quantity}</span>
                              <span className="text-neutral-400 text-xs font-bold ml-1">un.</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="font-bold text-neutral-900 text-xs">{m.operator?.full_name ?? `#${m.operator_id}`}</p>
                              {m.operator?.role && (
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">{ROLE_LABELS[m.operator.role] ?? m.operator.role}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-neutral-700 text-xs font-medium">{m.target}</td>
                            <td className="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">
                              {m.reservation_id && <span className="bg-neutral-100 border border-neutral-200 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600 shadow-sm">Reserva #{m.reservation_id}</span>}
                              {m.loan_id && <span className="bg-blue-50 border border-blue-100 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 shadow-sm">Empréstimo #{m.loan_id}</span>}
                            </td>
                            <td className="px-4 py-3 text-neutral-500 text-xs max-w-[200px] truncate font-medium" title={m.observation}>
                              {m.observation ?? <span className="text-neutral-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ── Modo Grid (Cards Modernos) ── */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {filtered.map((m: InventoryMovement) => {
                    const cfg = ACTION_CONFIG[m.action];
                    const Icon = cfg?.icon ?? Package;
                    return (
                      <div key={m.id} className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <p className="font-black text-neutral-900 text-base line-clamp-1" title={m.model?.name}>{m.model?.name ?? `Item #${m.item_model_id}`}</p>
                            <p className="text-[10px] text-neutral-400 font-mono font-bold mt-1">{fmtDateTime(m.created_at)}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 border px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0 shadow-sm ${cfg?.badge ?? ""}`}>
                            <Icon size={12} />
                            {cfg?.label ?? m.action}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-y-4 gap-x-3 text-xs mb-auto bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                          <div>
                            <p className="text-neutral-400 font-bold uppercase tracking-widest text-[9px] mb-1">Quantidade</p>
                            <p className="font-black text-neutral-900 text-sm">{m.quantity} <span className="text-xs text-neutral-500 font-bold">un.</span></p>
                          </div>
                          <div>
                            <p className="text-neutral-400 font-bold uppercase tracking-widest text-[9px] mb-1">Operador (DTI)</p>
                            <p className="font-bold text-neutral-900 truncate" title={m.operator?.full_name}>{m.operator?.full_name ?? `#${m.operator_id}`}</p>
                          </div>
                          <div className="col-span-2 pt-2 border-t border-neutral-200/60">
                            <p className="text-neutral-400 font-bold uppercase tracking-widest text-[9px] mb-1">Para / De</p>
                            <p className="text-neutral-700 font-medium truncate" title={m.target}>{m.target}</p>
                          </div>
                          {(m.reservation_id || m.loan_id) && (
                            <div className="col-span-2 pt-2 border-t border-neutral-200/60">
                              <p className="text-neutral-400 font-bold uppercase tracking-widest text-[9px] mb-1.5">Referência</p>
                              <div className="flex gap-2">
                                {m.reservation_id && <span className="bg-white border border-neutral-200 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600 shadow-sm truncate">Reserva #{m.reservation_id}</span>}
                                {m.loan_id && <span className="bg-blue-50 border border-blue-100 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 shadow-sm truncate">Empréstimo #{m.loan_id}</span>}
                              </div>
                            </div>
                          )}
                        </div>

                        {m.observation && (
                          <div className="mt-4 bg-amber-50/50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-900 font-medium leading-relaxed">
                            <span className="font-bold text-amber-700 uppercase tracking-widest text-[9px] block mb-1">Observação</span>
                            {m.observation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}