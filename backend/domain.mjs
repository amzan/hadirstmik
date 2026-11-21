import { demoScope, assertDemoScope, scopedReference } from './demo-scope.mjs';
import { CURRENT_ACADEMIC_PERIOD, summarizeAttendancePolicy } from '../shared/attendance-policy.mjs';
import { Router } from 'express';
import { validateAvatarReference } from './avatar.mjs';
import { rows, transaction, audit } from './database.mjs';
import { asyncRoute, requireValue, text, integer, date, time, token, statuses, validateQr, safeUser, roles, verifyPassword } from './security.mjs';
import { canonicalRombel, splitRombels } from '../shared/academic-relations.mjs';
import { updateAccountEmail, updateAccountIdentifier } from './accounts.mjs';
import { ensureLecturerLoginAliases } from './lecturer-login.mjs';

const prodis = ['Teknologi Informasi', 'Manajemen Informatika', 'Lintas Program Studi'];
export const entities = {
  users: { key: 'id', fields: ['id', 'username', 'name', 'email', 'role', 'avatar_url', 'title', 'nidn', 'academic_rank', 'office_room', 'prodi', 'phone','is_active'] },
  students: { key: 'nim', fields: ['nim', 'name', 'email', 'phone', 'prodi', 'user_id','is_active'] },
  rombels: { key: 'id', fields: ['id', 'code', 'name', 'prodi', 'semester', 'academic_year', 'description', 'is_archived', 'archived_at'] },
  courses: { key: 'id', fields: ['id', 'code', 'name', 'sks', 'prodi', 'semester', 'default_lecturer_id', 'default_lecturer_name', 'description', 'is_archived', 'archived_at'] },
  schedules: { key: 'id', fields: ['id', 'day', 'start_time', 'end_time', 'course_code', 'course_name', 'sks', 'lecturer_id', 'lecturer_name', 'room', 'rombel', 'prodi', 'meeting_dates', 'is_archived', 'archived_at'] },
};
export const snake = name => name.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
export const camel = name => name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const dtoColumns=new Set([...Object.values(entities).flatMap(e=>e.fields),'version','created_at','updated_at','schedule_id','session_id','student_nim','student_name','status','scanned_at','verification_method','notes','latitude','longitude','location_accuracy','date','meeting_number','topic','evaluation_method','qr_token','is_dynamic_qr','qr_expires_at','is_open','reason','type','proof_document_url','proof_id','reviewed_by','reviewed_at','archive_marker','legacy_archive_policy','legacy_source_hash','archived_by','archive_reason','reopened_at','academic_period','is_demo']);
export function dto(row) {
  const out = {};
  for (const [key, raw] of Object.entries(row)) {
    if (!dtoColumns.has(key)) continue;
    let value = raw;
    if (key === 'meeting_dates' && typeof value === 'string') value = JSON.parse(value);
    if (['start_time', 'end_time'].includes(key)) value = value?.slice(0, 5);
    if (key.startsWith('is_')) value = Boolean(value);
    if (value instanceof Date) value = value.toISOString();
    out[camel(key)] = value;
  }
  if (row.latitude != null && row.longitude != null) out.location = { latitude: Number(row.latitude), longitude: Number(row.longitude), accuracy: row.location_accuracy == null ? undefined : Number(row.location_accuracy) };
  if (row.proof_id) out.proofDocumentUrl = `/api/v1/leave-proofs/${row.proof_id}`;
  delete out.latitude; delete out.longitude; delete out.locationAccuracy;
  return out;
}
export function input(entity, body, partial = false) {
  const spec = entities[entity]; requireValue(spec && body && typeof body === 'object' && !Array.isArray(body));
  requireValue(!Object.keys(body).some(k => /password|token/i.test(k)), 'SECRET_FIELD_REJECTED');
  const value = {};
  for (const field of spec.fields) {
    const raw = body[camel(field)]; if (raw === undefined) continue;
    if (field === 'meeting_dates') {
      requireValue(raw && typeof raw === 'object' && !Array.isArray(raw));
      for (const [key, day] of Object.entries(raw)) { integer(Number(key), 1, 16); date(day); }
      value[field] = JSON.stringify(raw);
    } else if (field === 'sks' || field === 'semester') value[field] = integer(raw, 1, field === 'sks' ? 20 : 14);
    else if (field.startsWith('is_')) { requireValue(typeof raw === 'boolean'); value[field] = raw; }
    else if (entity==='users' && field==='prodi' && raw==null) value[field]=null;
    else if (field === 'archived_at') value[field] = raw ? new Date(raw) : null;
    else if (['start_time', 'end_time'].includes(field)) value[field] = time(raw);
    else value[field] = text(raw, field === 'description' ? 10000 : field === 'avatar_url' ? 500000 : field === 'email' ? 255 : field === 'name' || field.endsWith('_name') || field === 'rombel' ? 200 : field === 'phone' ? 30 : field === 'nim' || field === 'code' || field === 'nidn' ? 50 : 100, !['name', 'username', 'email', 'role', 'prodi', 'code', 'day', 'room', 'rombel', 'course_code', 'course_name', 'lecturer_id', 'lecturer_name', 'default_lecturer_id', 'default_lecturer_name', spec.key].includes(field));
  }
  if (value.role) requireValue(roles.includes(value.role));
  if(entity==='rombels'&&value.code){requireValue(!/[,;&/]/.test(value.code)&&splitRombels(value.code).length===1,'ROMBEL_IDENTITY_REQUIRED');value.code=canonicalRombel(value.code);}
  if (value.prodi) requireValue(prodis.includes(value.prodi));
  if (value.email) requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email));
  if (value.day) requireValue(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].includes(value.day));
  if (value.start_time && value.end_time) requireValue(value.start_time < value.end_time);
  if (!partial) {
    const required = { users: ['username', 'name', 'email', 'role'], students: ['nim', 'name', 'email', 'prodi'], rombels: ['code', 'name', 'prodi', 'semester'], courses: ['code', 'name', 'sks', 'prodi', 'semester', 'default_lecturer_id', 'default_lecturer_name'], schedules: ['day', 'start_time', 'end_time', 'course_code', 'course_name', 'sks', 'lecturer_id', 'lecturer_name', 'room', 'rombel', 'prodi'] }[entity];
    for (const field of required) requireValue(value[field] != null, `FIELD_REQUIRED_${field}`);
  }
  return value;
}
export async function eligible(db, scheduleId) {
  return rows(db, `SELECT DISTINCT st.* FROM students st JOIN schedules scoped_schedule ON scoped_schedule.id=? AND scoped_schedule.is_demo=st.is_demo WHERE st.is_active=1
    AND NOT EXISTS (SELECT 1 FROM student_schedule_overrides x WHERE x.student_nim=st.nim AND x.schedule_id=? AND x.mode='EXCLUDE')
    AND (EXISTS (SELECT 1 FROM student_schedule_overrides x WHERE x.student_nim=st.nim AND x.schedule_id=? AND x.mode='INCLUDE')
      OR EXISTS (SELECT 1 FROM student_rombels sr JOIN rombel_schedules rs ON sr.rombel_id=rs.rombel_id WHERE sr.student_nim=st.nim AND rs.schedule_id=?))`, [scheduleId, scheduleId, scheduleId, scheduleId]);
}
export async function actorStudent(db, user) {
  const [student] = await rows(db, 'SELECT * FROM students WHERE user_id=? AND is_active=1', [user.id]);
  requireValue(student, 'STUDENT_MAPPING_REQUIRED', 403); assertDemoScope(student,user); return student;
}
async function studentRelations(db, nim, { rombelIds, includedIds = [], excludedIds = [] }) {
  for (const list of [rombelIds, includedIds, excludedIds]) requireValue(Array.isArray(list) && list.length <= 100 && list.every(id => typeof id === 'string' && id.length <= 100));
  requireValue(rombelIds.length > 0, 'ROMBEL_REQUIRED');
  const [student]=await rows(db,'SELECT is_demo FROM students WHERE nim=?',[nim]); requireValue(student,'NOT_FOUND',404);
  for(const id of rombelIds) await scopedReference(db,'rombels','id',id,student.is_demo);
  for(const id of [...includedIds,...excludedIds]) await scopedReference(db,'schedules','id',id,student.is_demo);
  await rows(db, 'DELETE FROM student_rombels WHERE student_nim=?', [nim]);
  for (const id of new Set(rombelIds)) await rows(db, 'INSERT INTO student_rombels (student_nim,rombel_id) VALUES (?,?)', [nim,id]);
  await rows(db, 'DELETE FROM student_schedule_overrides WHERE student_nim=?', [nim]);
  const overrides = new Map(includedIds.map(id=>[id,'INCLUDE'])); for(const id of excludedIds) overrides.set(id,'EXCLUDE');
  for(const [id,mode] of overrides) await rows(db,'INSERT INTO student_schedule_overrides VALUES (?,?,?)',[nim,id,mode]);
}
async function rombelSchedules(db, id, scheduleIds) {
  requireValue(Array.isArray(scheduleIds) && scheduleIds.length <= 100);
  const [parent]=await rows(db,'SELECT is_demo FROM rombels WHERE id=?',[id]);
  for(const scheduleId of scheduleIds) await scopedReference(db,'schedules','id',scheduleId,parent.is_demo);
  await rows(db,'DELETE FROM rombel_schedules WHERE rombel_id=?',[id]);
  for(const scheduleId of new Set(scheduleIds)) await rows(db,'INSERT INTO rombel_schedules VALUES (?,?)',[id,text(scheduleId,100)]);
}
async function scheduleRombels(db, id, rombelIds) {
  requireValue(Array.isArray(rombelIds) && rombelIds.length>0 && rombelIds.length<=100);
  const [parent]=await rows(db,'SELECT is_demo FROM schedules WHERE id=?',[id]);
  for(const rombelId of rombelIds) await scopedReference(db,'rombels','id',rombelId,parent.is_demo);
  await rows(db,'DELETE FROM rombel_schedules WHERE schedule_id=?',[id]);
  for(const rombelId of new Set(rombelIds)) await rows(db,'INSERT INTO rombel_schedules VALUES (?,?)',[text(rombelId,100),id]);
}
async function ownedSchedule(db, user, id, lock = false) {
  const [schedule] = await rows(db, `SELECT * FROM schedules WHERE id=?${lock ? ' FOR UPDATE' : ''}`, [id]);
  assertDemoScope(schedule,user); requireValue(user.role === 'admin' || (user.role === 'dosen' && schedule.lecturer_id === user.id), 'FORBIDDEN', 403); return schedule;
}
async function ownedSession(db, user, id) {
  const [session] = await rows(db, 'SELECT * FROM attendance_sessions WHERE id=? FOR UPDATE', [id]);
  assertDemoScope(session,user); requireValue(user.role === 'admin' || (user.role === 'dosen' && session.lecturer_id === user.id), 'FORBIDDEN', 403); return session;
}
export async function writeRecord(db, actor, session, student, status, method, reason, overwrite = false) {
  requireValue(!session.is_archived, 'SESSION_ARCHIVED', 409);
  requireValue(Number(student.is_demo||0)===Number(session.is_demo||0),'DEMO_SCOPE_MISMATCH',403);
  requireValue(statuses.includes(status));
  const [roster] = await rows(db, 'SELECT student_nim FROM session_roster WHERE session_id=? AND student_nim=?', [session.id, student.nim]);
  requireValue(roster, 'NOT_ENROLLED', 403);
  const [old] = await rows(db, 'SELECT * FROM attendance_records WHERE session_id=? AND student_nim=? FOR UPDATE', [session.id, student.nim]);
  if (old && (!overwrite || old.status === status && (old.notes || '') === (reason || ''))) return dto(old);
  const id = old?.id || token();
  if (old) await rows(db, 'UPDATE attendance_records SET status=?,verification_method=?,notes=?,version=version+1 WHERE id=?', [status, method, reason, id]);
  else await rows(db, `INSERT INTO attendance_records (id,session_id,course_code,course_name,student_nim,student_name,rombel,status,scanned_at,verification_method,notes,is_demo)
    VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),?,?,?)`, [id, session.id, session.course_code, session.course_name, student.nim, student.name, session.rombel, status, method, reason, Number(session.is_demo||0)]);
  await rows(db, 'INSERT INTO attendance_record_audit (attendance_record_id,old_status,new_status,changed_by,reason,method,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())', [id, old?.status || null, status, actor, reason, method === 'MANUAL_DOSEN' ? 'MANUAL' : method]);
  const [record] = await rows(db, 'SELECT * FROM attendance_records WHERE id=?', [id]); return dto(record);
}
export async function closeAttendance(db, actor, session) {
  requireValue(!session.is_archived, 'SESSION_ARCHIVED', 409);
  if (!session.is_open) return dto(session);
  const students = await rows(db, 'SELECT st.* FROM students st JOIN session_roster sr ON sr.student_nim=st.nim WHERE sr.session_id=? AND st.is_demo=?', [session.id,Number(session.is_demo||0)]);
  for (const student of students) {
    await writeRecord(db, actor, session, student, 'ALPHA', 'AUTO_SCHEDULE', 'Penutupan sesi');
  }
  await rows(db, 'UPDATE attendance_sessions SET is_open=0,version=version+1 WHERE id=?', [session.id]);
  await audit(db, actor, 'SESSION_CLOSED', 'session', session.id);
  return { ...dto(session), isOpen: false };
}
export async function expireSessions() {
  // Lecture dates describe teaching time; only an explicit close ends attendance.
  return 0;
}
export async function listEntity(db, user, entity, page = 1, pageSize = 100, includeInactive=false, archived=false) {
  const spec = entities[entity] || ({ 'attendance-sessions': { table: 'attendance_sessions', key: 'id' }, 'attendance-records': { table: 'attendance_records', key: 'id' }, 'leave-requests': { table: 'leave_requests', key: 'id' } })[entity];
  requireValue(spec, 'NOT_FOUND', 404);
  let where = '1=1', params = [];
  const table = spec.table || entity;
  if (user.role !== 'admin') {
    if (entity === 'users') { where = 't.id=?'; params = [user.id]; }
    else if (entity === 'students') {
      if (user.role === 'mahasiswa') { where = 't.user_id=?'; params = [user.id]; }
      else { where = `EXISTS (SELECT 1 FROM student_rombels sr JOIN rombel_schedules rs ON rs.rombel_id=sr.rombel_id JOIN schedules sch ON sch.id=rs.schedule_id WHERE sr.student_nim=t.nim AND sch.lecturer_id=?) OR EXISTS (SELECT 1 FROM session_roster r JOIN attendance_sessions s ON s.id=r.session_id WHERE r.student_nim=t.nim AND s.lecturer_id=?)`; params = [user.id, user.id]; }
    } else if (['attendance-records', 'leave-requests'].includes(entity)) {
      if (user.role === 'mahasiswa') { where = 't.student_nim=(SELECT nim FROM students WHERE user_id=?)'; params = [user.id]; }
      else { where = entity==='leave-requests'?'t.archive_marker IS NULL AND EXISTS (SELECT 1 FROM leave_recipients r WHERE r.leave_id=t.id AND r.lecturer_id=?)':'EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id=t.session_id AND s.lecturer_id=?)'; params = [user.id]; }
    } else if (entity === 'attendance-sessions') {
      if (user.role === 'dosen') { where = 't.lecturer_id=?'; params = [user.id]; }
      else { where = 'EXISTS (SELECT 1 FROM session_roster sr JOIN students st ON st.nim=sr.student_nim WHERE sr.session_id=t.id AND st.user_id=?)'; params = [user.id]; }
    } else if (entity === 'schedules') {
      if (user.role === 'dosen') { where = 't.lecturer_id=?'; params = [user.id]; }
      else { where = `NOT EXISTS (SELECT 1 FROM student_schedule_overrides o JOIN students st ON st.nim=o.student_nim WHERE st.user_id=? AND o.schedule_id=t.id AND o.mode='EXCLUDE') AND (EXISTS (SELECT 1 FROM students st JOIN student_rombels sr ON sr.student_nim=st.nim JOIN rombel_schedules rs ON rs.rombel_id=sr.rombel_id WHERE st.user_id=? AND rs.schedule_id=t.id) OR EXISTS (SELECT 1 FROM students st JOIN student_schedule_overrides o ON o.student_nim=st.nim WHERE st.user_id=? AND o.schedule_id=t.id AND o.mode='INCLUDE'))`; params = [user.id, user.id, user.id]; }
    } else if (entity === 'rombels') {
      where = user.role === 'mahasiswa' ? 'EXISTS (SELECT 1 FROM student_rombels sr JOIN students st ON st.nim=sr.student_nim WHERE sr.rombel_id=t.id AND st.user_id=?)' : 'EXISTS (SELECT 1 FROM rombel_schedules rs JOIN schedules sch ON sch.id=rs.schedule_id WHERE rs.rombel_id=t.id AND sch.lecturer_id=?)'; params = [user.id];
    } else if (entity === 'courses') {
      const schedules = await listEntity(db, user, 'schedules', 1, 10000);
      const codes = [...new Set(schedules.data.map(s => s.courseCode))];
      if (!codes.length) return { data: [], meta: { page, pageSize, total: 0 } };
      where = `t.code IN (${codes.map(() => '?').join(',')})`; params = codes;
    }
  }
  if (entity === 'attendance-sessions') where = `(${where}) AND t.is_archived=${archived && user.role === 'admin' ? 1 : 0}`;
  if (entity === 'attendance-records') where = `(${where}) AND EXISTS (SELECT 1 FROM attendance_sessions visible_session WHERE visible_session.id=t.session_id AND visible_session.is_demo=t.is_demo AND visible_session.is_archived=${archived && user.role === 'admin' ? 1 : 0})`;
  if (['users', 'students'].includes(entity) && !includeInactive) where = `(${where}) AND t.is_active=1`;
  where = `(${where}) AND ` + (entity==='leave-requests' ? 'EXISTS (SELECT 1 FROM students scoped_student WHERE scoped_student.nim=t.student_nim AND scoped_student.is_demo=?)' : 't.is_demo=?'); params.push(demoScope(user));
  const [count] = await rows(db, `SELECT COUNT(*) AS total FROM ${table} t WHERE ${where}`, params);
  const result = await rows(db, `SELECT t.* FROM ${table} t WHERE ${where} ORDER BY t.${spec.key} LIMIT ? OFFSET ?`, [...params, String(pageSize), String((page - 1) * pageSize)]);
  const data = [];
  for (const row of result) {
    const value = entity === 'users' ? { ...safeUser(row), version: row.version } : dto(row);
    if(entity==='users' && includeInactive) value.isActive=Boolean(row.is_active);
    if(entity==='users' && user.role==='admin') value.hasCredentials=(await rows(db,'SELECT 1 FROM user_credentials WHERE user_id=?',[row.id])).length>0;
    if (entity === 'attendance-sessions' && user.role === 'mahasiswa') delete value.qrToken;
    if (entity === 'attendance-sessions') value.studentNims = (await rows(db, 'SELECT student_nim FROM session_roster WHERE session_id=?', [row.id])).map(r => r.student_nim);
    if(entity==='leave-requests')value.recipientIds=(await rows(db,'SELECT lecturer_id FROM leave_recipients WHERE leave_id=?',[row.id])).map(r=>r.lecturer_id);
    if (entity === 'students') {
      const rombels = await rows(db, 'SELECT r.code FROM rombels r JOIN student_rombels sr ON sr.rombel_id=r.id WHERE sr.student_nim=?', [row.nim]);
      const overrides = await rows(db, 'SELECT schedule_id,mode FROM student_schedule_overrides WHERE student_nim=?', [row.nim]);
      value.rombels = rombels.map(r => r.code); value.rombel = value.rombels.join(', ');
      value.excludedScheduleIds = overrides.filter(o => o.mode === 'EXCLUDE').map(o => o.schedule_id); value.customScheduleIds = overrides.filter(o => o.mode === 'INCLUDE').map(o => o.schedule_id);
    }
    if (entity === 'rombels') value.scheduleIds = (await rows(db, 'SELECT schedule_id FROM rombel_schedules WHERE rombel_id=?', [row.id])).map(r => r.schedule_id);
    if (entity === 'schedules') { const linked=await rows(db,'SELECT r.code FROM rombels r JOIN rombel_schedules rs ON rs.rombel_id=r.id WHERE rs.schedule_id=? ORDER BY r.code',[row.id]); if(linked.length)value.rombel=linked.map(r=>r.code).join(' & '); }
    data.push(value);
  }
  return { data, meta: { page, pageSize, total: Number(count.total) } };
}

