import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { createApp } from '../../backend/app.mjs';
import { migrate } from '../../backend/migrate.mjs';
import { ensureLecturerLoginAliases } from '../../backend/lecturer-login.mjs';
import { prepareImport, applyImport } from '../../backend/importer.mjs';
import { hashPassword } from '../../backend/security.mjs';
import { historicalAttendanceFixture } from '../fixtures.mjs';

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
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Page.javascriptDialogOpening') { dialogs.push(message.params.type); void command('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); } });
  const evaluate = async expression => { const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  await command('Runtime.enable'); await command('Page.enable');
  return { command, evaluate, exceptions, dialogs, close: () => socket.close() };
}

test('browser: flexible sessions and durable automatic roll-call', {skip:process.env.HADIR_BROWSER_TEST!=='1',timeout:150000},async t=>{
  let db,pool,server,browser,cdp;
  const database=`hadir_flexible_browser_${randomBytes(4).toString('hex')}_test`;
  try{
    const connection={host:'127.0.0.1',port:Number(process.env.HADIR_TEST_PORT||33079),user:'root',password:process.env.HADIR_TEST_PASSWORD||''};
    db=await mysql.createConnection(connection);await db.query(`CREATE DATABASE ${database}`);
    pool=mysql.createPool({...connection,database,timezone:'Z',dateStrings:['DATE']});await migrate(pool);
    const candidate=prepareImport(historicalAttendanceFixture());assert(candidate.valid);await applyImport(pool,candidate);
    await pool.execute('INSERT INTO user_credentials(user_id,password_hash) VALUES (?,?)',['lecturer-test',await hashPassword('Synthetic-history-password-123')]);await ensureLecturerLoginAliases(pool);
    const port=await freePort(),debugPort=await freePort(),origin=`http://127.0.0.1:${port}`;
    server=createApp({pool,origin,secret:'Synthetic-flexible-secret-more-than-32-characters',staticRoot:'dist'}).listen(port,'127.0.0.1');await once(server,'listening');
    await mkdir('.cache/browser',{recursive:true});const profile=await mkdtemp(resolve('.cache/browser/flexible-'));
    browser=spawn(process.env.HADIR_BROWSER_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions',`--remote-debugging-port=${debugPort}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
    const tabs=await until(async()=> (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(),'browser startup');cdp=await connectCdp(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
    const click=async text=>cdp.evaluate(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(text)}).click()`);
    const input=async(selector,value,tag='HTMLInputElement')=>{await cdp.evaluate(`(()=>{const scope=document.querySelector('input[aria-label="Jam mulai sesi"]')?.closest('form')||document;const e=scope.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${tag}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(80);};
    const status=async(nim,value)=>cdp.evaluate(`document.querySelector('button[aria-label="${value} ${nim}"]').click()`);
    const persisted=async(nim,value)=>until(async()=>{const [rows]=await pool.execute("SELECT status,notes FROM attendance_records WHERE session_id='history-session-1' AND student_nim=?",[nim]);return rows[0]?.status===value&&rows[0];},'persisted '+nim+' '+value);
    const manual=async()=>{await click('Riwayat Sesi (6)');await until(()=>cdp.evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Presensi Manual')"),'history manual action');await cdp.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Presensi Manual'&&b.parentElement.parentElement.innerText.includes('Synthetic historical meeting 1')).click()");await until(()=>cdp.evaluate("document.querySelector('button[aria-label=\"Hadir 0001\"]')!==null"),'manual roster');};
    await cdp.command('Page.navigate',{url:origin});await until(()=>cdp.evaluate("document.querySelector('input[type=password]')!==null"),'login');await click('Portal Dosen');await until(()=>cdp.evaluate("document.body.innerText.includes('Nama Depan / Username')"),'lecturer tab');await input('input[type=text]','lecturer-test');await input('input[type=password]','Synthetic-history-password-123');await cdp.evaluate("document.querySelector('form').requestSubmit()");await until(()=>cdp.evaluate("document.querySelector('select[aria-label=\"Pertemuan schedule-test\"]')!==null"),'dashboard');
    await t.test('history opens exact existing meeting with raw status summary',async()=>{await manual();assert.equal(await cdp.evaluate("document.querySelector('select[aria-label=\"Sesi presensi manual\"]').value==='history-session-1'"),true);const summary=await cdp.evaluate("document.querySelector('[aria-label=\"Rekap draft presensi\"]').innerText");for(const label of ['Hadir: 1','Izin: 1','Sakit: 1','Alpa: 1','Belum tercatat: 1'])assert(summary.includes(label),summary);await writeFile('.cache/browser/flexible-rollcall-desktop.png',Buffer.from((await cdp.command('Page.captureScreenshot',{format:'png'})).data,'base64'));});
    await t.test('status and note autosave persist after reload without reopening closed history',async()=>{
      for(const value of ['Hadir','Izin','Sakit']){await status('0004',value);await persisted('0004',({Hadir:'HADIR',Izin:'IZIN',Sakit:'SAKIT'})[value]);}
      await input('input[aria-label="Alasan 0004"]','Synthetic autosaved note');await until(async()=>{const [[r]]=await pool.query("SELECT notes FROM attendance_records WHERE session_id='history-session-1' AND student_nim='0004'");return r.notes==='Synthetic autosaved note';},'saved note');
      assert.equal((await pool.query("SELECT is_open FROM attendance_sessions WHERE id='history-session-1'"))[0][0].is_open,0);
      await cdp.command('Page.reload',{ignoreCache:true});await until(()=>cdp.evaluate("document.querySelector('select[aria-label=\"Pertemuan schedule-test\"]')!==null"),'reload');await manual();assert.equal(await cdp.evaluate("document.querySelector('button[aria-label=\"Sakit 0004\"]').getAttribute('aria-pressed')"),'true');assert.equal(await cdp.evaluate("document.querySelector('input[aria-label=\"Alasan 0004\"]').value"),'Synthetic autosaved note');
    });
    await t.test('failed autosave stays visible and Done cannot discard pending status',async()=>{
      await cdp.evaluate("window.__realFetch=window.fetch;window.fetch=(...a)=>String(a[0]).includes('/records/batch')?Promise.resolve(new Response(JSON.stringify({error:{code:'SYNTHETIC_FAILURE',message:'Synthetic save failure'}}),{status:503,headers:{'Content-Type':'application/json'}})):window.__realFetch(...a)");await status('0004','Hadir');await until(()=>cdp.evaluate("document.querySelector('[aria-label=\"Kelola Presensi Manual\"] footer')?.innerText.includes('Belum tersimpan')"),'save error settled');assert.equal(await cdp.evaluate("document.querySelector('[aria-label=\"Kelola Presensi Manual\"] footer').innerText.includes('Belum tersimpan')"),true);assert.equal((await pool.query("SELECT status FROM attendance_records WHERE session_id='history-session-1' AND student_nim='0004'"))[0][0].status,'SAKIT');await click('Selesai');assert.equal(await cdp.evaluate("document.querySelector('[aria-label=\"Kelola Presensi Manual\"]')!==null"),true);await cdp.evaluate('window.fetch=window.__realFetch');
      await status('0004','Izin');await persisted('0004','IZIN');
    });
    await t.test('bulk actions confirm and Alpha-only preserves unrecorded roster',async()=>{
      await status('0004','Alpa');await persisted('0004','ALPHA');await until(()=>cdp.evaluate("![...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Hadirkan Sisa Alpa').disabled"),'save settled before bulk');const confirmations=cdp.dialogs.filter(kind=>kind==='confirm').length;await click('Hadirkan Sisa Alpa');await until(()=>cdp.dialogs.filter(kind=>kind==='confirm').length===confirmations+1,'Alpha confirmation');await persisted('0004','HADIR');assert.equal((await pool.query("SELECT COUNT(*) n FROM attendance_records WHERE session_id='history-session-1' AND student_nim='0005'"))[0][0].n,0);
      await until(()=>cdp.evaluate("![...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Semua Hadir').disabled"),'Alpha bulk settled');await click('Semua Hadir');await until(()=>cdp.dialogs.filter(kind=>kind==='confirm').length===confirmations+2,'all-present confirmation');await persisted('0005','HADIR');const [[r]]=await pool.query("SELECT COUNT(*) n FROM attendance_records WHERE session_id='history-session-1' AND status='HADIR'");assert.equal(r.n,5);
    });
    await t.test('mobile roster scrolls inside modal and retains controls',async()=>{await cdp.command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await cdp.evaluate("(()=>{const table=document.querySelector('[aria-label=\"Tabel presensi manual\"]');return table.parentElement.scrollWidth>table.parentElement.clientWidth&&!![...document.querySelectorAll('button')].find(b=>b.innerText==='Selesai')})()"),true);await writeFile('.cache/browser/flexible-rollcall-mobile.png',Buffer.from((await cdp.command('Page.captureScreenshot',{format:'png'})).data,'base64'));await cdp.command('Emulation.clearDeviceMetricsOverride');await until(()=>cdp.evaluate("![...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Selesai').disabled"),'bulk save settled');await click('Selesai');await until(()=>cdp.evaluate("document.querySelector('[aria-label=\"Kelola Presensi Manual\"]')===null"),'done');});
    await t.test('backdated new session accepts flexible hours and renders QR',async()=>{
      await cdp.command('Page.reload',{ignoreCache:true});await until(()=>cdp.evaluate("document.querySelector('select[aria-label=\"Pertemuan schedule-same-course\"]')!==null"),'schedule');await cdp.evaluate("[...document.querySelector('select[aria-label=\"Pertemuan schedule-same-course\"]').closest('.frost-card').querySelectorAll('button')].find(b=>b.innerText.trim()==='Buka Sesi').click()");await until(()=>cdp.evaluate("document.querySelector('input[aria-label=\"Jam mulai sesi\"]')!==null"),'create modal');await input('input[type=date]','2020-01-01');await input('input[aria-label="Jam mulai sesi"]','10:00');await input('input[aria-label="Jam selesai sesi"]','11:00');await click('Presensi QR');await until(()=>cdp.evaluate("document.querySelector('canvas')?.width>0"),'new QR');const [sessions]=await pool.query("SELECT id,date,meeting_number FROM attendance_sessions WHERE schedule_id='schedule-same-course'");assert.equal(sessions.length,1);assert.equal(sessions[0].date,'2020-01-01');assert.equal((await pool.query('SELECT COUNT(*) n FROM attendance_records WHERE session_id=?',[sessions[0].id]))[0][0].n,0);
    });
    await t.test('close confirmation sits above manual modal and accepts a real pointer click',async()=>{
      const [[session]]=await pool.query("SELECT id FROM attendance_sessions WHERE schedule_id='schedule-same-course'");
      const original=JSON.stringify((await pool.query('SELECT * FROM attendance_records WHERE session_id<>? ORDER BY id',[session.id]))[0]);
      await cdp.evaluate("[...document.querySelectorAll('button')].filter(b=>b.innerText.trim()==='Presensi Manual').at(-1).click()");await until(()=>cdp.evaluate("document.querySelector('button[aria-label=\"Hadir 0001\"]')!==null"),'new manual roster');assert.equal(await cdp.evaluate("document.querySelector('select[aria-label=\"Sesi presensi manual\"]').value"),session.id);await status('0001','Hadir');
      await until(async()=>{const [[r]]=await pool.query('SELECT COUNT(*) n FROM attendance_records WHERE session_id=? AND student_nim=? AND status=?',[session.id,'0001','HADIR']);return r.n===1;},'new manual saved');
      await until(()=>cdp.evaluate("![...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Akhiri Sesi Kuliah').disabled"),'new manual settled');await click('Akhiri Sesi Kuliah');
      await until(()=>cdp.evaluate("[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Ya, Akhiri Sesi')"),'close confirmation');
      await delay(250);
      const point=await cdp.evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Ya, Akhiri Sesi');const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,onTop:b.contains(document.elementFromPoint(x,y))};})()");assert.equal(point.onTop,true);
      await cdp.command('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await cdp.command('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
      await until(async()=>{const [[r]]=await pool.query('SELECT is_open FROM attendance_sessions WHERE id=?',[session.id]);return r.is_open===0;},'pointer closed session');
      const [[saved]]=await pool.query('SELECT status FROM attendance_records WHERE session_id=? AND student_nim=?',[session.id,'0001']);assert.equal(saved.status,'HADIR');assert.equal(JSON.stringify((await pool.query('SELECT * FROM attendance_records WHERE session_id<>? ORDER BY id',[session.id]))[0]),original);
    });
    assert.deepEqual(cdp.exceptions,[]);
  }finally{if(cdp){await cdp.command('Browser.close').catch(()=>{});cdp.close();}browser?.kill();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await pool?.end();if(db){if(/^hadir_flexible_browser_[a-f0-9]+_test$/.test(database))await db.query(`DROP DATABASE ${database}`);await db.end();}}
});
