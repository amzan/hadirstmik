import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { hashPassword } from '../../backend/security.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { lecturerHistoryFixture } from '../fixtures.mjs';

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
  for (const table of ['courses', 'schedules', 'rombels', 'student_rombels', 'rombel_schedules', 'attendance_sessions', 'session_roster', 'attendance_records']) {
    snapshot[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY 1`))[0];
  }
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

before(async () => {
  if (!enabled) return;
  assert.equal(process.env.HADIR_TEST_HOST || '127.0.0.1', '127.0.0.1');
  const port = Number(process.env.HADIR_TEST_PORT || 33079);
  assert(port >= 1024 && port <= 65535);
  database = `hadir_history_${randomBytes(5).toString('hex')}_test`;
  root = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
  await root.query(`CREATE DATABASE ${database}`);
  pool = mysql.createPool({ host: '127.0.0.1', port, user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 5 });
  await migrate(pool);
  source = lecturerHistoryFixture();
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
  if (root && /^hadir_history_[a-f0-9]+_test$/.test(database)) { await root.query(`DROP DATABASE ${database}`); await root.end(); }
});

test('lecturer alias and display rename preserve closed history, records and owner-only access despite canonical schedule labels', { skip: !enabled }, async () => {
  const before = await academicDigest();
  const expected = source.sessions.filter(session => session.scheduleId === 'schedule-test').map(session => session.id).sort();
  assert.equal(expected.length, 5);
  const admin = await client('admin-test', 'admin');
  await client('lecturer-test', 'dosen');
  const [[account]] = await pool.execute('SELECT login_alias,version FROM users WHERE id=?', ['lecturer-test']);
  assert(account.login_alias);
  const lecturer = await client(account.login_alias.toUpperCase(), 'dosen');
  assert.equal((await lecturer.request('/auth/me')).body.data.id, 'lecturer-test');
  assert.equal((await lecturer.request('/users/lecturer-test', 'PATCH', { version: account.version, name: 'Completely Renamed Synthetic Lecturer' })).status, 200);
  const renamed = await client(account.login_alias.toUpperCase(), 'dosen');
  assert.equal((await renamed.request('/auth/me')).body.data.id, 'lecturer-test');
  const ownSchedules = await renamed.request('/schedules');
  assert.equal(ownSchedules.status, 200);
  assert(ownSchedules.body.data.every(schedule => schedule.lecturerId === 'lecturer-test'));
  assert.equal(ownSchedules.body.data.find(schedule => schedule.id === 'schedule-test').rombel, 'TI 1A');
  const adminSessions = (await admin.request('/attendance-sessions')).body.data;
  const ownSessions = (await renamed.request('/attendance-sessions')).body.data;
  assert.deepEqual(ownSessions.map(session => session.id).sort(), adminSessions.map(session => session.id).sort());
  const historical = ownSessions.filter(session => expected.includes(session.id));
  assert.deepEqual(historical.map(session => session.id).sort(), expected);
  assert(historical.every(session => session.rombel === 'TI 1' && !session.isOpen && session.studentNims.includes('0001')));
  assert.deepEqual(historical.map(session => session.meetingNumber).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  const adminRecords = (await admin.request('/attendance-records')).body.data;
  const ownRecords = (await renamed.request('/attendance-records')).body.data;
  assert.deepEqual(ownRecords, adminRecords);
  for (const session of historical) {
    assert(ownRecords.some(record => record.sessionId === session.id && record.studentNim === '0001'));
  }
  const other = await client('other-lecturer', 'dosen');
  const otherSchedules = await other.request('/schedules');
  assert.equal(otherSchedules.status, 200);
  assert.deepEqual(otherSchedules.body.data.map(schedule => schedule.id), ['schedule-other-lecturer']);
  for (const entity of ['attendance-sessions', 'attendance-records']) {
    const response = await other.request(`/${entity}`); assert.equal(response.status, 200); assert.deepEqual(response.body.data, []);
  }
  const id = expected[0];
  for (const action of ['close', 'reopen', 'rotate-qr']) assert.equal((await other.request(`/attendance-sessions/${id}/${action}`, 'POST', {})).status, 403);
  assert.equal((await other.request(`/attendance-sessions/${id}`, 'DELETE', {})).status, 403);
  assert.equal((await other.request(`/attendance-sessions/${id}/records/batch`, 'POST', { updates: [{ studentNim: '0001', status: 'HADIR', reason: 'Forbidden synthetic correction' }] })).status, 403);
  assert.equal(await academicDigest(), before);
});
