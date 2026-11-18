import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { QrScannerModal } from './QrScannerModal';
import { LeaveRequestModal } from './LeaveRequestModal';
import { getStudentRombelList, getStudentEnrolledSchedules, CAMPUS_INFO } from '../../data/initialData';
import {
  generateKartuPresensiPDF,
  KartuPresensiCourseItem,
  KartuPresensiStudentData
} from '../../utils/pdfGenerator';
import {
  QrCode, FileText, Calendar, UserCheck, Clock, UserCog, FileDown, CheckCircle2, Loader2, ShieldCheck
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
    schedules,
    students,
    activeDay,
    simulatedTime,
    getAttendanceRateForStudent
  } = useAttendance();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedCourseTab, setSelectedCourseTab] = useState<string>('ALL');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState<string | null>(null);

  const studentNim = currentUser.username;
  const studentRombelList = (currentUser.rombels && currentUser.rombels.length > 0)
    ? currentUser.rombels
    : getStudentRombelList(currentUser.rombel || 'TI 3');

  // Overall attendance rate
  const overallRate = getAttendanceRateForStudent(studentNim);

  // Filter personal attendance records (STRICT: only their own records)
  const myRecords = records.filter(r => r.studentNim === studentNim);

  // Enrolled schedules for this student, respecting any individual exclusions
  const matchedStudent = students.find(s => s.nim.toUpperCase() === studentNim.toUpperCase());
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
        name: currentUser.name,
        prodi: currentUser.prodi || matchedStudent?.prodi || 'Teknologi Informasi',
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

  const studentProdi = currentUser.prodi || matchedStudent?.prodi || 'Teknologi Informasi';
  const studentAvatarUrl = currentUser.avatarUrl;
  const studentInitials = currentUser.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Top 2-Column Section: Left = Portrait Student ID Card, Right = Quick Actions & Kartu Presensi Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Portrait Student ID Card (Rounded Corner) */}
        <div className="lg:col-span-4 xl:col-span-4 flex">
          <div className="w-full bg-white border border-[#dddddd] rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs">
            {/* ID Card Top Lanyard Slot & Institution Header */}
            <div>
              <div className="bg-[#0080FF] px-5 pt-4 pb-12 text-white relative">
                {/* Lanyard punch hole */}
                <div className="w-12 h-2 bg-white/30 rounded-full mx-auto mb-3.5" aria-hidden="true" />
                <div className="flex items-center justify-center gap-2 text-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-white/85">
                      Kartu Identitas Mahasiswa
                    </p>
                    <h3 className="text-xs sm:text-sm font-bold tracking-tight text-white leading-snug">
                      {CAMPUS_INFO.name}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Portrait Profile Photo & Identity Details */}
              <div className="px-6 pb-5 -mt-9 flex flex-col items-center text-center">
                <div className="relative">
                  {studentAvatarUrl ? (
                    <img
                      src={studentAvatarUrl}
                      alt={currentUser.name}
                      className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl object-cover border-4 border-white bg-[#f5f5f5] shadow-xs"
                    />
                  ) : (
                    <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl border-4 border-white bg-[#E4F2FF] text-[#0080FF] flex flex-col items-center justify-center font-bold text-xl sm:text-2xl shadow-xs">
                      <span>{studentInitials || 'MH'}</span>
                    </div>
                  )}
                  <span
                    className="w-3.5 h-3.5 rounded-full bg-[#009499] border-2 border-white absolute -bottom-1 -right-1"
                    title="Status Mahasiswa Aktif"
                  />
                </div>

                {/* Name & NIM */}
                <h2 className="text-lg sm:text-xl font-bold text-[#222222] tracking-tight mt-3 leading-snug">
                  {currentUser.name}
                </h2>
                <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-[#f5f5f5] border border-[#dddddd] text-xs font-mono font-semibold text-[#222222] tabular-nums">
                  <span>NIM: {studentNim}</span>
                </div>

                {/* Program Studi & Rombel Metadata */}
                <div className="w-full mt-4 pt-3.5 border-t border-[#eeeeee] grid grid-cols-2 gap-2 text-left">
                  <div className="p-2.5 rounded-lg bg-[#fafafa] border border-[#eeeeee]">
                    <span className="text-[10px] uppercase tracking-wider text-[#777777] font-semibold block">
                      Program Studi
                    </span>
                    <span className="text-xs font-semibold text-[#222222] mt-0.5 block truncate" title={studentProdi}>
                      {studentProdi}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#fafafa] border border-[#eeeeee]">
                    <span className="text-[10px] uppercase tracking-wider text-[#777777] font-semibold block">
                      Kelas / Rombel
                    </span>
                    <span className="text-xs font-semibold text-[#222222] mt-0.5 block truncate">
                      {studentRombelList.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ID Card Bottom Section: Attendance Statistics */}
            <div className="px-6 pb-5 pt-3 border-t border-[#eeeeee] bg-[#fafafa] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#555555]">
                  Statistik Kehadiran
                </span>
                <span className={`text-sm font-bold tabular-nums ${
                  overallRate.percentage >= 75 ? 'text-[#017171]' : 'text-[#C73C3C]'
                }`}>
                  {overallRate.percentage}%
                </span>
              </div>

              <div className="w-full h-1.5 bg-[#e5e5e5] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    overallRate.percentage >= 75 ? 'bg-[#009499]' : 'bg-[#E54545]'
                  }`}
                  style={{ width: `${overallRate.percentage}%` }}
                />
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-center pt-0.5 tabular-nums">
                <div className="p-1.5 rounded-lg bg-white border border-[#dddddd]">
                  <span className="text-[10px] text-[#555555] font-medium block">Hadir</span>
                  <span className="text-xs font-bold text-[#017171]">{overallRate.hadir}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-white border border-[#dddddd]">
                  <span className="text-[10px] text-[#555555] font-medium block">Izin</span>
                  <span className="text-xs font-bold text-[#222222]">{overallRate.izin}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-white border border-[#dddddd]">
                  <span className="text-[10px] text-[#555555] font-medium block">Sakit</span>
                  <span className="text-xs font-bold text-[#222222]">{overallRate.sakit}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-white border border-[#dddddd]">
                  <span className="text-[10px] text-[#555555] font-medium block">Alpha</span>
                  <span className="text-xs font-bold text-[#C73C3C]">{overallRate.alpha}</span>
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

              {onOpenProfile && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onOpenProfile}
                  className="frost-btn frost-btn-sm frost-btn-outline frost-btn-brand self-start sm:self-auto"
                  title="Konfigurasi Profil & Ganti Sandi"
                >
                  <UserCog className="w-4 h-4 text-[#0080FF] shrink-0" />
                  <span className="label">Edit Profil & Foto</span>
                </button>
              )}
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
              Dari {overallRate.totalSessions} total pertemuan terlaksana
            </p>
          </div>
        </div>

        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs sm:text-sm font-medium">Izin, Sakit & Alpha</span>
            <FileText className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-semibold text-[#222222] tracking-tight tabular-nums">
              {overallRate.izin + overallRate.sakit} Izin · {overallRate.alpha} Alpha
            </div>
            <p className="text-xs sm:text-sm text-[#555555]">
              {overallRate.alpha === 0
                ? 'Tanpa catatan alpha semester ini'
                : 'Alpha tercatat saat batas waktu scan berakhir'}
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
              Rincian kehadiran setiap mata kuliah untuk pemenuhan syarat ujian (≥ 75%)
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
                    <span className="text-[#555555] text-xs font-medium">Tingkat Kehadiran</span>
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
                    <span>Hadir: {courseRate.hadir}</span>
                    <span>Izin: {courseRate.izin}</span>
                    <span>Sakit: {courseRate.sakit}</span>
                    <span>Alpha: {courseRate.alpha}</span>
                  </div>
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
