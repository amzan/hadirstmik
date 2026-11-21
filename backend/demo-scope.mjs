import { rows } from './database.mjs';
import { requireValue } from './security.mjs';

export const demoScope = user => Number(Boolean(user.demoScope ?? user.isDemo));
export function assertDemoScope(row, user) {
  requireValue(row && Number(row.is_demo || 0) === demoScope(user), 'NOT_FOUND', 404);
  return row;
}
export async function scopedReference(db, table, key, id, scope) {
  requireValue(['users','students','rombels','courses','schedules','attendance_sessions'].includes(table));
  requireValue(['id','nim','code'].includes(key));
  const [row] = await rows(db, `SELECT * FROM ${table} WHERE ${key}=?`, [id]);
  requireValue(row, 'REFERENCE_INVALID', 409);
  requireValue(Number(row.is_demo||0)===Number(scope), 'DEMO_SCOPE_MISMATCH', 403);
  return row;
}
