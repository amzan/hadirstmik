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
  database = `hadir_records_history_${randomBytes(5).toString('hex')}_test`;
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
  if (root && /^hadir_records_history_[a-f0-9]+_test$/.test(database)) { await root.query(`DROP DATABASE ${database}`); await root.end(); }
});

test('closed attendance history is session-scoped, persistent, owner-only and never synthesizes records', { skip: !enabled }, async () => {
  const admin = await client('admin-test', 'admin');
  const lecturer = await client('lecturer-test', 'dosen');
  const other = await client('other-lecturer', 'dosen');
  const student = await client('0001', 'mahasiswa');
  await pool.execute('UPDATE students SET is_active=0 WHERE nim=?', ['0002']);
  const before = await academicDigest();
  const path = '/attendance-sessions/history-session-1/history';
  assert.equal((await fetch(`${url}/api/v1${path}`)).status, 401);
  const response = await lecturer.request(path);
  assert.equal(response.status, 200);
  const { session, students, records } = response.body.data;
  assert.equal(session.id, 'history-session-1');
  assert.equal(session.scheduleId, 'schedule-test');
  assert.equal(session.lecturerId, 'lecturer-test');
  assert.equal(session.isOpen, false);
  assert.equal('qrToken' in session, false);
  assert.equal('qrExpiresAt' in session, false);
  assert.deepEqual(session.studentNims, ['0001', '0002', '0003', '0004', '0005']);
  assert.deepEqual(students.map(student => student.nim), session.studentNims);
  assert(students.every(student => Object.keys(student).sort().join(',') === 'name,nim'));
  assert.deepEqual(records.map(record => record.status), ['HADIR', 'IZIN', 'SAKIT', 'ALPHA']);
  assert(records.every(record => record.sessionId === session.id));
  assert.equal(records.some(record => record.studentNim === '0005'), false);
  assert(response.body.data.generatedAt);
  const withoutTime = ({ generatedAt, ...data }) => data;
  assert.deepEqual(withoutTime((await lecturer.request(path)).body.data), withoutTime(response.body.data));
  assert.deepEqual(withoutTime((await admin.request(path)).body.data), withoutTime(response.body.data));
  assert.equal((await other.request(path)).status, 403);
  assert.equal((await student.request(path)).status, 403);
  assert.equal((await lecturer.request('/attendance-sessions/not-a-session/history')).status, 404);
  const another = (await lecturer.request('/attendance-sessions/history-session-2/history')).body.data;
  assert.equal(another.records.length, 1);
  assert.equal(another.records[0].sessionId, 'history-session-2');
  assert.equal(another.records[0].status, 'HADIR');
  const empty = (await lecturer.request('/attendance-sessions/history-session-empty/history')).body.data;
  assert.equal(empty.students.length, 5);
  assert.deepEqual(empty.records, []);
  assert.equal(await academicDigest(), before);
});
