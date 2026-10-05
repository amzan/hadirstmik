import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceSession, ScheduleItem, AttendanceStatus } from '../../types/attendance';
import { QrSessionModal } from './QrSessionModal';
import { CreateSessionModal } from './CreateSessionModal';
import { ManualAttendanceModal } from './ManualAttendanceModal';
import { ReportExportModal } from '../shared/ReportExportModal';
import { ScheduleCalendar } from '../shared/ScheduleCalendar';
import { CloseSessionDialog } from './CloseSessionDialog';
import { MeetingDatesModal } from './MeetingDatesModal';
import { BukaSesiModal } from './BukaSesiModal';
import { DosenProfileModal } from './DosenProfileModal';
import {
  QrCode, Plus, Download, Users, Clock, MapPin,
  Calendar, FileText, Check, Search, UserCheck, BookOpen, Lock, Play, UserCog
} from 'lucide-react';

export const DosenDashboard: React.FC = () => {
  const {
    currentUser,
    sessions,
    records,
    schedules,
    courses,
    students,
    leaveRequests,
    reviewLeaveRequest,
    manualUpdateAttendance,
    markStudentAttendanceDirectly,
    closeSession,
    createSession,
    getStudentsForRombel,
    activeDay,
    simulatedTime,
    setScheduleMeetingDate,
    getMeetingDateForSchedule,
  } = useAttendance();

  // Modals
  const [selectedSessionIdForQr, setSelectedSessionIdForQr] = useState<string | null>(null);
  const selectedSessionForQr = sessions.find(s => s.id === selectedSessionIdForQr) || null;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSessionId, setManualSessionId] = useState<string | null>(null);
  const [scheduleToStart, setScheduleToStart] = useState<ScheduleItem | null>(null);
  const [sessionToClose, setSessionToClose] = useState<AttendanceSession | null>(null);
  const [selectedMeetingByCourse, setSelectedMeetingByCourse] = useState<Record<string, number>>({});
  const [scheduleForMeetingDates, setScheduleForMeetingDates] = useState<ScheduleItem | null>(null);
  const [scheduleForBukaSesi, setScheduleForBukaSesi] = useState<ScheduleItem | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [exportCourseCode, setExportCourseCode] = useState<string>('MKTI0109');
  const [exportRombel, setExportRombel] = useState<string>('TI 3');
  const [exportReportType, setExportReportType] = useState<'attendance' | 'teachingLog'>('teachingLog');

  // Helper to get or default the meeting number for a course
  const getSelectedMeetingForCourse = (sch: ScheduleItem): number => {
    if (selectedMeetingByCourse[sch.id]) {
      return selectedMeetingByCourse[sch.id];
    }
    const openSes = sessions.find(s => s.courseCode === sch.courseCode && s.rombel === sch.rombel && s.isOpen);
    if (openSes) {
      return openSes.meetingNumber;
    }
    const courseSessions = sessions.filter(s => s.courseCode === sch.courseCode && s.rombel === sch.rombel);
    if (courseSessions.length > 0) {
      const maxMeeting = Math.max(...courseSessions.map(s => s.meetingNumber));
      return Math.min(maxMeeting + 1, 16);
    }
    return 1;
  };

  const handleSelectMeeting = (schId: string, meetingNum: number) => {
    setSelectedMeetingByCourse(prev => ({
      ...prev,
      [schId]: meetingNum,
    }));
  };

  // Tabs: Courses first by priority
  const [activeTab, setActiveTab] = useState<'courses' | 'sessions' | 'students' | 'leave'>('courses');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');
  const [courseDayFilter, setCourseDayFilter] = useState<string>('ALL');
  const [courseViewMode, setCourseViewMode] = useState<'cards' | 'calendar'>('cards');
  const [searchStudent, setSearchStudent] = useState<string>('');

  // Data filters
  const mySessions = sessions.filter(s => s.lecturerId === currentUser.id || s.lecturerName.includes(currentUser.name));
  const activeSessions = mySessions.filter(s => s.isOpen);
  const mySchedules = schedules.filter(s => s.lecturerId === currentUser.id);
  const myLeaveRequests = leaveRequests.filter(req => mySchedules.some(sch => sch.courseCode === req.courseCode));

  const handleOpenScheduleSession = (schedule: ScheduleItem) => {
    setScheduleForBukaSesi(schedule);
  };

  const handleSessionCreated = (sessionId: string) => {
    setSelectedSessionIdForQr(sessionId);
  };

  // Direct handlers for course-based attendance with chosen meeting number
  const handleOpenQrForCourse = (sch: ScheduleItem) => {
    const meetingNum = getSelectedMeetingForCourse(sch);
    let target = sessions.find(
      s => s.courseCode === sch.courseCode && s.rombel === sch.rombel && s.meetingNumber === meetingNum
    );

    if (target) {
      setSelectedSessionIdForQr(target.id);
    } else {
      const newSession = createSession({
        scheduleId: sch.id,
        courseCode: sch.courseCode,
        courseName: sch.courseName,
        rombel: sch.rombel,
        room: sch.room,
        meetingNumber: meetingNum,
        topic: `Perkuliahan Pertemuan ${meetingNum}: ${sch.courseName}`,
        isDynamicQr: true,
      });
      setSelectedSessionIdForQr(newSession.id);
    }
  };

  const handleOpenManualForCourse = (sch: ScheduleItem) => {
    const meetingNum = getSelectedMeetingForCourse(sch);
    let target = sessions.find(
      s => s.courseCode === sch.courseCode && s.rombel === sch.rombel && s.meetingNumber === meetingNum
    );

    if (!target) {
      target = createSession({
        scheduleId: sch.id,
        courseCode: sch.courseCode,
        courseName: sch.courseName,
        rombel: sch.rombel,
        room: sch.room,
        meetingNumber: meetingNum,
        topic: `Perkuliahan Pertemuan ${meetingNum}: ${sch.courseName}`,
        isDynamicQr: false,
      });
    }

    setManualSessionId(target.id);
    setIsManualModalOpen(true);
  };

  const handleExportForCourse = (sch: ScheduleItem, reportType: 'attendance' | 'teachingLog' = 'teachingLog') => {
    setSelectedCourseFilter(sch.courseCode);
    setExportCourseCode(sch.courseCode);
    setExportRombel(sch.rombel);
    setExportReportType(reportType);
    setIsExportModalOpen(true);
  };

  // Quick Summary Statistics Data
  const todayLecturerSchedules = mySchedules.filter(s => s.day === activeDay);
  const mySessionIds = mySessions.map(s => s.id);
  const myRecords = records.filter(r => mySessionIds.includes(r.sessionId));
  const totalLecturerRecords = myRecords.length;
  const totalLecturerHadir = myRecords.filter(r => r.status === 'HADIR').length;
  const avgAttendanceRate = totalLecturerRecords > 0 ? Math.round((totalLecturerHadir / totalLecturerRecords) * 100) : 92;

  const uniqueStudentNims = new Set<string>();
  mySchedules.forEach(s => {
    getStudentsForRombel(s.rombel).forEach(stu => uniqueStudentNims.add(stu.nim));
  });
  const totalStudentsTaught = uniqueStudentNims.size;
  const pendingLeaveCount = myLeaveRequests.filter(l => l.status === 'PENDING').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Clean Minimalist Header: Identity & Priority Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div
            onClick={() => setIsProfileModalOpen(true)}
            className="relative group cursor-pointer shrink-0"
            title="Klik untuk konfigurasi profil dosen"
          >
            <img
              src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={currentUser.name}
              className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-slate-200 group-hover:border-blue-500 shadow-2xs transition"
            />
            <div className="absolute inset-0 bg-slate-900/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
              <UserCog className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-500 font-medium">
              <span>Dosen Pengampu</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700 font-semibold">NIDN {currentUser.nidn || currentUser.username}</span>
              <span aria-hidden="true">·</span>
              <span>{mySchedules.length} Kelas</span>
              {currentUser.academicRank && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="hidden md:inline px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 font-medium">
                    {currentUser.academicRank}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                {currentUser.name}
              </h2>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                title="Konfigurasi Profil Dosen"
              >
                <UserCog className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
              {currentUser.prodi || 'Program Studi STMIK PGRI'} {currentUser.officeRoom ? `· ${currentUser.officeRoom}` : ''}
            </p>
          </div>
        </div>

        {/* Priority Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs"
            title="Buka Formulir Konfigurasi Profil Dosen"
          >
            <UserCog className="w-4 h-4 text-blue-600" />
            <span>Konfigurasi Profil</span>
          </button>

          <button
            onClick={() => {
              setScheduleForBukaSesi(mySchedules[0] || schedules[0] || null);
            }}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buka Sesi Presensi</span>
          </button>

          <button
            onClick={() => {
              setManualSessionId(activeSessions[0]?.id || mySessions[0]?.id || null);
              setIsManualModalOpen(true);
            }}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-slate-600" />
            <span>Presensi Manual</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-sm transition cursor-pointer"
            title="Ekspor Rekapitulasi Presensi (PDF & Excel)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Summary Statistics Component */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Classes Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Kelas Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {todayLecturerSchedules.length} Kelas
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {todayLecturerSchedules.length > 0
                ? `${activeDay} (${todayLecturerSchedules.map(s => s.room).join(', ')})`
                : `Tidak ada jadwal mengajar hari ${activeDay}`}
            </p>
          </div>
        </div>

        {/* Stat 2: Active Sessions */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Sesi Terbuka</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{activeSessions.length} Sesi</span>
              {activeSessions.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1 truncate">
              {activeSessions.length > 0
                ? `${activeSessions[0].courseName} (${activeSessions[0].rombel})`
                : 'Belum ada sesi presensi aktif'}
            </p>
          </div>
        </div>

        {/* Stat 3: Average Attendance Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Rata-rata Kehadiran</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {avgAttendanceRate}%
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {totalLecturerHadir} dari {totalLecturerRecords} rekaman hadir
            </p>
          </div>
        </div>

        {/* Stat 4: Students Taught & Pending Leaves */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Mahasiswa Diampu</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {totalStudentsTaught} Mhs
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {pendingLeaveCount > 0 ? (
                <span className="text-amber-700 font-semibold">{pendingLeaveCount} permohonan izin pending</span>
              ) : (
                <span>Semua izin/sakit telah ditinjau</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Active Session Notification (Quiet Clean Bar) */}
      {activeSessions.length > 0 && (
        <div className="border border-emerald-300 bg-emerald-50/70 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <div className="text-sm">
              <span className="font-bold text-slate-900">
                Sesi Berlangsung: {activeSessions[0].courseName}
              </span>
              <span className="text-slate-600 ml-2">
                Pertemuan {activeSessions[0].meetingNumber} · {activeSessions[0].rombel} · Ruang {activeSessions[0].room} ·{' '}
                <strong className="text-emerald-800 font-bold">
                  {records.filter(r => r.sessionId === activeSessions[0].id && r.status === 'HADIR').length}/
                  {getStudentsForRombel(activeSessions[0].rombel).length} Hadir
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedSessionIdForQr(activeSessions[0].id)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Proyektor QR</span>
            </button>
            <button
              onClick={() => {
                setManualSessionId(activeSessions[0].id);
                setIsManualModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-sm font-medium cursor-pointer transition flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4 text-slate-600" />
              <span>Presensi Manual</span>
            </button>
            <button
              onClick={() => setSessionToClose(activeSessions[0])}
              className="px-3 py-1.5 text-rose-700 hover:bg-rose-100/60 rounded-md text-sm font-semibold cursor-pointer transition flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Tutup Sesi</span>
            </button>
          </div>
        </div>
      )}

      {/* Clean Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 gap-4 sm:gap-8 text-sm sm:text-base font-medium no-scrollbar whitespace-nowrap">
        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'courses'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Mata Kuliah & Jadwal ({mySchedules.length})
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Riwayat Sesi ({mySessions.length})
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'students'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Rekap Kehadiran Mahasiswa
        </button>

        <button
          onClick={() => setActiveTab('leave')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'leave'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Izin & Sakit ({myLeaveRequests.filter(l => l.status === 'PENDING').length})
        </button>
      </div>

      {/* TAB 1: COURSES & SCHEDULE (PRIMARY) */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          {/* Minimalist Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-full">
              {['ALL', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map(day => (
                <button
                  key={day}
                  onClick={() => setCourseDayFilter(day)}
                  className={`px-3.5 py-1.5 rounded-md transition text-sm cursor-pointer ${
                    courseDayFilter === day
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {day === 'ALL' ? 'Semua Hari' : day}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setCourseViewMode('cards')}
                className={`px-3.5 py-1.5 rounded-md transition text-sm cursor-pointer ${
                  courseViewMode === 'cards'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kartu Mata Kuliah
              </button>
              <button
                onClick={() => setCourseViewMode('calendar')}
                className={`px-3.5 py-1.5 rounded-md transition text-sm cursor-pointer ${
                  courseViewMode === 'calendar'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Jadwal Mingguan
              </button>
            </div>
          </div>

          {courseViewMode === 'calendar' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <ScheduleCalendar onSelectScheduleForSession={handleOpenScheduleSession} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {mySchedules
                .filter(sch => courseDayFilter === 'ALL' || sch.day === courseDayFilter)
                .map(sch => {
                  const isNow = activeDay === sch.day && simulatedTime >= sch.startTime && simulatedTime <= sch.endTime;
                  const enrolled = getStudentsForRombel(sch.rombel);
                  const openSession = sessions.find(s => s.courseCode === sch.courseCode && s.rombel === sch.rombel && s.isOpen);
                  const currentMeeting = getSelectedMeetingForCourse(sch);
                  const meetingSession = sessions.find(s => s.courseCode === sch.courseCode && s.rombel === sch.rombel && s.meetingNumber === currentMeeting);
                  const isMeetingOpen = meetingSession?.isOpen;

                  return (
                    <div
                      key={sch.id}
                      className={`bg-white border rounded-xl p-5 transition-colors flex flex-col justify-between gap-5 ${
                        isNow
                          ? 'border-emerald-500 ring-1 ring-emerald-500'
                          : openSession
                          ? 'border-slate-400'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        {/* Status line */}
                        <div className="flex items-center justify-between text-sm text-slate-500">
                          <div className="flex items-center gap-2 font-medium">
                            <span className="font-mono text-slate-900 font-semibold">{sch.courseCode}</span>
                            <span aria-hidden="true">·</span>
                            <span>{sch.sks} SKS</span>
                            <span aria-hidden="true">·</span>
                            <span>{sch.prodi}</span>
                          </div>

                          {isNow ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1.5 text-sm">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              Aktif Sekarang
                            </span>
                          ) : openSession ? (
                            <span className="text-slate-900 font-semibold text-sm">
                              Sesi Terbuka
                            </span>
                          ) : (
                            <span className="font-medium">{sch.day}</span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-2">
                          {sch.courseName}
                        </h3>

                        {/* Details */}
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 mt-2 font-medium">
                          <span>{sch.day}, {sch.startTime}–{sch.endTime} WIB</span>
                          <span aria-hidden="true">·</span>
                          <span>Ruang {sch.room}</span>
                          <span aria-hidden="true">·</span>
                          <span>{sch.rombel} ({enrolled.length} mhs)</span>
                        </div>

                        {/* Meeting & Date Configurator */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
                          {/* Row 1: Select Pertemuan & Status */}
                          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              <label className="text-slate-700 font-semibold whitespace-nowrap">Pertemuan:</label>
                              <select
                                value={currentMeeting}
                                onChange={(e) => handleSelectMeeting(sch.id, Number(e.target.value))}
                                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer text-xs sm:text-sm"
                              >
                                {Array.from({ length: 16 }, (_, i) => i + 1).map(num => {
                                  const ses = sessions.find(s => s.courseCode === sch.courseCode && s.rombel === sch.rombel && s.meetingNumber === num);
                                  const marker = num === 8 ? ' (UTS)' : num === 16 ? ' (UAS)' : '';
                                  const status = ses ? (ses.isOpen ? ' • Aktif' : ' • Selesai') : '';
                                  return (
                                    <option key={num} value={num}>
                                      Pertemuan {num}{marker}{status}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div className="text-xs sm:text-sm font-medium">
                              {meetingSession ? (
                                meetingSession.isOpen ? (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Sesi Aktif
                                  </span>
                                ) : (
                                  <span className="text-slate-600">✓ Sesi Selesai</span>
                                )
                              ) : (
                                <span className="text-slate-400">Siap Mulai</span>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Date Picker explicitly bound to this selected Pertemuan */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-600 font-semibold flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                <span>Tanggal P-{currentMeeting}:</span>
                              </span>
                              <input
                                type="date"
                                value={getMeetingDateForSchedule(sch, currentMeeting)}
                                onChange={(e) => setScheduleMeetingDate(sch.id, currentMeeting, e.target.value)}
                                className="px-2 py-1 bg-white border border-slate-300 rounded-md font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition cursor-pointer text-xs"
                                title={`Tentukan tanggal terkait untuk Pertemuan ke-${currentMeeting}`}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => setScheduleForMeetingDates(sch)}
                              className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer text-xs flex items-center gap-1"
                              title="Buka kalender lengkap untuk mengatur tanggal ke-16 pertemuan"
                            >
                              <span>Atur 16 Pertemuan</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Clean Action Bar */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-100">
                        {!isMeetingOpen ? (
                          <button
                            onClick={() => setScheduleForBukaSesi(sch)}
                            className="flex-1 py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer min-h-[40px]"
                          >
                            <Play className="w-4 h-4 text-emerald-400" />
                            <span>Buka Sesi</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setSelectedSessionIdForQr(meetingSession.id)}
                              className="flex-1 py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer min-h-[40px]"
                              title="Tampilkan Layar QR Presensi"
                            >
                              <QrCode className="w-4 h-4" />
                              <span>Layar QR</span>
                            </button>

                            <button
                              onClick={() => setSessionToClose(meetingSession)}
                              className="flex-1 py-2 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px]"
                              title={`Akhiri sesi presensi Pertemuan ${currentMeeting}`}
                            >
                              <Lock className="w-4 h-4" />
                              <span>Tutup Sesi</span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleExportForCourse(sch)}
                          className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-sm transition cursor-pointer min-h-[40px] flex items-center justify-center"
                          title="Unduh Laporan Presensi"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SESSIONS HISTORY */}
      {activeTab === 'sessions' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Daftar Sesi Perkuliahan
            </h3>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Laporan</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {mySessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Belum ada sesi presensi yang dibuat.
              </div>
            ) : (
              mySessions.map((session) => {
                const sRecords = records.filter(r => r.sessionId === session.id);
                const hadirCount = sRecords.filter(r => r.status === 'HADIR').length;
                const enrolled = getStudentsForRombel(session.rombel);

                return (
                  <div key={session.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">
                          Pertemuan {session.meetingNumber} · {session.courseName}
                        </span>
                        {session.isOpen ? (
                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Terbuka
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Ditutup</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 mt-1">
                        <span>{session.date}</span>
                        <span aria-hidden="true">·</span>
                        <span>Ruang {session.room}</span>
                        <span aria-hidden="true">·</span>
                        <span>{session.rombel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-800">{hadirCount} / {enrolled.length} Hadir</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setManualSessionId(session.id);
                          setIsManualModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 transition cursor-pointer"
                      >
                        Presensi Manual
                      </button>

                      <button
                        onClick={() => setSelectedSessionIdForQr(session.id)}
                        className={`px-4 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer ${
                          session.isOpen
                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {session.isOpen ? 'Layar QR' : 'Detail'}
                      </button>

                      {session.isOpen && (
                        <button
                          onClick={() => setSessionToClose(session)}
                          className="px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 rounded-md border border-rose-200 transition cursor-pointer flex items-center gap-1"
                          title="Akhiri sesi perkuliahan ini"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Tutup Sesi</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT ATTENDANCE MATRIX */}
      {activeTab === 'students' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-800 focus:outline-none focus:border-slate-500 cursor-pointer"
              >
                <option value="ALL">Semua Kelas</option>
                {mySchedules.map(s => (
                  <option key={s.id} value={s.courseCode}>
                    [{s.courseCode}] {s.courseName} · {s.rombel}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari NIM atau nama..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setManualSessionId(activeSessions[0]?.id || mySessions[0]?.id || null);
                setIsManualModalOpen(true);
              }}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Lembar Roll-Call Lengkap</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">NIM</th>
                  <th className="py-3 px-4">Nama Mahasiswa</th>
                  <th className="py-3 px-4">Rombel</th>
                  <th className="py-3 px-4">Status Sesi Ini</th>
                  <th className="py-3 px-4 text-right">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students
                  .filter(stu => {
                    const q = searchStudent.toLowerCase();
                    const matchSearch = stu.name.toLowerCase().includes(q) || stu.nim.toLowerCase().includes(q);
                    if (selectedCourseFilter === 'ALL') return matchSearch;
                    const sch = mySchedules.find(s => s.courseCode === selectedCourseFilter);
                    return matchSearch && sch && stu.rombel.includes(sch.rombel);
                  })
                  .slice(0, 30)
                  .map((stu, idx) => {
                    const targetSession = activeSessions[0] || mySessions[0];
                    const rec = targetSession ? records.find(r => r.sessionId === targetSession.id && r.studentNim === stu.nim) : null;
                    const currentStatus = rec ? rec.status : 'BELUM';

                    return (
                      <tr key={stu.nim} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{stu.nim}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{stu.name}</td>
                        <td className="py-3 px-4 text-slate-600">{stu.rombel}</td>
                        <td className="py-3 px-4">
                          <span className={`font-semibold ${
                            currentStatus === 'HADIR' ? 'text-emerald-700' :
                            currentStatus === 'IZIN' ? 'text-blue-700' :
                            currentStatus === 'SAKIT' ? 'text-amber-700' :
                            currentStatus === 'ALPHA' ? 'text-rose-700' : 'text-slate-400'
                          }`}>
                            {currentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {targetSession && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => markStudentAttendanceDirectly(targetSession.id, stu.nim, 'HADIR')}
                                className="px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200 cursor-pointer font-semibold"
                              >
                                H
                              </button>
                              <button
                                onClick={() => markStudentAttendanceDirectly(targetSession.id, stu.nim, 'IZIN')}
                                className="px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded border border-blue-200 cursor-pointer font-semibold"
                              >
                                I
                              </button>
                              <button
                                onClick={() => markStudentAttendanceDirectly(targetSession.id, stu.nim, 'SAKIT')}
                                className="px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50 rounded border border-amber-200 cursor-pointer font-semibold"
                              >
                                S
                              </button>
                              <button
                                onClick={() => markStudentAttendanceDirectly(targetSession.id, stu.nim, 'ALPHA')}
                                className="px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded border border-rose-200 cursor-pointer font-semibold"
                              >
                                A
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LEAVE REQUESTS */}
      {activeTab === 'leave' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Permohonan Izin & Sakit Mahasiswa
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {myLeaveRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Tidak ada permohonan izin atau sakit.
              </div>
            ) : (
              myLeaveRequests.map((req) => (
                <div key={req.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {req.studentName} ({req.studentNim})
                      </span>
                      <span className="text-sm text-slate-500">· {req.rombel}</span>
                      <span className={`text-sm font-semibold ${
                        req.type === 'IZIN' ? 'text-blue-700' : 'text-amber-700'
                      }`}>
                        · {req.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {req.courseName} · {req.date} · Alasan: {req.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {req.status === 'PENDING' ? (
                      <>
                        <button
                          onClick={() => reviewLeaveRequest(req.id, 'APPROVED')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium cursor-pointer transition"
                        >
                          Setujui
                        </button>
                        <button
                          onClick={() => reviewLeaveRequest(req.id, 'REJECTED')}
                          className="px-3.5 py-1.5 text-slate-700 hover:bg-slate-100 rounded-md text-sm font-medium cursor-pointer transition border border-slate-200"
                        >
                          Tolak
                        </button>
                      </>
                    ) : (
                      <span className={`text-sm font-medium ${
                        req.status === 'APPROVED' ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {req.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <QrSessionModal
        session={selectedSessionForQr}
        isOpen={!!selectedSessionForQr}
        onClose={() => setSelectedSessionIdForQr(null)}
      />

      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSessionCreated={handleSessionCreated}
        preselectedSchedule={scheduleToStart}
      />

      <ManualAttendanceModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        defaultSessionId={manualSessionId}
      />

      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultCourseCode={exportCourseCode}
        defaultRombel={exportRombel}
        defaultReportType={exportReportType}
      />

      <CloseSessionDialog
        isOpen={!!sessionToClose}
        session={sessionToClose}
        onClose={() => setSessionToClose(null)}
        onConfirm={() => {
          if (sessionToClose) {
            closeSession(sessionToClose.id);
            setSessionToClose(null);
          }
        }}
      />

      <MeetingDatesModal
        schedule={scheduleForMeetingDates}
        isOpen={!!scheduleForMeetingDates}
        onClose={() => setScheduleForMeetingDates(null)}
      />

      <BukaSesiModal
        schedule={scheduleForBukaSesi}
        isOpen={!!scheduleForBukaSesi}
        onClose={() => setScheduleForBukaSesi(null)}
        initialMeetingNumber={scheduleForBukaSesi ? getSelectedMeetingForCourse(scheduleForBukaSesi) : 1}
        onOpenManual={(sessionId) => {
          setManualSessionId(sessionId);
          setIsManualModalOpen(true);
        }}
        onOpenQr={(sessionId) => {
          setSelectedSessionIdForQr(sessionId);
        }}
      />

      <DosenProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};
