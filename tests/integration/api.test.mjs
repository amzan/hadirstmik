import { issueAdminActivation,completeAdminActivation } from '../../backend/admin-activation.mjs';
import { historicalReviewFixture } from '../fixtures.mjs';
import { applyReviewTransfer, prepareReviewTransfer } from '../../backend/legacy-transfer.mjs';
import { archivedLeaveFixture } from '../fixtures.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { hashPassword, token } from '../../backend/security.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { fixture, legacyFixture, excludeReviewFixture } from '../fixtures.mjs';
import { reconcileLegacy } from '../../backend/reconciliation.mjs';

const enabled = process.env.HADIR_TEST_DB === '1';
const options = { skip: !enabled };
let pool, adminConnection, server, url, database, codes = [], session;
const origin = 'http://127.0.0.1';
const clients = {};
async function client(baseUrl=url) {
  let jar = new Map(), csrf = '';
  const request = async (path, method = 'GET', body, headers = {}) => {
    const response = await fetch(baseUrl + '/api/v1' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    for (const cookie of response.headers.getSetCookie()) { const [kv] = cookie.split(';'), i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer()), headers: response.headers };
  };
  const initial = await request('/auth/csrf'); csrf = initial.body.data.csrfToken;
  return { request, jar };
}
before(async () => {
  if (!enabled) return;
  const port = Number(process.env.HADIR_TEST_PORT || 33079);
  assert.equal(process.env.HADIR_TEST_HOST || '127.0.0.1', '127.0.0.1');
  assert(port >= 1024 && port <= 65535);
  database = `hadir_it_${randomBytes(5).toString('hex')}_test`;
  adminConnection = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
  await adminConnection.query(`CREATE DATABASE ${database}`);
  pool = mysql.createPool({ host: '127.0.0.1', port, user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, connectionLimit: 5, timezone: 'Z', dateStrings: ['DATE'] });
  await migrate(pool); await migrate(pool);
  const preview = prepareImport(fixture()); assert(preview.valid); await applyImport(pool, preview);
  await pool.execute('UPDATE users SET email_verified_at=UTC_TIMESTAMP()');
  const hash = await hashPassword('Synthetic-password-12345');
  for (const user of fixture().users) await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', [user.id, hash]);
  const app = createApp({ pool, origin, secret: 'synthetic-test-secret-32-characters-long', sendOtp: async (email, code) => { codes.push({ email, code }); } });
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); url = `http://127.0.0.1:${server.address().port}`;
  for (const [name, username, role] of [['admin','admin-test','admin'], ['dosen','lecturer-test','dosen'], ['other','other-lecturer','dosen'], ['student','0001','mahasiswa'], ['studentOther','0002','mahasiswa']]) {
    const c = await client(); const result = await c.request('/auth/login', 'POST', { identifier: username, password: 'Synthetic-password-12345', role }); assert.equal(result.status, 200); assert(!JSON.stringify(result.body).includes('password')); clients[name] = c;
  }
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await pool?.end();
  if (adminConnection && /^hadir_it_[a-f0-9]+_test$/.test(database)) { await adminConnection.query(`DROP DATABASE ${database}`); await adminConnection.end(); }
});
test('unauthenticated requests and forged role are rejected; CSRF enforced', options, async () => {
  const c = await client(); assert.equal((await c.request('/students')).status, 401);
  const first=(await c.request('/auth/csrf')).body.data.csrfToken;assert.equal((await c.request('/auth/csrf')).body.data.csrfToken,first);
  assert.equal((await c.request('/auth/login', 'POST', { identifier: '0001', password: 'Synthetic-password-12345', role: 'admin' })).status, 401);
  assert.equal((await clients.admin.request('/courses', 'POST', {}, { Origin: 'https://attacker.example.test' })).status, 403);
  assert.equal((await clients.admin.request('/courses', 'POST', {}, { 'X-CSRF-Token': 'forged' })).status, 403);
});
test('student and lecturer lists are scoped; student cannot mutate master', options, async () => {
  const own = await clients.student.request('/students'); assert.equal(own.status, 200); assert.deepEqual(own.body.data.map(s => s.nim), ['0001']);
  assert.equal((await clients.student.request('/courses', 'POST', fixture().courses[0])).status, 403);
  const rows = (await clients.other.request('/schedules')).body.data; assert.equal(rows.length, 0);
});
test('academic edits require current version and preserve rombel relation', options, async () => {
  const old = (await clients.admin.request('/courses')).body.data[0];
  assert.equal((await clients.admin.request('/courses/course-test', 'PATCH', { name: 'Updated Synthetic Course', version: old.version })).status, 200);
  assert.equal((await clients.admin.request('/courses/course-test', 'PATCH', { name: 'Stale Edit', version: old.version })).status, 409);
  assert.equal((await clients.admin.request('/rombels/rombel-test/schedules', 'PUT', { scheduleIds: ['schedule-test'] })).status, 200);
});
test('session creation is idempotent; other lecturers cannot close it', options, async () => {
  const body = { scheduleId: 'schedule-test', date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()), meetingNumber: 1, topic: 'Synthetic Topic', isDynamicQr: false };
  const created = await clients.dosen.request('/attendance-sessions', 'POST', body); assert.equal(created.status, 201); session = created.body.data;
  const same = await clients.dosen.request('/attendance-sessions', 'POST', body); assert.equal(same.body.data.id, session.id);
  assert.equal((await clients.other.request(`/attendance-sessions/${session.id}/close`, 'POST', {})).status, 403);
});
test('QR prefix and expired token fail; parallel scans yield one audited record', options, async () => {
  assert.equal((await clients.student.request('/attendance/scan', 'POST', { token: session.qrToken.slice(0, 15) })).status, 409);
  await pool.execute('UPDATE attendance_sessions SET qr_expires_at=? WHERE id=?', [new Date(0), session.id]);
  assert.equal((await clients.student.request('/attendance/scan', 'POST', { token: session.qrToken })).status, 409);
  await pool.execute('UPDATE attendance_sessions SET qr_expires_at=? WHERE id=?', [new Date(Date.now() + 60000), session.id]);
  const results = await Promise.all(Array.from({ length: 5 }, () => clients.student.request('/attendance/scan', 'POST', { token: session.qrToken })));
  assert(results.every(r => r.status === 200)); assert.equal(new Set(results.map(r => r.body.data.record.id)).size, 1);
  const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM attendance_records WHERE session_id=?', [session.id]); assert.equal(count.total, 1);
  assert.equal((await clients.studentOther.request('/attendance/scan', 'POST', { token: session.qrToken })).status, 403);
});
test('independent leave review preserves HADIR and does not require a session', options, async () => {
  const bad = await clients.student.request('/leave-requests', 'POST', { courseCode: 'TEST001', date: '2000-01-01', type: 'IZIN', reason: 'Synthetic reason', recipientIds:['lecturer-test'] }); assert.equal(bad.status, 201);
  const created = await clients.student.request('/leave-requests', 'POST', { sessionId: session.id, courseCode: 'TEST001', date: session.date, type: 'IZIN', reason: 'Synthetic reason',recipientIds:['lecturer-test'] }); assert.equal(created.status, 201);
  assert.equal((await clients.other.request(`/leave-requests/${created.body.data.id}/review`, 'POST', { decision: 'APPROVED' })).status, 403);
  assert.equal((await clients.dosen.request(`/leave-requests/${created.body.data.id}/review`, 'POST', { decision: 'APPROVED' })).status, 200);
  const [[kept]]=await pool.execute('SELECT status FROM attendance_records WHERE session_id=? AND student_nim=?',[session.id,'0001']);assert.equal(kept.status,'HADIR');
});
test('close then scan fails; manual correction creates atomic audit', options, async () => {
  assert.equal((await clients.dosen.request(`/attendance-sessions/${session.id}/close`, 'POST', {})).status, 200);
  assert.equal((await clients.student.request('/attendance/scan', 'POST', { token: session.qrToken })).status, 409);
  assert.equal((await clients.dosen.request(`/attendance-sessions/${session.id}/records/batch`, 'POST', { updates: [{ studentNim: '0001', status: 'SAKIT', reason: 'Synthetic correction' }] })).status, 200);
  const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM attendance_record_audit'); assert.equal(count.total, 2);
  const another = await client(); await another.request('/auth/login', 'POST', { identifier: '0001', role: 'mahasiswa', password: 'Synthetic-password-12345' });
  assert.equal((await another.request('/attendance-records')).body.data[0].status, 'SAKIT');
});
test('batch rolls back earlier changes when later item fails validation', options, async () => {
  const result = await clients.dosen.request(`/attendance-sessions/${session.id}/records/batch`, 'POST', { updates: [{ studentNim: '0001', status: 'IZIN', reason: 'Synthetic update' }, { studentNim: '0002', status: 'HADIR', reason: 'Not enrolled' }] }); assert.equal(result.status, 403);
  const [[record]] = await pool.execute('SELECT status FROM attendance_records WHERE student_nim=?', ['0001']); assert.equal(record.status, 'SAKIT');
});
test('import is idempotent and existing conflicting records are preserved', options, async () => {
  const repeat = await applyImport(pool, prepareImport(fixture())); assert.equal(repeat.alreadyApplied, true);
  const conflicting = fixture(); conflicting.users[0].name = 'Changed'; await assert.rejects(applyImport(pool, prepareImport(conflicting)));
  const [[user]] = await pool.execute('SELECT name FROM users WHERE id=?', ['admin-test']); assert.equal(user.name, 'Admin Test');
});
test('OTP failures, attempts, expiry, success and replay are enforced by server', options, async () => {
  const c = await client(); const request = await c.request('/auth/password-reset/request', 'POST', { identifier: '0002', role: 'mahasiswa' }); assert.equal(request.status, 202); assert(!JSON.stringify(request.body).includes(codes.at(-1).code));
  const challengeId = request.body.data.challengeId;
  const attempt = (code, id = challengeId) => c.request('/auth/password-reset/confirm', 'POST', { challengeId: id, code, newPassword: 'New-synthetic-password-123' });
  assert.equal((await attempt('wrong')).status, 400);
  const valid = codes.at(-1).code; assert.equal((await attempt(valid)).status, 200); assert.equal((await attempt(valid)).status, 400);
  await pool.execute('DELETE FROM auth_limits'); await pool.execute('UPDATE auth_challenges SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 MINUTE)');
  const locked = await c.request('/auth/password-reset/request', 'POST', { identifier: '0002', role: 'mahasiswa' });
  for (let i = 0; i < 5; i++) assert.equal((await attempt('000000', locked.body.data.challengeId)).status, 400);
  assert.equal((await attempt(codes.at(-1).code, locked.body.data.challengeId)).status, 400);
  await pool.execute('DELETE FROM auth_limits'); await pool.execute('UPDATE auth_challenges SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 MINUTE)');
  const expired = await c.request('/auth/password-reset/request', 'POST', { identifier: '0002', role: 'mahasiswa' });
  await pool.execute('UPDATE auth_challenges SET expires_at=? WHERE id=?', [new Date(0), expired.body.data.challengeId]); assert.equal((await attempt(codes.at(-1).code, expired.body.data.challengeId)).status, 400);
});
test('password change binds challenge to account and revokes all sessions', options, async () => {
  const challenge = await clients.student.request('/auth/password-change/request', 'POST', {}); const code = codes.at(-1).code;
  assert.equal((await clients.admin.request('/auth/password-change/confirm', 'POST', { challengeId: challenge.body.data.challengeId, code, newPassword: 'Another-synthetic-password-123' })).status, 400);
  assert.equal((await clients.student.request('/auth/password-change/confirm', 'POST', { challengeId: challenge.body.data.challengeId, code, newPassword: 'Another-synthetic-password-123' })).status, 200);
  assert.equal((await clients.student.request('/students')).status, 401);
});
test('device sessions never return auth tokens; revocation affects another client', options, async () => {
  const sessions = await clients.admin.request('/auth/device-sessions'); assert(!JSON.stringify(sessions.body).includes('sessionToken'));
  const another = await client(); await another.request('/auth/login', 'POST', { identifier: 'admin-test', role: 'admin', password: 'Synthetic-password-12345' });
  const others = await clients.admin.request('/auth/device-sessions/revoke-others', 'POST', {}); assert.equal(others.status, 200);
  assert.equal((await another.request('/users')).status, 401);
});
test('student account and enrollment create atomically; invalid links roll back account too', options, async () => {
  const student={nim:'0003',name:'New Synthetic Student',email:'new-student@example.test',prodi:'Teknologi Informasi',rombelIds:['missing-rombel']};
  assert.equal((await clients.admin.request('/students','POST',student)).status,409);
  const [[before]]=await pool.execute('SELECT COUNT(*) AS total FROM users WHERE username=?',['0003']);assert.equal(before.total,0);
  assert.equal((await clients.admin.request('/students','POST',{...student,rombelIds:['rombel-test']})).status,201);
  const [[linked]]=await pool.execute('SELECT user_id FROM students WHERE nim=?',['0003']);assert(linked.user_id);
});
test('own profile edits synchronize students and reject role changes; last admin is protected', options, async()=>{
  const c=await client();await c.request('/auth/login','POST',{identifier:'0001',role:'mahasiswa',password:'Another-synthetic-password-123'});
  const me=(await c.request('/users')).body.data[0];
  assert.equal((await c.request('/users/student-test','PATCH',{phone:'0000000000',version:me.version})).status,200);
  const [[profile]]=await pool.execute('SELECT phone FROM students WHERE nim=?',['0001']);assert.equal(profile.phone,'0000000000');
  assert.equal((await c.request('/users/student-test','PATCH',{role:'admin',version:me.version+1})).status,403);
  assert.equal((await clients.admin.request('/users/admin-test','DELETE',{})).status,409);
});
test('independent approved leave does not create attendance; private proof is access controlled', options, async()=>{
  const c=await client();await c.request('/auth/login','POST',{identifier:'0001',role:'mahasiswa',password:'Another-synthetic-password-123'});
  const created=await clients.dosen.request('/attendance-sessions','POST',{scheduleId:'schedule-test',date:session.date,meetingNumber:2,topic:'Leave test',isDynamicQr:false});assert.equal(created.status,201);
  const proof=await c.request('/leave-proofs','POST',{dataUrl:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4\nSynthetic test').toString('base64')});assert.equal(proof.status,201);
  const ownProof=await c.request('/leave-proofs/'+proof.body.data.id);assert.equal(ownProof.status,200);assert(ownProof.headers.get('content-disposition').startsWith('attachment'));
  assert.equal((await clients.other.request('/leave-proofs/'+proof.body.data.id)).status,404);
  const leave=await c.request('/leave-requests','POST',{sessionId:created.body.data.id,courseCode:'TEST001',date:session.date,type:'IZIN',reason:'Synthetic leave',proofId:proof.body.data.id,recipientIds:['lecturer-test']});assert.equal(leave.status,201);
  assert.equal((await clients.dosen.request(`/leave-requests/${leave.body.data.id}/review`,'POST',{decision:'APPROVED'})).status,200);
  const [[record]]=await pool.execute('SELECT status,verification_method FROM attendance_records WHERE session_id=? AND student_nim=?',[created.body.data.id,'0001']);assert.equal(record,undefined);
  assert.equal((await clients.dosen.request(`/leave-requests/${leave.body.data.id}/review`,'POST',{decision:'APPROVED'})).status,409);
});
test('server snapshots export complete data and restore into a second disposable database without credentials', options, async()=>{
  const snapshot=await clients.admin.request('/admin/snapshots','POST',{name:'Synthetic snapshot',note:'Round-trip test'});assert.equal(snapshot.status,201);
  const exported=await clients.admin.request('/admin/backups/export');assert.equal(exported.status,200);assert(exported.body.data.rombels.length>0);assert(exported.body.data.sessions.every(s=>Array.isArray(s.studentNims)));assert(exported.body.data.leaveRequests.some(l=>l.proofDocumentUrl?.startsWith('data:application/pdf')));
  assert(!JSON.stringify(exported.body).includes('passwordHash'));assert(!exported.body.data.deviceSessions);
  const preview=prepareImport(exported.body.data);assert.equal(preview.valid,true,JSON.stringify(preview.issues));
  const restoreDatabase=database.replace('_test','_restore_test');await adminConnection.query(`CREATE DATABASE ${restoreDatabase}`);
  const restorePool=mysql.createPool({host:'127.0.0.1',port:Number(process.env.HADIR_TEST_PORT||33079),user:'root',password:process.env.HADIR_TEST_PASSWORD||'',database:restoreDatabase,timezone:'Z',dateStrings:['DATE']});
  try{await migrate(restorePool);await applyImport(restorePool,preview);const [[count]]=await restorePool.execute('SELECT COUNT(*) AS total FROM user_credentials');assert.equal(count.total,0);const [[proofs]]=await restorePool.execute('SELECT COUNT(*) AS total FROM leave_proofs');assert.equal(proofs.total,1);const [[sessions]]=await restorePool.execute('SELECT COUNT(*) AS total FROM attendance_sessions WHERE is_open=1');assert.equal(sessions.total,0);}finally{await restorePool.end();assert(/^hadir_it_[a-f0-9]+_restore_test$/.test(restoreDatabase));await adminConnection.query(`DROP DATABASE ${restoreDatabase}`);}
});
test('import rollback removes earlier inserts after a later conflict', options, async()=>{
  const source=fixture();source.users[0].id='new-admin-test';source.users[0].username='new-admin-test';
  const preview=prepareImport(source);assert(preview.valid);await assert.rejects(applyImport(pool,preview));const [[count]]=await pool.execute('SELECT COUNT(*) AS total FROM users WHERE id=?',['new-admin-test']);assert.equal(count.total,0);
});


test('bulk preview, encrypted safety snapshot, version conflicts and transactional rollback', options, async()=>{
  const course=(await clients.admin.request('/courses')).body.data.find(c=>c.id==='course-test');
  const payload={courses:[{...course,name:'Bulk Synthetic Course'}]};
  const preview=await clients.admin.request('/admin/bulk/preview','POST',{data:payload});assert.equal(preview.status,200);assert.equal(preview.body.data.valid,true);
  const result=await clients.admin.request('/admin/bulk/apply','POST',{data:payload,sourceHash:preview.body.data.sourceHash});assert.equal(result.status,200);assert.equal(result.body.data.counts.courses.updated,1);
  const [[snapshot]]=await pool.execute('SELECT payload FROM private_snapshots WHERE id=?',[result.body.data.snapshotId]);assert(!snapshot.payload.includes('Synthetic'));
  assert.equal((await clients.admin.request('/admin/bulk/apply','POST',{data:payload,sourceHash:preview.body.data.sourceHash})).status,409);
  const broken={users:[{id:'bulk-new-test',username:'bulk-new-test',name:'Synthetic New',email:'bulk@example.test',role:'dosen'}],students:[{nim:'0099',name:'Synthetic Missing Rombel',email:'missing@example.test',prodi:'Teknologi Informasi',rombelIds:['missing-rombel']}]};
  const checked=await clients.admin.request('/admin/bulk/preview','POST',{data:broken});assert.equal(checked.body.data.valid,true);
  assert.equal((await clients.admin.request('/admin/bulk/apply','POST',{data:broken,sourceHash:checked.body.data.sourceHash})).status,409);
  const [[count]]=await pool.execute('SELECT COUNT(*) AS total FROM users WHERE id=?',['bulk-new-test']);assert.equal(count.total,0);
});

test('import preview detects database conflicts before apply without exposing records', options, async()=>{
  const backup=fixture();backup.users[0].name='Conflicting Synthetic Name';
  const result=await clients.admin.request('/admin/imports/preview','POST',{backup});assert.equal(result.status,200);assert.equal(result.body.data.valid,false);assert(result.body.data.issues.some(i=>i.code==='EXISTING_RECORD_CONFLICT'));assert(!JSON.stringify(result.body).includes('Conflicting Synthetic Name'));
});

test('OTP verification, account enumeration response and concurrent single use', options, async()=>{
  const c=await client();
  const absent=await c.request('/auth/password-reset/request','POST',{identifier:'missing-synthetic',role:'dosen'});
  const found=await c.request('/auth/password-reset/request','POST',{identifier:'other-lecturer',role:'dosen'});
  assert.equal(absent.status,202);assert.equal(found.status,202);assert.equal(absent.body.data.message,found.body.data.message);assert.equal(absent.body.data.challengeId.length,found.body.data.challengeId.length);
  const challengeId=found.body.data.challengeId,code=codes.at(-1).code;
  assert.equal((await c.request('/auth/password-reset/verify','POST',{challengeId,code:'wrong'})).status,400);
  assert.equal((await c.request('/auth/password-reset/verify','POST',{challengeId,code})).status,200);
  const attempts=await Promise.all([1,2].map(()=>c.request('/auth/password-reset/confirm','POST',{challengeId,code,newPassword:'Concurrent-synthetic-password-123'})));
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,400]);
});

