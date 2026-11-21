import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { hashPassword } from '../../backend/security.mjs';
import { fixture } from '../fixtures.mjs';

async function freePort() { const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function until(work, label) { const deadline = Date.now() + 15000; while (Date.now() < deadline) { try { if (await work()) return; } catch {} await delay(100); } throw new Error(label); }
async function connect(address) {
  const socket = new WebSocket(address); await once(socket, 'open'); let next = 0; const pending = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (!message.id) return; const item = pending.get(message.id); if (!item) return; pending.delete(message.id); clearTimeout(item.timer); if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result); });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next, timer = setTimeout(() => { pending.delete(id); reject(new Error(method)); }, 15000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  await command('Runtime.enable'); await command('Page.enable'); return { command, evaluate, close: () => socket.close() };
}
const password = 'Synthetic-browser-isolation-12345';
const request = (path, method = 'GET', body) => `(async()=>{const token=(await(await fetch('/api/v1/auth/csrf')).json()).data.csrfToken;const r=await fetch('/api/v1${path}',{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json','X-CSRF-Token':token},${body === undefined ? '' : `body:JSON.stringify(${JSON.stringify(body)}),`}credentials:'same-origin'});return {status:r.status,body:await r.json()}})()`;
const login = (id, role) => request('/auth/login', 'POST', { identifier: id, role, password });

