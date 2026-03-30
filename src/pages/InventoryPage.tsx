import React, { useState, useMemo, useRef } from "react";
import {
  Search, Plus, QrCode, Edit2, Package, CheckCircle2,
  Calendar, Building2, AlertTriangle, List, LayoutGrid, Wrench, CalendarDays, Filter, X, Upload, FileSpreadsheet
} from "lucide-react";
import { UserRole, ItemCategory, ItemModel, Reservation, InstitutionLoan, AvailableItemModel, StockItem } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { inventoryApi, ImportedItem } from "../api/inventoryApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { CustomDropdown } from "./reservationShared"; 
import { ApiError } from "../api/client";
import { motion } from "motion/react";

const CATEGORY_LABELS: Record<string, string> = {
  eletrica: "Elétrica", eletronica: "Eletrônica", fisica: "Física", componentes: "Componentes", automacao: "Automação",
};

// ── ItemModelFormModal ────────────────────────────────────────────────────────

function ItemModelFormModal({ item, onClose, onSaved }: {
  item?: ItemModel; onClose: () => void; onSaved: () => void;
}) {
  const { showToast, ToastComponent } = useToast();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? "eletrica",
    description: item?.description ?? "",
    model_number: item?.model_number ?? "",
    image_url: item?.image_url ?? "",
    total_stock: item?.total_stock ?? 0,
    maintenance_stock: (item as any)?.maintenance_stock ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { showToast("Informe o nome do item.", "error"); return; }
    setSaving(true);
    try {
      if (item) {
        await inventoryApi.updateModel(item.id, form);
      } else {
        await inventoryApi.createModel(form);
      }
      showToast(item ? "Item atualizado." : "Item criado.", "success");
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao salvar.", "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-neutral-900">{item ? "Editar Item" : "Novo Item"}</h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-6 space-y-5 bg-white">
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Nome *</label>
            <input className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-shadow"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="z-[70]">
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Categoria</label>
            <CustomDropdown 
              value={form.category} 
              options={Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))} 
              onChange={v => setForm(f => ({ ...f, category: v }))} 
              icon={Filter} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Estoque Total</label>
              <input type="number" min={0} className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-shadow"
                value={form.total_stock} onChange={e => setForm(f => ({ ...f, total_stock: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Avariados</label>
              <input type="number" min={0} className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-shadow bg-red-50 text-red-900 border-red-100 focus:ring-red-200"
                value={form.maintenance_stock} onChange={e => setForm(f => ({ ...f, maintenance_stock: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Descrição</label>
            <textarea rows={2} className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-none shadow-sm transition-shadow"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Modelo / Referência</label>
            <input className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-shadow"
              placeholder="Ex: Arduino Uno R3, 10kΩ..."
              value={form.model_number} onChange={e => setForm(f => ({ ...f, model_number: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">URL da Imagem</label>
            <input className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-shadow"
              value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
          </div>
        </div>
        
        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
            {saving ? <LoadingSpinner label="" /> : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QRCodeModal ───────────────────────────────────────────────────────────────

function QRCodeModal({ item, onClose }: { item: ItemModel; onClose: () => void }) {
  const qrCode = `LABMGR:MODEL:${item.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCode)}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col text-center">
        <div className="p-8">
          <h2 className="text-xl font-bold mb-1 text-neutral-900">{item.name}</h2>
          <p className="text-xs text-neutral-500 mb-6">Escaneie para movimentar no almoxarifado</p>
          <img src={qrUrl} alt={`QR ${item.name}`} className="w-52 h-52 mx-auto mb-4 rounded-xl border border-neutral-100 shadow-sm" />
          <p className="text-[11px] text-neutral-400 font-mono bg-neutral-50 py-1.5 rounded-lg border border-neutral-100">{qrCode}</p>
        </div>
        <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex gap-2">
          <button onClick={() => window.print()} className="flex-1 bg-white border border-neutral-200 rounded-xl py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-sm">Imprimir</button>
          <button onClick={onClose} className="flex-1 bg-neutral-900 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-neutral-800 transition-colors shadow-sm active:scale-[0.98]">Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ── InstitutionLoanModal ──────────────────────────────────────────────────────

function InstitutionLoanModal({ item, onClose, onSaved }: {
  item: ItemModel; onClose: () => void; onSaved: () => void;
}) {
  const { showToast, ToastComponent } = useToast();
  const [form, setForm] = useState({ requester_name: "", quantity_delivered: 1, return_date: "", no_return_reason: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.requester_name.trim()) { showToast("Informe o nome do solicitante.", "error"); return; }
    if (!form.return_date && !form.no_return_reason.trim()) {
      showToast("Informe a data de devolução ou o motivo pela ausência.", "error"); return;
    }
    setSaving(true);
    try {
      await inventoryApi.createLoan({
        item_model_id: item.id, requester_name: form.requester_name, quantity_delivered: form.quantity_delivered,
        return_date: form.return_date || undefined, no_return_reason: !form.return_date ? form.no_return_reason : undefined,
      });
      showToast("Empréstimo registrado.", "success");
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao registrar.", "error"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Empréstimo (Instituição)</h2>
            <p className="text-xs font-medium text-neutral-500 mt-1">{item.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-5 bg-white">
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Nome do Solicitante *</label>
            <input className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-shadow"
              value={form.requester_name} onChange={e => setForm(f => ({ ...f, requester_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Qtd. Entregue</label>
              <input type="number" min={1} max={item.available_qty} className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-shadow"
                value={form.quantity_delivered} onChange={e => setForm(f => ({ ...f, quantity_delivered: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Data de Devolução</label>
              <div className="relative flex items-center bg-white border border-neutral-200 rounded-xl px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-neutral-300 transition-shadow">
                <CalendarDays size={16} className="text-neutral-400 shrink-0 mr-2" />
                <input type="date" className="appearance-none bg-transparent text-neutral-800 text-sm font-bold focus:outline-none w-full cursor-pointer"
                  value={form.return_date} onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} />
              </div>
            </div>
          </div>
          {!form.return_date && (
            <div>
              <label className="block text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Motivo (sem data de devolução) *</label>
              <textarea rows={2} className="w-full border border-amber-200 bg-amber-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none shadow-sm transition-shadow"
                value={form.no_return_reason} onChange={e => setForm(f => ({ ...f, no_return_reason: e.target.value }))} />
            </div>
          )}
        </div>
        
        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
            {saving ? <LoadingSpinner label="" /> : "Registrar Saída"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LoanReturnModal ───────────────────────────────────────────────────────────

function LoanReturnModal({ loan, onClose, onSaved }: {
  loan: InstitutionLoan; onClose: () => void; onSaved: () => void;
}) {
  const { showToast, ToastComponent } = useToast();
  const [allReturned, setAllReturned] = useState<boolean | null>(null);
  const [qty, setQty] = useState(loan.quantity_delivered);
  const [hasDamage, setHasDamage] = useState<boolean | null>(null);
  const [isOperational, setIsOperational] = useState<boolean | null>(null);
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = allReturned !== null && hasDamage !== null && (!hasDamage || (isOperational !== null && observation.trim().length > 0));

  const handleReturn = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await inventoryApi.returnLoan(loan.id, {
        all_returned: allReturned!, quantity_returned: allReturned ? loan.quantity_delivered : qty,
        has_damage: hasDamage!, is_operational: hasDamage ? isOperational ?? undefined : undefined,
        damage_observation: hasDamage ? observation : undefined,
      });
      showToast("Devolução registrada com sucesso.", "success");
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao registrar.", "error"); } finally { setSaving(false); }
  };

  const YesNoButtons = ({ value, onChange, labels }: { value: boolean | null; onChange: (v: boolean) => void; labels?: [string, string]; }) => (
    <div className="flex gap-2 mt-1">
      {([true, false] as const).map((v, i) => (
        <button key={String(v)} onClick={() => onChange(v)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] shadow-sm ${
            value === v ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
          }`}>
          {labels ? labels[i] : v ? "Sim" : "Não"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Registrar Devolução</h2>
            <p className="text-xs font-medium text-neutral-500 mt-1">{loan.model?.name} · {loan.requester_name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-6 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div>
            <p className="text-sm font-bold text-neutral-800 mb-2">Todos os {loan.quantity_delivered} itens foram devolvidos?</p>
            <YesNoButtons value={allReturned} onChange={setAllReturned} labels={["Sim, todos", "Parcialmente"]} />
          </div>

          {allReturned === false && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Qtd devolvida fisicamente</label>
              <input type="number" min={0} max={loan.quantity_delivered} className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-sm transition-shadow"
                value={qty} onChange={e => setQty(parseInt(e.target.value) || 0)} />
            </motion.div>
          )}

          {allReturned !== null && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm font-bold text-neutral-800 mb-2">Algum item apresenta avaria?</p>
              <YesNoButtons value={hasDamage} onChange={setHasDamage} />
            </motion.div>
          )}

          {hasDamage === true && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 bg-red-50/50 p-4 rounded-2xl border border-red-100">
              <div>
                <p className="text-sm font-bold text-red-900 mb-2">O material ainda está operante?</p>
                <YesNoButtons value={isOperational} onChange={setIsOperational} labels={["Sim, operante", "Não operante"]} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-red-700 uppercase tracking-widest mb-1.5">Descrição da avaria *</label>
                <textarea rows={3} className="w-full border border-red-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none shadow-sm transition-shadow bg-white"
                  placeholder="Descreva em detalhes o que aconteceu..." value={observation} onChange={e => setObservation(e.target.value)} />
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">Cancelar</button>
          <button onClick={handleReturn} disabled={!canSubmit || saving}
            className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
            {saving ? <LoadingSpinner label="" /> : "Confirmar Devolução"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MaterialRequestWizard ─────────────────────────────────────────────────────

function MaterialRequestWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { showToast, ToastComponent } = useToast();
  const { data: reservations, loading } = useFetch(inventoryApi.myPracticalReservations, [], true);
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [availableItems, setAvailableItems] = useState<AvailableItemModel[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  const slotPeriod = (slots: any[]) => {
    if (!slots?.length) return "";
    const code = slots[0]?.code ?? "";
    if (code.startsWith("M")) return "Manhã";
    if (code.startsWith("T")) return "Tarde";
    if (code.startsWith("N")) return "Noite";
    return "";
  };

  const slotRange = (slots: any[]) => {
    if (!slots?.length) return "";
    const sorted = [...slots].sort((a, b) => a.code?.localeCompare(b.code));
    return `${sorted[0].start_time} – ${sorted[sorted.length - 1].end_time}`;
  };

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const handleSelect = async (res: Reservation) => {
    setSelected(res);
    setLoadingItems(true);
    setStep(2);
    try {
      const items = await inventoryApi.listAvailable(res.date);
      setAvailableItems(items);
      setQuantities(Object.fromEntries(items.map(i => [i.id, 0])));
    } catch {
      showToast("Erro ao carregar materiais disponíveis.", "error");
    } finally { setLoadingItems(false); }
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const items = (Object.entries(quantities) as [string, number][])
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ item_model_id: parseInt(id), quantity_requested: q }));
    if (!items.length) { showToast("Selecione ao menos um material.", "error"); return; }
    setSaving(true);
    try {
      await inventoryApi.addReservationItems(selected.id, items);
      showToast("Solicitação enviada com sucesso!", "success");
      setTimeout(() => { onDone(); onClose(); }, 1000);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao enviar solicitação.", "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Solicitar Materiais</h2>
            <p className="text-xs font-medium text-neutral-500 mt-1">
              {step === 1 ? "Passo 1: Selecione a reserva" : `Passo 2: Selecione os materiais para ${fmtDate(selected?.date ?? "")}`}
            </p>
          </div>
          <div className="flex gap-2">
            {step === 2 && <button onClick={() => setStep(1)} className="px-3 py-1.5 text-xs font-bold text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors shadow-sm">← Voltar</button>}
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
          {step === 1 && (
            loading ? <LoadingSpinner label="Carregando suas reservas..." /> :
            !reservations?.length ? (
              <div className="text-center py-16 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                <Building2 size={40} className="text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-600 font-bold text-lg">Nenhuma reserva ativa no Bloco C</p>
                <p className="text-sm text-neutral-400 mt-2 max-w-sm mx-auto">Faça uma reserva em um laboratório do Bloco C para poder solicitar materiais complementares para a aula.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reservations.map(res => (
                  <button key={res.id} onClick={() => handleSelect(res)}
                    className="text-left border border-neutral-200 rounded-2xl p-5 hover:border-neutral-900 hover:shadow-md transition-all active:scale-[0.98] group bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-neutral-700 group-hover:text-neutral-900 transition-colors">
                        <Calendar size={16} />
                        <span className="font-bold text-sm">{fmtDate(res.date)}</span>
                      </div>
                      {res.slots?.length > 0 && (
                        <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-1 rounded-md uppercase tracking-wider">
                          {slotPeriod(res.slots)}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-base text-neutral-900">{res.laboratory?.name}</p>
                    <p className="text-xs font-medium text-neutral-500 mt-1">{res.laboratory?.block}</p>
                    {res.slots?.length > 0 && (
                      <p className="text-xs font-mono font-bold text-neutral-400 mt-3 bg-neutral-50 p-2 rounded-lg text-center border border-neutral-100">{slotRange(res.slots)}</p>
                    )}
                  </button>
                ))}
              </div>
            )
          )}

          {step === 2 && (
            loadingItems ? <LoadingSpinner label="Buscando estoque disponível..." /> :
            !availableItems.length ? (
              <div className="text-center py-16 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                 <Package size={40} className="text-neutral-300 mx-auto mb-4" />
                 <p className="text-neutral-600 font-bold text-lg">Estoque Esgotado</p>
                 <p className="text-sm text-neutral-400 mt-2">Nenhum material disponível no almoxarifado para esta data.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableItems.map(item => (
                  <div key={item.id} className={`flex flex-col justify-between border rounded-2xl p-4 gap-4 transition-colors ${item.available_qty === 0 ? "border-neutral-100 bg-neutral-50/50 opacity-60" : "border-neutral-200 bg-white hover:border-neutral-300 shadow-sm"}`}>
                    <div>
                      <p className="font-bold text-sm text-neutral-900 mb-1">{item.name}</p>
                      <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{CATEGORY_LABELS[item.category] ?? item.category}</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md uppercase">{item.available_qty} em estoque</span>
                      <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg p-0.5 shadow-sm">
                        <button disabled={item.available_qty === 0} onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] || 0) - 1) }))} className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-200 disabled:opacity-30 active:scale-95 transition-all">-</button>
                        <span className="w-8 text-center text-sm font-bold text-neutral-900">{quantities[item.id] || 0}</span>
                        <button disabled={item.available_qty === 0 || (quantities[item.id] || 0) >= item.available_qty} onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.min(item.available_qty, (q[item.id] || 0) + 1) }))} className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-200 disabled:opacity-30 active:scale-95 transition-all">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">Cancelar</button>
          {step === 2 && (
            <button onClick={handleSubmit} disabled={saving || loadingItems}
              className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
              {saving ? <LoadingSpinner label="" /> : "Enviar Solicitação"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PendingRequestsTab ────────────────────────────────────────────────────────

function PendingRequestsTab() {
  const { data: pending, loading, error, refetch } = useFetch(inventoryApi.pendingRequests, [], true);

  if (loading) return <LoadingSpinner label="Carregando solicitações..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!pending?.length) return (
    <div className="text-center py-20 bg-white border border-dashed border-neutral-200 rounded-3xl">
      <CheckCircle2 size={48} className="text-emerald-300 mx-auto mb-4" />
      <p className="text-lg font-bold text-neutral-600">Tudo limpo por aqui</p>
      <p className="text-neutral-400 font-medium mt-1">Nenhuma solicitação pendente de entrega.</p>
    </div>
  );

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {pending.map(res => (
        <div key={res.id} className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="font-bold text-neutral-900 text-base">{res.user?.full_name}</p>
              <p className="text-xs font-medium text-neutral-500 mt-1 flex items-center gap-1.5"><CalendarDays size={12}/> {fmtDate(res.date)}</p>
              <p className="text-xs font-medium text-neutral-500 mt-1 flex items-center gap-1.5"><Building2 size={12}/> {res.laboratory?.name}</p>
            </div>
            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider text-center">
              Aguardando entrega
            </span>
          </div>
          <div className="mt-auto space-y-2">
            {res.items.map(item => (
              <div key={item.id} className="flex items-center justify-between text-xs text-neutral-700 bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2.5">
                <span className="font-medium truncate mr-2"><Package size={12} className="inline mr-1.5 text-neutral-400" />{item.model?.name ?? `Item #${item.item_model_id}`}</span>
                <span className="font-bold bg-white border border-neutral-200 px-2 py-0.5 rounded text-neutral-900">{item.quantity_requested} un.</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── LoansTab ──────────────────────────────────────────────────────────────────

function LoansTab({ onNewLoan }: { onNewLoan?: () => void }) {
  const { data: loans, loading, error, refetch } = useFetch(inventoryApi.listLoans, [], true);
  const [returning, setReturning] = useState<InstitutionLoan | null>(null);

  const STATUS_STYLES: Record<string, string> = {
    em_aberto: "bg-amber-50 text-amber-700 border-amber-200",
    devolvido: "bg-emerald-50 text-emerald-700 border-emerald-200",
    devolvido_com_avaria: "bg-red-50 text-red-700 border-red-200",
  };
  const STATUS_LABELS: Record<string, string> = {
    em_aberto: "Em aberto", devolvido: "Devolvido", devolvido_com_avaria: "Devolvido c/ avaria",
  };

  if (loading) return <LoadingSpinner label="Carregando empréstimos..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!loans?.length) return (
    <div className="text-center py-20 bg-white border border-dashed border-neutral-200 rounded-3xl">
      <Package size={48} className="text-neutral-300 mx-auto mb-4" />
      <p className="text-lg font-bold text-neutral-600">Nenhum empréstimo institucional</p>
      <p className="text-neutral-400 font-medium mt-1">Você ainda não registrou nenhum empréstimo de longo prazo.</p>
    </div>
  );

  return (
    <>
      {returning && (
        <LoanReturnModal loan={returning} onClose={() => setReturning(null)} onSaved={() => { setReturning(null); refetch(); }} />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loans.map(loan => (
          <div key={loan.id} className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="font-bold text-neutral-900 text-base truncate" title={loan.model?.name}>{loan.model?.name}</p>
                <p className="text-sm font-medium text-neutral-600 mt-1 truncate" title={loan.requester_name}>{loan.requester_name}</p>
              </div>
              <span className={`text-[10px] border px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider text-center shrink-0 ${STATUS_STYLES[loan.status] ?? ""}`}>
                {STATUS_LABELS[loan.status] ?? loan.status}
              </span>
            </div>
            
            <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 mb-4 text-xs font-medium text-neutral-600 space-y-1.5">
              <div className="flex justify-between"><span className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Entregues</span><span className="font-bold text-neutral-900">{loan.quantity_delivered} unidades</span></div>
              {loan.return_date && <div className="flex justify-between"><span className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Devolução</span><span className="font-bold text-neutral-900">{new Date(loan.return_date).toLocaleDateString("pt-BR")}</span></div>}
            </div>

            {loan.no_return_reason && (
              <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Motivo (Longo Prazo)</span>
                <p className="text-xs text-amber-800 leading-snug">{loan.no_return_reason}</p>
              </div>
            )}
            {loan.damage_observation && (
              <div className="mb-4 flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-xl p-3 border border-red-100">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span className="leading-snug">{loan.damage_observation}</span>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-neutral-100 flex justify-end">
              {loan.status === "em_aberto" ? (
                <button onClick={() => setReturning(loan)} className="w-full text-xs bg-neutral-900 text-white py-2.5 rounded-xl hover:bg-neutral-800 transition-all active:scale-[0.98] font-bold shadow-md shadow-neutral-900/20">
                  Registrar Devolução
                </button>
              ) : (
                <span className="w-full text-center text-xs font-bold text-neutral-400 py-2.5">Empréstimo Fechado</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Resolução de manutenção ───────────────────────────────────────────────────

function ResolveMaintenanceModal({ item, onClose, onSaved }: {
  item: StockItem; onClose: () => void; onSaved: () => void;
}) {
  const { showToast, ToastComponent } = useToast();
  const [qtyRepaired, setQtyRepaired] = useState(item.maintenance_stock);
  const [qtyDiscarded, setQtyDiscarded] = useState(0);
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  
  const totalSelected = qtyRepaired + qtyDiscarded;
  const errorMsg = totalSelected > item.maintenance_stock ? "Excede o limite." : totalSelected === 0 ? "Selecione a quantidade." : null;
  
  const handleResolve = async () => {
    if (errorMsg) return;
    setSaving(true);
    try {
      await inventoryApi.resolveMaintenance(item.id, { qty_repaired: qtyRepaired, qty_discarded: qtyDiscarded, observation: observation.trim() || undefined });
      showToast("Manutenção resolvida.", "success");
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao resolver.", "error"); } finally { setSaving(false); }
  };
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 shadow-inner">
              <Wrench size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 leading-tight">Resolver Avaria</h2>
              <p className="text-[11px] text-neutral-500 uppercase tracking-widest mt-0.5 font-semibold">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-6 bg-white">
          <div className="bg-neutral-50 border border-neutral-200 border-dashed rounded-xl p-4 text-center">
            <span className="block text-3xl font-bold text-neutral-900 mb-1">{item.maintenance_stock}</span>
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Unidades Avariadas Atualmente</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-200/50 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
              <label className="relative z-10 text-[10px] font-bold text-emerald-800 uppercase tracking-widest block mb-2">Qtd. Recuperada</label>
              <input type="number" min={0} max={item.maintenance_stock} className="relative z-10 w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-shadow"
                value={qtyRepaired} onChange={e => setQtyRepaired(parseInt(e.target.value) || 0)} />
              <p className="relative z-10 text-[9px] font-bold text-emerald-600/80 uppercase tracking-widest mt-2 text-center">Volta para Estoque Livre</p>
            </div>
            
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-200/50 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
              <label className="relative z-10 text-[10px] font-bold text-red-800 uppercase tracking-widest block mb-2">Qtd. Descartada</label>
              <input type="number" min={0} max={item.maintenance_stock} className="relative z-10 w-full bg-white border border-red-200 rounded-xl px-3 py-2.5 text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm transition-shadow"
                value={qtyDiscarded} onChange={e => setQtyDiscarded(parseInt(e.target.value) || 0)} />
              <p className="relative z-10 text-[9px] font-bold text-red-600/80 uppercase tracking-widest mt-2 text-center">Baixa Permanente</p>
            </div>
          </div>

          {errorMsg && <div className="bg-red-50 text-red-700 text-xs font-bold p-3 rounded-lg flex items-center justify-center border border-red-100"><AlertTriangle size={14} className="mr-1.5"/> {errorMsg}</div>}

          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Observações do Reparo/Descarte (Opcional)</label>
            <textarea rows={2} className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-none shadow-sm transition-shadow"
              placeholder="Ex: Trocado fusível interno; descartado por placa queimada..." value={observation} onChange={e => setObservation(e.target.value)} />
          </div>
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors bg-white shadow-sm">Cancelar</button>
          <button onClick={handleResolve} disabled={saving || !!errorMsg} className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20">
            {saving ? <LoadingSpinner label="" /> : "Confirmar Resolução"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Maintenance stock ─────────────────────────────────────────────────────────

function MaintenanceStockTab({ onResolve, canManageItems }: { onResolve: (item: StockItem) => void, canManageItems: boolean }) {
  const { data, loading, error, refetch } = useFetch(inventoryApi.listStock, [], true);
  
  const brokenItems = useMemo(() => (data ?? []).filter((i: StockItem) => i.maintenance_stock > 0), [data]);

  if (loading) return <LoadingSpinner label="Buscando itens avariados..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  
  if (brokenItems.length === 0) return (
    <div className="text-center py-20 bg-white border border-dashed border-neutral-200 rounded-3xl">
      <CheckCircle2 size={48} className="text-emerald-300 mx-auto mb-4" />
      <p className="text-lg font-bold text-neutral-600">Almoxarifado em dia!</p>
      <p className="text-neutral-400 font-medium mt-1">Nenhum equipamento na fila de manutenção no momento.</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {brokenItems.map((item: StockItem) => (
        <div key={item.id} className="bg-white border border-red-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <div className="flex justify-between items-start gap-3 mb-4">
            <div className="min-w-0">
              <p className="font-bold text-neutral-900 text-base truncate" title={item.name}>{item.name}</p>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{CATEGORY_LABELS[item.category] ?? item.category}</p>
            </div>
            <div className="bg-red-50 text-red-700 w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border border-red-100 shadow-inner">
              <span className="font-black text-lg leading-none">{item.maintenance_stock}</span>
              <span className="text-[8px] font-bold uppercase">Avarias</span>
            </div>
          </div>
          
          <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 mb-4">
             <div className="flex justify-between text-xs mb-1.5"><span className="text-neutral-500 font-medium">Estoque Total</span><span className="font-bold text-neutral-900">{item.total_stock} un.</span></div>
             <div className="flex justify-between text-xs"><span className="text-neutral-500 font-medium">Estoque Livre</span><span className="font-bold text-emerald-600">{item.available_qty} un.</span></div>
          </div>

          <div className="mt-auto pt-4 border-t border-neutral-100">
            {canManageItems ? (
              <button onClick={() => onResolve(item)}
                className="w-full text-xs bg-neutral-900 text-white py-2.5 rounded-xl hover:bg-neutral-800 transition-all active:scale-[0.98] font-bold shadow-md shadow-neutral-900/20 flex items-center justify-center gap-2">
                <Wrench size={14} /> Iniciar Manutenção / Baixa
              </button>
            ) : (
              <div className="w-full text-center text-xs font-bold text-neutral-400 py-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                Somente técnicos podem resolver
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── StockTab ──────────────────────────────────────────────────────────────────

function StockTab({ search, setSearch, category, setCategory, onEdit, onQr, onLoan, canManageItems }: {
  search: string; setSearch: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  onEdit: (item: ItemModel) => void;
  onQr: (item: ItemModel) => void;
  onLoan: (item: ItemModel) => void;
  canManageItems: boolean;
}) {
  const { data, loading, error, refetch } = useFetch(inventoryApi.listStock, [], true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => (data ?? []).filter((item: StockItem) =>
    item.name.toLowerCase().includes(search.toLowerCase()) && (category === "all" || item.category === category)
  ), [data, search, category]);

  return (
    <>
      <div className="flex flex-col xl:flex-row gap-4 items-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
          <input type="text" placeholder="Buscar material no estoque..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all placeholder:text-neutral-400" />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
          <div className="w-full sm:w-auto">
            <CustomDropdown 
              value={category} 
              options={[{ value: "all", label: "Todas as Categorias" }, ...Object.entries(ItemCategory).map(([k, v]) => ({ value: v, label: CATEGORY_LABELS[v] ?? v }))]} 
              onChange={setCategory} 
              icon={Filter} 
            />
          </div>
          <div className="flex items-center bg-neutral-100 p-1.5 rounded-xl shrink-0 self-start">
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-700"}`} title="Modo Lista"><List size={18} /></button>
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-700"}`} title="Modo Grid"><LayoutGrid size={18} /></button>
          </div>
        </div>
      </div>

      {loading && <LoadingSpinner label="Buscando informações do estoque..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      
      {!loading && !error && (
        viewMode === "list" ? (
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Item / Modelo</th>
                  <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-5 py-4 text-center text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Estoque Atual</th>
                  <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Status Alocação</th>
                  <th className="px-5 py-4 text-right text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Ações Operacionais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((item: StockItem) => (
                  <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-5 py-3 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                        {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-neutral-300 text-lg">{item.name.charAt(0)}</span>}
                      </div>
                      <div>
                        <p className="font-bold text-neutral-900 text-base">{item.name}</p>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">{CATEGORY_LABELS[item.category] ?? item.category}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-neutral-500 max-w-[200px] truncate" title={item.description}>{item.description || "—"}</td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      <span className="font-black text-lg text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">{item.available_qty}</span>
                      <span className="text-xs font-bold text-neutral-400 ml-2">de {item.total_stock}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {item.in_use > 0 && <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-md font-bold shadow-sm">{item.in_use} em uso</span>}
                        {item.in_loans > 0 && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md font-bold shadow-sm">{item.in_loans} emprestado</span>}
                        {item.maintenance_stock > 0 && <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md font-bold shadow-sm">{item.maintenance_stock} avariado</span>}
                        {item.in_use === 0 && item.in_loans === 0 && item.maintenance_stock === 0 && <span className="text-[10px] text-neutral-400 font-bold bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200">100% Livre</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {canManageItems && (
                          <button onClick={() => onEdit(item)} className="p-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-900 hover:text-white transition-all shadow-sm active:scale-95" title="Editar Informações"><Edit2 size={14}/></button>
                        )}
                        <button onClick={() => onQr(item)} className="p-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-900 hover:text-white transition-all shadow-sm active:scale-95" title="Imprimir Etiqueta QR"><QrCode size={14}/></button>
                        <button onClick={() => onLoan(item)} className="p-2.5 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95" title="Registrar Empréstimo Institucional"><Package size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <Package size={32} className="mx-auto text-neutral-200 mb-3" />
                      <p className="text-neutral-500 font-bold">Nenhum item corresponde à busca.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.length === 0
              ? <div className="col-span-4 text-center py-16 bg-white border border-dashed border-neutral-200 rounded-3xl">
                  <Package size={40} className="mx-auto text-neutral-200 mb-3" />
                  <p className="text-neutral-500 font-bold">Nenhum item corresponde à busca.</p>
                </div>
              : filtered.map((item: StockItem) => {
                const pct = item.total_stock > 0 ? (item.available_qty / item.total_stock) * 100 : 100;
                const barColor = pct > 50 ? "bg-emerald-400" : pct > 20 ? "bg-amber-400" : "bg-red-400";
                return (
                  <motion.div key={item.id} whileHover={{ y: -4 }}
                    className="bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-lg overflow-hidden flex flex-col transition-shadow">
                    <div className="aspect-square bg-neutral-100 relative group">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
                        : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-neutral-200">{item.name.charAt(0)}</div>
                      }
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] font-black text-neutral-700 uppercase tracking-widest shadow-sm border border-black/5">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h4 className="font-bold text-lg text-neutral-900 mb-1 leading-tight">{item.name}</h4>
                      <p className="text-xs font-medium text-neutral-500 line-clamp-2 mb-4 leading-relaxed">{item.description}</p>
                      
                      <div className="mt-auto space-y-4">
                        <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                          <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">
                            <span>Disp. P/ Aulas</span>
                            <span className="text-neutral-900">{item.available_qty} de {item.total_stock}</span>
                          </div>
                          <div className="w-full h-2 bg-neutral-200/60 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        {(item.in_use > 0 || item.in_loans > 0 || item.maintenance_stock > 0) && (
                          <div className="flex gap-1.5 flex-wrap">
                            {item.in_use > 0 && <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded font-bold tracking-wide shadow-sm">{item.in_use} em aula</span>}
                            {item.in_loans > 0 && <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded font-bold tracking-wide shadow-sm">{item.in_loans} instit.</span>}
                            {item.maintenance_stock > 0 && <span className="text-[9px] bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded font-bold tracking-wide shadow-sm">{item.maintenance_stock} avariado</span>}
                          </div>
                        )}
                        <div className={`grid ${canManageItems ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-2 border-t border-neutral-100`}>
                          {canManageItems && (
                            <button onClick={() => onEdit(item)} className="flex flex-col items-center justify-center gap-1.5 py-2 rounded-xl text-neutral-500 hover:bg-neutral-900 hover:text-white transition-colors active:scale-95">
                              <Edit2 size={16} /> <span className="text-[9px] font-bold uppercase tracking-wider">Editar</span>
                            </button>
                          )}
                          <button onClick={() => onQr(item)} className="flex flex-col items-center justify-center gap-1.5 py-2 rounded-xl text-neutral-500 hover:bg-neutral-900 hover:text-white transition-colors active:scale-95">
                            <QrCode size={16} /> <span className="text-[9px] font-bold uppercase tracking-wider">Gerar QR</span>
                          </button>
                          <button onClick={() => onLoan(item)} className="flex flex-col items-center justify-center gap-1.5 py-2 rounded-xl text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-600 hover:text-white transition-colors active:scale-95">
                            <Package size={16} /> <span className="text-[9px] font-bold uppercase tracking-wider">Emprestar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            }
          </div>
        )
      )}
    </>
  );
}

// ── ImportInventoryModal ──────────────────────────────────────────────────────

function ImportInventoryModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { showToast, ToastComponent } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ items: ImportedItem[]; errors: string[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const result = await inventoryApi.importPreview(file);
      setPreview(result);
      setStep(2);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao processar arquivo.", "error");
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!preview?.items.length) return;
    setConfirming(true);
    try {
      const result = await inventoryApi.importConfirm(preview.items);
      showToast(`Importação concluída: ${result.created} criados, ${result.skipped} ignorados.`, "success");
      setTimeout(() => { onImported(); onClose(); }, 1000);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao importar.", "error");
    } finally { setConfirming(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {ToastComponent}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Importar Inventário via Excel</h2>
            <p className="text-xs font-medium text-neutral-500 mt-1">
              {step === 1 ? "Passo 1: Selecione o arquivo .xlsx" : `Passo 2: Confirme os ${preview?.total ?? 0} itens encontrados`}
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
                <p className="text-xs text-neutral-400 mt-1">Formato: .xlsx · Colunas: Equipamentos, Categoria, Modelo, Quantidade</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </div>
              <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 text-xs text-neutral-600 space-y-1">
                <p className="font-bold text-neutral-700 mb-2">Formato esperado da planilha:</p>
                <p>- Coluna <span className="font-mono bg-white border border-neutral-200 px-1 rounded">Equipamentos</span> ou <span className="font-mono bg-white border border-neutral-200 px-1 rounded">Nome</span> — nome do item</p>
                <p>- Coluna <span className="font-mono bg-white border border-neutral-200 px-1 rounded">Categoria</span> — Eletrônica, Física, Automação, Elétrica, Componentes</p>
                <p>- Coluna <span className="font-mono bg-white border border-neutral-200 px-1 rounded">Modelo</span> — referência/modelo (opcional)</p>
                <p>- Coluna <span className="font-mono bg-white border border-neutral-200 px-1 rounded">Quantidade</span> — estoque total</p>
              </div>
            </>
          )}

          {step === 2 && preview && (
            <>
              {preview.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-1.5"><AlertTriangle size={14}/> {preview.errors.length} aviso(s)</p>
                  {preview.errors.map((err, i) => (
                    <p key={i} className="text-xs text-amber-700">{err}</p>
                  ))}
                </div>
              )}
              {preview.items.length === 0 ? (
                <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                  <Package size={36} className="mx-auto text-neutral-300 mb-3" />
                  <p className="font-bold text-neutral-600">Nenhum item válido encontrado na planilha.</p>
                </div>
              ) : (
                <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 border-b border-neutral-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Nome</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Categoria</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Modelo</th>
                        <th className="px-4 py-3 text-center text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Qtd</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {preview.items.map((item, i) => (
                        <tr key={i} className="hover:bg-neutral-50/50">
                          <td className="px-4 py-2.5 font-medium text-neutral-900">{item.name}</td>
                          <td className="px-4 py-2.5 text-xs text-neutral-500">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                          <td className="px-4 py-2.5 text-xs text-neutral-500">{item.model_number || "—"}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-neutral-900">{item.total_stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
              {loading ? <LoadingSpinner label="" /> : <><Upload size={16}/> Pré-visualizar</>}
            </button>
          )}
          {step === 2 && preview && preview.items.length > 0 && (
            <button onClick={handleConfirm} disabled={confirming}
              className="flex-1 bg-neutral-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-md shadow-neutral-900/20 flex items-center justify-center gap-2">
              {confirming ? <LoadingSpinner label="" /> : <><CheckCircle2 size={16}/> Importar {preview.items.length} itens</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main InventoryPage ────────────────────────────────────────────────────────

export function InventoryPage({ onAdd }: { onAdd?: (item: ItemModel) => void }) {
  const { user } = useAuth();
  const isProfessor = user?.role === UserRole.PROFESSOR;
  const canManageItems = user?.role === UserRole.DTI_TECNICO || user?.role === UserRole.ADMINISTRADOR || user?.role === UserRole.SUPER_ADMIN;

  const { data, loading, error, refetch } = useFetch(inventoryApi.listModels, [], true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dtiTab, setDtiTab] = useState<"stock" | "pending" | "loans" | "maintenance">("stock");
  const [editingItem, setEditingItem] = useState<ItemModel | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [qrItem, setQrItem] = useState<ItemModel | null>(null);
  const [loanItem, setLoanItem] = useState<ItemModel | null>(null);
  const [showRequestWizard, setShowRequestWizard] = useState(false);
  const [stockKey, setStockKey] = useState(0);
  const [loansKey, setLoansKey] = useState(0);
  const [resolvingMaintenance, setResolvingMaintenance] = useState<StockItem | null>(null);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => (data ?? []).filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) && (category === "all" || item.category === category)
  ), [data, search, category]);

  // ── Professor view ────────────────────────────────────────────────────────
  if (isProfessor) {
    return (
      <div className="space-y-8 pb-12">
        {showRequestWizard && <MaterialRequestWizard onClose={() => setShowRequestWizard(false)} onDone={refetch} />}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-neutral-900 text-white p-8 rounded-3xl shadow-xl overflow-hidden relative">
          <div className="absolute -right-20 -top-20 opacity-10 blur-3xl pointer-events-none"><Package size={250} /></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-black tracking-tight">Catálogo do Almoxarifado</h1>
            <p className="text-neutral-400 mt-2 font-medium max-w-md leading-relaxed">Consulte a disponibilidade de componentes e solicite materiais complementares para suas aulas práticas.</p>
          </div>
          <button onClick={() => setShowRequestWizard(true)}
            className="relative z-10 bg-white text-neutral-900 px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-100 transition-all active:scale-95 shadow-md">
            <Package size={18} /> Iniciar Solicitação
          </button>
        </header>

        <div className="flex flex-col xl:flex-row gap-4 items-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input type="text" placeholder="Buscar material no catálogo..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all placeholder:text-neutral-400" />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
            <div className="w-full sm:w-auto">
              <CustomDropdown 
                value={category} 
                options={[{ value: "all", label: "Todas as Categorias" }, ...Object.entries(ItemCategory).map(([k, v]) => ({ value: v, label: CATEGORY_LABELS[v] ?? v }))]} 
                onChange={setCategory} 
                icon={Filter} 
              />
            </div>
            <div className="flex items-center bg-neutral-100 p-1.5 rounded-xl shrink-0 self-start">
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-700"}`} title="Modo Lista"><List size={18} /></button>
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-700"}`} title="Modo Grid"><LayoutGrid size={18} /></button>
            </div>
          </div>
        </div>

        {loading && <LoadingSpinner label="Atualizando catálogo do almoxarifado..." />}
        {error && <ErrorMessage message={error} onRetry={refetch} />}
        
        {!loading && !error && (
          viewMode === "list" ? (
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Componente</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Descrição</th>
                    <th className="px-5 py-4 text-center text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Qtd. Almoxarifado</th>
                    <th className="px-5 py-4 text-right text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Opções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.map(item => (
                    <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-5 py-3 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                          {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-neutral-300 text-lg">{item.name.charAt(0)}</span>}
                        </div>
                        <div>
                          <p className="font-bold text-neutral-900 text-base">{item.name}</p>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">{CATEGORY_LABELS[item.category] ?? item.category}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-neutral-500 max-w-[250px] truncate" title={item.description}>{item.description || "—"}</td>
                      <td className="px-5 py-3 text-center whitespace-nowrap">
                        <span className="font-black text-lg text-neutral-900">{item.total_stock}</span>
                        <span className="text-xs font-bold text-neutral-400 ml-1.5">unidades</span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {onAdd && (
                          <button onClick={() => onAdd(item)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-all active:scale-95 shadow-sm">
                            <Plus size={14} /> Adicionar à Aula
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (<tr><td colSpan={4} className="py-16 text-center"><Package size={32} className="mx-auto text-neutral-200 mb-3" /><p className="text-neutral-500 font-bold">Componente não encontrado.</p></td></tr>)}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filtered.length === 0
                ? <div className="col-span-4 text-center py-16 bg-white border border-dashed border-neutral-200 rounded-3xl"><Package size={40} className="mx-auto text-neutral-200 mb-3" /><p className="text-neutral-500 font-bold">Nenhum componente encontrado.</p></div>
                : filtered.map(item => (
                  <motion.div key={item.id} whileHover={{ y: -4 }}
                    className="bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-lg overflow-hidden flex flex-col transition-shadow">
                    <div className="aspect-square bg-neutral-100 relative group">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
                        : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-neutral-200">{item.name.charAt(0)}</div>
                      }
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] font-black text-neutral-700 uppercase tracking-widest shadow-sm border border-black/5">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h4 className="font-bold text-lg text-neutral-900 mb-1 leading-tight">{item.name}</h4>
                      <p className="text-xs font-medium text-neutral-500 line-clamp-2 mb-4 leading-relaxed">{item.description}</p>
                      
                      <div className="mt-auto pt-4 border-t border-neutral-100 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Total no Acervo</p>
                          <p className="text-sm font-black text-neutral-900 mt-0.5">{item.total_stock} <span className="font-bold text-neutral-500 text-xs">unidades</span></p>
                        </div>
                        {onAdd && (
                          <button onClick={() => onAdd(item)} className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center hover:bg-neutral-800 transition-all active:scale-95 shadow-md shadow-neutral-900/20" title="Adicionar à Aula">
                            <Plus size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              }
            </div>
          )
        )}
      </div>
    );
  }

  // ── DTI / Admin view ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">
      {(showCreate || editingItem) && (
        <ItemModelFormModal item={editingItem ?? undefined} onClose={() => { setShowCreate(false); setEditingItem(null); }} onSaved={refetch} />
      )}
      {qrItem && <QRCodeModal item={qrItem} onClose={() => setQrItem(null)} />}
      {loanItem && <InstitutionLoanModal item={loanItem} onClose={() => setLoanItem(null)} onSaved={() => { refetch(); setStockKey(k => k + 1); setLoansKey(k => k + 1); }} />}
      {resolvingMaintenance && <ResolveMaintenanceModal item={resolvingMaintenance} onClose={() => setResolvingMaintenance(null)} onSaved={() => { setResolvingMaintenance(null); refetch(); setStockKey(k => k + 1); }} />}
      {showImport && <ImportInventoryModal onClose={() => setShowImport(false)} onImported={() => { refetch(); setStockKey(k => k + 1); }} />}
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 border border-neutral-200 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center shadow-inner shrink-0">
             <Package size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Gestão de Inventário</h1>
            <p className="text-xs font-medium text-neutral-500 mt-1 uppercase tracking-widest">Painel Logístico DTI</p>
          </div>
        </div>
        {dtiTab === "stock" && canManageItems && (
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="bg-white text-neutral-700 border border-neutral-200 px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-50 transition-all active:scale-95 shadow-sm">
              <FileSpreadsheet size={18} /> Importar Excel
            </button>
            <button onClick={() => setShowCreate(true)} className="bg-neutral-900 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-all active:scale-95 shadow-md shadow-neutral-900/20">
              <Plus size={18} /> Novo Item
            </button>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
      {([["stock", "Acervo Físico"], ["pending", "Aguardando Entrega"], ["loans", "Longos Prazos"], ["maintenance", "Fila de Manutenção"]] as const).map(([id, label]) => (          
          <button key={id} onClick={() => setDtiTab(id)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border whitespace-nowrap active:scale-[0.98] ${
              dtiTab === id ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:text-neutral-800"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {dtiTab === "stock" && (
          <StockTab
            key={stockKey}
            search={search} setSearch={setSearch}
            category={category} setCategory={setCategory}
            onEdit={setEditingItem} onQr={setQrItem} onLoan={setLoanItem}
            canManageItems={canManageItems}
          />
        )}
        {dtiTab === "pending" && <PendingRequestsTab />}
        {dtiTab === "loans" && <LoansTab key={loansKey} />}
        {dtiTab === "maintenance" && <MaintenanceStockTab onResolve={setResolvingMaintenance} canManageItems={canManageItems} />}
      </div>
    </div>
  );
}