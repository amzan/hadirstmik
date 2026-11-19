import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceSession, ScheduleItem } from '../../types/attendance';
import { QrSessionModal } from './QrSessionModal';
import { CreateSessionModal } from './CreateSessionModal';
import { ManualAttendanceModal } from './ManualAttendanceModal';
import { ReportExportModal } from '../shared/ReportExportModal';
import { ScheduleCalendar } from '../shared/ScheduleCalendar';
import { CloseSessionDialog } from './CloseSessionDialog';
import { MeetingDatesModal } from './MeetingDatesModal';
import { BukaSesiModal } from './BukaSesiModal';
import { DosenProfileModal } from './DosenProfileModal';
import { isStudentInRombel } from '../../data/initialData';
import {
  QrCode, Plus, Download, Users,
  Calendar, FileText, Search, UserCheck, BookOpen, Lock, Play, UserCog
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
  const [scheduleToStart] = useState<ScheduleItem | null>(null);
  const [sessionToClose, setSessionToClose] = useState<AttendanceSession | null>(null);
  const [selectedMeetingByCourse, setSelectedMeetingByCourse] = useState<Record<string, number>>({});
  const [scheduleForMeetingDates, setScheduleForMeetingDates] = useState<ScheduleItem | null>(null);
  const [scheduleForBukaSesi, setScheduleForBukaSesi] = useState<ScheduleItem | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [exportCourseCode, setExportCourseCode] = useState<string>('MKTI0109');
  const [exportRombel, setExportRombel] = useState<string>('TI 3');
  const [exportReportType, setExportReportType] = useState<'attendance' | 'teachingLog'>('teachingLog');

  const getInitials = (name: string) => {
    const parts = name
      .replace(/[.,]/g, '')
      .split(' ')
      .filter(p => p.length > 1 && !['Dr', 'Ir', 'MKom', 'SKom', 'MT', 'MM', 'MSi'].includes(p));
    if (parts.length === 0) return name.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

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
  const [sessionCourseTab, setSessionCourseTab] = useState<string>('ALL');
  const [sessionRombelFilter, setSessionRombelFilter] = useState<string>('ALL');
  const [courseDayFilter, setCourseDayFilter] = useState<string>('ALL');
  const [courseViewMode, setCourseViewMode] = useState<'cards' | 'calendar'>('cards');
  const [searchStudent, setSearchStudent] = useState<string>('');

  // Data filters
  const mySessions = sessions.filter(s => s.lecturerId === currentUser.id || s.lecturerName.includes(currentUser.name));
  const activeSessions = mySessions.filter(s => s.isOpen);
  const mySchedules = schedules.filter(s => s.lecturerId === currentUser.id || s.lecturerName.includes(currentUser.name));
  const myLeaveRequests = leaveRequests.filter(req => mySchedules.some(sch => sch.courseCode === req.courseCode));

  // Build classified course groups for Session History tabs
  const lecturerCourseTabs = React.useMemo(() => {
    const map = new Map<string, {
      courseCode: string;
      courseName: string;
      sks: number;
      prodi: string;
      rombels: string[];
      schedules: ScheduleItem[];
      sessions: AttendanceSession[];
    }>();

    mySchedules.forEach(sch => {
      const existing = map.get(sch.courseCode);
      if (existing) {
        if (!existing.rombels.includes(sch.rombel)) {
          existing.rombels.push(sch.rombel);
        }
        existing.schedules.push(sch);
      } else {
        map.set(sch.courseCode, {
          courseCode: sch.courseCode,
          courseName: sch.courseName,
          sks: sch.sks,
          prodi: sch.prodi,
          rombels: [sch.rombel],
          schedules: [sch],
          sessions: [],
        });
      }
    });

    mySessions.forEach(ses => {
      const existing = map.get(ses.courseCode);
      if (existing) {
        if (!existing.rombels.includes(ses.rombel)) {
          existing.rombels.push(ses.rombel);
        }
        existing.sessions.push(ses);
      } else {
        const matchedCourse = courses.find(c => c.code === ses.courseCode);
        map.set(ses.courseCode, {
          courseCode: ses.courseCode,
          courseName: ses.courseName,
          sks: matchedCourse?.sks || 2,
          prodi: matchedCourse?.prodi || currentUser.prodi || 'Teknologi Informasi',
          rombels: [ses.rombel],
          schedules: [],
          sessions: [ses],
        });
      }
    });

    const list = Array.from(map.values());
    list.forEach(group => {
      group.sessions.sort((a, b) => a.meetingNumber - b.meetingNumber);
    });
    return list;
  }, [mySchedules, mySessions, courses, currentUser.prodi]);

  const handleOpenScheduleSession = (schedule: ScheduleItem) => {
    setScheduleForBukaSesi(schedule);
  };

  const handleSessionCreated = (sessionId: string) => {
    setSelectedSessionIdForQr(sessionId);
  };

  const handleExportForCourse = (sch: ScheduleItem, reportType: 'attendance' | 'teachingLog' = 'teachingLog') => {
    setSelectedCourseFilter(sch.courseCode);
    setExportCourseCode(sch.courseCode);
    setExportRombel(sch.rombel);
    setExportReportType(reportType);
    setIsExportModalOpen(true);
  };

  const handleExportByCourseCode = (
    courseCode?: string,
    rombel?: string,
    reportType: 'attendance' | 'teachingLog' = 'teachingLog'
  ) => {
    const targetGroup =
      lecturerCourseTabs.find(g => g.courseCode === (courseCode || (sessionCourseTab !== 'ALL' ? sessionCourseTab : undefined))) ||
      lecturerCourseTabs[0];

    if (targetGroup) {
      const resolvedRombel =
        rombel && targetGroup.rombels.includes(rombel)
          ? rombel
          : sessionRombelFilter !== 'ALL' && targetGroup.rombels.includes(sessionRombelFilter)
          ? sessionRombelFilter
          : targetGroup.rombels[0] || 'TI 3';

      setSelectedCourseFilter(targetGroup.courseCode);
      setExportCourseCode(targetGroup.courseCode);
      setExportRombel(resolvedRombel);
    }
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
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Header: Frost-UI Identity & Priority Actions */}
      <div className="frost-card p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-[8px] bg-[#E4F2FF] border border-[#CCE6FF] text-[#0080FF] font-semibold text-base sm:text-lg flex items-center justify-center shrink-0 hover:bg-[#CCE6FF] transition cursor-pointer"
            title="Klik untuk konfigurasi profil dosen"
          >
            {getInitials(currentUser.name)}
          </button>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-[#555555] font-medium">
              <span>Dosen Pengampu</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#222222] font-semibold">NIDN {currentUser.nidn || currentUser.username}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{mySchedules.length} Kelas</span>
              {currentUser.academicRank && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="hidden md:inline text-[#555555]">
                    {currentUser.academicRank}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-[#222222] tracking-tight">
              {currentUser.name}
            </h2>
            <p className="text-xs sm:text-sm text-[#555555] hidden sm:block">
              {currentUser.prodi || 'Program Studi STMIK PGRI'} {currentUser.officeRoom ? `· ${currentUser.officeRoom}` : ''}
            </p>
          </div>
        </div>

        {/* Priority Actions (Frost-UI Buttons) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            data-frost="Button"
            onClick={() => setIsProfileModalOpen(true)}
            className="frost-btn frost-btn-md frost-btn-outline frost-btn-brand"
            title="Buka Formulir Konfigurasi Profil Dosen"
          >
            <UserCog className="w-4 h-4 text-[#0080FF] shrink-0" />
            <span className="label">Konfigurasi Profil</span>
          </button>

          <button
            type="button"
            data-frost="Button"
            onClick={() => {
              setScheduleForBukaSesi(mySchedules[0] || schedules[0] || null);
            }}
            className="frost-btn frost-btn-md frost-btn-solid frost-btn-brand"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="label">Buka Sesi Presensi</span>
          </button>

          <button
            type="button"
            data-frost="Button"
            onClick={() => {
              setManualSessionId(activeSessions[0]?.id || mySessions[0]?.id || null);
              setIsManualModalOpen(true);
            }}
            className="frost-btn frost-btn-md frost-btn-outline frost-btn-brand"
          >
            <UserCheck className="w-4 h-4 text-[#555555] shrink-0" />
            <span className="label">Presensi Manual</span>
          </button>

          <button
            type="button"
            data-frost="Button"
            onClick={() => handleExportByCourseCode()}
            className="frost-btn frost-btn-md frost-btn-outline frost-btn-brand frost-btn-icon-only"
            title="Ekspor Rekapitulasi Presensi (PDF & Excel)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Summary Statistics (Frost-UI Surface Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs sm:text-sm font-medium">Kelas Hari Ini</span>
            <Calendar className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-semibold text-[#222222] tracking-tight tabular-nums">
              {todayLecturerSchedules.length} Kelas
            </div>
            <p className="text-xs sm:text-sm text-[#555555]">
              {todayLecturerSchedules.length > 0
                ? `${activeDay} (${todayLecturerSchedules.map(s => s.room).join(', ')})`
                : `Tidak ada jadwal mengajar hari ${activeDay}`}
            </p>
          </div>
        </div>

        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs sm:text-sm font-medium">Sesi Terbuka</span>
            <QrCode className="w-4 h-4 text-[#0080FF]" />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-semibold text-[#222222] tracking-tight tabular-nums">
              {activeSessions.length} Sesi
            </div>
            <p className="text-xs sm:text-sm text-[#555555] truncate">
              {activeSessions.length > 0
                ? `${activeSessions[0].courseName} (${activeSessions[0].rombel})`
                : 'Belum ada sesi presensi aktif'}
            </p>
          </div>
        </div>

        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs sm:text-sm font-medium">Rata-rata Kehadiran</span>
            <UserCheck className="w-4 h-4 text-[#009499]" />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-semibold text-[#222222] tracking-tight tabular-nums">
              {avgAttendanceRate}%
            </div>
            <p className="text-xs sm:text-sm text-[#555555] tabular-nums">
              {totalLecturerHadir} dari {totalLecturerRecords} rekaman hadir
            </p>
          </div>
        </div>

        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs sm:text-sm font-medium">Mahasiswa Diampu</span>
            <Users className="w-4 h-4 text-[#555555]" />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-semibold text-[#222222] tracking-tight tabular-nums">
              {totalStudentsTaught} Mhs
            </div>
            <p className="text-xs sm:text-sm text-[#555555] tabular-nums">
              {pendingLeaveCount > 0 ? (
                <span className="text-[#DE6F01] font-medium">{pendingLeaveCount} permohonan izin menunggu</span>
              ) : (
                <span>Semua izin/sakit telah ditinjau</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Active Session Notification (Frost-UI Teal Callout) */}
      {activeSessions.length > 0 && (
        <div data-frost="Callout" className="frost-callout frost-callout-success flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-sm leading-relaxed">
            <span className="font-semibold text-[#004343]">
              Sesi Berlangsung: {activeSessions[0].courseName}
            </span>
            <span className="text-[#017171] ml-2 tabular-nums">
              Pertemuan {activeSessions[0].meetingNumber} · {activeSessions[0].rombel} · Ruang {activeSessions[0].room} ·{' '}
              <strong className="text-[#004343] font-semibold">
                {records.filter(r => r.sessionId === activeSessions[0].id && r.status === 'HADIR').length}/
                {getStudentsForRombel(activeSessions[0].rombel).length} Hadir
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-frost="Button"
              onClick={() => setSelectedSessionIdForQr(activeSessions[0].id)}
              className="frost-btn frost-btn-sm frost-btn-solid frost-btn-teal"
            >
              <QrCode className="w-4 h-4" />
              <span className="label">Proyektor QR</span>
            </button>
            <button
              type="button"
              data-frost="Button"
              onClick={() => {
                setManualSessionId(activeSessions[0].id);
                setIsManualModalOpen(true);
              }}
              className="frost-btn frost-btn-sm frost-btn-outline frost-btn-brand"
            >
              <UserCheck className="w-4 h-4 text-[#555555]" />
              <span className="label">Presensi Manual</span>
            </button>
            <button
              type="button"
              data-frost="Button"
              onClick={() => setSessionToClose(activeSessions[0])}
              className="frost-btn frost-btn-sm frost-btn-subtle frost-btn-danger"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="label">Tutup Sesi</span>
            </button>
          </div>
        </div>
      )}

      {/* Frost-UI Navigation Tabs (Tab-BQdeouhM.css specification) */}
      <div className="frost-tabs no-scrollbar">
        <button
          type="button"
          data-frost="Button"
          onClick={() => setActiveTab('courses')}
          className={`frost-tab-btn ${activeTab === 'courses' ? 'frost-tab-btn-active' : ''}`}
        >
          <span className="label tabular-nums">Mata Kuliah & Jadwal ({mySchedules.length})</span>
        </button>

        <button
          type="button"
          data-frost="Button"
          onClick={() => setActiveTab('sessions')}
          className={`frost-tab-btn ${activeTab === 'sessions' ? 'frost-tab-btn-active' : ''}`}
        >
          <span className="label tabular-nums">Riwayat Sesi ({mySessions.length})</span>
        </button>

        <button
          type="button"
          data-frost="Button"
          onClick={() => setActiveTab('students')}
          className={`frost-tab-btn ${activeTab === 'students' ? 'frost-tab-btn-active' : ''}`}
        >
          <span className="label">Rekap Kehadiran Mahasiswa</span>
        </button>

        <button
          type="button"
          data-frost="Button"
          onClick={() => setActiveTab('leave')}
          className={`frost-tab-btn ${activeTab === 'leave' ? 'frost-tab-btn-active' : ''}`}
        >
          <span className="label tabular-nums">Izin & Sakit ({myLeaveRequests.filter(l => l.status === 'PENDING').length})</span>
        </button>
      </div>

      {/* TAB 1: COURSES & SCHEDULE (PRIMARY) */}
      {activeTab === 'courses' && (
        <div className="space-y-5">
          {/* Minimalist Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap items-center gap-1 p-1 bg-[#eeeeee] rounded-[6px] max-w-full">
              {['ALL', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setCourseDayFilter(day)}
                  className={`px-3.5 py-1.5 rounded-[4px] transition text-xs sm:text-sm cursor-pointer whitespace-nowrap shrink-0 ${
                    courseDayFilter === day
                      ? 'bg-white text-[#222222] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                      : 'text-[#555555] hover:text-[#222222]'
                  }`}
                >
                  {day === 'ALL' ? 'Semua Hari' : day}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#eeeeee] rounded-[6px]">
              <button
                type="button"
                onClick={() => setCourseViewMode('cards')}
                className={`px-3.5 py-1.5 rounded-[4px] transition text-xs sm:text-sm cursor-pointer whitespace-nowrap shrink-0 ${
                  courseViewMode === 'cards'
                    ? 'bg-white text-[#222222] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                    : 'text-[#555555] hover:text-[#222222]'
                }`}
              >
                Kartu Mata Kuliah
              </button>
              <button
                type="button"
                onClick={() => setCourseViewMode('calendar')}
                className={`px-3.5 py-1.5 rounded-[4px] transition text-xs sm:text-sm cursor-pointer whitespace-nowrap shrink-0 ${
                  courseViewMode === 'calendar'
                    ? 'bg-white text-[#222222] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                    : 'text-[#555555] hover:text-[#222222]'
                }`}
              >
                Jadwal Mingguan
              </button>
            </div>
          </div>

          {courseViewMode === 'calendar' ? (
            <div className="frost-card p-6">
              <ScheduleCalendar onSelectScheduleForSession={handleOpenScheduleSession} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
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
                      className={`frost-card p-6 transition-colors flex flex-col justify-between gap-6 ${
                        isNow
                          ? 'border-[#009499]'
                          : openSession
                          ? 'border-[#0080FF]'
                          : 'border-[#dddddd] hover:border-[#cccccc]'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          {/* Status line (Unboxed Metadata) */}
                          <div className="flex items-center justify-between text-xs sm:text-sm text-[#555555]">
                            <div className="flex items-center gap-2 font-medium tabular-nums">
                              <span className="font-mono text-[#222222] font-semibold">{sch.courseCode}</span>
                              <span aria-hidden="true">·</span>
                              <span>{sch.sks} SKS</span>
                              <span aria-hidden="true">·</span>
                              <span>{sch.prodi}</span>
                            </div>

                            {isNow ? (
                              <span className="text-[#017171] font-semibold text-xs sm:text-sm">
                                Aktif Sekarang
                              </span>
                            ) : openSession ? (
                              <span className="text-[#0080FF] font-semibold text-xs sm:text-sm">
                                Sesi Terbuka
                              </span>
                            ) : (
                              <span className="font-medium">{sch.day}</span>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className="text-lg sm:text-xl font-semibold text-[#222222]">
                            {sch.courseName}
                          </h3>

                          {/* Details */}
                          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#555555] font-medium tabular-nums">
                            <span>{sch.day}, {sch.startTime}–{sch.endTime} WIB</span>
                            <span aria-hidden="true">·</span>
                            <span>Ruang {sch.room}</span>
                            <span aria-hidden="true">·</span>
                            <span>{sch.rombel} ({enrolled.length} mhs)</span>
                          </div>
                        </div>

                        {/* Meeting & Date Configurator */}
                        <div className="pt-4 border-t border-[#eeeeee] flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                            <div className="flex items-center gap-2.5">
                              <label className="text-[#555555] font-medium whitespace-nowrap">Pertemuan:</label>
                              <select
                                value={currentMeeting}
                                onChange={(e) => handleSelectMeeting(sch.id, Number(e.target.value))}
                                className="frost-select frost-select-sm w-auto font-medium cursor-pointer"
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
                                  <span className="text-[#017171] font-semibold">
                                    Sesi Aktif
                                  </span>
                                ) : (
                                  <span className="text-[#555555]">Sesi Selesai</span>
                                )
                              ) : (
                                <span className="text-[#777777]">Siap Mulai</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[#555555] font-medium flex items-center gap-1.5 tabular-nums">
                                <Calendar className="w-3.5 h-3.5 text-[#0080FF]" />
                                <span>Tanggal P-{currentMeeting}:</span>
                              </span>
                              <input
                                type="date"
                                value={getMeetingDateForSchedule(sch, currentMeeting)}
                                onChange={(e) => setScheduleMeetingDate(sch.id, currentMeeting, e.target.value)}
                                className="frost-input frost-input-sm w-auto font-mono tabular-nums cursor-pointer"
                                title={`Tentukan tanggal terkait untuk Pertemuan ke-${currentMeeting}`}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => setScheduleForMeetingDates(sch)}
                              className="text-[#0080FF] hover:text-[#016FDE] font-medium hover:underline cursor-pointer text-xs"
                              title="Buka kalender lengkap untuk mengatur tanggal ke-16 pertemuan"
                            >
                              Atur 16 Pertemuan
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Frost-UI Action Bar */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-[#eeeeee]">
                        {!isMeetingOpen ? (
                          <button
                            type="button"
                            data-frost="Button"
                            onClick={() => setScheduleForBukaSesi(sch)}
                            className="frost-btn frost-btn-md frost-btn-solid frost-btn-brand flex-1"
                          >
                            <Play className="w-4 h-4" />
                            <span className="label">Buka Sesi</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              data-frost="Button"
                              onClick={() => setSelectedSessionIdForQr(meetingSession.id)}
                              className="frost-btn frost-btn-md frost-btn-solid frost-btn-teal flex-1"
                              title="Tampilkan Layar QR Presensi"
                            >
                              <QrCode className="w-4 h-4" />
                              <span className="label">Layar QR</span>
                            </button>

                            <button
                              type="button"
                              data-frost="Button"
                              onClick={() => setSessionToClose(meetingSession)}
                              className="frost-btn frost-btn-md frost-btn-solid frost-btn-danger flex-1"
                              title={`Akhiri sesi presensi Pertemuan ${currentMeeting}`}
                            >
                              <Lock className="w-4 h-4" />
                              <span className="label">Tutup Sesi</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          data-frost="Button"
                          onClick={() => handleExportForCourse(sch)}
                          className="frost-btn frost-btn-md frost-btn-outline frost-btn-brand frost-btn-icon-only"
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

      {/* TAB 2: SESSIONS HISTORY (With Course Separator Tabs) */}
      {activeTab === 'sessions' && (() => {
        const activeCourseGroup = sessionCourseTab !== 'ALL'
          ? lecturerCourseTabs.find(g => g.courseCode === sessionCourseTab) || null
          : null;

        const displayedCourseGroups = activeCourseGroup
          ? [activeCourseGroup]
          : lecturerCourseTabs;

        return (
          <div className="frost-card overflow-hidden">
            {/* Header & Tab Pemisah Mata Kuliah */}
            <div className="border-b border-[#dddddd] bg-[#fafafa]">
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-semibold text-[#222222]">
                      Daftar Sesi Perkuliahan
                    </h3>
                    <span className="text-xs text-[#555555] font-mono tabular-nums">
                      · {mySessions.length} Total Sesi
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#555555]">
                    Pilih tab mata kuliah di bawah untuk mengklasifikasikan riwayat sesi dan menyesuaikan ekspor laporan
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    data-frost="Button"
                    onClick={() => handleExportByCourseCode(
                      activeCourseGroup?.courseCode,
                      sessionRombelFilter !== 'ALL' ? sessionRombelFilter : activeCourseGroup?.rombels[0],
                      'teachingLog'
                    )}
                    className="frost-btn frost-btn-sm frost-btn-outline frost-btn-brand"
                    title="Ekspor Log Aktivitas Mengajar (BAP) sesuai mata kuliah terpilih"
                  >
                    <FileText className="w-4 h-4 text-[#0080FF]" />
                    <span className="label">
                      {activeCourseGroup
                        ? `Ekspor BAP (${activeCourseGroup.courseCode})`
                        : 'Ekspor Log Mengajar (BAP)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-frost="Button"
                    onClick={() => handleExportByCourseCode(
                      activeCourseGroup?.courseCode,
                      sessionRombelFilter !== 'ALL' ? sessionRombelFilter : activeCourseGroup?.rombels[0],
                      'attendance'
                    )}
                    className="frost-btn frost-btn-sm frost-btn-solid frost-btn-brand"
                    title="Ekspor Rekapitulasi Presensi Mahasiswa sesuai mata kuliah terpilih"
                  >
                    <Download className="w-4 h-4" />
                    <span className="label">
                      {activeCourseGroup
                        ? `Ekspor Laporan: ${activeCourseGroup.courseName}`
                        : 'Ekspor Laporan Presensi'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tab Pemisah Antar Setiap Mata Kuliah (Frost-UI Tabs) */}
              <div className="frost-tabs px-5 sm:px-6 no-scrollbar bg-white">
                <button
                  type="button"
                  data-frost="Button"
                  onClick={() => {
                    setSessionCourseTab('ALL');
                    setSessionRombelFilter('ALL');
                  }}
                  className={`frost-tab-btn ${sessionCourseTab === 'ALL' ? 'frost-tab-btn-active' : ''}`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span className="label">Semua Mata Kuliah</span>
                  <span className="text-xs font-mono tabular-nums opacity-75">({mySessions.length})</span>
                </button>

                {lecturerCourseTabs.map((group) => {
                  const isSelected = sessionCourseTab === group.courseCode;
                  return (
                    <button
                      key={group.courseCode}
                      type="button"
                      data-frost="Button"
                      onClick={() => {
                        setSessionCourseTab(group.courseCode);
                        setSessionRombelFilter('ALL');
                      }}
                      className={`frost-tab-btn ${isSelected ? 'frost-tab-btn-active' : ''}`}
                    >
                      <span className="font-mono text-xs opacity-75">{group.courseCode}</span>
                      <span className="label truncate max-w-[180px] sm:max-w-[220px]">
                        {group.courseName}
                      </span>
                      <span className="text-xs font-mono tabular-nums opacity-75">
                        ({group.sessions.length})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sub-filter Rombel jika Mata Kuliah terpilih memiliki > 1 Rombel */}
              {activeCourseGroup && activeCourseGroup.rombels.length > 1 && (
                <div className="px-5 sm:px-6 py-3 bg-white border-t border-[#eeeeee] flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-[#555555]">Filter Kelas / Rombel:</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-frost="Button"
                        onClick={() => setSessionRombelFilter('ALL')}
                        className={`frost-btn frost-btn-xxs ${
                          sessionRombelFilter === 'ALL'
                            ? 'frost-btn-brand frost-btn-solid'
                            : 'frost-btn-brand frost-btn-outline'
                        }`}
                      >
                        Semua Rombel ({activeCourseGroup.sessions.length})
                      </button>
                      {activeCourseGroup.rombels.map(r => {
                        const rCount = activeCourseGroup.sessions.filter(s => s.rombel === r).length;
                        return (
                          <button
                            key={r}
                            type="button"
                            data-frost="Button"
                            onClick={() => setSessionRombelFilter(r)}
                            className={`frost-btn frost-btn-xxs ${
                              sessionRombelFilter === r
                                ? 'frost-btn-brand frost-btn-solid'
                                : 'frost-btn-brand frost-btn-outline'
                            }`}
                          >
                            Rombel {r} ({rCount})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Daftar Sesi Terklasifikasi per Mata Kuliah */}
            <div className="divide-y divide-[#dddddd]">
              {displayedCourseGroups.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#777777]">
                  Belum ada mata kuliah atau sesi presensi yang tercatat.
                </div>
              ) : (
                displayedCourseGroups.map((group) => {
                  const filteredGroupSessions = group.sessions.filter(
                    s => sessionRombelFilter === 'ALL' || s.rombel === sessionRombelFilter
                  );

                  const totalGroupHadir = filteredGroupSessions.reduce((acc, ses) => {
                    return acc + records.filter(r => r.sessionId === ses.id && r.status === 'HADIR').length;
                  }, 0);
                  const totalGroupExpected = filteredGroupSessions.reduce((acc, ses) => {
                    return acc + Math.max(getStudentsForRombel(ses.rombel).length, 1);
                  }, 0);
                  const groupAttendanceRate = filteredGroupSessions.length > 0
                    ? Math.min(100, Math.round((totalGroupHadir / totalGroupExpected) * 100))
                    : 0;

                  const primarySchedule = group.schedules[0] || mySchedules.find(s => s.courseCode === group.courseCode);

                  return (
                    <div key={group.courseCode} className="bg-white">
                      {/* Header Pemisah Klasifikasi Mata Kuliah */}
                      <div className="px-5 sm:px-6 py-4 bg-[#fafafa] border-b border-[#eeeeee] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                            <span className="font-mono font-semibold text-[#0080FF]">{group.courseCode}</span>
                            <span aria-hidden="true" className="text-[#cccccc]">·</span>
                            <h4 className="font-semibold text-[#222222] text-sm sm:text-base">
                              {group.courseName}
                            </h4>
                            <span aria-hidden="true" className="text-[#cccccc]">·</span>
                            <span className="text-xs text-[#555555] tabular-nums">{group.sks} SKS</span>
                            <span aria-hidden="true" className="text-[#cccccc]">·</span>
                            <span className="text-xs text-[#555555]">Rombel {group.rombels.join(', ')}</span>
                          </div>
                          <p className="text-xs text-[#555555] tabular-nums">
                            {filteredGroupSessions.length} dari 16 Pertemuan Terlaksana · Rata-rata Kehadiran Kelas:{' '}
                            <strong className="text-[#017171] font-semibold">{groupAttendanceRate}%</strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {primarySchedule && (
                            <button
                              type="button"
                              data-frost="Button"
                              onClick={() => setScheduleForBukaSesi(primarySchedule)}
                              className="frost-btn frost-btn-xs frost-btn-outline frost-btn-brand"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#009499]" />
                              <span className="label">Buka Sesi Baru</span>
                            </button>
                          )}

                          <button
                            type="button"
                            data-frost="Button"
                            onClick={() => handleExportByCourseCode(
                              group.courseCode,
                              sessionRombelFilter !== 'ALL' && group.rombels.includes(sessionRombelFilter)
                                ? sessionRombelFilter
                                : group.rombels[0],
                              'teachingLog'
                            )}
                            className="frost-btn frost-btn-xs frost-btn-subtle frost-btn-brand"
                            title={`Ekspor BAP & Presensi untuk ${group.courseName}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="label">Ekspor Laporan MK Ini</span>
                          </button>
                        </div>
                      </div>

                      {/* Daftar Sesi di dalam Mata Kuliah Ini */}
                      {filteredGroupSessions.length === 0 ? (
                        <div className="p-8 text-center space-y-3">
                          <p className="text-sm text-[#777777]">
                            Belum ada riwayat sesi perkuliahan untuk mata kuliah <strong className="text-[#333333]">{group.courseName}</strong>.
                          </p>
                          {primarySchedule && (
                            <button
                              type="button"
                              data-frost="Button"
                              onClick={() => setScheduleForBukaSesi(primarySchedule)}
                              className="frost-btn frost-btn-sm frost-btn-solid frost-btn-brand"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span className="label">Buka Sesi Pertemuan Pertama</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="divide-y divide-[#eeeeee]">
                          {filteredGroupSessions.map((session) => {
                            const sRecords = records.filter(r => r.sessionId === session.id);
                            const hadirCount = sRecords.filter(r => r.status === 'HADIR').length;
                            const izinCount = sRecords.filter(r => r.status === 'IZIN').length;
                            const sakitCount = sRecords.filter(r => r.status === 'SAKIT').length;
                            const alphaCount = sRecords.filter(r => r.status === 'ALPHA').length;
                            const enrolled = getStudentsForRombel(session.rombel);
                            const attendancePct = enrolled.length > 0
                              ? Math.round((hadirCount / enrolled.length) * 100)
                              : 0;

                            return (
                              <div
                                key={session.id}
                                className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fafafa] transition-colors"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                                    <span className="font-mono tabular-nums font-semibold text-[#222222]">
                                      Pertemuan {session.meetingNumber}
                                      {session.meetingNumber === 8 ? ' (UTS)' : session.meetingNumber === 16 ? ' (UAS)' : ''}
                                    </span>
                                    <span aria-hidden="true" className="text-[#cccccc]">·</span>
                                    <span className="font-semibold text-[#222222] text-sm sm:text-base">
                                      {session.topic || session.courseName}
                                    </span>
                                    <span aria-hidden="true" className="text-[#cccccc]">·</span>
                                    {session.isOpen ? (
                                      <span className="text-xs font-semibold text-[#017171]">
                                        Terbuka
                                      </span>
                                    ) : (
                                      <span className="text-xs font-medium text-[#777777]">
                                        Selesai
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#555555] tabular-nums">
                                    <span className="font-medium text-[#333333]">{session.date}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{session.startTime}–{session.endTime} WIB</span>
                                    <span aria-hidden="true">·</span>
                                    <span>Ruang {session.room}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-medium text-[#333333]">Rombel {session.rombel}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-semibold text-[#222222]">
                                      {hadirCount}/{enrolled.length} Hadir ({attendancePct}%)
                                    </span>
                                    {(izinCount > 0 || sakitCount > 0 || alphaCount > 0) && (
                                      <span className="text-xs text-[#777777]">
                                        ({izinCount > 0 ? `${izinCount} Izin ` : ''}
                                        {sakitCount > 0 ? `${sakitCount} Sakit ` : ''}
                                        {alphaCount > 0 ? `${alphaCount} Alpha` : ''})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    data-frost="Button"
                                    onClick={() => {
                                      setManualSessionId(session.id);
                                      setIsManualModalOpen(true);
                                    }}
                                    className="frost-btn frost-btn-xs frost-btn-outline frost-btn-brand"
                                  >
                                    <span className="label">Presensi Manual</span>
                                  </button>

                                  <button
                                    type="button"
                                    data-frost="Button"
                                    onClick={() => setSelectedSessionIdForQr(session.id)}
                                    className={`frost-btn frost-btn-xs ${
                                      session.isOpen
                                        ? 'frost-btn-brand frost-btn-solid'
                                        : 'frost-btn-brand frost-btn-subtle'
                                    }`}
                                  >
                                    <span className="label">{session.isOpen ? 'Layar QR' : 'Detail'}</span>
                                  </button>

                                  {session.isOpen && (
                                    <button
                                      type="button"
                                      data-frost="Button"
                                      onClick={() => setSessionToClose(session)}
                                      className="frost-btn frost-btn-xs frost-btn-subtle frost-btn-danger"
                                      title="Akhiri sesi perkuliahan ini"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                      <span className="label">Tutup Sesi</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 3: STUDENT ATTENDANCE MATRIX */}
      {activeTab === 'students' && (
        <div className="frost-card overflow-hidden p-6 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="frost-select frost-select-sm w-auto cursor-pointer"
              >
                <option value="ALL">Semua Kelas</option>
                {mySchedules.map(s => (
                  <option key={s.id} value={s.courseCode}>
                    [{s.courseCode}] {s.courseName} · {s.rombel}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-4 h-4 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari NIM atau nama..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="frost-input frost-input-sm pl-9 pr-3 w-60"
                />
              </div>
            </div>

            <button
              type="button"
              data-frost="Button"
              onClick={() => {
                setManualSessionId(activeSessions[0]?.id || mySessions[0]?.id || null);
                setIsManualModalOpen(true);
              }}
              className="frost-btn frost-btn-sm frost-btn-solid frost-btn-brand"
            >
              <UserCheck className="w-4 h-4" />
              <span className="label">Lembar Roll-Call Lengkap</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-[#dddddd] rounded-[6px]">
            <table className="w-full text-sm text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#dddddd] text-[#555555] font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4">No</th>
                  <th className="py-3.5 px-4">NIM</th>
                  <th className="py-3.5 px-4">Nama Mahasiswa</th>
                  <th className="py-3.5 px-4">Rombel</th>
                  <th className="py-3.5 px-4">Status Sesi Ini</th>
                  <th className="py-3.5 px-4 text-right">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eeeeee]">
                {students
                  .filter(stu => {
                    const q = searchStudent.toLowerCase();
                    const matchSearch = stu.name.toLowerCase().includes(q) || stu.nim.toLowerCase().includes(q);
                    if (selectedCourseFilter === 'ALL') return matchSearch;
                    const sch = mySchedules.find(s => s.courseCode === selectedCourseFilter);
                    return matchSearch && !!sch && isStudentInRombel(stu.rombel, sch.rombel, stu.rombels);
                  })
                  .slice(0, 30)
                  .map((stu, idx) => {
                    const targetSession =
                      selectedCourseFilter !== 'ALL'
                        ? activeSessions.find(s => s.courseCode === selectedCourseFilter) ||
                          mySessions.find(s => s.courseCode === selectedCourseFilter)
                        : activeSessions[0] || mySessions[0];
                    const rec = targetSession ? records.find(r => r.sessionId === targetSession.id && r.studentNim === stu.nim) : null;
                    const currentStatus = rec ? rec.status : 'BELUM';

                    return (
                      <tr key={stu.nim} className="hover:bg-[#fafafa] transition-colors">
                        <td className="py-3.5 px-4 text-[#777777] font-mono tabular-nums">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-mono tabular-nums font-medium text-[#222222]">{stu.nim}</td>
                        <td className="py-3.5 px-4 font-medium text-[#222222]">{stu.name}</td>
                        <td className="py-3.5 px-4 text-[#555555]">{stu.rombel}</td>
                        <td className="py-3.5 px-4">
                          <span className={`font-semibold text-xs ${
                            currentStatus === 'HADIR' ? 'text-[#017171]' :
                            currentStatus === 'IZIN' ? 'text-[#016FDE]' :
                            currentStatus === 'SAKIT' ? 'text-[#DE6F01]' :
                            currentStatus === 'ALPHA' ? 'text-[#C73C3C]' : 'text-[#999999]'
                          }`}>
                            {currentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {targetSession && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                data-frost="Button"
                                onClick={() => markStudentAttendanceDirectly(targetSession.id, stu.nim, 'HADIR')}
                                className="frost-btn frost-btn-xxs frost-btn-subtle frost-btn-teal"
                              >
                                H
                              </button>
                              <button
                                type="button"
                                data-frost="Button"
                                onClick={() => markStudentAttendanceDirectly(targetSession.id, stu.nim, 'IZIN')}
                                className="frost-btn frost-btn-xxs frost-btn-subtle frost-btn-brand"
                              >
                                I
                              </button>
                              <button
                                type="button"
                                data-frost="Button"
                                onClick={() => markStudentAttendanceDirectly(targetSession.id, stu.nim, 'SAKIT')}
                                className="frost-btn frost-btn-xxs frost-btn-outline frost-btn-brand"
                              >
                                S
                              </button>
                              <button
                                type="button"
                                data-frost="Button"
                                onClick={() => markStudentAttendanceDirectly(targetSession.id, stu.nim, 'ALPHA')}
                                className="frost-btn frost-btn-xxs frost-btn-subtle frost-btn-danger"
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
        <div className="frost-card overflow-hidden">
          <div className="p-6 border-b border-[#dddddd]">
            <h3 className="text-base sm:text-lg font-semibold text-[#222222]">
              Permohonan Izin & Sakit Mahasiswa
            </h3>
          </div>

          <div className="divide-y divide-[#eeeeee]">
            {myLeaveRequests.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#777777]">
                Tidak ada permohonan izin atau sakit.
              </div>
            ) : (
              myLeaveRequests.map((req) => (
                <div key={req.id} className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fafafa] transition-colors">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-[#222222]">
                        {req.studentName}
                      </span>
                      <span className="font-mono tabular-nums text-xs text-[#555555]">({req.studentNim})</span>
                      <span aria-hidden="true" className="text-[#cccccc]">·</span>
                      <span className="text-xs text-[#555555]">{req.rombel}</span>
                      <span aria-hidden="true" className="text-[#cccccc]">·</span>
                      <span className={`text-xs font-semibold ${
                        req.type === 'IZIN' ? 'text-[#016FDE]' : 'text-[#DE6F01]'
                      }`}>
                        {req.type}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#555555] tabular-nums">
                      {req.courseName} · {req.date} · Alasan: {req.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {req.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          data-frost="Button"
                          onClick={() => reviewLeaveRequest(req.id, 'APPROVED')}
                          className="frost-btn frost-btn-sm frost-btn-solid frost-btn-teal"
                        >
                          <span className="label">Setujui</span>
                        </button>
                        <button
                          type="button"
                          data-frost="Button"
                          onClick={() => reviewLeaveRequest(req.id, 'REJECTED')}
                          className="frost-btn frost-btn-sm frost-btn-outline frost-btn-danger"
                        >
                          <span className="label">Tolak</span>
                        </button>
                      </>
                    ) : (
                      <span className={`text-xs font-semibold ${
                        req.status === 'APPROVED' ? 'text-[#017171]' : 'text-[#C73C3C]'
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
