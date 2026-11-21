import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAttendancePolicy, summarizeAllAttendancePolicy } from '../shared/attendance-policy.mjs';

function history(statuses, overrides = {}) {
  const sessions = statuses.map((status, i) => ({ id: `s${i}`, scheduleId: 'class-a', academicPeriod: '2026/2027-GANJIL',
    meetingNumber: i + 1, date: '2026-11-01', studentNims: ['synthetic'], ...overrides }));
  const records = statuses.flatMap((status, i) => status ? [{ id: `r${i}`, sessionId: `s${i}`, studentNim: 'synthetic', status }] : []);
  return { sessions, records };
}
const summarize = source => summarizeAttendancePolicy(source.sessions, source.records, 'synthetic');

test('separate two-event tolerances preserve all original statuses', () => {
  for (const [statuses, expected] of [
    [['IZIN', 'IZIN', 'SAKIT', 'SAKIT'], [4, 0]],
    [['IZIN', 'IZIN', 'IZIN', 'SAKIT'], [3, 1]],
    [['IZIN', 'SAKIT', 'SAKIT', 'SAKIT'], [3, 1]],
    [['IZIN', 'IZIN', 'IZIN', 'IZIN', 'SAKIT', 'SAKIT', 'SAKIT', 'SAKIT'], [4, 4]],
  ]) {
    const source = history(statuses), original = JSON.stringify(source), result = summarize(source);
    assert.deepEqual([result.hadir, result.alpha], expected);
    assert.equal(result.rawHadir, 0);
    assert.equal(result.totalSessions, statuses.length);
    assert.equal(JSON.stringify(source), original);
  }
});

test('meeting order, date and session ID determine tolerance regardless of input order', () => {
  const source = history(['IZIN', 'IZIN', 'IZIN']);
  source.sessions[0].meetingNumber = 2;
  source.sessions[1].meetingNumber = 1;
  source.sessions[2].meetingNumber = 2;
  source.sessions[0].date = '2026-11-02';
  source.sessions[2].date = '2026-11-01';
  assert.deepEqual(summarize(source).rows.map(r => [r.sessionId, r.effectiveStatus]), [['s1', 'HADIR'], ['s2', 'HADIR'], ['s0', 'ALPHA']]);
  source.sessions.forEach(s => { s.meetingNumber = 1; s.date = '2026-11-01'; });
  assert.deepEqual(summarize({ sessions: source.sessions.reverse(), records: source.records }).rows.map(r => r.sessionId), ['s0', 's1', 's2']);
});

test('student, class and academic period never share tolerance counters', () => {
  const source = history(Array(6).fill('IZIN'));
  source.sessions[2].scheduleId = source.sessions[3].scheduleId = 'class-b';
  source.sessions[4].academicPeriod = source.sessions[5].academicPeriod = '2026/2027-GENAP';
  source.sessions.forEach(s => s.studentNims.push('other'));
  source.records.push(...source.records.map(r => ({ ...r, id: `${r.id}-other`, studentNim: 'other' })));
  const result = summarizeAttendancePolicy(source.sessions, source.records);
  assert.equal(result.hadir, 12);
  assert.equal(result.groups.length, 6);
  source.sessions[2].scheduleId = source.sessions[3].scheduleId = 'class-a';
  source.sessions[2].courseCode = source.sessions[3].courseCode = 'OTHER-COURSE';
  assert.equal(summarize(source).hadir, 6);
});

test('archived/reset execution is excluded; missing record is not Alpa', () => {
  const source = history(['IZIN', 'IZIN', 'IZIN', null]);
  source.sessions[0].isArchived = true;
  source.sessions[0].archiveReason = 'RESET';
  const result = summarize(source);
  assert.equal(result.totalSessions, 3);
  assert.equal(result.hadir, 2);
  assert.equal(result.alpha, 0);
  assert.equal(result.belumTercatat, 1);
  assert.equal(result.rows[2].effectiveStatus, null);
});

test('correction reallocates tolerance and partial exports do not renew it', () => {
  const source = history(['IZIN', 'IZIN', 'IZIN', 'IZIN']);
  let partial = summarizeAttendancePolicy(source.sessions, source.records, 'synthetic', { sessionIds: ['s2', 's3'] });
  assert.equal(partial.hadir, 0);
  source.records[0].status = 'HADIR';
  partial = summarizeAttendancePolicy(source.sessions, source.records, 'synthetic', { sessionIds: ['s2', 's3'] });
  assert.equal(partial.hadir, 1);
  assert.equal(partial.alpha, 1);
});

test('existing inclusive 75 percent boundary remains unchanged', () => {
  assert.equal(summarize(history(['HADIR', 'IZIN', 'SAKIT', 'ALPHA'])).eligible, true);
  assert.equal(summarize(history(['HADIR', 'ALPHA', 'ALPHA', 'ALPHA'])).eligible, false);
});

test('unknown historical period or class fails closed without guessing dates or assigning Alpa', () => {
  for (const overrides of [{ academicPeriod: undefined }, { scheduleId: undefined }]) {
    const result = summarize(history(['IZIN', 'SAKIT'], overrides));
    assert.equal(result.periodUnresolved, true);
    assert.equal(result.hadir, 0);
    assert.equal(result.alpha, 0);
    assert.equal(result.unresolvedRecords, 2);
    assert.equal(result.eligible, false);
  }
  const source = history(['IZIN', 'SAKIT'], { academicPeriod: undefined });
  assert.equal(summarizeAttendancePolicy(source.sessions, source.records, 'synthetic', { periodKey: () => 'owner-confirmed-period' }).hadir, 2);
  source.sessions[1].academicPeriod = 'confirmed';
  const partial = summarizeAttendancePolicy(source.sessions, source.records, 'synthetic', { sessionIds: ['s1'] });
  assert.equal(partial.periodUnresolved, false);
  assert.equal(partial.hadir, 1);
});

test('duplicate records fail explicitly rather than silently changing totals', () => {
  const source = history(['IZIN']);
  source.records.push({ ...source.records[0], id: 'duplicate' });
  assert.throws(() => summarize(source), /DUPLICATE_ATTENDANCE_RECORD/);
});

test('only proven historical roster or actual record establishes participation', () => {
  const source = history([null, null, null, 'HADIR']);
  source.sessions[0].studentNims = [];
  source.sessions[1].studentNims = undefined;
  source.sessions[2].studentNims = ['other'];
  source.sessions[3].studentNims = [];
  assert.equal(summarize(source).totalSessions, 1);
  assert.equal(summarize(source).rawHadir, 1);
  assert.equal(summarizeAllAttendancePolicy(source.sessions, source.records).totalSessions, 2);
});
