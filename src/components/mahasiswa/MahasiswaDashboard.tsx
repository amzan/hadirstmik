import React, { useState, useEffect, useMemo } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { QrScannerModal } from './QrScannerModal';
import { LeaveRequestModal } from './LeaveRequestModal';
import { getStudentRombelList, getStudentEnrolledSchedules, isStudentInRombel, CAMPUS_INFO } from '../../data/initialData';
import {
  generateKartuPresensiPDF,
  KartuPresensiCourseItem,
  KartuPresensiStudentData
} from '../../utils/pdfGenerator';
import {
  QrCode, FileText, Calendar, UserCheck, Clock, UserCog, FileDown, CheckCircle2, Loader2, ShieldCheck, RefreshCw, Shield, Zap, HeartPulse, Skull, Award
} from 'lucide-react';

interface MahasiswaDashboardProps {
  onOpenProfile?: () => void;
}

export const MahasiswaDashboard: React.FC<MahasiswaDashboardProps> = ({
  onOpenProfile
}) => {
  const {
    currentUser,
    records,
    sessions,
    schedules,
    students,
    activeDay,
    simulatedTime,
    getAttendanceRateForStudent,
    syncStudentData
  } = useAttendance();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedCourseTab, setSelectedCourseTab] = useState<string>('ALL');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  );
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const studentNim = (currentUser.username || '').trim().toUpperCase();
  const matchedStudent = students.find(s => s.nim.trim().toUpperCase() === studentNim);

  const studentRombelList = (matchedStudent?.rombels && matchedStudent.rombels.length > 0)
    ? matchedStudent.rombels
    : (currentUser.rombels && currentUser.rombels.length > 0)
      ? currentUser.rombels
      : getStudentRombelList(matchedStudent?.rombel || currentUser.rombel || 'TI 3');

  // Auto-synchronize relational data when student dashboard mounts or student NIM changes
  useEffect(() => {
    if (studentNim) {
      const res = syncStudentData(studentNim);
      if (res.syncedAt) {
        setLastSyncedAt(res.syncedAt);
      }
    }
  }, [studentNim]);

  // Manual trigger to refresh relational data from Dosen & Admin BAAK
  const handleSyncData = () => {
    setIsSyncing(true);
    setSyncNotice(null);
    setTimeout(() => {
      const res = syncStudentData(studentNim);
      setLastSyncedAt(res.syncedAt);
      setSyncNotice(res.message);
      setIsSyncing(false);
      setTimeout(() => setSyncNotice(null), 8000);
    }, 300);
  };

  // Overall attendance rate
  const overallRate = getAttendanceRateForStudent(studentNim);

  // Filter personal attendance records strictly matched & deduplicated against student's valid sessions
  const myRecords = useMemo(() => {
    const activeStudent = matchedStudent || currentUser;
    const validSessionMap = new Map(
      sessions
        .filter(session => {
          if (session.scheduleId && activeStudent.excludedScheduleIds?.includes(session.scheduleId)) {
            return false;
          }
          const isCustomIncluded = session.scheduleId && activeStudent.customScheduleIds?.includes(session.scheduleId);
          return isCustomIncluded || isStudentInRombel(activeStudent.rombel, session.rombel, activeStudent.rombels);
        })
        .map(s => [s.id, s])
    );

    const dedupBySession = new Map<string, typeof records[number]>();
    records.forEach(r => {
      if (r.studentNim.trim().toUpperCase() !== studentNim) return;
      if (!validSessionMap.has(r.sessionId)) return;

      const existing = dedupBySession.get(r.sessionId);
      if (!existing) {
        dedupBySession.set(r.sessionId, r);
      } else {
        const tExisting = new Date(existing.scannedAt || 0).getTime();
        const tCurr = new Date(r.scannedAt || 0).getTime();
        if (tCurr >= tExisting) {
          dedupBySession.set(r.sessionId, r);
        }
      }
    });

    return Array.from(dedupBySession.values()).sort(
      (a, b) => new Date(b.scannedAt || 0).getTime() - new Date(a.scannedAt || 0).getTime()
    );
  }, [records, sessions, matchedStudent, currentUser, studentNim]);

  // Enrolled schedules for this student, respecting any individual exclusions
  const mySchedules = getStudentEnrolledSchedules(matchedStudent || currentUser, schedules);

  // Today's classes
  const todayClasses = mySchedules.filter(s => s.day === activeDay);

  // Filter records by selected course
  const displayedRecords = myRecords.filter(r => {
    if (selectedCourseTab === 'ALL') return true;
    return r.courseCode === selectedCourseTab;
  });

  // Handler to generate and download Kartu Presensi Mahasiswa PDF
  const handleGenerateKartuPresensi = () => {
    setIsGeneratingPdf(true);
    setPdfSuccessNotice(null);

    try {
      const coursesSummary: KartuPresensiCourseItem[] = mySchedules.map(sch => {
        const courseRate = getAttendanceRateForStudent(studentNim, sch.courseCode);
        return {
          courseCode: sch.courseCode,
          courseName: sch.courseName,
          sks: sch.sks,
          lecturerName: sch.lecturerName,
          rombel: sch.rombel,
          hadir: courseRate.hadir,
          izin: courseRate.izin,
          sakit: courseRate.sakit,
          alpha: courseRate.alpha,
          totalHeld: courseRate.totalSessions,
          percentage: courseRate.percentage,
          eligibleExam: courseRate.percentage >= 75,
        };
      });

      const studentData: KartuPresensiStudentData = {
        nim: studentNim,
        name: matchedStudent?.name || currentUser.name,
        prodi: matchedStudent?.prodi || currentUser.prodi || 'Teknologi Informasi',
        rombel: studentRombelList.join(', ') || currentUser.rombel || 'TI 3',
        academicYear: '2026/2027 Ganjil',
        semester: CAMPUS_INFO.semester,
      };

      generateKartuPresensiPDF(studentData, coursesSummary, overallRate);

      setPdfSuccessNotice(
        `Dokumen "Kartu Presensi Mahasiswa" (NIM: ${studentNim}) berhasil diunduh. Dokumen mencakup ringkasan kehadiran seluruh mata kuliah beserta dua kotak kosong verifikasi tanda tangan pengawas UTS & UAS.`
      );
      setTimeout(() => setPdfSuccessNotice(null), 8000);
    } catch (err) {
      console.error('Gagal generate Kartu Presensi Mahasiswa:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const studentProdi = matchedStudent?.prodi || currentUser.prodi || 'Teknologi Informasi';
  const studentDisplayName = matchedStudent?.name || currentUser.name;
  const studentAvatarUrl = currentUser.avatarUrl;
  const studentInitials = studentDisplayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('');

  // Light Mode Game Card Color & Visual Accents derived from overall attendance rate
  const gameRankInfo = useMemo(() => {
    const pct = overallRate.percentage;
    const hasSessions = overallRate.totalSessions > 0;
    if (!hasSessions) {
      return {
        tier: 'Student',
        badgeBg: 'bg-slate-100 border-slate-200 text-slate-600',
        barGradient: 'from-slate-400 to-slate-500',
        glowRing: 'shadow-[0_6px_18px_-4px_rgba(148,163,184,0.35)]',
      };
    }
    if (pct >= 95) {
      return {
        tier: 'Student',
        badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
        barGradient: 'from-amber-400 via-sky-500 to-emerald-500',
        glowRing: 'shadow-[0_6px_20px_-4px_rgba(0,128,255,0.28)]',
      };
    }
    if (pct >= 85) {
      return {
        tier: 'Student',
        badgeBg: 'bg-[#E4F2FF] border-[#CCE6FF] text-[#0080FF]',
        barGradient: 'from-[#0080FF] via-cyan-500 to-emerald-500',
        glowRing: 'shadow-[0_6px_20px_-4px_rgba(0,128,255,0.25)]',
      };
    }
    if (pct >= 75) {
      return {
        tier: 'Student',
        badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        barGradient: 'from-emerald-500 to-teal-500',
        glowRing: 'shadow-[0_6px_18px_-4px_rgba(16,185,129,0.25)]',
      };
    }
    return {
      tier: 'Student',
      badgeBg: 'bg-rose-50 border-rose-200 text-rose-700',
      barGradient: 'from-rose-500 to-orange-500',
      glowRing: 'shadow-[0_6px_18px_-4px_rgba(244,63,94,0.25)]',
    };
  }, [overallRate.percentage, overallRate.totalSessions]);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Top 2-Column Section: Left = Portrait Student Game Card (Light Mode), Right = Quick Actions & Kartu Presensi Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Portrait Student ID Card (Light Mode Game Card + Frost-UI Typography & Spacing) */}
        <div className="lg:col-span-4 xl:col-span-4 flex">
          <div className="w-full relative rounded-2xl p-[1.5px] bg-gradient-to-b from-[#0080FF]/45 via-[#38bdf8]/35 to-[#6366F1]/40 shadow-sm flex flex-col justify-between overflow-hidden group select-none font-sans">
            {/* Inner Light Mode Card Chassis */}
            <div className="w-full h-full bg-white rounded-[14.5px] overflow-hidden flex flex-col justify-between relative text-[#222222]">
              {/* Subtle Light Tactical Grid & Soft Blue Ambient Glow */}
              <div
                className="absolute inset-0 opacity-60 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(0,128,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,128,255,0.045) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
                aria-hidden="true"
              />
              <div
                className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-44 bg-[#0080FF]/10 blur-3xl rounded-full pointer-events-none"
                aria-hidden="true"
              />

              {/* Top Section: Card Header, Portrait & Academic Identity */}
              <div className="relative z-10">
                {/* Top Bar: Student Badge & Institution Header */}
                <div className="px-6 pt-5 pb-4 bg-gradient-to-b from-[#F4F9FF] to-white border-b border-[#E5EEF8]">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-semibold ${gameRankInfo.badgeBg}`}
                    >
                      <span>{gameRankInfo.tier}</span>
                    </span>
                  </div>

                  {/* Institution Banner */}
                  <div className="text-center space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-[#0080FF] font-semibold">
                      Kartu Identitas Mahasiswa
                    </p>
                    <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-[#222222] leading-snug line-clamp-2">
                      {CAMPUS_INFO.name}
                    </h3>
                  </div>
                </div>

                {/* Portrait Profile Photo & Identity Details */}
                <div className="px-6 pt-5 pb-5 flex flex-col items-center text-center relative">
                  <div className="relative">
                    <div
                      className={`p-1 rounded-2xl bg-gradient-to-br from-[#0080FF] via-sky-400 to-indigo-500 ${gameRankInfo.glowRing} transition-transform duration-300 group-hover:scale-[1.02]`}
                    >
                      <div className="relative rounded-xl overflow-hidden bg-white border-2 border-white">
                        {studentAvatarUrl ? (
                          <img
                            src={studentAvatarUrl}
                            alt={studentDisplayName}
                            className="w-24 h-28 sm:w-28 sm:h-32 object-cover"
                          />
                        ) : (
                          <div className="w-24 h-28 sm:w-28 sm:h-32 bg-gradient-to-b from-[#E4F2FF] to-[#F0F7FF] text-[#0080FF] flex flex-col items-center justify-center font-bold text-2xl sm:text-3xl">
                            <span>{studentInitials || 'MH'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div
                      className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-[10px] font-semibold text-emerald-700 shadow-xs flex items-center gap-1"
                      title="Status Mahasiswa Aktif"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Aktif</span>
                    </div>
                  </div>

                  {/* Name & NIM */}
                  <h2 className="text-lg sm:text-xl font-semibold text-[#222222] tracking-tight mt-4 leading-snug">
                    {studentDisplayName}
                  </h2>

                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-[#F4F9FF] border border-[#CCE6FF] text-xs font-mono font-semibold text-[#0080FF] tabular-nums">
                    <span>NIM: {studentNim}</span>
                  </div>

                  {/* Program Studi & Rombel Metadata */}
                  <div className="w-full mt-5 grid grid-cols-2 gap-2.5 text-left">
                    <div className="p-3 rounded-xl bg-[#fafafa] border border-[#e5e7eb] relative overflow-hidden">
                      <div className="w-1 h-full bg-[#0080FF] absolute left-0 top-0" aria-hidden="true" />
                      <span className="text-[11px] uppercase tracking-wider text-[#777777] font-semibold block pl-1.5">
                        Program Studi
                      </span>
                      <span
                        className="text-xs font-semibold text-[#222222] mt-0.5 block truncate pl-1.5"
                        title={studentProdi}
                      >
                        {studentProdi}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#fafafa] border border-[#e5e7eb] relative overflow-hidden">
                      <div className="w-1 h-full bg-indigo-500 absolute left-0 top-0" aria-hidden="true" />
                      <span className="text-[11px] uppercase tracking-wider text-[#777777] font-semibold block pl-1.5">
                        Kelas / Rombel
                      </span>
                      <span className="text-xs font-semibold text-[#0080FF] mt-0.5 block truncate pl-1.5">
                        {studentRombelList.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Attendance Stats Section (Light Mode HUD) */}
              <div className="relative z-10 px-6 pb-5 pt-4 bg-[#F8FAFC] border-t border-[#E5EEF8] space-y-3.5">
                {/* Header + Sync Action + Rate */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#0080FF] shrink-0" />
                    <span className="text-xs font-semibold text-[#333333]">
                      Statistik Kehadiran
                    </span>
                    <button
                      type="button"
                      onClick={handleSyncData}
                      disabled={isSyncing}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E4F2FF] border border-[#CCE6FF] text-[11px] font-medium text-[#0080FF] hover:bg-[#CCE6FF] transition cursor-pointer"
                      title="Sinkronkan ulang relasi data kehadiran terbaru dari Dosen & Admin BAAK"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sinkron</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 tabular-nums">
                    <span className="text-xs text-[#555555] font-medium">
                      {overallRate.hadir}/{overallRate.totalSessions} Sesi
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                        overallRate.percentage >= 75
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      {overallRate.percentage}%
                    </span>
                  </div>
                </div>

                {/* Segmented Game HP / EXP Energy Bar (Light Mode) */}
                <div className="relative w-full h-2.5 bg-slate-200/80 rounded-md p-0.5 border border-slate-300/80 overflow-hidden">
                  <div
                    className={`h-full rounded-xs bg-gradient-to-r ${gameRankInfo.barGradient} transition-all duration-500`}
                    style={{ width: `${overallRate.percentage}%` }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none opacity-45"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(to right, transparent, transparent calc(10% - 1.5px), rgba(255,255,255,0.95) calc(10% - 1.5px), rgba(255,255,255,0.95) 10%)',
                    }}
                    aria-hidden="true"
                  />
                </div>

                {/* 4 Game Attribute Stat Boxes (Light Mode Pastel Surfaces) */}
                <div className="grid grid-cols-4 gap-2 text-center pt-0.5 tabular-nums">
                  <div
                    className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col items-center justify-center relative overflow-hidden"
                    title="Total Hadir Efektif (termasuk toleransi Izin < 3x & Sakit < 3x per MK)"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                      <Zap className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                      <span>Hadir</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 mt-0.5">
                      {overallRate.hadir}
                    </span>
                  </div>

                  <div
                    className="p-2 rounded-xl bg-sky-50/80 border border-sky-200 flex flex-col items-center justify-center relative overflow-hidden"
                    title="Riwayat Izin (< 3x per MK dianggap Hadir)"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-medium text-sky-700">
                      <Shield className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                      <span>Izin</span>
                    </div>
                    <span className="text-xs font-bold text-sky-800 mt-0.5">
                      {overallRate.izin}
                    </span>
                  </div>

                  <div
                    className="p-2 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-col items-center justify-center relative overflow-hidden"
                    title="Riwayat Sakit (< 3x per MK dianggap Hadir)"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-medium text-amber-700">
                      <HeartPulse className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                      <span>Sakit</span>
                    </div>
                    <span className="text-xs font-bold text-amber-800 mt-0.5">
                      {overallRate.sakit}
                    </span>
                  </div>

                  <div
                    className="p-2 rounded-xl bg-rose-50/80 border border-rose-200 flex flex-col items-center justify-center relative overflow-hidden"
                    title="Tidak Hadir (Alpha + kelebihan Izin/Sakit ≥ 3x)"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-medium text-rose-700">
                      <Skull className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                      <span>Alpha</span>
                    </div>
                    <span className="text-xs font-bold text-rose-700 mt-0.5">
                      {overallRate.alpha}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Priority Actions & Kartu Presensi Verification Panel */}
        <div className="lg:col-span-8 xl:col-span-8 flex flex-col justify-between gap-5">
          {/* Quick Actions Card */}
          <div className="frost-card p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#eeeeee]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#555555] font-medium">
                  <span>Portal Akademik Mahasiswa</span>
                  <span aria-hidden="true">·</span>
                  <span>{CAMPUS_INFO.semester}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#017171] font-mono tabular-nums">
                    Relasi Tersinkron: {lastSyncedAt} WIB
                  </span>
                  {studentRombelList.length > 1 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#7A45E5] font-semibold">Multi-Rombel</span>
                    </>
                  )}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-[#222222] tracking-tight">
                  Aksi Cepat Presensi & Layanan Akademik
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  data-frost="Button"
                  onClick={handleSyncData}
                  disabled={isSyncing}
                  className="frost-btn frost-btn-sm frost-btn-subtle frost-btn-teal"
                  title="Segarkan relasi data sesi, kehadiran, dan jadwal terbaru dari Dosen & Admin BAAK"
                >
                  <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="label">{isSyncing ? 'Menyinkronkan...' : 'Sinkronisasi Data'}</span>
                </button>

                {onOpenProfile && (
                  <button
                    type="button"
                    data-frost="Button"
                    onClick={onOpenProfile}
                    className="frost-btn frost-btn-sm frost-btn-outline frost-btn-brand"
                    title="Konfigurasi Profil & Ganti Sandi"
                  >
                    <UserCog className="w-4 h-4 text-[#0080FF] shrink-0" />
                    <span className="label">Edit Profil & Foto</span>
                  </button>
                )}
              </div>
            </div>

            {/* Priority Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                data-frost="Button"
                onClick={() => setIsScannerOpen(true)}
                className="frost-btn frost-btn-md frost-btn-solid frost-btn-brand w-full"
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span className="label">Scan QR Presensi</span>
              </button>

              <button
                type="button"
                data-frost="Button"
                onClick={() => setIsLeaveModalOpen(true)}
                className="frost-btn frost-btn-md frost-btn-outline frost-btn-brand w-full"
              >
                <FileText className="w-4 h-4 text-[#555555] shrink-0" />
                <span className="label">Ajukan Izin / Sakit</span>
              </button>

              <button
                type="button"
                data-frost="Button"
                onClick={handleGenerateKartuPresensi}
                disabled={isGeneratingPdf}
                className="frost-btn frost-btn-md frost-btn-subtle frost-btn-brand w-full"
                title="Unduh ringkasan kehadiran seluruh mata kuliah dalam file PDF Kartu Presensi Mahasiswa"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span className="label">Membuat PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4 shrink-0" />
                    <span className="label">Kartu Presensi (PDF)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Kartu Presensi Mahasiswa Feature Card (Frost-UI Blue-50 Surface Card) */}
          <div className="bg-[#E4F2FF] border border-[#CCE6FF] rounded-xl p-6 sm:p-7 text-[#222222] flex-1 flex flex-col justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#015FBD]">
                <ShieldCheck className="w-4 h-4 text-[#0080FF]" />
                <span>Verifikasi Syarat Ujian Tengah & Akhir Semester</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-[#222222]">
                Kartu Presensi Mahasiswa
              </h3>
              <p className="text-xs sm:text-sm text-[#333333] leading-relaxed">
                Unduh rekapitulasi kehadiran seluruh mata kuliah semester ini dalam 1 file PDF bernama <strong>"Kartu Presensi Mahasiswa"</strong>. Dokumen dilengkapi <strong>dua kotak kosong</strong> sebagai tempat tanda tangan Pengawas Ruang saat <strong>UTS</strong> dan <strong>UAS</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-[#CCE6FF]">
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#555555] font-medium tabular-nums">
                <span>Syarat Minimal Kehadiran: <strong className="text-[#222222]">75%</strong></span>
                <span aria-hidden="true">·</span>
                <span>
                  Kehadiran Kumulatif:{' '}
                  <strong className={overallRate.percentage >= 75 ? 'text-[#017171] font-semibold' : 'text-[#C73C3C] font-semibold'}>
                    {overallRate.percentage}% ({overallRate.percentage >= 75 ? 'Memenuhi Syarat' : 'Belum Memenuhi'})
                  </strong>
                </span>
              </div>

              <button
                type="button"
                data-frost="Button"
                onClick={handleGenerateKartuPresensi}
                disabled={isGeneratingPdf}
                className="frost-btn frost-btn-sm frost-btn-solid frost-btn-neutral shrink-0"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="label">Memproses Dokumen...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span className="label">Cetak Kartu Presensi (PDF)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Synchronization Success Notice (Frost-UI Success Callout) */}
      {syncNotice && (
        <div data-frost="Callout" className="frost-callout frost-callout-success justify-between items-center">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#009499] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[#004343]">
                Sinkronisasi Relasi Data Akademik Berhasil
              </h4>
              <p className="text-xs sm:text-sm text-[#017171] leading-relaxed">
                {syncNotice}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-frost="Button"
            onClick={() => setSyncNotice(null)}
            className="frost-btn frost-btn-xxs frost-btn-teal frost-btn-subtle shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Kartu Presensi Download Success Notice (Frost-UI Success Callout) */}
      {pdfSuccessNotice && (
        <div data-frost="Callout" className="frost-callout frost-callout-success justify-between items-center">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#009499] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[#004343]">
                Kartu Presensi Mahasiswa Berhasil Diterbitkan
              </h4>
              <p className="text-xs sm:text-sm text-[#017171] leading-relaxed">
                {pdfSuccessNotice}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-frost="Button"
            onClick={() => setPdfSuccessNotice(null)}
            className="frost-btn frost-btn-xxs frost-btn-teal frost-btn-subtle shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Quick Summary Statistics (Frost-UI Surface Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs sm:text-sm font-medium">Persentase Kehadiran</span>
            <UserCheck className="w-4 h-4 text-[#0080FF]" />
          </div>
          <div className="space-y-1.5">
            <div className={`text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums ${
              overallRate.percentage >= 75 ? 'text-[#222222]' : 'text-[#C73C3C]'
            }`}>
              {overallRate.percentage}%
            </div>
            <p className="text-xs sm:text-sm">
              {overallRate.percentage >= 75 ? (
                <span className="text-[#017171] font-medium">Memenuhi syarat ujian (≥ 75%)</span>
              ) : (
                <span className="text-[#C73C3C] font-medium">Di bawah batas minimal 75%</span>
              )}
            </p>
          </div>
        </div>

        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs sm:text-sm font-medium">Jadwal Kuliah Hari Ini</span>
            <Calendar className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-semibold text-[#222222] tracking-tight tabular-nums">
              {todayClasses.length} Kelas
            </div>
            <p className="text-xs sm:text-sm text-[#555555] truncate">
              {todayClasses.length > 0
                ? `${todayClasses.map(c => c.courseName).join(', ')}`
                : `Tidak ada perkuliahan hari ${activeDay}`}
            </p>
          </div>
        </div>

        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs sm:text-sm font-medium">Total Sesi Hadir</span>
            <Clock className="w-4 h-4 text-[#009499]" />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-semibold text-[#222222] tracking-tight tabular-nums">
              {overallRate.hadir} Pertemuan
            </div>
            <p className="text-xs sm:text-sm text-[#555555] tabular-nums">
              {overallRate.izinAsHadir + overallRate.sakitAsHadir > 0
                ? `Dari ${overallRate.totalSessions} sesi (${overallRate.rawHadir} hadir + ${overallRate.izinAsHadir + overallRate.sakitAsHadir} toleransi I/S)`
                : `Dari ${overallRate.totalSessions} total pertemuan terlaksana`}
            </p>
          </div>
        </div>

        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs sm:text-sm font-medium">Izin, Sakit &amp; Tidak Hadir</span>
            <FileText className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-semibold text-[#222222] tracking-tight tabular-nums">
              {overallRate.izin + overallRate.sakit} I/S · {overallRate.alpha} Alpha
            </div>
            <p className="text-xs sm:text-sm text-[#555555]">
              Izin &lt; 3x &amp; Sakit &lt; 3x terhitung Hadir; selebihnya Tidak Hadir
            </p>
          </div>
        </div>
      </div>

      {/* Today's Schedule Card */}
      <div className="frost-card p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#eeeeee]">
          <h3 className="text-base sm:text-lg font-semibold text-[#222222]">
            Jadwal Kuliah Hari Ini ({activeDay})
          </h3>
          <span className="text-xs sm:text-sm text-[#555555] font-mono tabular-nums">
            Jam Sistem: {simulatedTime} WIB
          </span>
        </div>

        {todayClasses.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#777777]">
            Tidak ada jadwal kuliah hari ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {todayClasses.map((item) => {
              const isNow = simulatedTime >= item.startTime && simulatedTime <= item.endTime;

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-[8px] border transition-colors flex items-center justify-between gap-4 ${
                    isNow
                      ? 'border-[#009499] bg-[#E5F6F5]/50'
                      : 'border-[#dddddd] bg-white hover:border-[#cccccc]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#555555]">
                      <span className="font-mono tabular-nums text-[#222222] font-semibold">{item.courseCode}</span>
                      <span aria-hidden="true">·</span>
                      <span>Ruang {item.room}</span>
                      {isNow && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#017171] font-semibold">
                            Sedang Berlangsung
                          </span>
                        </>
                      )}
                    </div>
                    <h4 className="text-base font-semibold text-[#222222]">
                      {item.courseName}
                    </h4>
                    <p className="text-xs sm:text-sm text-[#555555] font-medium tabular-nums">
                      {item.startTime}–{item.endTime} WIB · {item.lecturerName}
                    </p>
                  </div>

                  {isNow && (
                    <button
                      type="button"
                      data-frost="Button"
                      onClick={() => setIsScannerOpen(true)}
                      className="frost-btn frost-btn-sm frost-btn-solid frost-btn-teal"
                    >
                      <QrCode className="w-4 h-4" />
                      <span className="label">Scan QR</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Enrolled Courses & Attendance Rate Breakdown */}
      <div className="frost-card p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#eeeeee]">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-semibold text-[#222222]">
              Status Kehadiran per Mata Kuliah
            </h3>
            <p className="text-xs sm:text-sm text-[#555555]">
              Rincian kehadiran setiap mata kuliah untuk syarat ujian ≥ 75% (Izin &lt; 3x &amp; Sakit &lt; 3x dianggap Hadir; selebihnya dianggap Tidak Hadir)
            </p>
          </div>
          <button
            type="button"
            data-frost="Button"
            onClick={handleGenerateKartuPresensi}
            disabled={isGeneratingPdf}
            className="frost-btn frost-btn-sm frost-btn-subtle frost-btn-brand"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="label">Membuat PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                <span className="label">Unduh Kartu Presensi (PDF)</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {mySchedules.map((sch) => {
            const courseRate = getAttendanceRateForStudent(studentNim, sch.courseCode);

            return (
              <div
                key={sch.id}
                className="p-5 rounded-[8px] border border-[#dddddd] bg-white flex flex-col justify-between gap-4 hover:border-[#cccccc] transition"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm text-[#555555] tabular-nums">
                    <span className="font-mono font-semibold text-[#222222]">{sch.courseCode}</span>
                    <span>{sch.sks} SKS</span>
                  </div>
                  <h4 className="text-base font-semibold text-[#222222] line-clamp-1">
                    {sch.courseName}
                  </h4>
                  <p className="text-xs sm:text-sm text-[#555555] line-clamp-1">
                    {sch.lecturerName}
                  </p>
                </div>

                <div className="pt-3.5 border-t border-[#eeeeee] text-sm space-y-2.5">
                  <div className="flex items-center justify-between tabular-nums">
                    <span className="text-[#555555] text-xs font-medium">
                      Tingkat Kehadiran ({courseRate.hadir}/{courseRate.totalSessions} Sesi)
                    </span>
                    <span className={`font-semibold text-xs ${
                      courseRate.percentage >= 75 ? 'text-[#017171]' : 'text-[#C73C3C]'
                    }`}>
                      {courseRate.percentage}%
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-[#eeeeee] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        courseRate.percentage >= 75 ? 'bg-[#009499]' : 'bg-[#E54545]'
                      }`}
                      style={{ width: `${courseRate.percentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#555555] font-medium tabular-nums pt-0.5">
                    <span title="Total Hadir Efektif">Hadir: {courseRate.hadir}</span>
                    <span title="Total Izin (< 3x dianggap Hadir)">Izin: {courseRate.izin}</span>
                    <span title="Total Sakit (< 3x dianggap Hadir)">Sakit: {courseRate.sakit}</span>
                    <span title="Total Tidak Hadir (Alpha + kelebihan Izin/Sakit)">Alpha: {courseRate.alpha}</span>
                  </div>

                  {(courseRate.izinAsHadir + courseRate.sakitAsHadir > 0 || courseRate.excessIzin + courseRate.excessSakit > 0) && (
                    <div className="text-[11px] text-[#555555] bg-[#fafafa] border border-[#eeeeee] rounded px-2 py-1 tabular-nums">
                      {courseRate.rawHadir} Hadir Fisik
                      {courseRate.izinAsHadir > 0 ? ` + ${courseRate.izinAsHadir} Izin (<3x)` : ''}
                      {courseRate.sakitAsHadir > 0 ? ` + ${courseRate.sakitAsHadir} Sakit (<3x)` : ''}
                      {courseRate.excessIzin + courseRate.excessSakit > 0
                        ? ` · ${courseRate.excessIzin + courseRate.excessSakit} Kelebihan I/S → Tidak Hadir`
                        : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Personal Attendance History Table */}
      <div className="frost-card overflow-hidden p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-base sm:text-lg font-semibold text-[#222222]">
            Riwayat Presensi Personal
          </h3>

          <div className="flex items-center gap-2.5">
            <label className="text-xs sm:text-sm text-[#555555] font-medium whitespace-nowrap">Filter Mata Kuliah:</label>
            <select
              value={selectedCourseTab}
              onChange={(e) => setSelectedCourseTab(e.target.value)}
              className="frost-select frost-select-sm w-auto cursor-pointer"
            >
              <option value="ALL">Semua Mata Kuliah</option>
              {mySchedules.map(s => (
                <option key={s.id} value={s.courseCode}>{s.courseName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#dddddd] rounded-[6px]">
          <table className="w-full text-sm text-left border-collapse min-w-[580px]">
            <thead>
              <tr className="bg-[#fafafa] border-b border-[#dddddd] text-[#555555] font-semibold text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4">Waktu Presensi</th>
                <th className="py-3.5 px-4">Mata Kuliah</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Validasi</th>
                <th className="py-3.5 px-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eeeeee]">
              {displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#777777] text-sm">
                    Belum ada riwayat presensi tercatat.
                  </td>
                </tr>
              ) : (
                displayedRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#fafafa] transition-colors">
                    <td className="py-3.5 px-4 text-[#555555] tabular-nums">
                      {new Date(rec.scannedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(rec.scannedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#222222]">
                      {rec.courseName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`font-semibold text-xs ${
                        rec.status === 'HADIR' ? 'text-[#017171]' :
                        rec.status === 'IZIN' ? 'text-[#016FDE]' :
                        rec.status === 'SAKIT' ? 'text-[#DE6F01]' : 'text-[#C73C3C]'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#555555]">
                      {rec.verificationMethod === 'QR_SCAN' ? 'Scan QR' :
                       rec.verificationMethod === 'AUTO_SCHEDULE' ? 'Otomatis' :
                       rec.verificationMethod === 'MANUAL_DOSEN' ? 'Dosen' : 'Disetujui'}
                    </td>
                    <td className="py-3.5 px-4 text-[#777777]">
                      {rec.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      <LeaveRequestModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
      />
    </div>
  );
};
