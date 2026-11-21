export type Role = 'admin' | 'dosen' | 'mahasiswa';

export type AttendanceStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA';

export type ProgramStudi = 'Teknologi Informasi' | 'Manajemen Informatika' | 'Lintas Program Studi';

export interface User {
  isDemo?: boolean;
  version?: number;
  hasCredentials?: boolean;
  mustChangePassword?: boolean;
  emailVerified?: boolean;
  id: string;
  loginAlias?: string;
  username: string; // NIDN for lecturer, NIM for student, or admin username
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  title?: string; // e.g. "S.Pd.I., M.Pd." for lecturers
  nidn?: string;
  academicRank?: string; // e.g. "Lektor", "Asisten Ahli", "Dosen Tetap"
  officeRoom?: string; // e.g. "Gedung A Lt. 2 R. Dosen 104"
  prodi?: ProgramStudi;
  rombel?: string; // e.g. "TI 1A", "MI 5A" or "TI 1A, TI 3"
  rombels?: string[]; // Array of assigned rombels for multi-rombel support
  phone?: string;
  password?: never;
  excludedScheduleIds?: string[]; // IDs of schedules excluded/dropped to manage SKS limit
  customScheduleIds?: string[];   // Additional schedule IDs explicitly enrolled
}

export interface Course {
  isDemo?: boolean;
  id: string;
  code: string; // e.g. "MKTI0101"
  name: string; // e.g. "Kalkulus"
  sks: number;
  prodi: ProgramStudi;
  semester: number;
  defaultLecturerId: string;
  defaultLecturerName: string;
  description?: string;
  isArchived?: boolean;
  archivedAt?: string;
}

export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export interface ScheduleItem {
  isDemo?: boolean;
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
  meetingDates?: Record<number, string>; // Mapping Pertemuan ke-N -> Tanggal (YYYY-MM-DD)
  isArchived?: boolean;
  archivedAt?: string;
}

export interface Rombel {
  isDemo?: boolean;
  id: string; // e.g. "rombel-ti-1a"
  code: string; // e.g. "TI 1A", "TI 1B", "TI 3", "TI 5", "MI 1A", "MI 1U", "MI 5A"
  name: string; // e.g. "Teknologi Informasi Kelas 1A"
  prodi: ProgramStudi;
  semester: number;
  academicYear?: string; // e.g. "2026/2027 Ganjil"
  description?: string;
  scheduleIds?: string[]; // IDs of connected course schedules
  createdAt?: string;
  isArchived?: boolean;
  archivedAt?: string;
}

export interface Student {
  isDemo?: boolean;
  version?: number;
  nim: string;
  name: string;
  prodi: ProgramStudi;
  rombel: string; // e.g. "TI 1A", "MI 1A", "TI 3", "TI 5", "MI 5A" or "TI 1A, TI 3"
  rombels?: string[]; // Array of rombels: e.g. ["TI 1A", "TI 3"]
  email: string;
  phone?: string;
  password?: never; // Credentials are managed only by the authentication API.
  excludedScheduleIds?: string[]; // IDs of schedules excluded/dropped to manage SKS limit (e.g. <= 20 SKS)
  customScheduleIds?: string[];   // Additional schedule IDs explicitly enrolled
}

export interface AttendanceSession {
  isDemo?: boolean;
  academicPeriod?: string;
  version?: number;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  archiveKind?: string | null;
  isArchived?: boolean;
  reopenedAt?: string | null;
  studentNims?: string[];
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
  evaluationMethod?: string; // Bentuk evaluasi: Kuis, Tugas, Praktikum, dll.
  qrToken: string;
  isDynamicQr: boolean; // if true, refreshes token every N seconds
  qrExpiresAt: string; // ISO string
  isOpen: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  isDemo?: boolean;
  version?: number;
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
  isDemo?: boolean;
  archiveMarker?: 'LEGACY_ARCHIVED_NO_RECIPIENT' | null;
  legacyArchivePolicy?: string | null;
  legacySourceHash?: string | null;
  recipientIds?: string[];
  id: string;
  studentNim: string;
  studentName: string;
  courseCode?: string | null;
  courseName?: string | null;
  rombel: string;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  type: 'IZIN' | 'SAKIT';
  reason: string;
  proofDocumentUrl?: string;
  createdAt: string;
}

export interface DeviceSession {
  id: string; // ID sesi unik
  deviceId: string; // ID unik fingerprint perangkat browser
  sessionToken?: never; // Authentication tokens are never included in device DTOs.
  userId: string; // ID akun pemilik (mhs-..., dosen-..., user-admin-1)
  userUsername: string; // NIM, NIDN, atau username
  userName: string;
  userEmail?: string;
  userRole: Role;
  userAvatarUrl?: string;
  deviceName: string; // e.g. "Google Chrome di Windows 11", "Safari di iPhone"
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  ipSimulated: string;
  locationCity: string;
  loginTimestamp: number;
  lastActiveTimestamp: number;
  status: 'ACTIVE' | 'TERMINATED';
  isCurrentDevice?: boolean;
}

export interface DatabaseBackupData {
  legacyReviewSource?: string;
  users: User[];
  students: Student[];
  courses: Course[];
  schedules: ScheduleItem[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  deviceSessions?: DeviceSession[];
  rombels?: Rombel[];
}

export interface DatabaseBackup {
  version: string;
  timestamp: string;
  appName: string;
  campusName: string;
  semester: string;
  exportedBy: {
    userId?: string;
    userName?: string;
    role?: string;
  };
  summary: {
    totalUsers: number;
    totalStudents: number;
    totalCourses: number;
    totalSchedules: number;
    totalSessions: number;
    totalRecords: number;
    totalLeaveRequests: number;
  };
  data: DatabaseBackupData;
}

export interface DatabaseSnapshot {
  id: string;
  name: string;
  note?: string;
  timestamp: string;
  summary: {
    totalUsers: number;
    totalStudents: number;
    totalCourses: number;
    totalSchedules: number;
    totalSessions: number;
    totalRecords: number;
    totalLeaveRequests: number;
  };
  data: DatabaseBackupData;
}