test('session expiry and deactivated accounts reject already issued cookies', options, async()=>{
  const c=await client();assert.equal((await c.request('/auth/login','POST',{identifier:'0001',role:'mahasiswa',password:'Another-synthetic-password-123'})).status,200);
  const sessions=(await c.request('/auth/device-sessions')).body.data;const own=sessions.find(s=>s.isCurrentDevice);
  await pool.execute('UPDATE device_sessions SET last_active_at=? WHERE id=?',[new Date(0),own.id]);assert.equal((await c.request('/users')).status,401);
  const d=await client();assert.equal((await d.request('/auth/login','POST',{identifier:'other-lecturer',role:'dosen',password:'Concurrent-synthetic-password-123'})).status,200);
  await pool.execute('UPDATE users SET is_active=0 WHERE id=?',['other-lecturer']);assert.equal((await d.request('/users')).status,401);
});


test('parallel close and scan serialize into one final attendance and audit row', options, async()=>{
  const c=await client();await c.request('/auth/login','POST',{identifier:'0001',role:'mahasiswa',password:'Another-synthetic-password-123'});
  const opened=await clients.dosen.request('/attendance-sessions','POST',{scheduleId:'schedule-test',date:session.date,meetingNumber:3,topic:'Race fixture',isDynamicQr:false});assert.equal(opened.status,201);
  const current=opened.body.data;const results=await Promise.all([c.request('/attendance/scan','POST',{token:current.qrToken}),clients.dosen.request('/attendance-sessions/'+current.id+'/close','POST',{})]);
  assert([200,409].includes(results[0].status));assert.equal(results[1].status,200);
  const [[record]]=await pool.execute('SELECT id,status FROM attendance_records WHERE session_id=? AND student_nim=?',[current.id,'0001']);assert(['HADIR','ALPHA'].includes(record.status));
  const [[count]]=await pool.execute('SELECT COUNT(*) AS total FROM attendance_record_audit WHERE attendance_record_id=?',[record.id]);assert.equal(count.total,1);
});

