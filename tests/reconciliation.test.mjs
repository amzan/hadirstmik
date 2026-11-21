import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitRombels, canonicalRombel, sameRombelMembership } from '../shared/academic-relations.mjs';
import { reconcileLegacy } from '../backend/reconciliation.mjs';
import { prepareImport } from '../backend/importer.mjs';
import { getStudentEnrolledSchedules, getStudentTotalSks, MAX_STANDARD_SKS } from '../src/data/initialData.ts';
import { legacyFixture, fixture } from './fixtures.mjs';

test('only confirmed TI 1 alias applies; composites preserve separate identities',()=>{
  assert.equal(canonicalRombel('TI 1'),'TI 1A');assert.notEqual(canonicalRombel('TI 5'),'TI 1A');
  assert.deepEqual(splitRombels('TI 1 & 5'),['TI 1A','TI 5']);assert.deepEqual(splitRombels(['TI 1','TI 1A','TI 5']),['TI 1A','TI 5']);
  assert(!sameRombelMembership('MI 1A','MI 1U'));assert(!sameRombelMembership('MI 5A','MI 5'));assert(!sameRombelMembership('TI 1B','TI 1'));assert.deepEqual(splitRombels('5'),['5']);
});

test('shared schedules count once and retain INCLUDE, EXCLUDE and the 20 SKS threshold',()=>{
  const schedules=[{id:'shared',rombel:'TI 1 & 5',sks:2},{id:'extra',rombel:'MI 1U',sks:3},{id:'drop',rombel:'TI 1 & 5',sks:4}];
  const student={rombels:['TI 1','TI 1A','TI 5'],customScheduleIds:['extra','drop'],excludedScheduleIds:['drop']};
  assert.deepEqual(getStudentEnrolledSchedules(student,[...schedules,schedules[0]]).map(s=>s.id),['shared','extra']);
  assert.equal(getStudentTotalSks(student,schedules),5);assert.equal(getStudentTotalSks({...student,rombels:['TI 1A','TI 5']},schedules),5);assert.equal(MAX_STANDARD_SKS,20);
});

test('owner policy accepts source attendance as roster while preserving all 644 records',()=>{
  const source=legacyFixture(),before=JSON.stringify(source),result=reconcileLegacy(source,{observedRombels:['5']});
  assert.equal(JSON.stringify(source),before);assert.deepEqual(result.data.records,source.records);assert(result.data.sessions.every(session=>Array.isArray(session.studentNims)));
  assert.equal(result.report.counts.records,644);assert.equal(new Set(result.data.records.map(r=>`${r.sessionId}:${r.studentNim}`)).size,644);
  assert.equal(result.report.counts.accountLinks,66);assert.equal(result.report.counts.enrollmentLinks,66);assert.equal(result.report.counts.scheduleLinks,68);
  assert.equal(result.report.counts.evidencedParticipants,644);assert.equal(result.report.counts.completeRosters,30);assert.equal(result.report.conflictCounts.HISTORICAL_ROSTER_INCOMPLETE,undefined);assert.equal(result.report.conflictCounts.ROMBEL_IDENTITY_UNPROVEN,undefined);
  assert.equal(result.report.status,'READY');assert.equal(result.report.dryRun.valid,true);
  assert.deepEqual(reconcileLegacy(source,{observedRombels:['5']}).report,result.report);
});

test('complete explicit rosters survive membership edits and produce valid repeatable import preview',()=>{
  const source=legacyFixture({completeRosters:true}),before=structuredClone(source.sessions);
  const first=reconcileLegacy(source);assert.equal(first.report.status,'READY');assert.equal(first.report.dryRun.valid,true);
  source.students[0].rombel='TI 5';source.students[0].rombels=['TI 5'];
  const second=reconcileLegacy(source);assert.deepEqual(second.data.sessions,before);assert.equal(second.data.records.length,644);
  assert.equal(prepareImport(first.data).sourceHash,prepareImport(first.data).sourceHash);
});

