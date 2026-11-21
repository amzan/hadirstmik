import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exclusionImpact } from '../backend/legacy-excludes.mjs';
import { reconcileLegacy } from '../backend/reconciliation.mjs';
import { excludeReviewFixture } from './fixtures.mjs';
import { validateAndParseBackupFile, createDatabaseBackupObject } from '../src/utils/databaseBackupService.ts';
import { prepareImport } from '../backend/importer.mjs';

test('CONTINUE requires an explicit valid eligible replacement and recalculates SKS without mutation',()=>{
  const source=excludeReviewFixture(),student=source.students[0],before=structuredClone(student);
  const impact=exclusionImpact(student,source.schedules,'CONTINUE',source.schedules[0].id);assert.equal(impact.beforeSks,18);assert.equal(impact.afterSks,16);assert.deepEqual(student,before);
  assert.throws(()=>exclusionImpact(student,source.schedules,'CONTINUE',undefined));assert.throws(()=>exclusionImpact(student,source.schedules,'CONTINUE','missing'));
  assert.throws(()=>exclusionImpact({...student,customScheduleIds:[source.schedules[0].id]},source.schedules,'CONTINUE',source.schedules[0].id));
});
test('ARCHIVE and DEFER preserve enrollment and valid exclusions; no default decision resolves missing references',()=>{
  const source=excludeReviewFixture();for(const action of ['ARCHIVE','DEFER']){const p=exclusionImpact(source.students[0],source.schedules,action);assert.deepEqual(p.beforeScheduleIds,p.afterScheduleIds);assert.equal(p.afterSks,18);}
  const before=JSON.stringify(source),plan=reconcileLegacy(source);assert.equal(plan.report.conflictCounts.OVERRIDE_TARGET_UNPROVEN,18);assert.equal(JSON.stringify(source),before);
});
test('stored final decision changes only candidate overrides; DEFER remains unresolved and all 644 records stay intact',()=>{
  const source=excludeReviewFixture(),base={student_nim:source.students[0].nim,old_schedule_id:'obsolete-synthetic-schedule',decided_by:'synthetic-admin',decided_at:'2026-11-20T00:00:00Z',reason:'Synthetic academic decision'};
  for(const action of ['CONTINUE','ARCHIVE','DEFER']){
    const plan=reconcileLegacy(source,{excludeDecisions:[{...base,action,new_schedule_id:source.schedules[0].id}]});
    assert.deepEqual(plan.data.records,source.records);assert.equal(plan.data.records.length,644);
    assert.equal(plan.report.conflictCounts.OVERRIDE_TARGET_UNPROVEN,action==='DEFER'?18:17);
    assert(plan.data.students[0].excludedScheduleIds.includes(source.schedules[9].id));
    assert.equal(plan.data.students[0].excludedScheduleIds.includes(source.schedules[0].id),action==='CONTINUE');
  }
});
test('SKS overflow and target outside enrollment are rejected',()=>{
  const source=excludeReviewFixture();assert.throws(()=>exclusionImpact({...source.students[0],excludedScheduleIds:[]},source.schedules,'ARCHIVE'));
  assert.throws(()=>exclusionImpact({...source.students[0],rombel:'MI 9',rombels:['MI 9'],excludedScheduleIds:[]},source.schedules,'CONTINUE',source.schedules[0].id));
});
test('candidate backup parsing and export retain the server review binding',()=>{
  const source=reconcileLegacy(excludeReviewFixture()).data;source.legacyReviewSource='a'.repeat(64);
  const parsed=validateAndParseBackupFile(JSON.stringify({data:source}));assert(parsed.isValid);
  assert.equal(parsed.backup.data.legacyReviewSource,source.legacyReviewSource);
  const exported=createDatabaseBackupObject(parsed.backup.data);assert.equal(exported.data.legacyReviewSource,source.legacyReviewSource);
  assert.equal(prepareImport(exported).data.legacyReviewSource,source.legacyReviewSource);
});
