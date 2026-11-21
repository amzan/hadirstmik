import { Router } from 'express';
import { canonical, prepareImport } from './importer.mjs';
import { reconcileLegacy } from './reconciliation.mjs';
import { rows, transaction, audit } from './database.mjs';
import { requireValue, text, digest, asyncRoute } from './security.mjs';
import { splitRombels, sameRombelMembership } from '../shared/academic-relations.mjs';

const actions=['CONTINUE','ARCHIVE','DEFER'];
function stripSecrets(value){
  if(Array.isArray(value))return value.map(stripSecrets);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/password|token|device/i.test(key)).map(([k,v])=>[k,stripSecrets(v)]));
  return value;
}
function enrollment(student,schedules){
  const excluded=new Set(student.excludedScheduleIds||[]),included=new Set(student.customScheduleIds||[]);
  return schedules.filter(s=>!s.isArchived&&!excluded.has(s.id)&&(included.has(s.id)||sameRombelMembership(student.rombels?.length?student.rombels:student.rombel,s.rombel)));
}
export function exclusionImpact(student,schedules,action,target){
  requireValue(actions.includes(action),'DECISION_INVALID');
  const before=enrollment(student,schedules),afterStudent=structuredClone(student);
  if(action==='CONTINUE'){
    requireValue(schedules.some(s=>s.id===target&&!s.isArchived),'REPLACEMENT_REQUIRED');
    requireValue(!(student.customScheduleIds||[]).includes(target),'INCLUDE_EXCLUDE_CONFLICT',409);
    requireValue(before.some(s=>s.id===target)||(student.excludedScheduleIds||[]).includes(target),'TARGET_NOT_ENROLLED',409);
    afterStudent.excludedScheduleIds=[...new Set([...(student.excludedScheduleIds||[]),target])];
  }
  const after=enrollment(afterStudent,schedules),beforeSks=before.reduce((n,s)=>n+s.sks,0),afterSks=after.reduce((n,s)=>n+s.sks,0);
  requireValue(afterSks<=20,'SKS_LIMIT_EXCEEDED',409);
  return {beforeScheduleIds:before.map(s=>s.id),afterScheduleIds:after.map(s=>s.id),beforeSks,afterSks};
}
async function ensureReviewActor(db,id){
  await rows(db,"INSERT IGNORE INTO legacy_review_actors (id,actor_type,user_id) SELECT id,'USER',id FROM users WHERE id=?",[id]);
  const [actor]=await rows(db,'SELECT actor_type,user_id FROM legacy_review_actors WHERE id=?',[id]);
  requireValue(actor?.actor_type==='USER'&&actor.user_id===id,'REVIEW_ACTOR_COLLISION',409);
}
export async function loadReview(db,cipher,sourceHash){
  const [batch]=await rows(db,'SELECT * FROM legacy_exclude_batches WHERE source_hash=?',[sourceHash]);requireValue(batch,'NOT_FOUND',404);
  const source=cipher.decrypt(batch.encrypted_source),items=await rows(db,'SELECT * FROM legacy_exclude_items WHERE source_hash=? ORDER BY id',[sourceHash]);
  return {batch,source,items};
}
function candidate(source,items,sourceHash){const result=reconcileLegacy(source,{excludeDecisions:items});result.data.legacyReviewSource=sourceHash;return result;}
export function legacyExcludes(pool,cipher){
  const router=Router();
  router.post('/sources',asyncRoute(async(req,res)=>{
    const raw=stripSecrets(req.body.backup?.data||req.body.backup),check=reconcileLegacy(raw);
    requireValue(check.report.dryRun.issues.every(i=>['OVERRIDE_INVALID','LEAVE_RECIPIENTS_REQUIRED'].includes(i.code)),'REVIEW_SOURCE_INVALID');
    requireValue(check.report.excludeReview.total>0,'NO_LEGACY_EXCLUDES');
    const sourceHash=digest(canonical(raw));
    const result=await transaction(pool,async db=>{
      await ensureReviewActor(db,req.user.id);
      await rows(db,'INSERT IGNORE INTO legacy_exclude_batches (source_hash,encrypted_source,created_by) VALUES (?,?,?)',[sourceHash,cipher.encrypt(raw),req.user.id]);
      await rows(db,'SELECT source_hash FROM legacy_exclude_batches WHERE source_hash=? FOR UPDATE',[sourceHash]);
      const existing=new Set(raw.schedules.map(s=>s.id));
      for(const student of raw.students)for(const old of new Set(student.excludedScheduleIds||[]))if(!existing.has(old)){
        text(old,100);text(student.nim,50);const id=digest(canonical([sourceHash,student.nim,old]));
        await rows(db,'INSERT IGNORE INTO legacy_exclude_items (id,source_hash,student_nim,old_schedule_id) VALUES (?,?,?,?)',[id,sourceHash,student.nim,old]);
      }
      await audit(db,req.user.id,'LEGACY_EXCLUDE_SOURCE_REVIEW','source',sourceHash);
      return {sourceHash};
    });res.json({data:result});
  }));
  router.get('/sources',asyncRoute(async(_req,res)=>res.json({data:await rows(pool,'SELECT source_hash AS sourceHash,created_at AS createdAt FROM legacy_exclude_batches ORDER BY created_at DESC LIMIT 100')})));
  router.get('/sources/:sourceHash',asyncRoute(async(req,res)=>{
    const {source,items}=await loadReview(pool,cipher,req.params.sourceHash);
    res.json({data:{sourceHash:req.params.sourceHash,items:items.map(item=>({...item,studentName:source.students.find(s=>s.nim===item.student_nim)?.name})),candidates:source.schedules.filter(s=>!s.isArchived).map(s=>({id:s.id,courseCode:s.courseCode,courseName:s.courseName,rombel:s.rombel,sks:s.sks,day:s.day,startTime:s.startTime})),counts:{total:items.length,decided:items.filter(i=>i.action).length,CONTINUE:items.filter(i=>i.action==='CONTINUE').length,ARCHIVE:items.filter(i=>i.action==='ARCHIVE').length,DEFER:items.filter(i=>i.action==='DEFER').length,unresolved:items.filter(i=>!i.action||i.action==='DEFER').length}}});
  }));
  const preview=async(db,cipher,body)=>{
    const {source,items}=await loadReview(db,cipher,text(body.sourceHash,64));
    requireValue(Array.isArray(body.itemIds)&&body.itemIds.length>0&&body.itemIds.length<=2000,'ITEMS_REQUIRED');
    const selected=[...new Set(body.itemIds)].map(id=>{const item=items.find(i=>i.id===id);requireValue(item,'ITEM_SOURCE_MISMATCH',409);return item;});
    requireValue(selected.every(i=>!i.action||i.action==='DEFER'),'DECISION_ALREADY_FINAL',409);
    requireValue(new Set(selected.map(i=>i.old_schedule_id)).size===1,'BULK_OLD_SCHEDULE_MISMATCH',409);
    const action=text(body.action,20),reason=text(body.reason,2000),target=action==='CONTINUE'?text(body.newScheduleId,100):null;
    requireValue(action==='CONTINUE'||!body.newScheduleId,'UNEXPECTED_REPLACEMENT');
    const current=candidate(source,items,body.sourceHash).data;
    const impacts=selected.map(item=>{
      const student=current.students.find(s=>s.nim===item.student_nim);requireValue(student,'STUDENT_NOT_FOUND',409);
      const impact=exclusionImpact(student,current.schedules,action,target);
      return {itemId:item.id,studentNim:item.student_nim,studentName:student.name,version:item.version,...impact};
    });
    const previewHash=digest(canonical({sourceHash:body.sourceHash,action,target,reason,impacts}));
    return {selected,impacts,previewHash,action,target,reason,source,items};
  };
  router.post('/preview',asyncRoute(async(req,res)=>{const p=await preview(pool,cipher,req.body);res.json({data:{impacts:p.impacts,previewHash:p.previewHash}});}));
  router.post('/decisions',asyncRoute(async(req,res)=>{
    const requestId=text(req.body.requestId,100),requestHash=digest(canonical({...req.body,adminId:req.user.id}));
    const result=await transaction(pool,async db=>{
      await rows(db,'SELECT source_hash FROM legacy_exclude_batches WHERE source_hash=? FOR UPDATE',[text(req.body.sourceHash,64)]);
      const [old]=await rows(db,'SELECT * FROM legacy_exclude_decisions WHERE request_id=?',[requestId]);
      if(old){requireValue(old.request_hash===requestHash,'IDEMPOTENCY_CONFLICT',409);return typeof old.result==='string'?JSON.parse(old.result):old.result;}
      await ensureReviewActor(db,req.user.id);
      const p=await preview(db,cipher,req.body);requireValue(p.previewHash===req.body.previewHash,'PREVIEW_CHANGED',409);
      for(const item of p.selected)await rows(db,'UPDATE legacy_exclude_items SET action=?,new_schedule_id=?,decided_by=?,decided_at=UTC_TIMESTAMP(),reason=?,version=version+1 WHERE id=?',[p.action,p.target,req.user.id,p.reason,item.id]);
      const updated=await loadReview(db,cipher,req.body.sourceHash),next=candidate(updated.source,updated.items,req.body.sourceHash);
      const candidatePreview=prepareImport(next.data);
      const unresolved=updated.items.filter(i=>!i.action||i.action==='DEFER').length;
      await rows(db,'UPDATE legacy_exclude_batches SET candidate_hash=? WHERE source_hash=?',[unresolved?null:candidatePreview.sourceHash,req.body.sourceHash]);
      const result={saved:p.selected.length,action:p.action,unresolved,sourceHash:req.body.sourceHash,candidateValid:!unresolved&&candidatePreview.valid};
      await rows(db,'INSERT INTO legacy_exclude_decisions (request_id,source_hash,request_hash,action,new_schedule_id,student_items,admin_id,reason,result) VALUES (?,?,?,?,?,?,?,?,?)',[requestId,req.body.sourceHash,requestHash,p.action,p.target,JSON.stringify(p.selected.map(i=>i.id)),req.user.id,p.reason,JSON.stringify(result)]);
      await audit(db,req.user.id,'LEGACY_EXCLUDE_'+p.action,'decision',requestId);return result;
    });res.json({data:result});
  }));
  router.get('/sources/:sourceHash/candidate',asyncRoute(async(req,res)=>{
    const {source,items}=await loadReview(pool,cipher,req.params.sourceHash);const result=candidate(source,items,req.params.sourceHash);
    requireValue(!items.some(i=>!i.action||i.action==='DEFER'),'EXCLUDE_REVIEW_UNRESOLVED',409);
    res.json({data:{backup:result.data,report:result.report,decisions:items.map(i=>({studentNim:i.student_nim,oldScheduleId:i.old_schedule_id,action:i.action,newScheduleId:i.new_schedule_id,adminId:i.decided_by,decidedAt:i.decided_at,reason:i.reason}))}});
  }));
  return router;
}
