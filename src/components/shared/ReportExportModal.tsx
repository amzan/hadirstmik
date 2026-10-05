import React, { useState, useEffect } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { generateAttendancePDF, generateTeachingLogPDF, ReportConfig, TeachingLogConfig } from '../../utils/pdfGenerator';
import { generateAttendanceExcel, generateTeachingLogExcel } from '../../utils/excelGenerator';
import { X, FileText, FileSpreadsheet, BookOpen, ClipboardList, Calendar } from 'lucide-react';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCourseCode?: string;
  defaultRombel?: string;
  defaultReportType?: 'attendance' | 'teachingLog';
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  defaultCourseCode,
  defaultRombel,
  defaultReportType = 'teachingLog',
}) => {
  const { courses, schedules, sessions, records, currentUser, getStudentsForRombel, getMeetingDateForSchedule } = useAttendance();

  const isDosen = currentUser.role === 'dosen';

  const [activeReportTab, setActiveReportTab] = useState<'teachingLog' | 'attendance'>(defaultReportType);

  // Strict scope: Lecturer only has access to their assigned teaching schedules
  const mySchedules = schedules.filter(
    s => s.lecturerId === currentUser.id || s.lecturerName.includes(currentUser.name)
  );

  // If lecturer, ONLY allow courses taught by this lecturer
  const allowedCourses = isDosen
    ? courses.filter(c => mySchedules.some(sch => sch.courseCode === c.code))
    : courses;

  const safeAllowedCourses = allowedCourses.length > 0 ? allowedCourses : courses;

  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(
    defaultCourseCode && safeAllowedCourses.some(c => c.code === defaultCourseCode)
      ? defaultCourseCode
      : safeAllowedCourses[0]?.code || 'MKTI0109'
  );

  // Compute available rombels specifically for the selected course taught by this lecturer
  const availableRombels = isDosen
    ? Array.from(new Set(mySchedules.filter(sch => sch.courseCode === selectedCourseCode).map(sch => sch.rombel)))
    : Array.from(new Set(schedules.filter(sch => sch.courseCode === selectedCourseCode).map(sch => sch.rombel)));

  const safeAvailableRombels = availableRombels.length > 0 ? availableRombels : ['TI 3'];

  const [selectedRombel, setSelectedRombel] = useState<string>(
    defaultRombel && safeAvailableRombels.includes(defaultRombel)
      ? defaultRombel
      : safeAvailableRombels[0] || 'TI 3'
  );

  const [selectedMonth, setSelectedMonth] = useState<string>('Oktober 2026');

  // Synchronize state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (defaultReportType) {
        setActiveReportTab(defaultReportType);
      }

      const initialCourse = defaultCourseCode && safeAllowedCourses.some(c => c.code === defaultCourseCode)
        ? defaultCourseCode
        : safeAllowedCourses[0]?.code || 'MKTI0109';
      setSelectedCourseCode(initialCourse);

      const rombels = isDosen
        ? Array.from(new Set(mySchedules.filter(sch => sch.courseCode === initialCourse).map(sch => sch.rombel)))
        : Array.from(new Set(schedules.filter(sch => sch.courseCode === initialCourse).map(sch => sch.rombel)));

      if (defaultRombel && rombels.includes(defaultRombel)) {
        setSelectedRombel(defaultRombel);
      } else if (rombels.length > 0) {
        setSelectedRombel(rombels[0]);
      }
    }
  }, [isOpen, defaultCourseCode, defaultRombel, defaultReportType]);

  // Handle course change
  const handleCourseChange = (newCourseCode: string) => {
    setSelectedCourseCode(newCourseCode);
    const newRombels = isDosen
      ? Array.from(new Set(mySchedules.filter(sch => sch.courseCode === newCourseCode).map(sch => sch.rombel)))
      : Array.from(new Set(schedules.filter(sch => sch.courseCode === newCourseCode).map(sch => sch.rombel)));

    if (newRombels.length > 0 && !newRombels.includes(selectedRombel)) {
      setSelectedRombel(newRombels[0]);
    }
  };

  if (!isOpen) return null;

  const currentCourse = safeAllowedCourses.find(c => c.code === selectedCourseCode) || safeAllowedCourses[0];

  const matchingSchedule = schedules.find(
    s => s.courseCode === selectedCourseCode && (s.rombel === selectedRombel || s.rombel.includes(selectedRombel))
  );

  // Strictly filter sessions for this course and rombel
  const courseSessions = sessions.filter(
    s => s.courseCode === selectedCourseCode && (s.rombel === selectedRombel || s.rombel.includes(selectedRombel))
  );

  // Strictly filter students enrolled in this course and rombel
  const rombelStudents = getStudentsForRombel(selectedRombel);
  const totalEnrolled = rombelStudents.length;

  // Configuration for Attendance Matrix
  const attendanceConfig: ReportConfig = {
    courseCode: currentCourse.code,
    courseName: currentCourse.name,
    lecturerName: isDosen ? currentUser.name : (matchingSchedule?.lecturerName || currentCourse.defaultLecturerName),
    lecturerNidn: isDosen ? (currentUser.nidn || currentUser.username) : undefined,
    rombel: selectedRombel,
    sks: currentCourse.sks,
    prodi: currentCourse.prodi,
    monthName: selectedMonth,
  };

  // Configuration for Teaching Log Document
  const teachingLogConfig: TeachingLogConfig = {
    courseCode: currentCourse.code,
    courseName: currentCourse.name,
    lecturerName: isDosen ? currentUser.name : (matchingSchedule?.lecturerName || currentCourse.defaultLecturerName),
    lecturerNidn: isDosen ? (currentUser.nidn || currentUser.username) : undefined,
    rombel: selectedRombel,
    sks: currentCourse.sks,
    prodi: currentCourse.prodi,
    room: matchingSchedule?.room || 'RK 2',
    day: matchingSchedule?.day || 'Senin',
    timeRange: matchingSchedule ? `${matchingSchedule.startTime}–${matchingSchedule.endTime}` : '09:00–10:40',
    academicYear: '2026/2027',
  };

  // Export handlers
  const handleExportAttendancePDF = () => {
    generateAttendancePDF(attendanceConfig, rombelStudents, courseSessions, records);
  };

  const handleExportAttendanceExcel = () => {
    generateAttendanceExcel(attendanceConfig, rombelStudents, courseSessions, records);
  };

  const handleExportTeachingLogPDF = () => {
    generateTeachingLogPDF(
      teachingLogConfig,
      matchingSchedule?.meetingDates,
      courseSessions,
      records,
      totalEnrolled
    );
  };

  const handleExportTeachingLogExcel = () => {
    generateTeachingLogExcel(
      teachingLogConfig,
      matchingSchedule?.meetingDates,
      courseSessions,
      records,
      totalEnrolled
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Ekspor Dokumen Perkuliahan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Laporan resmi perkuliahan lengkap dengan Kop Surat & Tanda Tangan Dosen
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation: Teaching Log vs Attendance Matrix */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveReportTab('teachingLog')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeReportTab === 'teachingLog'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-blue-600" />
            <span>Log Aktivitas Mengajar (BAP)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReportTab('attendance')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeReportTab === 'attendance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Rekapitulasi Presensi Mhs</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Form Filters */}
          <div className="space-y-3.5 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mata Kuliah:
              </label>
              <select
                value={selectedCourseCode}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-slate-900 text-sm"
              >
                {safeAllowedCourses.map(c => (
                  <option key={c.id} value={c.code}>
                    [{c.code}] {c.name} ({c.sks} SKS · {c.prodi})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kelas / Rombel:
                </label>
                <select
                  value={selectedRombel}
                  onChange={(e) => setSelectedRombel(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-slate-900 text-sm"
                >
                  {safeAvailableRombels.map(r => (
                    <option key={r} value={r}>Rombel {r}</option>
                  ))}
                </select>
              </div>

              {activeReportTab === 'attendance' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Periode Presensi:
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-slate-900 text-sm"
                  >
                    <option value="September 2026">September 2026</option>
                    <option value="Oktober 2026">Oktober 2026</option>
                    <option value="November 2026">November 2026</option>
                    <option value="Desember 2026">Desember 2026</option>
                    <option value="Semester Ganjil Penuh (16 Pertemuan)">Semester Penuh (16 Pertemuan)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jadwal Perkuliahan:
                  </label>
                  <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 truncate">
                    {matchingSchedule ? `${matchingSchedule.day}, ${matchingSchedule.startTime}–${matchingSchedule.endTime} WIB (${matchingSchedule.room})` : 'Jadwal Reguler'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {activeReportTab === 'teachingLog' ? (
              <>
                <button
                  type="button"
                  onClick={handleExportTeachingLogPDF}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Unduh Log Mengajar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportTeachingLogExcel}
                  className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Unduh Log Mengajar Excel</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleExportAttendancePDF}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Unduh Rekap Presensi PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAttendanceExcel}
                  className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Unduh Rekap Excel (.XLSX)</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end text-xs text-slate-500">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200/70 font-semibold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