test('academic create, archive and restore preserve data and reject dangling relations', options, async()=>{
  const body={...fixture().courses[0],id:'course-crud',code:'CRU001',name:'Synthetic CRUD'};
  assert.equal((await clients.admin.request('/courses','POST',body)).status,201);
  assert.equal((await clients.admin.request('/courses/course-crud','DELETE',{})).status,200);
  const course=(await clients.admin.request('/courses')).body.data.find(c=>c.id==='course-crud');assert.equal(course.isArchived,true);
  assert.equal((await clients.admin.request('/courses/course-crud','PATCH',{isArchived:false,archivedAt:null,version:course.version})).status,200);
  assert.equal((await clients.admin.request('/students/0003/relations','PUT',{rombelIds:['missing'],includedIds:[],excludedIds:[]})).status,409);
  const [[count]]=await pool.execute('SELECT COUNT(*) AS total FROM student_rombels WHERE student_nim=?',['0003']);assert.equal(count.total,1);
});

test('migration ledger refuses checksum drift without changing schema', options, async()=>{
  const [[migration]]=await pool.execute('SELECT name,checksum FROM schema_migrations ORDER BY name LIMIT 1');
  await pool.execute('UPDATE schema_migrations SET checksum=? WHERE name=?',['0'.repeat(64),migration.name]);
  try{await assert.rejects(migrate(pool),e=>e.code==='MIGRATION_CHECKSUM_MISMATCH');}finally{await pool.execute('UPDATE schema_migrations SET checksum=? WHERE name=?',[migration.checksum,migration.name]);}
});

