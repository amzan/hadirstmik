import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  User, Course, ScheduleItem, Student, AttendanceSession,
  AttendanceRecord, LeaveRequest, AttendanceStatus, DayOfWeek,
  DatabaseBackupData, DatabaseBackup, DatabaseSnapshot, DeviceSession, Rombel
} from '../types/attendance';
import {
  INITIAL_USERS, INITIAL_STUDENTS, INITIAL_COURSES, INITIAL_SCHEDULES,
  INITIAL_SESSIONS, INITIAL_RECORDS, INITIAL_LEAVE_REQUESTS, INITIAL_ROMBELS,
  isStudentInRombel, getStudentRombelList, CAMPUS_INFO, STUDENT_AVATARS
} from '../data/initialData';
import {
  loadLocalSnapshots, saveLocalSnapshot, deleteLocalSnapshot,
  sanitizeAlgoritmaCourseAndSchedules, getLatestMasterBackup
} from '../utils/databaseBackupService';
import {
  loadDeviceSessions, saveDeviceSessions, createOrUpdateDeviceSession,
  getOrCreateDeviceId, getCurrentSessionToken, clearCurrentSessionToken
} from '../utils/deviceSessionService';

interface AttendanceContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  students: Student[];
  courses: Course[];
  schedules: ScheduleItem[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  
  // Simulated or active time for schedule matching
  activeDay: DayOfWeek;
  setActiveDay: (day: DayOfWeek) => void;
  simulatedTime: string;
  setSimulatedTime: (time: string) => void;
  useSimulatedTime: boolean;
  setUseSimulatedTime: (val: boolean) => void;
  
  // Session methods
  createSession: (data: {
    scheduleId?: string;
    courseCode: string;
    courseName: string;
    rombel: string;
    room: string;
    meetingNumber: number;
    topic: string;
    isDynamicQr: boolean;
    date?: string;
    evaluationMethod?: string;
  }) => AttendanceSession;
  closeSession: (sessionId: string) => void;
  refreshQrToken: (sessionId: string) => string;
  resetClosedSessions: () => number;
  resetSingleSession: (sessionId: string) => void;
  reopenSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  
  // Attendance actions
  scanQrCode: (token: string, studentNim: string) => { success: boolean; message: string; session?: AttendanceSession };
  manualUpdateAttendance: (recordId: string, status: AttendanceStatus, notes?: string) => void;
  markStudentAttendanceDirectly: (sessionId: string, studentNim: string, status: AttendanceStatus, notes?: string) => void;
  batchMarkAttendance: (sessionId: string, updates: Array<{ studentNim: string; status: AttendanceStatus; notes?: string }>) => void;
  
  // Leave request actions
  submitLeaveRequest: (data: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>) => void;
  reviewLeaveRequest: (id: string, status: 'APPROVED' | 'REJECTED') => void;
  
  // Admin management
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
  addSchedule: (schedule: Omit<ScheduleItem, 'id'>) => void;
  updateSchedule: (id: string, schedule: Partial<ScheduleItem>) => void;
  deleteSchedule: (id: string) => void;
  
  addCourse: (course: Omit<Course, 'id'>) => void;
  updateCourse: (id: string, course: Partial<Course>) => void;
  deleteCourse: (id: string) => void;

  addStudent: (student: Student) => void;
  updateStudent: (nim: string, student: Partial<Student>) => void;
  deleteStudent: (nim: string) => void;
  syncStudentUsers: () => { count: number; added: number; updated: number };

  // Rombel & Schedule link management
  rombels: Rombel[];
  addRombel: (rombelData: Omit<Rombel, 'id'>, connectedScheduleIds?: string[]) => { success: boolean; message: string; rombel?: Rombel };
  updateRombel: (id: string, rombelData: Partial<Rombel>, connectedScheduleIds?: string[], previousCode?: string) => { success: boolean; message: string; rombel?: Rombel };
  deleteRombel: (id: string) => { success: boolean; message: string };
  linkSchedulesToRombel: (rombelCode: string, scheduleIds: string[]) => void;
  archiveRombel: (idOrCode: string) => { success: boolean; message: string };
  restoreRombel: (idOrCode: string) => { success: boolean; message: string };
  archiveCourse: (idOrCode: string) => { success: boolean; message: string };
  restoreCourse: (idOrCode: string) => { success: boolean; message: string };
  checkRombelRelations: (rombelCode: string) => {
    canDelete: boolean;
    scheduleCount: number;
    studentCount: number;
    sessionCount: number;
    schedules: ScheduleItem[];
    students: Student[];
    sessions: AttendanceSession[];
  };
  checkCourseRelations: (courseCode: string) => {
    canDelete: boolean;
    scheduleCount: number;
    sessionCount: number;
    schedules: ScheduleItem[];
    sessions: AttendanceSession[];
  };
  
  resetToDefaultData: () => void;
  
  // Meeting date management
  setScheduleMeetingDate: (scheduleId: string, meetingNumber: number, date: string) => void;
  setScheduleAllMeetingDates: (scheduleId: string, dates: Record<number, string>) => void;
  getMeetingDateForSchedule: (schedule: ScheduleItem, meetingNumber: number) => string;

  // Computed helpers
  getStudentsForRombel: (rombel: string) => Student[];
  getActiveScheduleNow: () => ScheduleItem | null;
  getSchedulesForDay: (day: DayOfWeek) => ScheduleItem[];
  getAttendanceRateForStudent: (nim: string, courseCode?: string) => { totalSessions: number; hadir: number; izin: number; sakit: number; alpha: number; percentage: number };

  // Password reset helpers across all users
  findUserByIdentifier: (identifier: string) => User | null;
  resetUserPassword: (identifier: string, newPassword: string) => { success: boolean; message: string; user?: User };

  // Database Backup, Export, Restore & Snapshot Management
  getDatabaseBackupData: () => DatabaseBackupData;
  restoreDatabase: (backupData: any) => {
    success: boolean;
    message: string;
    restoredCounts?: {
      users: number;
      students: number;
      courses: number;
      schedules: number;
      sessions: number;
      records: number;
      leaveRequests: number;
    };
  };
  restoreMasterDatabase: () => {
    success: boolean;
    message: string;
    restoredCounts?: {
      users: number;
      students: number;
      courses: number;
      schedules: number;
      sessions: number;
      records: number;
      leaveRequests: number;
    };
  };
  createSnapshot: (name?: string, note?: string) => DatabaseSnapshot;
  restoreSnapshot: (snapshotId: string) => { success: boolean; message: string };
  deleteSnapshot: (snapshotId: string) => void;
  snapshots: DatabaseSnapshot[];
  reloadSnapshots: () => void;

  // Session & Auth isolation helpers
  logoutSession: () => void;

  // Device Sessions & Anti-Hijacking Security
  deviceSessions: DeviceSession[];
  currentDeviceId: string;
  currentDeviceSession: DeviceSession | null;
  getUserDeviceSessions: (userId?: string) => DeviceSession[];
  registerDeviceSession: (user: User) => DeviceSession;
  terminateDeviceSession: (sessionId: string) => { success: boolean; message: string };
  terminateOtherDeviceSessions: (userId: string) => { count: number; message: string };
  validateCurrentDeviceSession: () => { valid: boolean; reason?: string };

  // Bulk Excel import & updates
  bulkUpdateSchedules: (items: ScheduleItem[], mode?: 'merge' | 'replace') => { added: number; updated: number; total: number };
  bulkUpdateUsers: (items: User[], mode?: 'merge' | 'replace') => { added: number; updated: number; total: number };
  bulkUpdateStudents: (items: Student[], mode?: 'merge' | 'replace') => { added: number; updated: number; total: number };
  bulkUpdateCourses: (items: Course[], mode?: 'merge' | 'replace') => { added: number; updated: number; total: number };
  bulkImportAll: (data: { schedules?: ScheduleItem[]; users?: User[]; students?: Student[]; courses?: Course[] }, mode?: 'merge' | 'replace') => { schedulesCount: number; usersCount: number; studentsCount: number; coursesCount: number };
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const SESSION_KEYS = {
  AUTH_ACTIVE: 'stmik_auth_session_active',
  ACTIVE_USER: 'stmik_active_user_session',
  LAST_ACTIVITY: 'stmik_last_activity_timestamp',
  CURRENT_USER_ID: 'stmik_current_user_id_v1',
  REMEMBERED_ROLE: 'stmik_remembered_role',
  REMEMBERED_USERNAME: 'stmik_remembered_username',
};

export const GUEST_USER: User = {
  id: 'guest',
  username: '',
  name: 'Pengunjung',
  email: '',
  role: 'mahasiswa',
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
};

const STORAGE_KEYS = {
  USERS: 'stmik_users_v1',
  STUDENTS: 'stmik_students_v1',
  COURSES: 'stmik_courses_v1',
  SCHEDULES: 'stmik_schedules_v1',
  ROMBELS: 'stmik_rombels_v1',
  SESSIONS: 'stmik_sessions_v1',
  RECORDS: 'stmik_records_v1',
  LEAVE: 'stmik_leave_v1',
  CURRENT_USER_ID: SESSION_KEYS.CURRENT_USER_ID,
};

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state from localStorage or seed
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (saved) {
      try {
        const parsed: Student[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= INITIAL_STUDENTS.length) {
          return parsed;
        }
      } catch {}
    }
    return INITIAL_STUDENTS;
  });

  const [users, setUsers] = useState<User[]>(() => {
    // Determine existing students pool
    let currentStudents = INITIAL_STUDENTS;
    const savedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (savedStudents) {
      try {
        const parsedSt: Student[] = JSON.parse(savedStudents);
        if (Array.isArray(parsedSt) && parsedSt.length > 0) {
          currentStudents = parsedSt;
        }
      } catch {}
    }

    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    let baseUsers: User[] = INITIAL_USERS;
    if (saved) {
      try {
        const parsed: User[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          baseUsers = parsed.map(u => {
            const init = INITIAL_USERS.find(iu => iu.id === u.id);
            return {
              ...init,
              ...u,
              nidn: u.nidn || init?.nidn || (u.role === 'dosen' ? u.username : undefined),
              ...(u.role === 'admin' ? { username: 'baak' } : {}),
            };
          });
        }
      } catch {
        baseUsers = INITIAL_USERS;
      }
    }

    // Map existing student users to preserve custom passwords, avatars, etc.
    const studentUserMap = new Map<string, User>();
    baseUsers.forEach(u => {
      if (u.role === 'mahasiswa') {
        studentUserMap.set(u.username.toUpperCase(), u);
      }
    });

    // Ensure 100% of students in currentStudents have a User account
    const studentUsers: User[] = currentStudents.map((s, idx) => {
      const existing = studentUserMap.get(s.nim.toUpperCase());
      const rombelList = s.rombels && s.rombels.length > 0 ? s.rombels : getStudentRombelList(s.rombel);
      const joinedRombel = rombelList.join(', ') || s.rombel;

      return {
        id: existing?.id || `mhs-${s.nim}`,
        username: s.nim,
        name: s.name,
        email: s.email || `${s.nim.toLowerCase()}@student.stmik-arungbinang.ac.id`,
        role: 'mahasiswa' as const,
        prodi: s.prodi,
        rombel: joinedRombel,
        rombels: rombelList,
        phone: s.phone || existing?.phone,
        password: existing?.password,
        avatarUrl: existing?.avatarUrl || `https://images.unsplash.com/photo-${STUDENT_AVATARS[idx % STUDENT_AVATARS.length]}?w=150`,
        excludedScheduleIds: s.excludedScheduleIds || existing?.excludedScheduleIds,
        customScheduleIds: s.customScheduleIds || existing?.customScheduleIds,
      };
    });

    const nonStudentUsers = baseUsers.filter(u => u.role !== 'mahasiswa');
    return [...nonStudentUsers, ...studentUsers];
  });

  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COURSES);
    if (saved) {
      try {
        const parsed: Course[] = JSON.parse(saved);
        return parsed.map(c => {
          if (c.code === 'MKMI0105' || c.name.toLowerCase().includes('algoritma dan pemrograman')) {
            return {
              ...c,
              name: 'Algoritma dan Pemrograman',
              sks: 2,
              defaultLecturerId: 'dosen-10',
              defaultLecturerName: 'Ammar Fauzan, S.Pd., M.Kom.',
            };
          }
          return c;
        });
      } catch {
        return INITIAL_COURSES;
      }
    }
    return INITIAL_COURSES;
  });

  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    if (saved) {
      try {
        const parsed: ScheduleItem[] = JSON.parse(saved);
        return parsed.map(s => {
          if (s.courseCode === 'MKMI0105' || s.courseName.toLowerCase().includes('algoritma dan pemrograman')) {
            return {
              ...s,
              day: 'Rabu',
              startTime: '18:00',
              endTime: '19:40',
              sks: 2,
              lecturerId: 'dosen-10',
              lecturerName: 'Ammar Fauzan, S.Pd., M.Kom.',
            };
          }
          return s;
        });
      } catch {
        return INITIAL_SCHEDULES;
      }
    }
    return INITIAL_SCHEDULES;
  });

  const [sessions, setSessions] = useState<AttendanceSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (saved) {
      try {
        const parsed: AttendanceSession[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= INITIAL_SESSIONS.length) {
          return parsed.map(sess => {
            if (sess.courseCode === 'MKMI0105' || sess.courseName.toLowerCase().includes('algoritma dan pemrograman')) {
              return {
                ...sess,
                startTime: '18:00',
                endTime: '19:40',
                lecturerId: 'dosen-10',
                lecturerName: 'Ammar Fauzan, S.Pd., M.Kom.',
              };
            }
            return sess;
          });
        }
      } catch {}
    }
    return INITIAL_SESSIONS;
  });

  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (saved) {
      try {
        const parsed: AttendanceRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= INITIAL_RECORDS.length) {
          return parsed;
        }
      } catch {}
    }
    return INITIAL_RECORDS;
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LEAVE);
    return saved ? JSON.parse(saved) : INITIAL_LEAVE_REQUESTS;
  });

  const [rombels, setRombels] = useState<Rombel[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROMBELS);
    if (saved) {
      try {
        const parsed: Rombel[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {}
    }
    return INITIAL_ROMBELS;
  });

  // Device Sessions state (tracking all logged-in devices across campus)
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>(() => loadDeviceSessions());

  useEffect(() => {
    saveDeviceSessions(deviceSessions);
  }, [deviceSessions]);

  const currentDeviceId = useMemo(() => getOrCreateDeviceId(), []);

  // Current logged in user (restored safely and strictly from saved active user session)
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const isAuth = localStorage.getItem(SESSION_KEYS.AUTH_ACTIVE) === 'true';
      const lastAct = Number(localStorage.getItem(SESSION_KEYS.LAST_ACTIVITY));
      const isSessionValid = isAuth && !isNaN(lastAct) && (Date.now() - lastAct < 2 * 60 * 60 * 1000);

      if (isSessionValid) {
        // 1. Try reading the full serialized active user object
        const activeUserJson = localStorage.getItem(SESSION_KEYS.ACTIVE_USER);
        if (activeUserJson) {
          const parsed = JSON.parse(activeUserJson) as User;
          if (parsed && parsed.id && parsed.role) {
            // Check if this user exists in loaded users
            const inUsers = users.find(u => 
              u.id === parsed.id ||
              (u.username && parsed.username && u.username.toLowerCase() === parsed.username.toLowerCase() && u.role === parsed.role)
            );
            if (inUsers) return inUsers;

            // If it's a student, cross-reference with master students
            if (parsed.role === 'mahasiswa' && parsed.username) {
              const matchedStudent = students.find(s => s.nim.toUpperCase() === parsed.username.toUpperCase());
              if (matchedStudent) {
                return {
                  ...parsed,
                  id: `mhs-${matchedStudent.nim}`,
                  name: matchedStudent.name || parsed.name,
                  prodi: matchedStudent.prodi || parsed.prodi,
                  rombel: matchedStudent.rombel || parsed.rombel,
                  email: matchedStudent.email || parsed.email,
                  phone: matchedStudent.phone || parsed.phone,
                };
              }
            }
            return parsed;
          }
        }

        // 2. Check saved user ID
        const savedUserId = localStorage.getItem(SESSION_KEYS.CURRENT_USER_ID);
        if (savedUserId) {
          const found = users.find(u => u.id === savedUserId);
          if (found) return found;

          // If student ID or NIM
          if (savedUserId.startsWith('mhs-')) {
            const nim = savedUserId.replace('mhs-', '').toUpperCase();
            const foundStu = students.find(s => s.nim.toUpperCase() === nim);
            if (foundStu) {
              return {
                id: `mhs-${foundStu.nim}`,
                username: foundStu.nim,
                name: foundStu.name,
                email: foundStu.email,
                role: 'mahasiswa',
                prodi: foundStu.prodi,
                rombel: foundStu.rombel,
                phone: foundStu.phone,
                avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              };
            }
          }
        }
      }
    } catch (e) {
      console.error('Error initializing user session:', e);
    }

    // Default neutral guest user when unauthenticated — NEVER default to Dosen Nur ('dosen-3')!
    return GUEST_USER;
  });

  // Sync currentUser changes to localStorage ONLY for active authenticated sessions
  useEffect(() => {
    const isAuth = localStorage.getItem(SESSION_KEYS.AUTH_ACTIVE) === 'true';
    if (isAuth && currentUser && currentUser.id !== 'guest') {
      localStorage.setItem(SESSION_KEYS.CURRENT_USER_ID, currentUser.id);
      localStorage.setItem(SESSION_KEYS.ACTIVE_USER, JSON.stringify(currentUser));
    }
  }, [currentUser]);

  // Ensure active session student is included in users list
  useEffect(() => {
    try {
      const activeUserJson = localStorage.getItem(SESSION_KEYS.ACTIVE_USER);
      if (activeUserJson) {
        const activeUser = JSON.parse(activeUserJson) as User;
        if (activeUser && activeUser.id && activeUser.id !== 'guest') {
          setUsers(prev => {
            const exists = prev.some(u => 
              u.id === activeUser.id || 
              (u.username && activeUser.username && u.username.toLowerCase() === activeUser.username.toLowerCase() && u.role === activeUser.role)
            );
            if (!exists) {
              return [...prev, activeUser];
            }
            return prev;
          });
        }
      }
    } catch {}
  }, []);

  // Live real-time clock and academic day state
  const getInitialDay = (): DayOfWeek => {
    const daysMap: DayOfWeek[] = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as any;
    const day = daysMap[new Date().getDay()];
    return (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].includes(day) ? day : 'Senin') as DayOfWeek;
  };

  const getInitialTime = (): string => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const [useSimulatedTime, setUseSimulatedTime] = useState<boolean>(false);
  const [activeDay, setActiveDay] = useState<DayOfWeek>(getInitialDay);
  const [simulatedTime, setSimulatedTime] = useState<string>(getInitialTime);

  // Live real-time clock updates automatically
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const daysMap: DayOfWeek[] = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as any;
      const day = daysMap[now.getDay()];
      if (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].includes(day)) {
        setActiveDay(day as DayOfWeek);
      }
      setSimulatedTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  // Preserve currentUser if authenticated session is active (within 2-hour inactivity rule); otherwise clear
  useEffect(() => {
    const isAuth = localStorage.getItem(SESSION_KEYS.AUTH_ACTIVE);
    const lastAct = Number(localStorage.getItem(SESSION_KEYS.LAST_ACTIVITY));
    const isSessionValid = isAuth === 'true' && !isNaN(lastAct) && (Date.now() - lastAct < 2 * 60 * 60 * 1000);
    if (!isSessionValid) {
      localStorage.removeItem(SESSION_KEYS.CURRENT_USER_ID);
      localStorage.removeItem(SESSION_KEYS.ACTIVE_USER);
      localStorage.removeItem(SESSION_KEYS.AUTH_ACTIVE);
      localStorage.removeItem(SESSION_KEYS.LAST_ACTIVITY);
      if (currentUser.id !== 'guest') {
        setCurrentUser(GUEST_USER);
      }
    }
  }, []);

  // Periodic automatic schedule checker:
  // "Kemudian gunakan jadwal perkuliahan sebagai acuan utama untuk pembaruan status kehadiran secara otomatis."
  // When an active session exceeds its schedule end time, or when a session is closed, update absentees to Alpha.
  const updateAbsenteesToAlpha = useCallback((session: AttendanceSession) => {
    // find all students in this rombel
    const eligibleStudents = students.filter(s => isStudentInRombel(s.rombel, session.rombel));
    
    setRecords(prevRecords => {
      const updated = [...prevRecords];
      eligibleStudents.forEach(stu => {
        const hasRecord = updated.some(r => r.sessionId === session.id && r.studentNim === stu.nim);
        if (!hasRecord) {
          // Check if student has an approved leave request
          const approvedLeave = leaveRequests.find(
            l => l.studentNim === stu.nim &&
                 l.courseCode === session.courseCode &&
                 l.date === session.date &&
                 l.status === 'APPROVED'
          );

          if (approvedLeave) {
            updated.push({
              id: `rec-auto-leave-${session.id}-${stu.nim}`,
              sessionId: session.id,
              courseCode: session.courseCode,
              courseName: session.courseName,
              studentNim: stu.nim,
              studentName: stu.name,
              rombel: stu.rombel,
              status: approvedLeave.type,
              scannedAt: new Date().toISOString(),
              verificationMethod: 'IZIN_APPROVED',
              notes: `Disetujui dari permohonan ${approvedLeave.type}: ${approvedLeave.reason}`,
            });
          } else {
            // Auto mark Alpha per schedule reference
            updated.push({
              id: `rec-auto-alpha-${session.id}-${stu.nim}`,
              sessionId: session.id,
              courseCode: session.courseCode,
              courseName: session.courseName,
              studentNim: stu.nim,
              studentName: stu.name,
              rombel: stu.rombel,
              status: 'ALPHA',
              scannedAt: new Date().toISOString(),
              verificationMethod: 'AUTO_SCHEDULE',
              notes: 'Otomatis: Tidak melakukan presensi hingga batas waktu perkuliahan',
            });
          }
        }
      });
      return updated;
    });
  }, [students, leaveRequests]);

  // Helper to get or calculate date for a specific meeting of a schedule
  const getMeetingDateForSchedule = useCallback((schedule: ScheduleItem, meetingNumber: number): string => {
    // 1. If explicit date in schedule.meetingDates
    if (schedule.meetingDates && schedule.meetingDates[meetingNumber]) {
      return schedule.meetingDates[meetingNumber];
    }

    // 2. If matching existing session exists
    const matchingSession = sessions.find(
      s => (s.scheduleId === schedule.id || (s.courseCode === schedule.courseCode && s.rombel === schedule.rombel)) &&
           s.meetingNumber === meetingNumber
    );
    if (matchingSession?.date) {
      return matchingSession.date;
    }

    // 3. Fallback: compute realistic date based on schedule day and academic semester (Semester Ganjil 2026/2027)
    // Starting week: Monday, 7 September 2026
    const dayOffsets: Record<DayOfWeek, number> = {
      'Senin': 0,
      'Selasa': 1,
      'Rabu': 2,
      'Kamis': 3,
      'Jumat': 4,
      'Sabtu': 5,
    };
    const dayOffset = dayOffsets[schedule.day] ?? 0;
    // Week offset: (meetingNumber - 1) * 7 days
    const baseDate = new Date(2026, 8, 7); // September 7, 2026
    const meetingDateObj = new Date(baseDate.getTime() + (dayOffset + (meetingNumber - 1) * 7) * 24 * 60 * 60 * 1000);
    
    // Format YYYY-MM-DD
    const yyyy = meetingDateObj.getFullYear();
    const mm = String(meetingDateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(meetingDateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [sessions]);

  // Update specific meeting date for a schedule
  const setScheduleMeetingDate = useCallback((scheduleId: string, meetingNumber: number, date: string) => {
    setSchedules(prev => prev.map(sch => {
      if (sch.id === scheduleId) {
        return {
          ...sch,
          meetingDates: {
            ...(sch.meetingDates || {}),
            [meetingNumber]: date,
          },
        };
      }
      return sch;
    }));

    // Sync any existing session for this schedule and meeting number
    setSessions(prev => prev.map(sess => {
      if (sess.scheduleId === scheduleId && sess.meetingNumber === meetingNumber) {
        return { ...sess, date };
      }
      return sess;
    }));
  }, []);

  // Update multiple or all meeting dates for a schedule
  const setScheduleAllMeetingDates = useCallback((scheduleId: string, dates: Record<number, string>) => {
    setSchedules(prev => prev.map(sch => {
      if (sch.id === scheduleId) {
        return {
          ...sch,
          meetingDates: {
            ...(sch.meetingDates || {}),
            ...dates,
          },
        };
      }
      return sch;
    }));

    // Sync existing sessions
    setSessions(prev => prev.map(sess => {
      if (sess.scheduleId === scheduleId && dates[sess.meetingNumber]) {
        return { ...sess, date: dates[sess.meetingNumber] };
      }
      return sess;
    }));
  }, []);

  // Create Session
  const createSession = useCallback((data: {
    scheduleId?: string;
    courseCode: string;
    courseName: string;
    rombel: string;
    room: string;
    meetingNumber: number;
    topic: string;
    isDynamicQr: boolean;
    date?: string;
    evaluationMethod?: string;
  }): AttendanceSession => {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Find matching schedule for default times and meeting date
    const matchingSchedule = schedules.find(s => s.id === data.scheduleId || (s.courseCode === data.courseCode && s.rombel === data.rombel));
    const startTime = matchingSchedule?.startTime || nowTimeStr;
    const endTime = matchingSchedule?.endTime || '12:00';
    const meetingDate = data.date || (matchingSchedule
      ? getMeetingDateForSchedule(matchingSchedule, data.meetingNumber)
      : todayStr);

    // If date is passed and schedule exists, sync schedule.meetingDates
    if (matchingSchedule && data.date) {
      setSchedules(prev => prev.map(sch => {
        if (sch.id === matchingSchedule.id) {
          return {
            ...sch,
            meetingDates: {
              ...(sch.meetingDates || {}),
              [data.meetingNumber]: data.date!,
            },
          };
        }
        return sch;
      }));
    }

    const tokenRandom = Math.random().toString(36).substring(2, 8).toUpperCase();
    const qrToken = `STMIK-${data.courseCode}-P${data.meetingNumber}-${tokenRandom}`;

    // Check if session for this meeting already exists
    const existing = sessions.find(
      s => (s.scheduleId === data.scheduleId || (s.courseCode === data.courseCode && s.rombel === data.rombel)) &&
           s.meetingNumber === data.meetingNumber
    );

    if (existing) {
      const updatedExisting: AttendanceSession = {
        ...existing,
        date: meetingDate,
        topic: data.topic || existing.topic,
        evaluationMethod: data.evaluationMethod ?? existing.evaluationMethod,
        isDynamicQr: data.isDynamicQr,
        isOpen: true,
      };

      setSessions(prev => prev.map(s => s.id === existing.id ? updatedExisting : s));
      return updatedExisting;
    }
    
    const newSession: AttendanceSession = {
      id: `session-${Date.now()}`,
      scheduleId: data.scheduleId,
      courseCode: data.courseCode,
      courseName: data.courseName,
      lecturerId: currentUser.id,
      lecturerName: currentUser.name,
      rombel: data.rombel,
      room: data.room,
      date: meetingDate,
      startTime,
      endTime,
      meetingNumber: data.meetingNumber,
      topic: data.topic || `Perkuliahan Pertemuan ${data.meetingNumber}`,
      evaluationMethod: data.evaluationMethod,
      qrToken,
      isDynamicQr: data.isDynamicQr,
      qrExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      isOpen: true,
      createdAt: new Date().toISOString(),
    };

    setSessions(prev => [newSession, ...prev]);
    return newSession;
  }, [currentUser, schedules, sessions, getMeetingDateForSchedule]);

  // Close Session & Trigger Automatic Absence Assignment (ALPHA)
  const closeSession = useCallback((sessionId: string) => {
    const targetSession = sessions.find(s => s.id === sessionId);
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, isOpen: false };
      }
      return s;
    }));
    if (targetSession) {
      updateAbsenteesToAlpha({ ...targetSession, isOpen: false });
    }
  }, [sessions, updateAbsenteesToAlpha]);

  // Refresh dynamic QR Token
  const refreshQrToken = useCallback((sessionId: string): string => {
    const tokenRandom = Math.random().toString(36).substring(2, 8).toUpperCase();
    let newToken = '';
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        newToken = `STMIK-${s.courseCode}-P${s.meetingNumber}-${tokenRandom}`;
        return {
          ...s,
          qrToken: newToken,
          qrExpiresAt: new Date(Date.now() + 30 * 1000).toISOString(), // 30s token validity
        };
      }
      return s;
    }));
    return newToken;
  }, []);

  // Reset all closed sessions back to initial state / unpresenced
  const resetClosedSessions = useCallback((): number => {
    const closed = sessions.filter(s => !s.isOpen);
    if (closed.length === 0) return 0;

    const closedIds = new Set(closed.map(s => s.id));

    // Remove attendance records for all closed sessions
    setRecords(prev => prev.filter(r => !closedIds.has(r.sessionId)));

    // Reset sessions token to initial
    setSessions(prev => prev.map(s => {
      if (!s.isOpen) {
        return {
          ...s,
          qrToken: `STMIK-${s.courseCode}-P${s.meetingNumber}-INITIAL`,
        };
      }
      return s;
    }));

    return closed.length;
  }, [sessions]);

  // Reset a specific session's attendance records back to initial
  const resetSingleSession = useCallback((sessionId: string) => {
    setRecords(prev => prev.filter(r => r.sessionId !== sessionId));
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          qrToken: `STMIK-${s.courseCode}-P${s.meetingNumber}-INITIAL`,
        };
      }
      return s;
    }));
  }, []);

  // Reopen a closed session
  const reopenSession = useCallback((sessionId: string) => {
    const tokenRandom = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          isOpen: true,
          qrToken: `STMIK-${s.courseCode}-P${s.meetingNumber}-${tokenRandom}`,
          qrExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        };
      }
      return s;
    }));
  }, []);

  // Delete a session
  const deleteSession = useCallback((sessionId: string) => {
    setRecords(prev => prev.filter(r => r.sessionId !== sessionId));
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  // Mahasiswa QR Code Scan Validation
  const scanQrCode = useCallback((token: string, studentNim: string): { success: boolean; message: string; session?: AttendanceSession } => {
    // 1. Clean and normalize token (handles JSON, full URLs, query strings, and extra whitespace)
    let cleanToken = (token || '').trim();
    try {
      if (cleanToken.startsWith('{') && cleanToken.endsWith('}')) {
        const parsed = JSON.parse(cleanToken);
        if (parsed.token) cleanToken = String(parsed.token).trim();
        else if (parsed.qrToken) cleanToken = String(parsed.qrToken).trim();
      }
    } catch {}
    if (cleanToken.includes('token=')) {
      const match = cleanToken.match(/token=([^&]+)/);
      if (match && match[1]) cleanToken = decodeURIComponent(match[1]).trim();
    }

    const cToken = cleanToken.toUpperCase();

    // Find active open session matching this token (or prefix if dynamic rotating QR)
    const session = sessions.find(s => {
      if (!s.isOpen) return false;
      const sToken = s.qrToken.trim().toUpperCase();
      // Direct token match
      if (sToken === cToken) return true;
      // Dynamic QR rotating prefix match (first 3 parts: e.g. STMIK-MKTI0109-P1)
      const sPrefix = sToken.split('-').slice(0, 3).join('-');
      if (sPrefix && cToken.startsWith(sPrefix)) return true;
      return false;
    });

    if (!session) {
      return {
        success: false,
        message: 'QR Code tidak valid atau sesi presensi telah ditutup oleh dosen pengampu. Pastikan sesi perkuliahan di kelas sedang aktif.',
      };
    }

    // 2. Find student by NIM or username (case-insensitive, trim, stripping prefixes if any)
    const cleanNim = (studentNim || '').trim().toUpperCase();
    let student = students.find(s => s.nim.trim().toUpperCase() === cleanNim);
    if (!student && cleanNim.startsWith('MHS-')) {
      const stripped = cleanNim.replace(/^MHS-/, '');
      student = students.find(s => s.nim.trim().toUpperCase() === stripped);
    }

    // If student not found directly in students list, look up in users state
    if (!student) {
      const user = users.find(u =>
        u.role === 'mahasiswa' &&
        (u.username.trim().toUpperCase() === cleanNim || u.id.trim().toUpperCase() === cleanNim || (u.email && u.email.trim().toLowerCase() === cleanNim.toLowerCase()))
      );
      if (user) {
        student = students.find(s => s.nim.trim().toUpperCase() === user.username.trim().toUpperCase());
        if (!student) {
          const rombelList = user.rombels && user.rombels.length > 0 ? user.rombels : getStudentRombelList(user.rombel);
          student = {
            nim: user.username,
            name: user.name,
            prodi: user.prodi || 'Teknologi Informasi',
            rombel: user.rombel || rombelList.join(', '),
            rombels: rombelList,
            email: user.email || `${user.username.toLowerCase()}@student.stmik-arungbinang.ac.id`,
            phone: user.phone,
            excludedScheduleIds: user.excludedScheduleIds,
            customScheduleIds: user.customScheduleIds,
          };
          setStudents(prev => [...prev, student!]);
        }
      }
    }

    if (!student) {
      return {
        success: false,
        message: `Data mahasiswa dengan NIM/identitas "${studentNim}" tidak ditemukan di sistem. Silakan login kembali dengan akun mahasiswa yang valid.`,
      };
    }

    // 3. Verify student belongs to this rombel/class or schedule
    // Check if student has dropped/excluded this specific schedule
    const isExcluded = session.scheduleId && student.excludedScheduleIds?.includes(session.scheduleId);
    if (isExcluded) {
      return {
        success: false,
        message: `Mata kuliah ${session.courseName} saat ini berstatus dikeluarkan (drop) dari rencana studi Anda (${student.name}). Hubungi BAAK untuk mengaktifkan kembali.`,
      };
    }

    // Check custom schedule inclusion or rombel match
    const matchingSchedule = session.scheduleId ? schedules.find(s => s.id === session.scheduleId) : null;
    const scheduleRombel = matchingSchedule?.rombel;
    const isCustomIncluded = session.scheduleId && student.customScheduleIds?.includes(session.scheduleId);
    const isEnrolled = isCustomIncluded ||
      isStudentInRombel(student.rombel, session.rombel, student.rombels) ||
      (scheduleRombel ? isStudentInRombel(student.rombel, scheduleRombel, student.rombels) : false);
    if (!isEnrolled) {
      return {
        success: false,
        message: `Mahasiswa (${student.name} - ${student.rombel}) tidak terdaftar dalam kelas rombel ${session.rombel || scheduleRombel || 'ini'} untuk mata kuliah ${session.courseName}.`,
      };
    }

    // 4. Check if already checked in
    const existing = records.find(r => r.sessionId === session.id && r.studentNim.trim().toUpperCase() === student.nim.trim().toUpperCase());
    if (existing) {
      return {
        success: true,
        message: `Anda (${student.name}) sudah tercatat presensi sebelumnya dengan status "${existing.status}" pada ${new Date(existing.scannedAt).toLocaleTimeString('id-ID')} WIB.`,
        session,
      };
    }

    // 5. Record attendance as HADIR
    const newRecord: AttendanceRecord = {
      id: `rec-${Date.now()}-${student.nim}`,
      sessionId: session.id,
      courseCode: session.courseCode,
      courseName: session.courseName,
      studentNim: student.nim,
      studentName: student.name,
      rombel: student.rombel,
      status: 'HADIR',
      scannedAt: new Date().toISOString(),
      verificationMethod: 'QR_SCAN',
      notes: 'Hadir via Scan QR Code perkuliahan',
    };

    setRecords(prev => [newRecord, ...prev]);

    return {
      success: true,
      message: `Presensi BERHASIL! Selamat mengikuti perkuliahan ${session.courseName} (Pertemuan ${session.meetingNumber}).`,
      session,
    };
  }, [sessions, students, records, users]);

  // Lecturer Manual Update Attendance Record
  const manualUpdateAttendance = useCallback((recordId: string, status: AttendanceStatus, notes?: string) => {
    setRecords(prev => prev.map(r => {
      if (r.id === recordId) {
        return {
          ...r,
          status,
          notes: notes || `Diperbarui manual oleh dosen (${currentUser.name})`,
          verificationMethod: 'MANUAL_DOSEN',
        };
      }
      return r;
    }));
  }, [currentUser]);

  // Mark student attendance directly (if student had not checked in yet)
  const markStudentAttendanceDirectly = useCallback((
    sessionId: string,
    studentNim: string,
    status: AttendanceStatus,
    notes?: string
  ) => {
    const session = sessions.find(s => s.id === sessionId);
    const student = students.find(s => s.nim === studentNim);
    if (!session || !student) return;

    setRecords(prev => {
      const existingIndex = prev.findIndex(r => r.sessionId === sessionId && r.studentNim === studentNim);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          status,
          notes: notes || `Diubah manual oleh dosen (${currentUser.name})`,
          verificationMethod: 'MANUAL_DOSEN',
        };
        return updated;
      } else {
        const newRec: AttendanceRecord = {
          id: `rec-manual-${Date.now()}-${studentNim}`,
          sessionId: session.id,
          courseCode: session.courseCode,
          courseName: session.courseName,
          studentNim: student.nim,
          studentName: student.name,
          rombel: student.rombel,
          status,
          scannedAt: new Date().toISOString(),
          verificationMethod: 'MANUAL_DOSEN',
          notes: notes || `Presensi manual diinput oleh dosen (${currentUser.name})`,
        };
        return [newRec, ...prev];
      }
    });
  }, [sessions, students, currentUser]);

  // Batch update student attendance records manually
  const batchMarkAttendance = useCallback((
    sessionId: string,
    updates: Array<{ studentNim: string; status: AttendanceStatus; notes?: string }>
  ) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    setRecords(prev => {
      const updated = [...prev];
      updates.forEach(u => {
        const student = students.find(s => s.nim === u.studentNim);
        if (!student) return;

        const idx = updated.findIndex(r => r.sessionId === sessionId && r.studentNim === u.studentNim);
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            status: u.status,
            notes: u.notes || `Presensi manual dosen (${currentUser.name})`,
            verificationMethod: 'MANUAL_DOSEN',
            scannedAt: new Date().toISOString(),
          };
        } else {
          updated.push({
            id: `rec-manual-${Date.now()}-${u.studentNim}-${Math.random().toString(36).substring(2, 5)}`,
            sessionId: session.id,
            courseCode: session.courseCode,
            courseName: session.courseName,
            studentNim: student.nim,
            studentName: student.name,
            rombel: student.rombel,
            status: u.status,
            scannedAt: new Date().toISOString(),
            verificationMethod: 'MANUAL_DOSEN',
            notes: u.notes || `Presensi manual dosen (${currentUser.name})`,
          });
        }
      });
      return updated;
    });
  }, [sessions, students, currentUser]);

  // Leave Requests
  const submitLeaveRequest = useCallback((data: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>) => {
    const newReq: LeaveRequest = {
      ...data,
      id: `leave-${Date.now()}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    setLeaveRequests(prev => [newReq, ...prev]);
  }, []);

  const reviewLeaveRequest = useCallback((id: string, status: 'APPROVED' | 'REJECTED') => {
    setLeaveRequests(prev => prev.map(req => {
      if (req.id === id) {
        const updatedReq = { ...req, status };
        // If approved, update existing attendance record or add one
        if (status === 'APPROVED') {
          // Find matching open or recent session
          const session = sessions.find(s => s.courseCode === req.courseCode && isStudentInRombel(req.rombel, s.rombel));
          if (session) {
            markStudentAttendanceDirectly(session.id, req.studentNim, req.type, `Disetujui izin/sakit: ${req.reason}`);
          }
        }
        return updatedReq;
      }
      return req;
    }));
  }, [sessions, markStudentAttendanceDirectly]);

  // Admin & auth user management: preserves custom IDs (e.g. mhs-26TI0001) and updates existing user
  const addUser = useCallback((newUser: (Omit<User, 'id'> & { id?: string }) | User) => {
    const id = newUser.id || `user-${Date.now()}`;
    const user: User = {
      ...newUser,
      id,
    };
    setUsers(prev => {
      const idx = prev.findIndex(u =>
        u.id === id ||
        (u.username && user.username && u.username.toLowerCase() === user.username.toLowerCase() && u.role === user.role)
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...user, id: next[idx].id || id };
        return next;
      }
      return [...prev, user];
    });
    return user;
  }, []);

  const updateUser = useCallback((id: string, updated: Partial<User>) => {
    setUsers(prev => {
      const exists = prev.some(u => u.id === id);
      if (exists) {
        return prev.map(u => u.id === id ? { ...u, ...updated } : u);
      }
      return [...prev, { ...currentUser, ...updated, id }];
    });
    setCurrentUser(prev => {
      if (prev.id === id) {
        const nextUser = { ...prev, ...updated };
        const isAuth = localStorage.getItem(SESSION_KEYS.AUTH_ACTIVE) === 'true';
        if (isAuth) {
          localStorage.setItem(SESSION_KEYS.ACTIVE_USER, JSON.stringify(nextUser));
        }
        return nextUser;
      }
      return prev;
    });

    // Sync master students list if student profile was updated
    if (id.startsWith('mhs-') || updated.role === 'mahasiswa' || currentUser.role === 'mahasiswa') {
      const targetNim = (updated.username || currentUser.username || (id.startsWith('mhs-') ? id.replace('mhs-', '') : '')).toUpperCase();
      if (targetNim) {
        setStudents(prev => prev.map(s => {
          if (s.nim.toUpperCase() === targetNim) {
            return {
              ...s,
              name: updated.name || s.name,
              email: updated.email || s.email,
              phone: updated.phone || s.phone,
              prodi: updated.prodi || s.prodi,
              rombel: updated.rombel || s.rombel,
            };
          }
          return s;
        }));
      }
    }

    if (updated.name) {
      setSchedules(prev => prev.map(s => s.lecturerId === id ? { ...s, lecturerName: updated.name! } : s));
      setSessions(prev => prev.map(ses => ses.lecturerId === id ? { ...ses, lecturerName: updated.name! } : ses));
    }
  }, [currentUser]);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  }, []);

  // Schedule management
  // Schedule management with automatic rombel, session & student user synchronization
  const addSchedule = useCallback((newSch: Omit<ScheduleItem, 'id'>) => {
    const schId = `sch-${Date.now()}`;
    const sch: ScheduleItem = {
      ...newSch,
      id: schId,
    };
    setSchedules(prev => {
      const next = [...prev, sch];
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(next));
      return next;
    });

    // Auto-sync rombel relations
    if (sch.rombel) {
      const parts = sch.rombel.split(/[,;&/]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
      setRombels(prev => {
        const next = prev.map(r => {
          const rCode = r.code.trim().toUpperCase();
          if (parts.includes(rCode) || parts.some(p => isStudentInRombel(rCode, p))) {
            const currentIds = r.scheduleIds || [];
            if (!currentIds.includes(schId)) {
              return { ...r, scheduleIds: [...currentIds, schId] };
            }
          }
          return r;
        });
        localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(next));
        return next;
      });
    }
  }, []);

  const updateSchedule = useCallback((id: string, updated: Partial<ScheduleItem>) => {
    let oldRombel = '';
    const newRombel = updated.rombel;

    setSchedules(prev => {
      const next = prev.map(s => {
        if (s.id === id) {
          oldRombel = s.rombel;
          return { ...s, ...updated };
        }
        return s;
      });
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(next));
      return next;
    });

    // 1. If rombel was modified, synchronize Rombels master relations
    if (newRombel !== undefined && newRombel !== oldRombel) {
      const oldParts = oldRombel.split(/[,;&/]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
      const newParts = newRombel.split(/[,;&/]+/).map(p => p.trim().toUpperCase()).filter(Boolean);

      setRombels(prev => {
        const next = prev.map(r => {
          const rCode = r.code.trim().toUpperCase();
          const shouldHave = newParts.includes(rCode) || newParts.some(p => isStudentInRombel(rCode, p));
          const currentIds = r.scheduleIds || [];

          if (shouldHave && !currentIds.includes(id)) {
            return { ...r, scheduleIds: [...currentIds, id] };
          } else if (!shouldHave && currentIds.includes(id)) {
            return { ...r, scheduleIds: currentIds.filter(schId => schId !== id) };
          }
          return r;
        });
        localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(next));
        return next;
      });

      // 2. Cascade update to all sessions connected to this schedule
      setSessions(prev => {
        let changed = false;
        const next = prev.map(sess => {
          if (sess.scheduleId === id) {
            changed = true;
            return {
              ...sess,
              rombel: newRombel || sess.rombel,
              courseName: updated.courseName || sess.courseName,
              courseCode: updated.courseCode || sess.courseCode,
              room: updated.room || sess.room,
            };
          }
          return sess;
        });
        if (changed) {
          localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(next));
        }
        return next;
      });
    }

    // 3. Ensure student users are reconciled so students in updated rombels have active accounts
    setUsers(prev => {
      const studentMap = new Map<string, User>();
      prev.forEach(u => {
        if (u.role === 'mahasiswa') {
          studentMap.set(u.username.toUpperCase(), u);
        }
      });
      let addedAny = false;
      const nextUsers = [...prev];
      students.forEach((s, idx) => {
        if (!studentMap.has(s.nim.toUpperCase())) {
          addedAny = true;
          const rombelList = s.rombels && s.rombels.length > 0 ? s.rombels : getStudentRombelList(s.rombel);
          const newUser: User = {
            id: `mhs-${s.nim}`,
            username: s.nim,
            name: s.name,
            email: s.email || `${s.nim.toLowerCase()}@student.stmik-arungbinang.ac.id`,
            role: 'mahasiswa',
            prodi: s.prodi,
            rombel: rombelList.join(', ') || s.rombel,
            rombels: rombelList,
            phone: s.phone,
            avatarUrl: `https://images.unsplash.com/photo-${STUDENT_AVATARS[idx % STUDENT_AVATARS.length]}?w=150`,
            excludedScheduleIds: s.excludedScheduleIds,
            customScheduleIds: s.customScheduleIds,
          };
          nextUsers.push(newUser);
          studentMap.set(s.nim.toUpperCase(), newUser);
        }
      });
      if (addedAny) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(nextUsers));
        return nextUsers;
      }
      return prev;
    });
  }, [students]);

  const deleteSchedule = useCallback((id: string) => {
    setSchedules(prev => {
      const next = prev.filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(next));
      return next;
    });

    // Unlink from rombels
    setRombels(prev => {
      const next = prev.map(r => {
        if (r.scheduleIds?.includes(id)) {
          return { ...r, scheduleIds: r.scheduleIds.filter(schId => schId !== id) };
        }
        return r;
      });
      localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(next));
      return next;
    });
  }, []);

  // Course management with persistence, schedule sync, archive & relation integrity
  const addCourse = useCallback((newC: Omit<Course, 'id'>) => {
    const c: Course = {
      ...newC,
      id: `c-${Date.now()}`,
    };
    setCourses(prev => {
      const next = [...prev, c];
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateCourse = useCallback((id: string, updated: Partial<Course>) => {
    let oldCode = '';
    const newCode = updated.code ? updated.code.trim().toUpperCase() : '';

    setCourses(prev => {
      const target = prev.find(c => c.id === id);
      if (target) {
        oldCode = target.code.trim().toUpperCase();
      }
      const next = prev.map(c => c.id === id ? { ...c, ...updated, ...(newCode ? { code: newCode } : {}) } : c);
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(next));
      return next;
    });

    // If course code or name changed, synchronize schedules referencing old code
    if (oldCode && (newCode || updated.name)) {
      setSchedules(prev => {
        const next = prev.map(sch => {
          if (sch.courseCode.trim().toUpperCase() === oldCode) {
            return {
              ...sch,
              courseCode: newCode || sch.courseCode,
              courseName: updated.name || sch.courseName,
              sks: updated.sks !== undefined ? updated.sks : sch.sks,
              prodi: updated.prodi || sch.prodi,
            };
          }
          return sch;
        });
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(next));
        return next;
      });
    }
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setCourses(prev => {
      const next = prev.filter(c => c.id !== id);
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(next));
      return next;
    });
  }, []);

  const archiveCourse = useCallback((idOrCode: string) => {
    let courseName = '';
    const clean = idOrCode.trim().toUpperCase();
    setCourses(prev => {
      const next = prev.map(c => {
        if (c.id === idOrCode || c.code.trim().toUpperCase() === clean) {
          courseName = c.name;
          return { ...c, isArchived: true, archivedAt: new Date().toISOString() };
        }
        return c;
      });
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(next));
      return next;
    });
    return { success: true, message: `Mata kuliah "${courseName || idOrCode}" berhasil diarsipkan.` };
  }, []);

  const restoreCourse = useCallback((idOrCode: string) => {
    let courseName = '';
    const clean = idOrCode.trim().toUpperCase();
    setCourses(prev => {
      const next = prev.map(c => {
        if (c.id === idOrCode || c.code.trim().toUpperCase() === clean) {
          courseName = c.name;
          return { ...c, isArchived: false, archivedAt: undefined };
        }
        return c;
      });
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(next));
      return next;
    });
    return { success: true, message: `Mata kuliah "${courseName || idOrCode}" berhasil dipulihkan dari arsip.` };
  }, []);

  const checkCourseRelations = useCallback((courseCode: string) => {
    const code = (courseCode || '').trim().toUpperCase();
    if (!code) {
      return { canDelete: true, scheduleCount: 0, sessionCount: 0, schedules: [], sessions: [] };
    }
    const relatedSchedules = schedules.filter(s => s.courseCode.trim().toUpperCase() === code);
    const relatedSessions = sessions.filter(sess => sess.courseCode.trim().toUpperCase() === code);

    const canDelete = relatedSchedules.length === 0 && relatedSessions.length === 0;

    return {
      canDelete,
      scheduleCount: relatedSchedules.length,
      sessionCount: relatedSessions.length,
      schedules: relatedSchedules,
      sessions: relatedSessions,
    };
  }, [schedules, sessions]);

  // Student management with multi-rombel persistence & user synchronization
  const addStudent = useCallback((rawStudent: Student) => {
    const rombelList = rawStudent.rombels && rawStudent.rombels.length > 0
      ? rawStudent.rombels
      : getStudentRombelList(rawStudent.rombel);
    const joinedRombel = rombelList.join(', ');

    const newStudent: Student = {
      ...rawStudent,
      rombel: joinedRombel || rawStudent.rombel,
      rombels: rombelList,
      email: rawStudent.email || `${rawStudent.nim.toLowerCase()}@student.stmik-arungbinang.ac.id`,
    };

    setStudents(prev => {
      const idx = prev.findIndex(s => s.nim.toUpperCase() === newStudent.nim.toUpperCase());
      const updated = idx >= 0
        ? prev.map((s, i) => i === idx ? { ...s, ...newStudent } : s)
        : [...prev, newStudent];
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
      return updated;
    });

    // Also sync or create user account for this student so login works smoothly
    setUsers(prev => {
      const existingIdx = prev.findIndex(u => u.username.toUpperCase() === newStudent.nim.toUpperCase());
      let updatedUsers: User[];
      if (existingIdx >= 0) {
        updatedUsers = prev.map((u, i) => i === existingIdx ? {
          ...u,
          name: newStudent.name,
          email: newStudent.email,
          prodi: newStudent.prodi,
          rombel: newStudent.rombel,
          rombels: newStudent.rombels,
          phone: newStudent.phone || u.phone,
        } : u);
      } else {
        const newUser: User = {
          id: `mhs-${newStudent.nim}`,
          username: newStudent.nim,
          name: newStudent.name,
          email: newStudent.email,
          role: 'mahasiswa',
          prodi: newStudent.prodi,
          rombel: newStudent.rombel,
          rombels: newStudent.rombels,
          phone: newStudent.phone,
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        };
        updatedUsers = [...prev, newUser];
      }
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      return updatedUsers;
    });
  }, []);

  const updateStudent = useCallback((nim: string, updated: Partial<Student>) => {
    setStudents(prev => {
      const next = prev.map(s => {
        if (s.nim.toUpperCase() === nim.toUpperCase()) {
          const merged = { ...s, ...updated };
          const rombelList = merged.rombels && merged.rombels.length > 0
            ? merged.rombels
            : getStudentRombelList(merged.rombel);
          return {
            ...merged,
            rombel: rombelList.join(', '),
            rombels: rombelList,
          };
        }
        return s;
      });
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(next));
      return next;
    });

    // Sync to users
    setUsers(prev => {
      let found = false;
      const nextUsers = prev.map(u => {
        if (u.username.toUpperCase() === nim.toUpperCase()) {
          found = true;
          const rombelList = updated.rombels || (updated.rombel ? getStudentRombelList(updated.rombel) : u.rombels);
          return {
            ...u,
            name: updated.name || u.name,
            email: updated.email || u.email,
            prodi: updated.prodi || u.prodi,
            rombel: updated.rombel || (rombelList ? rombelList.join(', ') : u.rombel),
            rombels: rombelList || u.rombels,
            phone: updated.phone !== undefined ? updated.phone : u.phone,
            excludedScheduleIds: updated.excludedScheduleIds !== undefined ? updated.excludedScheduleIds : u.excludedScheduleIds,
            customScheduleIds: updated.customScheduleIds !== undefined ? updated.customScheduleIds : u.customScheduleIds,
          };
        }
        return u;
      });

      if (!found) {
        const rombelList = updated.rombels || (updated.rombel ? getStudentRombelList(updated.rombel) : []);
        const newUser: User = {
          id: `mhs-${nim}`,
          username: nim,
          name: updated.name || nim,
          email: updated.email || `${nim.toLowerCase()}@student.stmik-arungbinang.ac.id`,
          role: 'mahasiswa',
          prodi: updated.prodi || 'Teknologi Informasi',
          rombel: updated.rombel || rombelList.join(', '),
          rombels: rombelList,
          phone: updated.phone,
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          excludedScheduleIds: updated.excludedScheduleIds,
          customScheduleIds: updated.customScheduleIds,
        };
        nextUsers.push(newUser);
      }

      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(nextUsers));
      return nextUsers;
    });
  }, []);

  const deleteStudent = useCallback((nim: string) => {
    setStudents(prev => {
      const next = prev.filter(s => s.nim.toUpperCase() !== nim.toUpperCase());
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(next));
      return next;
    });
    setUsers(prev => {
      const nextUsers = prev.filter(u => !(u.role === 'mahasiswa' && u.username.toUpperCase() === nim.toUpperCase()));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(nextUsers));
      return nextUsers;
    });
  }, []);

  // Synchronize 100% of students in students state to have active User accounts
  const syncStudentUsers = useCallback((): { count: number; added: number; updated: number } => {
    let added = 0;
    let updated = 0;

    setUsers(prev => {
      const studentMap = new Map<string, User>();
      prev.forEach(u => {
        if (u.role === 'mahasiswa') {
          studentMap.set(u.username.toUpperCase(), u);
        }
      });

      const nextUsers = [...prev];

      students.forEach((s, idx) => {
        const existing = studentMap.get(s.nim.toUpperCase());
        const rombelList = s.rombels && s.rombels.length > 0 ? s.rombels : getStudentRombelList(s.rombel);
        const joinedRombel = rombelList.join(', ') || s.rombel;

        if (!existing) {
          added++;
          const newUser: User = {
            id: `mhs-${s.nim}`,
            username: s.nim,
            name: s.name,
            email: s.email || `${s.nim.toLowerCase()}@student.stmik-arungbinang.ac.id`,
            role: 'mahasiswa',
            prodi: s.prodi,
            rombel: joinedRombel,
            rombels: rombelList,
            phone: s.phone,
            avatarUrl: `https://images.unsplash.com/photo-${STUDENT_AVATARS[idx % STUDENT_AVATARS.length]}?w=150`,
            excludedScheduleIds: s.excludedScheduleIds,
            customScheduleIds: s.customScheduleIds,
          };
          nextUsers.push(newUser);
          studentMap.set(s.nim.toUpperCase(), newUser);
        } else {
          const needsUpdate =
            existing.name !== s.name ||
            existing.rombel !== joinedRombel ||
            JSON.stringify(existing.rombels || []) !== JSON.stringify(rombelList) ||
            existing.prodi !== s.prodi ||
            (s.email && existing.email !== s.email) ||
            JSON.stringify(existing.excludedScheduleIds || []) !== JSON.stringify(s.excludedScheduleIds || []);

          if (needsUpdate) {
            updated++;
            const targetIdx = nextUsers.findIndex(u => u.id === existing.id || (u.role === 'mahasiswa' && u.username.toUpperCase() === s.nim.toUpperCase()));
            if (targetIdx >= 0) {
              nextUsers[targetIdx] = {
                ...nextUsers[targetIdx],
                name: s.name,
                prodi: s.prodi,
                rombel: joinedRombel,
                rombels: rombelList,
                email: s.email || nextUsers[targetIdx].email,
                phone: s.phone || nextUsers[targetIdx].phone,
                excludedScheduleIds: s.excludedScheduleIds,
                customScheduleIds: s.customScheduleIds,
              };
            }
          }
        }
      });

      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(nextUsers));
      return nextUsers;
    });

    return {
      count: students.length,
      added,
      updated,
    };
  }, [students]);

  // Continuous reconciliation: ensure every student in `students` always has a corresponding User account
  useEffect(() => {
    const hasMissingStudentUser = students.some(
      s => !users.some(u => u.role === 'mahasiswa' && u.username.toUpperCase() === s.nim.toUpperCase())
    );
    if (hasMissingStudentUser) {
      syncStudentUsers();
    }
  }, [students, users, syncStudentUsers]);

  // Rombel & Schedule link management
  const addRombel = useCallback((rawRombel: Omit<Rombel, 'id'>, connectedScheduleIds: string[] = []) => {
    const cleanCode = rawRombel.code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Kode Rombel tidak boleh kosong.' };
    }

    let isDuplicate = false;
    setRombels(prev => {
      if (prev.some(r => r.code.toUpperCase() === cleanCode)) {
        isDuplicate = true;
      }
      return prev;
    });

    if (isDuplicate) {
      return { success: false, message: `Rombel dengan kode "${cleanCode}" sudah terdaftar.` };
    }

    const newRombel: Rombel = {
      ...rawRombel,
      id: `rombel-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
      code: cleanCode,
      name: rawRombel.name.trim() || `Rombel ${cleanCode}`,
      scheduleIds: connectedScheduleIds,
      createdAt: new Date().toISOString(),
    };

    setRombels(prev => {
      const updated = [...prev, newRombel];
      localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(updated));
      return updated;
    });

    // Automatically connect this rombel to the chosen schedules
    if (connectedScheduleIds.length > 0) {
      setSchedules(prev => {
        const updatedSchedules = prev.map(sch => {
          if (connectedScheduleIds.includes(sch.id)) {
            const currentParts = sch.rombel ? sch.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean) : [];
            if (!currentParts.some(p => p.toUpperCase() === cleanCode)) {
              currentParts.push(cleanCode);
              return { ...sch, rombel: currentParts.join(', ') };
            }
          }
          return sch;
        });
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(updatedSchedules));
        return updatedSchedules;
      });
    }

    return {
      success: true,
      message: `Rombel "${cleanCode}" berhasil ditambahkan dan dihubungkan ke ${connectedScheduleIds.length} jadwal mata kuliah!`,
      rombel: newRombel,
    };
  }, []);

  const updateRombel = useCallback((id: string, updated: Partial<Rombel>, connectedScheduleIds?: string[], previousCode?: string) => {
    const cleanId = (id || '').trim();
    const cleanNewCode = updated.code ? updated.code.trim().toUpperCase() : '';
    const cleanNewName = updated.name !== undefined ? updated.name.trim() : '';

    // Determine oldCode reliably
    let oldCode = (previousCode || '').trim().toUpperCase();
    if (!oldCode) {
      const fromCurrent = rombels.find(r => 
        (cleanId && r.id === cleanId) || 
        (cleanId && r.code.toUpperCase() === cleanId.toUpperCase())
      );
      if (fromCurrent) {
        oldCode = fromCurrent.code.trim().toUpperCase();
      } else {
        oldCode = cleanId.replace(/^rombel-/, '').trim().toUpperCase();
      }
    }

    const targetCode = cleanNewCode || oldCode;
    let finalUpdatedRombel: Rombel | null = null;

    // 1. Update Rombels state & localStorage
    setRombels(prev => {
      const target = prev.find(r => 
        (cleanId && r.id === cleanId) || 
        (oldCode && r.code.toUpperCase() === oldCode) || 
        (cleanId && r.code.toUpperCase() === cleanId.toUpperCase())
      );

      if (target) {
        finalUpdatedRombel = {
          ...target,
          ...updated,
          code: targetCode,
          name: cleanNewName || target.name,
          scheduleIds: connectedScheduleIds !== undefined ? connectedScheduleIds : target.scheduleIds,
          academicYear: updated.academicYear !== undefined ? updated.academicYear : target.academicYear,
          description: updated.description !== undefined ? updated.description : target.description,
          isArchived: updated.isArchived !== undefined ? updated.isArchived : target.isArchived,
          archivedAt: updated.archivedAt !== undefined ? updated.archivedAt : target.archivedAt,
        };
        const next = prev.map(r => r.id === target.id ? finalUpdatedRombel! : r);
        localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(next));
        return next;
      } else {
        finalUpdatedRombel = {
          id: cleanId || `rombel-${targetCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
          code: targetCode,
          name: cleanNewName || `Rombel ${targetCode}`,
          prodi: updated.prodi || (targetCode.startsWith('TI') ? 'Teknologi Informasi' : 'Manajemen Informatika'),
          semester: updated.semester || 1,
          academicYear: updated.academicYear || '2026/2027 Ganjil',
          description: updated.description,
          scheduleIds: connectedScheduleIds || [],
          createdAt: new Date().toISOString(),
          isArchived: updated.isArchived,
          archivedAt: updated.archivedAt,
        };
        const next = [...prev, finalUpdatedRombel];
        localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(next));
        return next;
      }
    });

    const isCodeRenamed = Boolean(oldCode && targetCode && oldCode !== targetCode);

    // 2. Cascade update to Schedules
    setSchedules(prev => {
      let changed = false;
      const nextSchedules = prev.map(sch => {
        const currentParts = sch.rombel ? sch.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean) : [];
        const hadOldCode = oldCode ? currentParts.some(p => p.toUpperCase() === oldCode) : false;
        const hadTargetCode = currentParts.some(p => p.toUpperCase() === targetCode);

        if (connectedScheduleIds !== undefined) {
          const isSelected = connectedScheduleIds.includes(sch.id);
          if (isSelected) {
            let parts = [...currentParts];
            if (isCodeRenamed && hadOldCode) {
              parts = parts.filter(p => p.toUpperCase() !== oldCode);
            }
            if (!parts.some(p => p.toUpperCase() === targetCode)) {
              parts.push(targetCode);
              changed = true;
            }
            return { ...sch, rombel: parts.join(', ') };
          } else {
            if (hadOldCode || hadTargetCode) {
              changed = true;
              const filtered = currentParts.filter(p => p.toUpperCase() !== oldCode && p.toUpperCase() !== targetCode);
              return { ...sch, rombel: filtered.join(', ') || 'Unassigned' };
            }
          }
        } else if (isCodeRenamed && hadOldCode) {
          changed = true;
          const replaced = currentParts.map(p => p.toUpperCase() === oldCode ? targetCode : p);
          return { ...sch, rombel: replaced.join(', ') };
        }
        return sch;
      });

      if (changed) {
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(nextSchedules));
      }
      return nextSchedules;
    });

    // 3. Cascade update to Students
    if (isCodeRenamed) {
      setStudents(prev => {
        let changed = false;
        const nextStudents = prev.map(st => {
          const list = st.rombels && st.rombels.length > 0 ? st.rombels : getStudentRombelList(st.rombel);
          const hasOld = list.some(r => r.toUpperCase() === oldCode);
          if (hasOld) {
            changed = true;
            const updatedList = list.map(r => r.toUpperCase() === oldCode ? targetCode : r);
            return {
              ...st,
              rombels: updatedList,
              rombel: updatedList.join(', '),
            };
          }
          return st;
        });

        if (changed) {
          localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(nextStudents));
        }
        return nextStudents;
      });

      // 4. Cascade update to Users (login accounts)
      setUsers(prev => {
        let changed = false;
        const nextUsers = prev.map(u => {
          const list = u.rombels && u.rombels.length > 0 ? u.rombels : (u.rombel ? getStudentRombelList(u.rombel) : []);
          const hasOld = list.some(r => r.toUpperCase() === oldCode);
          if (hasOld) {
            changed = true;
            const updatedList = list.map(r => r.toUpperCase() === oldCode ? targetCode : r);
            return {
              ...u,
              rombels: updatedList,
              rombel: updatedList.join(', '),
            };
          }
          return u;
        });

        if (changed) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(nextUsers));
        }
        return nextUsers;
      });

      // 5. Cascade update to Attendance Sessions
      setSessions(prev => {
        let changed = false;
        const nextSessions = prev.map(sess => {
          const parts = sess.rombel ? sess.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean) : [];
          if (parts.some(p => p.toUpperCase() === oldCode)) {
            changed = true;
            const updatedParts = parts.map(p => p.toUpperCase() === oldCode ? targetCode : p);
            return {
              ...sess,
              rombel: updatedParts.join(', '),
            };
          }
          return sess;
        });

        if (changed) {
          localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(nextSessions));
        }
        return nextSessions;
      });

      // 6. Cascade update to Attendance Records
      setRecords(prev => {
        let changed = false;
        const nextRecords = prev.map(rec => {
          if (rec.rombel && rec.rombel.toUpperCase().includes(oldCode)) {
            changed = true;
            const parts = rec.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);
            const updatedParts = parts.map(p => p.toUpperCase() === oldCode ? targetCode : p);
            return {
              ...rec,
              rombel: updatedParts.join(', ') || targetCode,
            };
          }
          return rec;
        });

        if (changed) {
          localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(nextRecords));
        }
        return nextRecords;
      });

      // 7. Cascade update to Leave Requests
      setLeaveRequests(prev => {
        let changed = false;
        const nextLeaves = prev.map(l => {
          if (l.rombel && l.rombel.toUpperCase().includes(oldCode)) {
            changed = true;
            const parts = l.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);
            const updatedParts = parts.map(p => p.toUpperCase() === oldCode ? targetCode : p);
            return {
              ...l,
              rombel: updatedParts.join(', ') || targetCode,
            };
          }
          return l;
        });

        if (changed) {
          localStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify(nextLeaves));
        }
        return nextLeaves;
      });

      // 8. Cascade update to Current Authenticated User (if active session belongs to this rombel)
      setCurrentUser(prev => {
        if (!prev) return prev;
        const list = prev.rombels && prev.rombels.length > 0 ? prev.rombels : (prev.rombel ? getStudentRombelList(prev.rombel) : []);
        if (list.some(r => r.toUpperCase() === oldCode)) {
          const updatedList = list.map(r => r.toUpperCase() === oldCode ? targetCode : r);
          const updatedUser = {
            ...prev,
            rombels: updatedList,
            rombel: updatedList.join(', '),
          };
          localStorage.setItem(SESSION_KEYS.ACTIVE_USER, JSON.stringify(updatedUser));
          return updatedUser;
        }
        return prev;
      });
    }

    const relationsInfo = [];
    if (isCodeRenamed) {
      relationsInfo.push('Jadwal', 'Mahasiswa', 'Akun Pengguna', 'Presensi');
    } else if (connectedScheduleIds !== undefined) {
      relationsInfo.push(`${connectedScheduleIds.length} Jadwal Terhubung`);
    }

    return {
      success: true,
      message: `Rombel "${targetCode}" berhasil disimpan${relationsInfo.length > 0 ? ` & relasi (${relationsInfo.join(', ')}) otomatis diperbarui` : ''}!`,
      rombel: finalUpdatedRombel || undefined,
    };
  }, [rombels]);

  const deleteRombel = useCallback((id: string) => {
    let deletedCode = '';
    setRombels(prev => {
      const target = prev.find(r => r.id === id);
      if (target) deletedCode = target.code.trim().toUpperCase();
      const next = prev.filter(r => r.id !== id);
      localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(next));
      return next;
    });

    if (deletedCode) {
      setSchedules(prev => {
        const nextSchedules = prev.map(sch => {
          const currentParts = sch.rombel ? sch.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean) : [];
          if (currentParts.some(p => p.toUpperCase() === deletedCode)) {
            const filtered = currentParts.filter(p => p.toUpperCase() !== deletedCode);
            return { ...sch, rombel: filtered.join(', ') || 'Unassigned' };
          }
          return sch;
        });
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(nextSchedules));
        return nextSchedules;
      });
    }

    return { success: true, message: `Rombel "${deletedCode}" berhasil dihapus.` };
  }, []);

  const linkSchedulesToRombel = useCallback((rombelCode: string, scheduleIds: string[]) => {
    const cleanCode = rombelCode.trim().toUpperCase();
    if (!cleanCode) return;

    setRombels(prev => {
      const next = prev.map(r => {
        if (r.code.toUpperCase() === cleanCode) {
          return { ...r, scheduleIds };
        }
        return r;
      });
      localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(next));
      return next;
    });

    setSchedules(prev => {
      const nextSchedules = prev.map(sch => {
        const currentParts = sch.rombel ? sch.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean) : [];
        const isSelected = scheduleIds.includes(sch.id);
        const hasCode = currentParts.some(p => p.toUpperCase() === cleanCode);

        if (isSelected && !hasCode) {
          currentParts.push(cleanCode);
          return { ...sch, rombel: currentParts.join(', ') };
        } else if (!isSelected && hasCode) {
          const filtered = currentParts.filter(p => p.toUpperCase() !== cleanCode);
          return { ...sch, rombel: filtered.join(', ') || 'Unassigned' };
        }
        return sch;
      });
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(nextSchedules));
      return nextSchedules;
    });
  }, []);

  const archiveRombel = useCallback((idOrCode: string) => {
    let rombelCode = '';
    const clean = idOrCode.trim().toUpperCase();
    setRombels(prev => {
      const next = prev.map(r => {
        if (r.id === idOrCode || r.code.trim().toUpperCase() === clean) {
          rombelCode = r.code;
          return { ...r, isArchived: true, archivedAt: new Date().toISOString() };
        }
        return r;
      });
      localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(next));
      return next;
    });
    return { success: true, message: `Rombel "${rombelCode || idOrCode}" berhasil diarsipkan.` };
  }, []);

  const restoreRombel = useCallback((idOrCode: string) => {
    let rombelCode = '';
    const clean = idOrCode.trim().toUpperCase();
    setRombels(prev => {
      const next = prev.map(r => {
        if (r.id === idOrCode || r.code.trim().toUpperCase() === clean) {
          rombelCode = r.code;
          return { ...r, isArchived: false, archivedAt: undefined };
        }
        return r;
      });
      localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(next));
      return next;
    });
    return { success: true, message: `Rombel "${rombelCode || idOrCode}" berhasil dipulihkan dari arsip.` };
  }, []);

  const checkRombelRelations = useCallback((rombelCode: string) => {
    const code = (rombelCode || '').trim().toUpperCase();
    if (!code) {
      return { canDelete: true, scheduleCount: 0, studentCount: 0, sessionCount: 0, schedules: [], students: [], sessions: [] };
    }
    const relatedSchedules = schedules.filter(s => isStudentInRombel(code, s.rombel));
    const relatedStudents = students.filter(st => isStudentInRombel(st.rombels || st.rombel, code));
    const relatedSessions = sessions.filter(sess => isStudentInRombel(code, sess.rombel));

    const canDelete = relatedSchedules.length === 0 && relatedStudents.length === 0 && relatedSessions.length === 0;

    return {
      canDelete,
      scheduleCount: relatedSchedules.length,
      studentCount: relatedStudents.length,
      sessionCount: relatedSessions.length,
      schedules: relatedSchedules,
      students: relatedStudents,
      sessions: relatedSessions,
    };
  }, [schedules, students, sessions]);

  // Bulk Excel import & update implementations
  const bulkUpdateStudents = useCallback((incoming: Student[], mode: 'merge' | 'replace' = 'merge') => {
    let added = 0;
    let updated = 0;
    const normalizedIncoming = incoming.map(st => {
      const list = st.rombels && st.rombels.length > 0 ? st.rombels : getStudentRombelList(st.rombel);
      return {
        ...st,
        rombel: list.join(', ') || st.rombel,
        rombels: list,
      };
    });

    setStudents(prev => {
      if (mode === 'replace') {
        added = normalizedIncoming.length;
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(normalizedIncoming));
        return normalizedIncoming;
      }
      const result = [...prev];
      normalizedIncoming.forEach(newItem => {
        const idx = result.findIndex(s => s.nim.toUpperCase() === newItem.nim.toUpperCase());
        if (idx >= 0) {
          result[idx] = { ...result[idx], ...newItem };
          updated++;
        } else {
          result.push(newItem);
          added++;
        }
      });
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(result));
      return result;
    });

    // Synchronize user accounts for incoming students immediately
    setUsers(prev => {
      const resultUsers = [...prev];
      normalizedIncoming.forEach((newSt, idx) => {
        const uIdx = resultUsers.findIndex(u => u.role === 'mahasiswa' && u.username.toUpperCase() === newSt.nim.toUpperCase());
        const rombelList = newSt.rombels && newSt.rombels.length > 0 ? newSt.rombels : getStudentRombelList(newSt.rombel);
        const joinedRombel = rombelList.join(', ') || newSt.rombel;
        if (uIdx >= 0) {
          resultUsers[uIdx] = {
            ...resultUsers[uIdx],
            name: newSt.name,
            prodi: newSt.prodi,
            rombel: joinedRombel,
            rombels: rombelList,
            email: newSt.email || resultUsers[uIdx].email,
            phone: newSt.phone || resultUsers[uIdx].phone,
            excludedScheduleIds: newSt.excludedScheduleIds,
            customScheduleIds: newSt.customScheduleIds,
          };
        } else {
          resultUsers.push({
            id: `mhs-${newSt.nim}`,
            username: newSt.nim,
            name: newSt.name,
            email: newSt.email || `${newSt.nim.toLowerCase()}@student.stmik-arungbinang.ac.id`,
            role: 'mahasiswa',
            prodi: newSt.prodi,
            rombel: joinedRombel,
            rombels: rombelList,
            phone: newSt.phone,
            avatarUrl: `https://images.unsplash.com/photo-${STUDENT_AVATARS[idx % STUDENT_AVATARS.length]}?w=150`,
            excludedScheduleIds: newSt.excludedScheduleIds,
            customScheduleIds: newSt.customScheduleIds,
          });
        }
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(resultUsers));
      return resultUsers;
    });

    return { added, updated, total: added + updated };
  }, []);

  const bulkUpdateUsers = useCallback((incoming: User[], mode: 'merge' | 'replace' = 'merge') => {
    let added = 0;
    let updated = 0;
    setUsers(prev => {
      if (mode === 'replace') {
        added = incoming.length;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(incoming));
        return incoming;
      }
      const result = [...prev];
      incoming.forEach(newItem => {
        const idx = result.findIndex(u =>
          (newItem.id && u.id === newItem.id) ||
          (u.username && newItem.username && u.username.toLowerCase() === newItem.username.toLowerCase())
        );
        if (idx >= 0) {
          result[idx] = {
            ...result[idx],
            ...newItem,
            password: newItem.password || result[idx].password,
            avatarUrl: newItem.avatarUrl || result[idx].avatarUrl,
          };
          updated++;
        } else {
          result.push(newItem);
          added++;
        }
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(result));
      return result;
    });
    return { added, updated, total: added + updated };
  }, []);

  const bulkUpdateCourses = useCallback((incoming: Course[], mode: 'merge' | 'replace' = 'merge') => {
    let added = 0;
    let updated = 0;
    // Pengecualian khusus: pastikan MKMI0105 Algoritma tetap milik Ammar Fauzan
    const protectedIncoming = incoming.map(c => {
      if (c.code === 'MKMI0105' || c.name.toLowerCase().includes('algoritma dan pemrograman')) {
        return {
          ...c,
          name: 'Algoritma dan Pemrograman',
          sks: 2,
          defaultLecturerId: 'dosen-10',
          defaultLecturerName: 'Ammar Fauzan, S.Pd., M.Kom.',
        };
      }
      return c;
    });

    setCourses(prev => {
      if (mode === 'replace') {
        added = protectedIncoming.length;
        localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(protectedIncoming));
        return protectedIncoming;
      }
      const result = [...prev];
      protectedIncoming.forEach(newItem => {
        const idx = result.findIndex(c =>
          (newItem.id && c.id === newItem.id) ||
          (c.code && newItem.code && c.code.toUpperCase() === newItem.code.toUpperCase())
        );
        if (idx >= 0) {
          result[idx] = { ...result[idx], ...newItem };
          updated++;
        } else {
          result.push(newItem);
          added++;
        }
      });
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(result));
      return result;
    });
    return { added, updated, total: added + updated };
  }, []);

  const bulkUpdateSchedules = useCallback((incoming: ScheduleItem[], mode: 'merge' | 'replace' = 'merge') => {
    let added = 0;
    let updated = 0;
    // Pengecualian khusus: pastikan jadwal Algoritma selalu Rabu 18.00 WIB Ammar Fauzan
    const protectedIncoming = incoming.map(s => {
      if (s.courseCode === 'MKMI0105' || s.courseName.toLowerCase().includes('algoritma dan pemrograman')) {
        return {
          ...s,
          day: 'Rabu' as DayOfWeek,
          startTime: '18:00',
          endTime: '19:40',
          sks: 2,
          lecturerId: 'dosen-10',
          lecturerName: 'Ammar Fauzan, S.Pd., M.Kom.',
        };
      }
      return s;
    });

    setSchedules(prev => {
      if (mode === 'replace') {
        added = protectedIncoming.length;
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(protectedIncoming));
        return protectedIncoming;
      }
      const result = [...prev];
      protectedIncoming.forEach(newItem => {
        const idx = result.findIndex(s =>
          (newItem.id && s.id === newItem.id) ||
          (
            s.courseCode.toUpperCase() === newItem.courseCode.toUpperCase() &&
            s.rombel.toUpperCase() === newItem.rombel.toUpperCase() &&
            s.day === newItem.day &&
            s.startTime === newItem.startTime
          )
        );
        if (idx >= 0) {
          result[idx] = {
            ...result[idx],
            ...newItem,
            meetingDates: {
              ...(result[idx].meetingDates || {}),
              ...(newItem.meetingDates || {}),
            },
          };
          updated++;
        } else {
          result.push(newItem);
          added++;
        }
      });
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(result));
      return result;
    });
    return { added, updated, total: added + updated };
  }, []);

  const bulkImportAll = useCallback((data: {
    schedules?: ScheduleItem[];
    users?: User[];
    students?: Student[];
    courses?: Course[];
  }, mode: 'merge' | 'replace' = 'merge') => {
    try {
      saveLocalSnapshot(
        `Auto Backup Sebelum Import Excel (${new Date().toLocaleTimeString('id-ID')})`,
        'Cadangan otomatis yang dibuat oleh sistem sesaat sebelum data Excel massal diterapkan.',
        { users, students, courses, schedules, sessions, records, leaveRequests }
      );
    } catch {}

    let schedulesCount = 0;
    let usersCount = 0;
    let studentsCount = 0;
    let coursesCount = 0;

    if (data.students && data.students.length > 0) {
      const res = bulkUpdateStudents(data.students, mode);
      studentsCount = res.total;
    }
    if (data.users && data.users.length > 0) {
      const res = bulkUpdateUsers(data.users, mode);
      usersCount = res.total;
    }
    if (data.courses && data.courses.length > 0) {
      const res = bulkUpdateCourses(data.courses, mode);
      coursesCount = res.total;
    }
    if (data.schedules && data.schedules.length > 0) {
      const res = bulkUpdateSchedules(data.schedules, mode);
      schedulesCount = res.total;
    }

    setSnapshots(loadLocalSnapshots());

    return { schedulesCount, usersCount, studentsCount, coursesCount };
  }, [users, students, courses, schedules, sessions, records, leaveRequests, bulkUpdateStudents, bulkUpdateUsers, bulkUpdateCourses, bulkUpdateSchedules]);

  // Reset to default
  const resetToDefaultData = useCallback(() => {
    localStorage.clear();
    setUsers(INITIAL_USERS);
    setStudents(INITIAL_STUDENTS);
    setCourses(INITIAL_COURSES);
    setSchedules(INITIAL_SCHEDULES);
    setSessions(INITIAL_SESSIONS);
    setRecords(INITIAL_RECORDS);
    setLeaveRequests(INITIAL_LEAVE_REQUESTS);
    setRombels(INITIAL_ROMBELS);
    setCurrentUser(GUEST_USER);
  }, []);

  // Clear user session cleanly
  const logoutSession = useCallback(() => {
    const currentToken = getCurrentSessionToken();
    if (currentToken) {
      setDeviceSessions(prev =>
        prev.map(s => s.sessionToken === currentToken ? { ...s, status: 'TERMINATED' as const } : s)
      );
    }
    clearCurrentSessionToken();
    localStorage.removeItem(SESSION_KEYS.AUTH_ACTIVE);
    localStorage.removeItem(SESSION_KEYS.LAST_ACTIVITY);
    localStorage.removeItem(SESSION_KEYS.CURRENT_USER_ID);
    localStorage.removeItem(SESSION_KEYS.ACTIVE_USER);
    setCurrentUser(GUEST_USER);
  }, []);

  // Current active device session memo
  const currentDeviceSession = useMemo(() => {
    const token = getCurrentSessionToken();
    if (!token) return null;
    return deviceSessions.find(s => s.sessionToken === token && s.status === 'ACTIVE') || null;
  }, [deviceSessions]);

  // Get device sessions for a user (identifying current device)
  const getUserDeviceSessions = useCallback((userId?: string): DeviceSession[] => {
    const targetId = userId || currentUser.id;
    const devId = getOrCreateDeviceId();
    const token = getCurrentSessionToken();
    return deviceSessions
      .filter(s => s.userId === targetId)
      .map(s => ({
        ...s,
        isCurrentDevice: s.deviceId === devId && (token ? s.sessionToken === token : true),
      }))
      .sort((a, b) => b.lastActiveTimestamp - a.lastActiveTimestamp);
  }, [deviceSessions, currentUser.id]);

  // Register device session on login
  const registerDeviceSession = useCallback((user: User): DeviceSession => {
    const { session, allSessions } = createOrUpdateDeviceSession(user);
    setDeviceSessions(allSessions);
    return session;
  }, []);

  // Terminate a single device session
  const terminateDeviceSession = useCallback((sessionId: string): { success: boolean; message: string } => {
    const target = deviceSessions.find(s => s.id === sessionId);
    if (!target) {
      return { success: false, message: 'Sesi perangkat tidak ditemukan.' };
    }
    const currentToken = getCurrentSessionToken();
    const isTerminatingCurrent = target.sessionToken === currentToken;

    const updated = deviceSessions.map(s => s.id === sessionId ? { ...s, status: 'TERMINATED' as const } : s);
    setDeviceSessions(updated);
    saveDeviceSessions(updated);

    if (isTerminatingCurrent) {
      logoutSession();
    }

    return {
      success: true,
      message: `Sesi pada perangkat "${target.deviceName}" berhasil diputuskan.`
    };
  }, [deviceSessions, logoutSession]);

  // Terminate all other device sessions for the user
  const terminateOtherDeviceSessions = useCallback((userId: string): { count: number; message: string } => {
    const currentToken = getCurrentSessionToken();
    let count = 0;
    const updated = deviceSessions.map(s => {
      if (s.userId === userId && s.sessionToken !== currentToken && s.status === 'ACTIVE') {
        count++;
        return { ...s, status: 'TERMINATED' as const };
      }
      return s;
    });
    setDeviceSessions(updated);
    saveDeviceSessions(updated);
    return {
      count,
      message: `${count} sesi perangkat lain berhasil diputuskan. Akun kini hanya aktif di perangkat ini.`
    };
  }, [deviceSessions]);

  // Validate active device session to prevent account tampering and hijacking
  const validateCurrentDeviceSession = useCallback((): { valid: boolean; reason?: string } => {
    const isAuth = localStorage.getItem(SESSION_KEYS.AUTH_ACTIVE) === 'true';
    if (!isAuth || currentUser.id === 'guest') {
      return { valid: true };
    }
    const currentToken = getCurrentSessionToken();
    if (!currentToken) {
      // Auto register if token missing but valid auth
      registerDeviceSession(currentUser);
      return { valid: true };
    }

    const matched = deviceSessions.find(s => s.sessionToken === currentToken);
    if (matched) {
      if (matched.status === 'TERMINATED') {
        logoutSession();
        return { valid: false, reason: 'Sesi perangkat ini telah diakhiri dari perangkat lain.' };
      }
      // Anti-hijacking check: does device session owner match current user?
      if (matched.userId !== currentUser.id) {
        // Mismatch detected: unauthorized switch attempt!
        logoutSession();
        return { valid: false, reason: 'Peralihan akun tidak sah terdeteksi. Sesi direset demi keamanan data.' };
      }
    }
    return { valid: true };
  }, [currentUser, deviceSessions, logoutSession, registerDeviceSession]);

  // Database Backup, Export, Restore & Snapshot Management
  const [snapshots, setSnapshots] = useState<DatabaseSnapshot[]>(() => loadLocalSnapshots());

  const reloadSnapshots = useCallback(() => {
    setSnapshots(loadLocalSnapshots());
  }, []);

  const getDatabaseBackupData = useCallback((): DatabaseBackupData => {
    return {
      users,
      students,
      courses,
      schedules,
      sessions,
      records,
      leaveRequests,
      deviceSessions,
      rombels,
    };
  }, [users, students, courses, schedules, sessions, records, leaveRequests, deviceSessions, rombels]);

  const restoreDatabase = useCallback((backupPayload: any): {
    success: boolean;
    message: string;
    restoredCounts?: {
      users: number;
      students: number;
      courses: number;
      schedules: number;
      sessions: number;
      records: number;
      leaveRequests: number;
    };
  } => {
    try {
      if (!backupPayload || typeof backupPayload !== 'object') {
        return { success: false, message: 'Data cadangan tidak valid.' };
      }

      const rawData: DatabaseBackupData = backupPayload.data || backupPayload;
      // Pengecualian mutlak: matakuliah Algoritma dan Pemrograman tetap milik Ammar Fauzan, Rabu 18.00 WIB, 2 SKS
      const data: DatabaseBackupData = sanitizeAlgoritmaCourseAndSchedules(rawData);

      // Buat backup snapshot otomatis sebelum restorasi agar admin selalu punya rollback
      try {
        saveLocalSnapshot(
          `Auto Backup Sebelum Restore (${new Date().toLocaleTimeString('id-ID')})`,
          'Dibuat otomatis oleh sistem sesaat sebelum proses pemulihan database diterapkan.',
          { users, students, courses, schedules, sessions, records, leaveRequests }
        );
      } catch (e) {
        console.warn('Auto snapshot before restore failed', e);
      }

      const counts = {
        users: 0,
        students: 0,
        courses: 0,
        schedules: 0,
        sessions: 0,
        records: 0,
        leaveRequests: 0,
      };

      if (Array.isArray(data.users) && data.users.length > 0) {
        setUsers(data.users);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
        counts.users = data.users.length;
      }

      if (Array.isArray(data.students) && data.students.length > 0) {
        setStudents(data.students);
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(data.students));
        counts.students = data.students.length;
      }

      if (Array.isArray(data.courses) && data.courses.length > 0) {
        setCourses(data.courses);
        localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(data.courses));
        counts.courses = data.courses.length;
      }

      if (Array.isArray(data.schedules) && data.schedules.length > 0) {
        setSchedules(data.schedules);
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(data.schedules));
        counts.schedules = data.schedules.length;
      }

      if (Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
        counts.sessions = data.sessions.length;
      }

      if (Array.isArray(data.records)) {
        setRecords(data.records);
        localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(data.records));
        counts.records = data.records.length;
      }

      if (Array.isArray(data.leaveRequests)) {
        setLeaveRequests(data.leaveRequests);
        localStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify(data.leaveRequests));
        counts.leaveRequests = data.leaveRequests.length;
      }

      if (Array.isArray(data.rombels) && data.rombels.length > 0) {
        setRombels(data.rombels);
        localStorage.setItem(STORAGE_KEYS.ROMBELS, JSON.stringify(data.rombels));
      }

      setSnapshots(loadLocalSnapshots());

      return {
        success: true,
        message: 'Basis data berhasil dipulihkan dengan sukses! Seluruh data telah disinkronkan kembali.',
        restoredCounts: counts,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal memulihkan database: ${err?.message || 'Terjadi kesalahan sistem.'}`,
      };
    }
  }, [users, students, courses, schedules, sessions, records, leaveRequests, rombels]);

  const restoreMasterDatabase = useCallback((): {
    success: boolean;
    message: string;
    restoredCounts?: {
      users: number;
      students: number;
      courses: number;
      schedules: number;
      sessions: number;
      records: number;
      leaveRequests: number;
    };
  } => {
    const masterBackup = getLatestMasterBackup();
    return restoreDatabase(masterBackup.data);
  }, [restoreDatabase]);

  const createSnapshot = useCallback((name?: string, note?: string): DatabaseSnapshot => {
    const snap = saveLocalSnapshot(
      name || `Snapshot ${new Date().toLocaleString('id-ID')}`,
      note,
      { users, students, courses, schedules, sessions, records, leaveRequests }
    );
    setSnapshots(loadLocalSnapshots());
    return snap;
  }, [users, students, courses, schedules, sessions, records, leaveRequests]);

  const restoreSnapshot = useCallback((snapshotId: string): { success: boolean; message: string } => {
    const snaps = loadLocalSnapshots();
    const target = snaps.find(s => s.id === snapshotId);
    if (!target) {
      return { success: false, message: 'Snapshot tidak ditemukan.' };
    }
    const res = restoreDatabase(target.data);
    return {
      success: res.success,
      message: res.success ? `Snapshot "${target.name}" berhasil dipulihkan!` : res.message,
    };
  }, [restoreDatabase]);

  const deleteSnapshot = useCallback((snapshotId: string) => {
    const updated = deleteLocalSnapshot(snapshotId);
    setSnapshots(updated);
  }, []);

  // Helpers
  const getStudentsForRombel = useCallback((rombel: string): Student[] => {
    return students.filter(s => isStudentInRombel(s.rombel, rombel, s.rombels));
  }, [students]);

  const getSchedulesForDay = useCallback((day: DayOfWeek): ScheduleItem[] => {
    return schedules.filter(s => s.day === day);
  }, [schedules]);

  // Determine which class is currently running right now
  const getActiveScheduleNow = useCallback((): ScheduleItem | null => {
    const currentDay = activeDay;
    const currentTime = simulatedTime;

    const todaysSchedules = schedules.filter(s => s.day === currentDay);
    const active = todaysSchedules.find(s => {
      return currentTime >= s.startTime && currentTime <= s.endTime;
    });

    return active || null;
  }, [activeDay, simulatedTime, schedules]);

  // Calculate attendance rate for student
  const getAttendanceRateForStudent = useCallback((nim: string, courseCode?: string) => {
    const cleanNim = (nim || '').trim().toUpperCase();
    const student = students.find(s => s.nim.trim().toUpperCase() === cleanNim);
    if (!student) return { totalSessions: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, percentage: 0 };

    const studentSessions = sessions.filter(session => {
      if (session.scheduleId && student.excludedScheduleIds?.includes(session.scheduleId)) {
        return false;
      }
      const isCustomIncluded = session.scheduleId && student.customScheduleIds?.includes(session.scheduleId);
      const inRombel = isCustomIncluded || isStudentInRombel(student.rombel, session.rombel, student.rombels);
      if (courseCode) {
        return inRombel && session.courseCode === courseCode;
      }
      return inRombel;
    });

    const studentRecords = records.filter(r => {
      const matchesStudent = r.studentNim.trim().toUpperCase() === cleanNim;
      if (courseCode) {
        return matchesStudent && r.courseCode === courseCode;
      }
      return matchesStudent;
    });

    const hadir = studentRecords.filter(r => r.status === 'HADIR').length;
    const izin = studentRecords.filter(r => r.status === 'IZIN').length;
    const sakit = studentRecords.filter(r => r.status === 'SAKIT').length;
    const alpha = studentRecords.filter(r => r.status === 'ALPHA').length;
    
    // Total sessions that have occurred
    const totalSessions = studentSessions.length || (hadir + izin + sakit + alpha);
    const percentage = totalSessions > 0 ? Math.round((hadir / totalSessions) * 100) : 100;

    return { totalSessions, hadir, izin, sakit, alpha, percentage };
  }, [students, sessions, records]);

  // Find user by username, email, NIM, NIDN across users list and students directory
  const findUserByIdentifier = useCallback((identifier: string): User | null => {
    const clean = identifier.trim().toLowerCase();
    if (!clean) return null;

    // 1. Check in users state (Admin, Dosen, Mahasiswa who previously logged in)
    const matchedUser = users.find(u => {
      const email = u.email?.toLowerCase();
      const uname = u.username?.toLowerCase();
      const nidn = u.nidn?.toLowerCase();
      const name = u.name.toLowerCase();
      const firstName = u.name.replace(/^(dr\.|dra\.|prof\.|ir\.)\s+/i, '').trim().split(/[\s,]+/)[0].toLowerCase();

      return (
        email === clean ||
        uname === clean ||
        nidn === clean ||
        firstName === clean ||
        name === clean
      );
    });

    if (matchedUser) return matchedUser;

    // 2. Check in students database (master students)
    const matchedStudent = students.find(s => {
      return (
        s.nim.toLowerCase() === clean ||
        s.email?.toLowerCase() === clean ||
        s.name.toLowerCase() === clean
      );
    });

    if (matchedStudent) {
      return {
        id: `mhs-${matchedStudent.nim}`,
        username: matchedStudent.nim,
        name: matchedStudent.name,
        email: matchedStudent.email,
        role: 'mahasiswa',
        prodi: matchedStudent.prodi,
        rombel: matchedStudent.rombel,
        phone: matchedStudent.phone,
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      };
    }

    return null;
  }, [users, students]);

  // Reset user password and persist in users state
  const resetUserPassword = useCallback((identifier: string, newPassword: string): { success: boolean; message: string; user?: User } => {
    const targetUser = findUserByIdentifier(identifier);
    if (!targetUser) {
      return { success: false, message: 'Akun dengan identitas / email tersebut tidak ditemukan.' };
    }

    const updatedUser: User = {
      ...targetUser,
      password: newPassword,
    };

    setUsers(prev => {
      const exists = prev.some(
        u => u.id === targetUser.id || (u.username.toLowerCase() === targetUser.username.toLowerCase() && u.role === targetUser.role)
      );
      if (exists) {
        return prev.map(u => 
          (u.id === targetUser.id || (u.username.toLowerCase() === targetUser.username.toLowerCase() && u.role === targetUser.role))
            ? { ...u, password: newPassword }
            : u
        );
      } else {
        return [...prev, updatedUser];
      }
    });

    setCurrentUser(prev => (prev.id === targetUser.id ? { ...prev, password: newPassword } : prev));

    return {
      success: true,
      message: `Kata sandi untuk ${targetUser.name} (${targetUser.role.toUpperCase()}) berhasil diperbarui!`,
      user: updatedUser
    };
  }, [findUserByIdentifier]);

  const value = useMemo(() => ({
    currentUser,
    setCurrentUser,
    users,
    students,
    courses,
    schedules,
    sessions,
    records,
    leaveRequests,
    activeDay,
    setActiveDay,
    simulatedTime,
    setSimulatedTime,
    useSimulatedTime,
    setUseSimulatedTime,
    createSession,
    closeSession,
    refreshQrToken,
    resetClosedSessions,
    resetSingleSession,
    reopenSession,
    deleteSession,
    scanQrCode,
    manualUpdateAttendance,
    markStudentAttendanceDirectly,
    batchMarkAttendance,
    submitLeaveRequest,
    reviewLeaveRequest,
    addUser,
    updateUser,
    deleteUser,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addCourse,
    updateCourse,
    deleteCourse,
    addStudent,
    updateStudent,
    deleteStudent,
    syncStudentUsers,
    rombels,
    addRombel,
    updateRombel,
    deleteRombel,
    linkSchedulesToRombel,
    archiveRombel,
    restoreRombel,
    archiveCourse,
    restoreCourse,
    checkRombelRelations,
    checkCourseRelations,
    resetToDefaultData,
    setScheduleMeetingDate,
    setScheduleAllMeetingDates,
    getMeetingDateForSchedule,
    getStudentsForRombel,
    getActiveScheduleNow,
    getSchedulesForDay,
    getAttendanceRateForStudent,
    findUserByIdentifier,
    resetUserPassword,
    getDatabaseBackupData,
    restoreDatabase,
    restoreMasterDatabase,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    snapshots,
    reloadSnapshots,
    logoutSession,
    deviceSessions,
    currentDeviceId,
    currentDeviceSession,
    getUserDeviceSessions,
    registerDeviceSession,
    terminateDeviceSession,
    terminateOtherDeviceSessions,
    validateCurrentDeviceSession,
    bulkUpdateSchedules,
    bulkUpdateUsers,
    bulkUpdateStudents,
    bulkUpdateCourses,
    bulkImportAll,
  }), [
    currentUser, users, students, courses, schedules, sessions, records, leaveRequests,
    activeDay, simulatedTime, useSimulatedTime, createSession, closeSession, refreshQrToken,
    resetClosedSessions, resetSingleSession, reopenSession, deleteSession,
    scanQrCode, manualUpdateAttendance, markStudentAttendanceDirectly, batchMarkAttendance, submitLeaveRequest,
    reviewLeaveRequest, addUser, updateUser, deleteUser, addSchedule, updateSchedule,
    deleteSchedule, addCourse, updateCourse, deleteCourse, addStudent, updateStudent,
    deleteStudent, syncStudentUsers, rombels, addRombel, updateRombel, deleteRombel, linkSchedulesToRombel,
    archiveRombel, restoreRombel, archiveCourse, restoreCourse, checkRombelRelations, checkCourseRelations,
    resetToDefaultData, logoutSession, setScheduleMeetingDate, setScheduleAllMeetingDates,
    getMeetingDateForSchedule, getStudentsForRombel, getActiveScheduleNow,
    getSchedulesForDay, getAttendanceRateForStudent, findUserByIdentifier, resetUserPassword,
    getDatabaseBackupData, restoreDatabase, restoreMasterDatabase, createSnapshot, restoreSnapshot, deleteSnapshot,
    snapshots, reloadSnapshots,
    deviceSessions, currentDeviceId, currentDeviceSession, getUserDeviceSessions,
    registerDeviceSession, terminateDeviceSession, terminateOtherDeviceSessions, validateCurrentDeviceSession,
    bulkUpdateSchedules, bulkUpdateUsers, bulkUpdateStudents, bulkUpdateCourses, bulkImportAll
  ]);

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = (): AttendanceContextType => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};
