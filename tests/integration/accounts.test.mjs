import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, createHash, pbkdf2Sync, createDecipheriv } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { reconcileLegacy } from '../../backend/reconciliation.mjs';
import { hashPassword, verifyPassword } from '../../backend/security.mjs';
import { archivedLeaveFixture } from '../fixtures.mjs';

const enabled = process.env.HADIR_TEST_DB === '1', options = { skip: !enabled };
const origin = 'http://127.0.0.1', adminPassword = 'Synthetic-admin-password-12345', reportPassphrase = 'Synthetic-report-passphrase-12345';
let pool, root, database, server, url, admin, initialAcademicDigest;
const codes = [];
const studentId = i => `account-synthetic-${String(i).padStart(3, '0')}`;
async function client() {
  const jar = new Map(); let csrf = '';
  const request = async (path, method = 'GET', body, headers = {}) => {
    const response = await fetch(url + '/api/v1' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    for (const value of response.headers.getSetCookie()) { const [pair] = value.split(';'), at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  csrf = (await request('/auth/csrf')).body.data.csrfToken;
  return { request };
}
async function login(identifier, role, password = adminPassword) {
  const c = await client(); assert.equal((await c.request('/auth/login', 'POST', { identifier, role, password })).status, 200); return c;
}
function activate(ids, extra = {}) {
  return admin.request('/admin/accounts/activate', 'POST', { userIds: ids, requestId: randomBytes(16).toString('hex'), adminPassword, reportPassphrase, ...extra });
}
function decrypt(report, passphrase = reportPassphrase) {
  assert.equal(report.format, 'HADIR-ACTIVATION-1'); assert.equal(report.kdf, 'PBKDF2-SHA256'); assert.equal(report.iterations, 600000);
  const key = pbkdf2Sync(passphrase, Buffer.from(report.salt, 'base64'), report.iterations, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(report.iv, 'base64')); decipher.setAuthTag(Buffer.from(report.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(report.ciphertext, 'base64')), decipher.final()]).toString()).accounts;
}
async function academicDigest() {
  const result = {};
  for (const table of ['courses', 'schedules', 'attendance_sessions', 'session_roster', 'attendance_records', 'leave_requests', 'leave_recipients', 'student_schedule_overrides']) result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY 1,2`))[0];
  return createHash('sha256').update(JSON.stringify(result)).digest('hex');
}
before(async () => {
  if (!enabled) return;
  assert.equal(process.env.HADIR_TEST_HOST || '127.0.0.1', '127.0.0.1');
  const port = Number(process.env.HADIR_TEST_PORT || 33079); assert(port >= 1024 && port <= 65535);
  database = `hadir_accounts_${randomBytes(5).toString('hex')}_test`;
  root = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
  await root.query(`CREATE DATABASE ${database}`);
  pool = mysql.createPool({ host: '127.0.0.1', port, user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, connectionLimit: 8, timezone: 'Z', dateStrings: ['DATE'] });
  await migrate(pool); await migrate(pool);
  const plan = reconcileLegacy(archivedLeaveFixture()); assert.equal(plan.report.status, 'READY');
  const preview = prepareImport(plan.data); assert(preview.valid); await applyImport(pool, preview);
  const hash = await hashPassword(adminPassword);
  for (const id of ['admin-synthetic', 'lecturer-synthetic-0', studentId(0)]) await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', [id, hash]);
  initialAcademicDigest = await academicDigest();
  server = createApp({ pool, origin, secret: 'Synthetic-accounts-secret-more-than-32-characters', sendOtp: async (email, code) => codes.push({ email, code }) }).listen(0, '127.0.0.1');
  await once(server, 'listening'); url = `http://127.0.0.1:${server.address().port}`; admin = await login('admin-synthetic', 'admin');
});
beforeEach(async () => { if (pool) await pool.execute('DELETE FROM auth_limits'); });
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await pool?.end();
  if (root && /^hadir_accounts_[a-f0-9]+_test$/.test(database)) { await root.query(`DROP DATABASE ${database}`); await root.end(); }
});

