import type { ReportSnapshot } from '../../utils/reportSnapshot';
import React, { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { api, sessionGeneration } from '../../utils/api';
import { useAttendance } from '../../context/AttendanceContext';
import type { AttendanceRecord, AttendanceSession, Student } from '../../types/attendance';
import { attendanceStatusLabel, getSessionAttendanceRows, getSessionAttendanceSummary } from '../../utils/sessionAttendance';
import { generateSessionAttendancePDF } from '../../utils/pdfGenerator';

type HistoryData = { session: AttendanceSession; students: Student[]; records: AttendanceRecord[]; generatedAt?: string };

export function SessionAttendanceHistory({ sessionId, onClose, onManageManual, refreshKey }: { sessionId: string; onClose: () => void; onManageManual?: (session: AttendanceSession) => void; refreshKey?: number }) {
  const { schedules, courses, currentUser } = useAttendance();
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const identity = sessionGeneration();
    let active = true; setData(null); setError('');
    api<HistoryData>(`/attendance-sessions/${encodeURIComponent(sessionId)}/history`).then(value => { if (active && identity === sessionGeneration()) setData(value); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Histori gagal dimuat.'); });
    return () => { active = false; };
  }, [sessionId, attempt, refreshKey]);
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    window.addEventListener('hadir-attendance-updated', refresh);
    return () => window.removeEventListener('hadir-attendance-updated', refresh);
  }, []);
  const rows = data ? getSessionAttendanceRows(data.session, data.students, data.records) : [];
  const summary = getSessionAttendanceSummary(rows);
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
    <section role="dialog" aria-modal="true" aria-label="Detail histori presensi" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] overflow-y-auto">
      <header className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-900">Histori Presensi</h2>{data && <>
          <p>{data.session.courseCode} - {data.session.courseName} (Pertemuan {data.session.meetingNumber})</p>
          <p className="text-sm text-slate-600">Rombel {data.session.rombel} - {data.session.date} - Ruang {data.session.room}</p>
          <p className="text-sm text-slate-600">Dosen: {data.session.lecturerName}</p>
          {data.session.topic && <p className="text-sm text-slate-600">Topik: {data.session.topic}</p>}
        </>}</div>
        <button type="button" aria-label="Tutup histori" onClick={onClose} className="frost-btn frost-btn-icon-only"><X className="w-5 h-5" /></button>
      </header>
      <div className="p-6 space-y-4">
        {error && <div role="alert"><p className="text-rose-700">{error}</p>{!data && <button type="button" className="frost-btn" onClick={() => setAttempt(value => value + 1)}>Coba lagi</button>}</div>}
        {!data && !error && <p role="status">Memuat presensi historis...</p>}
        {data && <>
          <p className="text-sm text-slate-600">Status mengikuti catatan efektif terbaru pada sesi ini.</p>
          <div aria-label="Rekap presensi sesi" className="flex flex-wrap gap-4 text-sm font-semibold">
            <span>Hadir: {summary.HADIR}</span><span>Izin: {summary.IZIN}</span><span>Sakit: {summary.SAKIT}</span><span>Alpa: {summary.ALPHA}</span><span>Belum tercatat: {summary.UNRECORDED}</span><span>Total: {summary.total}</span>
          </div>
          <div className="overflow-x-auto"><table aria-label="Presensi historis sesi" className="w-full text-left text-sm">
            <thead><tr className="border-b"><th className="py-2">NIM</th><th>Nama mahasiswa</th><th>Status</th></tr></thead>
            <tbody>{rows.map(row => <tr data-nim={row.nim} key={row.nim} className="border-b border-slate-100"><td className="py-3 font-mono">{row.nim}</td><td className="break-words">{row.name}</td><td>{attendanceStatusLabel(row.status)}</td></tr>)}</tbody>
          </table></div>
          {!rows.length && <p>Belum ada peserta atau catatan presensi yang terhubung ke sesi ini.</p>}
          {onManageManual && !data.session.isArchived && (currentUser.role === 'admin' || data.session.lecturerId === currentUser.id) && <button type="button" className="frost-btn" onClick={() => onManageManual(data.session)}>Kelola Presensi Manual</button>}
          {data.session.isArchived && <p className="font-semibold">Arsip - hanya baca</p>}
          <button type="button" disabled={exporting} className="frost-btn frost-btn-primary" onClick={async () => {
            setExporting(true); setError('');
            const identity = sessionGeneration();
            try {
              const snapshot = await api<ReportSnapshot>(`/reports/snapshot${data?.session.isArchived ? '?archived=1' : ''}`);
              const session = snapshot.sessions.find(value => value.id === sessionId);
              if (!session) throw new Error('Sesi berubah atau tidak tersedia. Ekspor dibatalkan.');
              const fresh: HistoryData = { session, students: snapshot.students, records: snapshot.records.filter(record => record.sessionId === sessionId), generatedAt: snapshot.generatedAt };
              if (identity !== sessionGeneration()) throw new Error('Identitas berubah. Ekspor dibatalkan.');
              setData(fresh);
              const schedule = snapshot.schedules.find(value => value.id === fresh.session.scheduleId && value.lecturerId === fresh.session.lecturerId);
              const course = snapshot.courses.find(value => value.code === fresh.session.courseCode);
              generateSessionAttendancePDF({ courseCode: fresh.session.courseCode, courseName: fresh.session.courseName, lecturerName: fresh.session.lecturerName,
                rombel: fresh.session.rombel, sks: schedule?.sks || course?.sks || 0, prodi: schedule?.prodi || course?.prodi || '', generatedAt: fresh.generatedAt, isArchive: fresh.session.isArchived, policySessions: snapshot.sessions, policyRecords: snapshot.records }, fresh.session, fresh.students, fresh.records);
            } catch (error) { setError(error instanceof Error ? error.message : 'Data terbaru gagal dimuat. Ekspor dibatalkan.'); }
            finally { setExporting(false); }
          }}><Download className="w-4 h-4" />{exporting ? 'Mengambil data terbaru...' : 'Unduh PDF Sesi'}</button>
        </>}
      </div>
    </section>
  </div>;
}
