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


test('browser: admin edits identifiers and email with duplicate feedback', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 90000 }, async t => {
  let db, pool, server, browser, page, profile;
  const database = 'hadir_identifier_browser_' + randomBytes(5).toString('hex') + '_test';
  try {
    const connection = { host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' };
    db = await mysql.createConnection(connection); await db.query('CREATE DATABASE ' + database);
    pool = mysql.createPool({ ...connection, database, timezone: 'Z', dateStrings: ['DATE'] }); await migrate(pool);
    await applyImport(pool, prepareImport(fixture())); await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', ['admin-test', await hashPassword(password)]);
    const port = await freePort(), debugPort = await freePort(), origin = 'http://127.0.0.1:' + port;
    server = createApp({ pool, origin, secret: 'Synthetic-leave-browser-secret-more-than32', staticRoot: 'dist' }).listen(port, '127.0.0.1'); await once(server, 'listening');
    profile = await mkdtemp(join(tmpdir(), 'hadir-identifier-browser-test-'));
    browser = spawn(process.env.HADIR_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=' + debugPort, '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let tabs; await until(async () => { tabs = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json(); return tabs.some(tab => tab.type === 'page'); }, 'browser start');
    page = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl); await page.command('Page.navigate', { url: origin });
    await until(() => page.evaluate("document.querySelector('input[type=password]')!==null"), 'login form');
    assert.equal((await page.evaluate(login('admin-test', 'admin'))).status, 200);
    await page.command('Page.navigate', { url: origin + '/portaladmin' });
    await until(() => page.evaluate("[...document.querySelectorAll('button')].some(button=>button.innerText.includes('Kelola Pengguna'))"), 'admin dashboard');
    await page.evaluate("[...document.querySelectorAll('button')].find(button=>button.innerText.includes('Kelola Pengguna')).click()");
    const open = id => page.evaluate("[...document.querySelectorAll('tr')].find(row=>row.querySelector('button[title=\"Edit Pengguna\"]')&&[...row.querySelectorAll('td')].some(cell=>cell.innerText.split('\\n').some(line=>line.trim()==="+JSON.stringify(id)+"))).querySelector('button[title=\"Edit Pengguna\"]').click()");
    const type = (id, value) => page.evaluate("(()=>{const input=document.getElementById("+JSON.stringify(id)+");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,"+JSON.stringify(value)+");input.dispatchEvent(new Event('input',{bubbles:true}))})()");
    const save = () => page.evaluate("document.querySelector('[aria-labelledby=user-modal-title] form').requestSubmit()");
    await until(() => page.evaluate("document.querySelector('input[aria-label=\"Pilih 0001\"]')!==null"), 'account table');
    await t.test('NIM duplicate stays open with exact message, own unchanged value saves', async () => {
      await open('0001');
      await until(() => page.evaluate("document.getElementById('user-identifier')!==null"), 'edit form');
      assert.equal(await page.evaluate("document.getElementById('user-email').readOnly"), false);
      await type('user-identifier', ' 0002 '); await save();
      await until(() => page.evaluate("document.querySelector('[role=alert]')?.innerText==='data yang dimasukan sudah ada'"), 'duplicate feedback');
      assert.equal(await page.evaluate("document.getElementById('user-identifier').value"), ' 0002 ');
      await type('user-identifier', '0001'); await save();
      await until(() => page.evaluate("document.getElementById('user-modal-title')===null"), 'own identifier saves');
    });
    await t.test('unique NIM and email save without OTP, stable account remains', async () => {
      await open('0001'); await type('user-identifier', ' 0099 '); await type('user-email', 'updated-student@example.test'); await save();
      await until(() => page.evaluate("document.getElementById('user-modal-title')===null"), 'unique student saves');
      const [[row]] = await pool.execute('SELECT username,email FROM users WHERE id=?', ['student-test']);
      assert.equal(row.username, '0099'); assert.equal(row.email, 'updated-student@example.test');
      const [[student]] = await pool.execute('SELECT email FROM students WHERE nim=?', ['0099']); assert.equal(student.email,row.email);
    });
    await t.test('NIDN duplicate rejects and unique NIDN follows login username', async () => {
      await open('lecturer-test'); await type('user-identifier', '0099'); await save();
      await until(() => page.evaluate("document.querySelector('[role=alert]')?.innerText==='data yang dimasukan sudah ada'"), 'cross-role duplicate');
      await type('user-identifier', '090099'); await save();
      await until(() => page.evaluate("document.getElementById('user-modal-title')===null"), 'unique lecturer saves');
      const [[row]] = await pool.execute('SELECT username,nidn FROM users WHERE id=?', ['lecturer-test']); assert.equal(row.username,'090099');assert.equal(row.nidn,'090099');
    });
  } finally {
    if (page) { await page.command('Browser.close').catch(()=>{}); page.close(); } browser?.kill();
    if (server) { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); } await pool?.end();
    if (db) { if (/^hadir_identifier_browser_[a-f0-9]+_test$/.test(database)) await db.query('DROP DATABASE ' + database); await db.end(); }
    if (profile) await rm(profile,{recursive:true,force:true}).catch(()=>{});
  }
});
