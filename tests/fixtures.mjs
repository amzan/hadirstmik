import { createHash } from 'node:crypto';
import { canonical, prepareImport } from '../backend/importer.mjs';
import { snapshotCipher } from '../backend/admin.mjs';
import { reconcileLegacy } from '../backend/reconciliation.mjs';
export function excludeReviewFixture(){
  const source=legacyFixture();
  source.students.forEach((s,i)=>{s.excludedScheduleIds=[...source.schedules.slice(9).map(schedule=>schedule.id),...(i<18?['obsolete-synthetic-schedule']:[])];});
  return source;
}

export function legacyFixture({ completeRosters = false } = {}) {
  const lecturers=Array.from({length:11},(_,i)=>({id:`lecturer-synthetic-${i}`,username:`lecturer-synthetic-${i}`,name:`Synthetic Lecturer ${i}`,email:`lecturer-${i}@example.test`,role:'dosen'}));
  const students=Array.from({length:66},(_,i)=>({nim:`synthetic-${String(i).padStart(3,'0')}`,name:`Synthetic Student ${i}`,email:`student-${i}@example.test`,prodi:'Teknologi Informasi',rombel:i%2?'TI 5':'TI 1',rombels:[i%2?'TI 5':'TI 1']}));
  const users=[{id:'admin-synthetic',username:'admin-synthetic',name:'Synthetic Admin',email:'admin@example.test',role:'admin'},...lecturers,...students.map(s=>({id:`account-${s.nim}`,username:s.nim,name:s.name,email:s.email,role:'mahasiswa'}))];
  const courses=Array.from({length:29},(_,i)=>({id:`course-synthetic-${i}`,code:`SYN${i}`,name:`Synthetic Course ${i}`,sks:2,semester:1,prodi:'Teknologi Informasi',defaultLecturerId:lecturers[0].id,defaultLecturerName:lecturers[0].name}));
  const schedules=Array.from({length:34},(_,i)=>({id:`schedule-synthetic-${i}`,day:'Senin',startTime:'09:00',endTime:'10:00',courseCode:courses[i%29].code,courseName:courses[i%29].name,sks:2,lecturerId:lecturers[0].id,lecturerName:lecturers[0].name,room:'Synthetic Room',rombel:'TI 1 & 5',prodi:'Teknologi Informasi'}));
  const sessions=Array.from({length:30},(_,i)=>({id:`session-synthetic-${i}`,scheduleId:schedules[i].id,courseCode:schedules[i].courseCode,courseName:schedules[i].courseName,lecturerId:lecturers[0].id,lecturerName:lecturers[0].name,rombel:'TI 1 & 5',room:'Synthetic Room',date:'2026-11-19',startTime:'09:00',endTime:'10:00',meetingNumber:1,topic:'Synthetic history',isOpen:false,...(completeRosters?{studentNims:students.map(s=>s.nim)}:{})}));
  const records=Array.from({length:644},(_,i)=>({id:`record-synthetic-${i}`,sessionId:sessions[i%30].id,courseCode:sessions[i%30].courseCode,courseName:sessions[i%30].courseName,studentNim:students[Math.floor(i/30)].nim,studentName:students[Math.floor(i/30)].name,rombel:'TI 1 & 5',status:i%5?'HADIR':'ALPHA',scannedAt:'2026-11-19T02:30:00.000Z',verificationMethod:'MANUAL_DOSEN'}));
  return {users,students,courses,schedules,sessions,records,leaveRequests:[]};
}

