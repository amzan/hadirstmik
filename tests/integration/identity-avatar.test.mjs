import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { hashPassword } from '../../backend/security.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { fixture } from '../fixtures.mjs';

const options = { skip: process.env.HADIR_TEST_DB !== '1' }, password = 'Synthetic-isolation-password-12345';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
let root, pool, server, database, base, storage, originalStorage;
async function client(user, role) {
  const jar = new Map(); let csrf;
  async function request(path, method = 'GET', body, extra = {}) {
    const response = await fetch(base + '/api/v1' + path, { method, headers: { Origin: 'http://127.0.0.1', 'Content-Type': 'application/json', Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), 'X-CSRF-Token': csrf || '', ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
    const bytes = Buffer.from(await response.arrayBuffer()); let json; try { json = JSON.parse(bytes.toString()); } catch {}
    return { status: response.status, json, bytes, headers: response.headers };
  }
  csrf = (await request('/auth/csrf')).json.data.csrfToken;
  if (user) assert.equal((await request('/auth/login', 'POST', { identifier: user, role, password })).status, 200);
  return { request, jar };
}
before(async () => {
  if (options.skip) return;
  assert.equal(process.env.HADIR_TEST_HOST || '127.0.0.1', '127.0.0.1');
  database = `hadir_identity_${randomBytes(5).toString('hex')}_test`;
  root = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
  await root.query(`CREATE DATABASE ${database}`);
  pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'] });
  await migrate(pool); const source = fixture(); await applyImport(pool, prepareImport(source));
  const hash = await hashPassword(password); for (const user of source.users) await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', [user.id, hash]);
  originalStorage = process.env.HADIR_AVATAR_DIR; storage = await mkdtemp(join(tmpdir(), 'hadir-avatar-test-')); process.env.HADIR_AVATAR_DIR = storage;
  server = createApp({ pool, origin: 'http://127.0.0.1', secret: 'Synthetic-identity-secret-more-than-32' }).listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await pool?.end(); if (root && /^hadir_identity_[a-f0-9]+_test$/.test(database)) { await root.query(`DROP DATABASE ${database}`); await root.end(); } if (storage) await rm(storage, { recursive: true, force: true }); if (originalStorage === undefined) delete process.env.HADIR_AVATAR_DIR; else process.env.HADIR_AVATAR_DIR = originalStorage; });

test('session cannot switch identity; user and role parameters cannot cross scope; logout revokes old cookie', options, async () => {
  const a = await client('lecturer-test', 'dosen');
  assert.equal((await a.request('/auth/login', 'POST', { identifier: 'other-lecturer', role: 'dosen', password })).status, 409);
  assert.equal((await a.request('/auth/me')).json.data.id, 'lecturer-test');
  assert.equal((await a.request('/users?userId=other-lecturer&role=admin')).json.data.every(user => user.id === 'lecturer-test'), true);
  assert.equal((await a.request('/users/other-lecturer', 'PATCH', { version: 1, name: 'Forbidden' })).status, 403);
  assert.equal((await a.request('/admin/accounts')).status, 403);
  const oldCookie = [...a.jar].map(([key, value]) => `${key}=${value}`).join('; ');
  assert.equal((await a.request('/auth/logout', 'POST', {})).status, 200);
  assert.equal((await a.request('/auth/me', 'GET', undefined, { Cookie: oldCookie })).status, 401);
  assert.equal((await a.request('/auth/login', 'POST', { identifier: 'other-lecturer', role: 'dosen', password })).status, 200);
  assert.equal((await a.request('/auth/me')).json.data.id, 'other-lecturer');
  const student = await client('0001', 'mahasiswa');
  assert.equal((await student.request('/students?userId=student-other')).json.data.every(value => value.nim === '0001'), true);
  assert.equal((await student.request('/users/student-other', 'PATCH', { version: 1, name: 'Forbidden' })).status, 403);
});

test('own avatar commits to persistent private storage, survives new app instance, rejects cross-user and invalid image', options, async () => {
  const a = await client('lecturer-test', 'dosen'), b = await client('other-lecturer', 'dosen'), admin = await client('admin-test', 'admin');
  const before = createHash('sha256').update(JSON.stringify((await pool.query('SELECT * FROM attendance_records ORDER BY id'))[0])).digest('hex');
  assert.equal((await a.request('/avatars', 'POST', { dataUrl: png, userId: 'other-lecturer' })).status, 403);
  assert.equal((await a.request('/avatars', 'POST', { dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' })).status, 422);
  const upload = await a.request('/avatars', 'POST', { dataUrl: png }); assert.equal(upload.status, 200);
  const path = upload.json.data.avatarUrl.replace('/api/v1', '');
  assert.equal((await a.request('/auth/me')).json.data.avatarUrl, upload.json.data.avatarUrl);
  assert.equal((await a.request(path)).status, 200); assert.equal((await b.request(path)).status, 403); assert.equal((await admin.request(path)).status, 200);
  assert.equal((await a.request('/avatars/lecturer-test/not-safe.jpg')).status, 404);
  const anonymous = await client(); assert.equal((await anonymous.request(path)).status, 401);
  const otherServer = createApp({ pool, origin: 'http://127.0.0.1', secret: 'Synthetic-identity-secret-more-than-32' }).listen(0, '127.0.0.1'); await once(otherServer, 'listening');
  try { const response = await fetch(`http://127.0.0.1:${otherServer.address().port}/api/v1${path}`, { headers: { Cookie: [...a.jar].map(([key, value]) => `${key}=${value}`).join('; ') } }); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); }
  finally { otherServer.closeAllConnections(); await new Promise(resolve => otherServer.close(resolve)); }
  assert.equal((await readdir(storage)).length, 1);
  const after = createHash('sha256').update(JSON.stringify((await pool.query('SELECT * FROM attendance_records ORDER BY id'))[0])).digest('hex'); assert.equal(before, after);
});