test('browser: avatars and identity remain scoped across refresh, delayed requests, logout, Back and two tabs', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 120000 }, async t => {
  let db, pool, server, browser, first, second, profile, storage; const previous = process.env.HADIR_AVATAR_DIR;
  const database = `hadir_identity_browser_${randomBytes(5).toString('hex')}_test`;
  try {
    db = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' }); await db.query(`CREATE DATABASE ${database}`);
    pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'] });
    await migrate(pool); const source = fixture(); await applyImport(pool, prepareImport(source)); const hash = await hashPassword(password); for (const user of source.users) await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', [user.id, hash]);
    storage = await mkdtemp(join(tmpdir(), 'hadir-avatar-browser-test-')); process.env.HADIR_AVATAR_DIR = storage;
    const port = await freePort(), debugPort = await freePort(), origin = `http://127.0.0.1:${port}`;
    server = createApp({ pool, origin, secret: 'Synthetic-browser-identity-secret-more-than32', staticRoot: 'dist' }).listen(port, '127.0.0.1'); await once(server, 'listening');
    profile = await mkdtemp(join(tmpdir(), 'hadir-identity-browser-test-'));
    browser = spawn(process.env.HADIR_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let tabs; await until(async () => { tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); return tabs.some(tab => tab.type === 'page'); }, 'browser start');
    first = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl); await first.command('Page.navigate', { url: origin }); await until(() => first.evaluate("document.querySelector('input[type=password]')!==null"), 'login form');
    assert.equal((await first.evaluate(login('lecturer-test', 'dosen'))).status, 200); await first.evaluate("window.dispatchEvent(new Event('hadir-session-changed'))");
    await until(() => first.evaluate("document.querySelector('button[title=\"Buka Formulir Konfigurasi Profil Dosen\"]')!==null"), 'lecturer dashboard');
    await t.test('avatar upload updates current profile and dashboard immediately and persists through reload', async () => {
      await first.evaluate("document.querySelector('button[title=\"Buka Formulir Konfigurasi Profil Dosen\"]').click()");
      await until(() => first.evaluate("document.querySelector('input[aria-label=\"Nama profil\"]')!==null"), 'profile opened');
      await first.evaluate("(()=>{const input=document.querySelector('input[type=file][accept*=image]');const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.getContext('2d').fillRect(0,0,32,32);return new Promise(resolve=>canvas.toBlob(blob=>{const transfer=new DataTransfer();transfer.items.add(new File([blob],'avatar.jpg',{type:'image/jpeg'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(resolve,300)},'image/jpeg'))})()");
      await first.evaluate("document.querySelector('input[aria-label=\"Nama profil\"]').closest('form').requestSubmit()");
      try { await until(() => first.evaluate("[...document.images].some(image=>image.src.includes('/api/v1/avatars/lecturer-test/'))"), 'avatar live update'); } catch(error) { t.diagnostic(await first.evaluate("document.body.innerText.slice(-2500)")); t.diagnostic(JSON.stringify(await first.evaluate(request('/auth/me')))); throw error; }
      const me = await first.evaluate(request('/auth/me')); assert.match(me.body.data.avatarUrl, /^\/api\/v1\/avatars\/lecturer-test\//);
      await first.command('Page.reload'); await until(() => first.evaluate("[...document.images].some(image=>image.src.includes('/api/v1/avatars/lecturer-test/'))"), 'avatar persisted after reload');
    });
    await t.test('active identity cannot be replaced by login even with valid other credentials', async () => {
      assert.equal((await first.evaluate(login('other-lecturer', 'dosen'))).status, 409); assert.equal((await first.evaluate(request('/auth/me'))).body.data.id, 'lecturer-test');
    });
    const target = await first.command('Target.createTarget', { url: origin }); await until(async () => { tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); return tabs.some(tab => tab.id === target.targetId); }, 'second tab');
    second = await connect(tabs.find(tab => tab.id === target.targetId).webSocketDebuggerUrl);
    await until(() => second.evaluate("document.querySelector('button[title=\"Buka Formulir Konfigurasi Profil Dosen\"]')!==null"), 'shared-session second tab');
    await t.test('logout clears both tabs and delayed account A responses cannot overwrite account B', async () => {
      await first.evaluate("(()=>{const original=window.fetch.bind(window);let resolve;window.__releaseOld=new Promise(r=>resolve=r);window.__releaseOldNow=resolve;let held=false;window.fetch=async(...args)=>{const response=await original(...args);if(!held&&String(args[0]).endsWith('/auth/me')){held=true;window.__oldHeld=true;await window.__releaseOld;}return response;};window.dispatchEvent(new Event('focus'));})()");
      await until(() => first.evaluate('window.__oldHeld===true'), 'old response held');
      assert.equal((await second.evaluate(request('/auth/logout', 'POST', {}))).status, 200);
      await second.evaluate("(()=>{window.dispatchEvent(new Event('hadir-session-changed'));const channel=new BroadcastChannel('hadir-auth');channel.postMessage('changed');channel.close()})()");
      await until(() => first.evaluate("!document.querySelector('button[title=\"Buka Formulir Konfigurasi Profil Dosen\"]')"), 'old profile cleared');
      assert.equal((await second.evaluate(login('0002', 'mahasiswa'))).status, 200);
      await second.evaluate("(()=>{window.dispatchEvent(new Event('hadir-session-changed'));const channel=new BroadcastChannel('hadir-auth');channel.postMessage('changed');channel.close()})()");
      await first.evaluate('window.__releaseOldNow()');
      await until(() => first.evaluate("document.body.innerText.includes('Student Other')"), 'new identity first tab');
      await until(() => second.evaluate("document.body.innerText.includes('Student Other')"), 'new identity second tab');
      assert.equal(await first.evaluate("[...document.images].some(image=>image.src.includes('/avatars/lecturer-test/'))"), false);
      assert.equal((await first.evaluate(request('/auth/me'))).body.data.id, 'student-other');
    });
    await t.test('logout plus browser Back or reload cannot restore private dashboard or shared storage', async () => {
      assert.equal((await second.evaluate(request('/auth/logout', 'POST', {}))).status, 200); await second.evaluate("(()=>{window.dispatchEvent(new Event('hadir-session-changed'));const channel=new BroadcastChannel('hadir-auth');channel.postMessage('changed');channel.close()})()");
      await first.evaluate('history.pushState(null,"","/");history.back()').catch(() => {}); await delay(200); await first.command('Page.reload');
      await until(() => first.evaluate("document.querySelector('input[type=password]')!==null"), 'logged out after back');
      assert.equal((await first.evaluate(request('/auth/me'))).status, 401);
      assert.equal(await first.evaluate("JSON.stringify({...localStorage,...sessionStorage}).includes('Student Other')"), false);
      assert.equal(await first.evaluate("JSON.stringify({...localStorage,...sessionStorage}).includes('/avatars/lecturer-test/')"), false);
    });
  } finally {
    second?.close(); if (first) { await first.command('Browser.close').catch(() => {}); first.close(); } browser?.kill();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await pool?.end();
    if (db) { if (/^hadir_identity_browser_[a-f0-9]+_test$/.test(database)) await db.query(`DROP DATABASE ${database}`); await db.end(); }
    if (storage) await rm(storage, { recursive: true, force: true }); if (previous === undefined) delete process.env.HADIR_AVATAR_DIR; else process.env.HADIR_AVATAR_DIR = previous;
  }
});
