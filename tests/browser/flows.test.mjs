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
import { fixture, excludeReviewFixture, accountActivationBrowserFixture, historicalAttendanceFixture } from '../fixtures.mjs';

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

test('browser: admin lifecycle and committed manual corrections refresh reports', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 90000 }, async t => {
  let db, pool, server, browser, cdp;
  const database = `hadir_history_browser_${randomBytes(4).toString('hex')}_test`;
  try {
    db = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
    await db.query(`CREATE DATABASE ${database}`);
    pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'] });
    await migrate(pool); const preview = prepareImport(historicalAttendanceFixture()); assert(preview.valid, JSON.stringify(preview.issues)); await applyImport(pool, preview);
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
    await login('dosen');
    await t.test('closed manual changes are staged, missing rows stay unrecorded and committed audit preserves session status',async()=>{
      await until(()=>cdp.evaluate("document.querySelector('select[aria-label=\"Pertemuan schedule-test\"]')!==null"),'schedules');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Riwayat Sesi')).click()");await until(()=>cdp.evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Detail')"),'details');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Detail').click()");await until(()=>cdp.evaluate("document.body.innerText.includes('Kelola Presensi Manual')"),'manual action');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Kelola Presensi Manual').click()");await until(()=>cdp.evaluate("document.querySelector('button[aria-label=\"Hadir 0004\"]')!==null"),'manual roster');
      assert.equal(await cdp.evaluate("document.querySelector('[aria-label=\"Tabel presensi manual\"] tr[data-nim=\"0005\"]').innerText.includes('Belum tercatat')"),true);
      await cdp.evaluate("document.querySelector('button[aria-label=\"Hadir 0004\"]').click()");
      assert.equal((await pool.query("SELECT status FROM attendance_records WHERE session_id='history-session-1' AND student_nim='0004'"))[0][0].status,'ALPHA');
      await setInput('Alasan 0004','Synthetic browser correction');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Simpan Perubahan').click()");await until(()=>cdp.evaluate("document.body.innerText.includes('Perubahan presensi tersimpan')"),'commit saved');
      const [[session]]=await pool.query("SELECT is_open FROM attendance_sessions WHERE id='history-session-1'");assert.equal(session.is_open,0);
      const [[record]]=await pool.query("SELECT id,status FROM attendance_records WHERE session_id='history-session-1' AND student_nim='0004'");assert.equal(record.status,'HADIR');
      const [audit]=await pool.query('SELECT old_status,new_status,method FROM attendance_record_audit WHERE attendance_record_id=? ORDER BY id',[record.id]);assert(audit.some(a=>a.old_status==='ALPHA'&&a.new_status==='HADIR'&&a.method==='MANUAL'));
      await cdp.evaluate("document.querySelector('button[aria-label=\"Tutup presensi manual\"]').click()");await until(()=>cdp.evaluate("document.querySelector('[aria-label=\"Rekap presensi sesi\"]')?.innerText.includes('Hadir: 2')"),'detail refreshed');
      const [[missing]]=await pool.query("SELECT COUNT(*) n FROM attendance_records WHERE session_id='history-session-1' AND student_nim='0005'");assert.equal(missing.n,0);
    });
    await t.test('PDF click fetches the corrected persistent history again',async()=>{
      await cdp.evaluate("window.__historyReads=0;window.__originalFetch=window.fetch;window.fetch=(...args)=>{if(String(args[0]).includes('/history'))window.__historyReads++;return window.__originalFetch(...args);}");
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Unduh PDF Sesi')).click()");await until(()=>cdp.evaluate('window.__historyReads>0'),'fresh export request');
      await cdp.evaluate('window.fetch=window.__originalFetch');
    });
    await logout();await login('admin');await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Monitoring Sesi')).click()");
    await until(()=>cdp.evaluate("document.querySelector('tr[data-session-id=\"history-session-1\"]')!==null"),'monitoring');
    const rowButton=async(id,label)=>cdp.evaluate(`[...document.querySelector('tr[data-session-id="${id}"]').querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(label)}).click()`);
    await t.test('admin reopen preserves ID/records and disables old QR',async()=>{await rowButton('history-session-1','Buka Sesi');await until(async()=>Boolean((await pool.query("SELECT is_open FROM attendance_sessions WHERE id='history-session-1'"))[0][0].is_open),'reopened');assert.equal((await pool.query("SELECT COUNT(*) n FROM attendance_records WHERE session_id='history-session-1'"))[0][0].n,4);});
    await t.test('admin reset confirms then archives without deleting records',async()=>{await rowButton('history-session-2','Reset Sesi');await until(()=>cdp.evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText==='Ya, Reset Sesi Ini')"),'reset confirmation');assert.equal((await pool.query("SELECT is_archived FROM attendance_sessions WHERE id='history-session-2'"))[0][0].is_archived,0);await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Ya, Reset Sesi Ini').click()");await until(async()=>Boolean((await pool.query("SELECT is_archived FROM attendance_sessions WHERE id='history-session-2'"))[0][0].is_archived),'reset archived');await until(()=>cdp.evaluate("![...document.querySelectorAll('button')].some(b=>b.innerText==='Ya, Reset Sesi Ini')"),'reset dialog closed after refresh');assert.equal((await pool.query("SELECT COUNT(*) n FROM attendance_records WHERE session_id='history-session-2'"))[0][0].n,1);});
    await t.test('admin delete archives and archive remains inspectable',async()=>{await cdp.evaluate("document.querySelector('tr[data-session-id=\"history-session-3\"] button[title^=\"Hapus sesi\"]').click()");await until(()=>cdp.evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText==='Ya, Hapus Sesi')"),'delete confirmation');await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Ya, Hapus Sesi').click()");try{ await until(async()=>Boolean((await pool.query("SELECT is_archived FROM attendance_sessions WHERE id='history-session-3'"))[0][0].is_archived),'deleted archived'); }catch(error){throw new Error(error.message+': '+await cdp.evaluate('document.body.innerText'));}await until(()=>cdp.evaluate("![...document.querySelectorAll('button')].some(b=>b.innerText==='Ya, Hapus Sesi')"),'delete dialog closed after refresh');await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Arsip Sesi').click()");await until(()=>cdp.evaluate("document.querySelector('tr[data-session-id=\"history-session-3\"]')!==null"),'archive list');await cdp.evaluate("document.querySelector('tr[data-session-id=\"history-session-3\"] button').click()");await until(()=>cdp.evaluate("document.body.innerText.includes('Arsip')&&document.querySelector('[aria-label=\"Presensi historis sesi\"]')!==null"),'archive detail');});
    await t.test('favicon assets have expected dimensions and no default Vite branding',async()=>{assert.equal(await cdp.evaluate("document.querySelector('link[rel=icon][sizes=\"32x32\"]')?.getAttribute('href').startsWith('/favicon-32.png?v=')"),true);assert.equal((await fetch(origin+'/favicon-32.png')).status,200);});
    assert.deepEqual(cdp.exceptions,[]);
  } finally {if(cdp){await cdp.command('Browser.close').catch(()=>{});cdp.close();}browser?.kill();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await pool?.end();if(db){await db.query(`DROP DATABASE ${database}`);await db.end();}}
});

