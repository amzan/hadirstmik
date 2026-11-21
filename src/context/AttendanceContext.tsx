import { CURRENT_ACADEMIC_PERIOD, summarizeAttendancePolicy } from '../../shared/attendance-policy.mjs';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { User, Student, Course, ScheduleItem, Rombel, AttendanceSession, AttendanceRecord, LeaveRequest, DeviceSession, DatabaseBackupData, DatabaseSnapshot, DayOfWeek, AttendanceStatus } from '../types/attendance';
import { calculateCourseEffectiveAttendance, getStudentEnrolledSchedules, isStudentInRombel, getStudentRombelList } from '../data/initialData';
import { api, allPages, ApiError, invalidateApiSession, setApiDemoScope, isApiDemoScope, setApiDemoActor } from '../utils/api';
import { canonicalRombel } from '../../shared/academic-relations.mjs';

export const SESSION_KEYS = { REMEMBERED_ROLE: 'stmik_remembered_role', REMEMBERED_USERNAME: 'stmik_remembered_username' };
export const GUEST_USER: User = { id: 'guest', username: '', name: 'Pengunjung', email: '', role: 'mahasiswa' };
const emptyData = (): DatabaseBackupData => ({ users: [], students: [], courses: [], schedules: [], rombels: [], sessions: [], records: [], leaveRequests: [], deviceSessions: [] });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const weekday = () => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long' }).format(new Date()) as DayOfWeek;
const Context = createContext<ReturnType<typeof useServerAttendance> | undefined>(undefined);