test('synthetic legacy reconciliation imports 644 records idempotently and freezes session roster across enrollment edits',options,async()=>{
  const isolated=database.replace('_test','_legacy_test');assert(/^hadir_it_[a-f0-9]+_legacy_test$/.test(isolated));
  await adminConnection.query('CREATE DATABASE '+isolated);
  const target=mysql.createPool({host:'127.0.0.1',port:Number(process.env.HADIR_TEST_PORT||33079),user:'root',password:process.env.HADIR_TEST_PASSWORD||'',database:isolated,timezone:'Z',dateStrings:['DATE']});
  try{
    await migrate(target);
    const source=archivedLeaveFixture(),before=JSON.stringify(source);
    const plan=reconcileLegacy(source);assert.equal(plan.report.status,'READY');assert.equal(JSON.stringify(source),before);
    const preview=prepareImport(plan.data);assert(preview.valid);await applyImport(target,preview);
    const repeated=await applyImport(target,prepareImport(reconcileLegacy(source).data));assert.equal(repeated.alreadyApplied,true);
    const [[records]]=await target.execute("SELECT COUNT(*) AS total,COUNT(DISTINCT CONCAT(session_id,':',student_nim)) AS pairs FROM attendance_records");assert.equal(records.total,644);assert.equal(records.pairs,644);
    const [[rosterBefore]]=await target.execute('SELECT COUNT(*) AS total FROM session_roster WHERE session_id=?',['session-synthetic-0']);assert.equal(rosterBefore.total,66);
    const historyApp=createApp({pool:target,origin,secret:'synthetic-history-secret-longer-than-32-characters'}),historyServer=historyApp.listen(0,'127.0.0.1');await once(historyServer,'listening');
    try{
      await target.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)',['admin-synthetic',await hashPassword('Synthetic-history-password-123')]);
      const reviewer=await client('http://127.0.0.1:'+historyServer.address().port);assert.equal((await reviewer.request('/auth/login','POST',{identifier:'admin-synthetic',role:'admin',password:'Synthetic-history-password-123'})).status,200);
      const [archives]=await target.execute('SELECT id,status,archive_marker,legacy_source_hash,session_id FROM leave_requests ORDER BY id');
      assert.equal(archives.length,3);assert.deepEqual(archives.map(l=>l.status),['PENDING','APPROVED','REJECTED']);assert(archives.every(l=>l.archive_marker==='LEGACY_ARCHIVED_NO_RECIPIENT'&&l.legacy_source_hash.length===64&&l.session_id===null));
      const [[archiveAudit]]=await target.execute("SELECT COUNT(*) AS total FROM audit_logs WHERE action='LEGACY_LEAVE_ARCHIVED'");assert.equal(archiveAudit.total,3);
      const archiveList=(await reviewer.request('/leave-requests')).body.data;assert.equal(archiveList.length,3);
      const proofPath=archiveList.find(l=>l.id==='archive-0').proofDocumentUrl.replace('/api/v1','');assert.equal((await reviewer.request(proofPath)).status,200);
      assert.equal((await reviewer.request('/leave-requests/archive-0/review','POST',{decision:'APPROVED'})).status,409);
      for(const [id,role,identifier,count] of [['lecturer-synthetic-0','dosen','lecturer-synthetic-0',0],['student-synthetic-0','mahasiswa','synthetic-000',3],['student-synthetic-1','mahasiswa','synthetic-001',0]]){
        const [[account]]=await target.execute('SELECT id,username FROM users WHERE '+(role==='mahasiswa'?'username':'id')+'=?',[identifier]);assert(account);
        await target.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)',[account.id,await hashPassword('Synthetic-history-password-123')]);
        const actor=await client('http://127.0.0.1:'+historyServer.address().port);assert.equal((await actor.request('/auth/login','POST',{identifier:account.username,role,password:'Synthetic-history-password-123'})).status,200);
        assert.equal((await actor.request('/leave-requests')).body.data.length,count);
        assert.equal((await actor.request(proofPath)).status,count===3?200:404);
        if(role==='dosen')assert.equal((await actor.request('/leave-requests/archive-0/review','POST',{decision:'APPROVED'})).status,403);
        else {
          const request={date:'2026-11-19',type:'IZIN',reason:'Synthetic new request',recipientIds:[]};
          assert.equal((await actor.request('/leave-requests','POST',request)).status,422);
          assert.equal((await actor.request('/leave-requests','POST',{...request,archiveMarker:'LEGACY_ARCHIVED_NO_RECIPIENT'})).status,422);
        }
      }
      const registration=await reviewer.request('/admin/legacy-excludes/sources','POST',{backup:excludeReviewFixture()});assert.equal(registration.status,200);const sourceHash=registration.body.data.sourceHash;
      const item=(await reviewer.request('/admin/legacy-excludes/sources/'+sourceHash)).body.data.items[0];
      const request={sourceHash,itemIds:[item.id],action:'ARCHIVE',reason:'Synthetic history preservation proof'};const preview=await reviewer.request('/admin/legacy-excludes/preview','POST',request);assert.equal(preview.status,200);
      const [beforeRows]=await target.execute('SELECT * FROM attendance_records ORDER BY id');
      assert.equal((await reviewer.request('/admin/legacy-excludes/decisions','POST',{...request,previewHash:preview.body.data.previewHash,requestId:'synthetic-history-archive'})).status,200);
      const [afterRows]=await target.execute('SELECT * FROM attendance_records ORDER BY id');assert.equal(afterRows.length,644);assert.deepEqual(afterRows,beforeRows);
    }finally{historyServer.closeAllConnections();await new Promise(resolve=>historyServer.close(resolve));}
    const group=plan.data.rombels.find(r=>r.code==='TI 5');
    await target.execute('DELETE FROM student_rombels WHERE student_nim=?',['synthetic-000']);await target.execute('INSERT INTO student_rombels VALUES (?,?)',['synthetic-000',group.id]);
    const [[rosterAfter]]=await target.execute('SELECT COUNT(*) AS total FROM session_roster WHERE session_id=?',['session-synthetic-0']);assert.equal(rosterAfter.total,66);
    const [[unchanged]]=await target.execute('SELECT COUNT(*) AS total FROM attendance_records');assert.equal(unchanged.total,644);
  }finally{await target.end();await adminConnection.query('DROP DATABASE '+isolated);}
});


