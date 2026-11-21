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


test('browser: own email verification uses saved email and confirms OTP without changing password', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 90000 }, async () => {
  let db, pool, server, browser, page, profile;
  let delivered;
  const database = 'hadir_email_browser_' + randomBytes(5).toString('hex') + '_test';
  try {
    const connection = { host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' };
    db = await mysql.createConnection(connection); await db.query('CREATE DATABASE ' + database);
    pool = mysql.createPool({ ...connection, database, timezone: 'Z', dateStrings: ['DATE'] }); await migrate(pool);
    await applyImport(pool, prepareImport(fixture()));
    const passwordHash = await hashPassword(password);
    await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', ['lecturer-test', passwordHash]);
    const port = await freePort(), debugPort = await freePort(), origin = 'http://127.0.0.1:' + port;
    server = createApp({ pool, origin, secret: 'Synthetic-email-browser-secret-more-than32', sendOtp: async (email, code) => { delivered = { email, code }; }, staticRoot: 'dist' }).listen(port, '127.0.0.1'); await once(server, 'listening');
    profile = await mkdtemp(join(tmpdir(), 'hadir-email-browser-test-'));
    browser = spawn(process.env.HADIR_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=' + debugPort, '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let tabs; await until(async () => { tabs = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json(); return tabs.some(tab => tab.type === 'page'); }, 'browser start');
    page = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl); await page.command('Page.navigate', { url: origin });
    await until(() => page.evaluate("document.querySelector('input[type=password]')!==null"), 'login form');
    assert.equal((await page.evaluate(login('lecturer-test', 'dosen'))).status, 200);
    await page.evaluate("window.dispatchEvent(new Event('hadir-session-changed'))");
    const profileButton = 'button[title="Buka Formulir Konfigurasi Profil Dosen"]';
    await until(() => page.evaluate('document.querySelector('+JSON.stringify(profileButton)+')!==null'), 'lecturer dashboard');
    await page.evaluate('document.querySelector('+JSON.stringify(profileButton)+').click()');
    await until(() => page.evaluate("document.querySelector('[aria-label=\"Verifikasi email\"]')!==null"), 'verification UI');
    await page.evaluate("[...document.querySelectorAll('button')].find(button=>button.innerText==='Kirim OTP verifikasi email').click()");
    await until(() => page.evaluate("document.querySelector('input[aria-label=\"Kode OTP verifikasi email\"]')!==null"), 'OTP input');
    assert.ok(delivered.code);
    assert.equal(await page.evaluate("[...document.querySelectorAll('button')].find(button=>button.innerText.includes('Kirim ulang dalam')).disabled"), true);
    const type = code => page.evaluate("(()=>{const input=document.querySelector('input[aria-label=\"Kode OTP verifikasi email\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,"+JSON.stringify(code)+");input.dispatchEvent(new Event('input',{bubbles:true}))})()");
    const confirm = () => page.evaluate("[...document.querySelectorAll('button')].find(button=>button.innerText==='Verifikasi email').click()");
    await type(delivered.code === '000000' ? '000001' : '000000'); await confirm();
    await until(() => page.evaluate("document.querySelector('[aria-label=\"Verifikasi email\"] [role=alert]')!==null"), 'wrong OTP rejected');
    await type(delivered.code); await confirm();
    await until(() => page.evaluate("document.querySelector('[aria-label=\"Verifikasi email\"]')?.innerText==='Email terverifikasi.'"), 'verified UI');
    const [[credential]] = await pool.execute('SELECT password_hash FROM user_credentials WHERE user_id=?', ['lecturer-test']);
    assert.equal(credential.password_hash,passwordHash);
    const [[user]] = await pool.execute('SELECT email_verified_at FROM users WHERE id=?', ['lecturer-test']); assert.ok(user.email_verified_at);
  } finally {
    if (page) { await page.command('Browser.close').catch(()=>{}); page.close(); } browser?.kill();
    if (server) { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
    if(pool) await pool.end(); if(db) { await db.query('DROP DATABASE '+database); await db.end(); }
    if(profile) await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200});
  }
});
