import { splitRombels, sameRombelMembership } from '../../shared/academic-relations.mjs';
import { CURRENT_ACADEMIC_PERIOD } from '../../shared/attendance-policy.mjs';
import type { Course, ScheduleItem, Student, User, AttendanceSession, AttendanceRecord, LeaveRequest, Rombel } from '../types/attendance';

export const CAMPUS_INFO = {
  name: 'STMIK PERSATUAN GURU REPUBLIK INDONESIA (PGRI) ARUNGBINANG KEBUMEN',
  shortName: 'STMIK PGRI Arungbinang Kebumen',
  address: 'Jl. Cendrawasih No.27A Tamanwinangun Telp. 386630 Kebumen 54313',
  semester: CURRENT_ACADEMIC_PERIOD,
  wakilKetua1: 'Nur Wasito, S.Pd., M.Pd.',
  dosenWaliTI: 'Agus Jaka Sri Hartanta, S.Pd., M.Kom.',
  dosenWaliMI: 'Fitriani Dwi Ratna Sari, S.T., M.M.',
};

// Helper to parse student's rombel(s) into an array of individual rombel strings
// Expands shorthand composite rombels like "TI 1 & 5" -> ["TI 1", "TI 5"] so "5" inherits the prodi prefix ("TI")
export function getStudentRombelList(studentRombel: string | string[] | undefined): string[] {
  return splitRombels(studentRombel);
}

export function isStudentInRombel(studentRombel: string | string[] | undefined, scheduleRombel: string, studentRombelsArray?: string[]): boolean {
  return sameRombelMembership(studentRombelsArray?.length ? studentRombelsArray : studentRombel, scheduleRombel);
}

// Maximum SKS limit per semester standard
export const MAX_STANDARD_SKS = 20;

/**
 * Returns all active schedules enrolled for a given student, taking into account
 * their rombels, any custom included schedule IDs, and excluded schedule IDs.
 */
export function getStudentEnrolledSchedules(
  student: Student | User | { rombel?: string; rombels?: string[]; excludedScheduleIds?: string[]; customScheduleIds?: string[] } | null | undefined,
  allSchedules: ScheduleItem[]
): ScheduleItem[] {
  if (!student) return [];
  const rombelList = student.rombels && student.rombels.length > 0
    ? student.rombels
    : getStudentRombelList(student.rombel);

  const excludedSet = new Set(student.excludedScheduleIds || []);
  const customSet = new Set(student.customScheduleIds || []);

  const seen = new Set<string>();
  return allSchedules.filter(sch => {
    if (seen.has(sch.id)) return false;
    seen.add(sch.id);
    if (sch.isArchived) return false;
    // If explicitly excluded by admin/student, omit
    if (excludedSet.has(sch.id)) return false;
    // If explicitly included via custom schedules, include
    if (customSet.has(sch.id)) return true;
    // Otherwise check rombel match
    return isStudentInRombel(rombelList, sch.rombel);
  });
}

/**
 * Calculates the total SKS for a student across all active enrolled schedules.
 */
export function getStudentTotalSks(
  student: Student | User | { rombel?: string; rombels?: string[]; excludedScheduleIds?: string[]; customScheduleIds?: string[] } | null | undefined,
  allSchedules: ScheduleItem[]
): number {
  const enrolled = getStudentEnrolledSchedules(student, allSchedules);
  return enrolled.reduce((acc, sch) => acc + (sch.sks || 0), 0);
}

/**
 * Aturan Akademik Toleransi Izin & Sakit:
 * - Jika mahasiswa izin kurang dari 3 kali (1 atau 2 kali, maks 2) maka dianggap hadir.
 * - Jika mahasiswa sakit kurang dari 3 kali (1 atau 2 kali, maks 2) maka dianggap hadir.
 * - Lebih dari itu (>= 3 kali), status izin dan sakit selebihnya dianggap tidak hadir.
 */
export { CURRENT_ACADEMIC_PERIOD, MAX_TOLERATED_IZIN_AS_HADIR, MAX_TOLERATED_SAKIT_AS_HADIR, calculateCourseEffectiveAttendance, summarizeAttendancePolicy, summarizeAllAttendancePolicy } from '../../shared/attendance-policy.mjs';

export const STUDENT_AVATARS = [
  '1534528741775-53994a69daeb',
  '1535713875002-d1d0cf377fde',
  '1494790108377-be9c29b29330',
  '1507003211169-0a1dd7228f2d',
  '1522075469751-3a6694fb2f61',
  '1544005313-94ddf0286df2',
  '1500648767791-00dcc994a43e',
  '1517841905240-472988babdf9',
  '1539571696357-5a69c17a67c6',
  '1524504388940-b1c1722653e1',
];
