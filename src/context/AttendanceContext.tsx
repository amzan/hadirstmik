import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  User, Course, ScheduleItem, Student, AttendanceSession,
  AttendanceRecord, LeaveRequest, AttendanceStatus, DayOfWeek,
  DatabaseBackupData, DatabaseBackup, DatabaseSnapshot, DeviceSession
} from '../types/attendance';
import {
  INITIAL_USERS, INITIAL_STUDENTS, INITIAL_COURSES, INITIAL_SCHEDULES,
  INITIAL_SESSIONS, INITIAL_RECORDS, INITIAL_LEAVE_REQUESTS,
  isStudentInRombel, CAMPUS_INFO
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
  SESSIONS: 'stmik_sessions_v1',
  RECORDS: 'stmik_records_v1',
  LEAVE: 'stmik_leave_v1',
  CURRENT_USER_ID: SESSION_KEYS.CURRENT_USER_ID,
};

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state from localStorage or seed
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try {
        const parsed: User[] = JSON.parse(saved);
        return parsed.map(u => {
          const init = INITIAL_USERS.find(iu => iu.id === u.id);
          return {
            ...init,
            ...u,
            nidn: u.nidn || init?.nidn || (u.role === 'dosen' ? u.username : undefined),
            ...(u.role === 'admin' ? { username: 'baak' } : {}),
          };
        });
      } catch {
        return INITIAL_USERS;
      }
    }
    return INITIAL_USERS;
  });

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
    // 1. Find active open session matching this token (or start of token if dynamic)
    const session = sessions.find(s => {
      if (!s.isOpen) return false;
      // Direct token match or valid prefix
      return s.qrToken === token.trim() || token.trim().startsWith(s.qrToken.split('-').slice(0, 3).join('-'));
    });

    if (!session) {
      return {
        success: false,
        message: 'QR Code tidak valid atau sesi presensi telah ditutup oleh dosen pengampu.',
      };
    }

    // 2. Find student
    const student = students.find(s => s.nim === studentNim);
    if (!student) {
      return {
        success: false,
        message: `Data mahasiswa dengan NIM ${studentNim} tidak ditemukan di sistem.`,
      };
    }

    // 3. Verify student belongs to this rombel/class
    const isEnrolled = isStudentInRombel(student.rombel, session.rombel);
    if (!isEnrolled) {
      return {
        success: false,
        message: `Mahasiswa (${student.name} - ${student.rombel}) tidak terdaftar dalam kelas rombel ${session.rombel}.`,
      };
    }

    // 4. Check if already checked in
    const existing = records.find(r => r.sessionId === session.id && r.studentNim === studentNim);
    if (existing) {
      return {
        success: true,
        message: `Anda sudah tercatat presensi sebelumnya dengan status "${existing.status}" pada ${new Date(existing.scannedAt).toLocaleTimeString('id-ID')}.`,
        session,
      };
    }

    // 5. Record attendance as HADIR
    const newRecord: AttendanceRecord = {
      id: `rec-${Date.now()}-${studentNim}`,
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
  }, [sessions, students, records]);

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
  const addSchedule = useCallback((newSch: Omit<ScheduleItem, 'id'>) => {
    const sch: ScheduleItem = {
      ...newSch,
      id: `sch-${Date.now()}`,
    };
    setSchedules(prev => [...prev, sch]);
  }, []);

  const updateSchedule = useCallback((id: string, updated: Partial<ScheduleItem>) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  }, []);

  const deleteSchedule = useCallback((id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  }, []);

  // Course management
  const addCourse = useCallback((newC: Omit<Course, 'id'>) => {
    const c: Course = {
      ...newC,
      id: `c-${Date.now()}`,
    };
    setCourses(prev => [...prev, c]);
  }, []);

  const updateCourse = useCallback((id: string, updated: Partial<Course>) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
  }, []);

  // Student management
  const addStudent = useCallback((newStudent: Student) => {
    setStudents(prev => [...prev, newStudent]);
  }, []);

  const updateStudent = useCallback((nim: string, updated: Partial<Student>) => {
    setStudents(prev => prev.map(s => s.nim === nim ? { ...s, ...updated } : s));
  }, []);

  const deleteStudent = useCallback((nim: string) => {
    setStudents(prev => prev.filter(s => s.nim !== nim));
  }, []);

  // Bulk Excel import & update implementations
  const bulkUpdateStudents = useCallback((incoming: Student[], mode: 'merge' | 'replace' = 'merge') => {
    let added = 0;
    let updated = 0;
    setStudents(prev => {
      if (mode === 'replace') {
        added = incoming.length;
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(incoming));
        return incoming;
      }
      const result = [...prev];
      incoming.forEach(newItem => {
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
    };
  }, [users, students, courses, schedules, sessions, records, leaveRequests, deviceSessions]);

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
  }, [users, students, courses, schedules, sessions, records, leaveRequests]);

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
    return students.filter(s => isStudentInRombel(s.rombel, rombel));
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
    const student = students.find(s => s.nim === nim);
    if (!student) return { totalSessions: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, percentage: 0 };

    const studentSessions = sessions.filter(session => {
      const inRombel = isStudentInRombel(student.rombel, session.rombel);
      if (courseCode) {
        return inRombel && session.courseCode === courseCode;
      }
      return inRombel;
    });

    const studentRecords = records.filter(r => {
      const matchesStudent = r.studentNim === nim;
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
    const validPresence = hadir + (izin * 0.5) + (sakit * 0.5); // weighted or standard
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
    deleteStudent, resetToDefaultData, logoutSession, setScheduleMeetingDate, setScheduleAllMeetingDates,
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
