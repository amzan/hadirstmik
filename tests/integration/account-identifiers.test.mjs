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


test('admin identity corrections preserve account and academic relationships', {skip:!enabled},async t=>{
  const admin=await client('admin-test','admin'),student=await client('0001','mahasiswa'),lecturer=await client('lecturer-test','dosen');
  const beforeRecords=(await pool.query('SELECT * FROM attendance_records ORDER BY id'))[0];
  const beforeSessions=(await pool.query('SELECT * FROM attendance_sessions ORDER BY id'))[0];
  const beforeCredentials=(await pool.query('SELECT * FROM user_credentials ORDER BY user_id'))[0];
  const beforeSchedules=(await pool.query('SELECT * FROM schedules ORDER BY id'))[0];
  async function edit(id,body){const [row]=(await pool.query('SELECT version FROM users WHERE id=?',[id]))[0];return admin.request('/users/'+id,'PATCH',{version:row.version,...body});}
    async function deniedLogin(identifier,role){
    const csrfResponse=await fetch(url+'/api/v1/auth/csrf',{headers:{Origin:origin}}),csrfData=await csrfResponse.json();
    const cookie=csrfResponse.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
    return fetch(url+'/api/v1/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrfData.data.csrfToken},body:JSON.stringify({identifier,role,password})});
  }
  let response;
  await t.test('admin changes NIM and username automatically with stable user ID',async()=>{
    response=await edit('student-test',{username:' 0099 '});assert.equal(response.status,200,JSON.stringify(response.body));
    assert.equal(response.body.data.username,'0099');assert.equal(response.body.data.id,'student-test');
    assert.equal((await pool.query("SELECT nim FROM students WHERE user_id='student-test'"))[0][0].nim,'0099');
  });
  await t.test('old password works with new student login while old NIM fails',async()=>{
    await client('0099','mahasiswa');const old=await deniedLogin('0001','mahasiswa');assert.equal(old.status,401);
  });
  await t.test('student references cascade without rewriting status or session ownership',async()=>{
    assert.deepEqual((await pool.query('SELECT * FROM attendance_records ORDER BY id'))[0].map(r=>({...r,student_nim:r.student_nim==='0099'?'0001':r.student_nim})),beforeRecords);
    assert.deepEqual((await pool.query('SELECT * FROM attendance_sessions ORDER BY id'))[0],beforeSessions);
    for(const table of ['session_roster','student_rombels'])assert((await pool.query(`SELECT * FROM ${table} WHERE student_nim='0099'`))[0].length);
  });
  await t.test('duplicate student identifier rejects entire transaction with exact message',async()=>{
    const before=await academicDigest();response=await edit('student-test',{username:'0002',name:'Must roll back'});assert.equal(response.status,409);assert.equal(response.body.error.message,'data yang dimasukan sudah ada');assert.equal(await academicDigest(),before);
  });
  await t.test('admin changes NIDN and username together',async()=>{
    await pool.query("UPDATE users SET nidn='7711',login_alias='7711' WHERE id='lecturer-test'");
    response=await edit('lecturer-test',{nidn:' 990011 '});assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.data.username,'990011');assert.equal(response.body.data.nidn,'990011');assert.equal(response.body.data.id,'lecturer-test');
  });
  await t.test('lecturer new NIDN login preserves old password and rejects former username',async()=>{
    await client('990011','dosen');assert.equal((await deniedLogin('lecturer-test','dosen')).status,401);
    assert.equal((await deniedLogin('7711','dosen')).status,401);
  });
  await t.test('duplicate NIDN cross-account rejects with 409',async()=>{
    response=await edit('other-lecturer',{nidn:'990011'});assert.equal(response.status,409);assert.equal(response.body.error.message,'data yang dimasukan sudah ada');
  });
  await t.test('own identifier unchanged is accepted and similar identifiers remain distinct',async()=>{
    assert.equal((await edit('lecturer-test',{nidn:'990011'})).status,200);
    assert.equal((await edit('other-lecturer',{nidn:'9900110'})).status,200);
  });
  await t.test('simultaneous admins cannot allocate same identifier',async()=>{
    const [a,b]=await Promise.all([edit('student-test',{username:'0088'}),edit('student-other',{username:'0088'})]);assert.deepEqual([a.status,b.status].sort(),[200,409]);assert.equal((await pool.query("SELECT COUNT(*) n FROM users WHERE username='0088'"))[0][0].n,1);
  });
  await t.test('inactive identifiers also remain reserved',async()=>{
    await pool.query("UPDATE users SET is_active=0 WHERE id='other-lecturer'");response=await edit('lecturer-test',{nidn:'9900110'});assert.equal(response.status,409);
  });
  await t.test('admin changes email without OTP or edited user password atomically',async()=>{
    response=await edit('student-test',{email:'Updated@example.test'});assert.equal(response.status,200,JSON.stringify(response.body));
    const [u]=(await pool.query("SELECT email,email_verified_at FROM users WHERE id='student-test'"))[0], [s]=(await pool.query("SELECT email FROM students WHERE user_id='student-test'"))[0];assert.equal(u.email,'updated@example.test');assert.equal(s.email,u.email);assert.equal(u.email_verified_at,null);
  });
  await t.test('duplicate email rolls back and cannot change username',async()=>{
    const [old]=(await pool.query("SELECT username FROM users WHERE id='student-test'"))[0];response=await edit('student-test',{email:'student-other@example.test'});assert.equal(response.status,409);assert.equal(response.body.error.code,'EMAIL_IN_USE');assert.equal((await pool.query("SELECT username FROM users WHERE id='student-test'"))[0][0].username,old.username);
  });
  await t.test('nonadmins cannot edit other account identity',async()=>{
    assert.equal((await lecturer.request('/users/student-other','PATCH',{version:1,username:'steal'})).status,403);
    assert.equal((await student.request('/users/lecturer-test','PATCH',{version:1,nidn:'steal'})).status,403);
  });
  await t.test('passwords, lecturer relationships and private audit survive',async()=>{
    assert.deepEqual((await pool.query('SELECT * FROM user_credentials ORDER BY user_id'))[0],beforeCredentials);
    assert.deepEqual((await pool.query('SELECT * FROM schedules ORDER BY id'))[0],beforeSchedules);
    assert((await pool.query("SELECT change_details FROM audit_logs WHERE action='ACCOUNT_IDENTIFIER_CHANGED'"))[0].length>=3);
    assert.equal((await pool.query('SELECT COUNT(*) n FROM users'))[0][0].n,source.users.length);
    const current=await client((await pool.query("SELECT username FROM users WHERE id='student-test'"))[0][0].username,'mahasiswa');
    assert((await current.request('/attendance-records')).body.data.every(r=>r.studentNim!=='0002'));
  });
  await t.test('student editor returns saved version and invalidates stale account edit',async()=>{
    const [old]=(await pool.query("SELECT nim,version FROM students WHERE user_id='student-test'"))[0];
    const [account]=(await pool.query("SELECT version FROM users WHERE id='student-test'"))[0];
    const edited=await admin.request('/students/'+old.nim,'PATCH',{nim:'0077',version:old.version});
    assert.equal(edited.status,200,JSON.stringify(edited.body));assert.equal(edited.body.data.nim,'0077');
    const [saved]=(await pool.query("SELECT version FROM students WHERE user_id='student-test'"))[0];assert.equal(edited.body.data.version,saved.version);
    assert.equal((await admin.request('/users/student-test','PATCH',{username:old.nim,version:account.version})).body.error.code,'VERSION_CONFLICT');
  });
  await t.test('migration repeat keeps five valid cascading foreign keys',async()=>{
    await migrate(pool);
    const [keys]=await pool.query("SELECT UPDATE_RULE,DELETE_RULE,TABLE_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='students'");
    assert.equal(keys.length,5);assert(keys.every(key=>key.UPDATE_RULE==='CASCADE'));
    assert.equal(keys.find(key=>key.TABLE_NAME==='student_rombels').DELETE_RULE,'CASCADE');
    assert(keys.filter(key=>key.TABLE_NAME!=='student_rombels').every(key=>key.DELETE_RULE==='RESTRICT'));
  });
});


