import { createHash } from 'node:crypto';
import { snapshotCipher } from './admin.mjs';
import { canonical, prepareImport } from './importer.mjs';
import { reconcileLegacy } from './reconciliation.mjs';
import { rows, transaction } from './database.mjs';
import { requireValue } from './security.mjs';
const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const json=value=>typeof value==='string'?JSON.parse(value):value;
const instant=value=>value==null?null:new Date(value);
export function prepareReviewTransfer(packet,oldSecret){
  const {batch,items,decisions,auditLogs,operators}=packet;
  requireValue(batch&&[items,decisions,auditLogs,operators].every(Array.isArray),'TRANSFER_INVALID');
  const source=snapshotCipher(oldSecret).decrypt(batch.encrypted_source);
  requireValue(hash(source)===batch.source_hash,'TRANSFER_SOURCE_HASH_INVALID');
  const actorIds=new Set([batch.created_by,...items.map(i=>i.decided_by),...decisions.map(d=>d.admin_id),...auditLogs.map(a=>a.actor_user_id)].filter(Boolean));
  requireValue(operators.length===actorIds.size&&new Set(operators.map(o=>o.id)).size===operators.length&&operators.every(o=>actorIds.has(o.id)),'TRANSFER_ACTORS_INVALID');
  requireValue(items.length>0&&new Set(items.map(i=>i.id)).size===items.length,'TRANSFER_ITEMS_INVALID');
  for(const item of items){
    requireValue(item.source_hash===batch.source_hash&&hash([batch.source_hash,item.student_nim,item.old_schedule_id])===item.id,'TRANSFER_ITEM_HASH_INVALID');
    requireValue(['ARCHIVE','CONTINUE'].includes(item.action)&&item.decided_by&&item.decided_at&&item.reason,'TRANSFER_DECISION_INCOMPLETE');
  }
  // shortcut: transfer accepts final-only decision packets; add replay validation before transferring superseded decisions.
  const coverage=new Set();
  for(const decision of decisions){
    requireValue(decision.source_hash===batch.source_hash&&/^[a-f0-9]{64}$/.test(decision.request_hash),'TRANSFER_DECISION_INVALID');
    const ids=json(decision.student_items);requireValue(Array.isArray(ids)&&ids.length>0,'TRANSFER_DECISION_INVALID');
    for(const id of ids){const item=items.find(i=>i.id===id);requireValue(item&&item.action===decision.action&&item.decided_by===decision.admin_id&&item.reason===decision.reason&&!coverage.has(id),'TRANSFER_DECISION_MISMATCH');coverage.add(id);}
  }
  requireValue(coverage.size===items.length,'TRANSFER_DECISION_COVERAGE_INVALID');
  requireValue(new Set(auditLogs.map(a=>a.id)).size===auditLogs.length&&auditLogs.every(a=>Number.isSafeInteger(Number(a.id))&&Number(a.id)>0&&a.action.startsWith('LEGACY_EXCLUDE_')&&(a.entity_id===batch.source_hash||decisions.some(d=>d.request_id===a.entity_id))),'TRANSFER_AUDIT_INVALID');
  const result=reconcileLegacy(source,{excludeDecisions:items});result.data.legacyReviewSource=batch.source_hash;
  const preview=prepareImport(result.data);requireValue(preview.valid&&preview.sourceHash===batch.candidate_hash,'TRANSFER_CANDIDATE_INVALID');
  return {preview,report:result.report,transferHash:hash(packet),source};
}
export async function applyReviewTransfer(pool,packet,{oldSecret,newSecret}){
  const prepared=prepareReviewTransfer(packet,oldSecret),{batch,items,decisions,auditLogs,operators}=packet;
  const result=await transaction(pool,async db=>{
    const [old]=await rows(db,'SELECT transfer_hash FROM legacy_review_transfer_provenance WHERE source_hash=? FOR UPDATE',[batch.source_hash]);
    if(old){requireValue(old.transfer_hash===prepared.transferHash,'TRANSFER_ALREADY_DIFFERS',409);return {alreadyApplied:true};}
    requireValue(!(await rows(db,'SELECT source_hash FROM legacy_exclude_batches WHERE source_hash=?',[batch.source_hash])).length,'TRANSFER_SOURCE_ALREADY_EXISTS',409);
    for(const operator of operators){
      requireValue(!(await rows(db,'SELECT id FROM users WHERE id=?',[operator.id])).length,'TRANSFER_OPERATOR_USER_COLLISION',409);
      const [existing]=await rows(db,'SELECT actor_type,provenance FROM legacy_review_actors WHERE id=? FOR UPDATE',[operator.id]);
      const provenance={sourceHash:batch.source_hash,originalOperator:operator};
      requireValue(!existing||(existing.actor_type==='HISTORICAL_OPERATOR'&&canonical(json(existing.provenance))===canonical(provenance)),'TRANSFER_OPERATOR_COLLISION',409);
      if(!existing)await rows(db,"INSERT INTO legacy_review_actors (id,actor_type,user_id,provenance) VALUES (?,'HISTORICAL_OPERATOR',NULL,?)",[operator.id,JSON.stringify(provenance)]);
    }
    await rows(db,'INSERT INTO legacy_exclude_batches (source_hash,encrypted_source,candidate_hash,created_by,created_at) VALUES (?,?,?,?,?)',[batch.source_hash,snapshotCipher(newSecret).encrypt(prepared.source),batch.candidate_hash,batch.created_by,instant(batch.created_at)]);
    for(const i of items)await rows(db,'INSERT INTO legacy_exclude_items (id,source_hash,student_nim,old_schedule_id,action,new_schedule_id,decided_by,decided_at,reason,version) VALUES (?,?,?,?,?,?,?,?,?,?)',[i.id,i.source_hash,i.student_nim,i.old_schedule_id,i.action,i.new_schedule_id,i.decided_by,instant(i.decided_at),i.reason,i.version]);
    for(const d of decisions)await rows(db,'INSERT INTO legacy_exclude_decisions (request_id,source_hash,request_hash,action,new_schedule_id,student_items,admin_id,reason,decided_at,result) VALUES (?,?,?,?,?,?,?,?,?,?)',[d.request_id,d.source_hash,d.request_hash,d.action,d.new_schedule_id,JSON.stringify(json(d.student_items)),d.admin_id,d.reason,instant(d.decided_at),JSON.stringify(json(d.result))]);
    for(const a of auditLogs)await rows(db,'INSERT INTO audit_logs (id,actor_user_id,historical_actor_id,action,entity_type,entity_id,details,created_at) VALUES (?,NULL,?,?,?,?,?,?)',[a.id,a.actor_user_id,a.action,a.entity_type,a.entity_id,a.details==null?null:JSON.stringify(json(a.details)),instant(a.created_at)]);
    await rows(db,'INSERT INTO legacy_review_transfer_provenance (source_hash,transfer_hash,original_ciphertext,original_operators,original_audit,original_key_hash) VALUES (?,?,?,?,?,?)',[batch.source_hash,prepared.transferHash,batch.encrypted_source,JSON.stringify(operators),JSON.stringify(auditLogs),hash(oldSecret)]);
    return {alreadyApplied:false};
  });
  return {...result,preview:prepared.preview,report:prepared.report};
}
