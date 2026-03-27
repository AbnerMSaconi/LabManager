import React, { useState } from "react";
import { Plus, Pencil, UserX, UserCheck, ShieldCheck, Eye } from "lucide-react";
import { UserRole } from "../types";
import { UserFull, CreateUserPayload, UpdateUserPayload, usersApi } from "../api/usersApi";
import { useAuth } from "../hooks/useAuth";
import { useFetch } from "../hooks/useFetch";
import { useToast, LoadingSpinner, ErrorMessage } from "../components/ui";
import { ApiError } from "../api/client";

// Permissões: PROGEX e DTI_TECNICO gerenciam; DTI_ESTAGIARIO só visualiza
const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PROFESSOR]:      "Professor",
  [UserRole.DTI_ESTAGIARIO]: "DTI Estagiário",
  [UserRole.DTI_TECNICO]:    "DTI Técnico",
  [UserRole.PROGEX]:         "Progex (Admin)",
  [UserRole.ADMINISTRADOR]:  "Administrador",
  [UserRole.SUPER_ADMIN]:    "Super Administrador",
};

const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.PROFESSOR]:      "bg-blue-50 text-blue-700",
  [UserRole.DTI_ESTAGIARIO]: "bg-amber-50 text-amber-700",
  [UserRole.DTI_TECNICO]:    "bg-purple-50 text-purple-700",
  [UserRole.PROGEX]:         "bg-emerald-50 text-emerald-700",
  [UserRole.ADMINISTRADOR]:  "bg-red-50 text-red-700",
  [UserRole.SUPER_ADMIN]:    "bg-gray-900 text-white",
};

// Legenda de permissões por papel
const PERMISSIONS: Record<UserRole, { can: string[]; cannot: string[] }> = {
  [UserRole.PROFESSOR]: {
    can: ["Criar reservas", "Ver suas próprias reservas", "Consultar laboratórios", "Ver catálogo do almoxarifado"],
    cannot: ["Aprovar/rejeitar reservas", "Gerenciar usuários", "Fazer checkout de materiais", "Abrir chamados de manutenção"],
  },
  [UserRole.DTI_ESTAGIARIO]: {
    can: ["Ver reservas pendentes", "Ver agenda do dia", "Visualizar usuários", "Abrir chamados de manutenção"],
    cannot: ["Aprovar/rejeitar reservas", "Criar ou editar usuários", "Resolver chamados"],
  },
  [UserRole.DTI_TECNICO]: {
    can: ["Aprovar e rejeitar reservas", "Fazer checkout e checkin", "Criar e editar usuários", "Abrir e resolver chamados"],
    cannot: ["Desativar usuários (somente Progex)"],
  },
  [UserRole.PROGEX]: {
    can: ["Acesso total ao sistema", "Criar e desativar usuários", "Gerenciar laboratórios", "Solicitar reservas semestrais"],
    cannot: [],
  },
  [UserRole.ADMINISTRADOR]: {
    can: ["Acesso total ao sistema", "Criar e desativar usuários", "Gerenciar laboratórios", "Todas as operações"],
    cannot: [],
  },
  [UserRole.SUPER_ADMIN]: {
    can: ["Acesso irrestrito ao sistema", "Painel de governança", "Reset semestral", "Auditoria e backups"],
    cannot: [],
  },
};

interface UserFormProps {
  initial?: UserFull;
  onSave: (p: CreateUserPayload | UpdateUserPayload) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  currentUser?: { role: UserRole } | null;
}

