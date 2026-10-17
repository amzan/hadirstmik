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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenProfile
}) => {
  const {
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

  const handleOpenBulkImport = (cat: ImportCategory = 'all') => {
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
    onConfirm: () => {},
  });

  // Quick Summary Statistics Data for Admin
  const todayCampusSchedules = schedules.filter(s => s.day === activeDay);
  const openSessionsCount = sessions.filter(s => s.isOpen).length;
  const totalCampusRecords = records.length;
  const totalCampusHadir = records.filter(r => r.status === 'HADIR').length;
  const campusAttendanceRate = totalCampusRecords > 0 ? Math.round((totalCampusHadir / totalCampusRecords) * 100) : 93;

  // User form state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [userRole, setUserRole] = useState<Role>('dosen');
  const [userTitle, setUserTitle] = useState('');
  const [userRombel, setUserRombel] = useState('');
  const [userProdi, setUserProdi] = useState<ProgramStudi>('Teknologi Informasi');
  const [searchUser, setSearchUser] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'mahasiswa' | 'dosen' | 'admin'>('ALL');
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState<ScheduleItem | null>(null);

  // Open User modal
  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUserId(user.id);
      setUserName(user.name);
      setUserUsername(user.username);
      setUserEmail(user.email);
      setUserRole(user.role);
      setUserTitle(user.title || '');
      setUserRombel(user.rombel || '');
      setUserProdi(user.prodi || 'Teknologi Informasi');
      setUserPassword(user.password || '');
    } else {
      setEditingUserId(null);
      setUserName('');
      setUserUsername('');
      setUserEmail('');
      setUserRole('dosen');
      setUserTitle('');
      setUserRombel('');
      setUserProdi('Teknologi Informasi');
      setUserPassword('');
    }
    setShowUserPassword(false);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userUsername) return;

    const userPayload: Partial<User> = {
      name: userName,
      username: userUsername,
      email: userEmail || `${userUsername.toLowerCase()}@stmik-arungbinang.ac.id`,
      role: userRole,
      title: userTitle,
      rombel: userRombel,
      prodi: userProdi,
    };

    if (userPassword.trim()) {
      userPayload.password = userPassword.trim();
    }

    if (editingUserId) {
      updateUser(editingUserId, userPayload);
    } else {
      addUser({
        ...userPayload,
        name: userName,
        username: userUsername,
        role: userRole,
        email: userEmail || `${userUsername.toLowerCase()}@stmik-arungbinang.ac.id`,
      });
    }
    setIsUserModalOpen(false);
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
  const handleDeleteRombelRequest = (rombel: { code: string; id?: string; isArchived?: boolean }) => {
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
        onArchive: () => {
          archiveRombel(rombelCode);
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
        onConfirm: () => {
          if (rombel.id) {
            deleteRombel(rombel.id);
          } else {
            const found = rombels.find(r => r.code.toUpperCase() === rombelCode.toUpperCase());
            if (found) deleteRombel(found.id);
          }
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        },
      });
    }
  };

  // Handler for safely deleting / blocking deletion of Course
  const handleDeleteCourseRequest = (course: Course) => {
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
        onArchive: () => {
          archiveCourse(course.id);
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
        onConfirm: () => {
          deleteCourse(course.id);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        },
      });
    }
  };

  // Unique rombels across master rombels, students & schedules
  const allDistinctRombels = useMemo(() => {
    const set = new Set<string>();
    rombels.forEach(r => {
      if (r.code) set.add(r.code.trim().toUpperCase());
    });
    students.forEach(s => {
      const list = s.rombels && s.rombels.length > 0 ? s.rombels : getStudentRombelList(s.rombel);
      list.forEach(r => set.add(r));
    });
    schedules.forEach(s => {
      const parts = s.rombel ? s.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean) : [];
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
  const getScheduleStudentCount = (rombelStr: string) => {
    if (!rombelStr) return 0;
    const parts = rombelStr.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);
    return students.filter(st => {
      return parts.some(p => isStudentInRombel(p, st.rombel, st.rombels));
    }).length;
  };

  // Filtered schedules for Tab 2
  const filteredSchedules = useMemo(() => {
    return schedules.filter(sch => {
      // Day filter
      if (scheduleDayFilter !== 'ALL' && sch.day !== scheduleDayFilter) return false;

      // Rombel filter
      if (scheduleRombelFilter !== 'ALL') {
        const parts = sch.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);
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
      const parts = sch.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);
      students.forEach(st => {
        if (parts.some(p => isStudentInRombel(p, st.rombel, st.rombels))) {
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

  const handleSyncStudentAccounts = () => {
    const res = syncStudentUsers();
    setSyncToastMessage(`Sinkronisasi Berhasil! Seluruh ${res.count} mahasiswa terdaftar kini memiliki akun pengguna aktif untuk Login & Presensi QR (${res.added} akun baru dibuat, ${res.updated} diperbarui).`);
    setTimeout(() => {
      setSyncToastMessage(null);
    }, 5000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Admin Minimalist Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                <span>Panel Administrator BAAK & IT</span>
                <span aria-hidden="true">·</span>
                <span>Hak Akses Penuh Sistem</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 tracking-tight">
                Kelola Basis Data & Jadwal Kampus
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Sinkronisasi data mahasiswa, jadwal perkuliahan, mata kuliah, dan rekapitulasi kehadiran
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onOpenProfile && (
              <button
                onClick={onOpenProfile}
                className="px-4 py-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-semibold text-sm flex items-center gap-2 transition cursor-pointer shadow-2xs"
                title="Konfigurasi Profil Petugas BAAK & Ganti Password dengan OTP Email"
              >
                <UserCog className="w-4 h-4 text-indigo-600" />
                <span>Profil BAAK</span>
              </button>
            )}

            <button
              onClick={() => handleOpenBulkImport('all')}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm flex items-center gap-2 transition cursor-pointer shadow-xs"
              title="Unggah dan perbarui data massal dari file Excel (Jadwal, Pengguna, Mahasiswa, Mata Kuliah)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Impor Excel Massal</span>
            </button>

            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm flex items-center gap-2 transition cursor-pointer shadow-xs"
              title="Cadangkan, Ekspor, dan Pulihkan Database Proyek"
            >
              <Database className="w-4 h-4" />
              <span>Backup & Pulihkan DB</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Master Presensi</span>
            </button>

            <button
              onClick={() => {
                setConfirmConfig({
                  isOpen: true,
                  title: 'Reset ke Data Default?',
                  message: 'Tindakan ini akan mengembalikan seluruh jadwal, pengguna, sesi presensi, dan data mahasiswa ke kondisi bawaan STMIK PGRI Arungbinang Kebumen.',
                  confirmLabel: 'Ya, Reset Data',
                  isDestructive: true,
                  onConfirm: () => {
                    resetToDefaultData();
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                  },
                });
              }}
              className="px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center gap-2 border border-slate-300 transition cursor-pointer"
              title="Reset data ke bawaan dokumen"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>Reset Data Default</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Summary Statistics Component for Admin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Classes Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Kelas Kampus Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {todayCampusSchedules.length} Kelas
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Hari {activeDay} · {schedules.length} total sesi per minggu
            </p>
          </div>
        </div>

        {/* Stat 2: Active Sessions */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Sesi Presensi Terbuka</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{openSessionsCount} Sesi</span>
              {openSessionsCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1 truncate">
              {openSessionsCount > 0
                ? 'Dosen sedang membuka presensi real-time'
                : 'Tidak ada sesi terbuka saat ini'}
            </p>
          </div>
        </div>

        {/* Stat 3: Campus Attendance Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Rata-rata Kehadiran Kampus</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {campusAttendanceRate}%
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {totalCampusHadir} hadir dari {totalCampusRecords} total rekaman
            </p>
          </div>
        </div>

        {/* Stat 4: Total Campus Community */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Komunitas Terdaftar</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {students.length} Mhs · {users.filter(u => u.role === 'dosen').length} Dosen
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {courses.length} mata kuliah aktif kurikulum
            </p>
          </div>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="flex border-b border-slate-200 gap-6 sm:gap-8 text-sm sm:text-base font-medium overflow-x-auto">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 border-b-2 flex items-center gap-2 shrink-0 transition cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Monitoring Sesi ({sessions.length})</span>
          {openSessionsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'schedules'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Jadwal Perkuliahan ({schedules.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'users'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Kelola Pengguna ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'students'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Rombel & Mahasiswa ({students.length})
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'courses'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Master Mata Kuliah ({courses.length})
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`pb-3 border-b-2 shrink-0 flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === 'database'
              ? 'border-indigo-600 text-indigo-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4 text-indigo-600" />
          <span>Cadangan & Database</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`pb-3 border-b-2 shrink-0 flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === 'devices'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Laptop className="w-4 h-4 text-blue-600" />
          <span>Sesi & Perangkat Kampus ({deviceSessions.filter(s => s.status === 'ACTIVE').length})</span>
        </button>
      </div>

      {/* TAB 0: SESSIONS MONITORING & CONTROL */}
      {activeTab === 'sessions' && <SessionMonitoringTab />}

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
          {/* Student Account Sync Status Card */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm sm:text-base font-bold text-emerald-950">
                    Otomasi Akun Mahasiswa Terdaftar
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-200/70 text-emerald-900 border border-emerald-300">
                    100% Terintegrasi
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-800/90 mt-1 leading-relaxed">
                  Setiap nama mahasiswa yang terdaftar dalam sistem (<strong>{students.length} mahasiswa</strong>) wajib dan otomatis memiliki akun pengguna aktif (<strong>{users.filter(u => u.role === 'mahasiswa').length} akun mahasiswa</strong>) dengan kredensial NIM untuk melakukan presensi QR perkuliahan tanpa error.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSyncStudentAccounts}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                title="Sinkronkan seluruh data mahasiswa terdaftar ke akun pengguna sistem"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Sinkronkan Akun Mahasiswa</span>
              </button>
            </div>
          </div>

          {/* Sync Toast Notification */}
          {syncToastMessage && (
            <div className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>{syncToastMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Daftar Akun Pengguna Sistem</h3>
              <p className="text-sm text-slate-500">Kelola akun Dosen, Mahasiswa, dan Administrator Kampus</p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama, NIM, email..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full sm:w-auto pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:border-slate-500"
                />
              </div>

              <button
                onClick={() => handleOpenBulkImport('users')}
                className="w-full sm:w-auto px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                title="Impor pengguna dari file Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Import Excel</span>
              </button>

              <button
                onClick={() => handleOpenUserModal()}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Pengguna</span>
              </button>
            </div>
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
            <span className="text-slate-400 mr-1 uppercase tracking-wider text-[11px]">Filter Peran:</span>
            <button
              type="button"
              onClick={() => setUserRoleFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer border ${
                userRoleFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Semua Pengguna ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setUserRoleFilter('mahasiswa')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer border flex items-center gap-1.5 ${
                userRoleFilter === 'mahasiswa'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Mahasiswa ({users.filter(u => u.role === 'mahasiswa').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setUserRoleFilter('dosen')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer border flex items-center gap-1.5 ${
                userRoleFilter === 'dosen'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Dosen Pengampu ({users.filter(u => u.role === 'dosen').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setUserRoleFilter('admin')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer border flex items-center gap-1.5 ${
                userRoleFilter === 'admin'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Administrator ({users.filter(u => u.role === 'admin').length})</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-3">Pengguna</th>
                  <th className="py-3 px-3">NIDN / NIM</th>
                  <th className="py-3 px-3">Peran (Role)</th>
                  <th className="py-3 px-3">Keterangan / Rombel</th>
                  <th className="py-3 px-3">Email Kampus</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div className="font-semibold text-slate-900">{user.name}</div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-900">{user.username}</td>
                    <td className="py-3 px-3">
                      {user.role === 'mahasiswa' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                          <span>Mahasiswa</span>
                        </span>
                      ) : user.role === 'dosen' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Dosen</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <Shield className="w-3.5 h-3.5 text-purple-600" />
                          <span>Admin BAAK</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {user.role === 'mahasiswa' ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-800">
                            {user.rombel ? `Rombel ${user.rombel}` : '-'}
                          </span>
                          <span className="block text-[11px] text-emerald-700 font-medium">
                            ✓ Akun Presensi QR Aktif
                          </span>
                        </div>
                      ) : (
                        user.rombel ? `Rombel ${user.rombel}` : user.title || '-'
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-700 font-mono text-xs">{user.email || '-'}</div>
                      {user.password ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                          ✓ Sandi Kustom Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          (Default: {user.role === 'admin' ? 'baak123' : user.role === 'dosen' ? 'dosen123' : 'pass123'})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenUserModal(user)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                          title="Edit Pengguna"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmConfig({
                              isOpen: true,
                              title: 'Hapus Pengguna?',
                              message: `Apakah Anda yakin ingin menghapus akun ${user.name} (${user.username})? Tindakan ini tidak dapat dibatalkan.`,
                              confirmLabel: 'Ya, Hapus',
                              isDestructive: true,
                              onConfirm: () => {
                                deleteUser(user.id);
                                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-600 transition cursor-pointer"
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
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
            {/* Header & Main Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                    Sistem Akademik Terpadu
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500 font-medium">Semester Ganjil 2026/2027</span>
                </div>
                <h3 className="text-base sm:text-xl font-bold text-slate-900 mt-1">
                  Manajemen Jadwal Perkuliahan ({schedules.length})
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Rombel terhubung langsung dengan database Rombel & Mahasiswa, serta Kode dan Mata Kuliah terhubung dengan database master mata kuliah.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => handleOpenBulkImport('schedules')}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Impor jadwal perkuliahan dari file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Import Excel Jadwal</span>
                </button>

                <button
                  onClick={() => handleOpenScheduleModal()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Jadwal Baru</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar: Master MK & Rombel-Mahasiswa Integration */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">Total Jadwal Aktif</span>
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {schedules.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Jadwal perkuliahan mingguan
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div className="flex items-center justify-between text-emerald-800 mb-1">
                  <span className="text-xs font-semibold">Terhubung Master MK</span>
                  <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-emerald-900">
                  {schedulesConnectedToMaster.length} / {schedules.length}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  {Math.round((schedulesConnectedToMaster.length / (schedules.length || 1)) * 100)}% Terhubung Database Master MK
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                <div className="flex items-center justify-between text-blue-800 mb-1">
                  <span className="text-xs font-semibold">Rombel Terdaftar</span>
                  <Layers className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-blue-900">
                  {rombels.length}
                </div>
                <div className="text-[11px] text-blue-700 font-medium mt-0.5">
                  Kelas dari Database Rombel
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200">
                <div className="flex items-center justify-between text-indigo-800 mb-1">
                  <span className="text-xs font-semibold">Mahasiswa Terhubung</span>
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-indigo-900">
                  {totalStudentsEnrolledInSchedules}
                </div>
                <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
                  Mahasiswa otomatis tersinkron
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari mata kuliah, kode MK, dosen, ruang, atau rombel..."
                    value={scheduleSearch}
                    onChange={(e) => setScheduleSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                  />
                </div>

                {/* Dropdown Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Rombel Filter from Database */}
                  <select
                    value={scheduleRombelFilter}
                    onChange={(e) => setScheduleRombelFilter(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-800 font-semibold focus:outline-none focus:border-slate-900"
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
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-800 font-semibold focus:outline-none focus:border-slate-900 max-w-[200px]"
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
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-800 font-semibold focus:outline-none focus:border-slate-900"
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
                      onClick={() => {
                        setScheduleSearch('');
                        setScheduleRombelFilter('ALL');
                        setScheduleCourseFilter('ALL');
                        setScheduleDayFilter('ALL');
                      }}
                      className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Schedules Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                    <th className="py-3 px-3.5">Hari & Jam</th>
                    <th className="py-3 px-3.5">Kode & Mata Kuliah (Master MK)</th>
                    <th className="py-3 px-3.5 text-center">SKS</th>
                    <th className="py-3 px-3.5">Dosen Pengampu</th>
                    <th className="py-3 px-3.5">Ruang</th>
                    <th className="py-3 px-3.5">Rombel & Mahasiswa</th>
                    <th className="py-3 px-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                        <div className="max-w-md mx-auto space-y-2">
                          <p className="font-semibold text-slate-700">Tidak ada jadwal perkuliahan yang cocok</p>
                          <p className="text-xs text-slate-400">
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
                      const studentCount = getScheduleStudentCount(sch.rombel);

                      return (
                        <tr key={sch.id} className="hover:bg-slate-50/70 transition">
                          {/* Hari & Jam */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block">{sch.day}</span>
                            <span className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {sch.startTime}–{sch.endTime} WIB
                            </span>
                          </td>

                          {/* Kode & Mata Kuliah (Master DB Sync) */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                {sch.courseCode}
                              </span>
                              <div className="font-bold text-slate-900">{sch.courseName}</div>
                            </div>
                            
                            {/* Master Database Relation Badge */}
                            <div className="flex items-center gap-1.5 mt-1">
                              {sch.prodi === 'Lintas Program Studi' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded-md border border-purple-300">
                                  <GitMerge className="w-3 h-3 text-purple-700" />
                                  <span>Lintas Program Studi</span>
                                </span>
                              ) : masterMatch ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <BookmarkCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Master MK · Sem {masterMatch.semester || '-'} · {sch.prodi}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  {sch.prodi}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* SKS */}
                          <td className="py-3 px-3.5 text-center">
                            <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-800 font-bold text-xs">
                              {sch.sks} SKS
                            </span>
                          </td>

                          {/* Dosen Pengampu */}
                          <td className="py-3 px-3.5">
                            <div className="font-medium text-slate-900">{sch.lecturerName}</div>
                            <div className="text-[11px] text-slate-500">Dosen Pengampu</div>
                          </td>

                          {/* Ruang */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs">
                              {sch.room}
                            </span>
                          </td>

                          {/* Rombel & Mahasiswa Connection */}
                          <td className="py-3 px-3.5">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span className="font-bold text-xs text-slate-900 bg-indigo-50 border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded-md">
                                Rombel {sch.rombel}
                              </span>
                              
                              <button
                                type="button"
                                onClick={() => handleOpenScheduleRoster(sch)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                                title="Klik untuk melihat daftar mahasiswa terhubung di rombel ini"
                              >
                                <Users className="w-3.5 h-3.5 text-blue-600" />
                                <span>{studentCount} Mahasiswa Terdaftar</span>
                              </button>
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenScheduleRoster(sch)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="Lihat Daftar Mahasiswa Terhubung"
                              >
                                <Users className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenScheduleModal(sch)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Edit Jadwal"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmConfig({
                                    isOpen: true,
                                    title: 'Hapus Jadwal Kuliah?',
                                    message: `Apakah Anda yakin ingin menghapus jadwal ${sch.courseName} (${sch.day}, ${sch.startTime}–${sch.endTime}) untuk rombel ${sch.rombel}?`,
                                    confirmLabel: 'Ya, Hapus Jadwal',
                                    isDestructive: true,
                                    onConfirm: () => {
                                      deleteSchedule(sch.id);
                                      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                    },
                                  });
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
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
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold uppercase tracking-wider">
                    Sistem Relasi Akademik
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500 font-medium">Semester Ganjil 2026/2027</span>
                </div>
                <h3 className="text-base sm:text-xl font-bold text-slate-900 mt-1">
                  Data Peserta Rombel Mahasiswa & Relasi Jadwal ({students.length})
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Mahasiswa dikelompokkan berdasarkan rombel (1 mahasiswa dapat berada di &gt;1 rombel). Setiap rombel otomatis terhubung ke jadwal mata kuliah masing-masing.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => handleOpenBulkImport('students')}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Impor rombel mahasiswa dari file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Import Excel Mahasiswa</span>
                </button>

                <button
                  onClick={() => handleOpenRombelModal()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs"
                  title="Tambah Rombel baru dan hubungkan ke beberapa jadwal mata kuliah"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Buat Rombel Baru</span>
                </button>

                <button
                  onClick={() => handleOpenStudentModal()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-2xs"
                  title="Tambah mahasiswa baru dan atur pilihan rombelnya"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Tambah Mahasiswa &amp; Rombel</span>
                </button>
              </div>
            </div>

            {/* Warning Alert Banner for Students with > 20 SKS */}
            {overLimitSksStudents.length > 0 && (
              <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-orange-500/10 border-2 border-amber-300 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs animate-in fade-in">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold shadow-2xs animate-pulse">
                        ⚠️ PERINGATAN BEBAN STUDI (&gt; 20 SKS)
                      </span>
                      <span className="text-xs text-amber-900 font-semibold">Batas Regulasi Kampus: Maks. 20 SKS / Semester</span>
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                      Ditemukan {overLimitSksStudents.length} Mahasiswa Memiliki Mata Kuliah Lebih dari 20 SKS
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                      Sistem mendeteksi mahasiswa dengan beban studi melampaui batas standar 20 SKS. Anda dapat memfilter mahasiswa di bawah dan mengklik tombol <strong>"Ubah SKS"</strong> untuk menyesuaikan rombel atau mendrop mata kuliah.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedRombelFilter(selectedRombelFilter === 'OVER_20_SKS' ? 'ALL' : 'OVER_20_SKS')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs w-full md:w-auto cursor-pointer ${
                      selectedRombelFilter === 'OVER_20_SKS'
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>{selectedRombelFilter === 'OVER_20_SKS' ? 'Tampilkan Semua Mahasiswa' : `Filter ${overLimitSksStudents.length} Mahasiswa (>20 SKS)`}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500 font-medium block">Total Mahasiswa</span>
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5 block">
                  {students.length} <span className="text-xs font-normal text-slate-500">Orang</span>
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500 font-medium block">Rombel Aktif</span>
                <span className="text-xl sm:text-2xl font-bold text-indigo-600 tracking-tight mt-0.5 block">
                  {allDistinctRombels.length} <span className="text-xs font-normal text-slate-500">Rombel</span>
                </span>
              </div>

              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl">
                <span className="text-xs text-purple-700 font-medium block">Multi-Rombel (&gt;1 Rombel)</span>
                <span className="text-xl sm:text-2xl font-bold text-purple-900 tracking-tight mt-0.5 block">
                  {multiRombelStudentsCount} <span className="text-xs font-normal text-purple-600">Mahasiswa</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRombelFilter(selectedRombelFilter === 'OVER_20_SKS' ? 'ALL' : 'OVER_20_SKS')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  selectedRombelFilter === 'OVER_20_SKS'
                    ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-400'
                    : overLimitSksStudents.length > 0
                      ? 'bg-rose-50/80 border-rose-300 hover:bg-rose-100/70'
                      : 'bg-slate-50 border-slate-200'
                }`}
                title="Klik untuk memfilter mahasiswa dengan beban studi melebihi 20 SKS"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rose-700 font-bold block flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>SKS &gt; 20 (Flag)</span>
                  </span>
                  {overLimitSksStudents.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  )}
                </div>
                <span className="text-xl sm:text-2xl font-bold text-rose-800 tracking-tight mt-0.5 block">
                  {overLimitSksStudents.length} <span className="text-xs font-normal text-rose-600">Mahasiswa</span>
                </span>
              </button>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500 font-medium block">Jadwal Kuliah Terhubung</span>
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5 block">
                  {schedules.length} <span className="text-xs font-normal text-slate-500">Kelas</span>
                </span>
              </div>
            </div>

            {/* Search and Rombel Filter Chips */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Cari mahasiswa berdasarkan NIM, nama, atau rombel..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                  />
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-medium shrink-0">
                  Menampilkan <strong className="text-slate-900">{filteredStudents.length}</strong> dari {students.length} mahasiswa
                </div>
              </div>

              {/* Rombel Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedRombelFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer border ${
                    selectedRombelFilter === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Semua Rombel ({students.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRombelFilter('OVER_20_SKS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer border flex items-center gap-1.5 ${
                    selectedRombelFilter === 'OVER_20_SKS'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : overLimitSksStudents.length > 0
                        ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 font-extrabold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>⚠️ SKS &gt; 20 ({overLimitSksStudents.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRombelFilter('MULTI')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer border ${
                    selectedRombelFilter === 'MULTI'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  ✨ Multi-Rombel ({multiRombelStudentsCount})
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      <span>Rombel {rName}</span>
                      <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {countInRombel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs sm:text-sm text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-12 text-center">No</th>
                    <th className="py-3 px-3.5">NIM &amp; Akun</th>
                    <th className="py-3 px-3.5">Nama Mahasiswa</th>
                    <th className="py-3 px-3.5">Program Studi</th>
                    <th className="py-3 px-3.5">Rombel Terdaftar</th>
                    <th className="py-3 px-3.5">Jadwal Terhubung</th>
                    <th className="py-3 px-3.5 text-right w-36">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        <Users className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                        <p className="font-semibold text-slate-700">Tidak ada data mahasiswa ditemukan</p>
                        <p className="text-xs text-slate-400 mt-0.5">
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
                              ? 'bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-amber-500'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3.5 px-3.5 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>

                          <td className="py-3.5 px-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {student.nim}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                                title="Akun Pengguna Aktif untuk Login Mahasiswa & Presensi QR"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Akun Aktif</span>
                              </span>
                              {isOverSks && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[10px] shadow-2xs animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Flag: &gt;20 SKS</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">
                              {student.email}
                            </div>
                          </td>

                          <td className="py-3.5 px-3.5">
                            <div className="font-bold text-slate-900">{student.name}</div>
                            {student.phone && (
                              <div className="text-[11px] text-slate-400">{student.phone}</div>
                            )}
                            {student.excludedScheduleIds && student.excludedScheduleIds.length > 0 && (
                              <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                                ({student.excludedScheduleIds.length} matkul di-drop)
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-3.5 text-slate-700 font-medium">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              student.prodi === 'Teknologi Informasi'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {student.prodi}
                            </span>
                          </td>

                          <td className="py-3.5 px-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {rombelList.map((r) => (
                                <span
                                  key={r}
                                  className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-200"
                                >
                                  {r}
                                </span>
                              ))}
                              {isMulti && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold text-[10px]">
                                  Multi ({rombelList.length})
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-3.5">
                            <button
                              type="button"
                              onClick={() => handleViewStudentSchedules(student)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                isOverSks
                                  ? 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200 font-bold shadow-2xs'
                                  : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border-slate-200 hover:border-indigo-200'
                              }`}
                              title={isOverSks ? 'Peringatan: Beban SKS melebihi batas 20 SKS! Klik untuk melihat rincian' : 'Klik untuk melihat rincian jadwal dan mata kuliah mahasiswa ini'}
                            >
                              {isOverSks ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              ) : (
                                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
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
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                  title="Ubah Rombel / Sesuaikan Mata Kuliah untuk Menurunkan SKS"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Ubah SKS</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentModal(student)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  title="Edit Data & Pilihan Rombel Mahasiswa"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleViewStudentSchedules(student)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="Lihat Jadwal Terhubung Lengkap"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmConfig({
                                    isOpen: true,
                                    title: 'Hapus Data Mahasiswa?',
                                    message: `Apakah Anda yakin ingin menghapus data mahasiswa ${student.name} (${student.nim})? Akun login mahasiswa dan relasi rombel akan dihapus dari sistem.`,
                                    confirmLabel: 'Ya, Hapus',
                                    isDestructive: true,
                                    onConfirm: () => {
                                      deleteStudent(student.nim);
                                      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                    },
                                  });
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
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
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Matriks Relasi Rombel ↔ Mata Kuliah &amp; Jadwal Perkuliahan
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Setiap rombel berelasi ke mata kuliah dengan jadwal hari, jam, ruang, dan dosen pengampu masing-masing
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setRombelStatusFilter('ALL')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${rombelStatusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Semua ({rombelMatrix.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRombelStatusFilter('ACTIVE')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${rombelStatusFilter === 'ACTIVE' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Aktif ({rombelMatrix.filter(r => !r.rombelData?.isArchived).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRombelStatusFilter('ARCHIVED')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${rombelStatusFilter === 'ARCHIVED' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Diarsipkan ({rombelMatrix.filter(r => r.rombelData?.isArchived).length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenRombelModal()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Rombel Baru</span>
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
                    className={`border rounded-2xl bg-white p-4 sm:p-5 flex flex-col justify-between transition shadow-2xs space-y-4 ${isArchived ? 'border-amber-300/80 bg-amber-50/20' : 'border-slate-200 hover:border-indigo-300'}`}
                  >
                    <div>
                      {/* Rombel Card Header */}
                      <div className="flex items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-3 py-1 rounded-xl text-white font-bold text-sm shadow-2xs ${isArchived ? 'bg-amber-600' : 'bg-indigo-600'}`}>
                            Rombel {item.rombel}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-800">
                                {item.name}
                              </span>
                              {isArchived && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-0.5">
                                  <Archive className="w-2.5 h-2.5" />
                                  <span>Diarsipkan</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {item.prodi} {item.semester ? `· Sem ${item.semester}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                            {item.students.length} Mhs
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
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
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
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
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                            title={`Atur atau hubungkan jadwal mata kuliah untuk Rombel ${item.rombel}`}
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Action Button: Archive / Restore Rombel */}
                          {isArchived ? (
                            <button
                              type="button"
                              onClick={() => restoreRombel(item.rombel)}
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                              title={`Pulihkan Rombel ${item.rombel} dari Arsip`}
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => archiveRombel(item.rombel)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition cursor-pointer"
                              title={`Arsipkan Rombel ${item.rombel}`}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Action Button: Delete Rombel (Protected with Relation Check) */}
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteRombelRequest(item.rombelData || {
                                id: `rombel-${item.rombel.toLowerCase()}`,
                                code: item.rombel,
                                isArchived,
                              });
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title={`Hapus Rombel ${item.rombel} (Dicegah jika berelasi)`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Course Schedules in this Rombel */}
                      <div className="mt-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
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
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Link className="w-3 h-3" />
                            <span>+ Hubungkan Jadwal</span>
                          </button>
                        </div>

                        {item.schedules.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <Calendar className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                            <p className="font-semibold text-slate-600">Belum ada jadwal yang dikaitkan ke rombel ini</p>
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
                              className="mt-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] inline-flex items-center gap-1"
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
                                className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 text-xs transition"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 truncate">
                                      {sch.courseName}
                                    </span>
                                    <span className="px-1.5 py-0.2 bg-white text-slate-600 font-mono text-[10px] rounded border border-slate-200">
                                      {sch.courseCode}
                                    </span>
                                    <span className="font-semibold text-indigo-700 text-[10px]">
                                      {sch.sks} SKS
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                    <span>{sch.day}, {sch.startTime}–{sch.endTime}</span>
                                    <span>·</span>
                                    <span className="font-semibold text-slate-700">{sch.room}</span>
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
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Mahasiswa Terdaftar ({item.students.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedRombelMatrix(isExpanded ? null : item.rombel)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Tutup Daftar' : 'Lihat Semua'}</span>
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className={`flex flex-wrap gap-1.5 ${isExpanded ? 'max-h-60 overflow-y-auto' : 'max-h-16 overflow-hidden'}`}>
                        {item.students.length === 0 ? (
                          <div className="text-[11px] text-slate-400 italic py-1">
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
                                className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border ${
                                  isMulti
                                    ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                                }`}
                                title={`Klik untuk melihat jadwal ${stu.name}`}
                              >
                                <span className="font-mono text-[10px] text-slate-400">{stu.nim}</span>
                                <span className="font-semibold truncate max-w-[120px]">{stu.name}</span>
                                {isMulti && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Mahasiswa Multi-Rombel" />
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
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/40 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 transition cursor-pointer group min-h-[220px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 group-hover:border-indigo-400 group-hover:bg-indigo-600 group-hover:text-white text-slate-600 flex items-center justify-center transition shadow-2xs">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-900">
                    + Tambah Rombel Baru
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Buat rombel kelas baru dan hubungkan ke beberapa jadwal mata kuliah sekaligus
                  </p>
                </div>
                <span className="text-xs font-bold text-indigo-600 group-hover:underline">
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
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>Master Mata Kuliah Kurikulum</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                      {courses.length} MK
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Katalog master mata kuliah kurikulum STMIK PGRI Arungbinang Kebumen yang terhubung ke Jadwal dan Presensi
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOpenBulkImport('courses')}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Impor master mata kuliah dari file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Import Excel MK</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenCourseModal()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Mata Kuliah</span>
                </button>
              </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Mata Kuliah
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">
                  {courses.length}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Kurikulum Terdaftar</span>
              </div>

              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Mata Kuliah Aktif
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5 block">
                  {courses.filter(c => !c.isArchived).length}
                </span>
                <span className="text-[11px] text-emerald-600 mt-0.5 block">Siap Ditugaskan</span>
              </div>

              <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                  Diarsipkan
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5 block">
                  {courses.filter(c => c.isArchived).length}
                </span>
                <span className="text-[11px] text-amber-600 mt-0.5 block">Non-Aktif / Arsip</span>
              </div>

              <div className="p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-xl">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
                  Terhubung ke Jadwal
                </span>
                <span className="text-xl sm:text-2xl font-black text-indigo-900 mt-0.5 block">
                  {new Set(schedules.map(s => s.courseCode.toUpperCase())).size}
                </span>
                <span className="text-[11px] text-indigo-600 mt-0.5 block">Aktif di Semester Ini</span>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="pt-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Cari kode MK, nama mata kuliah, atau dosen pengampu..."
                  className="w-full pl-9.5 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Prodi filter */}
                <select
                  value={courseProdiFilter}
                  onChange={(e) => setCourseProdiFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">Semua Program Studi</option>
                  <option value="Teknologi Informasi">Teknologi Informasi (TI)</option>
                  <option value="Manajemen Informatika">Manajemen Informatika (MI)</option>
                </select>

                {/* Semester filter */}
                <select
                  value={courseSemesterFilter}
                  onChange={(e) => setCourseSemesterFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">Semua Semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>

                {/* Archive Status filter */}
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setCourseStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${courseStatusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Semua ({courses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseStatusFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${courseStatusFilter === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Aktif ({courses.filter(c => !c.isArchived).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseStatusFilter('ARCHIVED')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${courseStatusFilter === 'ARCHIVED' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
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
                  className={`p-5 rounded-2xl border bg-white flex flex-col justify-between transition shadow-2xs space-y-4 ${isArchived ? 'border-amber-300/80 bg-amber-50/20' : 'border-slate-200 hover:border-emerald-400'}`}
                >
                  <div>
                    {/* Course Card Top Badges & Actions */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {course.code}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {course.sks} SKS
                        </span>
                        {isArchived && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
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
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
                          title={`Edit Mata Kuliah ${course.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Archive / Restore Button */}
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={() => restoreCourse(course.id)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                            title={`Pulihkan ${course.name} dari Arsip`}
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => archiveCourse(course.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition cursor-pointer"
                            title={`Arsipkan Mata Kuliah ${course.name}`}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Button (Protected with Relation Check) */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCourseRequest(course)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title={`Hapus Mata Kuliah ${course.name} (Dicegah jika berelasi)`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 mt-2 line-clamp-1">
                      {course.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {course.prodi} · Semester {course.semester} {course.semester % 2 === 1 ? '(Ganjil)' : '(Genap)'}
                    </p>

                    {course.description && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2 bg-slate-50 p-2 rounded-lg">
                        {course.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Dosen Pengampu:</span>
                      <span className="font-semibold text-slate-800 text-right truncate max-w-[160px]">
                        {course.defaultLecturerName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400 text-[11px]">Relasi Jadwal:</span>
                      {linkedSchedules.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">
                          {linkedSchedules.length} Kelas Aktif
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
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
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 transition cursor-pointer group min-h-[220px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 group-hover:border-emerald-400 group-hover:bg-emerald-600 group-hover:text-white text-slate-600 flex items-center justify-center transition shadow-2xs">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-emerald-900">
                  + Tambah Mata Kuliah Baru
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Masukkan mata kuliah baru ke dalam master kurikulum akademik kampus
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 group-hover:underline">
                Buka Formulir Mata Kuliah &rarr;
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DATABASE BACKUP & RESTORE */}
      {activeTab === 'database' && (
        <DatabaseBackupTab
          onOpenResetConfirm={() => {
            setConfirmConfig({
              isOpen: true,
              title: 'Reset ke Data Default?',
              message: 'Tindakan ini akan mengembalikan seluruh jadwal, pengguna, sesi presensi, dan data mahasiswa ke kondisi bawaan STMIK PGRI Arungbinang Kebumen.',
              confirmLabel: 'Ya, Reset Data',
              isDestructive: true,
              onConfirm: () => {
                resetToDefaultData();
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
              },
            });
          }}
        />
      )}

      {/* TAB 6: CAMPUS DEVICE SESSIONS & ANTI-HIJACKING */}
      {activeTab === 'devices' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-bold text-slate-900">Manajemen Sesi Perangkat Terdaftar Seluruh Kampus</h3>
            <p className="text-xs text-slate-500 mt-1">
              Pantau seluruh perangkat browser mahasiswa, dosen, dan staf yang aktif atau tersimpan. BAAK dapat memutuskan sesi mencurigakan untuk melindungi integritas sistem presensi.
            </p>
          </div>
          <DeviceSessionManager mode="admin" />
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {editingUserId ? 'Edit Akun Pengguna' : 'Tambah Pengguna Baru'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4 text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Contoh: Budi Santoso, M.Kom."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md font-medium text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">NIM / NIDN</label>
                  <input
                    type="text"
                    value={userUsername}
                    onChange={(e) => setUserUsername(e.target.value)}
                    placeholder="26TI0010"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md font-mono text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Peran (Role)</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as Role)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                  >
                    <option value="dosen">Dosen</option>
                    <option value="mahasiswa">Mahasiswa</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="email@stmik-arungbinang.ac.id"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Kata Sandi Akun</span>
                  <span className="text-xs font-normal text-slate-500">
                    {editingUserId ? 'Kosongkan jika tidak diubah' : 'Default sesuai role jika kosong'}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showUserPassword ? 'text' : 'password'}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder={editingUserId ? 'Masukkan kata sandi baru untuk akun ini' : 'pass123 / dosen123 / baak123'}
                    className="w-full px-3.5 py-2 pr-10 bg-white border border-slate-300 rounded-md font-mono text-slate-900 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    title={showUserPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Perubahan email dan kata sandi otomatis tersimpan di database dan langsung diselaraskan ke seluruh sistem.
                </p>
              </div>

              {userRole === 'mahasiswa' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Rombel / Kelas</label>
                    <input
                      type="text"
                      value={userRombel}
                      onChange={(e) => setUserRombel(e.target.value)}
                      placeholder="TI 3"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Program Studi</label>
                    <select
                      value={userProdi}
                      onChange={(e) => setUserProdi(e.target.value as ProgramStudi)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                    >
                      <option value="Teknologi Informasi">Teknologi Informasi</option>
                      <option value="Manajemen Informatika">Manajemen Informatika</option>
                    </select>
                  </div>
                </div>
              )}

              {userRole === 'dosen' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Jabatan / Gelar</label>
                  <input
                    type="text"
                    value={userTitle}
                    onChange={(e) => setUserTitle(e.target.value)}
                    placeholder="Contoh: Dosen Tetap / Dosen Wali"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                  />
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold cursor-pointer"
                >
                  Simpan Pengguna
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
        onSave={(data) => {
          if (editingStudent) {
            updateStudent(editingStudent.nim, data);
          } else {
            addStudent(data);
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
        onSave={(data, scheduleIds) => {
          addRombel(data, scheduleIds);
        }}
        onUpdate={(id, data, scheduleIds, previousCode) => {
          updateRombel(id, data, scheduleIds, previousCode);
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
        onSave={(data) => {
          addCourse(data);
        }}
        onUpdate={(id, data) => {
          updateCourse(id, data);
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
