import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  User, Course, ScheduleItem, Student, AttendanceSession,
  AttendanceRecord, LeaveRequest, AttendanceStatus, DayOfWeek
} from '../types/attendance';
import {
  INITIAL_USERS, INITIAL_STUDENTS, INITIAL_COURSES, INITIAL_SCHEDULES,
  INITIAL_SESSIONS, INITIAL_RECORDS, INITIAL_LEAVE_REQUESTS,
  isStudentInRombel, CAMPUS_INFO
} from '../data/initialData';

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
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USERS: 'stmik_users_v1',
  STUDENTS: 'stmik_students_v1',
  COURSES: 'stmik_courses_v1',
  SCHEDULES: 'stmik_schedules_v1',
  SESSIONS: 'stmik_sessions_v1',
  RECORDS: 'stmik_records_v1',
  LEAVE: 'stmik_leave_v1',
  CURRENT_USER_ID: 'stmik_current_user_id_v1',
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
    return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
  });

  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COURSES);
    return saved ? JSON.parse(saved) : INITIAL_COURSES;
  });

  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    return saved ? JSON.parse(saved) : INITIAL_SCHEDULES;
  });

  const [sessions, setSessions] = useState<AttendanceSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
  });

  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
    return saved ? JSON.parse(saved) : INITIAL_RECORDS;
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LEAVE);
    return saved ? JSON.parse(saved) : INITIAL_LEAVE_REQUESTS;
  });

  // Current logged in user (in-memory only, no previous session auto-login)
  const [currentUser, setCurrentUser] = useState<User>(() => {
    return users.find(u => u.id === 'dosen-3') || users[0];
  });

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

  // Clean up any previously persisted user ID so next refresh starts clean on home page
  useEffect(() => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
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

  // Admin user management
  const addUser = useCallback((newUser: Omit<User, 'id'>) => {
    const user: User = {
      ...newUser,
      id: `user-${Date.now()}`,
    };
    setUsers(prev => [...prev, user]);
  }, []);

  const updateUser = useCallback((id: string, updated: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u));
    setCurrentUser(prev => (prev.id === id ? { ...prev, ...updated } : prev));
    if (updated.name) {
      setSchedules(prev => prev.map(s => s.lecturerId === id ? { ...s, lecturerName: updated.name! } : s));
      setSessions(prev => prev.map(ses => ses.lecturerId === id ? { ...ses, lecturerName: updated.name! } : ses));
    }
  }, []);

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
    setCurrentUser(INITIAL_USERS.find(u => u.id === 'dosen-3') || INITIAL_USERS[0]);
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
  }), [
    currentUser, users, students, courses, schedules, sessions, records, leaveRequests,
    activeDay, simulatedTime, useSimulatedTime, createSession, closeSession, refreshQrToken,
    resetClosedSessions, resetSingleSession, reopenSession, deleteSession,
    scanQrCode, manualUpdateAttendance, markStudentAttendanceDirectly, batchMarkAttendance, submitLeaveRequest,
    reviewLeaveRequest, addUser, updateUser, deleteUser, addSchedule, updateSchedule,
    deleteSchedule, addCourse, updateCourse, deleteCourse, addStudent, updateStudent,
    deleteStudent, resetToDefaultData, setScheduleMeetingDate, setScheduleAllMeetingDates,
    getMeetingDateForSchedule, getStudentsForRombel, getActiveScheduleNow,
    getSchedulesForDay, getAttendanceRateForStudent, findUserByIdentifier, resetUserPassword
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
