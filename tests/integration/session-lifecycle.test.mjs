import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { hashPassword } from '../../backend/security.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { historicalAttendanceFixture } from '../fixtures.mjs';
import { backupData } from '../../backend/admin.mjs';

const enabled = process.env.HADIR_TEST_DB === '1';
const origin = 'http://127.0.0.1', password = 'Synthetic-history-password-12345';
let root, pool, server, database, url, source;

async function client(identifier, role) {
  const jar = new Map(); let csrf = '';
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`${url}/api/v1${path}`, {
      method,
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), 'X-CSRF-Token': csrf },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'), at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return { status: response.status, body: await response.json() };
  };
  csrf = (await request('/auth/csrf')).body.data.csrfToken;
  assert.equal((await request('/auth/login', 'POST', { identifier, role, password })).status, 200);
  return { request };
}

async function academicDigest() {
  const snapshot = {};
  for (const table of ['students', 'courses', 'schedules', 'rombels', 'student_rombels', 'rombel_schedules', 'attendance_sessions', 'session_roster', 'attendance_records', 'attendance_record_audit']) {
    snapshot[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY 1`))[0];
  }
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

before(async () => {
  if (!enabled) return;
  assert.equal(process.env.HADIR_TEST_HOST || '127.0.0.1', '127.0.0.1');
  const port = Number(process.env.HADIR_TEST_PORT || 33079);
  assert(port >= 1024 && port <= 65535);
  database = `hadir_lifecycle_${randomBytes(5).toString('hex')}_test`;
  root = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
  await root.query(`CREATE DATABASE ${database}`);
  pool = mysql.createPool({ host: '127.0.0.1', port, user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 5 });
  await migrate(pool);
  source = historicalAttendanceFixture();
  const original = JSON.stringify(source), preview = prepareImport(source);
  assert(preview.valid, JSON.stringify(preview.issues));
  await applyImport(pool, preview);
  assert.equal(JSON.stringify(source), original);
  const hash = await hashPassword(password);
  for (const user of source.users) await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', [user.id, hash]);
  server = createApp({ pool, origin, secret: 'Synthetic-lecturer-history-secret-over-32-characters', sendOtp: async () => assert.fail('History reads must not send OTP') }).listen(0, '127.0.0.1');
  await once(server, 'listening'); url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await pool?.end();
  if (root && /^hadir_lifecycle_[a-f0-9]+_test$/.test(database)) { await root.query(`DROP DATABASE ${database}`); await root.end(); }
});

test('manual closed correction, audit idempotency, archive, new attempt and reopen preserve physical history', { skip: !enabled }, async () => {
  const admin = await client('admin-test', 'admin'), lecturer = await client('lecturer-test', 'dosen');
  const other = await client('other-lecturer', 'dosen'), student = await client('0001', 'mahasiswa');
  const path = '/attendance-sessions/history-session-1';
  const physical = async () => (await pool.query('SELECT COUNT(*) AS total FROM attendance_records'))[0][0].total;
  const initialCount = await physical();
  const correction = { updates: [{ studentNim: '0004', status: 'HADIR', reason: 'Verified synthetic correction' }] };
  assert.equal((await other.request(path+'/records/batch','POST',correction)).status,403);
  assert.equal((await student.request(path+'/records/batch','POST',correction)).status,403);
  const corrected = await lecturer.request(path+'/records/batch','POST',correction);
  assert.equal(corrected.status,200); assert.equal(corrected.body.data[0].status,'HADIR');
  assert.equal((await lecturer.request(path+'/history')).body.data.session.isOpen,false);
  const [[audit]] = await pool.query('SELECT * FROM attendance_record_audit WHERE attendance_record_id=?',[corrected.body.data[0].id]);
  assert.equal(audit.old_status,'ALPHA'); assert.equal(audit.new_status,'HADIR'); assert.equal(audit.changed_by,'lecturer-test'); assert.equal(audit.method,'MANUAL');
  await lecturer.request(path+'/records/batch','POST',correction);
  assert.equal((await pool.query('SELECT COUNT(*) AS total FROM attendance_record_audit WHERE attendance_record_id=?',[corrected.body.data[0].id]))[0][0].total,1);
  assert.equal((await lecturer.request(path+'/records/batch','POST',{updates:[{...correction.updates[0],version:0,status:'SAKIT'}]})).status,409);
  const snapshot = (await lecturer.request('/reports/snapshot')).body.data;
  assert.equal(snapshot.records.find(r=>r.id===corrected.body.data[0].id).status,'HADIR'); assert(snapshot.generatedAt);
  assert.equal((await lecturer.request(path+'/reopen','POST',{})).status,403);
  const opened = await admin.request(path+'/reopen','POST',{});assert.equal(opened.status,200);assert.equal(opened.body.data.isOpen,true);assert.equal(opened.body.data.qrExpiresAt,null);
  assert.equal((await admin.request('/attendance-sessions/history-session-2/reopen','POST',{})).status,409);
  const reset = await admin.request(path+'/reset','POST',{});assert.equal(reset.status,200);assert.equal(reset.body.data.isArchived,true);assert.equal(reset.body.data.isOpen,false);assert.equal(reset.body.data.archiveReason,'RESET');
  await admin.request(path+'/reset','POST',{});
  assert.equal((await pool.query("SELECT COUNT(*) total FROM audit_logs WHERE action='SESSION_RESET' AND entity_id=?",['history-session-1']))[0][0].total,1);
  assert.equal(await physical(),initialCount);
  assert.equal((await lecturer.request(path+'/records/batch','POST',correction)).status,409);
  assert.equal((await lecturer.request(path+'/history')).status,403);assert.equal((await admin.request(path+'/history')).status,200);
  assert.equal((await lecturer.request('/attendance-sessions?archived=1')).status,403);
  const visible = (await admin.request('/reports/snapshot')).body.data;
  assert(!visible.sessions.some(s=>s.id==='history-session-1'));assert(!visible.records.some(r=>r.sessionId==='history-session-1'));
  const archived = (await admin.request('/reports/snapshot?archived=1')).body.data;assert.equal(archived.sessions.length,1);assert.equal(archived.records.length,4);
  const [[old]] = await pool.query('SELECT * FROM attendance_sessions WHERE id=?',['history-session-1']);
  await pool.execute(`INSERT INTO attendance_sessions (id,schedule_id,course_code,course_name,lecturer_id,lecturer_name,rombel,room,date,start_time,end_time,meeting_number,topic,qr_token,is_open) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`, ['attempt-new',old.schedule_id,old.course_code,old.course_name,old.lecturer_id,old.lecturer_name,old.rombel,old.room,old.date,old.start_time,old.end_time,old.meeting_number,'New attempt','new-disabled-token']);
  assert.equal((await pool.query('SELECT COUNT(*) total FROM attendance_records WHERE session_id=?',['attempt-new']))[0][0].total,0);
  assert.equal((await lecturer.request('/attendance-sessions/attempt-new')).status,404);
  assert.equal((await admin.request('/attendance-sessions/attempt-new','DELETE',{})).status,200);
  assert.equal((await pool.query('SELECT COUNT(*) total FROM attendance_sessions WHERE id=?',['attempt-new']))[0][0].total,1);
  assert.equal(await physical(),initialCount);
});

test('new execution after reset is new ID with no copied records and repeated migration is safe', { skip: !enabled }, async () => {
  const lecturer = await client('lecturer-test','dosen'), admin = await client('admin-test','admin');
  const payload = { scheduleId:'schedule-test',date:'2099-01-01',meetingNumber:16,topic:'Synthetic future execution',startTime:'08:00',endTime:'09:00' };
  const first = await lecturer.request('/attendance-sessions','POST',payload); assert.equal(first.status,201);
  const id=first.body.data.id;
  assert.equal((await lecturer.request('/attendance-sessions/'+id+'/records/batch','POST',{updates:[{studentNim:'0001',status:'IZIN',reason:'Synthetic open correction'}]})).status,200);
  assert.equal((await lecturer.request('/attendance-sessions/'+id+'/history')).body.data.session.isOpen,true);
  assert.equal((await admin.request('/attendance-sessions/'+id+'/reset','POST',{})).status,200);
  const second=await lecturer.request('/attendance-sessions','POST',payload);assert.equal(second.status,201);assert.notEqual(second.body.data.id,id);
  assert.equal((await lecturer.request('/attendance-sessions/'+second.body.data.id+'/history')).body.data.records.length,0);
  assert.equal((await pool.query('SELECT COUNT(*) total FROM attendance_records WHERE session_id=?',[id]))[0][0].total,1);
  await migrate(pool);
  assert.equal((await pool.query("SELECT COUNT(*) total FROM schema_migrations WHERE name='017_session_lifecycle.sql'"))[0][0].total,1);
});


test('official private backup retains archived attempts and import is idempotent without restoring QR', { skip: !enabled }, async () => {
  const backup = await backupData(pool,{id:'admin-test',role:'admin'});
  const preview = prepareImport(backup);assert.equal(preview.valid,true,JSON.stringify(preview.issues));
  assert(backup.sessions.some(s=>s.isArchived && s.archiveReason==='RESET'));
  assert(backup.records.some(r=>r.sessionId==='history-session-1'));
  const restoreName = `hadir_lifecycle_restore_${randomBytes(5).toString('hex')}_test`;
  await root.query(`CREATE DATABASE ${restoreName}`);
  const restored = mysql.createPool({ host:'127.0.0.1',port:Number(process.env.HADIR_TEST_PORT||33079),user:'root',password:process.env.HADIR_TEST_PASSWORD||'',database:restoreName,timezone:'Z',dateStrings:['DATE'] });
  try {
    await migrate(restored);await applyImport(restored,preview);
    assert.equal((await applyImport(restored,preview)).alreadyApplied,true);
    const [[original]]=await pool.query('SELECT COUNT(*) total FROM attendance_records');
    const [[copy]]=await restored.query('SELECT COUNT(*) total FROM attendance_records');assert.equal(copy.total,original.total);
    const [[archive]]=await restored.query('SELECT is_archived,archive_reason,archived_by,is_open,qr_expires_at FROM attendance_sessions WHERE id=?',['history-session-1']);
    assert.equal(archive.is_archived,1);assert.equal(archive.archive_reason,'RESET');assert.equal(archive.archived_by,'admin-test');assert.equal(archive.is_open,0);assert.equal(archive.qr_expires_at,null);
  } finally {await restored.end();await root.query(`DROP DATABASE ${restoreName}`);}
});
