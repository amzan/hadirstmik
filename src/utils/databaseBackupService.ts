import * as XLSX from 'xlsx';
import { CAMPUS_INFO } from '../data/initialData';
import {
  DatabaseBackup,
  DatabaseBackupData,
  DatabaseSnapshot,
  User
} from '../types/attendance';

export const BACKUP_FORMAT_VERSION = '1.0.0';
export const STORAGE_KEY_SNAPSHOTS = 'stmik_db_snapshots_v1';

/**
 * Membuat payload cadangan terstruktur lengkap untuk basis data aplikasi
 */
export function createDatabaseBackupObject(
  data: DatabaseBackupData,
  currentUser?: User
): DatabaseBackup {
  return {
    version: BACKUP_FORMAT_VERSION,
    timestamp: new Date().toISOString(),
    appName: 'Sistem Presensi QR Kampus - STMIK PGRI Arungbinang Kebumen',
    campusName: CAMPUS_INFO.name,
    semester: CAMPUS_INFO.semester,
    exportedBy: {
      userId: currentUser?.id || 'baak-admin',
      userName: currentUser?.name || 'Administrator BAAK',
      role: currentUser?.role || 'admin',
    },
    summary: {
      totalUsers: data.users?.length || 0,
      totalStudents: data.students?.length || 0,
      totalCourses: data.courses?.length || 0,
      totalSchedules: data.schedules?.length || 0,
      totalSessions: data.sessions?.length || 0,
      totalRecords: data.records?.length || 0,
      totalLeaveRequests: data.leaveRequests?.length || 0,
    },
    data: {
      users: data.users || [],
      students: data.students || [],
      courses: data.courses || [],
      schedules: data.schedules || [],
      sessions: data.sessions || [],
      records: data.records || [],
      leaveRequests: data.leaveRequests || [],
    },
  };
}

/**
 * Mengunduh file backup JSON yang kompatibel dengan fitur Restore
 */