export async function createEntity(db, user, entity, body) {
  const spec=entities[entity]; requireValue(spec && user.role==='admin','FORBIDDEN',403);
      const value = input(entity, body); value[spec.key] ||= token(); value.is_demo=demoScope(user);
        requireValue(entity!=='users'||value.role!=='admin'||!value.is_demo,'DEMO_ADMIN_FORBIDDEN',403);
        if (entity === 'users') {
          if (value.avatar_url !== undefined) await validateAvatarReference(db, value.id, value.avatar_url);
          await rows(db, 'SELECT id FROM users ORDER BY id FOR UPDATE');
          if (value.role === 'dosen') for (const identifier of [value.username, value.nidn].filter(Boolean)) {
            requireValue(!(await rows(db, 'SELECT id FROM users WHERE login_alias=? AND id<>?', [identifier.toLowerCase(), value.id])).length, 'IDENTIFIER_IN_USE', 409);
          }
        }
        if (entity === 'students') {
          const [account]=await rows(db,'SELECT id,role,is_demo FROM users WHERE username=? FOR UPDATE',[value.nim]);
          requireValue(!account || Number(account.is_demo)===demoScope(user),'DEMO_SCOPE_MISMATCH',403);
          requireValue(!account || (account.role==='mahasiswa' && !(await rows(db,'SELECT nim FROM students WHERE user_id=?',[account.id])).length),'ACCOUNT_MAPPING_CONFLICT',409);
          const accountId = account?.id || token();
          if(!account)await rows(db, "INSERT INTO users (id,username,name,email,role,prodi,phone,is_demo) VALUES (?,?,?,?,'mahasiswa',?,?,?)", [accountId, value.nim, value.name, value.email, value.prodi, value.phone || null, demoScope(user)]); value.user_id = accountId;
        }
        if (entity === 'courses' || entity === 'schedules') {
          const lecturerId = value.lecturer_id || value.default_lecturer_id;
          const [lecturer] = await rows(db, "SELECT name FROM users WHERE id=? AND role='dosen' AND is_active=1 AND is_demo=?", [lecturerId,demoScope(user)]); requireValue(lecturer, 'LECTURER_INVALID');
          if (entity === 'schedules') { const [course] = await rows(db, 'SELECT * FROM courses WHERE code=? AND is_archived=0 AND is_demo=?', [value.course_code,demoScope(user)]); requireValue(course, 'COURSE_INVALID'); value.course_name = course.name; value.sks = course.sks; value.lecturer_name = lecturer.name; }
          else value.default_lecturer_name = lecturer.name;
        }
        await rows(db, `INSERT INTO ${entity} (${Object.keys(value).join(',')}) VALUES (${Object.keys(value).map(() => '?').join(',')})`, Object.values(value));
        if(entity==='students') await studentRelations(db,value.nim,body);
        if(entity==='rombels' && body.scheduleIds) await rombelSchedules(db,value.id,body.scheduleIds);
        if(entity==='schedules') await scheduleRombels(db,value.id,body.rombelIds);
        await audit(db, user.id, 'CREATE', entity, value[spec.key]);
        return dto(value);

}
export async function updateEntity(db, user, entity, id, body) {
  const spec=entities[entity]; requireValue(spec,'NOT_FOUND',404);
      requireValue(user.role === 'admin' || (entity === 'users' && id === user.id), 'FORBIDDEN', 403);
      const selfProfile = entity === 'users' && id === user.id;
      const publicBody = { ...body };
      if (selfProfile) delete publicBody.currentPassword;
      if (selfProfile && user.role !== 'admin') {
        const recognized = new Set([...spec.fields.map(camel), 'version', 'currentPassword']);
        requireValue(Object.keys(body).every(key => recognized.has(key)), 'PROFILE_FIELD_FORBIDDEN', 403);
      }
      const value = input(entity, publicBody, true); const requestedNim=entity==='students' ? value.nim : undefined; delete value[spec.key];
      if (entity === 'users' && value.avatar_url !== undefined) await validateAvatarReference(db, id, value.avatar_url);
      if (selfProfile && value.email) value.email = value.email.toLowerCase();
      if (user.role !== 'admin') {
        const unchanged={username:user.username,nidn:user.nidn,academic_rank:user.academicRank,prodi:user.prodi};
        for(const [key,val] of Object.entries(unchanged)) if(value[key]===val || (value[key]==null && val==null)) delete value[key];
        for (const key of Object.keys(value)) requireValue(['name', 'phone', 'avatar_url', 'title', 'office_room', 'email'].includes(key), 'PROFILE_FIELD_FORBIDDEN', 403);
      }
      const version = integer(Number(body.version), 1, 2147483647);
      requireValue(Object.keys(value).length || requestedNim!==undefined);
        if (entity === 'users' || entity === 'students') await rows(db, 'SELECT id FROM users ORDER BY id FOR UPDATE');
        const [old] = await rows(db, `SELECT * FROM ${entity} WHERE ${spec.key}=? FOR UPDATE`, [id]); assertDemoScope(old,user);
        requireValue(entity!=='users'||value.role!=='admin'||!old.is_demo,'DEMO_ADMIN_FORBIDDEN',403);
        requireValue(old.version === version, 'VERSION_CONFLICT', 409);
        if (entity === 'users' && (value.role || old.role) === 'dosen') {
          for (const identifier of [value.username || old.username, value.nidn || old.nidn].filter(Boolean)) {
            requireValue(!(await rows(db, 'SELECT id FROM users WHERE login_alias=? AND id<>?', [identifier.toLowerCase(), id])).length, 'IDENTIFIER_IN_USE', 409);
          }
        }
        let emailChanged = false;
        if(entity==='students' && value.user_id)requireValue(value.user_id===old.user_id,'ACCOUNT_MAPPING_IMMUTABLE',409);
        if(entity==='students' && value.email && value.email!==old.email){ await updateAccountEmail(db,old.user_id,value.email,user.id); emailChanged=true; }
        if (entity === 'users' && value.email && value.email !== old.email) {
          requireValue(selfProfile || user.role==='admin', 'EMAIL_ACCOUNT_MANAGEMENT_REQUIRED', 409);
          const [credential] = await rows(db, 'SELECT password_hash FROM user_credentials WHERE user_id=? FOR UPDATE', [id]);
          if(user.role!=='admin') requireValue(await verifyPassword(body.currentPassword, credential?.password_hash), 'CURRENT_PASSWORD_INVALID', 401);
          const changed = await updateAccountEmail(db, id, value.email, user.id, user.role === 'admin');
          value.email = changed.email; emailChanged = true;
        }
                if(user.role==='admin' && entity==='users' && ['mahasiswa','dosen'].includes(old.role) && (value.username!==undefined || value.nidn!==undefined)) {
          const identifier=old.role==='dosen' ? value.nidn ?? value.username : value.username;
          requireValue(old.role!=='dosen' || value.username===undefined || value.nidn===undefined || value.username===value.nidn,'IDENTIFIER_MISMATCH');
          await updateAccountIdentifier(db,id,identifier,user.id); value.username=identifier; if(old.role==='dosen')value.nidn=identifier;
        }
        if(entity==='students' && requestedNim!==undefined && requestedNim!==old.nim) { await updateAccountIdentifier(db,old.user_id,requestedNim,user.id); await rows(db,'UPDATE users SET version=version+1 WHERE id=?',[old.user_id]); id=requestedNim; }
        if(entity==='students' && requestedNim!==undefined) value.nim=requestedNim;
        if (entity === 'users' && old.role === 'admin' && ((value.role && value.role !== 'admin') || value.is_active===false)) { const [count] = await rows(db, "SELECT COUNT(*) AS total FROM users WHERE role='admin' AND is_active=1 FOR UPDATE"); requireValue(count.total > 1, 'LAST_ADMIN_REQUIRED', 409); }
        if (entity === 'schedules' || entity==='courses') {
          const lecturerKey=entity==='schedules'?'lecturer_id':'default_lecturer_id',nameKey=entity==='schedules'?'lecturer_name':'default_lecturer_name';
          const [lecturer]=await rows(db,"SELECT name FROM users WHERE id=? AND role='dosen' AND is_active=1",[value[lecturerKey]||old[lecturerKey]]);
          await scopedReference(db,'users','id',value[lecturerKey]||old[lecturerKey],demoScope(user));requireValue(lecturer,'LECTURER_INVALID');value[nameKey]=lecturer.name;
          if(entity==='schedules'){
            const [course]=await rows(db,'SELECT name,sks FROM courses WHERE code=? AND is_archived=0',[value.course_code||old.course_code]);await scopedReference(db,'courses','code',value.course_code||old.course_code,demoScope(user));requireValue(course,'COURSE_INVALID');value.course_name=course.name;value.sks=course.sks;
            requireValue((value.start_time||old.start_time)<(value.end_time||old.end_time),'TIME_RANGE_INVALID');
          }
        }
        await rows(db, `UPDATE ${entity} SET ${Object.keys(value).map(k => `${k}=?`).join(',')}${emailChanged ? '' : ',version=version+1'} WHERE ${spec.key}=?`, [...Object.values(value), id]);
        if(entity==='students' && body.rombelIds) await studentRelations(db,id,body);
        if(entity==='rombels' && body.scheduleIds) await rombelSchedules(db,old.id,body.scheduleIds);
        if(entity==='schedules' && body.rombelIds) await scheduleRombels(db,old.id,body.rombelIds);
        if (entity === 'students' && old.user_id) {
          const profile = Object.fromEntries(Object.entries(value).filter(([k]) => ['name', 'email', 'phone', 'prodi','is_active'].includes(k)));
          if (Object.keys(profile).length) await rows(db, `UPDATE users SET ${Object.keys(profile).map(k => `${k}=?`).join(',')},version=version+1 WHERE id=?`, [...Object.values(profile), old.user_id]);
        }
        if (entity === 'users' && old.role === 'mahasiswa') {
          const profile = Object.fromEntries(Object.entries(value).filter(([k]) => ['name', 'phone', 'prodi'].includes(k)));
          if (Object.keys(profile).length) await rows(db, `UPDATE students SET ${Object.keys(profile).map(k => `${k}=?`).join(',')},version=version+1 WHERE user_id=?`, [...Object.values(profile), old.id]);
        }
        if (entity === 'users' && ((value.role && value.role !== old.role) || value.is_active===false)) await rows(db, "UPDATE device_sessions SET status='TERMINATED',revoked_at=UTC_TIMESTAMP() WHERE user_id=?", [old.id]);
        await audit(db, user.id, selfProfile ? 'PROFILE_CHANGED' : 'UPDATE', entity, id);
        const [savedVersion]=await rows(db,`SELECT version FROM ${entity} WHERE ${spec.key}=?`,[id]);
        const updated = { ...old, ...value, ...(emailChanged ? {email_verified_at:null} : {}), version: savedVersion.version };
        return entity === 'users' ? safeUser(updated) : dto(updated);

}

