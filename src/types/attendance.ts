export type Role = 'admin' | 'dosen' | 'mahasiswa';

export type AttendanceStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA';

export type ProgramStudi = 'Teknologi Informasi' | 'Manajemen Informatika';

export interface User {
  id: string;
  username: string; // NIDN for lecturer, NIM for student, or admin username
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  title?: string; // e.g. "S.Pd.I., M.Pd." for lecturers
  prodi?: ProgramStudi;
  rombel?: string; // e.g. "TI 1A", "MI 5A"
  phone?: string;
}

export interface Course {
  id: string;
  code: string; // e.g. "MKTI0101"
  name: string; // e.g. "Kalkulus"
  sks: number;
  prodi: ProgramStudi;
  semester: number;
  defaultLecturerId: string;
  defaultLecturerName: string;
}

export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export interface ScheduleItem {
  id: string;
  day: DayOfWeek;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "10:40"
  courseCode: string;
  courseName: string;
  sks: number;
  lecturerId: string;
  lecturerName: string;
  room: string;      // e.g. "RK 2", "LAB 1"
  rombel: string;    // e.g. "TI 3", "TI 1 & 5", "MI 5", "MI 1U"
  prodi: ProgramStudi;
}

export interface Student {
  nim: string;
  name: string;
  prodi: ProgramStudi;
  rombel: string; // e.g. "TI 1A", "MI 1A", "TI 3", "TI 5", "MI 5A"
  email: string;
  phone?: string;
}

export interface AttendanceSession {
  id: string;
  scheduleId?: string;
  courseCode: string;
  courseName: string;
  lecturerId: string;
  lecturerName: string;
  rombel: string;
  room: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  meetingNumber: number; // Pertemuan ke-1 s/d 16
  topic: string;
  qrToken: string;
  isDynamicQr: boolean; // if true, refreshes token every N seconds
  qrExpiresAt: string; // ISO string
  isOpen: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  courseCode: string;
  courseName: string;
  studentNim: string;
  studentName: string;
  rombel: string;
  status: AttendanceStatus;
  scannedAt: string; // ISO string
  verificationMethod: 'QR_SCAN' | 'MANUAL_DOSEN' | 'AUTO_SCHEDULE' | 'IZIN_APPROVED';
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export interface LeaveRequest {
  id: string;
  studentNim: string;
  studentName: string;
  courseCode: string;
  courseName: string;
  rombel: string;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  type: 'IZIN' | 'SAKIT';
  reason: string;
  proofDocumentUrl?: string;
  createdAt: string;
}
