import type { AttendanceRecord, AttendanceSession, Course, ScheduleItem, Student } from '../types/attendance';
import { api, sessionGeneration } from './api';

export type ReportSnapshot = {
  generatedAt: string;
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  students: Student[];
  schedules: ScheduleItem[];
  courses: Course[];
};

export async function fetchReportSnapshot(): Promise<ReportSnapshot> {
  const identity = sessionGeneration();
  const snapshot = await api<ReportSnapshot>('/reports/snapshot');
  if (identity !== sessionGeneration()) throw new Error('Identitas berubah. Buka laporan kembali.');
  return snapshot;
}

export function reportTimestamp(value?: string): string {
  return new Date(value || Date.now()).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }) + ' WIB';
}