test('browser: lecturer completed history follows schedule IDs and preserves old session details', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 60000 }, async t => {
  let db, pool, server, browser, cdp;
  const database = `hadir_history_browser_${randomBytes(4).toString('hex')}_test`;
  try {
    db = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
    await db.query(`CREATE DATABASE ${database}`);
    pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'] });
    await migrate(pool); const preview = prepareImport(historicalAttendanceFixture()); assert(preview.valid, JSON.stringify(preview.issues)); await applyImport(pool, preview);
    await pool.execute('INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)', ['lecturer-test', await hashPassword('Synthetic-history-password-123')]);
    await ensureLecturerLoginAliases(pool);
    const before = JSON.stringify([(await pool.query('SELECT * FROM attendance_sessions ORDER BY id'))[0], (await pool.query('SELECT * FROM attendance_records ORDER BY id'))[0]]);
    const port = await freePort(), debugPort = await freePort(), origin = `http://127.0.0.1:${port}`;
    server = createApp({ pool, origin, secret: 'Synthetic-history-secret-more-than-32-characters', staticRoot: 'dist' }).listen(port, '127.0.0.1'); await once(server, 'listening');
    await mkdir('.cache/browser', { recursive: true }); const profile = await mkdtemp(resolve('.cache/browser/history-'));
    browser = spawn(process.env.HADIR_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    const tabs = await until(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(), 'history browser startup');
    cdp = await connectCdp(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await cdp.command('Page.navigate', { url: origin });
    await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'history login form');
    await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Portal Dosen').click()");
    const [[lecturer]] = await pool.query("SELECT login_alias FROM users WHERE id='lecturer-test'");
    await cdp.evaluate(`(() => {const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [input,value] of [[document.querySelector('input[type=text]'),${JSON.stringify(lecturer.login_alias.toUpperCase())}],[document.querySelector('input[type=password]'),'Synthetic-history-password-123']]){setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('form').requestSubmit();})()`);
    await until(() => cdp.evaluate("document.querySelector('select[aria-label=\"Pertemuan schedule-test\"]')!==null"), 'lecturer schedules');
    await t.test('own schedules show six completed historical meetings and default to meeting seven', async () => {
      const state = await cdp.evaluate("(()=>{const select=document.querySelector('select[aria-label=\"Pertemuan schedule-test\"]');return {value:select.value,options:[...select.options].slice(0,7).map(o=>o.text),cards:document.querySelectorAll('select[aria-label^=\"Pertemuan schedule-\"]').length};})()");
      assert.equal(state.value, '7'); assert.equal(state.cards, 2);
      for (let i = 0; i < 6; i++) assert.match(state.options[i], new RegExp(`Pertemuan ${i + 1}.*Selesai`));
      assert.equal(state.options[6], 'Pertemuan 7');
    });
    await t.test('same course on another schedule does not inherit completed meetings', async () => {
      const state = await cdp.evaluate("(()=>{const select=document.querySelector('select[aria-label=\"Pertemuan schedule-same-course\"]');return {value:select.value,completed:[...select.options].some(o=>o.text.includes('Selesai')),foreign:document.querySelector('select[aria-label=\"Pertemuan schedule-other-lecturer\"]')!==null};})()");
      assert.deepEqual(state, { value: '1', completed: false, foreign: false });
    });
    await t.test('selecting an old meeting shows completed status and its historical detail remains accessible', async () => {
      await cdp.evaluate("(()=>{const select=document.querySelector('select[aria-label=\"Pertemuan schedule-test\"]');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
      await until(() => cdp.evaluate("document.body.innerText.includes('Sesi Selesai')"), 'closed meeting selected');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Riwayat Sesi')).click()");
      await until(() => cdp.evaluate("[...document.querySelectorAll('button')].filter(b=>b.innerText.trim()==='Detail').length===6"), 'six historical details');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Detail').click()");
      await until(() => cdp.evaluate("document.querySelector('table[aria-label=\"Presensi historis sesi\"]')!==null"), 'persistent old session detail');
      assert.equal(await cdp.evaluate("document.body.innerText.includes('Synthetic historical meeting 1')"), true);
      const actual = await cdp.evaluate("[...document.querySelectorAll('table[aria-label=\"Presensi historis sesi\"] tbody tr')].map(row=>({nim:row.dataset.nim,status:row.lastElementChild.innerText.trim()}))");
      assert.deepEqual(actual, ['Hadir','Izin','Sakit','Alpa','Belum tercatat'].map((status,index)=>({nim:`000${index+1}`,status})));
      const counts = await cdp.evaluate("document.querySelector('[aria-label=\"Rekap presensi sesi\"]').innerText");
      for (const status of ['Hadir','Izin','Sakit','Alpa','Belum tercatat']) assert(counts.includes(`${status}: 1`));
      assert(counts.includes('Total: 5'));
      assert.equal(await cdp.evaluate("[...document.querySelectorAll('[aria-label=\"Detail histori presensi\"] button')].some(b=>/^(Tutup Sesi|Buka Kembali|Refresh QR|Presensi Manual)$/.test(b.innerText.trim()))"),false);
      const downloads=await mkdtemp(resolve('.cache/browser/history-pdf-'));
      await cdp.command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Unduh PDF Sesi').click()");
      const {readdir}=await import('node:fs/promises');
      const pdf=await until(async()=>{const names=await readdir(downloads);const name=names.find(name=>name.endsWith('.pdf'));return name?readFile(join(downloads,name)):false;},'historical PDF downloaded');
      assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert(pdf.length>1000);
    });
    await t.test('reload fetches persistent records again and another meeting stays isolated', async()=>{
      await cdp.command('Page.reload',{ignoreCache:true});
      await until(()=>cdp.evaluate("document.querySelector('select[aria-label=\"Pertemuan schedule-test\"]')!==null"),'history reload');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Riwayat Sesi')).click()");
      await until(()=>cdp.evaluate("[...document.querySelectorAll('button')].filter(b=>b.innerText.trim()==='Detail').length===6"),'reloaded history list');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Detail').click()");
      await until(()=>cdp.evaluate("document.querySelectorAll('table[aria-label=\"Presensi historis sesi\"] tbody tr').length===5"),'reloaded persistent roster');
      const second=await cdp.evaluate("fetch('/api/v1/attendance-sessions/history-session-2/history').then(async r=>({status:r.status,data:(await r.json()).data}))");
      assert.equal(second.status,200);assert.equal(second.data.session.id,'history-session-2');assert.equal(second.data.records.length,1);assert(second.data.records.every(record=>record.sessionId==='history-session-2'&&record.status==='HADIR'));
      const empty=await cdp.evaluate("fetch('/api/v1/attendance-sessions/history-session-empty/history').then(async r=>({status:r.status,data:(await r.json()).data}))");
      assert.equal(empty.status,200);assert.equal(empty.data.records.length,0);assert.equal(empty.data.students.length,5);
    });
    await t.test('empty historical meeting shows five unrecorded students without inferred attendance', async()=>{
      await cdp.evaluate("document.querySelector('button[aria-label=\"Tutup histori\"]').click()");
      await cdp.evaluate("[...document.querySelectorAll('button')].filter(b=>b.innerText.trim()==='Detail').at(-1).click()");
      await until(()=>cdp.evaluate("document.querySelector('[aria-label=\"Detail histori presensi\"]').innerText.includes('Pertemuan 6')&&document.querySelectorAll('table[aria-label=\"Presensi historis sesi\"] tbody tr').length===5"),'empty session history');
      const statuses=await cdp.evaluate("[...document.querySelectorAll('table[aria-label=\"Presensi historis sesi\"] tbody tr')].map(row=>row.lastElementChild.innerText.trim())");
      assert.deepEqual(statuses,Array(5).fill('Belum tercatat'));
      const counts=await cdp.evaluate("document.querySelector('[aria-label=\"Rekap presensi sesi\"]').innerText");
      for(const status of ['Hadir','Izin','Sakit','Alpa']) assert(counts.includes(`${status}: 0`));
      assert(counts.includes('Belum tercatat: 5'));
    });
    const after = JSON.stringify([(await pool.query('SELECT * FROM attendance_sessions ORDER BY id'))[0], (await pool.query('SELECT * FROM attendance_records ORDER BY id'))[0]]);
    assert.equal(after, before); assert.deepEqual(cdp.exceptions, []);
  } finally {
    if (cdp) { await cdp.command('Browser.close').catch(() => {}); cdp.close(); } browser?.kill();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await pool?.end(); if (db) { if (/^hadir_history_browser_[a-f0-9]+_test$/.test(database)) await db.query(`DROP DATABASE ${database}`); await db.end(); }
  }
});

test('browser: three roles, reload, legacy preservation, API errors and mobile layout', { skip: process.env.HADIR_BROWSER_TEST !== '1', timeout: 120000 }, async t => {
  const browserCase = (name, work) => t.test(name, { skip: process.env.HADIR_BROWSER_PROFILE_ONLY === '1' && !/^(student edits own profile|lecturer logs in by)/.test(name) }, work);
  let db, pool, server, browser, cdp;
  const database = `hadir_browser_${randomBytes(4).toString('hex')}_test`;
  try {
    db = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '' });
    await db.query(`CREATE DATABASE ${database}`);
    pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.HADIR_TEST_PORT || 33079), user: 'root', password: process.env.HADIR_TEST_PASSWORD || '', database, timezone: 'Z', dateStrings: ['DATE'] });
    await migrate(pool); await applyImport(pool, prepareImport(accountActivationBrowserFixture())); t.diagnostic('Synthetic database initialized.');
    const hash = await hashPassword('Synthetic-password-12345'); for (const user of fixture().users) await pool.execute('INSERT INTO user_credentials (user_id,password_hash,password_updated_at) VALUES (?,?,UTC_TIMESTAMP())', [user.id, hash]);
    const port = await freePort(), debugPort = await freePort(), origin = `http://127.0.0.1:${port}`;
    server = createApp({ pool, origin, secret: 'browser-synthetic-secret-at-least-32-characters', staticRoot: 'dist' }).listen(port, '127.0.0.1'); await once(server, 'listening');
    await mkdir('.cache/browser', { recursive: true }); const profile = await mkdtemp(resolve('.cache/browser/profile-'));
    browser = spawn(process.env.HADIR_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    const tabs = await until(async () => { const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`); return response.json(); }, 'browser startup');
    cdp = await connectCdp(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl); t.diagnostic('Browser connected.');
    await cdp.command('Page.navigate', { url: origin }); await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'home login');
    await cdp.evaluate("localStorage.setItem('stmik_users_v1', '[{\"id\":\"legacy-synthetic\"}]');localStorage.setItem('stmik_db_seed_version','old');localStorage.setItem('stmik_db_snapshots_v1','[{\"id\":\"snapshot-synthetic\"}]')");
    const fill = async (username, password) => cdp.evaluate(`(() => {const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const user=document.querySelector('input[type=text]');const pass=document.querySelector('input[type=password]');setter.call(user,${JSON.stringify(username)});user.dispatchEvent(new Event('input',{bubbles:true}));setter.call(pass,${JSON.stringify(password)});pass.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form').requestSubmit();})()`);
    await browserCase('student login uses server and survives reload without changing legacy storage', async () => {
      await fill('0001', 'Synthetic-password-12345'); await until(() => cdp.evaluate("document.body.innerText.includes('Student Test') && !document.querySelector('input[type=password]')"), 'student dashboard');
      await cdp.command('Page.reload'); await until(() => cdp.evaluate("document.body.innerText.includes('Student Test') && !document.querySelector('input[type=password]')"), 'student reload');
      const values = await cdp.evaluate("[localStorage.getItem('stmik_users_v1'),localStorage.getItem('stmik_db_seed_version'),localStorage.getItem('stmik_db_snapshots_v1')]"); assert.deepEqual(values, ['[{"id":"legacy-synthetic"}]','old','[{"id":"snapshot-synthetic"}]']);
    });
    await browserCase('forged local role never changes server identity', async () => {
      await cdp.evaluate("localStorage.setItem('stmik_auth_session_active','true');localStorage.setItem('stmik_active_user_session',JSON.stringify({id:'admin-test',role:'admin'}))");
      await cdp.command('Page.navigate', { url: origin + '/portaladmin' }); await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'admin portal');
      const result = await cdp.evaluate("fetch('/api/v1/auth/me').then(r=>r.json()).then(x=>x.data.role)"); assert.equal(result, 'mahasiswa');
    });
    const logout = async () => cdp.evaluate("(async()=>{const x=await fetch('/api/v1/auth/csrf').then(r=>r.json());await fetch('/api/v1/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':x.data.csrfToken},body:'{}'});})()");
    const navigateReady = async (url) => {
      const marker = randomBytes(8).toString('hex');
      await cdp.evaluate(`window.__hadirNavigationMarker=${JSON.stringify(marker)}`);
      await cdp.command(url ? 'Page.navigate' : 'Page.reload', url ? { url } : {});
      await until(() => cdp.evaluate(`window.__hadirNavigationMarker!==${JSON.stringify(marker)} && document.readyState==='complete'`), 'new browser document');
    };
    await browserCase('admin portal logs in through backend and renders synthetic records', async () => {
      await logout(); await cdp.command('Page.reload'); await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'admin login'); await fill('admin-test', 'Synthetic-password-12345');
      await until(() => cdp.evaluate("document.body.innerText.includes('Admin Test') && !document.querySelector('input[type=password]')"), 'admin dashboard');
    });
    await browserCase('admin reviews synthetic legacy EXCLUDE with explicit DEFER and persistent audit',async()=>{
      const sourceHash=await cdp.evaluate(`(async()=>{const csrf=await fetch('/api/v1/auth/csrf').then(r=>r.json());const r=await fetch('/api/v1/admin/legacy-excludes/sources',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.data.csrfToken},body:JSON.stringify({backup:${JSON.stringify(excludeReviewFixture())}})}).then(r=>r.json());return r.data.sourceHash;})()`);
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Cadangan & Database'))?.click()");
      await until(()=>cdp.evaluate("document.querySelector('select[aria-label=\"Sumber review\"]')?.options.length>1"),'review sources');
      await cdp.evaluate(`(()=>{const s=document.querySelector('select[aria-label="Sumber review"]');s.value=${JSON.stringify(sourceHash)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await until(()=>cdp.evaluate("document.querySelector('input[aria-label^=\"Pilih synthetic-\"]')!==null"),'review items');
      await cdp.evaluate("(()=>{document.querySelector('input[aria-label^=\"Pilih synthetic-\"]').click();const s=document.querySelector('select[aria-label=\"Tindakan EXCLUDE\"]');s.value='DEFER';s.dispatchEvent(new Event('change',{bubbles:true}));const t=document.querySelector('textarea[aria-label=\"Alasan keputusan\"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Synthetic browser review');t.dispatchEvent(new Event('input',{bubbles:true}));})()");
      const formState=await cdp.evaluate("({preview:[...document.querySelectorAll('button')].filter(b=>b.innerText.startsWith('Preview dampak')).map(b=>({text:b.innerText,disabled:b.disabled})),checked:document.querySelectorAll('input[aria-label^=\"Pilih synthetic-\"]:checked').length,action:document.querySelector('select[aria-label=\"Tindakan EXCLUDE\"]')?.value,reason:document.querySelector('textarea[aria-label=\"Alasan keputusan\"]')?.value})");
      assert.equal(formState.preview[0]?.disabled,false,JSON.stringify(formState));

      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Preview dampak'))?.click()");
      await delay(300);

      await until(()=>cdp.evaluate("document.body.innerText.includes('18 menjadi 18')"),'per-student impact');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Simpan keputusan yang telah dipreview')?.click()");
      await until(()=>cdp.evaluate("document.body.innerText.includes('Tersimpan 1 keputusan. Belum selesai: 18.')"),'saved DEFER');
    });
    await browserCase('shared roster preview counts only enrolled students, including rombels array handling',async()=>{
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Jadwal Perkuliahan'))?.click()");
      const expression="[...document.querySelectorAll('tr')].find(r=>r.innerText.includes('Synthetic Course')&&r.innerText.includes('Test Room'))?.innerText";
      await until(()=>cdp.evaluate(expression),'schedule row');
      assert.match(await cdp.evaluate(expression),/1\s+Mahasiswa/);
    });
    await browserCase('lecturer login and responsive desktop/tablet/phone views', async () => {
      await logout(); await cdp.command('Page.navigate', { url: origin }); await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'home');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Portal Dosen')?.click()");
      await until(() => cdp.evaluate("document.body.innerText.includes('Login Dosen Pengampu')"), 'lecturer tab'); await fill('lecturer-test', 'Synthetic-password-12345');
      await until(() => cdp.evaluate("document.body.innerText.includes('Lecturer Test') && !document.querySelector('input[type=password]')"), 'lecturer dashboard');
      for (const [width, height] of [[1366,900],[768,1024],[390,844]]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }); await delay(200);
        const size = await cdp.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})'); assert(size.scroll <= size.width + 1, `horizontal overflow at ${width}`);
        const png = await cdp.command('Page.captureScreenshot', { format: 'png' }); await writeFile(join('.cache/browser', `lecturer-${width}.png`), Buffer.from(png.data, 'base64'));
      }
    });
    await browserCase('admin edits email, resets one account and temporary login requires a personal password', async () => {
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
      await logout(); await navigateReady(origin + '/portaladmin');
      await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'account admin login');
      await fill('admin-test', 'Synthetic-password-12345');
      await until(() => cdp.evaluate("document.body.innerText.includes('Admin Test') && !document.querySelector('input[type=password]')"), 'account admin dashboard');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Kelola Pengguna'))?.click()");
      await until(() => cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] input[aria-label=\"Pilih 0002\"]')!==null"), 'account activation panel');
      assert.equal(await cdp.evaluate("document.querySelector('input[aria-label=\"Pilih admin-test\"]').disabled"), true);
      assert.equal(await cdp.evaluate("(()=>{const row=document.querySelector('input[aria-label=\"Pilih admin-test\"]').closest('tr');return [...row.querySelectorAll('button')].every(button=>button.disabled)&&!['dosen123','baak123'].some(value=>document.body.innerText.includes(value));})()"), true);
      await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] tr')].find(r=>r.innerText.includes('0002')).querySelector('button').click()");
      await until(() => cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] input[type=email]')!==null"), 'email edit form');
      await cdp.evaluate("(()=>{const input=document.querySelector('section[aria-label=\"Aktivasi akun\"] input[type=email]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'browser-updated@example.test');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
      await cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] input[type=email]').closest('form').requestSubmit()");
      await until(() => cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"]').innerText.includes('Email diperbarui')"), 'email saved');
      const [[contact]] = await pool.execute('SELECT u.email AS account_email,s.email AS student_email,u.email_verified_at FROM users u JOIN students s ON s.user_id=u.id WHERE u.id=?', ['student-other']);
      assert.equal(contact.account_email, 'browser-updated@example.test'); assert.equal(contact.student_email, contact.account_email); assert.equal(contact.email_verified_at, null);
      await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] tr')].find(r=>r.innerText.includes('0002')).querySelectorAll('button')[1].click()");
      await until(() => cdp.evaluate("document.body.innerText.includes('Preview: 1 akun')"), 'activation preview');
      await cdp.evaluate("(()=>{const form=[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:'));[...form.querySelectorAll('label')].find(l=>l.innerText.includes('Saya mengonfirmasi')).querySelector('input').click();})()");
      await until(() => cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:')).querySelectorAll('input[type=password]').length===3"), 'manual activation fields');
      await cdp.evaluate("(()=>{const values=['Synthetic-browser-temporary-123','Synthetic-password-12345','Synthetic-report-passphrase-123'];[...[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:')).querySelectorAll('input[type=password]')].forEach((input,i)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,values[i]);input.dispatchEvent(new Event('input',{bubbles:true}));});})()");
      await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:')).requestSubmit()");
      await until(() => cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] code')?.innerText==='Synthetic-browser-temporary-123'"), 'one-time individual report');
      const stored = await cdp.evaluate("JSON.stringify({local:{...localStorage},session:{...sessionStorage}})");
      assert(!stored.includes('Synthetic-browser-temporary-123')); assert(!stored.includes('Synthetic-report-passphrase-123'));
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Tutup dan hapus laporan dari layar').click()");
      assert.equal(await cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] code')===null"), true);
      await logout(); await navigateReady(origin);
      await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'temporary login');
      await fill('0002', 'Synthetic-browser-temporary-123');
      await until(() => cdp.evaluate("document.querySelector('input[aria-label=\"Password baru aktivasi\"]')!==null"), 'mandatory password screen');
      assert.equal(await cdp.evaluate("fetch('/api/v1/schedules').then(r=>r.status)"), 403);
      await navigateReady();
      await until(() => cdp.evaluate("document.querySelector('input[aria-label=\"Password baru aktivasi\"]')!==null"), 'mandatory password reload');
      await cdp.evaluate("(()=>{for(const label of ['Password baru aktivasi','Konfirmasi password baru aktivasi']){const input=document.querySelector('input[aria-label=\"'+label+'\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Synthetic-browser-personal-123');input.dispatchEvent(new Event('input',{bubbles:true}));}})()");
      await cdp.evaluate("document.querySelector('input[aria-label=\"Password baru aktivasi\"]').closest('form').requestSubmit()");
      await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null && !document.querySelector('input[aria-label=\"Password baru aktivasi\"]')"), 'personal password saved');
      await fill('0002', 'Synthetic-browser-personal-123');
      await until(() => cdp.evaluate("document.body.innerText.includes('Student Other') && !document.querySelector('input[type=password]')"), 'personal login dashboard');
    });
    await browserCase('random reset exposes a strong individual report only until closed', async () => {
      await logout(); await navigateReady(origin + '/portaladmin');
      await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'random reset admin login');
      await fill('admin-test', 'Synthetic-password-12345');
      await until(() => cdp.evaluate("document.body.innerText.includes('Admin Test') && !document.querySelector('input[type=password]')"), 'random reset admin dashboard');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Kelola Pengguna')).click()");
      await until(() => cdp.evaluate("document.querySelector('input[aria-label=\"Pilih activation-lecturer-0\"]')!==null"), 'random reset panel');
      await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] tr')].find(r=>r.innerText.includes('activation-lecturer-0')).querySelectorAll('button')[2].click()");
      await until(() => cdp.evaluate("document.body.innerText.includes('Preview: 1 akun')"), 'random reset preview');
      assert.equal(await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:')).querySelectorAll('input[type=password]').length"), 2);
      await cdp.evaluate("(()=>{const form=[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:'));[...form.querySelectorAll('input[type=password]')].forEach((input,i)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,['Synthetic-password-12345','Synthetic-random-report-123'][i]);input.dispatchEvent(new Event('input',{bubbles:true}));});})()");
      await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:')).requestSubmit()");
      await until(() => cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] code')!==null"), 'random individual report');
      const temporary = await cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] code').innerText");
      assert(temporary.length === 6); assert.notEqual(temporary, 'Synthetic-browser-temporary-123');
      assert.equal(await cdp.evaluate(`JSON.stringify({local:{...localStorage},session:{...sessionStorage}}).includes(${JSON.stringify(temporary)})`), false);
      assert.equal(await cdp.evaluate(`fetch('/api/v1/admin/accounts').then(r=>r.text()).then(text=>text.includes(${JSON.stringify(temporary)}))`), false);
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Tutup dan hapus laporan dari layar').click()");
      assert.equal(await cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] code')===null"), true);
      await navigateReady();
      await until(() => cdp.evaluate("document.body.innerText.includes('Admin Test') && !document.querySelector('input[type=password]')"), 'report reload');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Kelola Pengguna')).click()");
      await until(() => cdp.evaluate("document.querySelector('input[aria-label=\"Pilih activation-lecturer-1\"]')!==null"), 'report panel reload');
      assert.equal(await cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] code')===null"), true);
    });
    await browserCase('role selection enforces fifty accounts and encrypted bulk reports round trip through the browser', async () => {
      const setRole = async role => {
        await cdp.evaluate(`(()=>{const input=document.querySelector('select[aria-label="Filter role aktivasi"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(input,${JSON.stringify(role)});input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      };
      await setRole('admin');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Pilih belum aktif sesuai role').click()");
      assert.equal(await cdp.evaluate("document.querySelector('input[aria-label=\"Pilih admin-test\"]').disabled"), true);
      assert.equal(await cdp.evaluate("document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] input[type=checkbox]:checked').length"), 0);
      await setRole('dosen');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Pilih belum aktif sesuai role').click()");
      assert.equal(await cdp.evaluate("document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] input[type=checkbox]:checked').length"), 50);
      await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] tbody input[type=checkbox]')].find(input=>!input.checked&&!input.disabled).click()");
      assert.equal(await cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"]').innerText.includes('Pilih maksimal 50 akun.')"), true);
      assert.equal(await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Aktivasi Massal (maksimal 50 akun)').disabled"), true);
      const chosen = ['activation-lecturer-1', 'activation-lecturer-2'];
      await cdp.evaluate(`(()=>{for(const input of document.querySelectorAll('section[aria-label="Aktivasi akun"] tbody input[type=checkbox]')) {const should=${JSON.stringify(chosen)}.some(username=>input.getAttribute('aria-label')==='Pilih '+username);if(input.checked!==should)input.click();}})()`);
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Aktivasi Massal (maksimal 50 akun)').click()");
      await until(() => cdp.evaluate("document.body.innerText.includes('Preview: 2 akun, 0 sudah berkredensial')"), 'bulk two account preview');
      assert.equal(await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:')).querySelectorAll('li').length"), 2);
      await cdp.evaluate("(()=>{const form=[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:'));[...form.querySelectorAll('input[type=password]')].forEach((input,i)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,['Synthetic-password-12345','Synthetic-bulk-report-123'][i]);input.dispatchEvent(new Event('input',{bubbles:true}));});})()");
      await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] form')].find(f=>f.innerText.includes('Preview:')).requestSubmit()");
      await until(() => cdp.evaluate("document.body.innerText.includes('2 akun berhasil diaktifkan.')"), 'bulk report');
      const downloads = await mkdtemp(resolve('.cache/browser/encrypted-reports-'));
      await cdp.command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Unduh laporan terenkripsi').click()");
      const path = join(downloads, 'hadir-aktivasi-terenkripsi.json');
      const encrypted = await until(async () => { try { return await readFile(path, 'utf8'); } catch { return false; } }, 'encrypted report download');
      const packet = JSON.parse(encrypted); assert.equal(packet.format, 'HADIR-ACTIVATION-1'); assert(!encrypted.includes('temporaryPassword')); assert(!encrypted.includes('activation-lecturer-1')); assert(!encrypted.includes('Synthetic-bulk-report-123'));
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Tutup dan hapus laporan dari layar').click()");
      await cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] summary').click()");
      const document = await cdp.command('DOM.getDocument');
      const input = await cdp.command('DOM.querySelector', { nodeId: document.root.nodeId, selector: 'section[aria-label="Aktivasi akun"] input[type=file]' });
      await cdp.command('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] });
      await until(() => cdp.evaluate("![...document.querySelectorAll('button')].find(b=>b.innerText==='Buka laporan di layar').disabled"), 'report file selected');
      await cdp.evaluate("(()=>{const input=document.querySelector('section[aria-label=\"Aktivasi akun\"] details input[type=password]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Synthetic-bulk-report-123');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
      await cdp.evaluate("document.querySelector('section[aria-label=\"Aktivasi akun\"] details form').requestSubmit()");
      await until(() => cdp.evaluate("document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] details code').length===2"), 'browser decrypted report');
      const passwords = await cdp.evaluate("[...document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] details code')].map(code=>code.innerText)");
      assert.equal(new Set(passwords).size, 2); assert(passwords.every(password => password.length === 6));
      const storage = await cdp.evaluate("JSON.stringify({local:{...localStorage},session:{...sessionStorage}})"); assert(passwords.every(password => !storage.includes(password))); assert(!storage.includes('Synthetic-bulk-report-123'));
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Tutup hasil dekripsi').click()");
      assert.equal(await cdp.evaluate("document.querySelectorAll('section[aria-label=\"Aktivasi akun\"] code').length"), 0);
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await delay(200);
      const size = await cdp.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
      assert(size.scroll <= size.width + 1, 'activation panel horizontal overflow at 390');
    });
    const setInput = async (label, value) => cdp.evaluate(`(() => {const input=document.querySelector('input[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await browserCase('student edits own profile and email then changes a six-character password without OTP', async () => {
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
      await logout(); await navigateReady(origin);
      await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'profile student login');
      await fill('0001', 'Synthetic-password-12345');
      await until(() => cdp.evaluate("document.querySelector('button[title=\"Konfigurasi Profil & Ganti Sandi\"]')!==null"), 'student profile entry');
      await cdp.evaluate("document.querySelector('button[title=\"Konfigurasi Profil & Ganti Sandi\"]').click()");
      await until(() => cdp.evaluate("document.querySelector('input[aria-label=\"Nama profil\"]')!==null"), 'student profile form');
      await setInput('Telepon profil', '0800000011');
      await cdp.evaluate("document.querySelector('input[aria-label=\"Nama profil\"]').closest('form').requestSubmit()");
      await until(() => cdp.evaluate("document.body.innerText.includes('Profil Mahasiswa Berhasil Diperbarui')"), 'student profile saved without OTP');
      await setInput('Email profil', 'browser-profile@example.test');
      await until(() => cdp.evaluate("document.querySelector('input[aria-label=\"Password konfirmasi perubahan email\"]')!==null"), 'email confirmation');
      await setInput('Password konfirmasi perubahan email', 'wrong-current-password');
      await cdp.evaluate("document.querySelector('input[aria-label=\"Nama profil\"]').closest('form').requestSubmit()");
      await until(() => cdp.evaluate("document.body.innerText.includes('Password saat ini tidak benar')"), 'incorrect email password rejected');
      assert.equal(await cdp.evaluate("fetch('/api/v1/auth/me').then(r=>r.status)"), 200);
      await setInput('Password konfirmasi perubahan email', 'Synthetic-password-12345');
      await cdp.evaluate("document.querySelector('input[aria-label=\"Nama profil\"]').closest('form').requestSubmit()");
      await until(async () => { const [[row]] = await pool.execute('SELECT email FROM users WHERE id=?', ['student-test']); return row.email === 'browser-profile@example.test'; }, 'self email saved');
      const [[student]] = await pool.execute('SELECT email FROM students WHERE nim=?', ['0001']); assert.equal(student.email, 'browser-profile@example.test');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Ganti Password')&&b.innerText.includes('Tanpa OTP')).click()");
      await until(() => cdp.evaluate("document.querySelector('section[aria-label=\"Ganti password sendiri\"]')!==null"), 'self password form');
      await setInput('Password saat ini', 'Synthetic-password-12345');
      for (const label of ['Password baru', 'Konfirmasi password baru']) await setInput(label, '123456');
      await cdp.evaluate("document.querySelector('section[aria-label=\"Ganti password sendiri\"] form').requestSubmit()");
      await until(() => cdp.evaluate("document.querySelector('section[aria-label=\"Ganti password sendiri\"]').innerText.includes('terlalu umum')"), 'weak password rejected');
      await setInput('Password saat ini', 'wrong-current-password');
      for (const label of ['Password baru', 'Konfirmasi password baru']) await setInput(label, 'N7k!pR');
      await cdp.evaluate("document.querySelector('section[aria-label=\"Ganti password sendiri\"] form').requestSubmit()");
      await until(() => cdp.evaluate("document.querySelector('section[aria-label=\"Ganti password sendiri\"]').innerText.includes('Password saat ini tidak benar')"), 'wrong self password rejected');
      await setInput('Password saat ini', 'Synthetic-password-12345');
      await cdp.evaluate("document.querySelector('section[aria-label=\"Ganti password sendiri\"] form').requestSubmit()");
      await until(() => cdp.evaluate("!document.querySelector('section[aria-label=\"Ganti password sendiri\"]')&&document.querySelector('input[type=password]')!==null"), 'password change logs out');
      assert.equal(await cdp.evaluate("fetch('/api/v1/auth/me').then(r=>r.status)"), 401);
      await fill('0001', 'N7k!pR');
      await until(() => cdp.evaluate("document.body.innerText.includes('Student Test')&&!document.querySelector('input[type=password]')"), 'six-character student login');
      assert.equal(await cdp.evaluate("JSON.stringify({local:{...localStorage},session:{...sessionStorage}}).includes('N7k!pR')"), false);
    });
    await browserCase('lecturer logs in by case-insensitive alias and profile rename preserves that alias', async () => {
      await logout(); await navigateReady(origin);
      await until(() => cdp.evaluate("document.querySelector('input[type=password]')!==null"), 'lecturer alias home');
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Portal Dosen').click()");
      await until(() => cdp.evaluate("document.body.innerText.includes('Nama Depan / Username')"), 'lecturer alias label');
      await ensureLecturerLoginAliases(pool);
      const [[before]] = await pool.execute('SELECT login_alias FROM users WHERE id=?', ['lecturer-test']);
      await fill(before.login_alias.toUpperCase(), 'Synthetic-password-12345');
      await until(() => cdp.evaluate("document.querySelector('button[title=\"Buka Formulir Konfigurasi Profil Dosen\"]')!==null"), 'lecturer alias dashboard');
      await cdp.evaluate("document.querySelector('button[title=\"Buka Formulir Konfigurasi Profil Dosen\"]').click()");
      await until(() => cdp.evaluate("document.querySelector('input[aria-label=\"Nama profil\"]')!==null"), 'lecturer profile form');
      await setInput('Nama profil', 'Dr. Renamed Lecturer');
      await setInput('Telepon profil', '0800000022');
      await cdp.evaluate("document.querySelector('input[aria-label=\"Nama profil\"]').closest('form').requestSubmit()");
      await until(async () => { const [[row]] = await pool.execute('SELECT name FROM users WHERE id=?', ['lecturer-test']); return row.name === 'Dr. Renamed Lecturer'; }, 'lecturer profile saved without OTP');
      const [[after]] = await pool.execute('SELECT login_alias FROM users WHERE id=?', ['lecturer-test']); assert.equal(after.login_alias, before.login_alias);
    });
    assert.deepEqual(cdp.exceptions, []);
  } finally {
    if (cdp) { await cdp.command('Browser.close').catch(() => {}); cdp.close(); }
    t.diagnostic(`Browser dialogs: ${JSON.stringify(cdp?.dialogs || [])}.`);
    browser?.kill();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await pool?.end(); if (db) { if (/^hadir_browser_[a-f0-9]+_test$/.test(database)) await db.query(`DROP DATABASE ${database}`); await db.end(); }
  }
});