function useServerAttendance() {
  const [demoScope, setDemoScopeState] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [data, setData] = useState<DatabaseBackupData>(emptyData);
  const [snapshots, setSnapshots] = useState<DatabaseSnapshot[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [activeDay, setActiveDay] = useState<DayOfWeek>(weekday);
  const [simulatedTime, setSimulatedTime] = useState(() => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).format(new Date()));
  const [useSimulatedTime, setUseSimulatedTime] = useState(false);
  const generation = useRef(0), busy = useRef(new Set<string>()), identity = useRef('guest');
  const currentUserRef = useRef(currentUser); currentUserRef.current = currentUser;
  const refresh = useCallback(async () => {
    const attempt = ++generation.current;
    try {
      const user: User = await api('/auth/me');
      if (attempt !== generation.current) return;
      setApiDemoActor(user.isDemo === true);
      if (identity.current !== user.id) { setData(emptyData()); setSnapshots([]); identity.current = user.id; }
      if (user.mustChangePassword) { setCurrentUser(user); setData(emptyData()); setSnapshots([]); setError(''); return; }
      const names = ['users','students','courses','schedules','rombels','attendance-sessions','attendance-records','leave-requests'];
      const lists = await Promise.all(names.map(name => allPages(`/${name}`)));
      const devices = await api<DeviceSession[]>('/auth/device-sessions');
      const storedSnapshots = user.role === 'admin' && !isApiDemoScope() ? await api<DatabaseSnapshot[]>('/admin/snapshots') : [];
      if (attempt !== generation.current) return;
      const next = { users: lists[0], students: lists[1], courses: lists[2], schedules: lists[3], rombels: lists[4], sessions: lists[5], records: lists[6], leaveRequests: lists[7], deviceSessions: devices } as DatabaseBackupData;
      const student = next.students.find(s => (s as Student & { userId?: string }).userId === user.id);
      setCurrentUser(student ? { ...user, rombel: student.rombel, rombels: student.rombels, excludedScheduleIds: student.excludedScheduleIds, customScheduleIds: student.customScheduleIds } : user);
      setData(next); setSnapshots(storedSnapshots); setError('');
    } catch (err) {
      if (attempt !== generation.current) return;
      if (err instanceof ApiError && err.status === 401) { identity.current = 'guest'; setCurrentUser(GUEST_USER); setData(emptyData()); setSnapshots([]); }
      else setError(err instanceof Error ? err.message : 'Sinkronisasi gagal. Coba kembali.');
    } finally { if (attempt === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const expired = () => { invalidateApiSession(); setDemoScopeState(false); generation.current++; identity.current = 'guest'; setCurrentUser(GUEST_USER); setData(emptyData()); setSnapshots([]); setError(''); setLoading(false); };
    const changed = () => { expired(); void refresh(); };
    const reported = (event: Event) => setError((event as CustomEvent<string>).detail || 'Permintaan gagal.');
    const rejected = (event: PromiseRejectionEvent) => { if(event.reason instanceof ApiError) { event.preventDefault(); setError(event.reason.message); } };
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    window.addEventListener('hadir-session-changed', changed); window.addEventListener('hadir-session-expired', expired); window.addEventListener('focus', refresh);
    window.addEventListener('hadir-api-error',reported);window.addEventListener('unhandledrejection',rejected);
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hadir-auth');
    channel?.addEventListener('message', changed);
    const restored = (event: PageTransitionEvent) => { if (event.persisted) changed(); };
    window.addEventListener('pageshow', restored);
    return () => { clearInterval(interval); window.removeEventListener('pageshow', restored); window.removeEventListener('hadir-session-changed', changed); window.removeEventListener('hadir-session-expired', expired); window.removeEventListener('focus', refresh);window.removeEventListener('hadir-api-error',reported);window.removeEventListener('unhandledrejection',rejected); channel?.close(); generation.current++; };
  }, [refresh]);
  const notify = () => { const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hadir-auth'); channel?.postMessage('changed'); channel?.close(); };
  const mutate = async <T,>(path: string, method = 'POST', body?: unknown): Promise<T> => {
    const key = method + path;
    if (busy.current.has(key)) throw new Error('Permintaan masih diproses.');
    busy.current.add(key); setError('');
    try { const result = await api<T>(path, method, body); await refresh(); return result; }
    catch (err) { setError(err instanceof Error ? err.message : 'Penyimpanan gagal.'); throw err; }
    finally { busy.current.delete(key); }
  };
  const { users, students, courses, schedules, sessions, records, leaveRequests } = data;
  const rombels = data.rombels || [], deviceSessions = data.deviceSessions || [];
  const safePayload = (value: any) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'password' && key !== 'sessionToken'));
  const versioned = (items: any[], id: string, key = 'id') => items.find(item => item[key] === id)?.version;
  const addEntity = async (name: string, value: any) => mutate<any>(`/${name}`, 'POST', safePayload(value));
  const updateEntity = async (name: string, id: string, value: any, items: any[], key = 'id') => mutate<any>(`/${name}/${encodeURIComponent(id)}`, 'PATCH', { ...safePayload(value), version: versioned(items, id, key) });
  const relations = (student: Partial<Student>) => ({ rombelIds: getStudentRombelList(student.rombels?.length ? student.rombels : student.rombel).map(code => { const matches = rombels.filter(r => canonicalRombel(r.code) === code); if (matches.length !== 1) throw new Error('Relasi rombel belum tersedia atau masih ambigu.'); return matches[0].id; }), includedIds: student.customScheduleIds || [], excludedIds: student.excludedScheduleIds || [] });
  const saveStudent = async (student: Student, previousNim?: string) => {
    const payload={...student,...relations(student)};
    return previousNim ? await updateEntity('students', previousNim, payload, students, 'nim') : await addEntity('students', payload);
  };
  const saveRombel = async (value: any, scheduleIds: string[] = [], id?: string) => {
    const payload={...value,scheduleIds};
    const saved = id ? await updateEntity('rombels', id, payload, rombels) : await addEntity('rombels', payload);
    return { success: true, message: 'Rombel tersimpan.', rombel: saved as Rombel };
  };
  const archive = async (name: 'courses' | 'rombels', idOrCode: string, archived: boolean) => {
    const items = name === 'courses' ? courses : rombels; const found = items.find(x => x.id === idOrCode || x.code === idOrCode);
    if (!found) throw new Error('Data tidak ditemukan.');
    await updateEntity(name, found.id, { isArchived: archived, archivedAt: archived ? new Date().toISOString() : null }, items);
    return { success: true, message: archived ? 'Data diarsipkan.' : 'Data dipulihkan.' };
  };
  const getAttendanceRateForStudent = (nim: string, courseCode?: string) => {
    const targetSchedule = courseCode && schedules.some(schedule => schedule.id === courseCode);
    const relevant = sessions.filter(session => session.academicPeriod === CURRENT_ACADEMIC_PERIOD &&
      (!courseCode || (targetSchedule ? session.scheduleId === courseCode : session.courseCode === courseCode)));
    return summarizeAttendancePolicy(sessions, records, nim, { sessionIds: relevant.map(session => session.id) });
  };
  const batch = (id: string, updates: Array<{ studentNim: string; status: AttendanceStatus; notes?: string; version?: number | null }>, version?: number) => mutate(`/attendance-sessions/${encodeURIComponent(id)}/records/batch`, 'POST', { version, updates: updates.map(u => ({ ...u, reason: u.notes || 'Koreksi manual dosen' })) });
  const reloadSnapshots = async () => { const next = await api<DatabaseSnapshot[]>('/admin/snapshots'); setSnapshots(next); return next; };
  const restoreDatabase = async (backup: any) => {
    const preview = await api<any>('/admin/imports/preview', 'POST', { backup });
    if (!preview.valid) return { success: false, message: `Validasi gagal: ${preview.issues.length} konflik. Sumber tetap utuh.` };
    await mutate('/admin/imports/apply', 'POST', { backup, sourceHash: preview.sourceHash });
    return { success: true, message: 'Data diimpor tanpa menimpa data yang berkonflik.', restoredCounts: preview.counts };
  };
  const bulkImportAll = async (incoming: any, _mode?: 'merge' | 'replace') => {
    const payload: Record<string, any[]> = {};
    for (const name of ['users','courses','students','schedules']) {
      if (!incoming[name]?.length) continue;
      const existing = (data as any)[name] as any[];
      payload[name] = incoming[name].map((item: any) => {
        const old = existing.find(row => name === 'users' ? row.username === item.username : name === 'courses' ? row.code === item.code : name === 'students' ? row.nim === item.nim : row.id === item.id || (row.courseCode === item.courseCode && row.rombel === item.rombel && row.day === item.day && row.startTime === item.startTime));
        return { ...safePayload(item), ...(old ? { id: old.id, version: old.version } : {}), ...(name === 'students' ? relations(item) : name === 'schedules' ? {rombelIds: relations({rombel:item.rombel}).rombelIds} : {}) };
      });
    }
    const preview = await api<any>('/admin/bulk/preview','POST',{data:payload});
    if (!preview.valid) throw new Error('Impor memiliki konflik: ' + preview.issues.map((i:any)=>i.entity+' #'+(i.index+1)+' '+i.code).join(', '));
    const result = await mutate<any>('/admin/bulk/apply','POST',{data:payload,sourceHash:preview.sourceHash});
    return {...result, schedulesCount:result.counts.schedules.total,usersCount:result.counts.users.total,studentsCount:result.counts.students.total,coursesCount:result.counts.courses.total};
  };
  return {
    ...data, rombels, deviceSessions, currentUser, loading, error, refresh, demoScope,
    setDemoScope: async (enabled: boolean) => {
      if (currentUser.role !== 'admin') throw new Error('Akses admin diperlukan.');
      generation.current++; setApiDemoScope(enabled); setDemoScopeState(enabled); setData(emptyData()); setSnapshots([]); setLoading(true); await refresh();
    }, clearError: () => setError(''),
    setCurrentUser: (_user: User) => { void refresh(); },
    activeDay, setActiveDay, simulatedTime, setSimulatedTime, useSimulatedTime, setUseSimulatedTime,
    createSession: (value: any) => mutate<AttendanceSession>('/attendance-sessions', 'POST', { ...value, date: value.date || today() }),
    closeSession: (id: string) => mutate(`/attendance-sessions/${id}/close`),
    refreshQrToken: async (id: string) => (await mutate<AttendanceSession>(`/attendance-sessions/${id}/rotate-qr`)).qrToken,
    reopenSession: (id: string) => mutate(`/attendance-sessions/${id}/reopen`),
    deleteSession: (id: string) => mutate(`/attendance-sessions/${id}`, 'DELETE'),
    resetSingleSession: (id: string) => mutate(`/attendance-sessions/${id}/reset`),
    resetClosedSessions: async () => { const closed = sessions.filter(s => !s.isOpen); for (const s of closed) await mutate(`/attendance-sessions/${s.id}/reset`); return closed.length; },
    scanQrCode: async (value: string, _studentNim?: string) => {
      let qr = value.trim(); try { if (qr.startsWith('{')) qr = JSON.parse(qr).token || JSON.parse(qr).qrToken; else if (qr.includes('token=')) qr = new URL(qr).searchParams.get('token') || ''; } catch { throw new Error('Format QR tidak valid.'); }
      return mutate<{ success: boolean; message: string; session?: AttendanceSession }>('/attendance/scan', 'POST', { token: qr });
    },
    manualUpdateAttendance: async (id: string, status: AttendanceStatus, notes?: string) => { const record = records.find(r => r.id === id); if (!record) throw new Error('Data tidak ditemukan.'); return batch(record.sessionId, [{ studentNim: record.studentNim, status, notes }]); },
    markStudentAttendanceDirectly: (id: string, nim: string, status: AttendanceStatus, notes?: string) => batch(id, [{ studentNim: nim, status, notes }]), batchMarkAttendance: batch,
    submitLeaveRequest: async (value: any) => {
      const payload = { ...value };
      if (payload.proofDocumentUrl) {
        const proof = await api<{ id: string }>('/leave-proofs', 'POST', { dataUrl: payload.proofDocumentUrl }); payload.proofId = proof.id; delete payload.proofDocumentUrl;
      }
      return mutate('/leave-requests', 'POST', payload);
    },
    reviewLeaveRequest: (id: string, decision: 'APPROVED' | 'REJECTED') => mutate(`/leave-requests/${id}/review`, 'POST', { decision }),
    addUser: (value: any) => addEntity('users', value), updateUser: async (id: string, value: Partial<User> & { currentPassword?: string }) => {
      let uploadedVersion: number | undefined;
      if (value.avatarUrl?.startsWith('data:')) {
        if (id !== currentUser.id) throw new Error('Unggah foto hanya untuk akun sendiri.');
        const uploaded = await api<{ avatarUrl: string; version: number }>('/avatars', 'POST', { dataUrl: value.avatarUrl });
        value = { ...value, avatarUrl: uploaded.avatarUrl };
        uploadedVersion = uploaded.version;
        await refresh();
      }
      const changed=id===currentUser.id ? Object.fromEntries(Object.entries(value).filter(([key,val])=>val!==(currentUser as any)[key])) : value;
      return Object.keys(changed).length ? uploadedVersion === undefined ? updateEntity('users', id, changed, users) : mutate(`/users/${encodeURIComponent(id)}`, 'PATCH', { ...safePayload(changed), version: uploadedVersion }) : Promise.resolve(currentUser);
    }, deleteUser: (id: string) => mutate(`/users/${id}`, 'DELETE'),
    addStudent: (value: Student) => saveStudent(value), updateStudent: (nim: string, value: Partial<Student>) => { const old = students.find(s => s.nim === nim); if (!old) throw new Error('Mahasiswa tidak ditemukan.'); return saveStudent({ ...old, ...value }, nim); }, deleteStudent: (nim: string) => mutate(`/students/${encodeURIComponent(nim)}`, 'DELETE'),
    syncStudentUsers: async () => { await refresh(); return { count: students.length, added: 0, updated: 0 }; },
    addCourse: (value: any) => addEntity('courses', value), updateCourse: (id: string, value: Partial<Course>) => updateEntity('courses', id, value, courses), deleteCourse: (id: string) => mutate(`/courses/${id}`, 'DELETE'),
    addSchedule: (value: any) => addEntity('schedules', { ...value, rombelIds: relations({rombel:value.rombel}).rombelIds }), updateSchedule: (id: string, value: Partial<ScheduleItem>) => updateEntity('schedules', id, {...value,...(value.rombel?{rombelIds:relations({rombel:value.rombel}).rombelIds}:{})}, schedules), deleteSchedule: (id: string) => mutate(`/schedules/${id}`, 'DELETE'),
    addRombel: (value: any, ids?: string[]) => saveRombel(value, ids), updateRombel: (id: string, value: any, ids?: string[], _previousCode?: string) => saveRombel(value, ids || rombels.find(r => r.id === id)?.scheduleIds, id), deleteRombel: async (id: string) => { await mutate(`/rombels/${id}`, 'DELETE'); return { success: true, message: 'Rombel diarsipkan.' }; },
    archiveRombel: (id: string) => archive('rombels', id, true), restoreRombel: (id: string) => archive('rombels', id, false), archiveCourse: (id: string) => archive('courses', id, true), restoreCourse: (id: string) => archive('courses', id, false),
    linkSchedulesToRombel: (code: string, scheduleIds: string[]) => { const rombel = rombels.find(r => r.code === code); if (!rombel) throw new Error('Rombel tidak ditemukan.'); return mutate(`/rombels/${rombel.id}/schedules`, 'PUT', { scheduleIds }); },
    checkRombelRelations: (code: string) => { const ss = schedules.filter(s => isStudentInRombel(code, s.rombel)), st = students.filter(s => isStudentInRombel(s.rombel, code, s.rombels)), se = sessions.filter(s => isStudentInRombel(code, s.rombel)); return { canDelete: !ss.length && !st.length && !se.length, scheduleCount: ss.length, studentCount: st.length, sessionCount: se.length, schedules: ss, students: st, sessions: se }; },
    checkCourseRelations: (code: string) => { const ss = schedules.filter(s => s.courseCode === code), se = sessions.filter(s => s.courseCode === code); return { canDelete: !ss.length && !se.length, scheduleCount: ss.length, sessionCount: se.length, schedules: ss, sessions: se }; },
    setScheduleMeetingDate: (id: string, number: number, value: string) => mutate(`/schedules/${id}/meeting-dates`, 'PUT', { meetingDates: { ...schedules.find(s => s.id === id)?.meetingDates, [number]: value } }),
    setScheduleAllMeetingDates: (id: string, dates: Record<number, string>) => mutate(`/schedules/${id}/meeting-dates`, 'PUT', { meetingDates: dates }),
    getMeetingDateForSchedule: (schedule: ScheduleItem, number: number) => schedule.meetingDates?.[number] || today(),
    getStudentsForRombel: (code: string) => students.filter(s => isStudentInRombel(s.rombel, code, s.rombels)),
    getActiveScheduleNow: () => { const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date()); return schedules.find(s => s.day === activeDay && s.startTime <= (simulatedTime || clock) && s.endTime > (simulatedTime || clock)) || null; },
    getSchedulesForDay: (day: DayOfWeek) => schedules.filter(s => s.day === day), getAttendanceRateForStudent,
    syncStudentData: async (nim?: string) => { await refresh(); const stats = getAttendanceRateForStudent(nim || currentUser.username); return { success: true, message: 'Data server dimuat ulang.', syncedAt: new Date().toLocaleTimeString('id-ID'), stats: { ...stats, enrolledCourses: schedules.length } }; },
    getDatabaseBackupData: () => data, restoreDatabase,
    restoreMasterDatabase: async () => { const master = await api('/admin/backups/latest'); return restoreDatabase(master); },
    snapshots, reloadSnapshots,
    createSnapshot: async (name = 'Snapshot', note = '') => { const snapshot = await mutate<DatabaseSnapshot>('/admin/snapshots', 'POST', { name, note }); await reloadSnapshots(); return snapshot; },
    restoreSnapshot: async (id: string) => { const snapshot = await api<any>(`/admin/snapshots/${id}`); return restoreDatabase(snapshot.data); },
    deleteSnapshot: async (id: string) => { await mutate(`/admin/snapshots/${id}`, 'DELETE'); await reloadSnapshots(); },
    resetToDefaultData: async () => { throw new Error('Reset memerlukan preview dan cadangan server. Data tidak dihapus.'); },
    logoutSession: async () => { setDemoScopeState(false); await api('/auth/logout', 'POST', {}); invalidateApiSession(); generation.current++; setCurrentUser(GUEST_USER); setData(emptyData()); setSnapshots([]); identity.current = 'guest'; notify(); },
    currentDeviceId: deviceSessions.find(s => s.isCurrentDevice)?.deviceId || '', currentDeviceSession: deviceSessions.find(s => s.isCurrentDevice) || null,
    getUserDeviceSessions: (id?: string) => deviceSessions.filter(s => !id || s.userId === id),
    registerDeviceSession: async (_user: User) => { await refresh(); notify(); return deviceSessions.find(s => s.isCurrentDevice) || null; },
    terminateDeviceSession: async (id: string) => { await mutate(`/auth/device-sessions/${id}`, 'DELETE'); return { success: true, message: 'Sesi diakhiri.' }; },
    terminateOtherDeviceSessions: (_id: string) => mutate<{ count: number; message?: string }>('/auth/device-sessions/revoke-others', 'POST', {}),
    validateCurrentDeviceSession: () => ({ valid: currentUser.id !== 'guest', reason: currentUser.id === 'guest' ? 'Sesi berakhir.' : undefined }),
    bulkImportAll,
    bulkUpdateSchedules: async (items: ScheduleItem[], mode?: 'merge' | 'replace') => (await bulkImportAll({schedules:items},mode)).counts.schedules,
    bulkUpdateUsers: async (items: User[], mode?: 'merge' | 'replace') => (await bulkImportAll({users:items},mode)).counts.users,
    bulkUpdateStudents: async (items: Student[], mode?: 'merge' | 'replace') => (await bulkImportAll({students:items},mode)).counts.students,
    bulkUpdateCourses: async (items: Course[], mode?: 'merge' | 'replace') => (await bulkImportAll({courses:items},mode)).counts.courses,
  };
}

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const value = useServerAttendance();
  return <Context.Provider value={value}>{value.currentUser.isDemo && <div role="status" className="bg-amber-100 text-amber-950 p-3 text-center font-semibold">DATA DEMO - Akun dan data simulasi terisolasi</div>}{value.error && <div role="alert" className="fixed top-2 left-2 right-2 z-[10000] bg-rose-50 text-rose-800 p-3 text-sm flex gap-3"><span>{value.error}</span><button type="button" onClick={() => void value.refresh()}>Coba lagi</button><button type="button" onClick={value.clearError}>Tutup</button></div>}{children}</Context.Provider>;
}
export function useAttendance() { const value = useContext(Context); if (!value) throw new Error('AttendanceProvider diperlukan.'); return value; }
