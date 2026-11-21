export const MAX_TOLERATED_IZIN_AS_HADIR = 2;
export const MAX_TOLERATED_SAKIT_AS_HADIR = 2;
export const CURRENT_ACADEMIC_PERIOD = 'Semester Ganjil 2026/2027';

export function calculateCourseEffectiveAttendance(counts) {
  const totalSessions = Math.max(0, counts.totalSessions || 0);
  const rawHadir = totalSessions ? counts.rawHadir || 0 : 0;
  const izin = totalSessions ? counts.izin || 0 : 0;
  const sakit = totalSessions ? counts.sakit || 0 : 0;
  const rawAlpha = totalSessions ? counts.rawAlpha || 0 : 0;
  const izinAsHadir = Math.min(izin, MAX_TOLERATED_IZIN_AS_HADIR);
  const sakitAsHadir = Math.min(sakit, MAX_TOLERATED_SAKIT_AS_HADIR);
  const excessIzin = izin - izinAsHadir, excessSakit = sakit - sakitAsHadir;
  const hadir = Math.min(totalSessions, rawHadir + izinAsHadir + sakitAsHadir);
  const percentage = totalSessions ? Math.min(100, Math.round(hadir / totalSessions * 100)) : 0;
  return { totalSessions, rawHadir, izin, sakit, rawAlpha, izinAsHadir, sakitAsHadir,
    excessIzin, excessSakit, hadir, alpha: rawAlpha + excessIzin + excessSakit, percentage, eligible: percentage >= 75 };
}

const compareText = (a, b) => String(a || '') < String(b || '') ? -1 : String(a || '') > String(b || '') ? 1 : 0;

/** Evaluate the full history before selecting report rows; partial exports must not renew tolerance. */
export function summarizeAttendancePolicy(sessions, records, studentNim, options = {}) {
  const selected = options.sessionIds ? new Set(options.sessionIds) : null;
  const active = sessions.filter(s => !s.isArchived && !s.is_archived && !s.archivedAt && !s.archived_at && !s.archiveReason && !s.archive_reason);
  const indexed = new Map();
  for (const record of records) {
    const key = JSON.stringify([record.sessionId, record.studentNim]);
    if (indexed.has(key)) throw new Error('DUPLICATE_ATTENDANCE_RECORD');
    indexed.set(key, record);
  }
  const ordered = [...active].sort((a, b) => (Number(a.meetingNumber) || 999) - (Number(b.meetingNumber) || 999)
    || compareText(a.date, b.date) || compareText(a.id, b.id));
  const groups = new Map(), rows = [];
  let periodUnresolved = false;
  for (const session of ordered) {
    const period = typeof options.periodKey === 'function' ? options.periodKey(session)
      : options.periodKey || session.academicPeriod || session.periodKey;
    const resolved = Boolean(period && session.scheduleId);
    const classKey = session.scheduleId || `UNRESOLVED:${session.id}`;
    const nims = studentNim ? [studentNim] : [...new Set([
      ...(session.studentNims || []), ...records.filter(r => r.sessionId === session.id).map(r => r.studentNim),
    ])];
    for (const nim of nims) {
      if (!session.studentNims?.includes(nim)
        && !indexed.has(JSON.stringify([session.id, nim]))) continue;
      const groupKey = JSON.stringify([nim, classKey, session.courseCode || '', period || 'UNRESOLVED']);
      let group = groups.get(groupKey);
      if (!group) { group = { groupKey, studentNim: nim, scheduleId: session.scheduleId || null, periodKey: period || null, izin: 0, sakit: 0 }; groups.set(groupKey, group); }
      const record = indexed.get(JSON.stringify([session.id, nim]));
      const status = record?.status || null;
      let effectiveStatus = status, toleranceApplied = false;
      if (status === 'IZIN' || status === 'SAKIT') {
        const counter = status === 'IZIN' ? 'izin' : 'sakit';
        group[counter]++;
        toleranceApplied = resolved && group[counter] <= 2;
        effectiveStatus = resolved ? (toleranceApplied ? 'HADIR' : 'ALPHA') : null;
      }
      if (!selected || selected.has(session.id)) {
        if (!resolved) periodUnresolved = true;
        rows.push({ sessionId: session.id, recordId: record?.id || null,
          studentNim: nim, status, effectiveStatus, toleranceApplied, groupKey });
      }
    }
  }
  const count = predicate => rows.filter(predicate).length;
  const rawHadir = count(r => r.status === 'HADIR'), izin = count(r => r.status === 'IZIN'), sakit = count(r => r.status === 'SAKIT');
  const rawAlpha = count(r => r.status === 'ALPHA'), hadir = count(r => r.effectiveStatus === 'HADIR');
  const izinAsHadir = count(r => r.status === 'IZIN' && r.toleranceApplied), sakitAsHadir = count(r => r.status === 'SAKIT' && r.toleranceApplied);
  const percentage = rows.length ? Math.round(hadir / rows.length * 100) : 0;
  return { totalSessions: rows.length, rawHadir, izin, sakit, rawAlpha, hadir,
    alpha: count(r => r.effectiveStatus === 'ALPHA'), belumTercatat: count(r => r.status === null),
    izinAsHadir, sakitAsHadir, excessIzin: count(r => r.status === 'IZIN' && r.effectiveStatus === 'ALPHA'),
    excessSakit: count(r => r.status === 'SAKIT' && r.effectiveStatus === 'ALPHA'),
    unresolvedRecords: count(r => r.status !== null && r.effectiveStatus === null),
    percentage, eligible: !periodUnresolved && percentage >= 75, rows, groups: [...groups.values()], periodUnresolved };
}

export function summarizeAllAttendancePolicy(sessions, records, options = {}) {
  return summarizeAttendancePolicy(sessions, records, undefined, options);
}
