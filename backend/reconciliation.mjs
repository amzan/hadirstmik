import { LEGACY_ARCHIVE, LEGACY_LEAVE_POLICY, legacyLeaveDigest } from './legacy-leave.mjs';
import { canonicalRombel, splitRombels, ROMBEL_RULE_VERSION } from '../shared/academic-relations.mjs';
import { canonical, prepareImport, importReport } from './importer.mjs';
import { requireValue } from './security.mjs';

export function reconcileLegacy(backup, { observedRombels = [], excludeDecisions = [] } = {}) {
  requireValue(backup && typeof backup === 'object' && !Array.isArray(backup),'BACKUP_INVALID');
  const source=backup.data||backup, data=structuredClone(source), issues=[], legacyLabels=[];
  for(const name of ['users','students','courses','schedules','sessions','records','leaveRequests'])requireValue(Array.isArray(data[name]),'BACKUP_INVALID');
  const add=(entity,index,code)=>issues.push({entity,index,code});
  const labels=new Set(observedRombels.flatMap(splitRombels));
  const sourceCatalog=data.rombels||[], catalog=new Map(), collisions=[];
  for(const [index,row] of sourceCatalog.entries()){
    const code=canonicalRombel(row.code);
    if(catalog.has(code)){add('rombels',index,'CANONICAL_ROMBEL_COLLISION');collisions.push(structuredClone(row));}
    else catalog.set(code,{...row,code,scheduleIds:[...new Set(row.scheduleIds||[])]});
  }
  for(const [entity,items] of [['students',data.students],['schedules',data.schedules]])for(const [index,item] of items.entries()){
    legacyLabels.push({entity,index,rombel:item.rombel,rombels:item.rombels});
    const codes=splitRombels(entity==='students'&&item.rombels?.length?item.rombels:item.rombel);
    codes.forEach(code=>labels.add(code));
    if(entity==='students'){
      if(item.rombels?.length && canonical([...splitRombels(item.rombel)].sort())!==canonical([...codes].sort()))add(entity,index,'MEMBERSHIP_FIELDS_CONFLICT');
      item.rombels=codes;item.rombel=codes.join(', ');
    }
  }
  for(const code of [...labels].sort()){
    const match=code.match(/^(TI|MI) (\d+)[A-Z]*$/);
    if(!match){if(code!=='5')add('rombels',null,'ROMBEL_IDENTITY_UNPROVEN');continue;}
    if(!catalog.has(code))catalog.set(code,{id:`reconciled-${code.toLowerCase().replace(/ /g,'-')}`,code,name:code,prodi:match[1]==='TI'?'Teknologi Informasi':'Manajemen Informatika',semester:Number(match[2]),scheduleIds:[]});
  }
  data.rombels=[...catalog.values(),...collisions];
  const scheduleIds=new Set(data.schedules.map(s=>s.id));
  const enrollment=[];
  for(const [index,student] of data.students.entries()){
    const accounts=data.users.filter(u=>u.role==='mahasiswa'&&u.username===student.nim);
    if(accounts.length===1)student.userId=accounts[0].id;else add('students',index,'ACCOUNT_MAPPING_REQUIRED');
    for(const code of student.rombels)if(catalog.has(code))enrollment.push({studentIndex:index,rombelId:catalog.get(code).id});else add('students',index,'ROMBEL_IDENTITY_UNPROVEN');
    for(const field of ['customScheduleIds','excludedScheduleIds'])for(const id of [...(student[field]||[])])if(!scheduleIds.has(id)) {
      const decision=field==='excludedScheduleIds'?excludeDecisions.find(d=>d.student_nim===student.nim&&d.old_schedule_id===id):null;
      if(decision && ['CONTINUE','ARCHIVE'].includes(decision.action) && decision.decided_by && decision.decided_at && decision.reason){
        if(decision.action==='CONTINUE' && !data.schedules.some(s=>s.id===decision.new_schedule_id&&!s.isArchived)){add('students',index,'OVERRIDE_TARGET_UNPROVEN');continue;}
        student.excludedScheduleIds=student.excludedScheduleIds.filter(value=>value!==id);
        if(decision.action==='CONTINUE')student.excludedScheduleIds=[...new Set([...student.excludedScheduleIds,decision.new_schedule_id])];
      }else add('students',index,'OVERRIDE_TARGET_UNPROVEN');
    }
  }
  let scheduleLinks=0;
  data.schedules.forEach((schedule,index)=>{
    const labelCodes=splitRombels(schedule.rombel);
    for(const rombel of catalog.values())if(rombel.scheduleIds.includes(schedule.id)&&!labelCodes.includes(rombel.code))add('schedules',index,'SCHEDULE_MEMBERSHIP_CONFLICT');
    for(const code of labelCodes){
      const rombel=catalog.get(code);
      if(!rombel){add('schedules',index,'ROMBEL_IDENTITY_UNPROVEN');continue;}
      if(!rombel.scheduleIds.includes(schedule.id)){rombel.scheduleIds.push(schedule.id);scheduleLinks++;}
    }
  });
  let evidencedParticipants=0,completeRosters=0;
  const rosters=data.sessions.map((session,index)=>{
    const participants=[...new Set(data.records.filter(r=>r.sessionId===session.id).map(r=>r.studentNim))];
    evidencedParticipants+=participants.length;
    if(!Array.isArray(session.studentNims)&&(!participants.length||session.isOpen)){
      add('sessions',index,'HISTORICAL_ROSTER_INCOMPLETE');
      return {sessionIndex:index,evidencedStudentNims:participants,complete:false};
    }
    if(!Array.isArray(session.studentNims))session.studentNims=participants;
    else if(participants.some(nim=>!session.studentNims.includes(nim)))add('sessions',index,'RECORD_OUTSIDE_HISTORICAL_ROSTER');
    if(!participants.some(nim=>!session.studentNims.includes(nim)))completeRosters++;
    return {sessionIndex:index,evidencedStudentNims:participants,complete:Array.isArray(session.studentNims)};
  });
  const leaveLinks=0;
  data.leaveRequests.forEach((leave,index)=>{
    if(!leave.archiveMarker && !leave.legacyArchivePolicy && !leave.legacySourceHash && (leave.recipientIds == null || (Array.isArray(leave.recipientIds) && !leave.recipientIds.length))){
      if(leave.sessionId || leave.scheduleId){add('leaveRequests',index,'LEGACY_LEAVE_LINK_REQUIRES_REVIEW');return;}
      leave.recipientIds=[];leave.archiveMarker=LEGACY_ARCHIVE;leave.legacyArchivePolicy=LEGACY_LEAVE_POLICY;leave.legacySourceHash=legacyLeaveDigest(leave);
    }
  });
  const dryRun=importReport(prepareImport(data));
  const counts={users:data.users.length,students:data.students.length,courses:data.courses.length,schedules:data.schedules.length,sessions:data.sessions.length,records:data.records.length,leaveRequests:data.leaveRequests.length,canonicalRombels:catalog.size,accountLinks:data.students.filter(s=>s.userId).length,enrollmentLinks:enrollment.length,scheduleLinks,evidencedParticipants,completeRosters,leaveLinks,archivedLeaves:data.leaveRequests.filter(l=>l.archiveMarker===LEGACY_ARCHIVE).length};
  const conflictCounts=issues.reduce((out,i)=>(out[i.code]=(out[i.code]||0)+1,out),{});
  const legacyRefs=source.students.flatMap(student=>[...new Set(student.excludedScheduleIds||[])].filter(id=>!scheduleIds.has(id)).map(old=>({nim:student.nim,old})));
  const decisions=legacyRefs.map(ref=>excludeDecisions.find(d=>d.student_nim===ref.nim&&d.old_schedule_id===ref.old&&d.decided_by&&d.decided_at&&d.reason));
  const excludeReview={total:legacyRefs.length,decided:decisions.filter(Boolean).length,CONTINUE:decisions.filter(d=>d?.action==='CONTINUE').length,ARCHIVE:decisions.filter(d=>d?.action==='ARCHIVE').length,DEFER:decisions.filter(d=>d?.action==='DEFER').length,unresolved:decisions.filter(d=>!d||!['CONTINUE','ARCHIVE'].includes(d.action)).length};
  return {data,evidence:{ruleVersion:ROMBEL_RULE_VERSION,historicalRosterPolicy:"owner-accepted-source-records",legacyLabels,enrollment,rosters},report:{status:issues.length||!dryRun.valid?'PARTIAL':'READY',counts,excludeReview,conflictCounts,conflicts:issues,dryRun}};
}
