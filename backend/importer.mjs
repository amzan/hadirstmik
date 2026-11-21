import { validLegacyArchive } from './legacy-leave.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { entities, input, snake } from './domain.mjs';
import { requireValue, localDatabase } from './security.mjs';
import { rows, transaction, createPool, databaseConfig } from './database.mjs';
import { decodeProof } from './proofs.mjs';
import { canonicalRombel, splitRombels } from '../shared/academic-relations.mjs';

const arrays = ['users', 'students', 'rombels', 'courses', 'schedules', 'sessions', 'records', 'leaveRequests'];
const tableFor = { sessions: 'attendance_sessions', records: 'attendance_records', leaveRequests: 'leave_requests' };
// Owner confirmed untagged legacy sessions belong to this period; never follow the changing current period.
const legacyAcademicPeriod = 'Semester Ganjil 2026/2027';
function importInput(entity, item) {
  const value = input(entity, item);
  if (entity === 'users' && item.loginAlias != null) {
    requireValue(item.role === 'dosen' && typeof item.loginAlias === 'string' && /^[a-z0-9]{1,100}$/.test(item.loginAlias), 'LOGIN_ALIAS_INVALID');
    value.login_alias = item.loginAlias;
  }
  return value;
}
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',')}}`;
  return JSON.stringify(value);
}
const textReviewSource=value=>{requireValue(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),'LEGACY_REVIEW_SOURCE_INVALID');return value;};
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
export function prepareImport(backup) {
  requireValue(backup && typeof backup === 'object' && !Array.isArray(backup), 'BACKUP_INVALID');
  const data = backup.data || backup, issues = [], counts = {}, safe = {}, indexes = {};
  for (const name of arrays) {
    const value = data[name] || [];
    requireValue(Array.isArray(value) && value.length <= 100000, 'BACKUP_INVALID');
    counts[name] = value.length; safe[name] = []; indexes[name] = new Map();
    for (let i = 0; i < value.length; i++) {
      const row = value[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) { issues.push({ entity: name, index: i, code: 'ROW_INVALID' }); continue; }
      if ([row.isDemo,row.is_demo].some(value=>value!==undefined && value!==false && value!==0)) { issues.push({entity:name,index:i,code:'DEMO_IMPORT_FORBIDDEN'}); continue; }
      const clean = Object.fromEntries(Object.entries(row).filter(([k]) => !/password|token|device/i.test(k) && !['isDemo','is_demo'].includes(k)));
      if (name === 'sessions') { clean.qrToken = 'invalidated-on-import'; clean.isOpen = false; clean.qrExpiresAt = null; }
      const key = name === 'students' ? row.nim : row.id;
      if (typeof key !== 'string' || !key || key.length > 100) { issues.push({ entity: name, index: i, code: 'ID_INVALID' }); continue; }
      if (indexes[name].has(key)) issues.push({ entity: name, index: i, code: 'DUPLICATE_ID' });
      indexes[name].set(key, clean); safe[name].push(clean);
      if (entities[name]) {
        try { importInput(name, clean); } catch { issues.push({ entity: name, index: i, code: 'FIELD_INVALID' }); }
      }
    }
  }
  const unique = (name, get, code) => { const seen = new Set(); safe[name].forEach((r, index) => { const key = get(r); if (seen.has(key)) issues.push({ entity: name, index, code }); seen.add(key); }); };
  unique('users', r => String(r.username).toLowerCase(), 'USERNAME_DUPLICATE');
  const aliases = new Set();
  safe.users.forEach((account, index) => {
    if (!account.loginAlias) return;
    if (aliases.has(account.loginAlias) || safe.users.some(other => other.id !== account.id && other.role === 'dosen' && [other.username, other.email, other.nidn].some(value => typeof value === 'string' && value.toLowerCase() === account.loginAlias))) issues.push({entity:'users', index, code:'LOGIN_ALIAS_CONFLICT'});
    aliases.add(account.loginAlias);
  });
  unique('courses', r => String(r.code).toLowerCase(), 'COURSE_CODE_DUPLICATE');
  unique('rombels', r => String(r.code).toLowerCase(), 'ROMBEL_CODE_DUPLICATE');
  unique('records', r => `${r.sessionId}:${r.studentNim}`, 'SESSION_STUDENT_DUPLICATE');
  unique('sessions', r => r.isArchived ? `archive:${r.id}` : `${r.scheduleId}:${r.academicPeriod || legacyAcademicPeriod}:${r.date}:${r.meetingNumber}`, 'SESSION_MEETING_DUPLICATE');
  const ref = (name, field, target, optional = false, lookupField) => safe[name].forEach((r, index) => {
    if (optional && r[field] == null) return;
    const valid = lookupField ? safe[target].some(t => t[lookupField] === r[field]) : indexes[target].has(r[field]);
    if (!valid) issues.push({ entity: name, index, code: `MISSING_${field.toUpperCase()}` });
  });
  ref('courses', 'defaultLecturerId', 'users'); ref('schedules', 'lecturerId', 'users'); ref('schedules', 'courseCode', 'courses', false, 'code');
  ref('sessions', 'scheduleId', 'schedules', true); ref('sessions', 'lecturerId', 'users'); ref('records', 'sessionId', 'sessions'); ref('records', 'studentNim', 'students'); ref('leaveRequests', 'studentNim', 'students');
  const rombelCodes = new Map();
  safe.rombels.forEach((r,index)=>{const code=canonicalRombel(r.code);if(rombelCodes.has(code))issues.push({entity:'rombels',index,code:'CANONICAL_ROMBEL_COLLISION'});else rombelCodes.set(code,r.id);});
  safe.students.forEach((student, index) => {
    const accounts = safe.users.filter(u => u.role === 'mahasiswa' && u.username === student.nim);
    if (accounts.length !== 1) issues.push({ entity: 'students', index, code: 'ACCOUNT_MAPPING_REQUIRED' }); else student.userId = accounts[0].id;
    const names = splitRombels(student.rombels?.length ? student.rombels : student.rombel);
    if (!names.length || names.some(name => !rombelCodes.has(name))) issues.push({ entity: 'students', index, code: 'ROMBEL_MAPPING_REQUIRED' });
    student.rombelIds = names.map(name => rombelCodes.get(name)).filter(Boolean);
    for (const field of ['customScheduleIds', 'excludedScheduleIds']) if (student[field] && (!Array.isArray(student[field]) || student[field].some(id => !indexes.schedules.has(id)))) issues.push({ entity: 'students', index, code: 'OVERRIDE_INVALID' });
  });
  safe.rombels.forEach((r, index) => { if (r.scheduleIds && (!Array.isArray(r.scheduleIds) || r.scheduleIds.some(id => !indexes.schedules.has(id)))) issues.push({ entity: 'rombels', index, code: 'SCHEDULE_RELATION_INVALID' }); });
  safe.schedules.forEach((s, index) => { if (!safe.rombels.some(r => r.scheduleIds?.includes(s.id))) issues.push({ entity: 'schedules', index, code: 'ROMBEL_SCHEDULE_MAPPING_REQUIRED' }); });
  safe.records.forEach((r, index) => { if (!['HADIR', 'IZIN', 'SAKIT', 'ALPHA'].includes(r.status) || !['QR_SCAN', 'MANUAL_DOSEN', 'AUTO_SCHEDULE', 'IZIN_APPROVED'].includes(r.verificationMethod) || !Number.isFinite(Date.parse(r.scannedAt))) issues.push({ entity: 'records', index, code: 'FIELD_INVALID' }); });
  safe.records.forEach((r,index)=>{if(r.location && (!Number.isFinite(r.location.latitude)||Math.abs(r.location.latitude)>90||!Number.isFinite(r.location.longitude)||Math.abs(r.location.longitude)>180||(r.location.accuracy!=null&&(!Number.isFinite(r.location.accuracy)||r.location.accuracy<0))))issues.push({entity:'records',index,code:'LOCATION_INVALID'});});
  safe.sessions.forEach((s,index) => { if (s.isArchived && (!s.archivedAt || !['RESET','ARCHIVE'].includes(s.archiveReason) || !indexes.users.has(s.archivedBy))) issues.push({entity:'sessions',index,code:'ARCHIVE_PROVENANCE_REQUIRED'}); });
  safe.sessions.forEach((s, index) => { if (!Number.isInteger(s.meetingNumber) || s.meetingNumber < 1 || s.meetingNumber > 16 || !s.date || !s.startTime || !s.endTime) issues.push({ entity: 'sessions', index, code: 'FIELD_INVALID' }); });
  safe.sessions.forEach((s, index) => { if (!Array.isArray(s.studentNims) || s.studentNims.some(nim => !indexes.students.has(nim))) issues.push({ entity: 'sessions', index, code: 'ROSTER_RECONCILIATION_REQUIRED' }); });
  safe.records.forEach((record,index)=>{const session=indexes.sessions.get(record.sessionId);if(Array.isArray(session?.studentNims)&&!session.studentNims.includes(record.studentNim))issues.push({entity:'records',index,code:'RECORD_OUTSIDE_HISTORICAL_ROSTER'});});
  safe.leaveRequests.forEach((r, index) => {
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(r.status) || !['IZIN', 'SAKIT'].includes(r.type)) issues.push({ entity: 'leaveRequests', index, code: 'FIELD_INVALID' });
    if((r.archiveMarker || r.legacyArchivePolicy || r.legacySourceHash) ? !validLegacyArchive(r) : (!Array.isArray(r.recipientIds)||!r.recipientIds.length||r.recipientIds.some(id=>!safe.users.some(u=>u.id===id&&u.role==='dosen'))))issues.push({entity:'leaveRequests',index,code:'LEAVE_RECIPIENTS_REQUIRED'});
    if (r.proofDocumentUrl) { try { decodeProof(r.proofDocumentUrl); } catch { issues.push({ entity: 'leaveRequests', index, code: 'PRIVATE_PROOF_RECONCILIATION_REQUIRED' }); } }
  });
  if(data.legacyReviewSource)safe.legacyReviewSource=textReviewSource(data.legacyReviewSource);
  return { valid: issues.length === 0, counts, issues, sourceHash: hash(safe), data: safe };
}
export function importReport(preview) { return { valid: preview.valid, counts: preview.counts, issues: preview.issues, sourceHash: preview.sourceHash }; }
export async function databaseImportReport(db, preview) {
  const report=importReport(preview);report.issues=[...report.issues];
  const [done]=await rows(db,'SELECT source_hash FROM import_batches WHERE source_hash=?',[preview.sourceHash]);
  if(done)return {...report,alreadyApplied:true};
  const normalize=(key,value)=>value instanceof Date?value.toISOString():value==null?null:key==='meeting_dates'?canonical(typeof value==='string'?JSON.parse(value):value):key.startsWith('is_')?Boolean(value):['start_time','end_time'].includes(key)?String(value).slice(0,5):value;
  for(const name of arrays)for(const [index,item] of preview.data[name].entries()){
    const key=name==='students'?'nim':'id',table=tableFor[name]||name;
    const [old]=await rows(db,`SELECT * FROM ${table} WHERE ${key}=?`,[item[key]]);
    if(old){
      if(old.is_demo){report.issues.push({entity:name,index,code:'DEMO_IMPORT_FORBIDDEN'});continue;}
      const values=entities[name]?importInput(name,item):Object.fromEntries(Object.entries(item).map(([k,v])=>[snake(k),v]));
      if(Object.entries(values).some(([field,value])=>field in old && canonical(normalize(field,value))!==canonical(normalize(field,old[field]))))report.issues.push({entity:name,index,code:'EXISTING_RECORD_CONFLICT'});
    }else if(['users','courses','rombels'].includes(name)){
      const field=name==='users'?'username':'code';
      if((await rows(db,`SELECT ${key} FROM ${table} WHERE ${field}=?`,[item[field]])).length)report.issues.push({entity:name,index,code:'EXISTING_UNIQUE_CONFLICT'});
    }
  }
  report.valid=!report.issues.length;return report;
}
export async function applyImport(pool, preview, { actorId = null } = {}) {
  requireValue(preview.valid, 'IMPORT_CONFLICTS', 409);
  return transaction(pool, async db => {
    if(preview.data.legacyReviewSource){const [review]=await rows(db,'SELECT candidate_hash FROM legacy_exclude_batches WHERE source_hash=? FOR UPDATE',[preview.data.legacyReviewSource]);requireValue(review?.candidate_hash===preview.sourceHash,'LEGACY_REVIEW_CHANGED',409);}
    await rows(db, 'SELECT source_hash FROM import_batches WHERE source_hash=? FOR UPDATE', [preview.sourceHash]);
    const [done] = await rows(db, 'SELECT counts FROM import_batches WHERE source_hash=?', [preview.sourceHash]);
    if (done) return { applied: false, alreadyApplied: true, counts: preview.counts };
    for (const name of arrays) {
      const table = tableFor[name] || name;
      for (const item of preview.data[name]) {
        const key = name === 'students' ? 'nim' : 'id';
        const [existing] = await rows(db, `SELECT * FROM ${table} WHERE ${key}=? FOR UPDATE`, [item[key]]);
        requireValue(!existing?.is_demo, 'DEMO_IMPORT_FORBIDDEN', 409);
        let value;
        if (entities[name]) value = importInput(name, item);
        else {
          const allowed = name === 'sessions' ? ['id','scheduleId','courseCode','courseName','lecturerId','lecturerName','rombel','room','date','startTime','endTime','meetingNumber','topic','evaluationMethod','qrToken','isDynamicQr','qrExpiresAt','isOpen','createdAt','isArchived','archivedAt','archivedBy','archiveReason','reopenedAt','academicPeriod'] : name === 'records' ? ['id','sessionId','courseCode','courseName','studentNim','studentName','rombel','status','scannedAt','verificationMethod','notes'] : ['id','studentNim','studentName','courseCode','courseName','rombel','date','status','type','reason','createdAt','sessionId','reviewedBy','reviewedAt','archiveMarker','legacyArchivePolicy','legacySourceHash'];
          value = Object.fromEntries(allowed.filter(k => item[k] !== undefined).map(k => [snake(k), /At$/.test(k) && item[k] ? new Date(item[k]) : item[k]]));
          if (name === 'sessions') value.academic_period = item.academicPeriod || legacyAcademicPeriod;
          if(name==='records' && item.location)Object.assign(value,{latitude:item.location.latitude,longitude:item.location.longitude,location_accuracy:item.location.accuracy??null});
        }
        if (name === 'leaveRequests' && item.proofDocumentUrl && !existing) {
          const proof = decodeProof(item.proofDocumentUrl), proofId = hash([preview.sourceHash,item.id]).slice(0,64), student=preview.data.students.find(s=>s.nim===item.studentNim);
          await rows(db,'INSERT INTO leave_proofs (id,owner_user_id,mime_type,content) VALUES (?,?,?,?)',[proofId,student.userId,proof.mime,proof.bytes]); value.proof_id=proofId;
        }
        if (existing) {
          const normalize = (key, value) => value instanceof Date ? value.toISOString() : value == null ? null : key === 'meeting_dates' ? canonical(typeof value === 'string' ? JSON.parse(value) : value) : key.startsWith('is_') ? Boolean(value) : ['start_time','end_time'].includes(key) ? String(value).slice(0,5) : value;
          requireValue(Object.entries(value).every(([key, val]) => canonical(normalize(key, val)) === canonical(normalize(key, existing[key]))), 'EXISTING_RECORD_CONFLICT', 409);
        } else {
          await rows(db, `INSERT INTO ${table} (${Object.keys(value).join(',')}) VALUES (${Object.keys(value).map(() => '?').join(',')})`, Object.values(value));
          if(name==='leaveRequests' && validLegacyArchive(item))await rows(db,"INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id) VALUES (?,'LEGACY_LEAVE_ARCHIVED','leave',?)",[actorId,item.id]);
        }
      }
    }
    for(const leave of preview.data.leaveRequests)for(const id of new Set(leave.recipientIds))await rows(db,'INSERT IGNORE INTO leave_recipients VALUES (?,?)',[leave.id,id]);
    for (const student of preview.data.students) {
      for (const id of student.rombelIds) if (!(await rows(db, 'SELECT 1 FROM student_rombels WHERE student_nim=? AND rombel_id=?', [student.nim,id])).length) await rows(db, 'INSERT INTO student_rombels VALUES (?,?)', [student.nim, id]);
      const overrides = new Map((student.customScheduleIds || []).map(id => [id, 'INCLUDE'])); for (const id of student.excludedScheduleIds || []) overrides.set(id, 'EXCLUDE');
      for (const [id, mode] of overrides) { const [old] = await rows(db,'SELECT mode FROM student_schedule_overrides WHERE student_nim=? AND schedule_id=?',[student.nim,id]); requireValue(!old || old.mode===mode,'EXISTING_RELATION_CONFLICT',409); if(!old) await rows(db, 'INSERT INTO student_schedule_overrides VALUES (?,?,?)', [student.nim, id, mode]); }
    }
    for (const rombel of preview.data.rombels) for (const id of rombel.scheduleIds || []) if (!(await rows(db,'SELECT 1 FROM rombel_schedules WHERE rombel_id=? AND schedule_id=?',[rombel.id,id])).length) await rows(db, 'INSERT INTO rombel_schedules VALUES (?,?)', [rombel.id, id]);
    for (const session of preview.data.sessions) for (const nim of session.studentNims) await rows(db, 'INSERT IGNORE INTO session_roster VALUES (?,?)', [session.id, nim]);
    for (const record of preview.data.records) await rows(db, 'INSERT IGNORE INTO session_roster VALUES (?,?)', [record.sessionId, record.studentNim]);
    await rows(db, 'INSERT INTO import_batches (source_hash,counts) VALUES (?,?)', [preview.sourceHash, JSON.stringify(preview.counts)]);
    if (actorId) await rows(db, "INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id) VALUES (?,'IMPORT','batch',?)", [actorId, preview.sourceHash]);
    return { applied: true, counts: preview.counts };
  });
}
async function main() {
  const file = process.argv[2]; requireValue(file, 'Usage: node backend/importer.mjs PRIVATE_FILE [--apply-local]');
  const preview = prepareImport(JSON.parse(await readFile(resolve(file), 'utf8')));
  console.log(JSON.stringify(importReport(preview), null, 2));
  if (process.argv.includes('--apply-local')) {
    localDatabase(databaseConfig());
    const pool = createPool(); try { console.log(JSON.stringify(await applyImport(pool, preview))); } finally { await pool.end(); }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.code || 'IMPORT_FAILED'); process.exitCode = 1; });
