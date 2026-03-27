import apiClient from './client';
import type { QuarantineData, AuditLogEntry, BackupEntry } from '../types';

export const adminApi = {
  // Quarentena
  getQuarantine: () =>
    apiClient.get<QuarantineData>('/api/v1/admin/quarantine').then(r => r.data),
  restoreRecord: (table: string, id: number) =>
    apiClient.post(`/api/v1/admin/restore/${table}/${id}`).then(r => r.data),
  destroyRecord: (table: string, id: number) =>
    apiClient.delete(`/api/v1/admin/destroy/${table}/${id}`).then(r => r.data),

  // Auditoria
  getAuditLogs: (limit = 100) =>
    apiClient.get<AuditLogEntry[]>(`/api/v1/admin/audit-logs?limit=${limit}`).then(r => r.data),
  revertEdit: (auditId: number) =>
    apiClient.post(`/api/v1/admin/revert-edit/${auditId}`).then(r => r.data),

  // Backups
  createBackup: () =>
    apiClient.post('/api/v1/admin/backup').then(r => r.data),
  listBackups: () =>
    apiClient.get<BackupEntry[]>('/api/v1/admin/backups').then(r => r.data),
  downloadBackupUrl: (id: number) => `/api/v1/admin/backups/${id}/download`,

  // Reset semestral
  semesterReset: (password: string) =>
    apiClient.post('/api/v1/admin/semester-reset', { password }).then(r => r.data),
};
