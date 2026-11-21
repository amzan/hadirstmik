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
const sentOtp = []; let deliveryFails = false;
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
  database = `hadir_smtp_${randomBytes(5).toString('hex')}_test`;
  root = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
  await root.query(`CREATE DATABASE ${database}`);
  pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 8 });
  await migrate(pool); await migrate(pool);
  const source = fixture(); source.users.find(user => user.id === 'lecturer-test').name = 'Dr. Ahmad Synthetic'; source.users.find(user => user.id === 'other-lecturer').name = 'Prof. Drs. Ahmad Other';
  await applyImport(pool, prepareImport(source));
  const hash = await hashPassword(original);
  for (const user of source.users) await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', [user.id, hash]);
  academicBefore = await academicDigest();
  server = createApp({ pool, origin, secret: 'Synthetic-profile-secret-more-than-32-characters', sendOtp: async (...args) => { if (deliveryFails) throw new Error('Synthetic delivery failure'); sentOtp.push(args); } }).listen(0, '127.0.0.1');
  await once(server, 'listening'); url = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => { if (pool) await pool.execute('DELETE FROM auth_limits'); });
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await pool?.end();
  if (root && /^hadir_smtp_[a-f0-9]+_test$/.test(database)) { await root.query(`DROP DATABASE ${database}`); await root.end(); }
});


async function resetDeliveryLimits() {
  await pool.execute('DELETE FROM auth_limits');
  await pool.execute('UPDATE auth_challenges SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 MINUTE)');
}
async function verifyEmail(session) {
  await resetDeliveryLimits();
  const request = await session.request('/auth/email-verification/request', 'POST', {});
  assert.equal(request.status, 202, JSON.stringify(request.body));
  return { id: request.body.data.challengeId, code: sentOtp.at(-1)[1] };
}
test('verification sends only to authenticated own email and never marks imported email verified before correct OTP', options, async () => {
  const guest = await client(), student = await login('0001', 'mahasiswa'), other = await login('0002', 'mahasiswa');
  assert.equal((await guest.request('/auth/email-verification/request', 'POST', {})).status, 401);
  assert.equal((await student.request('/auth/email-verification/request', 'POST', { email: 'forged@example.test' })).status, 403);
  const challenge = await verifyEmail(student);
  assert.equal(sentOtp.at(-1)[0], 'student@example.test');
  const [[stored]] = await pool.execute('SELECT token_hash FROM auth_challenges WHERE id=?', [challenge.id]); assert.notEqual(stored.token_hash, challenge.code); assert.equal(stored.token_hash.length, 64);
  assert.equal((await student.request('/auth/me')).body.data.emailVerified, false);
  const confirm = (session, code) => session.request('/auth/email-verification/confirm', 'POST', { challengeId: challenge.id, code });
  assert.equal((await confirm(other, challenge.code)).status, 400);
  assert.equal((await confirm(student, '000000')).status, 400);
  assert.equal((await confirm(student, challenge.code)).status, 200);
  assert.equal((await student.request('/auth/me')).body.data.emailVerified, true);
  assert.equal((await confirm(student, challenge.code)).status, 400);
});
test('verification enforces cooldown, five attempts, expiry, CSRF, email binding and send failure', options, async () => {
  const student = await login('0002', 'mahasiswa');
  let challenge = await verifyEmail(student);
  assert.equal((await student.request('/auth/email-verification/request', 'POST', {})).status, 429);
  let confirm = () => student.request('/auth/email-verification/confirm', 'POST', { challengeId: challenge.id, code: challenge.code });
  for (let index = 0; index < 5; index++) assert.equal((await student.request('/auth/email-verification/confirm', 'POST', { challengeId: challenge.id, code: '000000' })).status, 400);
  assert.equal((await confirm()).status, 400);
  challenge = await verifyEmail(student);
  await pool.execute('UPDATE auth_challenges SET expires_at=? WHERE id=?', [new Date(0), challenge.id]); assert.equal((await confirm()).status, 400);
  challenge = await verifyEmail(student);
  assert.equal((await student.request('/auth/email-verification/confirm', 'POST', { challengeId: challenge.id, code: challenge.code }, { 'X-CSRF-Token': 'forged' })).status, 403);
  await pool.execute('UPDATE users SET email=? WHERE id=?', ['different@example.test', 'student-other']); assert.equal((await confirm()).status, 400);
  assert.equal((await student.request('/auth/me')).body.data.emailVerified, false);
});
test('forgot password accepts stored unverified email without marking it verified, hides unknown accounts and revokes sessions', options, async () => {
  const guest = await client();
  const request = identifier => guest.request('/auth/password-reset/request', 'POST', { identifier, role: 'mahasiswa' });
  let count = sentOtp.length;
  for (const identifier of ['missing']) {
    const result = await request(identifier); assert.equal(result.status, 202); assert.equal(result.body.data.message, 'Jika akun memenuhi syarat, kode dikirim ke email terdaftar.');
  }
  assert.equal(sentOtp.length, count);
  assert.equal((await request('missing')).status, 429);
  await resetDeliveryLimits();
  const oldSession = await login('0002', 'mahasiswa');
  const result = await request('0002'); assert.equal(result.status, 202); assert.equal(sentOtp.length, count + 1);
  assert.equal(sentOtp.at(-1)[0], 'different@example.test');
  const code = sentOtp.at(-1)[1], id = result.body.data.challengeId;
  assert.equal((await request('0002')).status, 429);
  assert.equal((await guest.request('/auth/password-reset/verify', 'POST', { challengeId: id, code })).status, 200);
  const confirm = code => guest.request('/auth/password-reset/confirm', 'POST', { challengeId: id, code, newPassword: 'New-synthetic-password-123' });
  assert.equal((await confirm('000000')).status, 400); assert.equal((await confirm(code)).status, 200); assert.equal((await confirm(code)).status, 400);
  assert.equal((await oldSession.request('/auth/me')).status, 401);
  const oldLogin = await client();
  assert.equal((await oldLogin.request('/auth/login', 'POST', { identifier: '0002', role: 'mahasiswa', password: original })).status, 401);
  const newSession = await login('0002', 'mahasiswa', 'New-synthetic-password-123');
  assert.equal((await newSession.request('/auth/me')).body.data.emailVerified, false);
  await resetDeliveryLimits();
  const expired = await request('0001'); const expiredCode = sentOtp.at(-1)[1];
  await pool.execute('UPDATE auth_challenges SET expires_at=? WHERE id=?', [new Date(0), expired.body.data.challengeId]);
  assert.equal((await guest.request('/auth/password-reset/confirm', 'POST', { challengeId: expired.body.data.challengeId, code: expiredCode, newPassword: 'Another-synthetic-123' })).status, 400);
  await resetDeliveryLimits();
  const locked = await request('0001'), lockedCode = sentOtp.at(-1)[1];
  for (let i = 0; i < 5; i++) assert.equal((await guest.request('/auth/password-reset/verify', 'POST', { challengeId: locked.body.data.challengeId, code: '000000' })).status, 400);
  assert.equal((await guest.request('/auth/password-reset/verify', 'POST', { challengeId: locked.body.data.challengeId, code: lockedCode })).status, 400);
  assert.equal(await academicDigest(), academicBefore);
});