export function fixture() {
  return {
    users: [
      { id: 'admin-test', username: 'admin-test', name: 'Admin Test', email: 'admin@example.test', role: 'admin' },
      { id: 'lecturer-test', username: 'lecturer-test', name: 'Lecturer Test', email: 'lecturer@example.test', role: 'dosen' },
      { id: 'other-lecturer', username: 'other-lecturer', name: 'Other Lecturer', email: 'other@example.test', role: 'dosen' },
      { id: 'student-test', username: '0001', name: 'Student Test', email: 'student@example.test', role: 'mahasiswa' },
      { id: 'student-other', username: '0002', name: 'Student Other', email: 'student-other@example.test', role: 'mahasiswa' },
    ],
    students: [
      { nim: '0001', name: 'Student Test', email: 'student@example.test', prodi: 'Teknologi Informasi', rombel: 'TI 1A', rombels: ['TI 1A'] },
      { nim: '0002', name: 'Student Other', email: 'student-other@example.test', prodi: 'Teknologi Informasi', rombel: 'TI 1B', rombels: ['TI 1B'] },
    ],
    rombels: [
      { id: 'rombel-test', code: 'TI 1A', name: 'Test A', semester: 1, prodi: 'Teknologi Informasi', scheduleIds: ['schedule-test'] },
      { id: 'rombel-other', code: 'TI 1B', name: 'Test B', semester: 1, prodi: 'Teknologi Informasi', scheduleIds: [] },
    ],
    courses: [{ id: 'course-test', code: 'TEST001', name: 'Synthetic Course', sks: 2, semester: 1, prodi: 'Teknologi Informasi', defaultLecturerId: 'lecturer-test', defaultLecturerName: 'Lecturer Test' }],
    schedules: [{ id: 'schedule-test', day: 'Senin', startTime: '00:00', endTime: '23:59', courseCode: 'TEST001', courseName: 'Synthetic Course', sks: 2, lecturerId: 'lecturer-test', lecturerName: 'Lecturer Test', room: 'Test Room', rombel: 'TI 1A', prodi: 'Teknologi Informasi', meetingDates: {} }],
    sessions: [], records: [], leaveRequests: [],
  };
}

export function lecturerHistoryFixture() {
  const source = fixture();
  source.schedules.push(
    { ...source.schedules[0], id: 'schedule-same-course', startTime: '10:00', endTime: '11:00' },
    { ...source.schedules[0], id: 'schedule-other-lecturer', lecturerId: 'other-lecturer', lecturerName: 'Lecturer Test' },
  );
  source.rombels[0].scheduleIds = source.schedules.map(schedule => schedule.id);
  source.sessions = Array.from({ length: 5 }, (_, index) => ({
    id: `history-session-${index + 1}`, scheduleId: 'schedule-test', courseCode: 'TEST001', courseName: 'Synthetic Course',
    lecturerId: 'lecturer-test', lecturerName: 'Legacy Lecturer', rombel: 'TI 1', room: 'Historic Room',
    date: `2026-11-0${index + 1}`, startTime: '09:00', endTime: '10:00', meetingNumber: index + 1,
    topic: `Synthetic historical meeting ${index + 1}`, isOpen: false, studentNims: ['0001'],
  }));
  source.records = source.sessions.map(session => ({
    id: `history-record-${session.meetingNumber}`, sessionId: session.id, courseCode: session.courseCode, courseName: session.courseName,
    studentNim: '0001', studentName: 'Student Test', rombel: session.rombel, status: 'HADIR',
    scannedAt: `${session.date}T02:15:00.000Z`, verificationMethod: 'MANUAL_DOSEN',
  }));
  return source;
}

export function historicalAttendanceFixture() {
  const source = lecturerHistoryFixture();
  for (let index = 3; index <= 5; index++) {
    const nim = `000${index}`;
    source.students.push({ ...source.students[0], nim, name: `Synthetic History Student ${index}`, email: `history-${index}@example.test` });
    source.users.push({ id: `history-user-${index}`, username: nim, name: `Synthetic History Student ${index}`, email: `history-${index}@example.test`, role: 'mahasiswa' });
  }
  const nims = source.students.map(student => student.nim);
  source.sessions[0].studentNims = nims;
  source.records = source.records.filter(record => record.sessionId !== source.sessions[0].id);
  for (const [index, status] of ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'].entries()) {
    const student = source.students[index], session = source.sessions[0];
    source.records.push({ id: `historical-attendance-${index}`, sessionId: session.id,
      courseCode: session.courseCode, courseName: session.courseName, studentNim: student.nim,
      studentName: student.name, rombel: session.rombel, status, scannedAt: `${session.date}T02:15:00.000Z`, verificationMethod: 'MANUAL_DOSEN' });
  }
  source.sessions.push({ ...source.sessions[0], id: 'history-session-empty', meetingNumber: 6, studentNims: nims });
  return source;
}

