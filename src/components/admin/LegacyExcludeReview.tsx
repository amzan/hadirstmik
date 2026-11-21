import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api';

export function LegacyExcludeReview(){
  const [sources,setSources]=useState<any[]>([]),[sourceHash,setSourceHash]=useState(''),[review,setReview]=useState<any>(null);
  const [selected,setSelected]=useState<string[]>([]),[action,setAction]=useState(''),[target,setTarget]=useState(''),[reason,setReason]=useState('');
  const [preview,setPreview]=useState<any>(null),[requestId,setRequestId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=async()=>setSources(await api<any[]>('/admin/legacy-excludes/sources'));
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  useEffect(()=>{let active=true;setPreview(null);setSelected([]);setReview(null);if(sourceHash)api('/admin/legacy-excludes/sources/'+sourceHash).then(value=>{if(active)setReview(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[sourceHash]);
  useEffect(()=>setPreview(null),[selected,action,target,reason]);
  const body=()=>({sourceHash,itemIds:selected,action,newScheduleId:action==='CONTINUE'?target:undefined,reason});
  const run=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Permintaan gagal.');}finally{setBusy(false);}};
  const oldIds=[...new Set<string>((review?.items||[]).map((i:any)=>i.old_schedule_id))];
  return <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
    <h3 className="font-bold text-slate-900">Review EXCLUDE Legacy</h3>
    <p className="text-sm text-slate-600">Keputusan hanya berlaku pada kandidat migrasi sumber yang dipilih. Referensi asli dan histori presensi tetap disimpan. Tidak ada penerusan otomatis.</p>
    {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
    <label className="block text-sm">Tambahkan sumber JSON untuk review privat
      <input disabled={busy} type="file" accept=".json" className="block mt-2" onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>{const result=await api<any>('/admin/legacy-excludes/sources','POST',{backup:JSON.parse(await file.text())});await load();setSourceHash(result.sourceHash);setNotice('Sumber review tersimpan privat. Data akademik belum diimpor.');});}}/>
    </label>
    <select disabled={busy} aria-label="Sumber review" value={sourceHash} onChange={e=>setSourceHash(e.target.value)} className="border rounded-lg p-2 max-w-full"><option value="">Pilih sumber review</option>{sources.map(s=><option key={s.sourceHash} value={s.sourceHash}>{s.sourceHash.slice(0,12)} - {String(s.createdAt)}</option>)}</select>
    {review&&<>
      <p className="text-sm">Total {review.counts.total}; CONTINUE {review.counts.CONTINUE}; ARCHIVE {review.counts.ARCHIVE}; DEFER {review.counts.DEFER}; belum selesai {review.counts.unresolved}.</p>
      <div className="flex flex-wrap gap-2">{oldIds.map(old=><button disabled={busy} type="button" key={old} className="border rounded-lg p-2 text-sm" onClick={()=>setSelected(review.items.filter((i:any)=>i.old_schedule_id===old&&(!i.action||i.action==='DEFER')).map((i:any)=>i.id))}>Pilih semua: {old}</button>)}</div>
      <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th>Pilih</th><th>Mahasiswa</th><th>Jadwal lama</th><th>Keputusan tersimpan</th></tr></thead><tbody>{review.items.map((i:any)=><tr className="border-t" key={i.id}><td><input disabled={busy||i.action==='CONTINUE'||i.action==='ARCHIVE'} type="checkbox" aria-label={'Pilih '+i.student_nim} checked={selected.includes(i.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,i.id]:ids.filter(id=>id!==i.id))}/></td><td className="p-2">{i.studentName}<br/>{i.student_nim}</td><td>{i.old_schedule_id}</td><td>{i.action||'Belum diputuskan'}{i.new_schedule_id&&<span> - {i.new_schedule_id}</span>}<br/>{i.reason||''}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-slate-600">Hilangkan centang mahasiswa yang perlu ditangani terpisah. Batch harus mempunyai satu ID jadwal lama yang sama.</p>
      <select disabled={busy} aria-label="Tindakan EXCLUDE" value={action} onChange={e=>{setAction(e.target.value);setTarget('');}} className="border rounded-lg p-2"><option value="">Pilih keputusan</option><option>CONTINUE</option><option>ARCHIVE</option><option>DEFER</option></select>
      {action==='CONTINUE'&&<select disabled={busy} aria-label="Jadwal pengganti" value={target} onChange={e=>setTarget(e.target.value)} className="block border rounded-lg p-2 max-w-full"><option value="">Pilih jadwal pengganti secara eksplisit</option>{review.candidates.map((s:any)=><option value={s.id} key={s.id}>{s.courseCode} - {s.courseName} - {s.rombel} - {s.day} {s.startTime} - {s.sks} SKS ({s.id})</option>)}</select>}
      <textarea disabled={busy} aria-label="Alasan keputusan" value={reason} onChange={e=>setReason(e.target.value)} className="block w-full border rounded-lg p-2" placeholder="Alasan keputusan admin"/>
      <button disabled={busy||!selected.length||!action||!reason.trim()} type="button" className="border rounded-lg px-3 py-2 text-sm" onClick={()=>void run(async()=>{const p=await api('/admin/legacy-excludes/preview','POST',body());setPreview(p);setRequestId(crypto.randomUUID());})}>Preview dampak {selected.length} mahasiswa</button>
      {preview&&<><div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th>Mahasiswa</th><th>Enrollment sebelum</th><th>Enrollment sesudah</th><th>SKS</th></tr></thead><tbody>{preview.impacts.map((i:any)=><tr className="border-t" key={i.itemId}><td>{i.studentName}<br/>{i.studentNim}</td><td className="p-2">{i.beforeScheduleIds.join(', ')}</td><td>{i.afterScheduleIds.join(', ')}</td><td>{i.beforeSks} menjadi {i.afterSks}</td></tr>)}</tbody></table></div><button disabled={busy} type="button" className="bg-slate-900 text-white rounded-lg px-3 py-2" onClick={()=>void run(async()=>{const result=await api<any>('/admin/legacy-excludes/decisions','POST',{...body(),previewHash:preview.previewHash,requestId});setReview(await api('/admin/legacy-excludes/sources/'+sourceHash));setPreview(null);setSelected([]);setNotice(`Tersimpan ${result.saved} keputusan. Belum selesai: ${result.unresolved}.`);})}>Simpan keputusan yang telah dipreview</button></>}
      <button disabled={busy||review.counts.unresolved>0} type="button" className="block border rounded-lg px-3 py-2 text-sm" onClick={()=>void run(async()=>{const result=await api<any>('/admin/legacy-excludes/sources/'+sourceHash+'/candidate');const url=URL.createObjectURL(new Blob([JSON.stringify({data:result.backup,legacyExcludeReview:{report:result.report,decisions:result.decisions}},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='kandidat-migrasi-review-admin.json';link.click();URL.revokeObjectURL(url);})}>Unduh kandidat dan bukti keputusan</button>
    </>}
  </section>;
}
