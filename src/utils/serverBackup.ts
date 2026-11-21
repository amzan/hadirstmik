import { api } from './api';
import { downloadDatabaseBackupFile } from './databaseBackupService';
import type { DatabaseBackupData } from '../types/attendance';

export async function downloadServerBackup(snapshotId?: string) {
  const payload = snapshotId ? await api<{ data: DatabaseBackupData }>(`/admin/snapshots/${encodeURIComponent(snapshotId)}`) : { data: await api<DatabaseBackupData>('/admin/backups/export') };
  downloadDatabaseBackupFile(payload.data);
}