export function accountActivationBrowserFixture() {
  const source = fixture();
  source.users.push(...Array.from({ length: 53 }, (_, index) => ({
    id: `activation-lecturer-${index}`, username: `activation-lecturer-${index}`,
    name: `Activation Lecturer ${index}`, email: `activation-lecturer-${index}@example.test`, role: 'dosen',
  })));
  return source;
}

export function archivedLeaveFixture() {
  const source=legacyFixture({completeRosters:true});
  source.leaveRequests=['PENDING','APPROVED','REJECTED'].map((status,i)=>({id:'archive-'+i,studentNim:source.students[0].nim,studentName:'Synthetic Student',rombel:'TI 1A',date:'2026-11-19',type:i===1?'SAKIT':'IZIN',reason:'Synthetic historical archive',...(i===0?{proofDocumentUrl:'data:application/pdf;base64,JVBERi0xLjQ='}:{}),status,createdAt:'2026-11-19T00:00:00Z'}));
  return source;
}

export function historicalReviewFixture() {
  const source=excludeReviewFixture();source.leaveRequests=archivedLeaveFixture().leaveRequests;source.records[0].scannedAt='2026-11-19T00:00:00.123Z';source.sessions[0].createdAt='2026-11-19T00:00:00.456Z';
  const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
  const sourceHash=digest(source),operator={id:'historical-operator-synthetic',username:'historical-operator-synthetic',name:'Synthetic migration operator',role:'admin'};
  const reason='Synthetic archival decision',at='2026-11-20T00:00:00.000Z';
  const items=source.students.filter(s=>s.excludedScheduleIds.includes('obsolete-synthetic-schedule')).map(s=>({id:digest([sourceHash,s.nim,'obsolete-synthetic-schedule']),source_hash:sourceHash,student_nim:s.nim,old_schedule_id:'obsolete-synthetic-schedule',action:'ARCHIVE',new_schedule_id:null,decided_by:operator.id,decided_at:at,reason,version:2}));
  const plan=reconcileLegacy(source,{excludeDecisions:items});plan.data.legacyReviewSource=sourceHash;
  const oldSecret='synthetic-original-review-key-more-than-32-characters',newSecret='synthetic-new-backup-key-more-than-32-characters';
  const requestId='historical-synthetic-archive';
  return {oldSecret,newSecret,packet:{batch:{source_hash:sourceHash,encrypted_source:snapshotCipher(oldSecret).encrypt(source),candidate_hash:prepareImport(plan.data).sourceHash,created_by:operator.id,created_at:at},items,decisions:[{request_id:requestId,source_hash:sourceHash,request_hash:digest({requestId,reason}),action:'ARCHIVE',new_schedule_id:null,student_items:JSON.stringify(items.map(i=>i.id)),admin_id:operator.id,reason,decided_at:at,result:JSON.stringify({saved:18,unresolved:0})}],auditLogs:[{id:1001,actor_user_id:operator.id,action:'LEGACY_EXCLUDE_SOURCE_REVIEW',entity_type:'source',entity_id:sourceHash,details:null,created_at:at},{id:1002,actor_user_id:operator.id,action:'LEGACY_EXCLUDE_ARCHIVE',entity_type:'decision',entity_id:requestId,details:null,created_at:at}],operators:[operator]}};
}

export function sessionCreationFixture() {
  const source = lecturerHistoryFixture();
  for (const schedule of source.schedules) { schedule.startTime='00:00'; schedule.endTime='23:59'; }
  return source;
}