test('only admin can review legacy EXCLUDE; students and lecturers cannot mutate schedule overrides',options,async()=>{
  const student=await client();await student.request('/auth/login','POST',{identifier:'0001',role:'mahasiswa',password:'Another-synthetic-password-123'});
  for(const c of [student,clients.dosen]){
    assert.equal((await c.request('/admin/legacy-excludes/sources','POST',{backup:excludeReviewFixture()})).status,403);
    assert.equal((await c.request('/students/0001/relations','PUT',{rombelIds:['rombel-test'],excludedIds:['schedule-test'],includedIds:[]})).status,403);
    assert.equal((await c.request('/admin/legacy-excludes/decisions','POST',{})).status,403);
  }
});

test('admin bulk preview, selected exceptions, final decisions, idempotency, concurrent guards and audit',options,async()=>{
  const source=excludeReviewFixture(),before=JSON.stringify(source);
  const registered=await clients.admin.request('/admin/legacy-excludes/sources','POST',{backup:source});assert.equal(registered.status,200);const sourceHash=registered.body.data.sourceHash;
  let view=(await clients.admin.request('/admin/legacy-excludes/sources/'+sourceHash)).body.data;assert.equal(view.counts.total,18);assert.equal(view.counts.decided,0);
  const ids=view.items.map(i=>i.id),target=source.schedules[0].id;
  const body={sourceHash,itemIds:ids.slice(0,16),action:'CONTINUE',newScheduleId:target,reason:'Synthetic administrator decision'};
  const missing=await clients.admin.request('/admin/legacy-excludes/preview','POST',{...body,newScheduleId:'absent'});assert.equal(missing.status,422);
  const p=await clients.admin.request('/admin/legacy-excludes/preview','POST',body);assert.equal(p.status,200);assert.equal(p.body.data.impacts.length,16);assert(p.body.data.impacts.every(i=>i.beforeSks===18&&i.afterSks===16));
  const saved={...body,previewHash:p.body.data.previewHash,requestId:'synthetic-decision-continue'};
  const responses=await Promise.all([clients.admin.request('/admin/legacy-excludes/decisions','POST',saved),clients.admin.request('/admin/legacy-excludes/decisions','POST',saved)]);assert(responses.every(r=>r.status===200));assert.equal(responses[0].body.data.unresolved,2);
  assert.equal((await clients.admin.request('/admin/legacy-excludes/decisions','POST',{...saved,reason:'Changed request'})).status,409);
  for(const [index,action] of [[16,'ARCHIVE'],[17,'DEFER']]){
    const data={sourceHash,itemIds:[ids[index]],action,reason:'Synthetic '+action};const check=await clients.admin.request('/admin/legacy-excludes/preview','POST',data);assert.equal(check.status,200);assert.equal(check.body.data.impacts[0].beforeSks,18);assert.equal(check.body.data.impacts[0].afterSks,18);
    assert.equal((await clients.admin.request('/admin/legacy-excludes/decisions','POST',{...data,previewHash:check.body.data.previewHash,requestId:'synthetic-'+action})).status,200);
  }
  view=(await clients.admin.request('/admin/legacy-excludes/sources/'+sourceHash)).body.data;assert.equal(view.counts.CONTINUE,16);assert.equal(view.counts.ARCHIVE,1);assert.equal(view.counts.DEFER,1);assert.equal(view.counts.unresolved,1);
  assert.equal((await clients.admin.request('/admin/legacy-excludes/sources/'+sourceHash+'/candidate')).status,409);
  const final={sourceHash,itemIds:[ids[17]],action:'ARCHIVE',reason:'Synthetic final archival'};const fp=await clients.admin.request('/admin/legacy-excludes/preview','POST',final);
  const finalBody={...final,previewHash:fp.body.data.previewHash,requestId:'synthetic-final'};
  const finalReplies=await Promise.all([clients.admin.request('/admin/legacy-excludes/decisions','POST',finalBody),clients.admin.request('/admin/legacy-excludes/decisions','POST',{...finalBody,requestId:'competing-synthetic'})]);assert.deepEqual(finalReplies.map(r=>r.status).sort(),[200,409]);
  const exported=await clients.admin.request('/admin/legacy-excludes/sources/'+sourceHash+'/candidate');assert.equal(exported.status,200);assert.equal(exported.body.data.decisions.length,18);assert.deepEqual(exported.body.data.backup.records,source.records);assert.equal(exported.body.data.backup.records.length,644);
  assert.equal(new Set(exported.body.data.backup.students.flatMap(s=>(s.excludedScheduleIds||[]).map(id=>s.nim+':'+id))).size,exported.body.data.backup.students.reduce((n,s)=>n+s.excludedScheduleIds.length,0));
  assert(exported.body.data.backup.students.every(s=>s.excludedScheduleIds.includes(source.schedules[9].id)));assert.equal(JSON.stringify(source),before);
  const [[audit]]=await pool.execute("SELECT COUNT(*) AS total FROM audit_logs WHERE action LIKE 'LEGACY_EXCLUDE_%' AND entity_type='decision'");assert.equal(audit.total,4);
  const [[ledger]]=await pool.execute('SELECT COUNT(*) AS total FROM legacy_exclude_decisions WHERE source_hash=?',[sourceHash]);assert.equal(ledger.total,4);
  const tampered=structuredClone(exported.body.data.backup);tampered.records[0].status='SAKIT';await assert.rejects(applyImport(pool,prepareImport(tampered)),e=>e.code==='LEGACY_REVIEW_CHANGED');
});

