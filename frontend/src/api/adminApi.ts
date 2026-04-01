import { api } from './client';
import type { QuarantineData, AuditLogEntry, BackupEntry } from '../types';

export const adminApi = {
  // Quarentena
  getQuarantine: () =>
    api.get<QuarantineData>('/api/v1/admin/quarantine'),
  restoreRecord: (table: string, id: number) =>
    api.post<unknown>(`/api/v1/admin/restore/${table}/${id}`, {}),
  destroyRecord: (table: string, id: number) =>
    api.delete<unknown>(`/api/v1/admin/destroy/${table}/${id}`),

  // Auditoria
  getAuditLogs: (limit = 100) =>
    api.get<AuditLogEntry[]>(`/api/v1/admin/audit-logs?limit=${limit}`),
  revertEdit: (auditId: number) =>
    api.post<unknown>(`/api/v1/admin/revert-edit/${auditId}`, {}),

  // Backups
  createBackup: () =>
    api.post<BackupEntry>('/api/v1/admin/backup', {}),
  listBackups: () =>
    api.get<BackupEntry[]>('/api/v1/admin/backups'),
  downloadBackupUrl: (id: number) => `/api/v1/admin/backups/${id}/download`,

  // Reset semestral
  semesterReset: (password: string) =>
    api.post<unknown>('/api/v1/admin/semester-reset', { password }),
};
