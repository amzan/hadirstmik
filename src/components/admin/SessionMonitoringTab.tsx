import React, { useState, useMemo, useEffect } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceSession, AttendanceRecord, Student } from '../../types/attendance';
import { api } from '../../utils/api';
import { getSessionAttendanceRows, getSessionAttendanceSummary } from '../../utils/sessionAttendance';
import { SessionAttendanceHistory } from '../dosen/SessionAttendanceHistory';
import { summarizeAllAttendancePolicy } from '../../../shared/attendance-policy.mjs';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import {
  Clock, CheckCircle2, AlertCircle, RotateCcw, Search,
  Filter, PlayCircle, StopCircle, Users, Check,
  QrCode, X, BookOpen, GraduationCap, ChevronRight, RefreshCw, Eye, Trash2
} from 'lucide-react';

export const SessionMonitoringTab: React.FC = () => {
  const {
    sessions,
    records,
    students,
    resetClosedSessions,
    resetSingleSession,
    reopenSession,
    closeSession,
    deleteSession,
  } = useAttendance();

  const [showArchived, setShowArchived] = useState(false);
  const [archiveData,setArchiveData] = useState<{sessions:AttendanceSession[];records:AttendanceRecord[];students:Student[]}>({sessions:[],records:[],students:[]});
  const [archiveError,setArchiveError] = useState('');
  useEffect(()=>{if(!showArchived)return;let active=true;setArchiveError('');api<typeof archiveData>('/reports/snapshot?archived=1').then(value=>{if(active)setArchiveData(value);}).catch(error=>{if(active)setArchiveError(error instanceof Error?error.message:'Arsip gagal dimuat.');});return()=>{active=false;};},[showArchived,sessions]);
  const displayedSessions=showArchived?archiveData.sessions:sessions;
  const displayedRecords=showArchived?archiveData.records:records;
  const displayedStudents=showArchived?archiveData.students:students;

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [prodiFilter, setProdiFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string>('');

  // Selected session for viewing student detail list
  const [viewDetailSession, setViewDetailSession] = useState<AttendanceSession | null>(null);

  // Confirm dialog state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  // Calculate statistics
  const openSessions = useMemo(() => sessions.filter(s => s.isOpen), [sessions]);
  const closedSessions = useMemo(() => sessions.filter(s => !s.isOpen), [sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return displayedSessions.filter(s => {
      // Status filter
      if (statusFilter === 'OPEN' && !s.isOpen) return false;
      if (statusFilter === 'CLOSED' && s.isOpen) return false;

      // Search filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchCourse = s.courseName.toLowerCase().includes(q) || s.courseCode.toLowerCase().includes(q);
        const matchLecturer = s.lecturerName.toLowerCase().includes(q);
        const matchRombel = s.rombel.toLowerCase().includes(q);
        const matchRoom = s.room.toLowerCase().includes(q);
        const matchTopic = (s.topic || '').toLowerCase().includes(q);
        if (!matchCourse && !matchLecturer && !matchRombel && !matchRoom && !matchTopic) {
          return false;
        }
      }

      return true;
    });
  }, [displayedSessions, statusFilter, searchQuery]);

  // Helper to compute attendance breakdown for a session
  const getSessionStats = (session: AttendanceSession) => {
    const sessionRecords = displayedRecords.filter(r => r.sessionId === session.id);
    const eligibleStudents = getSessionAttendanceRows(session,displayedStudents,displayedRecords);
    const totalStudents = eligibleStudents.length;

    const summary = getSessionAttendanceSummary(eligibleStudents);
    const hadirCount = summary.HADIR, izinCount = summary.IZIN, sakitCount = summary.SAKIT, alphaCount = summary.ALPHA;
    const unrecordedCount = summary.UNRECORDED;
    const recordedCount = summary.total - unrecordedCount;

    const policy = summarizeAllAttendancePolicy(sessions, records, { sessionIds: [session.id] });
    const attendanceRate = policy.percentage;

    return {
      totalStudents,
      recordedCount,
      unrecordedCount,
      hadirCount,
      izinCount,
      sakitCount,
      alphaCount,
      attendanceRate,
      effectiveHadir: policy.hadir,
    };
  };

  // Handler: Batch Reset all closed sessions
  const handleTriggerResetAllClosed = async () => {
    try {
    if (closedSessions.length === 0) return;

    setConfirmConfig({
      isOpen: true,
      title: 'Reset Ulang Semua Sesi yang Sudah Ditutup?',
      message: `Tindakan ini akan mengarsipkan ${closedSessions.length} pelaksanaan beserta seluruh presensinya sebagai dibatalkan. Histori tetap tersimpan. Pertemuan dapat dimulai lagi dengan ID sesi baru. Lanjutkan?`,
      confirmLabel: 'Ya, Reset Semua Sesi Ditutup',
      isDestructive: true,
      onConfirm: async () => {
        const count = await resetClosedSessions();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setActionSuccessMessage(
          `Berhasil me-reset ulang ${count} sesi perkuliahan yang sudah ditutup. Histori dan presensi lama tetap tersimpan di Arsip Sesi.`
        );
        setTimeout(() => setActionSuccessMessage(''), 6000);
      },
    });
    } catch(error) { window.dispatchEvent(new CustomEvent('hadir-api-error',{detail:error instanceof Error?error.message:'Permintaan gagal.'})); } finally {  }
  };

  // Handler: Reset a single session
  const handleTriggerResetSingle = async (session: AttendanceSession) => {
    try {
    setConfirmConfig({
      isOpen: true,
      title: `Reset Sesi ${session.courseName}?`,
      message: `Pelaksanaan ${session.courseName} (Pertemuan ${session.meetingNumber}, Rombel ${session.rombel}) akan dibatalkan dan diarsipkan beserta seluruh presensinya. Pelaksanaan ulang memakai ID sesi baru. Histori tidak dihapus.`,
      confirmLabel: 'Ya, Reset Sesi Ini',
      isDestructive: true,
      onConfirm: async () => {
        await resetSingleSession(session.id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setActionSuccessMessage(
          `Presensi sesi "${session.courseName}" (Pertemuan ${session.meetingNumber}) dibatalkan dan diarsipkan; histori presensi tetap tersimpan.`
        );
        setTimeout(() => setActionSuccessMessage(''), 5000);
      },
    });
    } catch(error) { window.dispatchEvent(new CustomEvent('hadir-api-error',{detail:error instanceof Error?error.message:'Permintaan gagal.'})); } finally {  }
  };

  // Handler: Reopen a closed session
  const handleTriggerReopen = async (session: AttendanceSession) => {
    try {
    await reopenSession(session.id);
    setActionSuccessMessage(
      `Sesi "${session.courseName}" berhasil dibuka kembali. Presensi lama tetap tersimpan. QR lama tidak diaktifkan kembali.`
    );
    setTimeout(() => setActionSuccessMessage(''), 5000);
    } catch(error) { window.dispatchEvent(new CustomEvent('hadir-api-error',{detail:error instanceof Error?error.message:'Permintaan gagal.'})); } finally {  }
  };

  // Handler: Close an open session
  const handleTriggerClose = async (session: AttendanceSession) => {
    try {
    await closeSession(session.id);
    setActionSuccessMessage(
      `Sesi "${session.courseName}" telah ditutup oleh BAAK. Mahasiswa yang tidak hadir dialihkan ke Alpha.`
    );
    setTimeout(() => setActionSuccessMessage(''), 5000);
    } catch(error) { window.dispatchEvent(new CustomEvent('hadir-api-error',{detail:error instanceof Error?error.message:'Permintaan gagal.'})); } finally {  }
  };

  // Handler: Delete a closed session
  const handleTriggerDelete = async (session: AttendanceSession) => {
    try {
    setConfirmConfig({
      isOpen: true,
      title: `Hapus Sesi ${session.courseName}?`,
      message: `Apakah Anda yakin ingin menghapus sesi perkuliahan ${session.courseName} (Pertemuan ${session.meetingNumber}, tanggal ${session.date})? Sesi beserta seluruh presensinya akan diarsipkan dan tidak dihapus permanen.`,
      confirmLabel: 'Ya, Hapus Sesi',
      isDestructive: true,
      onConfirm: async () => {
        await deleteSession(session.id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setActionSuccessMessage(
          `Sesi perkuliahan "${session.courseName}" (Pertemuan ${session.meetingNumber}) berhasil diarsipkan.`
        );
        setTimeout(() => setActionSuccessMessage(''), 5000);
      },
    });
    } catch(error) { window.dispatchEvent(new CustomEvent('hadir-api-error',{detail:error instanceof Error?error.message:'Permintaan gagal.'})); } finally {  }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3"><button type="button" className="frost-btn" aria-pressed={!showArchived} onClick={()=>setShowArchived(false)}>Sesi Operasional</button><button type="button" className="frost-btn" aria-pressed={showArchived} onClick={()=>setShowArchived(true)}>Arsip Sesi</button></div>
      {archiveError&&<p role="alert" className="text-rose-700">{archiveError}</p>}
      {/* Top Banner & Batch Reset Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                Pengawasan & Kontrol Sesi Akademik
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              Monitoring Seluruh Sesi Perkuliahan
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              BAAK dapat memantau semua sesi perkuliahan aktif (sedang berlangsung) maupun yang telah ditutup oleh dosen pengampu, serta membatalkan pelaksanaan sesi melalui Reset Sesi tanpa menghapus histori.
            </p>
          </div>

          {/* Master Batch Action Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleTriggerResetAllClosed}
              disabled={showArchived || closedSessions.length === 0}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs"
              title="Batalkan dan arsipkan semua sesi tertutup tanpa menghapus histori"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Semua Sesi yang Sudah Ditutup ({closedSessions.length})</span>
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {actionSuccessMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-800 font-medium flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button
              onClick={() => setActionSuccessMessage('')}
              className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4 Summary Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs text-slate-500 font-medium block">Total Sesi Perkuliahan</span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {sessions.length} Sesi
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Arsip semester berjalan</span>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-800 font-semibold">Sedang Berlangsung</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-900 mt-0.5">
              {openSessions.length} Sesi Aktif
            </div>
            <span className="text-[11px] text-emerald-700 mt-0.5 block">Presensi QR terbuka</span>
          </div>

          <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl">
            <span className="text-xs text-slate-600 font-semibold block">Sudah Ditutup</span>
            <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-0.5">
              {closedSessions.length} Sesi Selesai
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Histori tetap tersimpan saat reset</span>
          </div>

          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
            <span className="text-xs text-indigo-800 font-semibold block">Total Kehadiran Mahasiswa</span>
            <div className="text-xl sm:text-2xl font-bold text-indigo-900 mt-0.5">
              {records.filter(r => r.status === 'HADIR').length} Hadir
            </div>
            <span className="text-[11px] text-indigo-700 mt-0.5 block">Dari {records.length} rekaman presensi</span>
          </div>
        </div>
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Tab Filter */}
        <div className="flex overflow-x-auto whitespace-nowrap no-scrollbar items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold max-w-full">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Sesi ({sessions.length})
          </button>
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              statusFilter === 'OPEN'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Berlangsung ({openSessions.length})</span>
          </button>
          <button
            onClick={() => setStatusFilter('CLOSED')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer shrink-0 ${
              statusFilter === 'CLOSED'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sudah Ditutup ({closedSessions.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari mata kuliah, dosen, ruang, rombel..."
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition"
          />
        </div>
      </div>

      {/* Sessions Table / List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Tidak ada sesi perkuliahan yang ditemukan</p>
            <p className="text-xs text-slate-400">Silakan ubah filter status atau kata kunci pencarian.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold">
                  <th className="py-3 px-4">Status & Pertemuan</th>
                  <th className="py-3 px-4">Mata Kuliah & Dosen</th>
                  <th className="py-3 px-4">Rombel & Ruang</th>
                  <th className="py-3 px-4">Waktu Perkuliahan</th>
                  <th className="py-3 px-4">Ringkasan Presensi</th>
                  <th className="py-3 px-4 text-right">Aksi BAAK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((session) => {
                  const stats = getSessionStats(session);

                  return (
                    <tr key={session.id} data-session-id={session.id} className="hover:bg-slate-50/80 transition">
                      {/* Status & Meeting */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {session.isOpen ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>Sedang Berlangsung</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                              <span>Ditutup (Selesai)</span>
                            </span>
                          )}
                          <div className="text-xs font-bold text-slate-900 mt-1">
                            Pertemuan Ke-{session.meetingNumber}
                          </div>
                          {session.topic && (
                            <div className="text-[11px] text-slate-500 line-clamp-1 max-w-[170px]" title={session.topic}>
                              {session.topic}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Course & Lecturer */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {session.courseCode}
                          </span>
                          <div className="font-bold text-slate-900 text-sm mt-0.5">
                            {session.courseName}
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                            <span>{session.lecturerName}</span>
                          </div>
                        </div>
                      </td>

                      {/* Rombel & Room */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                            {session.rombel}
                          </span>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Ruangan: <strong className="text-slate-800 font-semibold">{session.room}</strong>
                          </div>
                        </div>
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-900 block">{session.date}</span>
                          <span className="text-slate-500 font-mono mt-0.5 block">
                            {session.startTime}–{session.endTime} WIB
                          </span>
                        </div>
                      </td>

                      {/* Attendance Stats breakdown */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5 min-w-[150px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900">
                              {showArchived ? 'Arsip: hadir aktual' : 'Kehadiran efektif'} {showArchived ? stats.hadirCount : stats.effectiveHadir} / {stats.totalStudents}
                            </span>
                            <span className="text-slate-500 font-mono text-[11px]">
                              {showArchived ? '-' : `${stats.attendanceRate}%`}
                            </span>
                          </div>

                          {/* Progress bar */}
                          {!showArchived && <p className="text-[10px] text-slate-500">Toleransi Izin/Sakit masing-masing 2 per kelas dan periode.</p>}
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${stats.attendanceRate}%` }}
                            ></div>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="text-emerald-700 font-semibold">{stats.hadirCount} Hadir</span>
                            <span>·</span>
                            <span className="text-amber-700 font-semibold">{stats.izinCount + stats.sakitCount} Izin/Skt</span>
                            <span>·</span>
                            <span className="text-rose-700 font-semibold">{stats.alphaCount} Alpha</span>
                            {stats.unrecordedCount > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-slate-400 font-medium">{stats.unrecordedCount} Belum</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Detail button */}
                          <button
                            onClick={() => setViewDetailSession(session)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold transition cursor-pointer"
                            title="Lihat rincian presensi mahasiswa sesi ini"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* If session is closed: show Reset, Reopen, and Delete */}
                          {!session.isOpen && !session.isArchived && (
                            <>
                              <button
                                onClick={() => handleTriggerResetSingle(session)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                                title="Batalkan pelaksanaan sesi dan simpan histori dalam arsip"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reset Sesi</span>
                              </button>

                              <button
                                onClick={() => handleTriggerReopen(session)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                                title="Buka kembali sesi perkuliahan ini"
                              >
                                <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Buka Sesi</span>
                              </button>

                              <button
                                onClick={() => handleTriggerDelete(session)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                                title="Hapus sesi perkuliahan yang sudah ditutup ini"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* If session is open: show Close button */}
                          {session.isOpen && (
                            <button
                              onClick={() => handleTriggerClose(session)}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                              title="Tutup sesi perkuliahan aktif ini"
                            >
                              <StopCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Tutup Sesi</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail Mahasiswa Sesi */}
      {viewDetailSession && <SessionAttendanceHistory sessionId={viewDetailSession.id} onClose={()=>setViewDetailSession(null)} />}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