export function downloadDatabaseBackupFile(
  data: DatabaseBackupData,
  currentUser?: User
): void {
  const backupObject = createDatabaseBackupObject(data, currentUser);
  const jsonString = JSON.stringify(backupObject, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `backup-database-stmik-kebumen-${dateStr}_${timeStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Mengunduh file Excel multi-sheet berisi seluruh entitas data untuk keperluan audit & arsip
 */
export function downloadDatabaseExcelFile(data: DatabaseBackupData): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Ringkasan Database
  const summaryRows = [
    ['SISTEM PRESENSI QR KAMPUS - ARSIP MASTER DATABASE'],
    [CAMPUS_INFO.name],
    [CAMPUS_INFO.address],
    ['Semester', CAMPUS_INFO.semester],
    ['Waktu Ekspor', new Date().toLocaleString('id-ID')],
    [''],
    ['RINGKASAN ENTITAS BASIS DATA'],
    ['Entitas', 'Jumlah Data'],
    ['Pengguna Sistem (Dosen, BAAK, Mahasiswa)', data.users?.length || 0],
    ['Data Mahasiswa Terdaftar (Rombel)', data.students?.length || 0],
    ['Mata Kuliah Kurikulum', data.courses?.length || 0],
    ['Jadwal Perkuliahan & Tanggal Pertemuan', data.schedules?.length || 0],
    ['Sesi Presensi QR', data.sessions?.length || 0],
    ['Rekapitulasi Riwayat Kehadiran Mahasiswa', data.records?.length || 0],
    ['Pengajuan Izin & Sakit Mahasiswa', data.leaveRequests?.length || 0],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // 2. Sheet Pengguna
  if (data.users && data.users.length > 0) {
    const userRows = data.users.map((u, i) => ({
      No: i + 1,
      ID: u.id,
      Username: u.username,
      Nama: u.name,
      Peran: u.role.toUpperCase(),
      Email: u.email,
      NIDN: u.nidn || '-',
      Gelar: u.title || '-',
      No_HP: u.phone || '-',
      Prodi: u.prodi || '-',
      Rombel: u.rombel || '-',
      Status_Password: u.password ? 'Kustom (Telah Diganti)' : 'Default',
    }));
    const wsUsers = XLSX.utils.json_to_sheet(userRows);
    XLSX.utils.book_append_sheet(wb, wsUsers, 'Pengguna');
  }

  // 3. Sheet Mahasiswa
  if (data.students && data.students.length > 0) {
    const studentRows = data.students.map((s, i) => ({
      No: i + 1,
      NIM: s.nim,
      Nama: s.name,
      Prodi: s.prodi,
      Rombel: s.rombel,
      Email: s.email,
      No_HP: s.phone || '-',
    }));
    const wsStudents = XLSX.utils.json_to_sheet(studentRows);
    XLSX.utils.book_append_sheet(wb, wsStudents, 'Mahasiswa');
  }

  // 4. Sheet Mata Kuliah
  if (data.courses && data.courses.length > 0) {
    const courseRows = data.courses.map((c, i) => ({
      No: i + 1,
      Kode: c.code,
      Nama_Mata_Kuliah: c.name,
      SKS: c.sks,
      Semester: c.semester,
      Prodi: c.prodi,
      Dosen_Pengampu: c.defaultLecturerName,
    }));
    const wsCourses = XLSX.utils.json_to_sheet(courseRows);
    XLSX.utils.book_append_sheet(wb, wsCourses, 'Mata Kuliah');
  }

  // 5. Sheet Jadwal Perkuliahan
  if (data.schedules && data.schedules.length > 0) {
    const scheduleRows = data.schedules.map((sch, i) => {
      const datesList = sch.meetingDates
        ? Object.entries(sch.meetingDates)
            .map(([meet, dt]) => `P${meet}:${dt}`)
            .join(', ')
        : '-';
      return {
        No: i + 1,
        ID_Jadwal: sch.id,
        Hari: sch.day,
        Jam_Mulai: sch.startTime,
        Jam_Selesai: sch.endTime,
        Kode_MK: sch.courseCode,
        Mata_Kuliah: sch.courseName,
        SKS: sch.sks,
        Dosen: sch.lecturerName,
        Ruangan: sch.room,
        Rombel: sch.rombel,
        Prodi: sch.prodi,
        Tanggal_Pertemuan: datesList,
      };
    });
    const wsSchedules = XLSX.utils.json_to_sheet(scheduleRows);
    XLSX.utils.book_append_sheet(wb, wsSchedules, 'Jadwal');
  }

  // 6. Sheet Sesi Presensi
  if (data.sessions && data.sessions.length > 0) {
    const sessionRows = data.sessions.map((ses, i) => ({
      No: i + 1,
      ID_Sesi: ses.id,
      Kode_MK: ses.courseCode,
      Mata_Kuliah: ses.courseName,
      Dosen: ses.lecturerName,
      Rombel: ses.rombel,
      Ruangan: ses.room,
      Tanggal: ses.date,
      Jam: `${ses.startTime} - ${ses.endTime}`,
      Pertemuan_Ke: ses.meetingNumber,
      Topik: ses.topic,
      Status: ses.isOpen ? 'TERBUKA' : 'DITUTUP',
      Waktu_Dibuat: ses.createdAt,
    }));
    const wsSessions = XLSX.utils.json_to_sheet(sessionRows);
    XLSX.utils.book_append_sheet(wb, wsSessions, 'Sesi Presensi');
  }

  // 7. Sheet Rekap Kehadiran
  if (data.records && data.records.length > 0) {
    const recordRows = data.records.map((rec, i) => ({
      No: i + 1,
      ID_Record: rec.id,
      NIM: rec.studentNim,
      Nama_Mahasiswa: rec.studentName,
      Rombel: rec.rombel,
      Kode_MK: rec.courseCode,
      Mata_Kuliah: rec.courseName,
      Status_Kehadiran: rec.status,
      Metode_Verifikasi: rec.verificationMethod,
      Waktu_Scan: rec.scannedAt,
      Catatan: rec.notes || '-',
    }));
    const wsRecords = XLSX.utils.json_to_sheet(recordRows);
    XLSX.utils.book_append_sheet(wb, wsRecords, 'Rekap Kehadiran');
  }

  // 8. Sheet Pengajuan Izin
  if (data.leaveRequests && data.leaveRequests.length > 0) {
    const leaveRows = data.leaveRequests.map((l, i) => ({
      No: i + 1,
      NIM: l.studentNim,
      Nama: l.studentName,
      Kode_MK: l.courseCode,
      Mata_Kuliah: l.courseName,
      Rombel: l.rombel,
      Tanggal: l.date,
      Jenis: l.type,
      Alasan: l.reason,
      Status: l.status,
      Waktu_Pengajuan: l.createdAt,
    }));
    const wsLeave = XLSX.utils.json_to_sheet(leaveRows);
    XLSX.utils.book_append_sheet(wb, wsLeave, 'Izin Sakit');
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `master-database-stmik-kebumen-${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Validasi dan parse isi file JSON cadangan
 */
export function validateAndParseBackupFile(fileContent: string): {
  isValid: boolean;
  error?: string;
  backup?: DatabaseBackup;
} {
  try {
    const parsed = JSON.parse(fileContent);
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'Format JSON tidak valid atau bukan objek.' };
    }

    // Mendukung format berbungkus (DatabaseBackup) maupun format data mentah
    let payloadData: DatabaseBackupData;
    let version = parsed.version || '1.0.0';
    let timestamp = parsed.timestamp || new Date().toISOString();
    let exportedBy = parsed.exportedBy || { userName: 'Administrator BAAK' };

    if (parsed.data && typeof parsed.data === 'object') {
      payloadData = parsed.data;
    } else {
      payloadData = parsed;
    }

    const { users, students, courses, schedules, sessions, records, leaveRequests } = payloadData;

    // Minimal harus memiliki salah satu dari tabel pokok
    const hasCoreData =
      (Array.isArray(users) && users.length > 0) ||
      (Array.isArray(students) && students.length > 0) ||
      (Array.isArray(schedules) && schedules.length > 0) ||
      (Array.isArray(courses) && courses.length > 0);

    if (!hasCoreData) {
      return {
        isValid: false,
        error: 'File cadangan tidak memuat data pokok yang valid (users, students, schedules, atau courses tidak ditemukan).',
      };
    }

    const normalizedBackup: DatabaseBackup = {
      version,
      timestamp,
      appName: parsed.appName || 'Sistem Presensi QR Kampus',
      campusName: parsed.campusName || CAMPUS_INFO.name,
      semester: parsed.semester || CAMPUS_INFO.semester,
      exportedBy,
      summary: {
        totalUsers: Array.isArray(users) ? users.length : 0,
        totalStudents: Array.isArray(students) ? students.length : 0,
        totalCourses: Array.isArray(courses) ? courses.length : 0,
        totalSchedules: Array.isArray(schedules) ? schedules.length : 0,
        totalSessions: Array.isArray(sessions) ? sessions.length : 0,
        totalRecords: Array.isArray(records) ? records.length : 0,
        totalLeaveRequests: Array.isArray(leaveRequests) ? leaveRequests.length : 0,
      },
      data: {
        users: Array.isArray(users) ? users : [],
        students: Array.isArray(students) ? students : [],
        courses: Array.isArray(courses) ? courses : [],
        schedules: Array.isArray(schedules) ? schedules : [],
        sessions: Array.isArray(sessions) ? sessions : [],
        records: Array.isArray(records) ? records : [],
        leaveRequests: Array.isArray(leaveRequests) ? leaveRequests : [],
      },
    };

    return { isValid: true, backup: normalizedBackup };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Gagal membaca file JSON: ${err?.message || 'Sintaks file tidak valid.'}`,
    };
  }
}

/**
 * Hitung perkiraan ukuran penyimpanan database dalam bytes
 */
export function calculateDatabaseSizeEstimate(data: DatabaseBackupData): number {
  try {
    const jsonStr = JSON.stringify(data);
    return new Blob([jsonStr]).size;
  } catch {
    return 0;
  }
}

/**
 * Format bytes ke string yang mudah dibaca (KB / MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ==========================================
// In-Browser Snapshots Storage Management
// ==========================================

export function loadLocalSnapshots(): DatabaseSnapshot[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SNAPSHOTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalSnapshot(
  name: string,
  note: string | undefined,
  data: DatabaseBackupData
): DatabaseSnapshot {
  const snapshots = loadLocalSnapshots();
  const newSnapshot: DatabaseSnapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: name || `Snapshot ${new Date().toLocaleDateString('id-ID')}`,
    note: note || '',
    timestamp: new Date().toISOString(),
    summary: {
      totalUsers: data.users?.length || 0,
      totalStudents: data.students?.length || 0,
      totalCourses: data.courses?.length || 0,
      totalSchedules: data.schedules?.length || 0,
      totalSessions: data.sessions?.length || 0,
      totalRecords: data.records?.length || 0,
      totalLeaveRequests: data.leaveRequests?.length || 0,
    },
    data: {
      users: [...(data.users || [])],
      students: [...(data.students || [])],
      courses: [...(data.courses || [])],
      schedules: [...(data.schedules || [])],
      sessions: [...(data.sessions || [])],
      records: [...(data.records || [])],
      leaveRequests: [...(data.leaveRequests || [])],
    },
  };

  // Simpan maksimal 15 snapshot terbaru
  const updated = [newSnapshot, ...snapshots.slice(0, 14)];
  localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(updated));
  return newSnapshot;
}

export function deleteLocalSnapshot(snapshotId: string): DatabaseSnapshot[] {
  const snapshots = loadLocalSnapshots();
  const updated = snapshots.filter(s => s.id !== snapshotId);
  localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(updated));
  return updated;
}

export function clearAllLocalSnapshots(): void {
  localStorage.removeItem(STORAGE_KEY_SNAPSHOTS);
}
