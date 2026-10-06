import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { QrScannerModal } from './QrScannerModal';
import { LeaveRequestModal } from './LeaveRequestModal';
import { isStudentInRombel } from '../../data/initialData';
import {
  QrCode, FileText, Calendar, UserCheck, Clock, UserCog
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
    activeDay,
    simulatedTime,
    getAttendanceRateForStudent
  } = useAttendance();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedCourseTab, setSelectedCourseTab] = useState<string>('ALL');

  const studentNim = currentUser.username;
  const studentRombel = currentUser.rombel || 'TI 3';

  // Overall attendance rate
  const overallRate = getAttendanceRateForStudent(studentNim);

  // Filter personal attendance records (STRICT: only their own records)
  const myRecords = records.filter(r => r.studentNim === studentNim);
  
  // Enrolled schedules for this student's rombel
  const mySchedules = schedules.filter(s => isStudentInRombel(studentRombel, s.rombel));

  // Today's classes
  const todayClasses = mySchedules.filter(s => s.day === activeDay);

  // Filter records by selected course
  const displayedRecords = myRecords.filter(r => {
    if (selectedCourseTab === 'ALL') return true;
    return r.courseCode === selectedCourseTab;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Clean Minimalist Header: Profile, Rate & Primary Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <span>Mahasiswa</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-700 font-semibold">NIM {studentNim}</span>
            <span aria-hidden="true">·</span>
            <span>Rombel {studentRombel}</span>
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
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
          Status Kehadiran per Mata Kuliah
        </h3>

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