test('historical review actors preserve audit without login users; transfer/import repeat safely and failures roll back',options,async()=>{
  const isolated=database.replace('_test','_actors_test');assert(/^hadir_it_[a-f0-9]+_actors_test$/.test(isolated));await adminConnection.query('CREATE DATABASE '+isolated);
  const target=mysql.createPool({host:'127.0.0.1',port:Number(process.env.HADIR_TEST_PORT||33079),user:'root',password:process.env.HADIR_TEST_PASSWORD||'',database:isolated,timezone:'Z',dateStrings:['DATE']});
  try{
    await migrate(target);await migrate(target);
    const {packet,oldSecret,newSecret}=historicalReviewFixture(),options={oldSecret,newSecret};
    assert(prepareReviewTransfer(packet,oldSecret).preview.valid);
    const invalid=structuredClone(packet);invalid.items[0].decided_by='unknown';assert.throws(()=>prepareReviewTransfer(invalid,oldSecret));
    await target.execute("INSERT INTO audit_logs (id,action,entity_type,entity_id) VALUES (1001,'SYNTHETIC','test','test')");
    await assert.rejects(applyReviewTransfer(target,packet,options),e=>e.code==='ER_DUP_ENTRY');
    for(const table of ['legacy_review_actors','legacy_exclude_batches','legacy_exclude_items','legacy_review_transfer_provenance']){const [[r]]=await target.query('SELECT COUNT(*) AS n FROM '+table);assert.equal(r.n,0);}
    await target.execute('DELETE FROM audit_logs WHERE id=1001');
    const transferred=await applyReviewTransfer(target,packet,options);assert.equal(transferred.alreadyApplied,false);assert.equal((await applyReviewTransfer(target,packet,options)).alreadyApplied,true);
    const [[actor]]=await target.execute('SELECT actor_type,user_id,provenance FROM legacy_review_actors WHERE id=?',[packet.operators[0].id]);assert.equal(actor.actor_type,'HISTORICAL_OPERATOR');assert.equal(actor.user_id,null);
    await assert.rejects(target.execute('UPDATE legacy_exclude_items SET decided_by=? WHERE id=?',['unknown',packet.items[0].id]),e=>e.code==='ER_NO_REFERENCED_ROW_2');
    await assert.rejects(target.execute("INSERT INTO legacy_review_actors (id,actor_type,user_id,provenance) VALUES ('invalid','HISTORICAL_OPERATOR','missing','{}')"));
    const [audits]=await target.execute('SELECT id,actor_user_id,historical_actor_id,action,entity_id,created_at FROM audit_logs ORDER BY id');assert.equal(audits.length,2);assert(audits.every(a=>a.actor_user_id===null&&a.historical_actor_id===packet.operators[0].id));assert.deepEqual(audits.map(a=>a.id),packet.auditLogs.map(a=>a.id));
    const [[proof]]=await target.execute('SELECT original_ciphertext,original_audit FROM legacy_review_transfer_provenance');assert.equal(proof.original_ciphertext,packet.batch.encrypted_source);assert.deepEqual(typeof proof.original_audit==='string'?JSON.parse(proof.original_audit):proof.original_audit,packet.auditLogs);
    await applyImport(target,transferred.preview);assert.equal((await applyImport(target,transferred.preview)).alreadyApplied,true);
    const [[counts]]=await target.query('SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM attendance_records) AS records,(SELECT COUNT(*) FROM leave_requests) AS leaves');assert.deepEqual([counts.users,counts.records,counts.leaves],[78,644,3]);
    const [[time]]=await target.execute('SELECT scanned_at FROM attendance_records WHERE id=?',[transferred.preview.data.records[0].id]);assert.equal(time.scanned_at.getUTCMilliseconds(),123);const [[sessionTime]]=await target.execute('SELECT created_at FROM attendance_sessions WHERE id=?',[transferred.preview.data.sessions[0].id]);assert.equal(sessionTime.created_at.getUTCMilliseconds(),456);assert.equal((await target.execute('SELECT id FROM users WHERE id=?',[packet.operators[0].id]))[0].length,0);
    const app=createApp({pool:target,origin,secret:'synthetic-historical-login-secret-more-than-32'}),srv=app.listen(0,'127.0.0.1');await once(srv,'listening');try{const c=await client('http://127.0.0.1:'+srv.address().port);assert.equal((await c.request('/auth/login','POST',{identifier:packet.operators[0].id,role:'admin',password:'synthetic-password-123456'})).status,401);}finally{srv.closeAllConnections();await new Promise(r=>srv.close(r));}
  }finally{await target.end();await adminConnection.query('DROP DATABASE '+isolated);}
});

