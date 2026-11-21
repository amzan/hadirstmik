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

test('leave recipient validation and visibility never create attendance', {skip:!enabled},async()=>{
  const student=await client('0001','mahasiswa'),lecturer=await client('lecturer-test','dosen'),other=await client('other-lecturer','dosen'),admin=await client('admin-test','admin');
  const original=(await pool.query('SELECT * FROM attendance_records ORDER BY id'))[0];
  const payload={type:'IZIN',date:'2026-11-21',reason:'Synthetic leave request',recipientIds:['lecturer-test']};
  assert.equal((await student.request('/leave-requests','POST',{...payload,recipientIds:[]})).status,422);
  assert.equal((await student.request('/leave-requests','POST',{...payload,recipientIds:['lecturer-test','lecturer-test']})).body.error.code,'LEAVE_RECIPIENT_DUPLICATE');
  assert.equal((await student.request('/leave-requests','POST',{...payload,recipientIds:['admin-test']})).body.error.code,'RECIPIENT_INVALID');
  await pool.query("UPDATE users SET is_active=0 WHERE id='other-lecturer'");
  assert.equal((await student.request('/leave-requests','POST',{...payload,recipientIds:['other-lecturer']})).body.error.code,'RECIPIENT_INVALID');
  await pool.query("UPDATE users SET is_active=1 WHERE id='other-lecturer'");
  const single=await student.request('/leave-requests','POST',payload);assert.equal(single.status,201);
  assert((await lecturer.request('/leave-requests')).body.data.some(item=>item.id===single.body.data.id));
  assert(!(await other.request('/leave-requests')).body.data.some(item=>item.id===single.body.data.id));
  assert.equal((await other.request('/leave-requests/'+single.body.data.id+'/review','POST',{decision:'APPROVED'})).status,403);
  const multi=await student.request('/leave-requests','POST',{...payload,type:'SAKIT',recipientIds:['lecturer-test','other-lecturer']});assert.equal(multi.status,201);
  for(const actor of [lecturer,other,admin])assert((await actor.request('/leave-requests')).body.data.some(item=>item.id===multi.body.data.id));
  assert.equal((await lecturer.request('/leave-requests/'+multi.body.data.id+'/review','POST',{decision:'APPROVED'})).status,200);
  assert.deepEqual((await pool.query('SELECT * FROM attendance_records ORDER BY id'))[0],original);
});

test('server policy recalculates tolerances by confirmed academic period without rewriting raw attendance', {skip:!enabled},async()=>{
  const lecturer=await client('lecturer-test','dosen'),student=await client('0001','mahasiswa');
  for(const [index,status]of [[1,'IZIN'],[2,'IZIN'],[3,'IZIN'],[4,'SAKIT'],[5,'SAKIT']])assert.equal((await lecturer.request('/attendance-sessions/history-session-'+index+'/records/batch','POST',{updates:[{studentNim:'0001',status,reason:'Synthetic policy verification'}]})).status,200);
  const raw=(await pool.query('SELECT id,status FROM attendance_records ORDER BY id'))[0];
  let snapshot=(await student.request('/reports/snapshot')).body.data;
  const policy=snapshot.attendancePolicy['0001'];assert.equal(policy.izinAsHadir,2);assert.equal(policy.sakitAsHadir,2);assert.equal(policy.excessIzin,1);assert.equal(policy.hadir,4);assert.equal(policy.totalSessions,6);assert.equal(policy.percentage,67);
  await pool.query("UPDATE attendance_sessions SET academic_period='Previous synthetic period' WHERE id='history-session-1'");
  snapshot=(await lecturer.request('/reports/snapshot')).body.data;
  assert.equal(snapshot.attendancePolicy['0001'].totalSessions,5);assert.equal(snapshot.attendancePolicy['0001'].excessIzin,0);
  const changed=await lecturer.request('/attendance-sessions/history-session-3/records/batch','POST',{updates:[{studentNim:'0001',status:'HADIR',reason:'Synthetic corrected attendance'}]});assert.equal(changed.status,200);
  snapshot=(await lecturer.request('/reports/snapshot')).body.data;assert.equal(snapshot.attendancePolicy['0001'].rawHadir,1);
  const after=(await pool.query('SELECT id,status FROM attendance_records ORDER BY id'))[0];assert.equal(after.length,raw.length);assert.equal(after.filter((row,index)=>row.status!==raw[index].status).length,1);
});

