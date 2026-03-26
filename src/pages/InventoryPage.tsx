import React, { useState, useMemo } from "react";
import {
  Search, Plus, QrCode, Edit2, Package, CheckCircle2,
  Calendar, Building2, AlertTriangle,
} from "lucide-react";
import { UserRole, ItemCategory, ItemModel, Reservation, InstitutionLoan, AvailableItemModel, StockItem } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { inventoryApi } from "../api/inventoryApi";
import { LoadingSpinner, ErrorMessage, useToast } from "../components/ui";
import { ApiError } from "../api/client";
import { motion } from "motion/react";

const CATEGORY_LABELS: Record<string, string> = {
  eletrica: "Elétrica", eletronica: "Eletrônica", fisica: "Física", componentes: "Componentes",
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
    image_url: item?.image_url ?? "",
    total_stock: item?.total_stock ?? 0,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {ToastComponent}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold mb-4">{item ? "Editar Item" : "Novo Item"}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Nome *</label>
            <input className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Categoria</label>
            <select className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Estoque Total</label>
            <input type="number" min={0} className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              value={form.total_stock} onChange={e => setForm(f => ({ ...f, total_stock: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Descrição</label>
            <textarea rows={2} className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">URL da Imagem</label>
            <input className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-neutral-200 rounded-xl py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-neutral-900 text-white rounded-xl py-2 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-colors">
            {saving ? "Salvando..." : "Salvar"}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
        <h2 className="text-xl font-bold mb-1">{item.name}</h2>
        <p className="text-xs text-neutral-400 mb-4">Escaneie para movimentar no almoxarifado</p>
        <img src={qrUrl} alt={`QR ${item.name}`} className="w-52 h-52 mx-auto mb-3 rounded-xl border border-neutral-100" />
        <p className="text-[11px] text-neutral-400 font-mono mb-4">{qrCode}</p>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex-1 border border-neutral-200 rounded-xl py-2 text-sm font-bold hover:bg-neutral-50 transition-colors">Imprimir</button>
          <button onClick={onClose} className="flex-1 bg-neutral-900 text-white rounded-xl py-2 text-sm font-bold hover:bg-neutral-800 transition-colors">Fechar</button>
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
        item_model_id: item.id,
        requester_name: form.requester_name,
        quantity_delivered: form.quantity_delivered,
        return_date: form.return_date || undefined,
        no_return_reason: !form.return_date ? form.no_return_reason : undefined,
      });
      showToast("Empréstimo registrado.", "success");
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao registrar.", "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {ToastComponent}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold mb-1">Empréstimo à Instituição</h2>
        <p className="text-sm text-neutral-500 mb-4">{item.name}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Nome do Solicitante *</label>
            <input className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              value={form.requester_name} onChange={e => setForm(f => ({ ...f, requester_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Quantidade Entregue</label>
            <input type="number" min={1} className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              value={form.quantity_delivered} onChange={e => setForm(f => ({ ...f, quantity_delivered: parseInt(e.target.value) || 1 }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Data de Devolução</label>
            <input type="date" className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              value={form.return_date} onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} />
          </div>
          {!form.return_date && (
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Motivo (sem data de devolução) *</label>
              <textarea rows={2} className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                value={form.no_return_reason} onChange={e => setForm(f => ({ ...f, no_return_reason: e.target.value }))} />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-neutral-200 rounded-xl py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-neutral-900 text-white rounded-xl py-2 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-colors">
            {saving ? "Salvando..." : "Registrar Saída"}
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

  const canSubmit = allReturned !== null && hasDamage !== null &&
    (!hasDamage || (isOperational !== null && observation.trim().length > 0));

  const handleReturn = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await inventoryApi.returnLoan(loan.id, {
        all_returned: allReturned!,
        quantity_returned: allReturned ? loan.quantity_delivered : qty,
        has_damage: hasDamage!,
        is_operational: hasDamage ? isOperational ?? undefined : undefined,
        damage_observation: hasDamage ? observation : undefined,
      });
      showToast("Devolução registrada com sucesso.", "success");
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Erro ao registrar.", "error");
    } finally { setSaving(false); }
  };

  const YesNoButtons = ({ value, onChange, labels }: {
    value: boolean | null; onChange: (v: boolean) => void; labels?: [string, string];
  }) => (
    <div className="flex gap-2 mt-1">
      {([true, false] as const).map((v, i) => (
        <button key={String(v)} onClick={() => onChange(v)}
          className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
            value === v ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
          }`}>
          {labels ? labels[i] : v ? "Sim" : "Não"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {ToastComponent}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold mb-1">Registrar Devolução</h2>
        <p className="text-sm text-neutral-500 mb-5">{loan.model?.name} · {loan.requester_name} · {loan.quantity_delivered} un.</p>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold">Todos os itens foram devolvidos?</p>
            <YesNoButtons value={allReturned} onChange={setAllReturned} labels={["Sim, todos", "Parcialmente"]} />
          </div>

          {allReturned === false && (
            <div>
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Quantidade devolvida</label>
              <input type="number" min={0} max={loan.quantity_delivered} className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                value={qty} onChange={e => setQty(parseInt(e.target.value) || 0)} />
            </div>
          )}

          {allReturned !== null && (
            <div>
              <p className="text-sm font-semibold">Algum item apresenta avaria?</p>
              <YesNoButtons value={hasDamage} onChange={setHasDamage} />
            </div>
          )}

          {hasDamage === true && (
            <>
              <div>
                <p className="text-sm font-semibold">O material ainda está operante?</p>
                <YesNoButtons value={isOperational} onChange={setIsOperational} labels={["Sim, operante", "Não operante"]} />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Descrição da avaria *</label>
                <textarea rows={3} className="w-full mt-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                  placeholder="Descreva em detalhes o que aconteceu..." value={observation} onChange={e => setObservation(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-neutral-200 rounded-xl py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">Cancelar</button>
          <button onClick={handleReturn} disabled={!canSubmit || saving}
            className="flex-1 bg-neutral-900 text-white rounded-xl py-2 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-colors">
            {saving ? "Salvando..." : "Confirmar Devolução"}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {ToastComponent}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Solicitar Materiais</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {step === 1 ? "Passo 1: Selecione a reserva" : `Passo 2: Materiais disponíveis · ${fmtDate(selected?.date ?? "")}`}
            </p>
          </div>
          {step === 2 && (
            <button onClick={() => setStep(1)} className="text-sm text-blue-600 hover:underline font-medium">← Voltar</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            loading ? <LoadingSpinner label="Carregando suas reservas..." /> :
            !reservations?.length ? (
              <div className="text-center py-16">
                <Building2 size={40} className="text-neutral-200 mx-auto mb-3" />
                <p className="text-neutral-400 font-medium">Nenhuma reserva ativa em laboratórios práticos do Bloco C.</p>
                <p className="text-xs text-neutral-400 mt-1">Faça uma reserva em um laboratório do Bloco C para solicitar materiais.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reservations.map(res => (
                  <button key={res.id} onClick={() => handleSelect(res)}
                    className="text-left border border-neutral-200 rounded-2xl p-4 hover:border-neutral-900 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-neutral-400" />
                        <span className="font-bold text-sm">{fmtDate(res.date)}</span>
                      </div>
                      {res.slots?.length > 0 && (
                        <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full uppercase">
                          {slotPeriod(res.slots)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-neutral-700">{res.laboratory?.name}</p>
                    <p className="text-xs text-neutral-400">{res.laboratory?.block}</p>
                    {res.slots?.length > 0 && (
                      <p className="text-xs font-mono text-neutral-500 mt-1">{slotRange(res.slots)}</p>
                    )}
                  </button>
                ))}
              </div>
            )
          )}

          {step === 2 && (
            loadingItems ? <LoadingSpinner label="Carregando materiais..." /> :
            !availableItems.length ? (
              <p className="text-center text-neutral-400 py-12">Nenhum material disponível para esta data.</p>
            ) : (
              <div className="space-y-2">
                {availableItems.map(item => (
                  <div key={item.id} className={`flex items-center border rounded-xl px-4 py-3 gap-4 ${item.available_qty === 0 ? "border-neutral-100 opacity-50" : "border-neutral-200"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{item.name}</p>
                      <p className="text-xs text-neutral-400">{CATEGORY_LABELS[item.category] ?? item.category} · {item.available_qty} disponível(is)</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button disabled={item.available_qty === 0}
                        onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] || 0) - 1) }))}
                        className="w-7 h-7 border border-neutral-200 rounded-lg flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 transition-colors">−</button>
                      <span className="w-8 text-center text-sm font-bold">{quantities[item.id] || 0}</span>
                      <button disabled={item.available_qty === 0 || (quantities[item.id] || 0) >= item.available_qty}
                        onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.min(item.available_qty, (q[item.id] || 0) + 1) }))}
                        className="w-7 h-7 border border-neutral-200 rounded-lg flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 transition-colors">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-100">
          <button onClick={onClose} className="flex-1 border border-neutral-200 rounded-xl py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">Cancelar</button>
          {step === 2 && (
            <button onClick={handleSubmit} disabled={saving || loadingItems}
              className="flex-1 bg-neutral-900 text-white rounded-xl py-2 text-sm font-bold disabled:opacity-50 hover:bg-neutral-800 transition-colors">
              {saving ? "Enviando..." : "Enviar Solicitação"}
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
    <div className="text-center py-16">
      <CheckCircle2 size={40} className="text-emerald-200 mx-auto mb-3" />
      <p className="text-neutral-400 font-medium">Nenhuma solicitação pendente de entrega.</p>
    </div>
  );

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="space-y-3">
      {pending.map(res => (
        <div key={res.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-bold text-neutral-900">{res.user?.full_name}</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {res.laboratory?.name} · {fmtDate(res.date)}
              </p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
              Aguardando entrega
            </span>
          </div>
          {res.items.length > 0 && (
            <div className="mt-3 space-y-1">
              {res.items.map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs text-neutral-600 bg-neutral-50 rounded-lg px-3 py-1.5">
                  <span>{item.model?.name ?? `Item #${item.item_model_id}`}</span>
                  <span className="font-bold">{item.quantity_requested} un.</span>
                </div>
              ))}
            </div>
          )}
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
    <div className="text-center py-16">
      <Package size={40} className="text-neutral-200 mx-auto mb-3" />
      <p className="text-neutral-400 font-medium">Nenhum empréstimo registrado.</p>
    </div>
  );

  return (
    <>
      {returning && (
        <LoanReturnModal loan={returning} onClose={() => setReturning(null)} onSaved={() => { setReturning(null); refetch(); }} />
      )}
      <div className="space-y-3">
        {loans.map(loan => (
          <div key={loan.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-neutral-900">{loan.model?.name}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{loan.requester_name} · {loan.quantity_delivered} un. entregues</p>
                {loan.return_date && (
                  <p className="text-xs text-neutral-400">Devolução prevista: {new Date(loan.return_date).toLocaleDateString("pt-BR")}</p>
                )}
                {loan.no_return_reason && (
                  <p className="text-xs text-amber-600 mt-0.5">Sem data: {loan.no_return_reason}</p>
                )}
                {loan.damage_observation && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{loan.damage_observation}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-xs border px-2 py-0.5 rounded-full font-bold ${STATUS_STYLES[loan.status] ?? ""}`}>
                  {STATUS_LABELS[loan.status] ?? loan.status}
                </span>
                {loan.status === "em_aberto" && (
                  <button onClick={() => setReturning(loan)}
                    className="text-xs bg-neutral-900 text-white px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors font-bold">
                    Registrar Devolução
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── StockTab ──────────────────────────────────────────────────────────────────

function StockTab({ search, setSearch, category, setCategory, onEdit, onQr, onLoan }: {
  search: string; setSearch: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  onEdit: (item: ItemModel) => void;
  onQr: (item: ItemModel) => void;
  onLoan: (item: ItemModel) => void;
}) {
  const { data, loading, error, refetch } = useFetch(inventoryApi.listStock, [], true);

  const filtered = useMemo(() => (data ?? []).filter((item: StockItem) =>
    item.name.toLowerCase().includes(search.toLowerCase()) && (category === "all" || item.category === category)
  ), [data, search, category]);

  return (
    <>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input type="text" placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm text-sm" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          {["all", ...Object.values(ItemCategory)].map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                category === cat ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 border border-neutral-200 hover:border-neutral-900"
              }`}>
              {cat === "all" ? "Todos" : (CATEGORY_LABELS[cat] ?? cat)}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingSpinner label="Carregando estoque..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.length === 0
            ? <p className="text-neutral-400 col-span-4 text-center py-12">Nenhum item encontrado.</p>
            : filtered.map((item: StockItem) => {
              const pct = item.total_stock > 0 ? (item.available_qty / item.total_stock) * 100 : 100;
              const barColor = pct > 50 ? "bg-emerald-400" : pct > 20 ? "bg-amber-400" : "bg-red-400";
              return (
                <motion.div key={item.id} whileHover={{ y: -3 }}
                  className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="aspect-square bg-neutral-100 relative">
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-neutral-300">{item.name.charAt(0)}</div>
                    }
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-neutral-600 shadow-sm">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h4 className="font-bold text-neutral-900 mb-1">{item.name}</h4>
                    <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{item.description}</p>
                    <div className="mt-auto space-y-2">
                      {/* Availability bar */}
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Disponível</span>
                          <span className="text-neutral-700">{item.available_qty} / {item.total_stock}</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {(item.in_use > 0 || item.in_loans > 0) && (
                        <div className="flex gap-1 flex-wrap">
                          {item.in_use > 0 && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold">
                              {item.in_use} em uso
                            </span>
                          )}
                          {item.in_loans > 0 && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md font-bold">
                              {item.in_loans} emprestado
                            </span>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-1 pt-1">
                        <button onClick={() => onEdit(item)}
                          className="flex items-center justify-center gap-1 p-2 rounded-lg border border-neutral-200 text-xs text-neutral-600 hover:bg-neutral-50 transition-colors">
                          <Edit2 size={12} /> Editar
                        </button>
                        <button onClick={() => onQr(item)}
                          className="flex items-center justify-center gap-1 p-2 rounded-lg border border-neutral-200 text-xs text-neutral-600 hover:bg-neutral-50 transition-colors">
                          <QrCode size={12} /> QR
                        </button>
                        <button onClick={() => onLoan(item)}
                          className="flex items-center justify-center gap-1 p-2 rounded-lg border border-blue-100 text-xs text-blue-600 hover:bg-blue-50 transition-colors">
                          <Package size={12} /> Emprestar
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          }
        </div>
      )}
    </>
  );
}

// ── Main InventoryPage ────────────────────────────────────────────────────────

export function InventoryPage({ onAdd }: { onAdd?: (item: ItemModel) => void }) {
  const { user } = useAuth();
  const isProfessor = user?.role === UserRole.PROFESSOR;

  const { data, loading, error, refetch } = useFetch(inventoryApi.listModels, [], true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [dtiTab, setDtiTab] = useState<"stock" | "pending" | "loans">("stock");
  const [editingItem, setEditingItem] = useState<ItemModel | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [qrItem, setQrItem] = useState<ItemModel | null>(null);
  const [loanItem, setLoanItem] = useState<ItemModel | null>(null);
  const [showRequestWizard, setShowRequestWizard] = useState(false);
  const [stockKey, setStockKey] = useState(0);
  const [loansKey, setLoansKey] = useState(0);

  const filtered = useMemo(() => (data ?? []).filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) && (category === "all" || item.category === category)
  ), [data, search, category]);

  const SearchBar = () => (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
        <input type="text" placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-neutral-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm text-sm" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
        {["all", ...Object.values(ItemCategory)].map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              category === cat ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 border border-neutral-200 hover:border-neutral-900"
            }`}>
            {cat === "all" ? "Todos" : (CATEGORY_LABELS[cat] ?? cat)}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Professor view ────────────────────────────────────────────────────────
  if (isProfessor) {
    return (
      <div className="space-y-8">
        {showRequestWizard && <MaterialRequestWizard onClose={() => setShowRequestWizard(false)} onDone={refetch} />}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Catálogo do Almoxarifado</h1>
            <p className="text-neutral-500">Consulte os materiais e solicite para suas aulas práticas.</p>
          </div>
          <button onClick={() => setShowRequestWizard(true)}
            className="bg-neutral-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-colors">
            <Package size={18} /> Solicitar Materiais
          </button>
        </header>
        <SearchBar />
        {loading && <LoadingSpinner label="Carregando inventário..." />}
        {error && <ErrorMessage message={error} onRetry={refetch} />}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.length === 0
              ? <p className="text-neutral-400 col-span-4 text-center py-12">Nenhum item encontrado.</p>
              : filtered.map(item => (
                <motion.div key={item.id} whileHover={{ y: -4 }}
                  className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="aspect-square bg-neutral-100">
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-neutral-300">{item.name.charAt(0)}</div>
                    }
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{CATEGORY_LABELS[item.category] ?? item.category}</span>
                    <h4 className="font-bold text-neutral-900 mt-0.5 mb-1">{item.name}</h4>
                    <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{item.description}</p>
                    <div className="mt-auto">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Disponível</p>
                      <p className="text-sm font-bold text-neutral-900">{item.total_stock} unidades</p>
                    </div>
                    {onAdd && (
                      <button onClick={() => onAdd(item)} className="mt-3 w-full bg-neutral-900 text-white py-2 rounded-lg text-xs font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5">
                        <Plus size={14} /> Adicionar
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            }
          </div>
        )}
      </div>
    );
  }

  // ── DTI / Admin view ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {(showCreate || editingItem) && (
        <ItemModelFormModal item={editingItem ?? undefined} onClose={() => { setShowCreate(false); setEditingItem(null); }} onSaved={refetch} />
      )}
      {qrItem && <QRCodeModal item={qrItem} onClose={() => setQrItem(null)} />}
      {loanItem && <InstitutionLoanModal item={loanItem} onClose={() => setLoanItem(null)} onSaved={() => { refetch(); setStockKey(k => k + 1); setLoansKey(k => k + 1); }} />}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Gestão de Inventário</h1>
          <p className="text-neutral-500">Controle de estoque, movimentações e empréstimos do almoxarifado.</p>
        </div>
        {dtiTab === "stock" && (
          <button onClick={() => setShowCreate(true)} className="bg-neutral-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 transition-colors">
            <Plus size={18} /> Novo Item
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
        {([["stock", "Estoque"], ["pending", "Solicitações Pendentes"], ["loans", "Empréstimos"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setDtiTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              dtiTab === id ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {dtiTab === "stock" && (
        <StockTab
          key={stockKey}
          search={search} setSearch={setSearch}
          category={category} setCategory={setCategory}
          onEdit={setEditingItem} onQr={setQrItem} onLoan={setLoanItem}
        />
      )}

      {dtiTab === "pending" && <PendingRequestsTab />}
      {dtiTab === "loans" && <LoansTab key={loansKey} />}
    </div>
  );
}
