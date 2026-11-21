import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { reconcileLegacy } from '../backend/reconciliation.mjs';
import { getStudentEnrolledSchedules, getStudentTotalSks, MAX_STANDARD_SKS } from '../src/data/initialData.ts';

export function compareWorkbook(source, bytes) {
  const workbook=XLSX.read(bytes,{type:'buffer'}), data=source.data||source;
  const mappings=[
    ['users','Pengguna','id','ID',{username:'Username',name:'Nama',email:'Email',role:'Peran'}],
    ['students','Mahasiswa','nim','NIM',{name:'Nama',email:'Email',prodi:'Prodi',rombel:'Rombel'}],
    ['courses','Mata Kuliah','code','Kode',{name:'Nama_Mata_Kuliah',sks:'SKS',semester:'Semester',prodi:'Prodi'}],
    ['schedules','Jadwal','id','ID_Jadwal',{courseCode:'Kode_MK',rombel:'Rombel',sks:'SKS',day:'Hari'}],
    ['sessions','Sesi Presensi','id','ID_Sesi',{courseCode:'Kode_MK',rombel:'Rombel',meetingNumber:'Pertemuan_Ke'}],
    ['records','Rekap Kehadiran','id','ID_Record',{studentNim:'NIM',courseCode:'Kode_MK',status:'Status_Kehadiran',rombel:'Rombel'}],
  ];
  return mappings.map(([entity,sheet,key,column,fields])=>{
    const rows=workbook.Sheets[sheet]?XLSX.utils.sheet_to_json(workbook.Sheets[sheet]):[],index=new Map(rows.map(r=>[String(r[column]),r]));
    let matched=0,fieldMismatches=0;
    for(const item of data[entity]){const row=index.get(String(item[key]));if(!row)continue;matched++;for(const [field,col] of Object.entries(fields)){const normalize=v=>field==='role'?String(v??'').trim().toLowerCase():String(v??'').trim();if(normalize(item[field])!==normalize(row[col]))fieldMismatches++;}}
    return {entity,jsonCount:data[entity].length,excelCount:rows.length,matchedIdentities:matched,duplicateIdentities:rows.length-index.size,fieldMismatches};
  }).concat([{
    entity:'leaveRequests',jsonCount:data.leaveRequests.length,excelCount:workbook.Sheets['Izin Sakit']?XLSX.utils.sheet_to_json(workbook.Sheets['Izin Sakit']).length:0,
    matchedCompositeRows:data.leaveRequests.filter(item=>XLSX.utils.sheet_to_json(workbook.Sheets['Izin Sakit']||{}).some(r=>String(r.NIM)===item.studentNim&&r.Kode_MK===item.courseCode&&r.Jenis===item.type&&r.Status===item.status&&r.Alasan===item.reason)).length,
    sessionIdentityAvailable:false,
  }]);
}

async function main(){
  const [jsonPath,excelPath,observed='']=process.argv.slice(2);
  if(!jsonPath||!excelPath)throw Error('USAGE: node scripts/reconcile-legacy.mjs PRIVATE_JSON PRIVATE_XLSX [SEMICOLON_SEPARATED_OBSERVED_ROMBELS]');
  const paths=[resolve(jsonPath),resolve(excelPath)],bytes=await Promise.all(paths.map(p=>readFile(p)));
  const source=JSON.parse(bytes[0]),data=source.data||source;
  const result=reconcileLegacy(source,{observedRombels:observed.split(';').filter(Boolean)});
  const digest=value=>createHash('sha256').update(value).digest('hex');
  const sks=data.students.reduce((out,s)=>{const total=getStudentTotalSks(s,data.schedules);out[total]=(out[total]||0)+1;return out;},{});
  const {conflicts,dryRun,...report}=result.report;
  const workbook=compareWorkbook(source,bytes[1]);
  const workbookConflicts=workbook.filter(row=>row.jsonCount!==row.excelCount||row.fieldMismatches||row.duplicateIdentities||(row.matchedIdentities??row.matchedCompositeRows)!==row.jsonCount).length;
  const summary={...report,conflictTotal:conflicts.length,dryRun:{valid:dryRun.valid,counts:dryRun.counts,issueCounts:dryRun.issues.reduce((out,i)=>(out[i.code]=(out[i.code]||0)+1,out),{})},workbook,academic:{maxStandardSks:MAX_STANDARD_SKS,sksDistribution:sks,aboveLimit:data.students.filter(s=>getStudentTotalSks(s,data.schedules)>MAX_STANDARD_SKS).length,enrollmentDigest:digest(JSON.stringify(data.students.map(s=>getStudentEnrolledSchedules(s,data.schedules).map(x=>x.id).sort())))},history:{leaveLegacyFieldsUnchanged:data.leaveRequests.every((leave,index)=>Object.entries(leave).every(([key,value])=>JSON.stringify(value)===JSON.stringify(result.data.leaveRequests[index][key]))),duplicateIds:data.records.length-new Set(data.records.map(r=>r.id)).size,duplicateSessionStudent:data.records.length-new Set(data.records.map(r=>`${r.sessionId}:${r.studentNim}`)).size,recordsUnchanged:JSON.stringify(data.records)===JSON.stringify(result.data.records),sessionLegacyFieldsUnchanged:data.sessions.every((session,index)=>Object.entries(session).every(([key,value])=>JSON.stringify(value)===JSON.stringify(result.data.sessions[index][key])))},sourcesUnchanged:(await Promise.all(paths.map(p=>readFile(p)))).every((b,i)=>digest(b)===digest(bytes[i]))};
  // Only structural evidence leaves memory; source rows and candidate payloads are never logged or written.
  summary.workbookConflicts=workbookConflicts;
  if(workbookConflicts)summary.status='PARTIAL';
  console.log(JSON.stringify(summary,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message?.startsWith('USAGE:')?error.message:'RECONCILIATION_FAILED');process.exitCode=1;});
