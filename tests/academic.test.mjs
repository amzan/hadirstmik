import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCourseEffectiveAttendance, getStudentEnrolledSchedules, getStudentTotalSks, getStudentRombelList, isStudentInRombel } from '../src/data/initialData.ts';

test('attendance tolerance keeps first two izin and sakit; excess remains alpha',()=>{
  const result=calculateCourseEffectiveAttendance({totalSessions:16,rawHadir:10,izin:3,sakit:3,rawAlpha:0});assert.equal(result.hadir,14);assert.equal(result.alpha,2);assert.equal(result.percentage,88);
  for(const amount of [0,1,2]){const r=calculateCourseEffectiveAttendance({totalSessions:16,rawHadir:0,izin:amount,sakit:amount,rawAlpha:0});assert.equal(r.hadir,amount*2);assert.equal(r.alpha,0);}
  assert.equal(calculateCourseEffectiveAttendance({totalSessions:0,rawHadir:0,izin:0,sakit:0,rawAlpha:0}).percentage,0);
});
test('rombel shorthand and aliases do not confuse semester 1 with semester 10',()=>{
  assert.deepEqual(getStudentRombelList('TI 1 & 5'),['TI 1A','TI 5']);assert(isStudentInRombel('TI 1A','TI 1'));assert(!isStudentInRombel('MI 1A','MI 1U'));assert(!isStudentInRombel('TI 10','TI 1'));assert(!isStudentInRombel('MI 10','MI 1U'));assert(!isStudentInRombel('TI 1A','TI 1B'));
});
test('enrollment gives EXCLUDE priority and ignores archived schedules',()=>{
  const student={rombel:'TI 1A',excludedScheduleIds:['both'],customScheduleIds:['both','extra']};
  const schedules=[{id:'both',rombel:'TI 1A',sks:2},{id:'regular',rombel:'TI 1A',sks:3},{id:'extra',rombel:'TI 3',sks:4},{id:'archived',rombel:'TI 1A',sks:5,isArchived:true}];
  assert.deepEqual(getStudentEnrolledSchedules(student,schedules).map(s=>s.id),['regular','extra']);assert.equal(getStudentTotalSks(student,schedules),7);
});
