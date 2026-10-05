import React, { useState, useMemo } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceSession, Student } from '../../types/attendance';
import { isStudentInRombel } from '../../data/initialData';
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
    onConfirm: () => {},
  });

  // Calculate statistics
  const openSessions = useMemo(() => sessions.filter(s => s.isOpen), [sessions]);
  const closedSessions = useMemo(() => sessions.filter(s => !s.isOpen), [sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
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
  }, [sessions, statusFilter, searchQuery]);

  // Helper to compute attendance breakdown for a session
  const getSessionStats = (session: AttendanceSession) => {
    const sessionRecords = records.filter(r => r.sessionId === session.id);
    const eligibleStudents = students.filter(stu => isStudentInRombel(stu.rombel, session.rombel));
    const totalStudents = eligibleStudents.length;

    const hadirCount = sessionRecords.filter(r => r.status === 'HADIR').length;
    const izinCount = sessionRecords.filter(r => r.status === 'IZIN').length;
    const sakitCount = sessionRecords.filter(r => r.status === 'SAKIT').length;
    const alphaCount = sessionRecords.filter(r => r.status === 'ALPHA').length;
    const recordedCount = sessionRecords.length;
    const unrecordedCount = Math.max(0, totalStudents - recordedCount);

    const attendanceRate = totalStudents > 0 ? Math.round((hadirCount / totalStudents) * 100) : 0;

    return {
      totalStudents,
      recordedCount,
      unrecordedCount,
      hadirCount,
      izinCount,
      sakitCount,
      alphaCount,
      attendanceRate,
    };
  };

  // Handler: Batch Reset all closed sessions
  const handleTriggerResetAllClosed = () => {
    if (closedSessions.length === 0) return;

    setConfirmConfig({
      isOpen: true,
      title: 'Reset Ulang Semua Sesi yang Sudah Ditutup?',
      message: `Tindakan ini akan mengosongkan seluruh data presensi mahasiswa pada ${closedSessions.length} sesi perkuliahan yang telah ditutup. Seluruh mahasiswa pada sesi-sesi tersebut akan kembali ke kondisi awal (belum ter-presensi). Anda yakin ingin melanjutkan?`,
      confirmLabel: 'Ya, Reset Semua Sesi Ditutup',
      isDestructive: true,
      onConfirm: () => {
        const count = resetClosedSessions();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setActionSuccessMessage(
          `Berhasil me-reset ulang ${count} sesi perkuliahan yang sudah ditutup. Data presensi mahasiswa telah dibersihkan kembali ke sesi awal.`
        );
        setTimeout(() => setActionSuccessMessage(''), 6000);
      },
    });
  };

  // Handler: Reset a single session
  const handleTriggerResetSingle = (session: AttendanceSession) => {
    setConfirmConfig({
      isOpen: true,
      title: `Reset Presensi Sesi ${session.courseName}?`,
      message: `Data presensi mahasiswa untuk mata kuliah ${session.courseName} (Pertemuan ${session.meetingNumber}, Rombel ${session.rombel}) akan dibersihkan kembali ke sesi awal (mahasiswa belum ter-presensi).`,
      confirmLabel: 'Ya, Reset Presensi Sesi Ini',
      isDestructive: true,
      onConfirm: () => {
        resetSingleSession(session.id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setActionSuccessMessage(
          `Presensi sesi "${session.courseName}" (Pertemuan ${session.meetingNumber}) berhasil di-reset ulang ke kondisi awal.`
        );
        setTimeout(() => setActionSuccessMessage(''), 5000);
      },
    });
  };

  // Handler: Reopen a closed session
  const handleTriggerReopen = (session: AttendanceSession) => {
    reopenSession(session.id);
    setActionSuccessMessage(
      `Sesi "${session.courseName}" berhasil dibuka kembali. Mahasiswa kini dapat melakukan presensi.`
    );
    setTimeout(() => setActionSuccessMessage(''), 5000);
  };

  // Handler: Close an open session
  const handleTriggerClose = (session: AttendanceSession) => {
    closeSession(session.id);
    setActionSuccessMessage(
      `Sesi "${session.courseName}" telah ditutup oleh BAAK. Mahasiswa yang tidak hadir dialihkan ke Alpha.`
    );
    setTimeout(() => setActionSuccessMessage(''), 5000);
  };

  // Handler: Delete a closed session
  const handleTriggerDelete = (session: AttendanceSession) => {
    setConfirmConfig({
      isOpen: true,
      title: `Hapus Sesi ${session.courseName}?`,
      message: `Apakah Anda yakin ingin menghapus sesi perkuliahan ${session.courseName} (Pertemuan ${session.meetingNumber}, tanggal ${session.date})? Seluruh riwayat presensi yang terhubung dengan sesi ini akan dihapus secara permanen.`,
      confirmLabel: 'Ya, Hapus Sesi',
      isDestructive: true,
      onConfirm: () => {
        deleteSession(session.id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setActionSuccessMessage(
          `Sesi perkuliahan "${session.courseName}" (Pertemuan ${session.meetingNumber}) berhasil dihapus.`
        );
        setTimeout(() => setActionSuccessMessage(''), 5000);
      },
    });
  };

  return (
    <div className="space-y-6">
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
              BAAK dapat memantau semua sesi perkuliahan aktif (sedang berlangsung) maupun yang telah ditutup oleh dosen pengampu, serta me-reset ulang status presensi ke kondisi awal.
            </p>
          </div>

          {/* Master Batch Action Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleTriggerResetAllClosed}
              disabled={closedSessions.length === 0}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs"
              title="Reset semua sesi yang sudah ditutup menjadi sesi awal / belum ter-presensi"
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
            <span className="text-[11px] text-slate-500 mt-0.5 block">Dapat di-reset ulang ke awal</span>
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
                    <tr key={session.id} className="hover:bg-slate-50/80 transition">
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
                              {stats.hadirCount} / {stats.totalStudents} Mahasiswa
                            </span>
                            <span className="text-slate-500 font-mono text-[11px]">
                              {stats.attendanceRate}%
                            </span>
                          </div>

                          {/* Progress bar */}
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
                          {!session.isOpen && (
                            <>
                              <button
                                onClick={() => handleTriggerResetSingle(session)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                                title="Reset presensi sesi ini agar mahasiswa belum ter-presensi"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reset Presensi</span>
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
      {viewDetailSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-auto overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider block">
                  Detail Kehadiran Mahasiswa
                </span>
                <h4 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {viewDetailSession.courseName} · Pertemuan {viewDetailSession.meetingNumber}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rombel {viewDetailSession.rombel} · Ruang {viewDetailSession.room} · Dosen: {viewDetailSession.lecturerName}
                </p>
              </div>
              <button
                onClick={() => setViewDetailSession(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Token and Status pill */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Status Sesi:</span>{' '}
                  <span className={`font-bold ${viewDetailSession.isOpen ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {viewDetailSession.isOpen ? 'Sedang Berlangsung (Aktif)' : 'Sudah Ditutup (Selesai)'}
                  </span>
                </div>
                <div className="font-mono text-slate-600">
                  Token: <strong>{viewDetailSession.qrToken}</strong>
                </div>
              </div>

              {/* Student attendance list */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">NIM</th>
                      <th className="py-2.5 px-3">Nama Mahasiswa</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Waktu Presensi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students
                      .filter(stu => isStudentInRombel(stu.rombel, viewDetailSession.rombel))
                      .map((student, idx) => {
                        const rec = records.find(
                          r => r.sessionId === viewDetailSession.id && r.studentNim === student.nim
                        );

                        return (
                          <tr key={student.nim} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-medium text-slate-800">{student.nim}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{student.name}</td>
                            <td className="py-2 px-3">
                              {rec ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    rec.status === 'HADIR'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : rec.status === 'IZIN'
                                      ? 'bg-amber-100 text-amber-800'
                                      : rec.status === 'SAKIT'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {rec.status}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                                  BELUM PRESENSI
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-mono">
                              {rec?.scannedAt
                                ? new Date(rec.scannedAt).toLocaleTimeString('id-ID')
                                : '-'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewDetailSession(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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
