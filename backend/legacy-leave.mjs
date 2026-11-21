import { createHash } from 'node:crypto';
export const LEGACY_ARCHIVE = 'LEGACY_ARCHIVED_NO_RECIPIENT';
export const LEGACY_LEAVE_POLICY = 'owner-legacy-no-recipient-v1';
const fields = ['id','studentNim','studentName','courseCode','courseName','rombel','date','status','type','reason','createdAt','reviewedBy','reviewedAt'];
export function legacyLeaveDigest(row) {
  return createHash('sha256').update(JSON.stringify(fields.map(key => [key, row[key] ?? null]))).digest('hex');
}
export function validLegacyArchive(row) {
  return row.archiveMarker === LEGACY_ARCHIVE && Array.isArray(row.recipientIds) && row.recipientIds.length === 0
    && !row.sessionId && !row.scheduleId && row.legacyArchivePolicy === LEGACY_LEAVE_POLICY
    && row.legacySourceHash === legacyLeaveDigest(row);
}