test('account management is admin-only and enforces CSRF; list exposes status without credentials', options, async () => {
  const guest = await client(), lecturer = await login('lecturer-synthetic-0', 'dosen'), student = await login('synthetic-000', 'mahasiswa');
  assert.equal((await guest.request('/admin/accounts')).status, 401);
  for (const c of [lecturer, student]) {
    assert.equal((await c.request('/admin/accounts')).status, 403);
    assert.equal((await c.request(`/admin/accounts/${studentId(1)}/email`, 'PATCH', { email: 'forged@example.test' })).status, 403);
    assert.equal((await c.request('/admin/accounts/activation-preview', 'POST', { userIds: [studentId(1)] })).status, 403);
    assert.equal((await c.request('/admin/accounts/activate', 'POST', {})).status, 403);
  }
  assert.equal((await admin.request('/admin/accounts/activation-preview', 'POST', { userIds: [studentId(1)] }, { 'X-CSRF-Token': 'forged' })).status, 403);
  assert.equal((await admin.request(`/admin/accounts/${studentId(1)}/email`, 'PATCH', { email: 'forged@example.test' }, { Origin: 'https://attacker.example.test' })).status, 403);
  const list = await admin.request('/admin/accounts'); assert.equal(list.status, 200); assert.equal(list.body.data.length, 78);
  assert.equal(list.body.data.find(a => a.id === studentId(0)).hasCredentials, true);
  assert.equal(list.body.data.find(a => a.id === studentId(1)).hasCredentials, false);
  assert(!/password_hash|temporaryPassword|session_token|token_hash/.test(JSON.stringify(list.body)));
});

test('email changes validate uniqueness, synchronize students, invalidate verification, and audit', options, async () => {
  await pool.execute('UPDATE users SET email_verified_at=UTC_TIMESTAMP() WHERE id=?', [studentId(1)]);
  assert.equal((await admin.request(`/admin/accounts/${studentId(1)}/email`, 'PATCH', { email: 'invalid' })).status, 422);
  assert.equal((await admin.request(`/admin/accounts/${studentId(1)}/email`, 'PATCH', { email: 'LECTURER-0@EXAMPLE.TEST' })).status, 409);
  const result = await admin.request(`/admin/accounts/${studentId(1)}/email`, 'PATCH', { email: 'New-Student@example.test' }); assert.equal(result.status, 200); assert.equal(result.body.data.emailVerified, false);
  const [[row]] = await pool.execute('SELECT u.email,u.email_verified_at,s.email AS student_email FROM users u JOIN students s ON s.user_id=u.id WHERE u.id=?', [studentId(1)]);
  assert.equal(row.email, 'new-student@example.test'); assert.equal(row.student_email, row.email); assert.equal(row.email_verified_at, null);
  const changed = await admin.request('/admin/accounts/lecturer-synthetic-1/email', 'PATCH', { email: 'new-lecturer@example.test' }); assert.equal(changed.status, 200);
  assert.equal((await admin.request('/admin/accounts/admin-synthetic/email', 'PATCH', { email: 'admin-new@example.test' })).status, 422);
  const [[audit]] = await pool.execute("SELECT COUNT(*) AS total FROM audit_logs WHERE action='ACCOUNT_EMAIL_CHANGED'"); assert.equal(audit.total, 2);
});

test('activation preview validates selection and exposes existing credential confirmation requirement', options, async () => {
  const preview = await admin.request('/admin/accounts/activation-preview', 'POST', { userIds: [studentId(0), studentId(1)] }); assert.equal(preview.status, 200); assert.equal(preview.body.data.count, 2); assert.equal(preview.body.data.existingCredentialCount, 1);
  for (const ids of [[], Array.from({ length: 51 }, (_, i) => studentId(i)), [studentId(1), studentId(1)], ['admin-synthetic']]) assert.equal((await admin.request('/admin/accounts/activation-preview', 'POST', { userIds: ids })).status, 422);
  assert.equal((await admin.request('/admin/accounts/activation-preview', 'POST', { userIds: ['missing-account'] })).status, 404);
  assert.equal((await activate([studentId(1)], { adminPassword: 'wrong-password' })).status, 401);
  assert.equal((await activate([studentId(0)])).status, 409);
  assert.equal((await activate([studentId(1), studentId(2)], { manualPassword: 'Manual-synthetic-password-123' })).status, 422);
  assert.equal((await activate([studentId(1)], { reportPassphrase: 'short' })).status, 422);
  const [[row]] = await pool.execute('SELECT COUNT(*) AS total FROM user_credentials WHERE user_id=?', [studentId(1)]); assert.equal(row.total, 0);
});

