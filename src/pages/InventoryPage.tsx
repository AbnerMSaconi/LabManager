import React, { useState } from "react";
import { Search, Plus, Settings } from "lucide-react";
import { UserRole, ItemCategory, ItemModel } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { inventoryApi } from "../api/inventoryApi";
import { LoadingSpinner, ErrorMessage } from "../components/ui";
import { motion } from "motion/react";

const CATEGORY_LABELS: Record<string, string> = {
  [ItemCategory.ELETRICA]:    "Elétrica",
  [ItemCategory.ELETRONICA]:  "Eletrônica",
  [ItemCategory.FISICA]:      "Física",
  [ItemCategory.COMPONENTES]: "Componentes",
};

function ItemCard({ item, onAdd }: { item: ItemModel; onAdd?: (item: ItemModel) => void }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col"
    >
      <div className="aspect-square bg-neutral-100 relative">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 text-4xl font-bold">
            {item.name.charAt(0)}
          </div>
        )}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-neutral-600 shadow-sm">
          {CATEGORY_LABELS[item.category] ?? item.category}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-bold text-neutral-900 mb-1">{item.name}</h4>
        <p className="text-xs text-neutral-500 line-clamp-2 mb-4">{item.description}</p>
        <div className="mt-auto flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Disponível</p>
            <p className="text-sm font-bold text-neutral-900">{item.total_stock} unidades</p>
          </div>
          {onAdd && (
            <button
              onClick={() => onAdd(item)}
              className="bg-neutral-900 text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <Plus size={18} />
            </button>
          )}
          {!onAdd && (
            <div className="flex gap-2">
              <button className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg transition-colors"><Settings size={16} /></button>
              <button className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg transition-colors"><Plus size={16} /></button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function InventoryPage({ onAdd }: { onAdd?: (item: ItemModel) => void }) {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useFetch(inventoryApi.listModels);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = (data ?? []).filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || item.category === category;
    return matchSearch && matchCat;
  });

  const isDTI = user?.role !== UserRole.PROFESSOR;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{isDTI ? "Gestão de Inventário" : "Catálogo do Almoxarifado"}</h1>
          <p className="text-neutral-500">
            {isDTI ? "Gerencie modelos e itens físicos." : "Selecione os materiais para sua aula prática."}
          </p>
        </div>
        {isDTI && (
          <button className="bg-neutral-900 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800">
            <Plus size={18} /> Novo Modelo
          </button>
        )}
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            type="text"
            placeholder="Buscar material..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {["all", ...Object.values(ItemCategory)].map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                category === cat
                  ? "bg-neutral-900 text-white shadow-lg shadow-neutral-900/10"
                  : "bg-white text-neutral-500 border border-neutral-200 hover:border-neutral-900"
              }`}
            >
              {cat === "all" ? "Todos" : (CATEGORY_LABELS[cat] ?? cat)}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingSpinner label="Carregando inventário..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.length === 0
            ? <p className="text-neutral-400 col-span-4 text-center py-12">Nenhum item encontrado.</p>
            : filtered.map(item => <ItemCard key={item.id} item={item} onAdd={onAdd} />)
          }
        </div>
      )}
    </div>
  );
}