export function domain(pool, auth) {
  const router = Router();
  router.use(auth.required);
  router.get('/reports/snapshot', asyncRoute(async (req, res) => {
    const archived = req.query.archived === '1';
    requireValue(!archived || req.user.role === 'admin', 'FORBIDDEN', 403);
    const data = await transaction(pool, async db => {
      const result = { generatedAt: new Date().toISOString(), archived };
      for (const [key, entity] of [['sessions', 'attendance-sessions'], ['records', 'attendance-records'], ['students', 'students'], ['schedules', 'schedules'], ['courses', 'courses']]) {
        result[key] = (await listEntity(db, req.user, entity, 1, 100000, entity === 'students', archived)).data;
      }
      for (const session of result.sessions) { delete session.qrToken; delete session.qrExpiresAt; }
      result.academicPeriod = CURRENT_ACADEMIC_PERIOD;
      result.attendancePolicy = Object.fromEntries(result.students.map(student => [student.nim, summarizeAttendancePolicy(result.sessions, result.records, student.nim, { sessionIds: result.sessions.filter(session => session.academicPeriod === CURRENT_ACADEMIC_PERIOD).map(session => session.id) })]));
      return result;
    });
    res.set('Cache-Control', 'no-store').json({ data });
  }));
  router.get('/attendance-sessions/:id/history', auth.role('admin', 'dosen'), asyncRoute(async (req, res) => {
    const data = await transaction(pool, async db => {
      const id = text(req.params.id, 100);
      const [row] = await rows(db, 'SELECT * FROM attendance_sessions WHERE id=?', [id]);
      assertDemoScope(row,req.user);
      requireValue(req.user.role === 'admin' || row.lecturer_id === req.user.id, 'FORBIDDEN', 403);
      requireValue(!row.is_archived || req.user.role === 'admin', 'SESSION_ARCHIVED', 403);
      const session = dto(row);
      delete session.qrToken; delete session.qrExpiresAt;
      session.studentNims = (await rows(db, 'SELECT student_nim FROM session_roster WHERE session_id=? ORDER BY student_nim', [id])).map(student => student.student_nim);
      const students = (await rows(db, `SELECT st.nim,st.name FROM students st WHERE
        EXISTS (SELECT 1 FROM session_roster sr WHERE sr.session_id=? AND sr.student_nim=st.nim)
        OR EXISTS (SELECT 1 FROM attendance_records ar WHERE ar.session_id=? AND ar.student_nim=st.nim)
        ORDER BY st.nim`, [id, id])).map(dto);
      const records = (await rows(db, 'SELECT * FROM attendance_records WHERE session_id=? ORDER BY student_nim,id', [id])).map(dto);
      const auditTrail = await rows(db, 'SELECT a.id,a.attendance_record_id AS recordId,r.session_id AS sessionId,r.student_nim AS studentNim,a.old_status AS oldStatus,a.new_status AS newStatus,a.changed_by AS changedBy,a.created_at AS createdAt,a.method,a.reason FROM attendance_record_audit a JOIN attendance_records r ON r.id=a.attendance_record_id WHERE r.session_id=? ORDER BY a.id', [id]);
      return { session, students, records, auditTrail, generatedAt: new Date().toISOString() };
    });
    res.json({ data });
  }));
  for (const entity of [...Object.keys(entities), 'attendance-sessions', 'attendance-records', 'leave-requests']) {
    router.get(`/${entity}`, asyncRoute(async (req, res) => {
      if (entity === 'users' && req.user.role === 'admin' && !demoScope(req.user)) await ensureLecturerLoginAliases(pool);
      const page = integer(Number(req.query.page || 1), 1, 1000000), size = integer(Number(req.query.pageSize || 100), 1, 100);
      requireValue(req.query.archived !== '1' || req.user.role === 'admin', 'FORBIDDEN', 403);
      res.json(await listEntity(pool, req.user, entity, page, size, false, req.query.archived === '1'));
    }));
  }
  for (const [entity, spec] of Object.entries(entities)) {
    router.post(`/${entity}`, auth.role('admin'), asyncRoute(async (req, res) => {
      const data = await transaction(pool, db => createEntity(db, req.user, entity, req.body));
      res.status(201).json({ data });
    }));
    router.patch(`/${entity}/:id`, asyncRoute(async (req, res) => {
      if (entity === 'users' && req.params.id === req.user.id && req.body.email !== undefined) {
        await auth.limit(`profile-email-ip:${req.ip}`, 20);
        await auth.limit(`profile-email-user:${req.user.id}`, 5);
      }
      const updated = await transaction(pool, db => updateEntity(db, req.user, entity, req.params.id, req.body));
      res.json({ data: updated });
    }));
    router.delete(`/${entity}/:id`, auth.role('admin'), asyncRoute(async (req, res) => {
      await transaction(pool, async db => {
        const [old] = await rows(db, `SELECT * FROM ${entity} WHERE ${spec.key}=? FOR UPDATE`, [req.params.id]); assertDemoScope(old,req.user);
        if (entity === 'users' && old.role === 'admin') { const [count] = await rows(db, "SELECT COUNT(*) AS total FROM users WHERE role='admin' AND is_active=1 FOR UPDATE"); requireValue(count.total > 1, 'LAST_ADMIN_REQUIRED', 409); }
        if (['users', 'students'].includes(entity)) await rows(db, `UPDATE ${entity} SET is_active=0,version=version+1 WHERE ${spec.key}=?`, [req.params.id]);
        else await rows(db, `UPDATE ${entity} SET is_archived=1,archived_at=UTC_TIMESTAMP(),version=version+1 WHERE ${spec.key}=?`, [req.params.id]);
        if (entity === 'users' || (entity === 'students' && old.user_id)) await rows(db, "UPDATE device_sessions SET status='TERMINATED',revoked_at=UTC_TIMESTAMP() WHERE user_id=?", [entity === 'users' ? old.id : old.user_id]);
        if (entity === 'students' && old.user_id) await rows(db, 'UPDATE users SET is_active=0,version=version+1 WHERE id=?', [old.user_id]);
        await audit(db, req.user.id, 'ARCHIVE', entity, req.params.id);
      }); res.json({ data: { success: true } });
    }));
  }
  router.put('/students/:nim/relations', auth.role('admin'), asyncRoute(async (req, res) => {
    const { rombelIds, includedIds = [], excludedIds = [] } = req.body;
    for (const list of [rombelIds, includedIds, excludedIds]) requireValue(Array.isArray(list) && list.length <= 100 && list.every(id => typeof id === 'string' && id.length <= 100));
    await transaction(pool, async db => {
      assertDemoScope((await rows(db, 'SELECT * FROM students WHERE nim=? FOR UPDATE', [req.params.nim]))[0],req.user);
      await studentRelations(db,req.params.nim,req.body);
      await audit(db, req.user.id, 'ENROLLMENT_UPDATED', 'student', req.params.nim);
    }); res.json({ data: { success: true } });
  }));
  router.put('/rombels/:id/schedules', auth.role('admin'), asyncRoute(async (req, res) => {
    requireValue(Array.isArray(req.body.scheduleIds) && req.body.scheduleIds.length <= 100);
    await transaction(pool, async db => {
      assertDemoScope((await rows(db, 'SELECT * FROM rombels WHERE id=? FOR UPDATE', [req.params.id]))[0],req.user);
      await rombelSchedules(db,req.params.id,req.body.scheduleIds);
      await audit(db, req.user.id, 'RELATIONS_UPDATED', 'rombel', req.params.id);
    }); res.json({ data: { success: true } });
  }));
  router.put('/schedules/:id/meeting-dates', asyncRoute(async (req, res) => {
    const value = input('schedules', { meetingDates: req.body.meetingDates }, true);
    requireValue(value.meeting_dates);
    await transaction(pool, async db => { await ownedSchedule(db, req.user, req.params.id, true); await rows(db, 'UPDATE schedules SET meeting_dates=?,version=version+1 WHERE id=?', [value.meeting_dates, req.params.id]); await audit(db, req.user.id, 'MEETING_DATES_UPDATED', 'schedule', req.params.id); }); res.json({ data: { success: true } });
  }));
  router.post('/attendance-sessions', auth.role('admin', 'dosen'), asyncRoute(async (req, res) => {
    const id = token();
    const result = await transaction(pool, async db => {
      const schedule = await ownedSchedule(db, req.user, text(req.body.scheduleId, 100), true);
      await rows(db, 'SELECT id FROM users WHERE id=? FOR UPDATE', [schedule.lecturer_id]);
      requireValue(!schedule.is_archived, 'SCHEDULE_ARCHIVED', 409);
      const day = date(req.body.date), meeting = integer(req.body.meetingNumber, 1, 16);
      const [old] = await rows(db, 'SELECT * FROM attendance_sessions WHERE schedule_id=? AND meeting_number=? AND academic_period=? AND is_archived=0 ORDER BY is_open DESC,created_at DESC,id DESC LIMIT 1', [schedule.id, meeting, CURRENT_ACADEMIC_PERIOD]);
      if (old) {
        requireValue(old.is_open, 'SESSION_MEETING_COMPLETED', 409);
        return dto(old);
      }
      const start = req.body.startTime !== undefined ? time(req.body.startTime) : schedule.start_time.slice(0, 5), end = req.body.endTime !== undefined ? time(req.body.endTime) : schedule.end_time.slice(0, 5);
      requireValue(start < end);
      const qr = token(), expires = new Date(Date.now() + (req.body.isDynamicQr ? 30000 : 5400000));
      await rows(db, `INSERT INTO attendance_sessions (id,schedule_id,course_code,course_name,lecturer_id,lecturer_name,rombel,room,date,start_time,end_time,meeting_number,topic,evaluation_method,qr_token,is_dynamic_qr,qr_expires_at,is_open,created_at,academic_period,is_demo)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,UTC_TIMESTAMP(),?,?)`, [id, schedule.id, schedule.course_code, schedule.course_name, schedule.lecturer_id, schedule.lecturer_name, schedule.rombel, schedule.room, day, start, end, meeting, text(req.body.topic, 10000), text(req.body.evaluationMethod, 200, true), qr, Boolean(req.body.isDynamicQr), expires, CURRENT_ACADEMIC_PERIOD,Number(schedule.is_demo||0)]);
      const students = await eligible(db, schedule.id);
      for (const student of students) await rows(db, 'INSERT INTO session_roster VALUES (?,?)', [id, student.nim]);
      const meetingDates = typeof schedule.meeting_dates === 'string' ? JSON.parse(schedule.meeting_dates) : schedule.meeting_dates || {};
      await rows(db, 'UPDATE schedules SET meeting_dates=?,version=version+1 WHERE id=?', [JSON.stringify({ ...meetingDates, [meeting]: day }), schedule.id]);
      await audit(db, req.user.id, 'SESSION_CREATED', 'session', id);
      return dto((await rows(db, 'SELECT * FROM attendance_sessions WHERE id=?', [id]))[0]);
    }); res.status(201).json({ data: result });
  }));
  for (const action of ['close', 'reopen', 'rotate-qr']) router.post(`/attendance-sessions/:id/${action}`, auth.role('admin', 'dosen'), asyncRoute(async (req, res) => {
    const data = await transaction(pool, async db => {
      const session = await ownedSession(db, req.user, req.params.id);
      requireValue(!session.is_archived, 'SESSION_ARCHIVED', 409);
      if (action === 'close') return closeAttendance(db, req.user.id, session);
      if (action === 'reopen') {
        requireValue(req.user.role === 'admin', 'FORBIDDEN', 403);
        if (session.is_open) return dto(session);
        await rows(db, 'SELECT id FROM users WHERE id=? FOR UPDATE', [session.lecturer_id]);
        const conflict = await rows(db, 'SELECT id FROM attendance_sessions WHERE id<>? AND is_open=1 AND is_archived=0 AND (schedule_id=? OR lecturer_id=?) FOR UPDATE', [session.id, session.schedule_id, session.lecturer_id]);
        requireValue(!conflict.length, 'ACTIVE_SESSION_CONFLICT', 409);
        await rows(db, 'UPDATE attendance_sessions SET is_open=1,qr_token=?,qr_expires_at=NULL,reopened_at=UTC_TIMESTAMP(),version=version+1 WHERE id=?', [token(), session.id]);
      } else {
        requireValue(session.is_open, 'SESSION_CLOSED', 409);
        await rows(db, 'UPDATE attendance_sessions SET qr_token=?,qr_expires_at=?,version=version+1 WHERE id=?', [token(), new Date(Date.now() + (session.is_dynamic_qr ? 30000 : 5400000)), session.id]);
      }
      await audit(db, req.user.id, action.toUpperCase(), 'session', session.id);
      return dto((await rows(db, 'SELECT * FROM attendance_sessions WHERE id=?', [session.id]))[0]);
    }); res.json({ data });
  }));
  const archiveSession = reason => asyncRoute(async (req, res) => {
    const data = await transaction(pool, async db => {
      const session = await ownedSession(db, req.user, req.params.id);
      if (session.is_archived) return dto(session);
      await rows(db, 'UPDATE attendance_sessions SET is_archived=1,archived_at=UTC_TIMESTAMP(),archived_by=?,archive_reason=?,is_open=0,qr_token=?,qr_expires_at=NULL,version=version+1 WHERE id=?', [req.user.id, reason, token(), session.id]);
      await audit(db, req.user.id, `SESSION_${reason}`, 'session', session.id);
      return dto((await rows(db, 'SELECT * FROM attendance_sessions WHERE id=?', [session.id]))[0]);
    }); res.json({ data });
  });
  router.post('/attendance-sessions/:id/reset', auth.role('admin'), archiveSession('RESET'));
  router.delete('/attendance-sessions/:id', auth.role('admin'), archiveSession('ARCHIVE'));
  router.post('/attendance/scan', auth.role('mahasiswa'), asyncRoute(async (req, res) => {
    const qr = text(req.body.token, 255);
    const data = await transaction(pool, async db => {
      const [session] = await rows(db, 'SELECT * FROM attendance_sessions WHERE qr_token=? FOR UPDATE', [qr]); if(session) assertDemoScope(session,req.user); requireValue(!session?.is_archived, 'SESSION_ARCHIVED', 409); validateQr(session, qr);
      const student = await actorStudent(db, req.user);
      const record = await writeRecord(db, req.user.id, session, student, 'HADIR', 'QR_SCAN', 'QR terverifikasi server');
      const safeSession = dto(session); delete safeSession.qrToken;
      return { success: true, message: 'Presensi tercatat.', record, session: safeSession };
    }); res.json({ data });
  }));
  router.post('/attendance-sessions/:id/records/batch', auth.role('admin', 'dosen'), asyncRoute(async (req, res) => {
    requireValue(Array.isArray(req.body.updates) && req.body.updates.length > 0 && req.body.updates.length <= 100);
    const data = await transaction(pool, async db => {
      const session = await ownedSession(db, req.user, req.params.id), result = [];
      requireValue(!session.is_archived, 'SESSION_ARCHIVED', 409);
      if (req.body.version !== undefined) requireValue(req.body.version === session.version, 'VERSION_CONFLICT', 409);
      requireValue(new Set(req.body.updates.map(update => update.studentNim)).size === req.body.updates.length, 'DUPLICATE_STUDENT');
      for (const update of req.body.updates) if (update.version !== undefined) {
        const [record] = await rows(db, 'SELECT version,status,notes FROM attendance_records WHERE session_id=? AND student_nim=? FOR UPDATE', [session.id, text(update.studentNim, 50)]);
        const unchanged = record && record.status === update.status && (record.notes || '') === (text(update.reason || update.notes, 10000) || '');
        requireValue(unchanged || (record?.version ?? 0) === update.version, 'VERSION_CONFLICT', 409);
      }
      for (const update of req.body.updates) { const [student] = await rows(db, 'SELECT * FROM students WHERE nim=?', [text(update.studentNim, 50)]); requireValue(student, 'STUDENT_INVALID'); result.push(await writeRecord(db, req.user.id, session, student, update.status, 'MANUAL_DOSEN', text(update.reason || update.notes, 10000), true)); }
      return result;
    }); res.json({ data });
  }));
  router.get('/leave-recipients',asyncRoute(async(req,res)=>res.json({data:await rows(pool,"SELECT id,name FROM users WHERE role='dosen' AND is_active=1 AND is_demo=? ORDER BY name",[demoScope(req.user)])})));
  router.post('/leave-requests',auth.role('mahasiswa'),asyncRoute(async(req,res)=>{
    const data=await transaction(pool,async db=>{
      requireValue(!req.body.archiveMarker&&!req.body.legacyArchivePolicy&&!req.body.legacySourceHash,'LEGACY_ARCHIVE_IMPORT_ONLY');
      const student=await actorStudent(db,req.user);requireValue(['IZIN','SAKIT'].includes(req.body.type));
      const day=date(req.body.date),reason=text(req.body.reason,10000);
      requireValue(Array.isArray(req.body.recipientIds)&&req.body.recipientIds.length>0&&req.body.recipientIds.length<=30,'LEAVE_RECIPIENTS_REQUIRED');
      const recipients=[...new Set(req.body.recipientIds.map(id=>text(id,100)))];
      requireValue(recipients.length===req.body.recipientIds.length,'LEAVE_RECIPIENT_DUPLICATE');
      for(const id of recipients)requireValue((await rows(db,"SELECT id FROM users WHERE id=? AND role='dosen' AND is_active=1 AND is_demo=?",[id,demoScope(req.user)])).length,'RECIPIENT_INVALID');
      let proofId=null;
      if(req.body.proofId){const [proof]=await rows(db,'SELECT id FROM leave_proofs WHERE id=? AND owner_user_id=?',[text(req.body.proofId,100),req.user.id]);requireValue(proof,'PROOF_NOT_OWNED',403);proofId=proof.id;}
      requireValue(!req.body.proofDocumentUrl,'PRIVATE_PROOF_UPLOAD_REQUIRED');
      const id=token();await rows(db,'INSERT INTO leave_requests (id,student_nim,student_name,rombel,date,type,reason,proof_id) VALUES (?,?,?,?,?,?,?,?)',[id,student.nim,student.name,(await rows(db,'SELECT r.code FROM rombels r JOIN student_rombels sr ON sr.rombel_id=r.id WHERE sr.student_nim=?',[student.nim])).map(r=>r.code).join(', '),day,req.body.type,reason,proofId]);
      for(const lecturer of recipients)await rows(db,'INSERT INTO leave_recipients VALUES (?,?)',[id,lecturer]);
      await audit(db,req.user.id,'LEAVE_SUBMITTED','leave',id);return {...dto((await rows(db,'SELECT * FROM leave_requests WHERE id=?',[id]))[0]),recipientIds:recipients};
    });res.status(201).json({data});
  }));
  router.post('/leave-requests/:id/review',auth.role('admin','dosen'),asyncRoute(async(req,res)=>{
    requireValue(['APPROVED','REJECTED'].includes(req.body.decision));
    await transaction(pool,async db=>{
      const [leave]=await rows(db,'SELECT * FROM leave_requests WHERE id=? FOR UPDATE',[req.params.id]);requireValue(leave,'NOT_FOUND',404);await scopedReference(db,'students','nim',leave.student_nim,demoScope(req.user));
      requireValue(req.user.role==='admin'||(await rows(db,'SELECT 1 FROM leave_recipients WHERE leave_id=? AND lecturer_id=?',[leave.id,req.user.id])).length,'FORBIDDEN',403);
      requireValue(!leave.archive_marker,'LEGACY_ARCHIVE_IMMUTABLE',409);
      requireValue(leave.status==='PENDING','LEAVE_ALREADY_REVIEWED',409);
      await rows(db,'UPDATE leave_requests SET status=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?',[req.body.decision,req.user.id,leave.id]);
      await audit(db,req.user.id,'LEAVE_'+req.body.decision,'leave',leave.id);
    });res.json({data:{success:true}});
  }));
  return router;
}



