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


test('browser: leave recipients use searchable unique chips and require an explicit selection', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 90000 }, async t => {
  let db, pool, server, browser, page, profile;
  const database = 'hadir_leave_browser_' + randomBytes(5).toString('hex') + '_test';
  try {
    const connection = { host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' };
    db = await mysql.createConnection(connection); await db.query('CREATE DATABASE ' + database);
    pool = mysql.createPool({ ...connection, database, timezone: 'Z', dateStrings: ['DATE'] }); await migrate(pool);
    await applyImport(pool, prepareImport(fixture())); await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', ['student-test', await hashPassword(password)]);
    const port = await freePort(), debugPort = await freePort(), origin = 'http://127.0.0.1:' + port;
    server = createApp({ pool, origin, secret: 'Synthetic-leave-browser-secret-more-than32', staticRoot: 'dist' }).listen(port, '127.0.0.1'); await once(server, 'listening');
    profile = await mkdtemp(join(tmpdir(), 'hadir-leave-browser-test-'));
    browser = spawn(process.env.HADIR_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=' + debugPort, '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let tabs; await until(async () => { tabs = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json(); return tabs.some(tab => tab.type === 'page'); }, 'browser start');
    page = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl); await page.command('Page.navigate', { url: origin });
    await until(() => page.evaluate("document.querySelector('input[type=password]')!==null"), 'login form');
    assert.equal((await page.evaluate(login('0001', 'mahasiswa'))).status, 200); await page.evaluate("window.dispatchEvent(new Event('hadir-session-changed'))");
    await until(() => page.evaluate("[...document.querySelectorAll('button')].some(button=>button.innerText.includes('Ajukan Izin'))"), 'student dashboard');
    await page.evaluate("[...document.querySelectorAll('button')].find(button=>button.innerText.includes('Ajukan Izin')).click()");
    await until(() => page.evaluate("document.querySelector('[role=combobox]')!==null"), 'leave modal');
    const type = value => page.evaluate("(()=>{const input=document.querySelector('[role=combobox]');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input," + JSON.stringify(value) + ");input.dispatchEvent(new Event('input',{bubbles:true}))})()");
    const key = value => page.evaluate("document.querySelector('[role=combobox]').dispatchEvent(new KeyboardEvent('keydown',{key:" + JSON.stringify(value) + ",bubbles:true,cancelable:true}))");
    await t.test('case-insensitive partial search and keyboard selection preserve unique recipient chips', async () => {
      await type('LECTURER'); await until(() => page.evaluate("document.querySelectorAll('[role=option]').length===2"), 'two matching lecturers');
      await key('Enter'); await until(() => page.evaluate("document.querySelectorAll('button[aria-label^=\"Hapus penerima\"]').length===1"), 'first chip');
      await type('lecturer'); await until(() => page.evaluate("document.querySelectorAll('[role=option]').length===1"), 'selected recipient excluded');
      await key('ArrowDown'); await key('Enter'); await until(() => page.evaluate("document.querySelectorAll('button[aria-label^=\"Hapus penerima\"]').length===2"), 'second chip');
      await type('lecturer'); assert.equal(await page.evaluate("document.querySelectorAll('[role=option]').length"), 0); await key('Escape');
      assert.equal(await page.evaluate("document.querySelector('[role=combobox]').getAttribute('aria-expanded')"), 'false');
    });
    await t.test('chip removal and free text cannot submit without at least one selected ID', async () => {
      await page.evaluate("document.querySelector('button[aria-label^=\"Hapus penerima\"]').click()"); await type(''); await key('Backspace');
      await until(() => page.evaluate("document.querySelectorAll('button[aria-label^=\"Hapus penerima\"]').length===0"), 'chips removed');
      await type('Unlisted recipient');
      await page.evaluate("(()=>{const field=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Synthetic leave reason');field.dispatchEvent(new Event('input',{bubbles:true}));})()");
      await page.evaluate("document.querySelector('[role=dialog] form').requestSubmit()");
      await until(() => page.evaluate("document.querySelector('[role=alert]')?.innerText.includes('Pilih minimal satu')"), 'required recipient validation');
      const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM leave_requests'); assert.equal(count.total, 0);
    });
    await t.test('mobile dropdown remains inside the scrollable modal and chosen recipients submit once', async () => {
      await page.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 700, deviceScaleFactor: 1, mobile: true });
      await type('other'); await until(() => page.evaluate("document.querySelectorAll('[role=option]').length===1"), 'partial match'); await key('Enter');
      assert.equal(await page.evaluate("document.querySelector('[role=dialog]').scrollWidth<=document.querySelector('[role=dialog]').clientWidth"), true);
      await page.evaluate("(()=>{const form=document.querySelector('[role=dialog] form');form.requestSubmit();form.requestSubmit()})()");
      await until(() => page.evaluate("document.body.innerText.includes('Pengajuan Terkirim!')"), 'submission succeeds');
      const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM leave_requests'); assert.equal(count.total, 1);
      const [rows] = await pool.query('SELECT lecturer_id FROM leave_recipients'); assert.deepEqual(rows.map(row=>row.lecturer_id), ['other-lecturer']);
    });
  } finally {
    if (page) { await page.command('Browser.close').catch(()=>{}); page.close(); } browser?.kill();
    if (server) { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); } await pool?.end();
    if (db) { if (/^hadir_leave_browser_[a-f0-9]+_test$/.test(database)) await db.query('DROP DATABASE ' + database); await db.end(); }
    if (profile) await rm(profile,{recursive:true,force:true}).catch(()=>{});
  }
});
