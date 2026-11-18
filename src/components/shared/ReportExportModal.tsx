import React, { useState, useEffect, useMemo } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { generateAttendancePDF, generateTeachingLogPDF, ReportConfig, TeachingLogConfig } from '../../utils/pdfGenerator';
import { generateAttendanceExcel, generateTeachingLogExcel } from '../../utils/excelGenerator';
import {
  X, FileText, FileSpreadsheet, BookOpen, ClipboardList, Calendar,
  CheckCircle2, Users, Layers, Filter, Clock
} from 'lucide-react';

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
  const { courses, schedules, sessions, records, currentUser, getStudentsForRombel } = useAttendance();

  const isDosen = currentUser.role === 'dosen';

  const [activeReportTab, setActiveReportTab] = useState<'teachingLog' | 'attendance'>(defaultReportType);
  const [sessionRangeFilter, setSessionRangeFilter] = useState<'ALL' | 'PRA_UTS' | 'PASCA_UTS' | 'CLOSED_ONLY'>('ALL');

  // Strict scope: Lecturer only has access to their assigned teaching schedules & sessions
  const mySchedules = useMemo(() => schedules.filter(
    s => s.lecturerId === currentUser.id || s.lecturerName.includes(currentUser.name)
  ), [schedules, currentUser]);

  const mySessions = useMemo(() => sessions.filter(
    s => s.lecturerId === currentUser.id || s.lecturerName.includes(currentUser.name)
  ), [sessions, currentUser]);

  // Build complete allowed courses list (from courses + schedules + sessions so no course is ever missing)
  const safeAllowedCourses = useMemo(() => {
    if (!isDosen) return courses;

    const map = new Map<string, { id: string; code: string; name: string; sks: number; prodi: string; defaultLecturerName: string }>();

    courses.forEach(c => {
      if (
        mySchedules.some(sch => sch.courseCode === c.code) ||
        mySessions.some(ses => ses.courseCode === c.code)
      ) {
        map.set(c.code, {
          id: c.id,
          code: c.code,
          name: c.name,
          sks: c.sks,
          prodi: c.prodi,
          defaultLecturerName: c.defaultLecturerName,
        });
      }
    });

    mySchedules.forEach(sch => {
      if (!map.has(sch.courseCode)) {
        map.set(sch.courseCode, {
          id: `course-${sch.courseCode}`,
          code: sch.courseCode,
          name: sch.courseName,
          sks: sch.sks,
          prodi: sch.prodi,
          defaultLecturerName: sch.lecturerName,
        });
      }
    });

    mySessions.forEach(ses => {
      if (!map.has(ses.courseCode)) {
        map.set(ses.courseCode, {
          id: `course-${ses.courseCode}`,
          code: ses.courseCode,
          name: ses.courseName,
          sks: 2,
          prodi: currentUser.prodi || 'Teknologi Informasi',
          defaultLecturerName: ses.lecturerName,
        });
      }
    });

    const list = Array.from(map.values());
    return list.length > 0 ? list : courses;
  }, [isDosen, courses, mySchedules, mySessions, currentUser.prodi]);

  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(
    defaultCourseCode && safeAllowedCourses.some(c => c.code === defaultCourseCode)
      ? defaultCourseCode
      : safeAllowedCourses[0]?.code || 'MKTI0109'
  );

  // Compute available rombels specifically for the selected course
  const safeAvailableRombels = useMemo(() => {
    const rombelSet = new Set<string>();
    const targetSchedules = isDosen
      ? mySchedules.filter(sch => sch.courseCode === selectedCourseCode)
      : schedules.filter(sch => sch.courseCode === selectedCourseCode);
    const targetSessions = isDosen
      ? mySessions.filter(ses => ses.courseCode === selectedCourseCode)
      : sessions.filter(ses => ses.courseCode === selectedCourseCode);

    targetSchedules.forEach(sch => {
      if (sch.rombel) rombelSet.add(sch.rombel);
    });
    targetSessions.forEach(ses => {
      if (ses.rombel) rombelSet.add(ses.rombel);
    });

    const arr = Array.from(rombelSet);
    return arr.length > 0 ? arr : ['TI 3'];
  }, [isDosen, mySchedules, schedules, mySessions, sessions, selectedCourseCode]);

  const [selectedRombel, setSelectedRombel] = useState<string>(
    defaultRombel && safeAvailableRombels.includes(defaultRombel)
      ? defaultRombel
      : safeAvailableRombels[0] || 'TI 3'
  );

  const [selectedMonth, setSelectedMonth] = useState<string>('Semester Ganjil Penuh (16 Pertemuan)');

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

      const rombelSet = new Set<string>();
      const targetSchedules = isDosen
        ? mySchedules.filter(sch => sch.courseCode === initialCourse)
        : schedules.filter(sch => sch.courseCode === initialCourse);
      const targetSessions = isDosen
        ? mySessions.filter(ses => ses.courseCode === initialCourse)
        : sessions.filter(ses => ses.courseCode === initialCourse);

      targetSchedules.forEach(sch => {
        if (sch.rombel) rombelSet.add(sch.rombel);
      });
      targetSessions.forEach(ses => {
        if (ses.rombel) rombelSet.add(ses.rombel);
      });
      const rombels = Array.from(rombelSet);

      if (defaultRombel && rombels.includes(defaultRombel)) {
        setSelectedRombel(defaultRombel);
      } else if (rombels.length > 0) {
        setSelectedRombel(rombels[0]);
      }
      setSessionRangeFilter('ALL');
    }
  }, [isOpen, defaultCourseCode, defaultRombel, defaultReportType, safeAllowedCourses, isDosen, mySchedules, schedules, mySessions, sessions]);

  // Handle course change
  const handleCourseChange = (newCourseCode: string) => {
    setSelectedCourseCode(newCourseCode);
    const rombelSet = new Set<string>();
    const targetSchedules = isDosen
      ? mySchedules.filter(sch => sch.courseCode === newCourseCode)
      : schedules.filter(sch => sch.courseCode === newCourseCode);
    const targetSessions = isDosen
      ? mySessions.filter(ses => ses.courseCode === newCourseCode)
      : sessions.filter(ses => ses.courseCode === newCourseCode);

    targetSchedules.forEach(sch => {
      if (sch.rombel) rombelSet.add(sch.rombel);
    });
    targetSessions.forEach(ses => {
      if (ses.rombel) rombelSet.add(ses.rombel);
    });
    const newRombels = Array.from(rombelSet);

    if (newRombels.length > 0 && !newRombels.includes(selectedRombel)) {
      setSelectedRombel(newRombels[0]);
    }
  };

  if (!isOpen) return null;

  const currentCourse = safeAllowedCourses.find(c => c.code === selectedCourseCode) || safeAllowedCourses[0];

  const matchingSchedule = schedules.find(
    s => s.courseCode === selectedCourseCode && (s.rombel === selectedRombel || s.rombel.includes(selectedRombel))
  );

  // All sessions for this course and rombel
  const allCourseSessions = sessions
    .filter(
      s => s.courseCode === selectedCourseCode && (s.rombel === selectedRombel || s.rombel.includes(selectedRombel))
    )
    .sort((a, b) => a.meetingNumber - b.meetingNumber);

  // Filtered sessions based on classification filter
  const courseSessions = allCourseSessions.filter(s => {
    if (sessionRangeFilter === 'PRA_UTS') return s.meetingNumber >= 1 && s.meetingNumber <= 8;
    if (sessionRangeFilter === 'PASCA_UTS') return s.meetingNumber >= 9 && s.meetingNumber <= 16;
    if (sessionRangeFilter === 'CLOSED_ONLY') return !s.isOpen;
    return true;
  });

  // Strictly filter students enrolled in this course and rombel
  const rombelStudents = getStudentsForRombel(selectedRombel);
  const totalEnrolled = rombelStudents.length;

  // Calculate attendance rate for the selected course & sessions
  const courseSessionIds = courseSessions.map(s => s.id);
  const courseRecords = records.filter(r => courseSessionIds.includes(r.sessionId));
  const hadirRecordsCount = courseRecords.filter(r => r.status === 'HADIR').length;
  const totalExpected = courseSessions.length * Math.max(totalEnrolled, 1);
  const courseAttendancePercentage = courseSessions.length > 0
    ? Math.min(100, Math.round((hadirRecordsCount / totalExpected) * 100))
    : 0;

  const rangeLabel =
    sessionRangeFilter === 'PRA_UTS'
      ? 'Pra-UTS (Pertemuan 1–8)'
      : sessionRangeFilter === 'PASCA_UTS'
      ? 'Pasca-UTS / UAS (Pertemuan 9–16)'
      : sessionRangeFilter === 'CLOSED_ONLY'
      ? 'Sesi Selesai / Ditutup'
      : selectedMonth;

  // Configuration for Attendance Matrix
  const attendanceConfig: ReportConfig = {
    courseCode: currentCourse.code,
    courseName: currentCourse.name,
    lecturerName: isDosen ? currentUser.name : (matchingSchedule?.lecturerName || currentCourse.defaultLecturerName),
    lecturerNidn: isDosen ? (currentUser.nidn || currentUser.username) : undefined,
    rombel: selectedRombel,
    sks: currentCourse.sks,
    prodi: currentCourse.prodi,
    monthName: rangeLabel,
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
    room: matchingSchedule?.room || allCourseSessions[0]?.room || 'RK 2',
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Ekspor Laporan Perkuliahan Terklasifikasi
              </h3>
              <span className="px-2 py-0.5 text-[11px] font-bold bg-slate-900 text-white rounded-md font-mono">
                {currentCourse.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih tab mata kuliah & klasifikasi sesi untuk mengunduh BAP atau Rekap Presensi resmi
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Pemisah Mata Kuliah (Course Classification Tabs) */}
        <div className="px-5 pt-3 pb-2.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-700" />
              <span>Tab Klasifikasi Mata Kuliah ({safeAllowedCourses.length})</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Klik tab untuk beralih mata kuliah
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {safeAllowedCourses.map(course => {
              const isSelected = course.code === selectedCourseCode;
              const countForCourse = sessions.filter(s => s.courseCode === course.code).length;
              return (
                <button
                  key={course.code}
                  type="button"
                  onClick={() => handleCourseChange(course.code)}
                  className={`px-3 py-2 rounded-xl border text-left transition shrink-0 flex items-center gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {course.code}
                      </span>
                      <span className="text-xs font-bold truncate max-w-[160px]">
                        {course.name}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {countForCourse} Sesi
                  </span>
                </button>
              );
            })}
          </div>
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
          {/* Rombel & Period / Classification Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kelas / Rombel:
              </label>
              {safeAvailableRombels.length > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  {safeAvailableRombels.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRombel(r)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer flex-1 ${
                        selectedRombel === r
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Rombel {r}
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  value={selectedRombel}
                  onChange={(e) => setSelectedRombel(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-slate-900 text-sm"
                >
                  {safeAvailableRombels.map(r => (
                    <option key={r} value={r}>Rombel {r}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Filter Klasifikasi Sesi Pertemuan:
              </label>
              <select
                value={sessionRangeFilter}
                onChange={(e) => setSessionRangeFilter(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-slate-900 text-sm cursor-pointer"
              >
                <option value="ALL">Semua Sesi Pertemuan ({allCourseSessions.length} Sesi)</option>
                <option value="PRA_UTS">Klasifikasi Pra-UTS (Pertemuan 1–8)</option>
                <option value="PASCA_UTS">Klasifikasi Pasca-UTS / UAS (Pertemuan 9–16)</option>
                <option value="CLOSED_ONLY">Hanya Sesi Selesai / Ditutup</option>
              </select>
            </div>
          </div>

          {activeReportTab === 'attendance' && sessionRangeFilter === 'ALL' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Label Periode pada Kop Laporan:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-slate-900 text-sm cursor-pointer"
              >
                <option value="Semester Ganjil Penuh (16 Pertemuan)">Semester Ganjil Penuh (16 Pertemuan)</option>
                <option value="September 2026">September 2026</option>
                <option value="Oktober 2026">Oktober 2026</option>
                <option value="November 2026">November 2026</option>
                <option value="Desember 2026">Desember 2026</option>
              </select>
            </div>
          )}

          {/* Ringkasan & Preview Klasifikasi Riwayat Sesi */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-700" />
                  <span>Pratinjau Riwayat Sesi: {currentCourse.name}</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {matchingSchedule
                    ? `${matchingSchedule.day}, ${matchingSchedule.startTime}–${matchingSchedule.endTime} WIB · Ruang ${matchingSchedule.room}`
                    : `Rombel ${selectedRombel} · ${currentCourse.sks} SKS`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800">
                  {courseSessions.length} Sesi Tercakup
                </span>
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800">
                  {totalEnrolled} Mhs
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-bold">
                  {courseAttendancePercentage}% Hadir
                </span>
              </div>
            </div>

            {courseSessions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                Belum ada riwayat sesi pada klasifikasi ini. Laporan tetap dapat diunduh sebagai formulir standar 16 pertemuan.
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-200/70 bg-white border border-slate-200 rounded-lg">
                {courseSessions.map((ses) => {
                  const sesHadir = records.filter(r => r.sessionId === ses.id && r.status === 'HADIR').length;
                  return (
                    <div key={ses.id} className="px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 bg-slate-900 text-white font-bold rounded text-[11px] shrink-0">
                          P-{ses.meetingNumber}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {ses.topic || `Perkuliahan Pertemuan ${ses.meetingNumber}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-2 text-slate-600">
                        <span className="font-mono text-[11px]">{ses.date}</span>
                        <span className="font-bold text-slate-900">
                          {sesHadir}/{totalEnrolled} Hadir
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          ses.isOpen
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ses.isOpen ? 'Terbuka' : 'Selesai'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {activeReportTab === 'teachingLog' ? (
              <>
                <button
                  type="button"
                  onClick={handleExportTeachingLogPDF}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Unduh Log Mengajar PDF ({currentCourse.code})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportTeachingLogExcel}
                  className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Unduh Log Mengajar Excel ({currentCourse.code})</span>
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
                  <span>Unduh Rekap Presensi PDF ({currentCourse.code})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAttendanceExcel}
                  className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Unduh Rekap Excel ({currentCourse.code})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mata Kuliah Aktif: <strong className="text-slate-800">{currentCourse.name} ({selectedRombel})</strong>
          </span>
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

