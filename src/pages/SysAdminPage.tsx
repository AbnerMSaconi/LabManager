import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, XCircle, FileText, RotateCw, AlertTriangle, Download, HardDrive } from 'lucide-react';
import { useToast } from '../components/ui';
import { adminApi } from '../api/adminApi';
import type { QuarantineData, AuditLogEntry, BackupEntry } from '../types';

type Tab = 'lixeira' | 'auditoria' | 'semestre';

const TABLE_LABELS: Record<string, string> = {
  users: 'Usuários',
  laboratories: 'Laboratórios',
  softwares: 'Softwares',
  item_models: 'Itens de Estoque',
};

function hoursUntilDestruction(deletedAt: string): string {
  const deleted = new Date(deletedAt);
  const destruction = new Date(deleted.getTime() + 3 * 24 * 60 * 60 * 1000);
  const diff = destruction.getTime() - Date.now();
  if (diff <= 0) return 'Iminente';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return `${hours}h`;
}

export default function SysAdminPage() {
  const [tab, setTab] = useState<Tab>('lixeira');
  const [quarantine, setQuarantine] = useState<QuarantineData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    if (tab === 'lixeira') loadQuarantine();
    if (tab === 'auditoria') loadAuditLogs();
    if (tab === 'semestre') loadBackups();
  }, [tab]);

  async function loadQuarantine() {
    setLoading(true);
    try {
      setQuarantine(await adminApi.getQuarantine());
    } catch {
      showToast('Erro ao carregar lixeira.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLogs() {
    setLoading(true);
    try {
      setAuditLogs(await adminApi.getAuditLogs());
    } catch {
      showToast('Erro ao carregar logs de auditoria.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadBackups() {
    setLoading(true);
    try {
      setBackups(await adminApi.listBackups());
    } catch {
      showToast('Erro ao carregar backups.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(table: string, id: number) {
    try {
      await adminApi.restoreRecord(table, id);
      showToast('Registro restaurado com sucesso!', 'success');
      loadQuarantine();
    } catch {
      showToast('Erro ao restaurar registro.', 'error');
    }
  }

  async function handleDestroy(table: string, id: number) {
    if (!confirm('Tem certeza? Esta ação é irreversível.')) return;
    try {
      await adminApi.destroyRecord(table, id);
      showToast('Registro destruído permanentemente.', 'success');
      loadQuarantine();
    } catch {
      showToast('Erro ao destruir registro.', 'error');
    }
  }

  async function handleRevertEdit(auditId: number) {
    if (!confirm('Desfazer esta alteração restaurará os valores anteriores. Confirmar?')) return;
    try {
      await adminApi.revertEdit(auditId);
      showToast('Alteração desfeita com sucesso!', 'success');
      loadAuditLogs();
    } catch {
      showToast('Erro ao desfazer alteração.', 'error');
    }
  }

  async function handleCreateBackup() {
    setLoading(true);
    try {
      const result = await adminApi.createBackup();
      showToast(`Backup gerado: ${result.filename}`, 'success');
      loadBackups();
    } catch {
      showToast('Erro ao gerar backup.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSemesterReset() {
    if (!resetPassword) {
      showToast('Digite sua senha para confirmar.', 'error');
      return;
    }
    setLoading(true);
    try {
      await adminApi.semesterReset(resetPassword);
      showToast('Reset semestral executado com sucesso!', 'success');
      setConfirmingReset(false);
      setResetPassword('');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erro no reset semestral.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'lixeira', label: 'Lixeira', icon: <Trash2 size={16} /> },
    { key: 'auditoria', label: 'Auditoria de Edições', icon: <FileText size={16} /> },
    { key: 'semestre', label: 'Virada de Semestre', icon: <RotateCw size={16} /> },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ToastContainer />
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ucdb-blue)' }}>
          Governança do Sistema
        </h1>
        <p className="text-gray-500 text-sm mt-1">Painel exclusivo do Super Administrador</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-[var(--ucdb-blue)] text-[var(--ucdb-blue)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Aba 1: Lixeira */}
      {tab === 'lixeira' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Registros excluídos são destruídos permanentemente após 3 dias.
          </p>
          {loading ? (
            <p className="text-gray-400">Carregando...</p>
          ) : quarantine ? (
            Object.entries(quarantine).map(([tableName, records]) => (
              records.length > 0 && (
                <div key={tableName} className="mb-6">
                  <h3 className="font-semibold text-gray-700 mb-2">{TABLE_LABELS[tableName] ?? tableName}</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">ID</th>
                          <th className="px-4 py-2 text-left">Nome</th>
                          <th className="px-4 py-2 text-left">Excluído em</th>
                          <th className="px-4 py-2 text-left">Destruição em</th>
                          <th className="px-4 py-2 text-left">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map(r => (
                          <tr key={r.id} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-gray-500">{r.id}</td>
                            <td className="px-4 py-2 font-medium">{r.name}</td>
                            <td className="px-4 py-2 text-gray-500">
                              {new Date(r.deleted_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-red-500 font-semibold">
                                {hoursUntilDestruction(r.deleted_at)}
                              </span>
                            </td>
                            <td className="px-4 py-2 flex gap-2">
                              <button
                                onClick={() => handleRestore(tableName, r.id)}
                                className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-green-100 text-green-700 hover:bg-green-200"
                              >
                                <RotateCcw size={12} /> Restaurar
                              </button>
                              <button
                                onClick={() => handleDestroy(tableName, r.id)}
                                className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-red-100 text-red-700 hover:bg-red-200"
                              >
                                <XCircle size={12} /> Destruir Agora
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ))
          ) : (
            <p className="text-gray-400">Nenhum item na lixeira.</p>
          )}
        </div>
      )}

      {/* Aba 2: Auditoria */}
      {tab === 'auditoria' && (
        <div>
          {loading ? (
            <p className="text-gray-400">Carregando...</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Quando</th>
                    <th className="px-4 py-2 text-left">Quem</th>
                    <th className="px-4 py-2 text-left">O quê</th>
                    <th className="px-4 py-2 text-left">Como era antes</th>
                    <th className="px-4 py-2 text-left">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-2">{log.author_name ?? `#${log.user_id}`}</td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{TABLE_LABELS[log.table_name] ?? log.table_name}</span>
                        <span className="text-gray-400 ml-1">#{log.record_id}</span>
                      </td>
                      <td className="px-4 py-2 max-w-xs">
                        <pre className="text-xs bg-gray-50 rounded p-1 overflow-auto max-h-20">
                          {log.old_data ? JSON.stringify(log.old_data, null, 2) : '—'}
                        </pre>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleRevertEdit(log.id)}
                          className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        >
                          <RotateCcw size={12} /> Desfazer
                        </button>
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        Nenhuma edição registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Aba 3: Virada de Semestre */}
      {tab === 'semestre' && (
        <div>
          {/* Botão de Reset */}
          <div className="mb-8 p-6 border-2 border-red-200 rounded-xl bg-red-50">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={24} />
              <div>
                <h3 className="font-bold text-red-700 text-lg">Reset Semestral</h3>
                <p className="text-red-600 text-sm mt-1">
                  Esta operação apagará permanentemente todas as reservas, tickets resolvidos e empréstimos devolvidos.
                  Um backup será criado automaticamente antes. <strong>Esta ação não pode ser desfeita.</strong>
                </p>
              </div>
            </div>

            {!confirmingReset ? (
              <button
                onClick={() => setConfirmingReset(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
              >
                Iniciar Reset Semestral
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="password"
                  placeholder="Digite sua senha para confirmar"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  className="border border-red-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <button
                  onClick={handleSemesterReset}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Confirmar Reset'}
                </button>
                <button
                  onClick={() => { setConfirmingReset(false); setResetPassword(''); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Backups */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <HardDrive size={16} /> Backups do Sistema
              </h3>
              <button
                onClick={handleCreateBackup}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                style={{ borderColor: 'var(--ucdb-blue)' }}
              >
                <HardDrive size={14} /> Gerar Backup Agora
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Arquivo</th>
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Tamanho</th>
                    <th className="px-4 py-2 text-left">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map(b => (
                    <tr key={b.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-mono text-xs">{b.filename}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {new Date(b.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {b.size_mb != null ? `${b.size_mb} MB` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <a
                          href={adminApi.downloadBackupUrl(b.id)}
                          download={b.filename}
                          className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 w-fit"
                        >
                          <Download size={12} /> Download
                        </a>
                      </td>
                    </tr>
                  ))}
                  {backups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        Nenhum backup registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
