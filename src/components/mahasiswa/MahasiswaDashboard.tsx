import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { QrScannerModal } from './QrScannerModal';
import { LeaveRequestModal } from './LeaveRequestModal';
import { isStudentInRombel, getStudentRombelList, getStudentEnrolledSchedules, CAMPUS_INFO } from '../../data/initialData';
import {
  generateKartuPresensiPDF,
  KartuPresensiCourseItem,
  KartuPresensiStudentData
} from '../../utils/pdfGenerator';
import {
  QrCode, FileText, Calendar, UserCheck, Clock, UserCog, FileDown, CheckCircle2, Loader2, ShieldCheck, Printer
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
      // Build summary data for all enrolled courses
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Clean Minimalist Header: Profile, Rate & Primary Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 font-medium">
            <span>Mahasiswa</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-700 font-semibold">NIM {studentNim}</span>
            <span aria-hidden="true">·</span>
            <div className="inline-flex items-center gap-1.5 flex-wrap">
              <span>Rombel:</span>
              {studentRombelList.map(r => (
                <span key={r} className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-200">
                  {r}
                </span>
              ))}
              {studentRombelList.length > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold text-[10px]">
                  Multi-Rombel
                </span>
              )}
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tracking-tight">
            {currentUser.name}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mt-1.5 font-medium">
            <span>Kehadiran: <strong className={overallRate.percentage >= 75 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{overallRate.percentage}%</strong></span>
            <span aria-hidden="true">·</span>
            <span>Hadir {overallRate.hadir}</span>
            <span aria-hidden="true">·</span>
            <span>Izin {overallRate.izin}</span>
            <span aria-hidden="true">·</span>
            <span>Sakit {overallRate.sakit}</span>
            <span aria-hidden="true">·</span>
            <span>Alpha {overallRate.alpha}</span>
          </div>
        </div>

        {/* Priority Actions */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-none justify-center px-4 sm:px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR Presensi</span>
          </button>

          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Ajukan Izin / Sakit</span>
          </button>

          <button
            onClick={handleGenerateKartuPresensi}
            disabled={isGeneratingPdf}
            className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-60"
            title="Generate ringkasan jumlah kehadiran semua mata kuliah dalam file PDF 'Kartu Presensi Mahasiswa' untuk verifikasi kehadiran UTS dan UAS"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                <span>Membuat PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-indigo-600" />
                <span>Kartu Presensi (PDF)</span>
              </>
            )}
          </button>

          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="flex-1 sm:flex-none justify-center px-3.5 sm:px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs"
              title="Konfigurasi Profil & Ganti Password dengan OTP Email"
            >
              <UserCog className="w-4 h-4 text-blue-600" />
              <span>Profil Saya</span>
            </button>
          )}
        </div>
      </div>

      {/* Kartu Presensi Download Success Notice */}
      {pdfSuccessNotice && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-start justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-emerald-100 rounded-xl text-emerald-700 shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">
                Kartu Presensi Mahasiswa Berhasil Diterbitkan
              </h4>
              <p className="text-xs sm:text-sm text-emerald-800 mt-0.5 leading-relaxed">
                {pdfSuccessNotice}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPdfSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Kartu Presensi Mahasiswa Feature Card */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-sm border border-indigo-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
            <span>Verifikasi Syarat Ujian Tengah & Akhir Semester</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight">
            Kartu Presensi Mahasiswa
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Unduh rekapitulasi kehadiran seluruh mata kuliah semester ini dalam 1 file PDF bernama <strong>"Kartu Presensi Mahasiswa"</strong>. Dokumen dilengkapi <strong>dua kotak kosong</strong> sebagai tempat untuk ditandatangani oleh Pengawas Ruang untuk verifikasi kehadiran saat <strong>UTS</strong> dan <strong>UAS</strong>.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-indigo-200 font-medium">
            <span>• Syarat Minimal Kehadiran: <strong className="text-white">75%</strong></span>
            <span>• Kehadiran Kumulatif: <strong className={overallRate.percentage >= 75 ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>{overallRate.percentage}% ({overallRate.percentage >= 75 ? 'Memenuhi Syarat' : 'Belum Memenuhi'})</strong></span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
          <button
            onClick={handleGenerateKartuPresensi}
            disabled={isGeneratingPdf}
            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Dokumen...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Cetak Kartu Presensi (PDF)</span>
              </>
            )}
          </button>
          <span className="text-[11px] text-center text-slate-400 font-medium">
            2 Kotak Verifikasi UTS & UAS Tersedia
          </span>
        </div>
      </div>

      {/* Quick Summary Statistics Component for Mahasiswa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Overall Attendance Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Persentase Kehadiran</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              overallRate.percentage >= 75 ? 'text-slate-900' : 'text-rose-700'
            }`}>
              {overallRate.percentage}%
            </div>
            <p className="text-sm mt-1">
              {overallRate.percentage >= 75 ? (
                <span className="text-emerald-700 font-medium">✓ Memenuhi syarat ujian (≥ 75%)</span>
              ) : (
                <span className="text-rose-700 font-medium">⚠ Di bawah batas minimal 75%</span>
              )}
            </p>
          </div>
        </div>

        {/* Stat 2: Classes Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Jadwal Kuliah Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {todayClasses.length} Kelas
            </div>
            <p className="text-sm text-slate-500 mt-1 truncate">
              {todayClasses.length > 0
                ? `${todayClasses.map(c => c.courseName).join(', ')}`
                : `Tidak ada perkuliahan hari ${activeDay}`}
            </p>
          </div>
        </div>

        {/* Stat 3: Total Sessions Present */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Total Sesi Hadir</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {overallRate.hadir} Pertemuan
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Dari {overallRate.totalSessions} total pertemuan yang terlaksana
            </p>
          </div>
        </div>

        {/* Stat 4: Izin, Sakit & Alpha */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Izin, Sakit & Alpha</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {overallRate.izin + overallRate.sakit} Izin · {overallRate.alpha} Alpha
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {overallRate.alpha === 0
                ? 'Tanpa catatan alpha semester ini'
                : 'Alpha tercatat karena batas waktu scan berakhir'}
            </p>
          </div>
        </div>
      </div>

      {/* Today's Schedule Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Jadwal Kuliah Hari Ini ({activeDay})
          </h3>
          <span className="text-sm text-slate-500 font-medium">
            Jam Sistem: {simulatedTime} WIB
          </span>
        </div>

        {todayClasses.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            Tidak ada jadwal kuliah hari ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayClasses.map((item) => {
              const isNow = simulatedTime >= item.startTime && simulatedTime <= item.endTime;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-colors flex items-center justify-between gap-4 ${
                    isNow
                      ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span className="font-mono text-slate-900 font-semibold">{item.courseCode}</span>
                      <span aria-hidden="true">·</span>
                      <span>Ruang {item.room}</span>
                      {isNow && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 font-semibold flex items-center gap-1.5 text-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Sedang Berlangsung
                          </span>
                        </>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mt-1">
                      {item.courseName}
                    </h4>
                    <p className="text-sm text-slate-600 mt-0.5 font-medium">
                      {item.startTime}–{item.endTime} WIB · {item.lecturerName}
                    </p>
                  </div>

                  {isNow && (
                    <button
                      onClick={() => setIsScannerOpen(true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Scan QR</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Enrolled Courses & Attendance Rate breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Status Kehadiran per Mata Kuliah
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rincian kehadiran di setiap mata kuliah untuk pemenuhan syarat ujian (≥ 75%)
            </p>
          </div>
          <button
            onClick={handleGenerateKartuPresensi}
            disabled={isGeneratingPdf}
            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-60"
            title="Unduh 1 file PDF Kartu Presensi Mahasiswa yang merangkum semua mata kuliah"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                <span>Membuat PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5 text-indigo-600" />
                <span>Unduh Kartu Presensi (PDF)</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mySchedules.map((sch) => {
            const courseRate = getAttendanceRateForStudent(studentNim, sch.courseCode);

            return (
              <div
                key={sch.id}
                className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span className="font-mono font-semibold text-slate-800">{sch.courseCode}</span>
                    <span>{sch.sks} SKS</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-1.5 line-clamp-1">
                    {sch.courseName}
                  </h4>
                  <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">
                    {sch.lecturerName}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-500 font-medium">Tingkat Kehadiran:</span>
                    <span className={`font-bold ${
                      courseRate.percentage >= 75 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {courseRate.percentage}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        courseRate.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${courseRate.percentage}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mt-2 font-medium">
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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Riwayat Presensi Personal
          </h3>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 font-medium">Filter MK:</label>
            <select
              value={selectedCourseTab}
              onChange={(e) => setSelectedCourseTab(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer"
            >
              <option value="ALL">Semua Mata Kuliah</option>
              {mySchedules.map(s => (
                <option key={s.id} value={s.courseCode}>{s.courseName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[580px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Waktu Presensi</th>
                <th className="py-3 px-4">Mata Kuliah</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Validasi</th>
                <th className="py-3 px-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                    Belum ada riwayat presensi tercatat.
                  </td>
                </tr>
              ) : (
                displayedRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 text-slate-700">
                      {new Date(rec.scannedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(rec.scannedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {rec.courseName}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${
                        rec.status === 'HADIR' ? 'text-emerald-700' :
                        rec.status === 'IZIN' ? 'text-blue-700' :
                        rec.status === 'SAKIT' ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {rec.verificationMethod === 'QR_SCAN' ? 'Scan QR' :
                       rec.verificationMethod === 'AUTO_SCHEDULE' ? 'Otomatis' :
                       rec.verificationMethod === 'MANUAL_DOSEN' ? 'Dosen' : 'Disetujui'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
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
