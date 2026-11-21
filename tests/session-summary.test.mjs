import test from 'node:test';
import assert from 'node:assert/strict';
import { getSessionAttendanceRows, getSessionAttendanceSummary } from '../src/utils/sessionAttendance.ts';
import { historicalAttendanceFixture } from './fixtures.mjs';

test('effective categories partition a deduplicated roster including unrecorded participants', () => {
  const source=historicalAttendanceFixture(),session=source.sessions[0];
  session.studentNims.push(session.studentNims[0]);
  const rows=getSessionAttendanceRows(session,source.students,source.records);
  assert.deepEqual(getSessionAttendanceSummary(rows),{HADIR:1,IZIN:1,SAKIT:1,ALPHA:1,UNRECORDED:1,total:5});
  const corrected=source.records.map(record=>record.sessionId===session.id&&record.status==='ALPHA'?{...record,status:'HADIR'}:record);
  const summary=getSessionAttendanceSummary(getSessionAttendanceRows(session,source.students,corrected));
  assert.equal(summary.HADIR,2);assert.equal(summary.ALPHA,0);assert.equal(summary.UNRECORDED,1);
  assert.equal(Math.round(summary.HADIR/summary.total*100),40);
  assert.equal(summary.HADIR+summary.IZIN+summary.SAKIT+summary.ALPHA+summary.UNRECORDED,summary.total);
  assert.equal(source.records.filter(record=>record.sessionId===session.id&&record.status==='ALPHA').length,1);
});
