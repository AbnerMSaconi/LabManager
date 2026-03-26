import React, { useState, useMemo } from "react";
import {
  ArrowUpRight, ArrowDownLeft, Handshake, RotateCcw,
  Search, Filter, Package,
} from "lucide-react";
import { InventoryMovement } from "../types";
import { useFetch } from "../hooks/useFetch";
import { inventoryApi } from "../api/inventoryApi";
import { LoadingSpinner, ErrorMessage } from "../components/ui";

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  saida:      { label: "Saída",      icon: ArrowUpRight,  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  entrada:    { label: "Entrada",    icon: ArrowDownLeft, badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  emprestimo: { label: "Empréstimo", icon: Handshake,     badge: "bg-blue-50 text-blue-700 border-blue-200" },
  devolucao:  { label: "Devolução",  icon: RotateCcw,     badge: "bg-violet-50 text-violet-700 border-violet-200" },
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-neutral-900">Movimentações do Almoxarifado</h1>
        <p className="text-neutral-500 mt-1">Rastreabilidade completa de saídas, entradas e empréstimos.</p>
      </header>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por item, operador ou destinatário..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-neutral-400 shrink-0" />
          <div className="flex gap-1.5 overflow-x-auto">
            {(["all", "saida", "entrada", "emprestimo", "devolucao"] as const).map(a => {
              const cfg = a === "all" ? null : ACTION_CONFIG[a];
              return (
                <button key={a} onClick={() => setActionFilter(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${
                    actionFilter === a
                      ? "bg-neutral-900 text-white border-neutral-900"
                      : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"
                  }`}>
                  {a === "all" ? "Todos" : cfg?.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading && <LoadingSpinner label="Carregando movimentações..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Package size={44} className="text-neutral-200 mx-auto mb-3" />
              <p className="text-neutral-400 font-medium">Nenhuma movimentação encontrada.</p>
              {(search || actionFilter !== "all") && (
                <button onClick={() => { setSearch(""); setActionFilter("all"); }}
                  className="mt-3 text-sm text-blue-600 hover:underline">
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-neutral-400 font-medium">{filtered.length} registro(s)</p>

              {/* Desktop table */}
              <div className="hidden md:block bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      <th className="text-left px-5 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Data/Hora</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Ação</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Item</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Qtd</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Operador (DTI)</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Para / De</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Referência</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filtered.map((m: InventoryMovement) => {
                      const cfg = ACTION_CONFIG[m.action];
                      const Icon = cfg?.icon ?? Package;
                      return (
                        <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-5 py-3 text-neutral-500 whitespace-nowrap font-mono text-xs">
                            {fmtDateTime(m.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 border px-2 py-1 rounded-lg text-xs font-bold ${cfg?.badge ?? ""}`}>
                              <Icon size={11} />
                              {cfg?.label ?? m.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-neutral-900">
                            {m.model?.name ?? `#${m.item_model_id}`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-neutral-900">{m.quantity}</span>
                            <span className="text-neutral-400 text-xs"> un.</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-neutral-900 text-xs">{m.operator?.full_name ?? `#${m.operator_id}`}</p>
                            {m.operator?.role && (
                              <p className="text-[10px] text-neutral-400">{ROLE_LABELS[m.operator.role] ?? m.operator.role}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-neutral-700 text-xs">{m.target}</td>
                          <td className="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">
                            {m.reservation_id && <span className="bg-neutral-100 rounded px-1.5 py-0.5 text-neutral-600">Reserva #{m.reservation_id}</span>}
                            {m.loan_id && <span className="bg-blue-50 rounded px-1.5 py-0.5 text-blue-600">Empréstimo #{m.loan_id}</span>}
                          </td>
                          <td className="px-4 py-3 text-neutral-500 text-xs max-w-[180px] truncate">
                            {m.observation ?? <span className="text-neutral-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filtered.map((m: InventoryMovement) => {
                  const cfg = ACTION_CONFIG[m.action];
                  const Icon = cfg?.icon ?? Package;
                  return (
                    <div key={m.id} className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-bold text-neutral-900 text-sm">{m.model?.name ?? `Item #${m.item_model_id}`}</p>
                          <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{fmtDateTime(m.created_at)}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 border px-2 py-1 rounded-lg text-xs font-bold shrink-0 ${cfg?.badge ?? ""}`}>
                          <Icon size={11} />
                          {cfg?.label ?? m.action}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">Quantidade</p>
                          <p className="font-bold text-neutral-900 mt-0.5">{m.quantity} un.</p>
                        </div>
                        <div>
                          <p className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">Operador (DTI)</p>
                          <p className="font-medium text-neutral-900 mt-0.5">{m.operator?.full_name ?? `#${m.operator_id}`}</p>
                        </div>
                        <div>
                          <p className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">Para / De</p>
                          <p className="text-neutral-700 mt-0.5">{m.target}</p>
                        </div>
                        {(m.reservation_id || m.loan_id) && (
                          <div>
                            <p className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">Referência</p>
                            <p className="mt-0.5">
                              {m.reservation_id && <span className="bg-neutral-100 rounded px-1.5 py-0.5 text-neutral-600">Reserva #{m.reservation_id}</span>}
                              {m.loan_id && <span className="bg-blue-50 rounded px-1.5 py-0.5 text-blue-600">Empréstimo #{m.loan_id}</span>}
                            </p>
                          </div>
                        )}
                      </div>

                      {m.observation && (
                        <div className="mt-3 bg-neutral-50 rounded-lg px-3 py-2 text-xs text-neutral-600">
                          <span className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">Obs: </span>
                          {m.observation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
