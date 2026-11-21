import React, { useEffect, useRef, useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, Student } from '../../types/attendance';
import { api } from '../../utils/api';
import { attendanceStatusLabel, getSessionAttendanceRows } from '../../utils/sessionAttendance';
import { CloseSessionDialog } from './CloseSessionDialog';
import { X, Search, Save, CheckCheck, Lock } from 'lucide-react';

type History = { session: AttendanceSession; students: Student[]; records: AttendanceRecord[] };
type Draft = { status: AttendanceStatus | null; notes: string };
interface ManualAttendanceModalProps { isOpen: boolean; onClose: () => void; defaultSessionId?: string | null; onSaved?: () => void }
const statuses = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] as const;
const colors = { HADIR: 'bg-emerald-600 text-white', IZIN: 'bg-blue-600 text-white', SAKIT: 'bg-amber-600 text-white', ALPHA: 'bg-rose-600 text-white' };
const classKey = (session: AttendanceSession) => JSON.stringify([session.scheduleId || session.id, session.lecturerId, session.academicPeriod]);

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({ isOpen, onClose, defaultSessionId, onSaved }) => {
  const { currentUser, sessions, refresh, closeSession } = useAttendance();
  const mySessions = sessions.filter(session => !session.archivedAt && !session.isArchived && (currentUser.role === 'admin' || session.lecturerId === currentUser.id));
  const [selectedSessionId, setSelectedSessionId] = useState(defaultSessionId || '');
  const [data, setData] = useState<History | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [dirtyCount, setDirtyCount] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const base = useRef<History | null>(null);
  const draftRef = useRef<Record<string, Draft>>({});
  const dirty = useRef(new Set<string>());
  const pending = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const cancelTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const populate = (value: History) => {
    base.current = value; setData(value);
    draftRef.current = Object.fromEntries(getSessionAttendanceRows(value.session, value.students, value.records).map(row => [row.nim, { status: row.status, notes: row.record?.notes || '' }]));
    dirty.current.clear(); setDrafts(draftRef.current); setDirtyCount(0);
  };
  useEffect(() => { if (isOpen) setSelectedSessionId(defaultSessionId || mySessions[0]?.id || ''); }, [isOpen, defaultSessionId]);
  useEffect(() => {
    const epoch = ++generation.current;
    cancelTimer(); base.current = null; setData(null); setError(''); setNotice(''); dirty.current.clear(); setDirtyCount(0); setSearch('');
    if (isOpen && selectedSessionId) api<History>(`/attendance-sessions/${encodeURIComponent(selectedSessionId)}/history`).then(value => { if (generation.current === epoch) populate(value); })
      .catch(error => { if (generation.current === epoch) setError(error instanceof Error ? error.message : 'Presensi gagal dimuat.'); });
    return () => { generation.current++; cancelTimer(); };
  }, [isOpen, selectedSessionId, currentUser.id]);

  const save = (): Promise<boolean> => {
    cancelTimer();
    if (pending.current) return pending.current;
    const epoch = generation.current;
    const operation = async () => {
      setSaving(true); setError('');
      let committed = false;
      try {
        while (dirty.current.size && generation.current === epoch) {
          const current = base.current;
          if (!current || current.session.archivedAt || current.session.isArchived) return false;
          const captured = Object.fromEntries([...dirty.current].map(nim => [nim, { ...draftRef.current[nim] }]));
          const updates = Object.entries(captured).filter(([, draft]) => draft.status).map(([nim, draft]) => ({ studentNim: nim, status: draft.status,
            reason: draft.notes.trim() || 'Presensi manual diinput', version: current.records.find(record => record.studentNim === nim)?.version || 0 }));
          if (!updates.length) { setError('Pilih status sebelum menyimpan keterangan.'); return false; }
          await api(`/attendance-sessions/${encodeURIComponent(current.session.id)}/records/batch`, 'POST', { version: current.session.version, updates });
          const fresh = await api<History>(`/attendance-sessions/${encodeURIComponent(current.session.id)}/history`);
          if (generation.current !== epoch) return false;
          base.current = fresh; setData(fresh); committed = true;
          for (const update of updates) {
            const nim = update.studentNim;
            if (JSON.stringify(draftRef.current[nim]) === JSON.stringify(captured[nim])) dirty.current.delete(nim);
          }
          setDirtyCount(dirty.current.size);
          await refresh(); window.dispatchEvent(new Event('hadir-attendance-updated')); onSaved?.();
        }
        if (committed && generation.current === epoch) setNotice('Perubahan otomatis tersinkronisasi.');
        return generation.current === epoch;
      } catch (error) {
        if (generation.current === epoch) {
          setError(error instanceof Error ? error.message : 'Perubahan gagal disimpan. Coba lagi.');
          // A failed response may follow a committed write; reload versions without discarding the draft.
          try { const fresh = await api<History>(`/attendance-sessions/${encodeURIComponent(selectedSessionId)}/history`); if (generation.current === epoch) { base.current = fresh; setData(fresh); } } catch { /* Preserve the draft for an explicit retry. */ }
        }
        return false;
      } finally { if (generation.current === epoch) setSaving(false); }
    };
    pending.current = operation().finally(() => { pending.current = null; });
    return pending.current;
  };
  const editMany = (changes: Record<string, Partial<Draft>>, delay = 150) => {
    if (!base.current || base.current.session.archivedAt || base.current.session.isArchived) return;
    const next = { ...draftRef.current };
    for (const [nim, value] of Object.entries(changes)) { next[nim] = { ...next[nim], ...value }; dirty.current.add(nim); }
    draftRef.current = next; setDrafts(next); setDirtyCount(dirty.current.size); setNotice(''); setError('');
    cancelTimer(); timer.current = setTimeout(() => { void save(); }, delay);
  };
  const requestClose = () => {
    if (saving || pending.current) return;
    if (dirty.current.size && !window.confirm('Perubahan belum tersimpan. Tutup dan tinggalkan perubahan tersebut?')) return;
    cancelTimer(); onClose();
  };
  const changeSession = (id: string) => {
    if (saving || pending.current || (dirty.current.size && !window.confirm('Perubahan belum tersimpan. Pindah sesi dan tinggalkan perubahan tersebut?'))) return;
    cancelTimer(); setSelectedSessionId(id);
  };
  if (!isOpen) return null;
  const activeSession = data?.session;
  const selected = activeSession || mySessions.find(session => session.id === selectedSessionId);
  const choices = selected && !mySessions.some(session => session.id === selected.id) ? [selected, ...mySessions] : mySessions;
  const classes = [...new Map(choices.map(session => [classKey(session), session])).values()];
  const rows = data ? getSessionAttendanceRows(data.session, data.students, data.records) : [];
  const blocked = !data || Boolean(activeSession?.archivedAt || activeSession?.isArchived);
  const bulk = (alphaOnly: boolean) => {
    if (saving || pending.current || dirty.current.size || blocked) return;
    const targets = rows.filter(row => !alphaOnly || draftRef.current[row.nim]?.status === 'ALPHA');
    if (!targets.length || !window.confirm(`${alphaOnly ? 'Hadirkan sisa Alpa' : 'Tandai semua peserta Hadir'} untuk ${targets.length} mahasiswa?`)) return;
    editMany(Object.fromEntries(targets.map(row => [row.nim, { status: 'HADIR' as const }])));
  };
  return <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
    <section role="dialog" aria-modal="true" aria-label="Kelola Presensi Manual" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-y-auto">
      <header className="px-4 py-3 border-b flex justify-between gap-3 shrink-0"><div><h2 className="text-lg font-bold">Lembar Presensi Manual (Roll-Call)</h2><p className="text-sm text-slate-500 mt-1">Ubah atau tetapkan status kehadiran mahasiswa per sesi perkuliahan</p></div><button type="button" aria-label="Tutup presensi manual" onClick={requestClose} disabled={saving} className="frost-btn frost-btn-icon-only"><X className="w-5 h-5" /></button></header>
      <div className="p-3 border-b bg-slate-50 grid gap-3 sm:grid-cols-[260px_1fr] items-center">
        <div className="space-y-2"><label className="flex items-center gap-2 text-sm">Kelas:<select aria-label="Kelas presensi manual" className="frost-select max-w-[260px]" disabled={saving} value={selected ? classKey(selected) : ''} onChange={event => { const match = choices.find(session => classKey(session) === event.target.value); if (match) changeSession(match.id); }}>{classes.map(session => <option key={classKey(session)} value={classKey(session)}>[{session.courseCode}] {session.courseName} - {session.rombel}</option>)}</select></label>
          <label className="flex items-center gap-2 text-sm">Pertemuan:<select aria-label="Sesi presensi manual" className="frost-select" disabled={saving} value={selectedSessionId} onChange={event => changeSession(event.target.value)}>{choices.filter(session => selected && classKey(session) === classKey(selected)).sort((a,b) => a.meetingNumber-b.meetingNumber).map(session => <option key={session.id} value={session.id}>P{session.meetingNumber}{session.isOpen ? '' : ' - Selesai'}</option>)}</select></label></div>
        <div className="flex flex-wrap items-center gap-2"><p aria-label="Rekap draft presensi" className="text-sm flex flex-wrap gap-3">{([...statuses, null] as const).map(status => <span key={status || 'BT'}>{attendanceStatusLabel(status)}: <strong className={status === 'HADIR' ? 'text-emerald-600' : status === 'IZIN' ? 'text-blue-600' : status === 'SAKIT' ? 'text-amber-600' : status === 'ALPHA' ? 'text-rose-600' : 'text-slate-500'}>{rows.filter(row => (drafts[row.nim]?.status ?? null) === status).length}</strong></span>)}</p><button type="button" disabled={blocked || saving || dirtyCount > 0} className="frost-btn" onClick={() => bulk(false)}><CheckCheck className="w-4 h-4" />Semua Hadir</button><button type="button" disabled={blocked || saving || dirtyCount > 0} className="frost-btn" onClick={() => bulk(true)}>Hadirkan Sisa Alpa</button></div>
      </div>
      {activeSession && <div className="px-4 py-3 border-b bg-slate-50 text-xs flex flex-wrap justify-between gap-2"><span>Tanggal: {activeSession.date} · Topik: <strong>{activeSession.topic}</strong></span>{activeSession.evaluationMethod && <span className="text-blue-600">Evaluasi: {activeSession.evaluationMethod}</span>}</div>}
      <div className="px-4 pt-3 space-y-2">{error && <p role="alert" className="text-rose-700">{error}</p>}{notice && <p role="status" className="text-emerald-700">{notice}</p>}{!data && !error && <p role="status">Memuat presensi...</p>}{blocked && data && <p role="alert">Sesi arsip tidak dapat diubah.</p>}<label className="flex items-center gap-2 max-w-sm"><Search className="w-4 h-4 text-slate-400" /><input aria-label="Cari peserta presensi" className="frost-input" placeholder="Cari NIM atau nama mahasiswa..." value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      <div className="overflow-auto px-4 py-2 flex-1 min-h-[100px]"><table aria-label="Tabel presensi manual" className="w-full min-w-[720px] text-sm text-left"><thead className="sticky top-0 bg-white"><tr className="border-b text-slate-600"><th className="py-3">No</th><th>NIM</th><th>Nama Lengkap</th><th>Status Kehadiran</th><th>Keterangan</th></tr></thead><tbody>{rows.filter(row => `${row.nim} ${row.name}`.toLowerCase().includes(search.toLowerCase())).map((row,index) => <tr key={row.nim} data-nim={row.nim} className="border-b border-slate-100"><td className="py-4 text-slate-400">{index+1}</td><td className="font-mono pr-3">{row.nim}</td><td className="pr-3">{row.name}</td><td className="pr-3"><div className="flex gap-1">{statuses.map(status => <button key={status} type="button" aria-label={`${attendanceStatusLabel(status)} ${row.nim}`} aria-pressed={drafts[row.nim]?.status === status} disabled={blocked} className={`rounded px-2 py-1 text-xs font-medium ${drafts[row.nim]?.status === status ? colors[status] : 'text-slate-600 hover:bg-slate-100'}`} onClick={() => editMany({[row.nim]:{status}})}>{attendanceStatusLabel(status)}</button>)}</div>{!drafts[row.nim]?.status && <span className="text-xs text-slate-500">Belum tercatat</span>}</td><td><input aria-label={`Alasan ${row.nim}`} placeholder="Catatan..." className="frost-input min-w-[160px]" disabled={blocked} value={drafts[row.nim]?.notes || ''} onChange={event => editMany({[row.nim]:{notes:event.target.value}},600)} /></td></tr>)}</tbody></table>{data && !rows.length && <p>Tidak ada roster valid untuk sesi ini.</p>}</div>
      <footer className="px-4 py-3 border-t bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0"><p role="status" className={`text-sm ${error ? 'text-rose-600' : 'text-slate-500'}`}>{saving ? 'Menyimpan perubahan...' : error ? 'Belum tersimpan. Coba Simpan Perubahan.' : dirtyCount ? 'Menunggu sinkronisasi...' : !data ? 'Memuat presensi...' : notice || 'Data dimuat dari server.'}</p><div className="flex flex-wrap gap-2">{activeSession?.isOpen && <button type="button" disabled={saving} className="frost-btn text-rose-600" onClick={async () => { if (await save()) setIsCloseDialogOpen(true); }}><Lock className="w-4 h-4" />Akhiri Sesi Kuliah</button>}<button type="button" disabled={saving} className="frost-btn" onClick={requestClose}>Tutup</button>{dirtyCount > 0 && <button type="button" disabled={blocked || saving} className="frost-btn" onClick={() => { void save(); }}>Simpan Perubahan</button>}<button type="button" disabled={blocked || saving} className="frost-btn frost-btn-primary" onClick={async () => { if (await save()) onClose(); }}><Save className="w-4 h-4" />Selesai</button></div></footer>
    </section>
    <CloseSessionDialog isOpen={isCloseDialogOpen} session={activeSession || null} onClose={() => setIsCloseDialogOpen(false)} onConfirm={async () => { if (activeSession && await save()) { await closeSession(activeSession.id); populate(await api<History>(`/attendance-sessions/${encodeURIComponent(activeSession.id)}/history`)); setIsCloseDialogOpen(false); } }} />
  </div>;
};



