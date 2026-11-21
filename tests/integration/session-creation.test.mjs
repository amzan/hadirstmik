import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createApp } from '../../backend/app.mjs';
import { expireSessions } from '../../backend/domain.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { hashPassword } from '../../backend/security.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { sessionCreationFixture as historicalAttendanceFixture } from '../fixtures.mjs';
import { ensureLecturerLoginAliases } from '../../backend/lecturer-login.mjs';

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
  await ensureLecturerLoginAliases(pool);
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

test('session creation, QR, corrections and replacement attempts preserve isolated history', { skip: !enabled }, async t => {
  const [[alias]] = await pool.query("SELECT login_alias FROM users WHERE id='lecturer-test'");
  const lecturer=await client(alias.login_alias.toUpperCase(),'dosen'),admin=await client('admin-test','admin'),student=await client('0001','mahasiswa'),nonRosterStudent=await client('0002','mahasiswa'),other=await client('other-lecturer','dosen');
  const base={scheduleId:'schedule-same-course',date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),startTime:'00:00',endTime:'23:59',meetingNumber:1,topic:'Synthetic creation',evaluationMethod:'Synthetic evaluation',isDynamicQr:true};
  const historical=(await pool.query("SELECT * FROM attendance_records WHERE session_id LIKE 'history-%' ORDER BY id"))[0];
  let first,second,replacement;
  await t.test('two concurrent first inserts with different dates create one execution',async()=>{const results=await Promise.all([lecturer.request('/attendance-sessions','POST',{...base,meetingNumber:4}),lecturer.request('/attendance-sessions','POST',{...base,meetingNumber:4,date:'2099-01-01'})]);assert(results.every(r=>r.status===201),JSON.stringify(results));assert.equal(results[0].body.data.id,results[1].body.data.id);assert.equal((await pool.query('SELECT COUNT(*) n FROM attendance_sessions WHERE schedule_id=? AND meeting_number=4',[base.scheduleId]))[0][0].n,1);});
  await t.test('first meeting and first-name alias retain authoritative lecturer and roster',async()=>{const result=await lecturer.request('/attendance-sessions','POST',base);assert.equal(result.status,201,JSON.stringify(result.body));first=result.body.data;assert.equal(first.lecturerId,'lecturer-test');assert(first.isOpen);assert(first.qrToken);assert.equal((await pool.query('SELECT COUNT(*) n FROM session_roster WHERE session_id=?',[first.id]))[0][0].n,1);});
  await t.test('concurrent repeated clicks including different dates return one active execution',async()=>{const results=await Promise.all([lecturer.request('/attendance-sessions','POST',base),lecturer.request('/attendance-sessions','POST',{...base,date:'2099-01-01'})]);assert(results.every(r=>r.status===201&&r.body.data.id===first.id));assert.equal((await pool.query('SELECT COUNT(*) n FROM attendance_sessions WHERE schedule_id=? AND meeting_number=1',[base.scheduleId]))[0][0].n,1);});
  await t.test('another schedule does not block and another lecturer is forbidden',async()=>{assert.equal((await other.request('/attendance-sessions','POST',base)).status,403);assert.equal((await lecturer.request('/attendance-sessions','POST',{...base,scheduleId:'schedule-other-lecturer'})).status,403);const result=await lecturer.request('/attendance-sessions','POST',{...base,scheduleId:'schedule-test',meetingNumber:7});assert.equal(result.status,201);assert.notEqual(result.body.data.id,first.id);});
  await t.test('valid QR records only the new session and unauthorized roster is rejected',async()=>{const result=await student.request('/attendance/scan','POST',{token:first.qrToken});assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.data.record.sessionId,first.id);assert.equal(result.body.data.record.status,'HADIR');const [[count]]=await pool.query('SELECT COUNT(*) n FROM attendance_records WHERE session_id=?',[first.id]);assert.equal(count.n,1);assert.equal((await nonRosterStudent.request('/attendance/scan','POST',{token:first.qrToken})).status,403);});
  await t.test('manual open correction commits and remains visible in fresh snapshot',async()=>{assert.equal((await other.request('/attendance-sessions/'+first.id+'/records/batch','POST',{updates:[{studentNim:'0001',status:'IZIN',reason:'Unauthorized correction'}]})).status,403);const result=await lecturer.request('/attendance-sessions/'+first.id+'/records/batch','POST',{updates:[{studentNim:'0001',status:'IZIN',reason:'Synthetic corrected status'}]});assert.equal(result.status,200);const snapshot=(await lecturer.request('/reports/snapshot')).body.data;assert.equal(snapshot.records.find(r=>r.sessionId===first.id).status,'IZIN');});
  await t.test('close preserves records, closed meeting rejects another date, next meeting starts',async()=>{assert.equal((await lecturer.request('/attendance-sessions/'+first.id+'/close','POST',{})).status,200);const duplicate=await lecturer.request('/attendance-sessions','POST',{...base,date:'2099-01-02'});assert.equal(duplicate.status,409);assert.equal(duplicate.body.error.code,'SESSION_MEETING_COMPLETED');const result=await lecturer.request('/attendance-sessions','POST',{...base,meetingNumber:2});assert.equal(result.status,201);second=result.body.data;assert.notEqual(second.id,first.id);assert.equal((await pool.query('SELECT COUNT(*) n FROM attendance_records WHERE session_id=?',[second.id]))[0][0].n,0);});
  await t.test('closed manual correction does not reopen or mix attendance',async()=>{assert.equal((await lecturer.request('/attendance-sessions/'+first.id+'/records/batch','POST',{updates:[{studentNim:'0001',status:'SAKIT',reason:'Synthetic closed correction'}]})).status,200);const history=(await lecturer.request('/attendance-sessions/'+first.id+'/history')).body.data;assert.equal(history.session.isOpen,false);assert.equal(history.records[0].status,'SAKIT');assert.equal((await lecturer.request('/attendance-sessions/'+second.id+'/history')).body.data.records.length,0);assert(history.auditTrail.some(a=>a.method==='MANUAL'));});
  await t.test('reset permits a clean new ID and keeps original records and invalidates QR',async()=>{assert.equal((await admin.request('/attendance-sessions/'+first.id+'/reset','POST',{})).status,200);const result=await lecturer.request('/attendance-sessions','POST',base);assert.equal(result.status,201);replacement=result.body.data;assert.notEqual(replacement.id,first.id);assert.notEqual(replacement.qrToken,first.qrToken);assert.equal((await lecturer.request('/attendance-sessions/'+replacement.id+'/history')).body.data.records.length,0);assert.equal((await admin.request('/attendance-sessions/'+first.id+'/history')).body.data.records.length,1);assert.notEqual((await student.request('/attendance/scan','POST',{token:first.qrToken})).status,200);});
  await t.test('soft delete permits another clean ID without deleting the archived execution',async()=>{assert.equal((await lecturer.request('/attendance-sessions/'+replacement.id+'/close','POST',{})).status,200);assert.equal((await admin.request('/attendance-sessions/'+replacement.id,'DELETE',{})).status,200);const result=await lecturer.request('/attendance-sessions','POST',base);assert.equal(result.status,201);assert.notEqual(result.body.data.id,replacement.id);assert.equal((await pool.query('SELECT COUNT(*) n FROM attendance_sessions WHERE id IN (?,?)',[first.id,replacement.id]))[0][0].n,2);});
  await t.test('past, current, future and off-schedule teaching dates preserve selected times',async()=>{
    const cases=[{date:'2020-01-01',startTime:'09:00',endTime:'11:30'}, {...base,startTime:'00:01',endTime:'00:02'}, {date:'2099-01-01',startTime:'21:00',endTime:'22:00'}, {date:'2020-01-02',startTime:'03:00',endTime:'04:00'}];
    for(const [index,value] of cases.entries()){
      const result=await lecturer.request('/attendance-sessions','POST',{...base,...value,meetingNumber:index+8});
      assert.equal(result.status,201,JSON.stringify(result.body));
      const session=result.body.data;
      assert.equal(session.date,value.date);assert.equal(session.startTime,value.startTime);assert.equal(session.endTime,value.endTime);
      assert(new Date(session.qrExpiresAt).getTime()>Date.now());
      assert(new Date(session.qrExpiresAt).getTime()<=Date.now()+30000);
      assert(Math.abs(new Date(session.createdAt).getTime()-Date.now())<2000);
      const [[audit]]=await pool.query("SELECT created_at FROM audit_logs WHERE entity_id=? AND action='SESSION_CREATED'",[session.id]);
      assert(Math.abs(new Date(audit.created_at).getTime()-Date.now())<2000);
    }
  });
  await t.test('backdated active sessions survive scheduler, scan and rotate using actual event time',async()=>{
    const session=(await lecturer.request('/attendance-sessions','POST',{...base,date:'2020-02-03',startTime:'09:00',endTime:'11:30',meetingNumber:12})).body.data;
    assert.equal(await expireSessions(pool),0);
    assert.equal((await pool.query('SELECT is_open FROM attendance_sessions WHERE id=?',[session.id]))[0][0].is_open,1);
    const result=await student.request('/attendance/scan','POST',{token:session.qrToken});
    assert.equal(result.status,200,JSON.stringify(result.body));
    assert(Math.abs(new Date(result.body.data.record.scannedAt).getTime()-Date.now())<5000);
    const [[audit]]=await pool.query('SELECT created_at FROM attendance_record_audit WHERE attendance_record_id=?',[result.body.data.record.id]);
    assert(Math.abs(new Date(audit.created_at).getTime()-Date.now())<2000);
    const rotated=await lecturer.request('/attendance-sessions/'+session.id+'/rotate-qr','POST',{});
    assert.equal(rotated.status,200);assert.notEqual(rotated.body.data.qrToken,session.qrToken);
    assert(new Date(rotated.body.data.qrExpiresAt).getTime()>Date.now());
    assert.notEqual((await student.request('/attendance/scan','POST',{token:session.qrToken})).status,200);
    assert.equal((await student.request('/attendance/scan','POST',{token:rotated.body.data.qrToken})).status,200);
    await pool.execute('UPDATE attendance_sessions SET qr_expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?',[session.id]);
    const expired=await student.request('/attendance/scan','POST',{token:rotated.body.data.qrToken});assert.equal(expired.status,409);assert.equal(expired.body.error.code,'QR_INVALID_OR_EXPIRED');
  });
  await t.test('future lecture accepts present QR while closed and archived tokens remain invalid',async()=>{
    const session=(await lecturer.request('/attendance-sessions','POST',{...base,date:'2099-01-01',meetingNumber:13,isDynamicQr:false})).body.data;
    assert(new Date(session.qrExpiresAt).getTime()>Date.now()+5300000);
    assert.equal((await student.request('/attendance/scan','POST',{token:session.qrToken})).status,200);
    assert.equal((await lecturer.request('/attendance-sessions/'+session.id+'/close','POST',{})).status,200);
    assert.equal((await student.request('/attendance/scan','POST',{token:session.qrToken})).status,409);
    assert.equal((await lecturer.request('/attendance-sessions/'+session.id+'/rotate-qr','POST',{})).status,409);
  });
  await t.test('invalid date and time ranges fail without mutating schedule metadata',async()=>{
    const [[before]]=await pool.query('SELECT meeting_dates FROM schedules WHERE id=?',[base.scheduleId]);
    for(const invalid of [{date:'2020-02-30'},{startTime:''},{endTime:null},{startTime:'25:00'},{startTime:'11:30',endTime:'09:00'},{startTime:'11:30',endTime:'11:30'}]){
      assert.equal((await lecturer.request('/attendance-sessions','POST',{...base,...invalid,meetingNumber:14})).status,422);
    }
    assert.deepEqual((await pool.query('SELECT meeting_dates FROM schedules WHERE id=?',[base.scheduleId]))[0][0],before);
  });
  await t.test('effective report snapshot excludes archives and historical records are unchanged',async()=>{const snapshot=(await lecturer.request('/reports/snapshot')).body.data;assert(!snapshot.sessions.some(s=>s.id===first.id||s.id===replacement.id));assert(!snapshot.records.some(r=>r.sessionId===first.id));assert.deepEqual((await pool.query("SELECT * FROM attendance_records WHERE session_id LIKE 'history-%' ORDER BY id"))[0],historical);});
});

