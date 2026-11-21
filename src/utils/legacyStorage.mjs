// Legacy data remains available for an explicit export; startup never migrates or writes it.
export function readLegacy(storage, key) {
  try { const value = storage.getItem(key); return value == null ? null : JSON.parse(value); }
  catch { return null; }
}
export function inspectLegacy(storage) {
  const keys = ['stmik_users_v1','stmik_students_v1','stmik_courses_v1','stmik_schedules_v1','stmik_rombels_v1','stmik_sessions_v1','stmik_records_v1','stmik_leave_v1','stmik_db_snapshots_v1'];
  return keys.map(key => { const value = readLegacy(storage, key); return { key, count: Array.isArray(value) ? value.length : null, present: storage.getItem(key) !== null }; });
}
