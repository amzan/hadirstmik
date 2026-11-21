import { Router } from 'express';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { asyncRoute, requireValue, text, token } from './security.mjs';
import { rows, transaction, audit } from './database.mjs';
import { listEntity } from './domain.mjs';
import { prepareImport, databaseImportReport, applyImport } from './importer.mjs';
import { bulkPlan, applyBulk } from './bulk.mjs';
import { legacyExcludes } from './legacy-excludes.mjs';

export function snapshotCipher(secret) {
  const key = createHash('sha256').update(`snapshots:${secret}`).digest();
  return {
    encrypt(data) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); const bytes = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]); return [iv, cipher.getAuthTag(), bytes].map(b => b.toString('base64')).join('.'); },
    decrypt(value) { const [iv, tag, bytes] = value.split('.').map(v => Buffer.from(v, 'base64')); const cipher = createDecipheriv('aes-256-gcm', key, iv); cipher.setAuthTag(tag); return JSON.parse(Buffer.concat([cipher.update(bytes), cipher.final()]).toString('utf8')); },
  };
}
export async function backupData(db, user) {
  const names = { users: 'users', students: 'students', rombels: 'rombels', courses: 'courses', schedules: 'schedules', sessions: 'attendance-sessions', records: 'attendance-records', leaveRequests: 'leave-requests' }, data = {};
  for (const [key, name] of Object.entries(names)) {
    data[key] = [];
    for (let page = 1; ; page++) { const next = await listEntity(db, user, name, page, 100, true); data[key].push(...next.data); if (data[key].length >= next.meta.total) break; }
  }
  for (const [key, name] of [['sessions', 'attendance-sessions'], ['records', 'attendance-records']]) {
    for (let page = 1; ; page++) { const next = await listEntity(db, user, name, page, 100, true, true); data[key].push(...next.data); if (page * 100 >= next.meta.total) break; }
  }
  for (const leave of data.leaveRequests) if (leave.proofId) {
    const [proof] = await rows(db, 'SELECT mime_type,content FROM leave_proofs WHERE id=?', [leave.proofId]);
    if (proof) leave.proofDocumentUrl = `data:${proof.mime_type};base64,${proof.content.toString('base64')}`;
    delete leave.proofId;
  }
  return data;
}
export function administration(pool, auth, secret) {
  const router = Router(), cipher = snapshotCipher(secret);
  router.use(auth.required, auth.role('admin'));
  router.use((req,_res,next) => { requireValue(!req.user.demoScope, 'DEMO_OPERATION_UNSUPPORTED', 403); next(); });
  router.use(asyncRoute(async (req, _res, next) => {
    const [session] = await rows(pool, 'SELECT login_at FROM device_sessions WHERE id=?', [req.authSessionId]);
    if (req.method === 'GET' && req.path === '/snapshots') return next();
    requireValue(session && Date.now() - new Date(session.login_at).getTime() < 15 * 60000, 'RECENT_LOGIN_REQUIRED', 403); next();
  }));
  router.use('/legacy-excludes',legacyExcludes(pool,cipher));
  router.post('/imports/preview', asyncRoute(async (req, res) => res.json({ data: await databaseImportReport(pool,prepareImport(req.body.backup)) })));
  router.post('/bulk/preview', asyncRoute(async (req,res) => {
    const {entries,...report}=await bulkPlan(pool,req.body.data); res.json({data:report});
  }));
  router.post('/bulk/apply', asyncRoute(async (req,res) => {
    const result=await transaction(pool,async db=>{
      const plan=await bulkPlan(db,req.body.data);
      requireValue(plan.valid && plan.sourceHash===req.body.sourceHash,'PREVIEW_CHANGED',409);
      const id=token(),payload=await backupData(db,req.user);
      await rows(db,'INSERT INTO private_snapshots (id,name,note,payload,created_by) VALUES (?,?,?,?,?)',[id,'Sebelum impor Excel','Cadangan otomatis sebelum pembaruan massal',cipher.encrypt(payload),req.user.id]);
      const counts=await applyBulk(db,req.user,plan);
      await audit(db,req.user.id,'BULK_APPLIED','snapshot',id);return {counts,snapshotId:id};
    });res.json({data:result});
  }));
  router.post('/imports/apply', asyncRoute(async (req, res) => {
    const preview = prepareImport(req.body.backup); requireValue(preview.sourceHash === req.body.sourceHash, 'PREVIEW_CHANGED', 409);
    res.json({ data: await applyImport(pool, preview, { actorId: req.user.id }) });
  }));
  router.get('/backups/latest', asyncRoute(async (_req, res) => {
    const [snapshot] = await rows(pool, 'SELECT payload FROM private_snapshots ORDER BY created_at DESC,id DESC LIMIT 1'); requireValue(snapshot, 'NO_SNAPSHOT', 404); res.json({ data: cipher.decrypt(snapshot.payload) });
  }));
  router.get('/backups/export', asyncRoute(async (req, res) => res.json({ data: await transaction(pool, db => backupData(db, req.user)) })));
  router.get('/snapshots', asyncRoute(async (_req, res) => {
    const snapshots = await rows(pool, 'SELECT id,name,note,created_at,payload FROM private_snapshots ORDER BY created_at DESC LIMIT 100'); res.json({ data: snapshots.map(s => { const data=cipher.decrypt(s.payload); return { id: s.id, name: s.name, note: s.note, timestamp: s.created_at, summary: Object.fromEntries(Object.entries(data).map(([k,v])=>[`total${k[0].toUpperCase()}${k.slice(1)}`,v.length])) }; }) });
  }));
  router.post('/snapshots', asyncRoute(async (req, res) => {
    const data = await transaction(pool, async db => {
      const payload = await backupData(db, req.user), id = token(), name = text(req.body.name, 200), note = text(req.body.note, 10000, true);
      await rows(db, 'INSERT INTO private_snapshots (id,name,note,payload,created_by) VALUES (?,?,?,?,?)', [id, name, note, cipher.encrypt(payload), req.user.id]);
      await audit(db, req.user.id, 'SNAPSHOT_CREATED', 'snapshot', id); return { id, name, note, timestamp: new Date().toISOString(), summary: Object.fromEntries(Object.entries(payload).map(([k, v]) => [`total${k[0].toUpperCase()}${k.slice(1)}`, v.length])) };
    }); res.status(201).json({ data });
  }));
  router.get('/snapshots/:id', asyncRoute(async (req, res) => {
    const [snapshot] = await rows(pool, 'SELECT payload FROM private_snapshots WHERE id=?', [req.params.id]); requireValue(snapshot, 'NOT_FOUND', 404); res.json({ data: { data: cipher.decrypt(snapshot.payload) } });
  }));
  router.delete('/snapshots/:id', asyncRoute(async (req, res) => {
    await transaction(pool, async db => { await rows(db, 'DELETE FROM private_snapshots WHERE id=?', [req.params.id]); await audit(db, req.user.id, 'SNAPSHOT_DELETED', 'snapshot', req.params.id); }); res.json({ data: { success: true } });
  }));
  router.get('/audit-logs', asyncRoute(async (req, res) => { const page = Math.max(1, Math.min(1000000, Number(req.query.page) || 1)); res.json({ data: await rows(pool, 'SELECT id,actor_user_id,historical_actor_id,action,entity_type,entity_id,created_at FROM audit_logs ORDER BY id DESC LIMIT 100 OFFSET ?', [String((page - 1) * 100)]) }); }));
  return router;
}
