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
import { provisionDemo } from '../../backend/provision-demo.mjs';
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


test('browser: demo login and admin scope keep simulated data separate', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 90000 }, async t => {
  let db, pool, server, browser, page, profile;
  const database = 'hadir_demo_browser_' + randomBytes(5).toString('hex') + '_test';
  try {
    const connection = { host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' };
    db = await mysql.createConnection(connection); await db.query('CREATE DATABASE ' + database);
    pool = mysql.createPool({ ...connection, database, timezone: 'Z', dateStrings: ['DATE'] }); await migrate(pool);
    await applyImport(pool, prepareImport(fixture())); await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', ['admin-test', await hashPassword(password)]);
    await provisionDemo(pool, password);
    const port = await freePort(), debugPort = await freePort(), origin = 'http://127.0.0.1:' + port;
    server = createApp({ pool, origin, secret: 'Synthetic-leave-browser-secret-more-than32', staticRoot: 'dist' }).listen(port, '127.0.0.1'); await once(server, 'listening');
    profile = await mkdtemp(join(tmpdir(), 'hadir-leave-browser-test-'));
    browser = spawn(process.env.HADIR_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=' + debugPort, '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let tabs; await until(async () => { tabs = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json(); return tabs.some(tab => tab.type === 'page'); }, 'browser start');
    page = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl); await page.command('Page.navigate', { url: origin });
    await until(() => page.evaluate("document.querySelector('input[type=password]')!==null"), 'login form');
    const text = () => page.evaluate('document.body.innerText');
    const click = label => page.evaluate("[...document.querySelectorAll('button')].find(button=>button.innerText.trim()==="+JSON.stringify(label)+").click()");
    await t.test('public login does not disclose demo credentials', async () => {
      assert(!(await text()).includes('DATA DEMO')); assert(!(await text()).includes('26TI2026'));
    });
    await t.test('admin Data Demo menu exposes only demo management and returns to regular data', async () => {
      assert.equal((await page.evaluate(login('admin-test', 'admin'))).status, 200);
      await page.command('Page.navigate', { url: origin + '/portaladmin' });
      await until(() => page.evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Data Demo')"), 'admin scope switch');
      assert(!(await text()).includes('Matematika Semesta'));
      await click('Data Demo');
      await until(() => page.evaluate("document.querySelector('[aria-label=\"Menu Data Demo\"]')!==null"), 'demo menu');
      await until(() => page.evaluate("document.body.innerText.includes('2 Dosen') || document.body.innerText.includes('1 Dosen')"), 'demo lists');
      await page.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Kelola Pengguna')).click()");
      await until(() => page.evaluate("document.body.innerText.includes('Alex') && document.body.innerText.includes('Udin')"), 'demo accounts');
      assert(!(await text()).includes('Synthetic Student')); assert(!(await text()).includes('Cadangan & Database'));
      assert((await text()).includes('Acak')); assert((await text()).includes('Manual'));
      await page.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Master Mata Kuliah')).click()");
      await until(() => page.evaluate("document.body.innerText.includes('Matematika Semesta')"), 'demo course');
      await click('Kembali ke Data Reguler');
      await until(() => page.evaluate("document.querySelector('[aria-label=\"Menu Data Reguler\"]')!==null && !document.body.innerText.includes('Matematika Semesta')"), 'regular scope restored');
    });
    await t.test('demo lecturer and student use existing login and show DEMO label', async () => {
      for (const [identifier, role] of [['010101','dosen'],['26TI2026','mahasiswa']]) {
        await page.evaluate(request('/auth/logout','POST',{}));
        assert.equal((await page.evaluate(login(identifier,role))).status,200);
        await page.command('Page.navigate',{url:origin});
        await until(() => page.evaluate("document.body.innerText.includes('DATA DEMO') && document.body.innerText.includes('Matematika Semesta')"), 'demo dashboard');
        assert(!(await text()).includes('Synthetic Course'));
      }
    });
  } finally {
    if (page) { await page.command('Browser.close').catch(()=>{}); page.close(); } browser?.kill();
    if (server) { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); } await pool?.end();
    if (db) { if (/^hadir_demo_browser_[a-f0-9]+_test$/.test(database)) await db.query('DROP DATABASE ' + database); await db.end(); }
    if (profile) await rm(profile,{recursive:true,force:true}).catch(()=>{});
  }
});