test('SMTP failure invalidates verification and reset challenges without revealing reset account eligibility', options, async () => {
  const student = await login('0002', 'mahasiswa', 'New-synthetic-password-123'); await resetDeliveryLimits(); deliveryFails = true;
  try {
    assert.equal((await student.request('/auth/email-verification/request', 'POST', {})).status, 503);
    const [[verification]] = await pool.execute("SELECT used_at FROM auth_challenges WHERE user_id='student-other' AND purpose='verify' ORDER BY created_at DESC,id DESC LIMIT 1"); assert(verification.used_at);
    const guest = await client();
    const result = await guest.request('/auth/password-reset/request', 'POST', { identifier: '0001', role: 'mahasiswa' }); assert.equal(result.status, 202);
    const [[reset]] = await pool.execute('SELECT used_at FROM auth_challenges WHERE id=?', [result.body.data.challengeId]); assert(reset.used_at);
    const [events] = await pool.execute("SELECT action FROM audit_logs WHERE entity_type='auth_challenge' AND entity_id=? ORDER BY id", [result.body.data.challengeId]);
    assert.deepEqual(events.map(event => event.action), ['OTP_RESET_REQUESTED', 'OTP_RESET_DELIVERY_FAILED']);
  } finally { deliveryFails = false; }
});


test('reset codes bind to the latest stored email and inactive accounts remain indistinguishable', options, async () => {
  const guest = await client(); await resetDeliveryLimits();
  const request = identifier => guest.request('/auth/password-reset/request', 'POST', { identifier, role: 'mahasiswa' });
  const active = await request('0001'), code = sentOtp.at(-1)[1];
  await pool.execute('UPDATE users SET email=? WHERE id=?', ['changed-again@example.test', 'student-test']);
  assert.equal((await guest.request('/auth/password-reset/verify', 'POST', { challengeId: active.body.data.challengeId, code })).status, 400);
  assert.equal((await guest.request('/auth/password-reset/confirm', 'POST', { challengeId: active.body.data.challengeId, code, newPassword: 'Not-applied-synthetic-123' })).status, 400);
  await pool.execute('UPDATE users SET is_active=0 WHERE id=?', ['student-test']);
  await resetDeliveryLimits(); const count = sentOtp.length;
  const inactive = await request('0001'), unknown = await request('missing-latest');
  assert.equal(inactive.status, unknown.status); assert.equal(inactive.body.data.message, unknown.body.data.message); assert.equal(sentOtp.length, count);
  await pool.execute('UPDATE users SET is_active=1 WHERE id=?', ['student-test']);
  assert.equal(await academicDigest(), academicBefore);
});


test('four incorrect reset codes still allow valid verification then atomic confirmation on the final attempt', options, async () => {
  await resetDeliveryLimits(); const guest = await client();
  const result = await guest.request('/auth/password-reset/request', 'POST', { identifier: '0001', role: 'mahasiswa' });
  assert.equal(result.status, 202);
  const challengeId = result.body.data.challengeId, code = sentOtp.at(-1)[1];
  const wrongCode = code === '000000' ? '111111' : '000000';
  for (let index = 0; index < 4; index++) assert.equal((await guest.request('/auth/password-reset/verify', 'POST', { challengeId, code: wrongCode })).status, 400);
  assert.equal((await guest.request('/auth/password-reset/verify', 'POST', { challengeId, code })).status, 200);
  const [[challenge]] = await pool.execute('SELECT attempts FROM auth_challenges WHERE id=?', [challengeId]); assert.equal(challenge.attempts, 4);
  const confirm = () => guest.request('/auth/password-reset/confirm', 'POST', { challengeId, code, newPassword: 'Final-attempt-synthetic-123' });
  assert.equal((await confirm()).status, 200); assert.equal((await confirm()).status, 400);
  await login('0001', 'mahasiswa', 'Final-attempt-synthetic-123');
  assert.equal(await academicDigest(), academicBefore);
});
