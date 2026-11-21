import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { ensureLecturerLoginAliases } from '../../backend/lecturer-login.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { hashPassword } from '../../backend/security.mjs';
import { fixture, excludeReviewFixture, accountActivationBrowserFixture, historicalAttendanceFixture, sessionCreationFixture } from '../fixtures.mjs';

async function freePort() { const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function until(work, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { const result = await work(); if (result) return result; } catch {} await delay(100); }
  throw new Error(`Timed out: ${label}`);
}
async function connectCdp(address) {
  const socket = new WebSocket(address); await Promise.race([once(socket, 'open'), delay(10000).then(() => { if (socket.readyState !== WebSocket.OPEN) { socket.close(); throw new Error('CDP connect timeout'); } })]); let next = 0; const pending = new Map(), exceptions = [], dialogs = [];
  socket.addEventListener('message', event => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text); if (msg.id) { const item = pending.get(msg.id); if (!item) return; pending.delete(msg.id); clearTimeout(item.timer); if (msg.error) item.reject(new Error(msg.error.message)); else item.resolve(msg.result); } });
  socket.addEventListener('close', () => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('CDP closed')); } pending.clear(); });
  const command = (method, params = {}) => new Promise((resolve, reject) => { if (socket.readyState !== WebSocket.OPEN) { reject(new Error('CDP closed')); return; } const id = ++next; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Page.javascriptDialogOpening') { dialogs.push(message.params.type); void command('Page.handleJavaScriptDialog', { accept: message.params.type === 'beforeunload' }).catch(() => {}); } });
  const evaluate = async expression => { const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  await command('Runtime.enable'); await command('Page.enable');
  return { command, evaluate, exceptions, dialogs, close: () => socket.close() };
}

test('browser: new sessions keep drafts, reject expired times and render QR/manual without duplicate history', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 90000 }, async t => {
  let db, pool, server, browser, cdp;
  const database = `hadir_history_browser_${randomBytes(4).toString('hex')}_test`;
  try {
    db = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
    await db.query(`CREATE DATABASE ${database}`);
    pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'] });
    await migrate(pool); const preview = prepareImport(sessionCreationFixture()); assert(preview.valid, JSON.stringify(preview.issues)); await applyImport(pool, preview);
    for(const user of ['lecturer-test','admin-test'])await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)',[user,await hashPassword('Synthetic-history-password-123')]);
    await ensureLecturerLoginAliases(pool);
    const before = JSON.stringify([(await pool.query('SELECT * FROM attendance_sessions ORDER BY id'))[0], (await pool.query('SELECT * FROM attendance_records ORDER BY id'))[0]]);
    const port = await freePort(), debugPort = await freePort(), origin = `http://127.0.0.1:${port}`;
    server = createApp({ pool, origin, secret: 'Synthetic-history-secret-more-than-32-characters', staticRoot: 'dist' }).listen(port, '127.0.0.1'); await once(server, 'listening');
    await mkdir('.cache/browser', { recursive: true }); const profile = await mkdtemp(resolve('.cache/browser/history-'));
    browser = spawn(process.env.HADIR_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    const tabs = await until(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(), 'history browser startup');
    cdp = await connectCdp(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    const setInput=async(label,value)=>cdp.evaluate(`(()=>{const e=document.querySelector('input[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const logout=async()=>cdp.evaluate("(async()=>{const c=await fetch('/api/v1/auth/csrf').then(r=>r.json());await fetch('/api/v1/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':c.data.csrfToken},body:'{}'});})()");
    const login=async(role)=>{await cdp.command('Page.navigate',{url:origin+(role==='admin'?'/portaladmin':'/')});await until(()=>cdp.evaluate("document.querySelector('input[type=password]')!==null"),'login form');if(role==='dosen'){await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Portal Dosen').click()");await until(()=>cdp.evaluate("document.body.innerText.includes('Nama Depan / Username')"),'lecturer tab');}await cdp.evaluate(`(()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [input,value] of [[document.querySelector('input[type=text]'),${JSON.stringify(role==='admin'?'admin-test':'lecturer-test')}],[document.querySelector('input[type=password]'),'Synthetic-history-password-123']]){setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`);await delay(100);await cdp.evaluate("document.querySelector('form').requestSubmit()");try{await until(()=>cdp.evaluate(role==='admin'?"document.body.innerText.includes('Panel Administrator BAAK')":"document.querySelector('select[aria-label=\"Pertemuan schedule-test\"]')!==null"),'logged in');}catch(error){throw new Error(error.message+': '+await cdp.evaluate('document.body.innerText'));}};
    const open=async()=>{await cdp.evaluate("[...document.querySelector('select[aria-label=\"Pertemuan schedule-same-course\"]').closest('.frost-card').querySelectorAll('button')].find(b=>b.innerText.trim()==='Buka Sesi').click()");await until(()=>cdp.evaluate("document.querySelector('input[aria-label=\"Jam mulai sesi\"]')!==null"),'creation modal');};
    const field=async(selector,value,tag='HTMLInputElement')=>{await cdp.evaluate(`(()=>{const form=document.querySelector('input[aria-label="Jam mulai sesi"]').closest('form'),e=form.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${tag}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(100);};
    const click=async(text)=>cdp.evaluate(`[...(document.querySelector('input[aria-label=\"Jam mulai sesi\"]')?.closest('form').parentElement||document).querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(text)}).click()`);
    const request=(path,body={})=>cdp.evaluate(`(async()=>{const c=(await(await fetch('/api/v1/auth/csrf')).json()).data.csrfToken;const r=await fetch('/api/v1${path}',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':c},body:JSON.stringify(${JSON.stringify(body)})});return {status:r.status,body:await r.json()};})()`);
    await login('dosen');await open();
    await t.test('expired time gives an actionable error and creates nothing',async()=>{await field('input[type=date]','2020-01-01');await click('Presensi QR');await until(()=>cdp.evaluate("document.querySelector('[role=alert]')?.innerText.includes('Waktu akhir sesi sudah lewat')"),'expired error');assert.equal((await pool.query("SELECT COUNT(*) n FROM attendance_sessions WHERE schedule_id='schedule-same-course'"))[0][0].n,0);});
    let first;
    await t.test('edited date, times and topic survive refresh; double-click creates one QR session',async()=>{await field('input[type=date]','2099-01-01');await field('input[aria-label="Jam mulai sesi"]','08:00');await field('input[aria-label="Jam selesai sesi"]','09:00');await field('textarea','Synthetic retained draft','HTMLTextAreaElement');await cdp.evaluate("window.dispatchEvent(new Event('focus'))");await delay(500);assert.equal(await cdp.evaluate("document.querySelector('textarea').value"),'Synthetic retained draft');await cdp.evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Presensi QR');b.click();b.click();})()");await until(()=>cdp.evaluate("document.querySelector('canvas')?.width>0"),'QR canvas');const [rows]=await pool.query("SELECT * FROM attendance_sessions WHERE schedule_id='schedule-same-course'");assert.equal(rows.length,1);first=rows[0];assert.equal(first.topic,'Synthetic retained draft');assert.equal(first.is_open,1);assert.equal((await pool.query('SELECT COUNT(*) n FROM attendance_records WHERE session_id=?',[first.id]))[0][0].n,0);});
    await t.test('a closed first meeting permits the next manual meeting with missing rows unchanged',async()=>{await cdp.evaluate("[...[...document.querySelectorAll('h2')].find(h=>h.innerText.startsWith('Layar QR Presensi')).closest('.border-b').querySelectorAll('button')].at(-1).click()");assert.equal((await request('/attendance-sessions/'+first.id+'/close')).status,200);await cdp.evaluate("window.dispatchEvent(new Event('focus'))");await until(()=>cdp.evaluate("document.querySelector('select[aria-label=\"Pertemuan schedule-same-course\"]').options[0].text.includes('Selesai')"),'closed refreshed');await cdp.evaluate("(()=>{const e=document.querySelector('select[aria-label=\"Pertemuan schedule-same-course\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'2');e.dispatchEvent(new Event('change',{bubbles:true}));})()");await delay(100);await open();await field('input[type=date]','2099-01-02');await click('Presensi Manual');await until(()=>cdp.evaluate("document.querySelector('[aria-label=\"Tabel presensi manual\"]')!==null"),'manual new session');await until(()=>cdp.evaluate("document.querySelector('button[aria-label=\"Hadir 0001\"]')!==null"),'manual roster loaded');assert.equal(await cdp.evaluate("document.querySelector('[aria-label=\"Tabel presensi manual\"]').innerText.includes('Belum tercatat')"),true,await cdp.evaluate("document.querySelector('[aria-label=\"Kelola Presensi Manual\"]').innerText"));await cdp.evaluate("document.querySelector('button[aria-label=\"Hadir 0001\"]').click()");await click('Simpan Perubahan');await until(()=>cdp.evaluate("document.body.innerText.includes('Perubahan presensi tersimpan')"),'manual committed').catch(async e=>{throw new Error(e.message+': '+await cdp.evaluate("document.querySelector('[aria-label=\"Kelola Presensi Manual\"]').innerText"))});const[records]=await pool.query("SELECT r.session_id,r.status,s.meeting_number FROM attendance_records r JOIN attendance_sessions s ON s.id=r.session_id WHERE s.schedule_id='schedule-same-course'");assert.equal(records.length,2);const current=records.find(r=>r.meeting_number===2),previous=records.find(r=>r.session_id===first.id);assert.equal(current.status,'HADIR');assert.notEqual(current.session_id,first.id);assert.equal(previous.status,'ALPHA');});
    assert.deepEqual(cdp.exceptions,[]);
  }finally{if(cdp){await cdp.command('Browser.close').catch(()=>{});cdp.close();}browser?.kill();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await pool?.end();if(db){await db.query(`DROP DATABASE ${database}`);await db.end();}}
});