test('random batch reports are unique, authenticated encrypted, delivered once, and never persisted plaintext', options, async () => {
  const requestId = randomBytes(16).toString('hex'), body = { requestId, userIds: [studentId(1), studentId(2)], adminPassword, reportPassphrase };
  const result = await admin.request('/admin/accounts/activate', 'POST', body); assert.equal(result.status, 200); assert.equal(result.body.data.count, 2); assert.equal(result.headers.get('cache-control'), 'no-store');
  const report = result.body.data.report, accounts = decrypt(report); assert.equal(accounts.length, 2); assert.equal(new Set(accounts.map(a => a.temporaryPassword)).size, 2); assert(accounts.every(a => /^[A-Za-z0-9]{6}$/.test(a.temporaryPassword)));
  assert.throws(() => decrypt(report, 'Wrong-report-passphrase-12345'));
  const tampered = { ...report, ciphertext: Buffer.from('tampered').toString('base64') }; assert.throws(() => decrypt(tampered));
  for (const account of accounts) {
    assert.deepEqual(Object.keys(account).sort(), ['name', 'role', 'temporaryPassword', 'username']);
    const [[credential]] = await pool.execute('SELECT * FROM user_credentials WHERE user_id=?', [`account-${account.username}`]); assert.equal(credential.must_change_password, 1); assert(await verifyPassword(account.temporaryPassword, credential.password_hash));
    for (const table of ['user_credentials', 'account_activation_operations', 'audit_logs']) assert(!JSON.stringify((await pool.query(`SELECT * FROM ${table}`))[0]).includes(account.temporaryPassword));
    assert(!JSON.stringify((await admin.request('/admin/accounts')).body).includes(account.temporaryPassword));
  }
  const hashes = (await pool.execute('SELECT user_id,password_hash FROM user_credentials WHERE user_id IN (?,?) ORDER BY user_id', body.userIds))[0];
  const retry = await admin.request('/admin/accounts/activate', 'POST', body); assert.equal(retry.status, 409); assert.equal(retry.body.error.code, 'REPORT_ALREADY_DELIVERED'); assert(!retry.body.data);
  assert.deepEqual((await pool.execute('SELECT user_id,password_hash FROM user_credentials WHERE user_id IN (?,?) ORDER BY user_id', body.userIds))[0], hashes);
  assert.equal((await admin.request('/admin/accounts/activate', 'POST', { ...body, userIds: [studentId(3)] })).status, 409);
});

