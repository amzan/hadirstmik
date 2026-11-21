import { provisionDemo, demoIds as d } from '../../backend/provision-demo.mjs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { hashPassword } from '../../backend/security.mjs';
import { prepareImport, applyImport, databaseImportReport } from '../../backend/importer.mjs';
import { historicalAttendanceFixture } from '../fixtures.mjs';
import { backupData } from '../../backend/admin.mjs';

const enabled = process.env.HADIR_TEST_DB === '1';
const origin = 'http://127.0.0.1', password = 'Synthetic-history-password-12345';
let root, pool, server, database, url, source;

async function client(identifier, role, loginPassword=password, demo=false) {
  const jar = new Map(); let csrf = '';
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`${url}/api/v1${path}`, {
      method,
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), 'X-CSRF-Token': csrf, ...(demo?{'X-Hadir-Demo':'1'}:{}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'), at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return { status: response.status, body: await response.json() };
  };
  csrf = (await request('/auth/csrf')).body.data.csrfToken;
  assert.equal((await request('/auth/login', 'POST', { identifier, role, password:loginPassword })).status, 200);
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

async function regularDigest() {
  const data = {};
  for (const table of ['users','students','courses','schedules','rombels','attendance_sessions','attendance_records']) data[table]=(await pool.query(`SELECT * FROM ${table} WHERE is_demo=0 ORDER BY 1`))[0];
  for(const [table,parent,key] of [['user_credentials','users','user_id'],['student_rombels','students','student_nim'],['session_roster','students','student_nim'],['student_schedule_overrides','students','student_nim'],['rombel_schedules','rombels','rombel_id']]) data[table]=(await pool.query(`SELECT t.* FROM ${table} t JOIN ${parent} p ON p.${parent==='students'?'nim':'id'}=t.${key} WHERE p.is_demo=0 ORDER BY 1,2`))[0];
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

test('isolated demo provisioning, existing login, cross-scope authorization and academic flows', {skip:!enabled}, async t=>{
  await client('lecturer-test','dosen');
  const before=await regularDigest();
  await t.test('conflicting real identifier prevents every provisioning write',async()=>{
    await pool.execute("INSERT INTO users (id,username,name,email,role) VALUES ('conflict',?,'Synthetic conflict','conflict@example.test','dosen')",[d.nidn]);
    await assert.rejects(provisionDemo(pool,'p@ss123'),error=>error.code==='DEMO_IDENTITY_CONFLICT');
    assert.equal((await pool.query('SELECT COUNT(*) n FROM users WHERE is_demo=1'))[0][0].n,0);
    await pool.execute("DELETE FROM users WHERE id='conflict'");
  });
  await t.test('provisioning creates only isolated entities and is idempotent without password resets',async()=>{
    assert.equal((await provisionDemo(pool,'p@ss123')).created,true);
    const credentials=JSON.stringify((await pool.query('SELECT * FROM user_credentials WHERE user_id IN (?,?) ORDER BY user_id',[d.lecturer,d.student]))[0]);
    assert.equal((await provisionDemo(pool,'Different-synthetic-123')).created,false);
    assert.equal(JSON.stringify((await pool.query('SELECT * FROM user_credentials WHERE user_id IN (?,?) ORDER BY user_id',[d.lecturer,d.student]))[0]),credentials);
    assert.equal(await regularDigest(),before);
  });
  const alex=await client(d.nidn,'dosen','p@ss123'),udin=await client(d.nim,'mahasiswa','p@ss123'),realLecturer=await client('lecturer-test','dosen'),realStudent=await client('0001','mahasiswa'),admin=await client('admin-test','admin'),demoAdmin=await client('admin-test','admin',password,true);
  let session;
  await t.test('normal and demo lists, recipients and reports never cross scopes',async()=>{
    for(const c of [alex,udin]){
      const me=(await c.request('/auth/me')).body.data;assert.equal(me.isDemo,true);assert.equal(me.mustChangePassword,false);
      assert.deepEqual((await c.request('/courses')).body.data.map(row=>row.id),[d.course]);
      assert.deepEqual((await c.request('/schedules')).body.data.map(row=>row.id),[d.schedule]);
      assert.deepEqual((await c.request('/students')).body.data.map(row=>row.nim),[d.nim]);
      const snapshot=await c.request('/reports/snapshot');assert.equal(snapshot.status,200);assert(snapshot.body.data.courses.every(row=>row.isDemo));
    }
    for(const c of [realLecturer,realStudent,admin])for(const entity of ['users','students','courses','schedules','rombels','attendance-sessions','attendance-records']){const result=await c.request('/'+entity);assert.equal(result.status,200);assert(result.body.data.every(row=>!row.isDemo));}
    assert.deepEqual((await demoAdmin.request('/users')).body.data.map(row=>row.id).sort(),[d.lecturer,d.student].sort());
    assert.equal((await alex.request('/admin/accounts')).status,403);
    assert.equal((await demoAdmin.request('/admin/snapshots')).status,403);
  });
  await t.test('demo lecturer creates own isolated session and only Udin enters its roster',async()=>{
    const created=await alex.request('/attendance-sessions','POST',{scheduleId:d.schedule,date:'2026-11-21',meetingNumber:1,startTime:'10:00',endTime:'11:00',topic:'Synthetic demo meeting'});assert.equal(created.status,201);session=created.body.data;assert.equal(session.isDemo,true);
    assert.deepEqual((await pool.query('SELECT student_nim FROM session_roster WHERE session_id=?',[session.id]))[0].map(row=>row.student_nim),[d.nim]);
    assert.equal((await alex.request('/attendance-sessions','POST',{scheduleId:'schedule-test',date:'2026-11-21',meetingNumber:7,topic:'Forbidden'})).status,404);
    assert.equal((await realLecturer.request('/attendance-sessions/'+session.id+'/history')).status,404);
    assert.equal((await admin.request('/attendance-sessions/'+session.id+'/history')).status,404);
  });
  await t.test('demo QR/manual attendance work while foreign sessions, students and recipients are rejected',async()=>{
    assert.equal((await realStudent.request('/attendance/scan','POST',{token:session.qrToken})).status,404);
    assert.equal((await udin.request('/attendance/scan','POST',{token:session.qrToken})).status,200);
    const history=(await alex.request('/attendance-sessions/'+session.id+'/history')).body.data;
    const changed=await alex.request('/attendance-sessions/'+session.id+'/records/batch','POST',{version:history.session.version,updates:[{studentNim:d.nim,status:'IZIN',reason:'Synthetic demo manual',version:history.records[0].version}]});assert.equal(changed.status,200);
    const fresh=(await alex.request('/attendance-sessions/'+session.id+'/history')).body.data;
    assert.equal((await alex.request('/attendance-sessions/'+session.id+'/records/batch','POST',{version:fresh.session.version,updates:[{studentNim:'0001',status:'HADIR',reason:'Forbidden',version:0}]})).status,403);
    assert.equal((await udin.request('/leave-requests','POST',{date:'2026-11-21',type:'IZIN',reason:'Synthetic',recipientIds:['lecturer-test']})).status,422);
    assert.equal((await alex.request('/auth/email-verification/request','POST',{})).status,403);
  });
  await t.test('demo admin manages only demo accounts and session lifecycle; regular identity cannot be changed',async()=>{
    const me=(await demoAdmin.request('/users')).body.data.find(row=>row.id===d.lecturer);
    assert.equal((await demoAdmin.request('/users/'+d.lecturer,'PATCH',{version:me.version,name:'Alex'})).status,200);
    assert.equal((await demoAdmin.request('/users/lecturer-test','PATCH',{version:1,name:'Forbidden'})).status,404);
    assert.equal((await demoAdmin.request('/admin/accounts/'+d.lecturer+'/email','PATCH',{email:'alex.new@example.invalid'})).status,200);
    assert.equal((await admin.request('/admin/accounts/'+d.lecturer+'/email','PATCH',{email:'forbidden@example.invalid'})).status,404);
    assert.equal((await alex.request('/attendance-sessions/'+session.id+'/close','POST',{})).status,200);
    assert.equal((await demoAdmin.request('/attendance-sessions/'+session.id+'/reopen','POST',{})).status,200);
  });
  await t.test('demo report snapshot contains only demo and regular academic state and passwords remain identical',async()=>{
    const demo=(await demoAdmin.request('/reports/snapshot')).body.data,regular=(await admin.request('/reports/snapshot')).body.data;
    assert.equal(demo.sessions.length,1);assert.equal(demo.records.length,1);assert(demo.sessions.every(row=>row.isDemo));
    assert(!regular.sessions.some(row=>row.id===session.id));assert(!regular.records.some(row=>row.studentNim===d.nim));
    assert.equal(await regularDigest(),before);
    await migrate(pool);assert.equal((await provisionDemo(pool,'Not-a-reset-123')).created,false);assert.equal(await regularDigest(),before);
  });
  await t.test('regular imports cannot target existing demo IDs even when their demo flag is omitted',async()=>{
    const preview=prepareImport({users:[{id:d.lecturer,username:d.nidn,name:'Alex',email:'alex.new@example.invalid',role:'dosen',nidn:d.nidn}]});
    assert.equal(preview.valid,true);
    assert((await databaseImportReport(pool,preview)).issues.some(issue=>issue.code==='DEMO_IMPORT_FORBIDDEN'));
    await assert.rejects(applyImport(pool,preview),error=>error.code==='DEMO_IMPORT_FORBIDDEN');
    assert.equal(await regularDigest(),before);
  });
});