test('legacy leave archives while missing overrides remain conflicts, with original values preserved',()=>{
  const source=legacyFixture({completeRosters:true});source.sessions[1].courseCode=source.sessions[0].courseCode;
  source.students[0].excludedScheduleIds=['missing-synthetic-schedule'];
  source.leaveRequests=[{id:'synthetic-leave',studentNim:source.students[0].nim,studentName:'Synthetic Student',courseCode:source.sessions[0].courseCode,courseName:'Synthetic Course',rombel:'TI 1 & 5',date:'2026-11-19',status:'PENDING',type:'IZIN',reason:'Synthetic reason',createdAt:'2026-11-19T00:00:00Z'}];
  const result=reconcileLegacy(source);assert.equal(result.report.counts.archivedLeaves,1);assert.equal(result.data.leaveRequests[0].archiveMarker,'LEGACY_ARCHIVED_NO_RECIPIENT');assert.equal(result.report.conflictCounts.OVERRIDE_TARGET_UNPROVEN,1);assert(!result.data.leaveRequests[0].sessionId);assert.deepEqual(result.data.students[0].excludedScheduleIds,['missing-synthetic-schedule']);assert.equal(result.report.dryRun.valid,false);
});

test('importer rejects canonical catalog collisions and attendance outside historical roster',()=>{
  const source=fixture();source.rombels.push({...source.rombels[0],id:'alias-collision',code:'TI 1'});
  assert(prepareImport(source).issues.some(i=>i.code==='CANONICAL_ROMBEL_COLLISION'));
  const reconciled=reconcileLegacy(source);assert.equal(reconciled.data.rombels.length,source.rombels.length);assert.equal(reconciled.report.status,'PARTIAL');assert(reconciled.report.dryRun.issues.some(i=>i.code==='CANONICAL_ROMBEL_COLLISION'));
  const history=legacyFixture({completeRosters:true});history.sessions[0].studentNims=[];
  assert(reconcileLegacy(history).report.dryRun.issues.some(i=>i.code==='RECORD_OUTSIDE_HISTORICAL_ROSTER'));
});

test('three legacy archives preserve history; importer rejects forged provenance and unmarked empty recipients',()=>{
  const source=legacyFixture({completeRosters:true});
  source.leaveRequests=['PENDING','APPROVED','REJECTED'].map((status,i)=>({id:'archive-'+i,studentNim:source.students[0].nim,studentName:'Synthetic',rombel:'TI 1A',date:'2026-11-19',type:'IZIN',reason:'Synthetic history',status,createdAt:'2026-11-19T00:00:00Z'}));
  const before=structuredClone(source),plan=reconcileLegacy(source);
  assert.equal(plan.report.counts.archivedLeaves,3);assert(plan.report.dryRun.valid);assert.deepEqual(source,before);assert.deepEqual(plan.data.records,before.records);
  for(let i=0;i<3;i++){for(const [key,value] of Object.entries(before.leaveRequests[i]))assert.deepEqual(plan.data.leaveRequests[i][key],value);assert.deepEqual(plan.data.leaveRequests[i].recipientIds,[]);assert(!plan.data.leaveRequests[i].sessionId);}
  assert.equal(prepareImport(plan.data).sourceHash,prepareImport(reconcileLegacy(source).data).sourceHash);
  assert(prepareImport(source).issues.some(i=>i.code==='LEAVE_RECIPIENTS_REQUIRED'));
  const tampered=structuredClone(plan.data);tampered.leaveRequests[0].status='APPROVED';assert(!prepareImport(tampered).valid);assert(!reconcileLegacy(tampered).report.dryRun.valid);
  const linked=structuredClone(source);linked.leaveRequests[0].sessionId=source.sessions[0].id;assert.equal(reconcileLegacy(linked).report.conflictCounts.LEGACY_LEAVE_LINK_REQUIRES_REVIEW,1);
});