test('manual reset revokes sessions and forces initial change in backend without OTP or bypass', options, async () => {
  const old = await login('synthetic-000', 'mahasiswa'), temporary = 'N7k!pR';
  const result = await activate([studentId(0)], { manualPassword: temporary, confirmExistingCredentials: true }); assert.equal(result.status, 200); assert.equal(decrypt(result.body.data.report)[0].temporaryPassword, temporary);
  const reused = await activate([studentId(3)], { manualPassword: temporary }); assert.equal(reused.status, 409); assert.equal(reused.body.error.code, 'TEMPORARY_PASSWORD_ALREADY_USED');
  assert.equal((await old.request('/students')).status, 401);
  const temporaryClient = await login('synthetic-000', 'mahasiswa', temporary);
  const me = await temporaryClient.request('/auth/me'); assert.equal(me.body.data.mustChangePassword, true);
  for (const endpoint of ['/students', '/attendance-records', '/schedules', '/leave-requests', '/auth/device-sessions']) assert.equal((await temporaryClient.request(endpoint)).status, 403, endpoint);
  assert.equal((await temporaryClient.request('/auth/password-change/request', 'POST', {})).status, 403);
  const otp = await temporaryClient.request('/auth/password-reset/request', 'POST', { identifier: 'synthetic-000', role: 'mahasiswa' });
  if (otp.status === 202) {
    const attempted = await temporaryClient.request('/auth/password-reset/confirm', 'POST', { challengeId: otp.body.data.challengeId, code: codes.at(-1)?.code, newPassword: 'Otp-must-not-bypass-synthetic-123' });
    assert.notEqual(attempted.status, 200);
  } else assert.equal(otp.status, 403);
  const anonymous = await client();
  await pool.execute('UPDATE users SET email_verified_at=UTC_TIMESTAMP() WHERE id=?', [studentId(0)]);
  const anonymousOtp = await anonymous.request('/auth/password-reset/request', 'POST', { identifier: 'synthetic-000', role: 'mahasiswa' }); assert.equal(anonymousOtp.status, 202);
  const anonymousConfirm = await anonymous.request('/auth/password-reset/confirm', 'POST', { challengeId: anonymousOtp.body.data.challengeId, code: codes.at(-1).code, newPassword: 'Anonymous-otp-bypass-synthetic-123' });
  assert.equal(anonymousConfirm.status, 403); assert.equal(anonymousConfirm.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await temporaryClient.request('/auth/initial-password', 'POST', { newPassword: temporary })).status, 422);
  assert.equal((await temporaryClient.request('/auth/initial-password', 'POST', { newPassword: 'short' })).status, 422);
  const permanent = 'T9q!mW'; assert.equal((await temporaryClient.request('/auth/initial-password', 'POST', { newPassword: permanent })).status, 200);
  assert.equal((await temporaryClient.request('/students')).status, 401);
  const ready = await login('synthetic-000', 'mahasiswa', permanent); assert.equal((await ready.request('/students')).status, 200);
  const [[credential]] = await pool.execute('SELECT must_change_password FROM user_credentials WHERE user_id=?', [studentId(0)]); assert.equal(credential.must_change_password, 0);
});

test('late transaction failure rolls back credentials, audit, and operation; duplicate concurrent requests cannot disagree', options, async () => {
  await pool.query("CREATE TRIGGER synthetic_activation_failure BEFORE INSERT ON account_activation_operations FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SYNTHETIC_FAILURE'");
  try {
    assert.equal((await activate([studentId(4), studentId(5)])).status, 503);
    const [[row]] = await pool.execute('SELECT COUNT(*) AS total FROM user_credentials WHERE user_id IN (?,?)', [studentId(4), studentId(5)]); assert.equal(row.total, 0);
    const [[audit]] = await pool.execute("SELECT COUNT(*) AS total FROM audit_logs WHERE action='ACCOUNT_TEMPORARY_PASSWORD_SET' AND entity_id IN (?,?)", [studentId(4), studentId(5)]); assert.equal(audit.total, 0);
  } finally { await pool.query('DROP TRIGGER synthetic_activation_failure'); }
  const body = { requestId: randomBytes(16).toString('hex'), userIds: [studentId(4)], adminPassword, reportPassphrase };
  const results = await Promise.all([admin.request('/admin/accounts/activate', 'POST', body), admin.request('/admin/accounts/activate', 'POST', body)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const account = decrypt(results.find(r => r.status === 200).body.data.report)[0];
  const [[credential]] = await pool.execute('SELECT password_hash FROM user_credentials WHERE user_id=?', [studentId(4)]); assert(await verifyPassword(account.temporaryPassword, credential.password_hash));
});

test('all account operations preserve 78 users, 66 students, 644 attendance records, and three legacy archives', options, async () => {
  for (const [table, expected] of [['users', 78], ['students', 66], ['attendance_records', 644], ['leave_requests', 3]]) assert.equal((await pool.query(`SELECT COUNT(*) AS total FROM ${table}`))[0][0].total, expected);
  assert.equal(await academicDigest(), initialAcademicDigest);
});