test('single-admin activation hashes short-lived tokens, rejects replay/expiry and preserves academic data',options,async()=>{
  const isolated=database.replace('_test','_activation_test');assert(/^hadir_it_[a-f0-9]+_activation_test$/.test(isolated));await adminConnection.query('CREATE DATABASE '+isolated);
  const target=mysql.createPool({host:'127.0.0.1',port:Number(process.env.HADIR_TEST_PORT||33079),user:'root',password:process.env.HADIR_TEST_PASSWORD||'',database:isolated,timezone:'Z',dateStrings:['DATE']});
  try{await migrate(target);await applyImport(target,prepareImport(fixture()));const issued=await issueAdminActivation(target);const [[row]]=await target.execute('SELECT token_hash,TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),expires_at) AS ttl FROM password_reset_tokens WHERE id=?',[issued.id]);assert.notEqual(row.token_hash,issued.token);assert.match(row.token_hash,/^[a-f0-9]{64}$/);assert(row.ttl>0&&row.ttl<=900);
    await assert.rejects(completeAdminActivation(target,{...issued,token:'A'.repeat(43),newPassword:'Synthetic-new-admin-password-123'}));
    await target.execute('UPDATE password_reset_tokens SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?',[issued.id]);await assert.rejects(completeAdminActivation(target,{...issued,newPassword:'Synthetic-new-admin-password-123'}));
    const current=await issueAdminActivation(target);await completeAdminActivation(target,{...current,newPassword:'Synthetic-new-admin-password-123'});await assert.rejects(completeAdminActivation(target,{...current,newPassword:'Synthetic-other-password-123'}));await assert.rejects(issueAdminActivation(target));
    const [[counts]]=await target.query('SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM user_credentials) AS credentials,(SELECT COUNT(*) FROM attendance_records) AS records');assert.deepEqual([counts.users,counts.credentials,counts.records],[5,1,0]);
    const app=createApp({pool:target,origin,secret:'synthetic-activation-login-secret-more-than-32'}),srv=app.listen(0,'127.0.0.1');await once(srv,'listening');try{const c=await client('http://127.0.0.1:'+srv.address().port);assert.equal((await c.request('/auth/login','POST',{identifier:'admin-test',role:'admin',password:'Synthetic-new-admin-password-123'})).status,200);assert.equal((await c.request('/auth/me')).status,200);}finally{srv.closeAllConnections();await new Promise(r=>srv.close(r));}
  }finally{await target.end();await adminConnection.query('DROP DATABASE '+isolated);}
});
