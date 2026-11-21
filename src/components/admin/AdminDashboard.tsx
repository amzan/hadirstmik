import { summarizeAllAttendancePolicy, CURRENT_ACADEMIC_PERIOD } from '../../../shared/attendance-policy.mjs';
import { AccountActivationPanel } from './AccountActivationPanel';
import { LegacyExcludeReview } from './LegacyExcludeReview';
import React, { useState, useMemo } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { User, Student, ScheduleItem, Role, DayOfWeek, ProgramStudi, Rombel, Course, AttendanceSession } from '../../types/attendance';
import { isStudentInRombel, getStudentRombelList, getStudentEnrolledSchedules, getStudentTotalSks } from '../../data/initialData';
import { ReportExportModal } from '../shared/ReportExportModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { ScheduleModal } from './ScheduleModal';
import { StudentModal } from './StudentModal';
import { StudentScheduleDetailModal } from './StudentScheduleDetailModal';
import { RombelModal } from './RombelModal';
import { CourseModal } from './CourseModal';
import { RelationshipBlockModal } from './RelationshipBlockModal';
import { ScheduleStudentRosterModal } from './ScheduleStudentRosterModal';
import { SessionMonitoringTab } from './SessionMonitoringTab';
import { DatabaseBackupTab } from './DatabaseBackupTab';
import { DatabaseBackupModal } from './DatabaseBackupModal';
import { BulkExcelImportModal } from './BulkExcelImportModal';
import { DeviceSessionManager } from '../shared/DeviceSessionManager';
import { ImportCategory } from '../../utils/excelBulkService';
import {
  Shield, Users, Calendar, BookOpen, UserPlus, Plus,
  Trash2, Edit2, Search, Download, RefreshCw, GraduationCap, Clock, Radio, UserCog,
  Database, FileSpreadsheet, Laptop, Eye, EyeOff, Sparkles, Layers, Filter, ChevronRight, ChevronDown,
  Settings2, Link, CheckCircle2, BookmarkCheck, Archive, ArchiveRestore, AlertTriangle, ShieldAlert,
  GitMerge
} from 'lucide-react';

interface AdminDashboardProps {
  onOpenProfile?: () => void;
}

