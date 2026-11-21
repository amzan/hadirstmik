import type { AttendanceRecord, AttendanceSession, AttendanceStatus, Student } from '../types/attendance';

export type SessionAttendanceRow = { nim: string; name: string; status: AttendanceStatus | null; record?: AttendanceRecord };
export const attendanceStatusLabel = (status: AttendanceStatus | null): string => status ? ({ HADIR: 'Hadir', IZIN: 'Izin', SAKIT: 'Sakit', ALPHA: 'Alpa' }[status]) : 'Belum tercatat';

export function getSessionAttendanceRows(session: AttendanceSession, students: Student[], records: AttendanceRecord[]): SessionAttendanceRow[] {
  const sessionRecords = records.filter(record => record.sessionId === session.id);
  const nims = new Set([...(session.studentNims || []), ...sessionRecords.map(record => record.studentNim)]);
  return [...nims].sort((a, b) => a.localeCompare(b)).map(nim => {
    const record = sessionRecords.find(value => value.studentNim === nim);
    const student = students.find(value => value.nim === nim);
    return { nim, name: record?.studentName || student?.name || nim, status: record?.status || null, record };
  });
}

export function getSessionAttendanceSummary(rows: SessionAttendanceRow[]) {
  return { HADIR: rows.filter(row => row.status === 'HADIR').length, IZIN: rows.filter(row => row.status === 'IZIN').length,
    SAKIT: rows.filter(row => row.status === 'SAKIT').length, ALPHA: rows.filter(row => row.status === 'ALPHA').length,
    UNRECORDED: rows.filter(row => row.status === null).length, total: rows.length };
}
