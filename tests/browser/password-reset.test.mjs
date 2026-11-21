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



test('browser: password reset renders every step with real API and synthetic SMTP', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 120000 }, async t => {
  let db, pool, server, browser, page, profile;
  const database = 'hadir_reset_browser_' + randomBytes(5).toString('hex') + '_test';
  const delivered = []; let deliveryFails = false;
  try {
    const connection = { host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' };
    db = await mysql.createConnection(connection); await db.query('CREATE DATABASE ' + database);
    pool = mysql.createPool({ ...connection, database, timezone: 'Z', dateStrings: ['DATE'] }); await migrate(pool);
    await applyImport(pool, prepareImport(fixture()));
    await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', ['student-test', await hashPassword(password)]);
    await pool.execute('UPDATE users SET email_verified_at=UTC_TIMESTAMP() WHERE id=?', ['student-test']);
    const port = await freePort(), debugPort = await freePort(), origin = 'http://127.0.0.1:' + port;
    server = createApp({ pool, origin, secret: 'Synthetic-reset-browser-secret-more-than32', staticRoot: 'dist', sendOtp: async (email, code) => { if (deliveryFails) throw new Error('Synthetic SMTP failure'); delivered.push({ email, code }); } }).listen(port, '127.0.0.1'); await once(server, 'listening');
    profile = await mkdtemp(join(tmpdir(), 'hadir-reset-browser-test-'));
    browser = spawn(process.env.HADIR_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=' + debugPort, '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let tabs; await until(async () => { tabs = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json(); return tabs.some(tab => tab.type === 'page'); }, 'browser start');
    page = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl); await page.command('Page.navigate', { url: origin });
    const click = text => page.evaluate('[...document.querySelectorAll("button")].find(button=>button.innerText.includes(' + JSON.stringify(text) + ')).click()');
    const fill = (selector, value) => page.evaluate('(()=>{const input=document.querySelector(' + JSON.stringify(selector) + ');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,' + JSON.stringify(value) + ');input.dispatchEvent(new Event("input",{bubbles:true}))})()');
    const open = async () => { await until(() => page.evaluate('document.body.innerText.includes("Lupa kata sandi?")'), 'login ready'); await click('Lupa kata sandi?'); await until(() => page.evaluate('document.querySelector(' + JSON.stringify('input[aria-label="Email / NIM / NIDN / Username"]') + ')!==null'), 'identity modal'); };
    const codeInputs = 'input[aria-label^="Digit OTP "]';
    const enterCode = async code => { for (let i=0;i<6;i++) await fill('input[aria-label="Digit OTP ' + (i+1) + '"]', code[i]); };
    await open();
    await t.test('identity, loading and desktop OTP inputs are visible with cooldown and back navigation', async () => {
      await fill('input[aria-label="Email / NIM / NIDN / Username"]', '0001');
      await page.evaluate(`window.__resetFetch=window.fetch; window.fetch=async (...args)=>{if(String(args[0]).endsWith('/auth/password-reset/request')){window.fetch=window.__resetFetch;throw new Error('Synthetic network failure')}return window.__resetFetch(...args)}`);
      await click('Kirim Kode OTP'); await until(() => page.evaluate('document.body.innerText.includes("Synthetic network failure")'), 'network error visible');
      assert.equal(await page.evaluate('document.querySelectorAll(' + JSON.stringify(codeInputs) + ').length'), 0);
      await page.evaluate(`window.fetch=async (...args)=>{if(String(args[0]).endsWith('/auth/password-reset/request'))await new Promise(resolve=>{window.__releaseReset=resolve});return window.__resetFetch(...args)}`);
      await click('Kirim Kode OTP'); await until(() => page.evaluate('typeof window.__releaseReset === "function"'), 'request paused');
      assert.equal(await page.evaluate('[...document.querySelectorAll("button")].find(button=>button.innerText.includes("Mengirim Kode")).disabled'), true);
      assert.equal(await page.evaluate('document.querySelector(' + JSON.stringify('input[aria-label="Email / NIM / NIDN / Username"]') + ')!==null'), true);
      await page.evaluate('window.__releaseReset();window.fetch=window.__resetFetch');
      await until(() => page.evaluate('document.querySelectorAll(' + JSON.stringify(codeInputs) + ').length===6'), 'OTP inputs render');
      assert.equal(await page.evaluate('[...document.querySelectorAll(' + JSON.stringify(codeInputs) + ')].every(input=>{const bounds=input.getBoundingClientRect();return bounds.width>0&&bounds.height>0&&bounds.left>=0&&bounds.right<=innerWidth})'), true);
      assert.equal(delivered.length, 1); assert.equal(delivered[0].email, 'student@example.test');
      assert.equal(await page.evaluate('[...document.querySelectorAll("button")].find(button=>button.innerText.includes("Kirim ulang dalam")).disabled'), true);
      await click('Ubah Identitas');
      assert.equal(await page.evaluate('document.querySelector(' + JSON.stringify('input[aria-label="Email / NIM / NIDN / Username"]') + ').value'), '0001');
      await pool.execute('DELETE FROM auth_limits'); await pool.execute('UPDATE auth_challenges SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 MINUTE)');
      await click('Kirim Kode OTP'); await until(() => page.evaluate('document.querySelectorAll(' + JSON.stringify(codeInputs) + ').length===6'), 'OTP reopens');
    });
    await t.test('wrong OTP preserves form and mobile valid OTP opens new password and completes login', async () => {
      await page.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 700, deviceScaleFactor: 1, mobile: true });
      assert.equal(await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), true);
      const actual = delivered.at(-1).code, wrong = actual === '000000' ? '111111' : '000000';
      await enterCode(wrong); await click('Verifikasi Kode');
      await until(() => page.evaluate('document.body.innerText.includes("Kode salah") || document.body.innerText.includes("CHALLENGE_INVALID")'), 'invalid OTP feedback');
      assert.equal(await page.evaluate('document.querySelectorAll(' + JSON.stringify(codeInputs) + ').length'), 6);
      await enterCode(actual); await click('Verifikasi Kode');
      await until(() => page.evaluate('document.querySelector(' + JSON.stringify('input[aria-label="Kata Sandi Baru"]') + ')!==null'), 'new password stage');
      await fill('input[aria-label="Kata Sandi Baru"]', 'Temp-Synthetic-654'); await fill('input[aria-label="Konfirmasi Kata Sandi Baru"]', 'Temp-Synthetic-654');
      await click('Simpan Kata Sandi Baru'); await until(() => page.evaluate('document.body.innerText.includes("Kata Sandi Berhasil Diperbarui!")'), 'reset success');
      await click('Selesai & Masuk ke Portal');
      assert.equal((await page.evaluate(request('/auth/login', 'POST', { identifier: '0001', role: 'mahasiswa', password }))).status, 401);
      assert.equal((await page.evaluate(request('/auth/login', 'POST', { identifier: '0001', role: 'mahasiswa', password: 'Temp-Synthetic-654' }))).status, 200);
      await page.evaluate(request('/auth/logout', 'POST', {}));
    });
    await t.test('SMTP failure and unknown accounts keep a usable neutral OTP stage', async () => {
      await pool.execute('DELETE FROM auth_limits'); await pool.execute('UPDATE auth_challenges SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 MINUTE)'); deliveryFails = true;
      await page.command('Page.navigate', { url: origin }); await open();
      await fill('input[aria-label="Email / NIM / NIDN / Username"]', '0001'); await click('Kirim Kode OTP');
      await until(() => page.evaluate('document.querySelectorAll(' + JSON.stringify(codeInputs) + ').length===6'), 'SMTP failure OTP stage');
      assert.equal(await page.evaluate('document.body.innerText.includes("Tahap ini tidak memastikan email sudah diterima")'), true);
      await click('Ubah Identitas'); await fill('input[aria-label="Email / NIM / NIDN / Username"]', 'nonexistent-synthetic'); await click('Kirim Kode OTP');
      await until(() => page.evaluate('document.querySelectorAll(' + JSON.stringify(codeInputs) + ').length===6'), 'unknown identity OTP stage');
    });
  } finally {
    if (page) { await page.command('Browser.close').catch(()=>{}); page.close(); } browser?.kill();
    if (server) { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); } await pool?.end();
    if (db) { if (/^hadir_reset_browser_[a-f0-9]+_test$/.test(database)) await db.query('DROP DATABASE ' + database); await db.end(); }
    if (profile) await rm(profile,{recursive:true,force:true}).catch(()=>{});
  }
});