function UserForm({ initial, onSave, onCancel, isEdit, currentUser }: UserFormProps) {
  const [form, setForm] = useState({
    registration_number: initial?.registration_number ?? "",
    full_name: initial?.full_name ?? "",
    role: initial?.role ?? UserRole.PROFESSOR,
    password: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        full_name: form.full_name,
        role: form.role,
      };
      if (!isEdit) {
        payload.registration_number = form.registration_number;
        payload.password = form.password;
      } else if (form.password) {
        payload.password = form.password;
      }
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Registro (RA/RF)</label>
          <input required value={form.registration_number} onChange={e => set("registration_number", e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
            placeholder="Ex: RA2024001 ou RF001" />
        </div>
      )}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Nome completo</label>
        <input required value={form.full_name} onChange={e => set("full_name", e.target.value)}
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-neutral-900 outline-none text-sm" />
      </div>
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Papel / Permissões</label>
        <select value={form.role} onChange={e => set("role", e.target.value)}
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-neutral-900 outline-none text-sm">
          {Object.values(UserRole).filter(r => r !== UserRole.SUPER_ADMIN).map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
          {currentUser?.role === UserRole.SUPER_ADMIN && (
            <option value={UserRole.SUPER_ADMIN}>Super Administrador</option>
          )}
        </select>
        {/* Legenda de permissões dinâmica */}
        <div className="mt-2 p-3 bg-neutral-50 rounded-xl text-xs space-y-1">
          <p className="font-bold text-neutral-600 mb-1">Permissões deste papel:</p>
          {PERMISSIONS[form.role as UserRole]?.can.map(p => (
            <p key={p} className="text-emerald-700">✓ {p}</p>
          ))}
          {PERMISSIONS[form.role as UserRole]?.cannot.map(p => (
            <p key={p} className="text-red-400">✗ {p}</p>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
          {isEdit ? "Nova senha (deixe em branco para não alterar)" : "Senha"}
        </label>
        <input type="password" value={form.password} onChange={e => set("password", e.target.value)}
          required={!isEdit} minLength={6}
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
          placeholder={isEdit ? "••••••  (opcional)" : "Mínimo 6 caracteres"} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-neutral-900 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-40">
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar usuário"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2.5 border border-neutral-200 rounded-xl font-bold text-sm hover:bg-neutral-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const { data, loading, error, refetch } = useFetch(usersApi.list);
  const { showToast, ToastComponent } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<UserFull | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);

  const canManage = me?.role === UserRole.PROGEX || me?.role === UserRole.DTI_TECNICO || me?.role === UserRole.ADMINISTRADOR || me?.role === UserRole.SUPER_ADMIN;
  const canDeactivate = me?.role === UserRole.PROGEX || me?.role === UserRole.SUPER_ADMIN;

  const handleCreate = async (payload: any) => {
    try {
      await usersApi.create(payload);
      showToast("Usuário criado com sucesso.", "success");
      setShowForm(false);
      refetch();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao criar.", "error"); }
  };

  const handleUpdate = async (payload: any) => {
    if (!editTarget) return;
    try {
      await usersApi.update(editTarget.id, payload);
      showToast("Usuário atualizado.", "success");
      setEditTarget(null);
      refetch();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro ao atualizar.", "error"); }
  };

  const handleToggleActive = async (u: UserFull) => {
    try {
      await usersApi.update(u.id, { is_active: !u.is_active });
      showToast(`Usuário ${u.is_active ? "desativado" : "reativado"}.`, u.is_active ? "warning" : "success");
      refetch();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };

  return (
    <div className="space-y-6">
      {ToastComponent}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Usuários</h2>
          <p className="text-neutral-500 text-sm">
            {canManage ? "Crie, edite e gerencie permissões." : "Visualização somente leitura."}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPermissions(v => !v)}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-xl text-sm font-bold hover:bg-neutral-50">
            <ShieldCheck size={16} /> Permissões
          </button>
          {canManage && (
            <button onClick={() => { setShowForm(true); setEditTarget(null); }}
              className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-neutral-800">
              <Plus size={16} /> Novo Usuário
            </button>
          )}
        </div>
      </div>

      {/* Painel de permissões */}
      {showPermissions && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(UserRole).map(role => (
            <div key={role} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${ROLE_COLORS[role]}`}>
                  {ROLE_LABELS[role]}
                </span>
              </div>
              <div className="space-y-1">
                {PERMISSIONS[role].can.map(p => <p key={p} className="text-xs text-emerald-700">✓ {p}</p>)}
                {PERMISSIONS[role].cannot.map(p => <p key={p} className="text-xs text-red-400">✗ {p}</p>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação/edição */}
      {(showForm || editTarget) && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{editTarget ? "Editar Usuário" : "Novo Usuário"}</h3>
            <UserForm
              initial={editTarget ?? undefined}
              isEdit={!!editTarget}
              onSave={editTarget ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditTarget(null); }}
              currentUser={me}
            />
          </div>
        </div>
      )}

      {loading && <LoadingSpinner label="Carregando usuários..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase">Usuário</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase">Registro</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase">Papel</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase">Acesso</th>
                {canManage && <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(data ?? []).map(u => (
                <tr key={u.id} className={`hover:bg-neutral-50 transition-colors ${!u.is_active ? "opacity-50" : ""}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-sm text-neutral-600">
                        {u.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{u.full_name}</p>
                        <p className="text-xs text-neutral-400 font-mono">{u.registration_number}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-neutral-600">{u.registration_number}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {u.is_active
                        ? <><div className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-xs text-emerald-700 font-medium">Ativo</span></>
                        : <><div className="w-2 h-2 rounded-full bg-neutral-300"/><span className="text-xs text-neutral-400 font-medium">Inativo</span></>
                      }
                    </div>
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditTarget(u)} title="Editar"
                          className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg transition-colors">
                          <Pencil size={15} />
                        </button>
                        {canDeactivate && u.id !== me?.id && (
                          <button onClick={() => handleToggleActive(u)}
                            title={u.is_active ? "Desativar" : "Reativar"}
                            className={`p-2 rounded-lg transition-colors ${u.is_active ? "text-red-400 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}`}>
                            {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                        )}
                        {!canDeactivate && (
                          <div title="Somente Progex pode desativar" className="p-2 text-neutral-200 cursor-not-allowed">
                            <UserX size={15} />
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  {!canManage && (
                    <td className="px-6 py-4 text-right">
                      <Eye size={15} className="text-neutral-300 inline" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
