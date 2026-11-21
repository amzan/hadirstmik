import { createHash } from 'node:crypto';
import { canonical } from './importer.mjs';
import { entities, input, createEntity, updateEntity } from './domain.mjs';
import { rows } from './database.mjs';
import { requireValue } from './security.mjs';

const names = ['users', 'courses', 'students', 'schedules'];
export async function bulkPlan(db, incoming) {
  requireValue(incoming && typeof incoming === 'object' && !Array.isArray(incoming));
  requireValue(Object.keys(incoming).every(k => names.includes(k)), 'BULK_ENTITY_INVALID');
  const entries = [], counts = {}, issues = [];
  for (const entity of names) {
    const items = incoming[entity] || []; requireValue(Array.isArray(items) && items.length <= 2000);
    counts[entity] = { added: 0, updated: 0, total: items.length };
    const seen = new Set();
    for (const [index, body] of items.entries()) {
      try {
        input(entity, body);
        const key = entities[entity].key;
        let found;
        if (entity === 'users') [found] = await rows(db, 'SELECT id,version FROM users WHERE username=?', [body.username]);
        else if (entity === 'courses') [found] = await rows(db, 'SELECT id,version FROM courses WHERE code=?', [body.code]);
        else if (entity === 'students') [found] = await rows(db, 'SELECT nim,version FROM students WHERE nim=?', [body.nim]);
        else {
          [found] = await rows(db, 'SELECT id,version FROM schedules WHERE id=?', [body.id || '']);
          if (!found) {
            const matches = await rows(db, 'SELECT id,version FROM schedules WHERE course_code=? AND day=? AND start_time=? AND rombel=?', [body.courseCode, body.day, body.startTime, body.rombel]);
            requireValue(matches.length <= 1, 'AMBIGUOUS_SCHEDULE'); [found] = matches;
          }
        }
        const id = found?.[key] || body[key];
        requireValue(id && !seen.has(id), 'DUPLICATE_ID'); seen.add(id);
        if (found) requireValue(body.version === found.version, 'VERSION_CONFLICT', 409);
        entries.push({ entity, id, body: { ...body, [key]: id }, existing: Boolean(found) });
        counts[entity][found ? 'updated' : 'added']++;
      } catch (error) { issues.push({ entity, index, code: error.code || 'FIELD_INVALID' }); }
    }
  }
  requireValue(entries.length + issues.length > 0, 'BULK_EMPTY');
  return { entries, counts, issues, valid: !issues.length, sourceHash: createHash('sha256').update(canonical(entries)).digest('hex') };
}
export async function applyBulk(db, user, plan) {
  requireValue(plan.valid, 'BULK_CONFLICTS', 409);
  for (const entry of plan.entries) {
    if (entry.existing) await updateEntity(db, user, entry.entity, entry.id, entry.body);
    else await createEntity(db, user, entry.entity, entry.body);
  }
  return plan.counts;
}
