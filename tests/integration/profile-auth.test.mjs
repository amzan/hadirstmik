import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { hashPassword, verifyPassword } from '../../backend/security.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { fixture } from '../fixtures.mjs';

const enabled = process.env.HADIR_TEST_DB === '1', options = { skip: !enabled };
const origin = 'http://127.0.0.1', original = 'Synthetic-original-password-12345';
let root, pool, server, database, url, academicBefore;
const sentOtp = [];
async function client() {
  const jar = new Map(); let csrf = '';
  const request = async (path, method = 'GET', body, headers = {}) => {
    const response = await fetch(url + '/api/v1' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), 'X-CSRF-Token': csrf, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'), at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  csrf = (await request('/auth/csrf')).body.data.csrfToken;
  return { request };
}
async function login(identifier, role, password = original) {
  const session = await client(); const result = await session.request('/auth/login', 'POST', { identifier, role, password });
  assert.equal(result.status, 200, JSON.stringify(result.body)); return session;
}
async function profile(session, id, changes, headers) {
  const [[user]] = await pool.execute('SELECT version FROM users WHERE id=?', [id]);
  return session.request(`/users/${id}`, 'PATCH', { version: user.version, ...changes }, headers);
}
async function academicDigest() {
  const snapshot = {};
  for (const table of ['courses', 'schedules', 'rombels', 'student_rombels', 'rombel_schedules', 'attendance_sessions', 'session_roster', 'attendance_records']) snapshot[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY 1`))[0];
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
before(async () => {
  if (!enabled) return;
  assert.equal(process.env.HADIR_TEST_HOST || '127.0.0.1', '127.0.0.1');
  database = `hadir_profile_${randomBytes(5).toString('hex')}_test`;
  root = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
  await root.query(`CREATE DATABASE ${database}`);
  pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 8 });
  await migrate(pool); await migrate(pool);
  const source = fixture(); source.users.find(user => user.id === 'lecturer-test').name = 'Dr. Ahmad Synthetic'; source.users.find(user => user.id === 'other-lecturer').name = 'Prof. Drs. Ahmad Other';
  await applyImport(pool, prepareImport(source));
  const hash = await hashPassword(original);
  for (const user of source.users) await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', [user.id, hash]);
  academicBefore = await academicDigest();
  server = createApp({ pool, origin, secret: 'Synthetic-profile-secret-more-than-32-characters', sendOtp: async (...args) => sentOtp.push(args) }).listen(0, '127.0.0.1');
  await once(server, 'listening'); url = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => { if (pool) await pool.execute('DELETE FROM auth_limits'); });
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await pool?.end();
  if (root && /^hadir_profile_[a-f0-9]+_test$/.test(database)) { await root.query(`DROP DATABASE ${database}`); await root.end(); }
});

test('self profile without OTP allows personal fields, protects identity and rejects other users or forged CSRF', options, async () => {
  const student = await login('0001', 'mahasiswa'), lecturer = await login('lecturer-test', 'dosen');
  for (const [session, id, name] of [[student, 'student-test', 'Student Renamed'], [lecturer, 'lecturer-test', 'Dr. Lecturer Renamed']]) {
    assert.equal((await profile(session, id, { name, phone: '0800000000' })).status, 200);
    for (const changes of [{ role: 'admin' }, { username: 'someone-else' }, { nidn: 'forged' }, { prodi: 'Manajemen Informatika' }, { academicRank: 'Professor' }, { loginAlias: 'forged' }]) assert.equal((await profile(session, id, changes)).status, 403);
    assert.equal((await profile(session, id, { phone: '0800000001' }, { 'X-CSRF-Token': 'forged' })).status, 403);
  }
  assert.equal((await profile(student, 'student-other', { name: 'Forged Owner' })).status, 403);
  assert.equal((await profile(lecturer, 'student-test', { name: 'Forged Owner' })).status, 403);
  const [[row]] = await pool.execute('SELECT name,phone FROM students WHERE nim=?', ['0001']); assert.equal(row.name, 'Student Renamed'); assert.equal(row.phone, '0800000000');
  assert.equal(sentOtp.length, 0);
});

test('self email requires correct password, rejects duplicates and synchronizes unverified student email transactionally', options, async () => {
  const student = await login('0001', 'mahasiswa');
  await pool.execute('UPDATE users SET email_verified_at=UTC_TIMESTAMP() WHERE id=?', ['student-test']);
  assert.equal((await profile(student, 'student-test', { email: 'changed@example.test' })).status, 401);
  assert.equal((await profile(student, 'student-test', { email: 'changed@example.test', currentPassword: 'incorrect' })).status, 401);
  assert.equal((await profile(student, 'student-test', { email: 'invalid', currentPassword: original })).status, 422);
  assert.equal((await profile(student, 'student-test', { email: 'LECTURER@EXAMPLE.TEST', currentPassword: original })).status, 409);
  assert.equal((await profile(student, 'student-test', { email: 'Changed@example.test', currentPassword: original })).status, 200);
  const [[row]] = await pool.execute('SELECT u.email,u.email_verified_at,s.email AS student_email FROM users u JOIN students s ON s.user_id=u.id WHERE u.id=?', ['student-test']);
  assert.equal(row.email, 'changed@example.test'); assert.equal(row.student_email, row.email); assert.equal(row.email_verified_at, null);
  assert.equal(sentOtp.length, 0);
  const [[audit]] = await pool.execute("SELECT COUNT(*) AS total FROM audit_logs WHERE action='ACCOUNT_EMAIL_CHANGED' AND entity_id='student-test'"); assert.equal(audit.total, 1);
});

test('persisted lecturer aliases disambiguate titled names, ignore case and survive display rename without crossing accounts', options, async () => {
  await login('lecturer-test', 'dosen');
  const [lecturers] = await pool.query("SELECT id,login_alias FROM users WHERE role='dosen' ORDER BY id");
  assert.equal(new Set(lecturers.map(row => row.login_alias)).size, 2); assert.deepEqual(lecturers.map(row => row.login_alias).sort(), ['ahmad', 'ahmad2']);
  for (const lecturer of lecturers) {
    const session = await login(lecturer.login_alias.toUpperCase(), 'dosen'); assert.equal((await session.request('/auth/me')).body.data.id, lecturer.id);
    assert.equal((await profile(session, lecturer.id, { name: 'Completely Different Display' })).status, 200);
    const again = await login(lecturer.login_alias, 'dosen'); assert.equal((await again.request('/auth/me')).body.data.id, lecturer.id);
  }
  const [after] = await pool.query("SELECT id,login_alias FROM users WHERE role='dosen' ORDER BY id"); assert.deepEqual(after, lecturers);
  const admin = await login('admin-test', 'admin'); const list = await admin.request('/admin/accounts');
  assert(lecturers.every(lecturer => list.body.data.find(row => row.id === lecturer.id).loginAlias === lecturer.login_alias));
  assert.equal((await (await login('0001', 'mahasiswa')).request('/auth/me')).body.data.id, 'student-test');
});

test('self password rejects wrong old password, weak values, cross-account fields and CSRF; succeeds without OTP and revokes every old session', options, async () => {
  const student = await login('0001', 'mahasiswa'), otherSession = await login('0001', 'mahasiswa');
  const change = body => student.request('/auth/password/change', 'POST', body);
  assert.equal((await change({ currentPassword: 'incorrect', newPassword: 'N7k!pR', confirmPassword: 'N7k!pR' })).status, 401);
  for (const newPassword of ['N7k!p', '123456', 'abcdef', 'password']) assert.equal((await change({ currentPassword: original, newPassword, confirmPassword: newPassword })).status, 422);
  await pool.execute('DELETE FROM auth_limits');
  assert.equal((await change({ currentPassword: original, newPassword: 'N7k!pR', confirmPassword: 'Mismatch' })).status, 422);
  assert.equal((await change({ userId: 'student-other', currentPassword: original, newPassword: 'N7k!pR', confirmPassword: 'N7k!pR' })).status, 403);
  assert.equal((await student.request('/auth/password/change', 'POST', { currentPassword: original, newPassword: 'N7k!pR', confirmPassword: 'N7k!pR' }, { 'X-CSRF-Token': 'forged' })).status, 403);
  const changed = await change({ currentPassword: original, newPassword: 'N7k!pR', confirmPassword: 'N7k!pR' }); assert.equal(changed.status, 200);
  for (const session of [student, otherSession]) assert.equal((await session.request('/auth/me')).status, 401);
  assert.equal((await (await login('0001', 'mahasiswa', 'N7k!pR')).request('/auth/me')).body.data.id, 'student-test');
  const [[row]] = await pool.execute('SELECT password_hash FROM user_credentials WHERE user_id=?', ['student-test']); assert(await verifyPassword('N7k!pR', row.password_hash));
  assert.equal(sentOtp.length, 0);
  const [[other]] = await pool.execute('SELECT password_hash FROM user_credentials WHERE user_id=?', ['student-other']); assert(await verifyPassword(original, other.password_hash));
});

test('login throttles one account and also rotating identifiers from the same IP', options, async () => {
  const guest = await client();
  for (let attempt = 0; attempt < 10; attempt++) assert.equal((await guest.request('/auth/login', 'POST', { identifier: 'missing', role: 'dosen', password: 'incorrect' })).status, 401);
  assert.equal((await guest.request('/auth/login', 'POST', { identifier: 'missing', role: 'dosen', password: 'incorrect' })).status, 429);
  await pool.execute('DELETE FROM auth_limits');
  for (let attempt = 0; attempt < 30; attempt++) assert.equal((await guest.request('/auth/login', 'POST', { identifier: `missing-${attempt}`, role: 'dosen', password: 'incorrect' })).status, 401);
  assert.equal((await guest.request('/auth/login', 'POST', { identifier: 'missing-another', role: 'dosen', password: 'incorrect' })).status, 429);
});

test('profile and authentication changes preserve account count and all academic state without recording passwords', options, async () => {
  assert.equal((await pool.query('SELECT COUNT(*) AS total FROM users'))[0][0].total, 5);
  assert.equal(await academicDigest(), academicBefore);
  const audit = JSON.stringify((await pool.query('SELECT * FROM audit_logs'))[0]); assert(!audit.includes(original)); assert(!audit.includes('N7k!pR'));
});