const AdminDashboardContent: React.FC<AdminDashboardProps> = ({
  onOpenProfile
}) => {
  const {
    demoScope, setDemoScope, loading,
    users,
    students,
    courses,
    schedules,
    sessions,
    records,
    activeDay,
    simulatedTime,
    addUser,
    updateUser,
    deleteUser,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addCourse,
    updateCourse,
    deleteCourse,
    archiveCourse,
    restoreCourse,
    checkCourseRelations,
    addStudent,
    updateStudent,
    deleteStudent,
    syncStudentUsers,
    rombels,
    addRombel,
    updateRombel,
    deleteRombel,
    archiveRombel,
    restoreRombel,
    checkRombelRelations,
    linkSchedulesToRombel,
    resetToDefaultData,
    deviceSessions,
  } = useAttendance();

  const [activeTab, setActiveTab] = useState<'sessions' | 'schedules' | 'users' | 'students' | 'courses' | 'database' | 'devices'>('sessions');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportCategory, setBulkImportCategory] = useState<ImportCategory>('all');

  const switchScope = async (enabled: boolean) => {
    setActiveTab('sessions'); setIsUserModalOpen(false); setIsExportModalOpen(false); setIsBulkImportOpen(false);
    await setDemoScope(enabled);
  };

  const handleOpenBulkImport = (cat: ImportCategory = 'all') => {
    if (demoScope) return;
    setBulkImportCategory(cat);
    setIsBulkImportOpen(true);
  };

  // Confirm dialog state (replaces window.confirm)
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

  // Quick Summary Statistics Data for Admin
  const todayCampusSchedules = schedules.filter(s => s.day === activeDay);
  const openSessionsCount = sessions.filter(s => s.isOpen).length;
  const campusPolicy = summarizeAllAttendancePolicy(sessions.filter(session => session.academicPeriod === CURRENT_ACADEMIC_PERIOD), records);
  const totalCampusRecords = campusPolicy.totalSessions;
  const totalCampusHadir = campusPolicy.hadir;
  const campusAttendanceRate = campusPolicy.percentage;

  // User form state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<Role>('dosen');
  const [userTitle, setUserTitle] = useState('');
  const [userRombel, setUserRombel] = useState('');
  const [userProdi, setUserProdi] = useState<ProgramStudi>('Teknologi Informasi');
  const [userFormError, setUserFormError] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'mahasiswa' | 'dosen' | 'admin'>('ALL');
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState<ScheduleItem | null>(null);

  // Open User modal
  const handleOpenUserModal = (user?: User) => {
    setUserFormError('');
    if (user) {
      setEditingUserId(user.id);
      setUserName(user.name);
      setUserUsername(user.role === 'dosen' ? user.nidn || user.username : user.username);
      setUserEmail(user.email);
      setUserRole(user.role);
      setUserTitle(user.title || '');
      setUserRombel(user.rombel || '');
      setUserProdi(user.prodi || 'Teknologi Informasi');
    } else {
      setEditingUserId(null);
      setUserName('');
      setUserUsername('');
      setUserEmail('');
      setUserRole('dosen');
      setUserTitle('');
      setUserRombel('');
      setUserProdi('Teknologi Informasi');
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingUser) return;
    setUserFormError('');
    const username = userUsername.trim();
    if (!userName.trim() || !username) return;
    const ownUser = users.find(user => user.id === editingUserId);
    const normalized = username.toLowerCase();
    const duplicateUser = users.some(user => user.id !== editingUserId && [user.username, user.nidn, user.loginAlias, user.email].some(value => value?.trim().toLowerCase() === normalized));
    const duplicateStudent = students.some(student => student.nim.trim().toLowerCase() === normalized && !(ownUser?.role === 'mahasiswa' && student.nim === ownUser.username));
    if (duplicateUser || duplicateStudent) {
      setUserFormError('data yang dimasukan sudah ada');
      return;
    }
    setIsSavingUser(true);
    try {

    const userPayload: Partial<User> = {
      name: userName,
      ...(!ownUser || username !== (ownUser.role === 'dosen' ? ownUser.nidn || ownUser.username : ownUser.username).trim() ? {
        username,
        ...(userRole === 'dosen' ? { nidn: username } : {}),
      } : {}),
      email: userEmail.trim() || `${username.toLowerCase()}@stmik-arungbinang.ac.id`,
      role: userRole,
      title: userTitle,
      rombel: userRombel,
      prodi: userProdi,
    };

    if (editingUserId) {
      await updateUser(editingUserId, userPayload);
    } else {
      await addUser({
        ...userPayload,
        name: userName,
        username,
        role: userRole,
        email: userEmail.trim() || `${username.toLowerCase()}@stmik-arungbinang.ac.id`,
      });
    }
    setIsUserModalOpen(false);
    } catch(error) { setUserFormError(error instanceof Error ? error.message : 'Permintaan gagal.'); } finally { setIsSavingUser(false); }
  };

  // Open Schedule modal
  const handleOpenScheduleModal = (sch?: ScheduleItem) => {
    setSelectedScheduleForEdit(sch || null);
    setIsScheduleModalOpen(true);
  };

  // Schedule filtering & Master DB / Rombel state
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleRombelFilter, setScheduleRombelFilter] = useState('ALL');
  const [scheduleCourseFilter, setScheduleCourseFilter] = useState('ALL');
  const [scheduleDayFilter, setScheduleDayFilter] = useState('ALL');

  // Schedule Roster modal (view students connected to a schedule via Rombel & Mahasiswa database)
  const [rosterSchedule, setRosterSchedule] = useState<ScheduleItem | null>(null);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);

  const handleOpenScheduleRoster = (sch: ScheduleItem) => {
    setRosterSchedule(sch);
    setIsRosterModalOpen(true);
  };

  // Student & Rombel state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [isScheduleDetailModalOpen, setIsScheduleDetailModalOpen] = useState(false);
  const [selectedRombelFilter, setSelectedRombelFilter] = useState<string>('ALL');
  const [studentSearch, setStudentSearch] = useState('');
  const [expandedRombelMatrix, setExpandedRombelMatrix] = useState<string | null>(null);

  // Rombel CRUD Modal state
  const [isRombelModalOpen, setIsRombelModalOpen] = useState(false);
  const [editingRombel, setEditingRombel] = useState<Rombel | null>(null);

  const handleOpenStudentModal = (student?: Student) => {
    setEditingStudent(student || null);
    setIsStudentModalOpen(true);
  };

  const handleViewStudentSchedules = (student: Student) => {
    setDetailStudent(student);
    setIsScheduleDetailModalOpen(true);
  };

  const handleOpenRombelModal = (rombelToEdit?: Rombel) => {
    setEditingRombel(rombelToEdit || null);
    setIsRombelModalOpen(true);
  };

  // Course CRUD, Filter & Archive state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseProdiFilter, setCourseProdiFilter] = useState<string>('ALL');
  const [courseSemesterFilter, setCourseSemesterFilter] = useState<string>('ALL');
  const [courseStatusFilter, setCourseStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  const handleOpenCourseModal = (courseToEdit?: Course) => {
    setEditingCourse(courseToEdit || null);
    setIsCourseModalOpen(true);
  };

  // Rombel archive status filter in Tab 3
  const [rombelStatusFilter, setRombelStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  // Relationship Block Modal state (mencegah penghapusan jika berelasi & tawarkan arsip)
  const [relationshipModalConfig, setRelationshipModalConfig] = useState<{
    isOpen: boolean;
    entityType: 'rombel' | 'course' | 'student';
    entityName: string;
    entityId: string;
    entityCode?: string;
    schedules?: ScheduleItem[];
    students?: Student[];
    sessions?: AttendanceSession[];
    onArchive?: (idOrCode: string) => void;
    isAlreadyArchived?: boolean;
  }>({
    isOpen: false,
    entityType: 'rombel',
    entityName: '',
    entityId: '',
  });

  // Handler for safely deleting / blocking deletion of Rombel
  const handleDeleteRombelRequest = async (rombel: { code: string; id?: string; isArchived?: boolean }) => {
    try {
    const rombelCode = rombel.code;
    const rel = checkRombelRelations(rombelCode);

    if (!rel.canDelete) {
      // PREVENT DELETION! Open RelationshipBlockModal
      setRelationshipModalConfig({
        isOpen: true,
        entityType: 'rombel',
        entityName: `Rombel ${rombelCode}`,
        entityId: rombel.id || `rombel-${rombelCode.toLowerCase()}`,
        entityCode: rombelCode,
        schedules: rel.schedules,
        students: rel.students,
        sessions: rel.sessions,
        isAlreadyArchived: Boolean(rombel.isArchived),
        onArchive: async () => {
          await archiveRombel(rombelCode);
        },
      });
    } else {
      // Safe to delete: show normal confirmation
      setConfirmConfig({
        isOpen: true,
        title: `Hapus Rombel ${rombelCode}?`,
        message: `Rombel ${rombelCode} tidak memiliki relasi dengan jadwal perkuliahan maupun mahasiswa manapun. Apakah Anda yakin ingin menghapus data ini secara permanen?`,
        confirmLabel: 'Ya, Hapus Permanen',
        isDestructive: true,
        onConfirm: async () => {
          if (rombel.id) {
            await deleteRombel(rombel.id);
          } else {
            const found = rombels.find(r => r.code.toUpperCase() === rombelCode.toUpperCase());
            if (found) deleteRombel(found.id);
          }
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        },
      });
    }
    } catch(error) { window.dispatchEvent(new CustomEvent('hadir-api-error',{detail:error instanceof Error?error.message:'Permintaan gagal.'})); } finally {  }
  };

  // Handler for safely deleting / blocking deletion of Course
  const handleDeleteCourseRequest = async (course: Course) => {
    try {
    const rel = checkCourseRelations(course.code);

    if (!rel.canDelete) {
      // PREVENT DELETION! Open RelationshipBlockModal
      setRelationshipModalConfig({
        isOpen: true,
        entityType: 'course',
        entityName: `${course.name} (${course.code})`,
        entityId: course.id,
        entityCode: course.code,
        schedules: rel.schedules,
        sessions: rel.sessions,
        isAlreadyArchived: Boolean(course.isArchived),
        onArchive: async () => {
          await archiveCourse(course.id);
        },
      });
    } else {
      // Safe to delete: show normal confirmation
      setConfirmConfig({
        isOpen: true,
        title: `Hapus Mata Kuliah ${course.name}?`,
        message: `Mata kuliah ${course.name} (${course.code}) tidak terhubung dengan jadwal perkuliahan aktif maupun sesi presensi manapun. Apakah Anda yakin ingin menghapus data ini secara permanen dari Master Database?`,
        confirmLabel: 'Ya, Hapus Permanen',
        isDestructive: true,
        onConfirm: async () => {
          await deleteCourse(course.id);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        },
      });
    }
    } catch(error) { window.dispatchEvent(new CustomEvent('hadir-api-error',{detail:error instanceof Error?error.message:'Permintaan gagal.'})); } finally {  }
  };

  // Unique rombels across master rombels, students & schedules
  const allDistinctRombels = useMemo(() => {
    const set = new Set<string>();
    rombels.forEach(r => {
      if (r.code) set.add(getStudentRombelList(r.code)[0]);
    });
    students.forEach(s => {
      const list = s.rombels && s.rombels.length > 0 ? s.rombels : getStudentRombelList(s.rombel);
      getStudentRombelList(list).forEach(r => set.add(r));
    });
    schedules.forEach(s => {
      const parts = s.rombel ? getStudentRombelList(s.rombel) : [];
      parts.forEach(p => set.add(p));
    });
    return Array.from(set).sort();
  }, [students, schedules, rombels]);

  // Multi-rombel students count
  const multiRombelStudentsCount = useMemo(() => {
    return students.filter(s => {
      const list = s.rombels && s.rombels.length > 0 ? s.rombels : getStudentRombelList(s.rombel);
      return list.length > 1;
    }).length;
  }, [students]);

  // Students exceeding standard 20 SKS limit
  const overLimitSksStudents = useMemo(() => {
    return students.filter(s => {
      const enrolled = getStudentEnrolledSchedules(s, schedules);
      const totalSks = enrolled.reduce((acc, sch) => acc + (sch.sks || 0), 0);
      return totalSks > 20;
    });
  }, [students, schedules]);

  // Filtered students by search & rombel filter (including OVER_20_SKS flag filter)
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = studentSearch.trim().toLowerCase();
      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        s.nim.toLowerCase().includes(q) ||
        (s.rombel && s.rombel.toLowerCase().includes(q)) ||
        (s.prodi && s.prodi.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (selectedRombelFilter === 'ALL') return true;
      if (selectedRombelFilter === 'MULTI') {
        const list = s.rombels && s.rombels.length > 0 ? s.rombels : getStudentRombelList(s.rombel);
        return list.length > 1;
      }
      if (selectedRombelFilter === 'OVER_20_SKS') {
        const enrolled = getStudentEnrolledSchedules(s, schedules);
        const totalSks = enrolled.reduce((acc, sch) => acc + (sch.sks || 0), 0);
        return totalSks > 20;
      }
      return isStudentInRombel(s.rombels && s.rombels.length > 0 ? s.rombels : s.rombel, selectedRombelFilter);
    });
  }, [students, studentSearch, selectedRombelFilter, schedules]);

  // Rombel Matrix grouping: Rombel -> schedules & students
  const rombelMatrix = useMemo(() => {
    return allDistinctRombels.map(rName => {
      const registeredRombel = rombels.find(r => r.code.toUpperCase() === rName.toUpperCase());
      const rombelSchedules = schedules.filter(sch => isStudentInRombel(rName, sch.rombel));
      const rombelStudents = students.filter(stu => isStudentInRombel(stu.rombels && stu.rombels.length > 0 ? stu.rombels : stu.rombel, rName));
      const totalSks = rombelSchedules.reduce((acc, sch) => acc + (sch.sks || 0), 0);
      return {
        rombel: rName,
        rombelData: registeredRombel,
        name: registeredRombel?.name || `Rombel ${rName}`,
        prodi: registeredRombel?.prodi || (rName.startsWith('TI') ? 'Teknologi Informasi' : 'Manajemen Informatika'),
        semester: registeredRombel?.semester,
        academicYear: registeredRombel?.academicYear,
        description: registeredRombel?.description,
        schedules: rombelSchedules,
        students: rombelStudents,
        totalSks,
      };
    });
  }, [allDistinctRombels, schedules, students, rombels]);

  // Filtered Rombels by archive status
  const filteredRombelMatrix = useMemo(() => {
    return rombelMatrix.filter(item => {
      const isArchived = Boolean(item.rombelData?.isArchived);
      if (rombelStatusFilter === 'ACTIVE' && isArchived) return false;
      if (rombelStatusFilter === 'ARCHIVED' && !isArchived) return false;
      return true;
    });
  }, [rombelMatrix, rombelStatusFilter]);

  // Filtered courses by search, prodi, semester, and archive status
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (courseStatusFilter === 'ACTIVE' && c.isArchived) return false;
      if (courseStatusFilter === 'ARCHIVED' && !c.isArchived) return false;

      if (courseProdiFilter !== 'ALL' && c.prodi !== courseProdiFilter) return false;
      if (courseSemesterFilter !== 'ALL' && c.semester !== Number(courseSemesterFilter)) return false;

      if (courseSearch.trim()) {
        const q = courseSearch.toLowerCase();
        const match =
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.defaultLecturerName.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [courses, courseStatusFilter, courseProdiFilter, courseSemesterFilter, courseSearch]);

  // Helper: get count of students enrolled in a schedule's rombel from database
  const getScheduleStudentCount = (rombelStr: string, schedule?: ScheduleItem) => {
    if(schedule)return students.filter(st=>getStudentEnrolledSchedules(st,[schedule]).length>0).length;
    if (!rombelStr) return 0;
    const parts = getStudentRombelList(rombelStr);
    return students.filter(st => {
      return parts.some(p => isStudentInRombel(st.rombel, p, st.rombels));
    }).length;
  };

  // Filtered schedules for Tab 2
  const filteredSchedules = useMemo(() => {
    return schedules.filter(sch => {
      // Day filter
      if (scheduleDayFilter !== 'ALL' && sch.day !== scheduleDayFilter) return false;

      // Rombel filter
      if (scheduleRombelFilter !== 'ALL') {
        const parts = getStudentRombelList(sch.rombel);
        const matchRombel = parts.some(p => isStudentInRombel(scheduleRombelFilter, p) || isStudentInRombel(p, scheduleRombelFilter));
        if (!matchRombel) return false;
      }

      // Course filter
      if (scheduleCourseFilter !== 'ALL') {
        if (sch.courseCode.toLowerCase() !== scheduleCourseFilter.toLowerCase()) return false;
      }

      // Text search
      if (scheduleSearch.trim()) {
        const q = scheduleSearch.toLowerCase();
        const match =
          sch.courseName.toLowerCase().includes(q) ||
          sch.courseCode.toLowerCase().includes(q) ||
          sch.lecturerName.toLowerCase().includes(q) ||
          sch.room.toLowerCase().includes(q) ||
          sch.rombel.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [schedules, scheduleDayFilter, scheduleRombelFilter, scheduleCourseFilter, scheduleSearch]);

  // Schedules connected to Master Courses
  const schedulesConnectedToMaster = useMemo(() => {
    return schedules.filter(sch => {
      return courses.some(
        c => c.code.toLowerCase() === sch.courseCode.toLowerCase() ||
             c.name.toLowerCase() === sch.courseName.toLowerCase()
      );
    });
  }, [schedules, courses]);

  // Unique students connected across schedules
  const totalStudentsEnrolledInSchedules = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach(sch => {
      const parts = getStudentRombelList(sch.rombel);
      students.forEach(st => {
        if (getStudentEnrolledSchedules(st,[sch]).length>0) {
          set.add(st.nim);
        }
      });
    });
    return set.size;
  }, [schedules, students]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;
      const q = searchUser.trim().toLowerCase();
      if (!q) return true;
      return u.name.toLowerCase().includes(q) ||
             u.username.toLowerCase().includes(q) ||
             u.role.toLowerCase().includes(q) ||
             (u.email && u.email.toLowerCase().includes(q)) ||
             (u.rombel && u.rombel.toLowerCase().includes(q)) ||
             (u.prodi && u.prodi.toLowerCase().includes(q));
    });
  }, [users, userRoleFilter, searchUser]);

  const handleSyncStudentAccounts = async () => {
    try {
    const res = await syncStudentUsers();
    setSyncToastMessage(`Sinkronisasi Berhasil! Seluruh ${res.count} mahasiswa terdaftar kini memiliki akun pengguna aktif untuk Login & Presensi QR (${res.added} akun baru dibuat, ${res.updated} diperbarui).`);
    setTimeout(async () => {
      setSyncToastMessage(null);
    }, 5000);
    } catch(error) { window.dispatchEvent(new CustomEvent('hadir-api-error',{detail:error instanceof Error?error.message:'Permintaan gagal.'})); } finally {  }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Admin Frost-UI Header */}
      <div className="frost-card p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[8px] bg-[#E4F2FF] border border-[#0080FF]/20 flex items-center justify-center text-[#0080FF] shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-[#555555] font-medium">
                <span>Panel Administrator BAAK & IT</span>
                <span aria-hidden="true">·</span>
                <span>Hak Akses Penuh Sistem</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#222222] tracking-tight">
                Kelola Basis Data & Jadwal Kampus
              </h2>
              <p className="text-xs sm:text-sm text-[#555555]">
                Sinkronisasi data mahasiswa, jadwal perkuliahan, mata kuliah, dan rekapitulasi kehadiran
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenProfile && (
              <button
                onClick={onOpenProfile}
                data-frost="Button"
                className="frost-btn frost-btn-sm frost-btn-subtle frost-btn-brand"
                title="Konfigurasi Profil Petugas BAAK & Ganti Password dengan OTP Email"
              >
                <UserCog className="w-4 h-4" />
                <span>Profil BAAK</span>
              </button>
            )}

            <button
              onClick={() => handleOpenBulkImport('all')}
              data-frost="Button"
              className="frost-btn frost-btn-sm frost-btn-subtle frost-btn-teal"
              title="Unggah dan perbarui data massal dari file Excel (Jadwal, Pengguna, Mahasiswa, Mata Kuliah)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Impor Excel Massal</span>
            </button>

            <button
              onClick={() => setIsBackupModalOpen(true)}
              data-frost="Button"
              className="frost-btn frost-btn-sm frost-btn-solid frost-btn-brand"
              title="Cadangkan, Ekspor, dan Pulihkan Database Proyek"
            >
              <Database className="w-4 h-4" />
              <span>Backup & Pulihkan DB</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              data-frost="Button"
              className="frost-btn frost-btn-sm frost-btn-solid frost-btn-neutral"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Master Presensi</span>
            </button>

            <button
              onClick={async () => {
                setConfirmConfig({
                  isOpen: true,
                  title: 'Reset ke Data Default?',
                  message: 'Tindakan ini akan mengembalikan seluruh jadwal, pengguna, sesi presensi, dan data mahasiswa ke kondisi bawaan STMIK PGRI Arungbinang Kebumen.',
                  confirmLabel: 'Ya, Reset Data',
                  isDestructive: true,
                  onConfirm: async () => {
                    await resetToDefaultData();
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                  },
                });
              }}
              data-frost="Button"
              className="frost-btn frost-btn-sm frost-btn-outline frost-btn-neutral"
              title="Reset data ke bawaan dokumen"
            >
              <RefreshCw className="w-4 h-4 text-[#555555]" />
              <span>Reset Data Default</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Summary Statistics Component for Admin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Stat 1: Classes Today */}
        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs font-semibold">Kelas Kampus Hari Ini</span>
            <Calendar className="w-4 h-4 text-[#555555]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#222222] tracking-tight tabular-nums">
              {todayCampusSchedules.length} Kelas
            </div>
            <p className="text-xs text-[#555555] mt-1.5">
              Hari {activeDay} · {schedules.length} total sesi per minggu
            </p>
          </div>
        </div>

        {/* Stat 2: Active Sessions */}
        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs font-semibold">Sesi Presensi Terbuka</span>
            <Clock className="w-4 h-4 text-[#0080FF]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#222222] tracking-tight flex items-center gap-2 tabular-nums">
              <span>{openSessionsCount} Sesi</span>
              {openSessionsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#009499]"></span>
              )}
            </div>
            <p className="text-xs text-[#555555] mt-1.5 truncate">
              {openSessionsCount > 0
                ? 'Dosen sedang membuka presensi real-time'
                : 'Tidak ada sesi terbuka saat ini'}
            </p>
          </div>
        </div>

        {/* Stat 3: Campus Attendance Rate */}
        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs font-semibold">Rata-rata Kehadiran Kampus</span>
            <Users className="w-4 h-4 text-[#009499]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#222222] tracking-tight tabular-nums">
              {campusAttendanceRate}%
            </div>
            <p className="text-xs text-[#555555] mt-1.5 tabular-nums">
              Kehadiran efektif {totalCampusHadir}/{totalCampusRecords}; hadir aktual {campusPolicy.rawHadir}. Toleransi Izin/Sakit masing-masing 2.
            </p>
          </div>
        </div>

        {/* Stat 4: Total Campus Community */}
        <div className="frost-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between text-[#555555]">
            <span className="text-xs font-semibold">Komunitas Terdaftar</span>
            <GraduationCap className="w-4 h-4 text-[#555555]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#222222] tracking-tight tabular-nums">
              {students.length} Mhs · {users.filter(u => u.role === 'dosen').length} Dosen
            </div>
            <p className="text-xs text-[#555555] mt-1.5 tabular-nums">
              {courses.length} mata kuliah aktif kurikulum
            </p>
          </div>
        </div>
      </div>

      <div className="frost-callout flex flex-wrap items-center justify-between gap-3" aria-label="Lingkup data admin">
        <div><strong>{demoScope ? 'DATA DEMO' : 'Data Akademik Reguler'}</strong><p className="text-sm">{demoScope ? 'Hanya akun, jadwal, sesi, dan presensi demo. Tidak masuk laporan akademik reguler.' : 'Data demo dikelola terpisah dari data akademik reguler.'}</p></div>
        <button type="button" disabled={loading} className="frost-btn-secondary" onClick={() => void switchScope(!demoScope)}>{demoScope ? 'Kembali ke Data Reguler' : 'Data Demo'}</button>
      </div>
      {/* Admin Nav Tabs */}
      <div className="frost-tabs" aria-label={demoScope ? 'Menu Data Demo' : 'Menu Data Reguler'}>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`frost-tab-btn ${activeTab === 'sessions' ? 'frost-tab-btn-active' : ''}`}
        >
          <span>Monitoring Sesi ({sessions.length})</span>
          {openSessionsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#009499]"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          className={`frost-tab-btn ${activeTab === 'schedules' ? 'frost-tab-btn-active' : ''}`}
        >
          Jadwal Perkuliahan ({schedules.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`frost-tab-btn ${activeTab === 'users' ? 'frost-tab-btn-active' : ''}`}
        >
          Kelola Pengguna ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`frost-tab-btn ${activeTab === 'students' ? 'frost-tab-btn-active' : ''}`}
        >
          Rombel & Mahasiswa ({students.length})
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`frost-tab-btn ${activeTab === 'courses' ? 'frost-tab-btn-active' : ''}`}
        >
          Master Mata Kuliah ({courses.length})
        </button>

        {!demoScope && <button
          onClick={() => setActiveTab('database')}
          className={`frost-tab-btn ${activeTab === 'database' ? 'frost-tab-btn-active' : ''}`}
        >
          <Database className="w-4 h-4" />
          <span>Cadangan & Database</span>
        </button>}

        {!demoScope && <button
          onClick={() => setActiveTab('devices')}
          className={`frost-tab-btn ${activeTab === 'devices' ? 'frost-tab-btn-active' : ''}`}
        >
          <Laptop className="w-4 h-4" />
          <span>Sesi & Perangkat Kampus ({deviceSessions.filter(s => s.status === 'ACTIVE').length})</span>
        </button>}
      </div>

      {/* TAB 0: SESSIONS MONITORING & CONTROL */}
      {activeTab === 'sessions' && <SessionMonitoringTab />}

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="frost-card p-6 sm:p-7 space-y-6">
          <AccountActivationPanel />
          {/* Student Account Sync Status Card */}
          <div className="frost-callout frost-callout-success flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-[6px] bg-[#009499] text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-[#014C4F]">
                    Otomasi Akun Mahasiswa Terdaftar
                  </h4>
                  <span className="text-xs font-semibold text-[#009499]">
                    · 100% Terintegrasi
                  </span>
                </div>
                <p className="text-xs text-[#015D60] mt-1 leading-relaxed">
                  Setiap nama mahasiswa yang terdaftar dalam sistem (<strong>{students.length} mahasiswa</strong>) wajib dan otomatis memiliki akun pengguna aktif (<strong>{users.filter(u => u.role === 'mahasiswa').length} akun mahasiswa</strong>) dengan kredensial NIM untuk melakukan presensi QR perkuliahan tanpa error.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSyncStudentAccounts}
                data-frost="Button"
                className="frost-btn frost-btn-xs frost-btn-solid frost-btn-teal w-full sm:w-auto"
                title="Sinkronkan seluruh data mahasiswa terdaftar ke akun pengguna sistem"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sinkronkan Akun Mahasiswa</span>
              </button>
            </div>
          </div>

          {/* Sync Toast Notification */}
          {syncToastMessage && (
            <div className="frost-callout frost-callout-success text-xs sm:text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#009499] shrink-0" />
              <span>{syncToastMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#eeeeee]">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#222222]">Daftar Akun Pengguna Sistem</h3>
              <p className="text-xs text-[#555555]">Kelola akun Dosen, Mahasiswa, dan Administrator Kampus</p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-4 h-4 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama, NIM, email..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="frost-input frost-input-sm pl-9 pr-3 w-full sm:w-56"
                />
              </div>

              <button
                onClick={() => handleOpenBulkImport('users')}
                data-frost="Button"
                className="frost-btn frost-btn-xs frost-btn-subtle frost-btn-teal shrink-0"
                title="Impor pengguna dari file Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Import Excel</span>
              </button>

              <button
                onClick={() => handleOpenUserModal()}
                data-frost="Button"
                className="frost-btn frost-btn-xs frost-btn-solid frost-btn-brand shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Tambah Pengguna</span>
              </button>
            </div>
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
            <span className="text-[#777777] mr-1 uppercase tracking-wider text-[11px]">Filter Peran:</span>
            <button
              type="button"
              onClick={() => setUserRoleFilter('ALL')}
              className={`px-3.5 py-2 rounded-[6px] transition cursor-pointer border ${
                userRoleFilter === 'ALL'
                  ? 'bg-[#222222] text-white border-[#222222]'
                  : 'bg-white text-[#555555] border-[#dddddd] hover:bg-[#f5f5f5]'
              }`}
            >
              Semua Pengguna ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setUserRoleFilter('mahasiswa')}
              className={`px-3.5 py-2 rounded-[6px] transition cursor-pointer border flex items-center gap-1.5 ${
                userRoleFilter === 'mahasiswa'
                  ? 'bg-[#0080FF] text-white border-[#0080FF]'
                  : 'bg-white text-[#555555] border-[#dddddd] hover:bg-[#f5f5f5]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Mahasiswa ({users.filter(u => u.role === 'mahasiswa').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setUserRoleFilter('dosen')}
              className={`px-3.5 py-2 rounded-[6px] transition cursor-pointer border flex items-center gap-1.5 ${
                userRoleFilter === 'dosen'
                  ? 'bg-[#009499] text-white border-[#009499]'
                  : 'bg-white text-[#555555] border-[#dddddd] hover:bg-[#f5f5f5]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Dosen Pengampu ({users.filter(u => u.role === 'dosen').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setUserRoleFilter('admin')}
              className={`px-3.5 py-2 rounded-[6px] transition cursor-pointer border flex items-center gap-1.5 ${
                userRoleFilter === 'admin'
                  ? 'bg-[#7A45E5] text-white border-[#7A45E5]'
                  : 'bg-white text-[#555555] border-[#dddddd] hover:bg-[#f5f5f5]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Administrator ({users.filter(u => u.role === 'admin').length})</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-[#dddddd] rounded-[6px]">
            <table className="w-full text-sm text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#dddddd] text-[#555555] font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4">Pengguna</th>
                  <th className="py-3.5 px-4">NIDN / NIM</th>
                  <th className="py-3.5 px-4">Peran (Role)</th>
                  <th className="py-3.5 px-4">Keterangan / Rombel</th>
                  <th className="py-3.5 px-4">Email Kampus</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eeeeee]">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#fafafa] transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[6px] bg-[#E4F2FF] border border-[#0080FF]/20 text-[#0080FF] font-bold text-xs flex items-center justify-center shrink-0">
                          {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover rounded-[6px]" /> : user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="font-semibold text-[#222222]">{user.name}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-[#222222] tabular-nums">{user.username}</td>
                    <td className="py-3.5 px-4">
                      {user.role === 'mahasiswa' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#E4F2FF] text-[#015BB5]">
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>Mahasiswa</span>
                        </span>
                      ) : user.role === 'dosen' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#E5F6F5] text-[#016F73]">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Dosen</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#F2ECFC] text-[#5B34AC]">
                          <Shield className="w-3.5 h-3.5" />
                          <span>Admin BAAK</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#555555]">
                      {user.role === 'mahasiswa' ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-[#222222]">
                            {user.rombel ? `Rombel ${user.rombel}` : '-'}
                          </span>
                          <span className="block text-[11px] text-[#009499] font-medium">
                            Akun Presensi QR Aktif
                          </span>
                        </div>
                      ) : (
                        user.rombel ? `Rombel ${user.rombel}` : user.title || '-'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-[#222222] font-mono text-xs">{user.email || '-'}</div>
                      {user.hasCredentials ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#016F73] font-semibold bg-[#E5F6F5] px-1.5 py-0.5 rounded-[4px] mt-1">
                          Sandi Kustom Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#777777]">
                          (Belum diaktivasi)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenUserModal(user)}
                          className="p-1.5 text-[#555555] hover:text-[#222222] hover:bg-[#eeeeee] rounded-[4px] transition cursor-pointer"
                          title="Edit Pengguna"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            setConfirmConfig({
                              isOpen: true,
                              title: 'Hapus Pengguna?',
                              message: `Apakah Anda yakin ingin menghapus akun ${user.name} (${user.username})? Tindakan ini tidak dapat dibatalkan.`,
                              confirmLabel: 'Ya, Hapus',
                              isDestructive: true,
                              onConfirm: async () => {
                                await deleteUser(user.id);
                                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          className="p-1.5 text-[#555555] hover:text-[#E54545] hover:bg-[#FCEBEC] rounded-[4px] transition cursor-pointer"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULE MANAGEMENT WITH MASTER MK & ROMBEL-MAHASISWA DATABASE RELATIONS */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          {/* Main Card: Schedules, Metrics & Actions */}
          <div className="frost-card p-6 sm:p-7 space-y-6">
            {/* Header & Main Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#eeeeee]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#555555] font-medium">
                  <span className="text-[#009499] font-semibold">Sistem Akademik Terpadu</span>
                  <span>·</span>
                  <span>Semester Ganjil 2026/2027</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#222222]">
                  Manajemen Jadwal Perkuliahan ({schedules.length})
                </h3>
                <p className="text-xs text-[#555555]">
                  Rombel terhubung langsung dengan database Rombel & Mahasiswa, serta Kode dan Mata Kuliah terhubung dengan database master mata kuliah.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => handleOpenBulkImport('schedules')}
                  data-frost="Button"
                  className="frost-btn frost-btn-xs frost-btn-subtle frost-btn-teal"
                  title="Impor jadwal perkuliahan dari file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import Excel Jadwal</span>
                </button>

                <button
                  onClick={() => handleOpenScheduleModal()}
                  data-frost="Button"
                  className="frost-btn frost-btn-xs frost-btn-solid frost-btn-brand"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Jadwal Baru</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar: Master MK & Rombel-Mahasiswa Integration */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 sm:p-5 rounded-[6px] bg-[#fafafa] border border-[#dddddd]">
                <div className="flex items-center justify-between text-[#555555] mb-2">
                  <span className="text-xs font-semibold">Total Jadwal Aktif</span>
                  <Calendar className="w-4 h-4 text-[#777777]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#222222] tabular-nums">
                  {schedules.length}
                </div>
                <div className="text-[11px] text-[#555555] mt-1">
                  Jadwal perkuliahan mingguan
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-[6px] bg-[#E5F6F5]/60 border border-[#B0DFDF]">
                <div className="flex items-center justify-between text-[#015D60] mb-2">
                  <span className="text-xs font-semibold">Terhubung Master MK</span>
                  <BookmarkCheck className="w-4 h-4 text-[#009499]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#014C4F] tabular-nums">
                  {schedulesConnectedToMaster.length} / {schedules.length}
                </div>
                <div className="text-[11px] text-[#016F73] font-medium mt-1 tabular-nums">
                  {Math.round((schedulesConnectedToMaster.length / (schedules.length || 1)) * 100)}% Terhubung Database Master MK
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-[6px] bg-[#E4F2FF]/60 border border-[#ADCEFF]">
                <div className="flex items-center justify-between text-[#015BB5] mb-2">
                  <span className="text-xs font-semibold">Rombel Terdaftar</span>
                  <Layers className="w-4 h-4 text-[#0080FF]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#003F8A] tabular-nums">
                  {rombels.length}
                </div>
                <div className="text-[11px] text-[#015BB5] font-medium mt-1">
                  Kelas dari Database Rombel
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-[6px] bg-[#F2ECFC]/60 border border-[#D4BFEE]">
                <div className="flex items-center justify-between text-[#5B34AC] mb-2">
                  <span className="text-xs font-semibold">Mahasiswa Terhubung</span>
                  <Users className="w-4 h-4 text-[#7A45E5]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#3D2273] tabular-nums">
                  {totalStudentsEnrolledInSchedules}
                </div>
                <div className="text-[11px] text-[#5B34AC] font-medium mt-1">
                  Mahasiswa otomatis tersinkron
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 bg-[#fafafa] border border-[#dddddd] rounded-[6px] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari mata kuliah, kode MK, dosen, ruang, atau rombel..."
                    value={scheduleSearch}
                    onChange={(e) => setScheduleSearch(e.target.value)}
                    className="frost-input frost-input-sm pl-9 pr-3"
                  />
                </div>

                {/* Dropdown Filters */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Rombel Filter from Database */}
                  <select
                    value={scheduleRombelFilter}
                    onChange={(e) => setScheduleRombelFilter(e.target.value)}
                    className="frost-select text-xs font-semibold h-9 py-1"
                  >
                    <option value="ALL">Semua Rombel ({allDistinctRombels.length})</option>
                    {allDistinctRombels.map(rCode => {
                      const count = getScheduleStudentCount(rCode);
                      return (
                        <option key={rCode} value={rCode}>
                          Rombel {rCode} ({count} Mhs)
                        </option>
                      );
                    })}
                  </select>

                  {/* Master Course Filter */}
                  <select
                    value={scheduleCourseFilter}
                    onChange={(e) => setScheduleCourseFilter(e.target.value)}
                    className="frost-select text-xs font-semibold h-9 py-1 max-w-[220px]"
                  >
                    <option value="ALL">Semua Master MK ({courses.length})</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Day Filter */}
                  <select
                    value={scheduleDayFilter}
                    onChange={(e) => setScheduleDayFilter(e.target.value)}
                    className="frost-select text-xs font-semibold h-9 py-1"
                  >
                    <option value="ALL">Semua Hari</option>
                    {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  {/* Reset Button */}
                  {(scheduleSearch || scheduleRombelFilter !== 'ALL' || scheduleCourseFilter !== 'ALL' || scheduleDayFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={async () => {
                        setScheduleSearch('');
                        setScheduleRombelFilter('ALL');
                        setScheduleCourseFilter('ALL');
                        setScheduleDayFilter('ALL');
                      }}
                      data-frost="Button"
                      className="frost-btn frost-btn-xs frost-btn-subtle frost-btn-danger"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Schedules Table */}
            <div className="overflow-x-auto border border-[#dddddd] rounded-[6px]">
              <table className="w-full text-sm text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#dddddd] text-[#555555] font-semibold text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4">Hari & Jam</th>
                    <th className="py-3.5 px-4">Kode & Mata Kuliah (Master MK)</th>
                    <th className="py-3.5 px-4 text-center">SKS</th>
                    <th className="py-3.5 px-4">Dosen Pengampu</th>
                    <th className="py-3.5 px-4">Ruang</th>
                    <th className="py-3.5 px-4">Rombel & Mahasiswa</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eeeeee]">
                  {filteredSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#555555] text-sm">
                        <div className="max-w-md mx-auto space-y-2">
                          <p className="font-semibold text-[#222222]">Tidak ada jadwal perkuliahan yang cocok</p>
                          <p className="text-xs text-[#777777]">
                            Coba ubah kata kunci pencarian, filter rombel, atau filter mata kuliah.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSchedules.map((sch) => {
                      const masterMatch = courses.find(
                        c => c.code.toLowerCase() === sch.courseCode.toLowerCase() ||
                             c.name.toLowerCase() === sch.courseName.toLowerCase()
                      );
                      const studentCount = getScheduleStudentCount(sch.rombel,sch);

                      return (
                        <tr key={sch.id} className="hover:bg-[#fafafa] transition">
                          {/* Hari & Jam */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-[#222222] block">{sch.day}</span>
                            <span className="text-xs text-[#555555] font-mono tabular-nums flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-[#777777]" />
                              {sch.startTime}–{sch.endTime} WIB
                            </span>
                          </td>

                          {/* Kode & Mata Kuliah (Master DB Sync) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-[4px] bg-[#f5f5f5] text-[#222222] border border-[#dddddd]">
                                {sch.courseCode}
                              </span>
                              <div className="font-bold text-[#222222]">{sch.courseName}</div>
                            </div>
                            
                            {/* Master Database Relation Badge */}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {sch.prodi === 'Lintas Program Studi' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5B34AC] bg-[#F2ECFC] px-2 py-0.5 rounded-[4px]">
                                  <GitMerge className="w-3 h-3" />
                                  <span>Lintas Program Studi</span>
                                </span>
                              ) : masterMatch ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#016F73] bg-[#E5F6F5] px-2 py-0.5 rounded-[4px]">
                                  <BookmarkCheck className="w-3 h-3" />
                                  <span>Master MK · Sem {masterMatch.semester || '-'} · {sch.prodi}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#777777]">
                                  {sch.prodi}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* SKS */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-1 rounded-[4px] bg-[#f5f5f5] text-[#222222] font-bold text-xs tabular-nums">
                              {sch.sks} SKS
                            </span>
                          </td>

                          {/* Dosen Pengampu */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[#222222]">{sch.lecturerName}</div>
                            <div className="text-[11px] text-[#555555]">Dosen Pengampu</div>
                          </td>

                          {/* Ruang */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-semibold px-2 py-0.5 rounded-[4px] bg-[#f5f5f5] text-[#222222] border border-[#dddddd] text-xs">
                              {sch.room}
                            </span>
                          </td>

                          {/* Rombel & Mahasiswa Connection */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="font-bold text-xs bg-[#E4F2FF] text-[#015BB5] px-2 py-0.5 rounded-[4px]">
                                Rombel {sch.rombel}
                              </span>
                              
                              <button
                                type="button"
                                onClick={() => handleOpenScheduleRoster(sch)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0080FF] hover:underline cursor-pointer tabular-nums"
                                title="Klik untuk melihat daftar mahasiswa terhubung di rombel ini"
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>{studentCount} Mahasiswa Terdaftar</span>
                              </button>
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenScheduleRoster(sch)}
                                className="p-1.5 text-[#555555] hover:text-[#0080FF] hover:bg-[#E4F2FF] rounded-[4px] transition cursor-pointer"
                                title="Lihat Daftar Mahasiswa Terhubung"
                              >
                                <Users className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenScheduleModal(sch)}
                                className="p-1.5 text-[#555555] hover:text-[#222222] hover:bg-[#eeeeee] rounded-[4px] transition cursor-pointer"
                                title="Edit Jadwal"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setConfirmConfig({
                                    isOpen: true,
                                    title: 'Hapus Jadwal Kuliah?',
                                    message: `Apakah Anda yakin ingin menghapus jadwal ${sch.courseName} (${sch.day}, ${sch.startTime}–${sch.endTime}) untuk rombel ${sch.rombel}?`,
                                    confirmLabel: 'Ya, Hapus Jadwal',
                                    isDestructive: true,
                                    onConfirm: async () => {
                                      await deleteSchedule(sch.id);
                                      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                    },
                                  });
                                }}
                                className="p-1.5 text-[#555555] hover:text-[#E54545] hover:bg-[#FCEBEC] rounded-[4px] transition cursor-pointer"
                                title="Hapus Jadwal"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STUDENTS & ROMBEL RELATIONS */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Main Card: Student Roster & Actions */}
          <div className="frost-card p-6 sm:p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#eeeeee]">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#555555] font-medium">
                  <span className="text-[#0080FF] font-semibold">Sistem Relasi Akademik</span>
                  <span>·</span>
                  <span>Semester Ganjil 2026/2027</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#222222] mt-1">
                  Data Peserta Rombel Mahasiswa & Relasi Jadwal ({students.length})
                </h3>
                <p className="text-xs text-[#555555] mt-0.5">
                  Mahasiswa dikelompokkan berdasarkan rombel (1 mahasiswa dapat berada di &gt;1 rombel). Setiap rombel otomatis terhubung ke jadwal mata kuliah masing-masing.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleOpenBulkImport('students')}
                  data-frost="Button"
                  className="frost-btn frost-btn-xs frost-btn-subtle frost-btn-teal"
                  title="Impor rombel mahasiswa dari file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import Excel Mahasiswa</span>
                </button>

                <button
                  onClick={() => handleOpenRombelModal()}
                  data-frost="Button"
                  className="frost-btn frost-btn-xs frost-btn-solid frost-btn-neutral"
                  title="Tambah Rombel baru dan hubungkan ke beberapa jadwal mata kuliah"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buat Rombel Baru</span>
                </button>

                <button
                  onClick={() => handleOpenStudentModal()}
                  data-frost="Button"
                  className="frost-btn frost-btn-xs frost-btn-solid frost-btn-brand"
                  title="Tambah mahasiswa baru dan atur pilihan rombelnya"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah Mahasiswa &amp; Rombel</span>
                </button>
              </div>
            </div>

            {/* Warning Alert Banner for Students with > 20 SKS */}
            {overLimitSksStudents.length > 0 && (
              <div className="frost-callout frost-callout-warning flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[6px] bg-[#FF8001] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#E54545] text-white text-[11px] font-bold">
                        PERINGATAN BEBAN STUDI (&gt; 20 SKS)
                      </span>
                      <span className="text-xs text-[#914900] font-semibold">Batas Regulasi Kampus: Maks. 20 SKS / Semester</span>
                    </div>
                    <h4 className="text-sm font-bold text-[#222222] mt-1">
                      Ditemukan {overLimitSksStudents.length} Mahasiswa Memiliki Mata Kuliah Lebih dari 20 SKS
                    </h4>
                    <p className="text-xs text-[#555555] mt-0.5 max-w-2xl leading-relaxed">
                      Sistem mendeteksi mahasiswa dengan beban studi melampaui batas standar 20 SKS. Anda dapat memfilter mahasiswa di bawah dan mengklik tombol <strong>"Ubah SKS"</strong> untuk menyesuaikan rombel atau mendrop mata kuliah.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedRombelFilter(selectedRombelFilter === 'OVER_20_SKS' ? 'ALL' : 'OVER_20_SKS')}
                    data-frost="Button"
                    className={`frost-btn frost-btn-xs w-full md:w-auto ${
                      selectedRombelFilter === 'OVER_20_SKS'
                        ? 'frost-btn-solid frost-btn-neutral'
                        : 'frost-btn-solid frost-btn-danger'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{selectedRombelFilter === 'OVER_20_SKS' ? 'Tampilkan Semua Mahasiswa' : `Filter ${overLimitSksStudents.length} Mahasiswa (>20 SKS)`}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 bg-[#fafafa] border border-[#dddddd] rounded-[6px]">
                <span className="text-xs text-[#555555] font-medium block">Total Mahasiswa</span>
                <span className="text-xl font-bold text-[#222222] tracking-tight mt-0.5 block tabular-nums">
                  {students.length} <span className="text-xs font-normal text-[#555555]">Orang</span>
                </span>
              </div>

              <div className="p-3.5 bg-[#fafafa] border border-[#dddddd] rounded-[6px]">
                <span className="text-xs text-[#555555] font-medium block">Rombel Aktif</span>
                <span className="text-xl font-bold text-[#0080FF] tracking-tight mt-0.5 block tabular-nums">
                  {allDistinctRombels.length} <span className="text-xs font-normal text-[#555555]">Rombel</span>
                </span>
              </div>

              <div className="p-3.5 bg-[#F2ECFC]/60 border border-[#D4BFEE] rounded-[6px]">
                <span className="text-xs text-[#5B34AC] font-medium block">Multi-Rombel (&gt;1 Rombel)</span>
                <span className="text-xl font-bold text-[#3D2273] tracking-tight mt-0.5 block tabular-nums">
                  {multiRombelStudentsCount} <span className="text-xs font-normal text-[#5B34AC]">Mahasiswa</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRombelFilter(selectedRombelFilter === 'OVER_20_SKS' ? 'ALL' : 'OVER_20_SKS')}
                className={`p-3.5 rounded-[6px] border text-left transition cursor-pointer ${
                  selectedRombelFilter === 'OVER_20_SKS'
                    ? 'bg-[#FCEBEC] border-[#E54545]'
                    : overLimitSksStudents.length > 0
                      ? 'bg-[#FCEBEC]/60 border-[#F4BCBD] hover:bg-[#FCEBEC]'
                      : 'bg-[#fafafa] border-[#dddddd]'
                }`}
                title="Klik untuk memfilter mahasiswa dengan beban studi melebihi 20 SKS"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#AC292A] font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#E54545]" />
                    <span>SKS &gt; 20 (Flag)</span>
                  </span>
                  {overLimitSksStudents.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[#E54545]" />
                  )}
                </div>
                <span className="text-xl font-bold text-[#731B1B] tracking-tight mt-0.5 block tabular-nums">
                  {overLimitSksStudents.length} <span className="text-xs font-normal text-[#AC292A]">Mahasiswa</span>
                </span>
              </button>

              <div className="p-3.5 bg-[#fafafa] border border-[#dddddd] rounded-[6px]">
                <span className="text-xs text-[#555555] font-medium block">Jadwal Kuliah Terhubung</span>
                <span className="text-xl font-bold text-[#222222] tracking-tight mt-0.5 block tabular-nums">
                  {schedules.length} <span className="text-xs font-normal text-[#555555]">Kelas</span>
                </span>
              </div>
            </div>

            {/* Search and Rombel Filter Chips */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Cari mahasiswa berdasarkan NIM, nama, atau rombel..."
                    className="frost-input frost-input-sm pl-9 pr-14"
                  />
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#777777] hover:text-[#222222] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="text-xs text-[#555555] font-medium shrink-0 tabular-nums">
                  Menampilkan <strong className="text-[#222222]">{filteredStudents.length}</strong> dari {students.length} mahasiswa
                </div>
              </div>

              {/* Rombel Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedRombelFilter('ALL')}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold shrink-0 transition cursor-pointer border ${
                    selectedRombelFilter === 'ALL'
                      ? 'bg-[#222222] text-white border-[#222222]'
                      : 'bg-white text-[#555555] border-[#dddddd] hover:bg-[#f5f5f5]'
                  }`}
                >
                  Semua Rombel ({students.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRombelFilter('OVER_20_SKS')}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold shrink-0 transition cursor-pointer border flex items-center gap-1.5 ${
                    selectedRombelFilter === 'OVER_20_SKS'
                      ? 'bg-[#E54545] text-white border-[#E54545]'
                      : overLimitSksStudents.length > 0
                        ? 'bg-[#FCEBEC] text-[#AC292A] border-[#F4BCBD] hover:bg-[#F9D7D7]'
                        : 'bg-white text-[#555555] border-[#dddddd] hover:bg-[#f5f5f5]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>SKS &gt; 20 ({overLimitSksStudents.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRombelFilter('MULTI')}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold shrink-0 transition cursor-pointer border ${
                    selectedRombelFilter === 'MULTI'
                      ? 'bg-[#7A45E5] text-white border-[#7A45E5]'
                      : 'bg-[#F2ECFC] text-[#5B34AC] border-[#D4BFEE] hover:bg-[#E6DAFA]'
                  }`}
                >
                  Multi-Rombel ({multiRombelStudentsCount})
                </button>

                {allDistinctRombels.map((rName) => {
                  const countInRombel = students.filter(s =>
                    isStudentInRombel(s.rombels && s.rombels.length > 0 ? s.rombels : s.rombel, rName)
                  ).length;
                  const isSelected = selectedRombelFilter === rName;

                  return (
                    <button
                      key={rName}
                      type="button"
                      onClick={() => setSelectedRombelFilter(rName)}
                      className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold shrink-0 transition cursor-pointer border ${
                        isSelected
                          ? 'bg-[#0080FF] text-white border-[#0080FF]'
                          : 'bg-white text-[#222222] border-[#dddddd] hover:border-[#0080FF] hover:bg-[#E4F2FF]/40'
                      }`}
                    >
                      <span>Rombel {rName}</span>
                      <span className={`ml-1.5 px-1.5 py-0.2 rounded-[4px] text-[10px] tabular-nums ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#f5f5f5] text-[#555555]'
                      }`}>
                        {countInRombel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto border border-[#dddddd] rounded-[6px]">
              <table className="w-full text-xs sm:text-sm text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#dddddd] text-[#555555] font-semibold text-xs uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-12 text-center">No</th>
                    <th className="py-3 px-3.5">NIM &amp; Akun</th>
                    <th className="py-3 px-3.5">Nama Mahasiswa</th>
                    <th className="py-3 px-3.5">Program Studi</th>
                    <th className="py-3 px-3.5">Rombel Terdaftar</th>
                    <th className="py-3 px-3.5">Jadwal Terhubung</th>
                    <th className="py-3 px-3.5 text-right w-36">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eeeeee]">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[#555555]">
                        <Users className="w-8 h-8 mx-auto text-[#777777] mb-2 opacity-50" />
                        <p className="font-semibold text-[#222222]">Tidak ada data mahasiswa ditemukan</p>
                        <p className="text-xs text-[#777777] mt-0.5">
                          Coba ubah kata kunci pencarian atau pilih rombel yang lain.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, idx) => {
                      const rombelList = student.rombels && student.rombels.length > 0
                        ? student.rombels
                        : getStudentRombelList(student.rombel);
                      
                      const linked = getStudentEnrolledSchedules(student, schedules);
                      const totalSks = linked.reduce((acc, sch) => acc + (sch.sks || 0), 0);
                      const isMulti = rombelList.length > 1;
                      const isOverSks = totalSks > 20;

                      return (
                        <tr
                          key={student.nim}
                          className={`transition ${
                            isOverSks
                              ? 'bg-[#FFF3E4]/60 hover:bg-[#FFF3E4]'
                              : 'hover:bg-[#fafafa]'
                          }`}
                        >
                          <td className="py-3.5 px-3.5 text-center text-[#777777] font-mono tabular-nums">
                            {idx + 1}
                          </td>

                          <td className="py-3.5 px-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-[#222222] bg-[#f5f5f5] px-2 py-0.5 rounded-[4px] border border-[#dddddd] tabular-nums">
                                {student.nim}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold bg-[#E5F6F5] text-[#016F73]"
                                title="Akun Pengguna Aktif untuk Login Mahasiswa & Presensi QR"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-[#009499]" />
                                <span>Akun Aktif</span>
                              </span>
                              {isOverSks && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#E54545] text-white font-bold text-[10px]">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Flag: &gt;20 SKS</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#777777] font-mono mt-0.5 truncate max-w-[150px]">
                              {student.email}
                            </div>
                          </td>

                          <td className="py-3.5 px-3.5">
                            <div className="font-bold text-[#222222]">{student.name}</div>
                            {student.phone && (
                              <div className="text-[11px] text-[#777777]">{student.phone}</div>
                            )}
                            {student.excludedScheduleIds && student.excludedScheduleIds.length > 0 && (
                              <div className="text-[10px] text-[#B55B00] font-semibold mt-0.5">
                                ({student.excludedScheduleIds.length} matkul di-drop)
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-3.5 text-[#222222] font-medium">
                            <span className={`inline-block px-2 py-0.5 rounded-[4px] text-[11px] font-semibold ${
                              student.prodi === 'Teknologi Informasi'
                                ? 'bg-[#E4F2FF] text-[#015BB5]'
                                : 'bg-[#E5F6F5] text-[#016F73]'
                            }`}>
                              {student.prodi}
                            </span>
                          </td>

                          <td className="py-3.5 px-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {rombelList.map((r) => (
                                <span
                                  key={r}
                                  className="px-2 py-0.5 rounded-[4px] bg-[#E4F2FF] text-[#015BB5] font-bold text-xs"
                                >
                                  {r}
                                </span>
                              ))}
                              {isMulti && (
                                <span className="px-1.5 py-0.5 rounded-[4px] bg-[#F2ECFC] text-[#5B34AC] font-bold text-[10px]">
                                  Multi ({rombelList.length})
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-3.5">
                            <button
                              type="button"
                              onClick={() => handleViewStudentSchedules(student)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-semibold border transition cursor-pointer tabular-nums ${
                                isOverSks
                                  ? 'bg-[#FCEBEC] text-[#731B1B] border-[#F4BCBD] hover:bg-[#F9D7D7]'
                                  : 'bg-[#f5f5f5] hover:bg-[#E4F2FF] hover:text-[#015BB5] text-[#222222] border-[#dddddd] hover:border-[#0080FF]/30'
                              }`}
                              title={isOverSks ? 'Peringatan: Beban SKS melebihi batas 20 SKS! Klik untuk melihat rincian' : 'Klik untuk melihat rincian jadwal dan mata kuliah mahasiswa ini'}
                            >
                              {isOverSks ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-[#E54545] shrink-0" />
                              ) : (
                                <Calendar className="w-3.5 h-3.5 text-[#0080FF] shrink-0" />
                              )}
                              <span>{linked.length} Jadwal · {totalSks} SKS {isOverSks ? '(>20 SKS)' : ''}</span>
                            </button>
                          </td>

                          <td className="py-3.5 px-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {isOverSks ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentModal(student)}
                                  data-frost="Button"
                                  className="frost-btn frost-btn-xxs frost-btn-solid frost-btn-danger"
                                  title="Ubah Rombel / Sesuaikan Mata Kuliah untuk Menurunkan SKS"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Ubah SKS</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentModal(student)}
                                  className="p-1.5 text-[#555555] hover:text-[#222222] hover:bg-[#eeeeee] rounded-[4px] transition cursor-pointer"
                                  title="Edit Data & Pilihan Rombel Mahasiswa"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleViewStudentSchedules(student)}
                                className="p-1.5 text-[#555555] hover:text-[#0080FF] hover:bg-[#E4F2FF] rounded-[4px] transition cursor-pointer"
                                title="Lihat Jadwal Terhubung Lengkap"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  setConfirmConfig({
                                    isOpen: true,
                                    title: 'Hapus Data Mahasiswa?',
                                    message: `Apakah Anda yakin ingin menghapus data mahasiswa ${student.name} (${student.nim})? Akun login mahasiswa dan relasi rombel akan dihapus dari sistem.`,
                                    confirmLabel: 'Ya, Hapus',
                                    isDestructive: true,
                                    onConfirm: async () => {
                                      await deleteStudent(student.nim);
                                      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                    },
                                  });
                                }}
                                className="p-1.5 text-[#555555] hover:text-[#E54545] hover:bg-[#FCEBEC] rounded-[4px] transition cursor-pointer"
                                title="Hapus Mahasiswa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Secondary Card: Matriks Relasi Rombel ↔ Mata Kuliah & Jadwal */}
          <div className="frost-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#eeeeee]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[6px] bg-[#E4F2FF] border border-[#0080FF]/20 text-[#0080FF] flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#222222]">
                    Matriks Relasi Rombel ↔ Mata Kuliah &amp; Jadwal Perkuliahan
                  </h3>
                  <p className="text-xs text-[#555555]">
                    Setiap rombel berelasi ke mata kuliah dengan jadwal hari, jam, ruang, dan dosen pengampu masing-masing
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-[6px] bg-[#f5f5f5] p-0.5 text-xs font-semibold border border-[#dddddd]">
                  <button
                    type="button"
                    onClick={() => setRombelStatusFilter('ALL')}
                    className={`px-2.5 py-1 rounded-[4px] transition cursor-pointer ${rombelStatusFilter === 'ALL' ? 'bg-white text-[#222222] font-bold' : 'text-[#555555] hover:text-[#222222]'}`}
                  >
                    Semua ({rombelMatrix.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRombelStatusFilter('ACTIVE')}
                    className={`px-2.5 py-1 rounded-[4px] transition cursor-pointer ${rombelStatusFilter === 'ACTIVE' ? 'bg-white text-[#0080FF] font-bold' : 'text-[#555555] hover:text-[#222222]'}`}
                  >
                    Aktif ({rombelMatrix.filter(r => !r.rombelData?.isArchived).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRombelStatusFilter('ARCHIVED')}
                    className={`px-2.5 py-1 rounded-[4px] transition cursor-pointer ${rombelStatusFilter === 'ARCHIVED' ? 'bg-white text-[#B55B00] font-bold' : 'text-[#555555] hover:text-[#222222]'}`}
                  >
                    Diarsipkan ({rombelMatrix.filter(r => r.rombelData?.isArchived).length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenRombelModal()}
                  data-frost="Button"
                  className="frost-btn frost-btn-xs frost-btn-solid frost-btn-brand"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Rombel Baru</span>
                </button>
              </div>
            </div>

            {/* Grid of Rombel Relation Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              {filteredRombelMatrix.map((item) => {
                const isExpanded = expandedRombelMatrix === item.rombel;
                const isArchived = Boolean(item.rombelData?.isArchived);

                return (
                  <div
                    key={item.rombel}
                    className={`border rounded-[8px] bg-white p-4 sm:p-5 flex flex-col justify-between transition space-y-4 ${isArchived ? 'border-[#FFD49F] bg-[#FFF3E4]/30' : 'border-[#dddddd] hover:border-[#0080FF]'}`}
                  >
                    <div>
                      {/* Rombel Card Header */}
                      <div className="flex items-start sm:items-center justify-between pb-3 border-b border-[#eeeeee] gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-3 py-1 rounded-[6px] text-white font-bold text-sm ${isArchived ? 'bg-[#DA6E00]' : 'bg-[#0080FF]'}`}>
                            Rombel {item.rombel}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#222222]">
                                {item.name}
                              </span>
                              {isArchived && (
                                <span className="px-1.5 py-0.5 rounded-[4px] bg-[#FFF3E4] text-[#914900] text-[10px] font-bold flex items-center gap-0.5">
                                  <Archive className="w-2.5 h-2.5" />
                                  <span>Diarsipkan</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#555555]">
                              {item.prodi} {item.semester ? `· Sem ${item.semester}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-[4px] bg-[#f5f5f5] text-[#222222] text-xs font-bold tabular-nums">
                            {item.students.length} Mhs
                          </span>
                          <span className="px-2.5 py-1 rounded-[4px] bg-[#E4F2FF] text-[#015BB5] text-xs font-bold tabular-nums">
                            {item.schedules.length} Jadwal · {item.totalSks} SKS
                          </span>

                          {/* Action Button: Edit Rombel */}
                          <button
                            type="button"
                            onClick={() => handleOpenRombelModal(item.rombelData || {
                              id: `rombel-${item.rombel.toLowerCase()}`,
                              code: item.rombel,
                              name: item.name,
                              prodi: item.prodi,
                              semester: item.semester || 1,
                              isArchived,
                              scheduleIds: item.schedules.map(s => s.id)
                            })}
                            className="p-1.5 rounded-[4px] bg-white hover:bg-[#f5f5f5] text-[#222222] border border-[#dddddd] transition cursor-pointer"
                            title={`Edit Rombel ${item.rombel}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Action Button: Connect Schedules */}
                          <button
                            type="button"
                            onClick={() => handleOpenRombelModal(item.rombelData || {
                              id: `rombel-${item.rombel.toLowerCase()}`,
                              code: item.rombel,
                              name: item.name,
                              prodi: item.prodi,
                              semester: item.semester || 1,
                              isArchived,
                              scheduleIds: item.schedules.map(s => s.id)
                            })}
                            className="p-1.5 rounded-[4px] bg-[#E4F2FF] hover:bg-[#C8E4FF] text-[#015BB5] transition cursor-pointer"
                            title={`Atur atau hubungkan jadwal mata kuliah untuk Rombel ${item.rombel}`}
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Action Button: Archive / Restore Rombel */}
                          {isArchived ? (
                            <button
                              type="button"
                              onClick={() => restoreRombel(item.rombel)}
                              className="p-1.5 rounded-[4px] bg-[#FFF3E4] hover:bg-[#FFE3C1] text-[#914900] border border-[#FFD49F] transition cursor-pointer"
                              title={`Pulihkan Rombel ${item.rombel} dari Arsip`}
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => archiveRombel(item.rombel)}
                              className="p-1.5 rounded-[4px] text-[#777777] hover:text-[#B55B00] hover:bg-[#FFF3E4] transition cursor-pointer"
                              title={`Arsipkan Rombel ${item.rombel}`}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Action Button: Delete Rombel (Protected with Relation Check) */}
                          <button
                            type="button"
                            onClick={async () => {
                              handleDeleteRombelRequest(item.rombelData || {
                                id: `rombel-${item.rombel.toLowerCase()}`,
                                code: item.rombel,
                                isArchived,
                              });
                            }}
                            className="p-1.5 rounded-[4px] text-[#777777] hover:text-[#E54545] hover:bg-[#FCEBEC] transition cursor-pointer"
                            title={`Hapus Rombel ${item.rombel} (Dicegah jika berelasi)`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Course Schedules in this Rombel */}
                      <div className="mt-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#777777] uppercase tracking-wider block">
                            Mata Kuliah &amp; Jadwal ({item.schedules.length} Kelas):
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenRombelModal(item.rombelData || {
                              id: `rombel-${item.rombel.toLowerCase()}`,
                              code: item.rombel,
                              name: item.name,
                              prodi: item.prodi,
                              semester: item.semester || 1,
                              scheduleIds: item.schedules.map(s => s.id)
                            })}
                            className="text-[11px] text-[#0080FF] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Link className="w-3 h-3" />
                            <span>+ Hubungkan Jadwal</span>
                          </button>
                        </div>

                        {item.schedules.length === 0 ? (
                          <div className="p-4 text-center text-xs text-[#777777] bg-[#fafafa] rounded-[6px] border border-dashed border-[#dddddd]">
                            <Calendar className="w-5 h-5 mx-auto mb-1 text-[#aaaaaa]" />
                            <p className="font-semibold text-[#555555]">Belum ada jadwal yang dikaitkan ke rombel ini</p>
                            <button
                              type="button"
                              onClick={() => handleOpenRombelModal(item.rombelData || {
                                id: `rombel-${item.rombel.toLowerCase()}`,
                                code: item.rombel,
                                name: item.name,
                                prodi: item.prodi,
                                semester: item.semester || 1,
                                scheduleIds: item.schedules.map(s => s.id)
                              })}
                              className="mt-1.5 px-2.5 py-1 bg-[#E4F2FF] hover:bg-[#C8E4FF] text-[#015BB5] rounded-[4px] font-bold text-[11px] inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Pilih &amp; Hubungkan Jadwal</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {item.schedules.map((sch) => (
                              <div
                                key={sch.id}
                                className="p-2.5 bg-[#fafafa] hover:bg-[#f5f5f5] rounded-[6px] border border-[#dddddd] flex items-center justify-between gap-2 text-xs transition"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-[#222222] truncate">
                                      {sch.courseName}
                                    </span>
                                    <span className="px-1.5 py-0.2 bg-white text-[#555555] font-mono text-[10px] rounded-[4px] border border-[#dddddd]">
                                      {sch.courseCode}
                                    </span>
                                    <span className="font-semibold text-[#0080FF] text-[10px] tabular-nums">
                                      {sch.sks} SKS
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#555555] mt-0.5 flex items-center gap-2">
                                    <span className="tabular-nums">{sch.day}, {sch.startTime}–{sch.endTime}</span>
                                    <span>·</span>
                                    <span className="font-semibold text-[#222222]">{sch.room}</span>
                                    <span>·</span>
                                    <span className="truncate">{sch.lecturerName}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Enrolled Students Quick View in this Rombel */}
                    <div className="pt-3 border-t border-[#eeeeee]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-[#777777] uppercase tracking-wider">
                          Mahasiswa Terdaftar ({item.students.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedRombelMatrix(isExpanded ? null : item.rombel)}
                          className="text-xs text-[#0080FF] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Tutup Daftar' : 'Lihat Semua'}</span>
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className={`flex flex-wrap gap-1.5 ${isExpanded ? 'max-h-60 overflow-y-auto' : 'max-h-16 overflow-hidden'}`}>
                        {item.students.length === 0 ? (
                          <div className="text-[11px] text-[#777777] italic py-1">
                            Belum ada mahasiswa yang terdaftar di rombel ini.
                          </div>
                        ) : (
                          item.students.map((stu) => {
                            const isMulti = stu.rombels && stu.rombels.length > 1;
                            return (
                              <button
                                key={stu.nim}
                                type="button"
                                onClick={() => handleViewStudentSchedules(stu)}
                                className={`px-2 py-1 rounded-[4px] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border ${
                                  isMulti
                                    ? 'bg-[#F2ECFC] text-[#5B34AC] border-[#D4BFEE] hover:bg-[#E6DAFA]'
                                    : 'bg-[#fafafa] text-[#222222] border-[#dddddd] hover:bg-[#E4F2FF] hover:text-[#015BB5] hover:border-[#0080FF]/30'
                                }`}
                                title={`Klik untuk melihat jadwal ${stu.name}`}
                              >
                                <span className="font-mono text-[10px] text-[#777777] tabular-nums">{stu.nim}</span>
                                <span className="font-semibold truncate max-w-[120px]">{stu.name}</span>
                                {isMulti && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#7A45E5]" title="Mahasiswa Multi-Rombel" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Rombel Card */}
              <div
                onClick={() => handleOpenRombelModal()}
                className="border-2 border-dashed border-[#cccccc] hover:border-[#0080FF] bg-[#fafafa] hover:bg-[#E4F2FF]/30 rounded-[8px] p-6 flex flex-col items-center justify-center text-center gap-3 transition cursor-pointer group min-h-[220px]"
              >
                <div className="w-11 h-11 rounded-[6px] bg-white border border-[#dddddd] group-hover:border-[#0080FF] group-hover:bg-[#0080FF] group-hover:text-white text-[#555555] flex items-center justify-center transition">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#222222]">
                    Tambah Rombel Baru
                  </h4>
                  <p className="text-xs text-[#555555] max-w-xs mt-1">
                    Buat rombel kelas baru dan hubungkan ke beberapa jadwal mata kuliah sekaligus
                  </p>
                </div>
                <span className="text-xs font-bold text-[#0080FF] group-hover:underline">
                  Buka Formulir Rombel &rarr;
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COURSES (MASTER MATA KULIAH WITH EDIT, ARCHIVE & RELATION PROTECTION) */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {/* Main Card: Master Mata Kuliah Header & Metrics */}
          <div className="frost-card p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#eeeeee]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[6px] bg-[#E5F6F5] border border-[#009499]/20 text-[#009499] flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#222222] flex items-center gap-2">
                    <span>Master Mata Kuliah Kurikulum</span>
                    <span className="px-2 py-0.5 rounded-[4px] bg-[#E5F6F5] text-[#016F73] text-xs font-bold tabular-nums">
                      {courses.length} MK
                    </span>
                  </h3>
                  <p className="text-xs text-[#555555]">
                    Katalog master mata kuliah kurikulum STMIK PGRI Arungbinang Kebumen yang terhubung ke Jadwal dan Presensi
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenBulkImport('courses')}
                  data-frost="Button"
                  className="frost-btn frost-btn-xs frost-btn-subtle frost-btn-teal"
                  title="Impor master mata kuliah dari file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import Excel MK</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenCourseModal()}
                  data-frost="Button"
                  className="frost-btn frost-btn-xs frost-btn-solid frost-btn-teal"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Mata Kuliah</span>
                </button>
              </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-[#fafafa] border border-[#dddddd] rounded-[6px]">
                <span className="text-[11px] font-bold text-[#555555] uppercase tracking-wider block">
                  Total Mata Kuliah
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#222222] mt-0.5 block tabular-nums">
                  {courses.length}
                </span>
                <span className="text-[11px] text-[#777777] mt-0.5 block">Kurikulum Terdaftar</span>
              </div>

              <div className="p-3.5 bg-[#E5F6F5]/60 border border-[#B0DFDF] rounded-[6px]">
                <span className="text-[11px] font-bold text-[#016F73] uppercase tracking-wider block">
                  Mata Kuliah Aktif
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#014C4F] mt-0.5 block tabular-nums">
                  {courses.filter(c => !c.isArchived).length}
                </span>
                <span className="text-[11px] text-[#009499] mt-0.5 block">Siap Ditugaskan</span>
              </div>

              <div className="p-3.5 bg-[#FFF3E4]/60 border border-[#FFD49F] rounded-[6px]">
                <span className="text-[11px] font-bold text-[#B55B00] uppercase tracking-wider block">
                  Diarsipkan
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#914900] mt-0.5 block tabular-nums">
                  {courses.filter(c => c.isArchived).length}
                </span>
                <span className="text-[11px] text-[#DA6E00] mt-0.5 block">Non-Aktif / Arsip</span>
              </div>

              <div className="p-3.5 bg-[#E4F2FF]/60 border border-[#ADCEFF] rounded-[6px]">
                <span className="text-[11px] font-bold text-[#015BB5] uppercase tracking-wider block">
                  Terhubung ke Jadwal
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#003F8A] mt-0.5 block tabular-nums">
                  {new Set(schedules.map(s => s.courseCode.toUpperCase())).size}
                </span>
                <span className="text-[11px] text-[#0080FF] mt-0.5 block">Aktif di Semester Ini</span>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="pt-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#777777] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Cari kode MK, nama mata kuliah, atau dosen pengampu..."
                  className="frost-input frost-input-sm pl-9.5 pr-4"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Prodi filter */}
                <select
                  value={courseProdiFilter}
                  onChange={(e) => setCourseProdiFilter(e.target.value)}
                  className="frost-select text-xs font-semibold h-9 py-1"
                >
                  <option value="ALL">Semua Program Studi</option>
                  <option value="Teknologi Informasi">Teknologi Informasi (TI)</option>
                  <option value="Manajemen Informatika">Manajemen Informatika (MI)</option>
                </select>

                {/* Semester filter */}
                <select
                  value={courseSemesterFilter}
                  onChange={(e) => setCourseSemesterFilter(e.target.value)}
                  className="frost-select text-xs font-semibold h-9 py-1"
                >
                  <option value="ALL">Semua Semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>

                {/* Archive Status filter */}
                <div className="inline-flex rounded-[6px] bg-[#f5f5f5] p-0.5 text-xs font-semibold border border-[#dddddd]">
                  <button
                    type="button"
                    onClick={() => setCourseStatusFilter('ALL')}
                    className={`px-3 py-1 rounded-[4px] transition cursor-pointer ${courseStatusFilter === 'ALL' ? 'bg-white text-[#222222] font-bold' : 'text-[#555555] hover:text-[#222222]'}`}
                  >
                    Semua ({courses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseStatusFilter('ACTIVE')}
                    className={`px-3 py-1 rounded-[4px] transition cursor-pointer ${courseStatusFilter === 'ACTIVE' ? 'bg-white text-[#009499] font-bold' : 'text-[#555555] hover:text-[#222222]'}`}
                  >
                    Aktif ({courses.filter(c => !c.isArchived).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseStatusFilter('ARCHIVED')}
                    className={`px-3 py-1 rounded-[4px] transition cursor-pointer ${courseStatusFilter === 'ARCHIVED' ? 'bg-white text-[#B55B00] font-bold' : 'text-[#555555] hover:text-[#222222]'}`}
                  >
                    Diarsipkan ({courses.filter(c => c.isArchived).length})
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Courses Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course) => {
              const isArchived = Boolean(course.isArchived);
              const linkedSchedules = schedules.filter(s => s.courseCode.trim().toUpperCase() === course.code.trim().toUpperCase());

              return (
                <div
                  key={course.id}
                  className={`p-5 rounded-[8px] border bg-white flex flex-col justify-between transition space-y-4 ${isArchived ? 'border-[#FFD49F] bg-[#FFF3E4]/30' : 'border-[#dddddd] hover:border-[#009499]'}`}
                >
                  <div>
                    {/* Course Card Top Badges & Actions */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#222222] bg-[#f5f5f5] border border-[#dddddd] px-2 py-0.5 rounded-[4px]">
                          {course.code}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-[4px] bg-[#E5F6F5] text-[#016F73] tabular-nums">
                          {course.sks} SKS
                        </span>
                        {isArchived && (
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#FFF3E4] text-[#914900] text-[10px] font-bold flex items-center gap-1">
                            <Archive className="w-3 h-3" />
                            <span>Diarsipkan</span>
                          </span>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="inline-flex items-center gap-1">
                        {/* Edit Course Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenCourseModal(course)}
                          className="p-1.5 rounded-[4px] bg-[#fafafa] hover:bg-[#eeeeee] text-[#222222] border border-[#dddddd] transition cursor-pointer"
                          title={`Edit Mata Kuliah ${course.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Archive / Restore Button */}
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={() => restoreCourse(course.id)}
                            className="p-1.5 rounded-[4px] bg-[#FFF3E4] hover:bg-[#FFE3C1] text-[#914900] border border-[#FFD49F] transition cursor-pointer"
                            title={`Pulihkan ${course.name} dari Arsip`}
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => archiveCourse(course.id)}
                            className="p-1.5 rounded-[4px] text-[#777777] hover:text-[#B55B00] hover:bg-[#FFF3E4] transition cursor-pointer"
                            title={`Arsipkan Mata Kuliah ${course.name}`}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Button (Protected with Relation Check) */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCourseRequest(course)}
                          className="p-1.5 rounded-[4px] text-[#777777] hover:text-[#E54545] hover:bg-[#FCEBEC] transition cursor-pointer"
                          title={`Hapus Mata Kuliah ${course.name} (Dicegah jika berelasi)`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base font-bold text-[#222222] mt-2 line-clamp-1">
                      {course.name}
                    </h4>
                    <p className="text-xs text-[#555555] mt-1">
                      {course.prodi} · Semester {course.semester} {course.semester % 2 === 1 ? '(Ganjil)' : '(Genap)'}
                    </p>

                    {course.description && (
                      <p className="text-xs text-[#555555] mt-2 line-clamp-2 bg-[#fafafa] p-2 rounded-[4px]">
                        {course.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#eeeeee] space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#555555]">
                      <span>Dosen Pengampu:</span>
                      <span className="font-semibold text-[#222222] text-right truncate max-w-[160px]">
                        {course.defaultLecturerName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[#777777] text-[11px]">Relasi Jadwal:</span>
                      {linkedSchedules.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-[4px] bg-[#E4F2FF] text-[#015BB5] text-[11px] font-bold tabular-nums">
                          {linkedSchedules.length} Kelas Aktif
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#777777] italic">
                          Belum ada jadwal
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Quick Add Course Card */}
            <div
              onClick={() => handleOpenCourseModal()}
              className="border-2 border-dashed border-[#cccccc] hover:border-[#009499] bg-[#fafafa] hover:bg-[#E5F6F5]/30 rounded-[8px] p-6 flex flex-col items-center justify-center text-center gap-3 transition cursor-pointer group min-h-[220px]"
            >
              <div className="w-11 h-11 rounded-[6px] bg-white border border-[#dddddd] group-hover:border-[#009499] group-hover:bg-[#009499] group-hover:text-white text-[#555555] flex items-center justify-center transition">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#222222]">
                  Tambah Mata Kuliah Baru
                </h4>
                <p className="text-xs text-[#555555] max-w-xs mt-1">
                  Masukkan mata kuliah baru ke dalam master kurikulum akademik kampus
                </p>
              </div>
              <span className="text-xs font-bold text-[#009499] group-hover:underline">
                Buka Formulir Mata Kuliah &rarr;
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DATABASE BACKUP & RESTORE */}
      {activeTab === 'database' && (<>

        <LegacyExcludeReview />
        <DatabaseBackupTab
          onOpenResetConfirm={() => {
            setConfirmConfig({
              isOpen: true,
              title: 'Reset ke Data Default?',
              message: 'Tindakan ini akan mengembalikan seluruh jadwal, pengguna, sesi presensi, dan data mahasiswa ke kondisi bawaan STMIK PGRI Arungbinang Kebumen.',
              confirmLabel: 'Ya, Reset Data',
              isDestructive: true,
              onConfirm: async () => {
                await resetToDefaultData();
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
              },
            });
          }}
        /></>
      )}

      {/* TAB 6: CAMPUS DEVICE SESSIONS & ANTI-HIJACKING */}
      {activeTab === 'devices' && (
        <div className="frost-card p-5 sm:p-6 space-y-4">
          <div className="border-b border-[#eeeeee] pb-4">
            <h3 className="text-lg font-bold text-[#222222]">Manajemen Sesi Perangkat Terdaftar Seluruh Kampus</h3>
            <p className="text-xs text-[#555555] mt-1">
              Pantau seluruh perangkat browser mahasiswa, dosen, dan staf yang aktif atau tersimpan. BAAK dapat memutuskan sesi mencurigakan untuk melindungi integritas sistem presensi.
            </p>
          </div>
          <DeviceSessionManager mode="admin" />
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-labelledby="user-modal-title" className="frost-card shadow-lg max-w-md w-full p-6 space-y-4">
            <h3 id="user-modal-title" className="text-base sm:text-lg font-bold text-[#222222]">
              {editingUserId ? 'Edit Akun Pengguna' : 'Tambah Pengguna Baru'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4 text-sm">
              <div>
                <label className="frost-label">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Contoh: Budi Santoso, M.Kom."
                  className="frost-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="user-identifier" className="frost-label">{userRole === 'mahasiswa' ? 'NIM' : userRole === 'dosen' ? 'NIDN' : 'Username'}</label>
                  <input
                    id="user-identifier"
                    type="text"
                    value={userUsername}
                    onChange={(e) => setUserUsername(e.target.value)}
                    placeholder="26TI0010"
                    className="frost-input font-mono"
                    required
                  />
                  {userRole !== 'admin' && <p className="text-xs text-[#555555] mt-1">Username login otomatis mengikuti {userRole === 'mahasiswa' ? 'NIM' : 'NIDN'}. Password tetap sama.</p>}
                </div>
                <div>
                  <label className="frost-label">Peran (Role)</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as Role)}
                    className="frost-select"
                  >
                    <option value="dosen">Dosen</option>
                    <option value="mahasiswa">Mahasiswa</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="user-email" className="frost-label">Email</label>
                <input
                  id="user-email"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="email@stmik-arungbinang.ac.id"
                  className="frost-input"
                />
                {editingUserId && <p className="text-xs text-[#555555] mt-1">Admin dapat mengubah email tanpa OTP. Email baru ditandai belum terverifikasi.</p>}
              </div>

              <p className="text-xs text-[#555555]">Kelola email dan reset password melalui panel Email dan Aktivasi Akun. Akun baru belum memiliki password sampai diaktivasi.</p>

              {userRole === 'mahasiswa' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="frost-label">Rombel / Kelas</label>
                    <input
                      type="text"
                      value={userRombel}
                      onChange={(e) => setUserRombel(e.target.value)}
                      placeholder="TI 3"
                      className="frost-input"
                    />
                  </div>
                  <div>
                    <label className="frost-label">Program Studi</label>
                    <select
                      value={userProdi}
                      onChange={(e) => setUserProdi(e.target.value as ProgramStudi)}
                      className="frost-select"
                    >
                      <option value="Teknologi Informasi">Teknologi Informasi</option>
                      <option value="Manajemen Informatika">Manajemen Informatika</option>
                    </select>
                  </div>
                </div>
              )}

              {userRole === 'dosen' && (
                <div>
                  <label className="frost-label">Jabatan / Gelar</label>
                  <input
                    type="text"
                    value={userTitle}
                    onChange={(e) => setUserTitle(e.target.value)}
                    placeholder="Contoh: Dosen Tetap / Dosen Wali"
                    className="frost-input"
                  />
                </div>
              )}

              {userFormError && <p role="alert" className="text-sm text-red-700">{userFormError}</p>}
              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  disabled={isSavingUser}
                  data-frost="Button"
                  className="frost-btn frost-btn-sm frost-btn-outline frost-btn-neutral"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  data-frost="Button"
                  className="frost-btn frost-btn-sm frost-btn-solid frost-btn-brand"
                >
                  {isSavingUser ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal with Master MK, Database Rombel & Mahasiswa, Rule 1, Rule 2 & Slot Recommendation Engine */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        editingSchedule={selectedScheduleForEdit}
        schedules={schedules}
        users={users}
        courses={courses}
        rombels={rombels}
        students={students}
        onSave={(data) => addSchedule(data)}
        onUpdate={(id, data) => updateSchedule(id, data)}
        onAddCourse={(data) => addCourse(data)}
        onAddRombel={(data, scheduleIds) => addRombel(data, scheduleIds)}
      />

      {/* Schedule Student Roster Modal: View students connected to schedule via Rombel & Mahasiswa database */}
      <ScheduleStudentRosterModal
        isOpen={isRosterModalOpen}
        onClose={() => {
          setIsRosterModalOpen(false);
          setRosterSchedule(null);
        }}
        schedule={rosterSchedule}
        students={students}
        courses={courses}
        rombels={rombels}
        onEditSchedule={(sch) => handleOpenScheduleModal(sch)}
        onSyncRoster={() => syncStudentUsers()}
      />

      {/* Student Modal: Add/Edit student & assign multi-rombel relations */}
      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        editingStudent={editingStudent}
        schedules={schedules}
        courses={courses}
        existingStudents={students}
        existingRombels={rombels}
        onSave={async (data) => {
          if (editingStudent) {
            await updateStudent(editingStudent.nim, data);
          } else {
            await addStudent(data);
          }
        }}
      />

      {/* Rombel Modal: Add/Edit Rombel & link multiple course schedules */}
      <RombelModal
        isOpen={isRombelModalOpen}
        onClose={() => setIsRombelModalOpen(false)}
        editingRombel={editingRombel}
        schedules={schedules}
        courses={courses}
        existingRombels={rombels}
        onSave={async (data, scheduleIds) => {
          await addRombel(data, scheduleIds);
        }}
        onUpdate={async (id, data, scheduleIds, previousCode) => {
          await updateRombel(id, data, scheduleIds, previousCode);
        }}
      />

      {/* Course Modal: Add & Edit Master Mata Kuliah */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        editingCourse={editingCourse}
        users={users}
        schedules={schedules}
        existingCourses={courses}
        onSave={async (data) => {
          await addCourse(data);
        }}
        onUpdate={async (id, data) => {
          await updateCourse(id, data);
        }}
      />

      {/* Relationship Block Modal: Prevents deletion of related data and offers archiving */}
      <RelationshipBlockModal
        isOpen={relationshipModalConfig.isOpen}
        onClose={() => setRelationshipModalConfig(prev => ({ ...prev, isOpen: false }))}
        entityType={relationshipModalConfig.entityType}
        entityName={relationshipModalConfig.entityName}
        entityId={relationshipModalConfig.entityId}
        entityCode={relationshipModalConfig.entityCode}
        schedules={relationshipModalConfig.schedules}
        students={relationshipModalConfig.students}
        sessions={relationshipModalConfig.sessions}
        onArchive={relationshipModalConfig.onArchive}
        isAlreadyArchived={relationshipModalConfig.isAlreadyArchived}
      />

      {/* Student Schedule Detail Modal: View all courses & schedules linked to this student */}
      <StudentScheduleDetailModal
        isOpen={isScheduleDetailModalOpen}
        onClose={() => setIsScheduleDetailModalOpen(false)}
        student={detailStudent}
        schedules={schedules}
        onEditStudent={(stu) => {
          setIsScheduleDetailModalOpen(false);
          handleOpenStudentModal(stu);
        }}
      />

      {/* Export Modal */}
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Database Backup & Restore Center Modal */}
      <DatabaseBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onNavigateToTab={() => setActiveTab('database')}
      />

      {/* Bulk Excel Importer Modal */}
      <BulkExcelImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        initialCategory={bulkImportCategory}
        onSuccess={() => {}}
      />

      {/* Confirmation Modal */}
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

export const AdminDashboard: React.FC<AdminDashboardProps> = props => {
  const { demoScope } = useAttendance();
  return <AdminDashboardContent key={demoScope ? 'demo' : 'regular'} {...props} />;
};
