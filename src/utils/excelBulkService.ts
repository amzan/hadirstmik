import * as XLSX from 'xlsx';
import { Course, DayOfWeek, ProgramStudi, Role, ScheduleItem, Student, User } from '../types/attendance';

export type ImportCategory = 'all' | 'schedules' | 'users' | 'students' | 'courses';
export type ImportMode = 'merge' | 'replace';

export interface ParseResult<T> {
  valid: T[];
  errors: { row: number; item?: any; reason: string }[];
  totalRows: number;
}

export interface MultiSheetImportResult {
  schedules?: ParseResult<ScheduleItem>;
  users?: ParseResult<User>;
  students?: ParseResult<Student>;
  courses?: ParseResult<Course>;
}

// ==========================================
// TEMPLATE GENERATORS
// ==========================================

export function downloadScheduleTemplate(): void {
  const wb = XLSX.utils.book_new();
  const sampleData = [
    {
      'Hari': 'Senin',
      'Jam Mulai': '08:00',
      'Jam Selesai': '09:40',
      'Kode MK': 'MKTI0101',
      'Nama Mata Kuliah': 'Kalkulus I',
      'SKS': 2,
      'Nama Dosen': 'Mucharobin, S.Pd.I., M.Pd.',
      'NIDN / Username Dosen': '197805122005011001',
      'Ruangan': 'RK 1',
      'Rombel / Kelas': 'TI 1A',
      'Program Studi': 'Teknologi Informasi',
      'Tanggal Pertemuan (Opsional, Format: P1:YYYY-MM-DD, P2:...)': 'P1:2026-10-05, P2:2026-10-12',
    },
    {
      'Hari': 'Selasa',
      'Jam Mulai': '10:00',
      'Jam Selesai': '11:40',
      'Kode MK': 'MKMI0102',
      'Nama Mata Kuliah': 'Pengantar Basis Data',
      'SKS': 3,
      'Nama Dosen': 'Ahirul Hasanah, S.Pd.I., M.M.',
      'NIDN / Username Dosen': '198203152008012002',
      'Ruangan': 'LAB 1',
      'Rombel / Kelas': 'MI 1A',
      'Program Studi': 'Manajemen Informatika',
      'Tanggal Pertemuan (Opsional, Format: P1:YYYY-MM-DD, P2:...)': 'P1:2026-10-06, P2:2026-10-13',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 25 }, { wch: 6 }, { wch: 30 }, { wch: 22 },
    { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Jadwal Kuliah');
  XLSX.writeFile(wb, 'template_import_jadwal_perkuliahan.xlsx');
}

export function downloadUserTemplate(): void {
  const wb = XLSX.utils.book_new();
  const sampleData = [
    {
      'Username (NIDN / NIM / ID)': '198501012010011005',
      'Nama Lengkap & Gelar': 'Dr. Hendra Wijaya, S.Kom., M.T.',
      'Peran (dosen / mahasiswa / admin)': 'dosen',
      'Email': 'hendra.wijaya@stmik-arungbinang.ac.id',
      'NIDN': '198501012010011005',
      'Gelar / Jabatan': 'Lektor',
      'Program Studi': 'Teknologi Informasi',
      'Rombel': '',
      'No Handphone': '081299887766',
      'Ruang Kantor': 'Gedung A Lt. 2 R. 204',
      'Password Awal (Opsional)': 'dosen123',
    },
    {
      'Username (NIDN / NIM / ID)': '26TI0055',
      'Nama Lengkap & Gelar': 'Rizky Pratama',
      'Peran (dosen / mahasiswa / admin)': 'mahasiswa',
      'Email': 'rizky.pratama@mhs.stmik-arungbinang.ac.id',
      'NIDN': '',
      'Gelar / Jabatan': '',
      'Program Studi': 'Teknologi Informasi',
      'Rombel': 'TI 1A',
      'No Handphone': '085711223344',
      'Ruang Kantor': '',
      'Password Awal (Opsional)': 'pass123',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 30 },
    { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 12 },
    { wch: 16 }, { wch: 20 }, { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Pengguna');
  XLSX.writeFile(wb, 'template_import_pengguna.xlsx');
}

export function downloadStudentTemplate(): void {
  const wb = XLSX.utils.book_new();
  const sampleData = [
    {
      'NIM': '26TI0051',
      'Nama Mahasiswa': 'Aditya Nugraha',
      'Program Studi': 'Teknologi Informasi',
      'Rombel / Kelas': 'TI 1A',
      'Email': 'aditya.nugraha@mhs.stmik-arungbinang.ac.id',
      'No Handphone / WA': '081234567891',
    },
    {
      'NIM': '26MI0052',
      'Nama Mahasiswa': 'Bella Safitri',
      'Program Studi': 'Manajemen Informatika',
      'Rombel / Kelas': 'MI 1A',
      'Email': 'bella.safitri@mhs.stmik-arungbinang.ac.id',
      'No Handphone / WA': '081234567892',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 15 }, { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 32 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Mahasiswa Rombel');
  XLSX.writeFile(wb, 'template_import_mahasiswa_rombel.xlsx');
}

export function downloadCourseTemplate(): void {
  const wb = XLSX.utils.book_new();
  const sampleData = [
    {
      'Kode MK': 'MKTI0201',
      'Nama Mata Kuliah': 'Struktur Data & Algoritma',
      'SKS': 3,
      'Semester': 2,
      'Program Studi': 'Teknologi Informasi',
      'Nama Dosen Pengampu': 'Nur Wasito, S.Pd., M.Pd.',
      'ID / NIDN Dosen': '197508202003011003',
    },
    {
      'Kode MK': 'MKMI0202',
      'Nama Mata Kuliah': 'Sistem Informasi Manajemen',
      'SKS': 3,
      'Semester': 2,
      'Program Studi': 'Manajemen Informatika',
      'Nama Dosen Pengampu': 'Ahirul Hasanah, S.Pd.I., M.M.',
      'ID / NIDN Dosen': '198203152008012002',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 14 }, { wch: 32 }, { wch: 8 }, { wch: 10 }, { wch: 24 }, { wch: 30 }, { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Mata Kuliah');
  XLSX.writeFile(wb, 'template_import_master_mata_kuliah.xlsx');
}

export function downloadAllInOneTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Jadwal
  const sampleSchedules = [
    {
      'Hari': 'Senin',
      'Jam Mulai': '08:00',
      'Jam Selesai': '09:40',
      'Kode MK': 'MKTI0101',
      'Nama Mata Kuliah': 'Kalkulus I',
      'SKS': 2,
      'Nama Dosen': 'Mucharobin, S.Pd.I., M.Pd.',
      'NIDN / Username Dosen': '197805122005011001',
      'Ruangan': 'RK 1',
      'Rombel / Kelas': 'TI 1A',
      'Program Studi': 'Teknologi Informasi',
    },
  ];
  const wsSchedules = XLSX.utils.json_to_sheet(sampleSchedules);
  XLSX.utils.book_append_sheet(wb, wsSchedules, 'Jadwal Kuliah');

  // Sheet 2: Pengguna
  const sampleUsers = [
    {
      'Username (NIDN / NIM / ID)': '198501012010011005',
      'Nama Lengkap & Gelar': 'Dr. Hendra Wijaya, S.Kom., M.T.',
      'Peran (dosen / mahasiswa / admin)': 'dosen',
      'Email': 'hendra.wijaya@stmik-arungbinang.ac.id',
      'NIDN': '198501012010011005',
      'Gelar / Jabatan': 'Lektor',
      'Program Studi': 'Teknologi Informasi',
      'Rombel': '',
      'No Handphone': '081299887766',
    },
  ];
  const wsUsers = XLSX.utils.json_to_sheet(sampleUsers);
  XLSX.utils.book_append_sheet(wb, wsUsers, 'Pengguna');

  // Sheet 3: Mahasiswa
  const sampleStudents = [
    {
      'NIM': '26TI0051',
      'Nama Mahasiswa': 'Aditya Nugraha',
      'Program Studi': 'Teknologi Informasi',
      'Rombel / Kelas': 'TI 1A',
      'Email': 'aditya.nugraha@mhs.stmik-arungbinang.ac.id',
      'No Handphone / WA': '081234567891',
    },
  ];
  const wsStudents = XLSX.utils.json_to_sheet(sampleStudents);
  XLSX.utils.book_append_sheet(wb, wsStudents, 'Mahasiswa Rombel');

  // Sheet 4: Mata Kuliah
  const sampleCourses = [
    {
      'Kode MK': 'MKTI0201',
      'Nama Mata Kuliah': 'Struktur Data & Algoritma',
      'SKS': 3,
      'Semester': 2,
      'Program Studi': 'Teknologi Informasi',
      'Nama Dosen Pengampu': 'Nur Wasito, S.Pd., M.Pd.',
      'ID / NIDN Dosen': '197508202003011003',
    },
  ];
  const wsCourses = XLSX.utils.json_to_sheet(sampleCourses);
  XLSX.utils.book_append_sheet(wb, wsCourses, 'Mata Kuliah');

  XLSX.writeFile(wb, 'template_master_akademik_lengkap.xlsx');
}

// ==========================================
// PARSING & VALIDATION UTILITIES
// ==========================================

function getNormalizedVal(row: any, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  // Try case-insensitive matching
  const rowKeys = Object.keys(row);
  for (const targetKey of keys) {
    const matched = rowKeys.find(rk => rk.trim().toLowerCase() === targetKey.trim().toLowerCase());
    if (matched && row[matched] !== undefined && row[matched] !== null && String(row[matched]).trim() !== '') {
      return String(row[matched]).trim();
    }
  }
  return '';
}

function normalizeProdi(input: string): ProgramStudi {
  const lower = input.toLowerCase();
  if (lower.includes('manajemen') || lower.includes('mi')) {
    return 'Manajemen Informatika';
  }
  return 'Teknologi Informasi';
}

function normalizeDay(input: string): DayOfWeek {
  const days: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const matched = days.find(d => d.toLowerCase() === input.toLowerCase());
  return matched || 'Senin';
}

function parseMeetingDates(str: string): Record<number, string> | undefined {
  if (!str) return undefined;
  const result: Record<number, string> = {};
  // e.g. "P1:2026-10-05, P2:2026-10-12" or "1:2026-10-05; 2:2026-10-12"
  const parts = str.split(/[,;\n]/);
  for (const part of parts) {
    const match = part.trim().match(/P?(\d+)\s*[:=]\s*(\d{4}-\d{2}-\d{2})/i);
    if (match) {
      const meetNum = parseInt(match[1], 10);
      const dateVal = match[2];
      if (meetNum >= 1 && meetNum <= 16) {
        result[meetNum] = dateVal;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parse Jadwal Perkuliahan from Excel sheet rows
 */
export function parseSchedulesFromRows(rows: any[], existingLecturers: User[]): ParseResult<ScheduleItem> {
  const valid: ScheduleItem[] = [];
  const errors: { row: number; item?: any; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1
    const dayStr = getNormalizedVal(row, ['Hari', 'Hari Kuliah', 'Day']);
    const startTime = getNormalizedVal(row, ['Jam Mulai', 'Mulai', 'StartTime', 'Start']);
    const endTime = getNormalizedVal(row, ['Jam Selesai', 'Selesai', 'EndTime', 'End']);
    const courseCode = getNormalizedVal(row, ['Kode MK', 'Kode', 'CourseCode', 'Kode Mata Kuliah']);
    const courseName = getNormalizedVal(row, ['Nama Mata Kuliah', 'Mata Kuliah', 'CourseName', 'Matakuliah']);
    const sksRaw = getNormalizedVal(row, ['SKS', 'Bobot SKS']);
    const lecturerName = getNormalizedVal(row, ['Nama Dosen', 'Dosen', 'Lecturer', 'Dosen Pengampu']);
    const lecturerIdOrNidn = getNormalizedVal(row, ['NIDN / Username Dosen', 'NIDN', 'ID Dosen', 'Username Dosen']);
    const room = getNormalizedVal(row, ['Ruangan', 'Ruang', 'Room']);
    const rombel = getNormalizedVal(row, ['Rombel / Kelas', 'Rombel', 'Kelas']);
    const prodiRaw = getNormalizedVal(row, ['Program Studi', 'Prodi']);
    const meetingDatesRaw = getNormalizedVal(row, ['Tanggal Pertemuan', 'Meeting Dates', 'Tanggal Pertemuan (Opsional, Format: P1:YYYY-MM-DD, P2:...)']);

    if (!courseName || !courseCode) {
      errors.push({ row: rowNum, item: row, reason: 'Nama Mata Kuliah dan Kode MK wajib diisi.' });
      return;
    }

    if (!startTime || !endTime) {
      errors.push({ row: rowNum, item: row, reason: 'Jam Mulai dan Jam Selesai wajib diisi (format HH:mm).' });
      return;
    }

    if (!lecturerName) {
      errors.push({ row: rowNum, item: row, reason: 'Nama Dosen Pengampu wajib diisi.' });
      return;
    }

    // Resolve or generate lecturerId
    let lecturerId = lecturerIdOrNidn;
    if (!lecturerId) {
      const foundLecturer = existingLecturers.find(l =>
        l.role === 'dosen' && l.name.toLowerCase().includes(lecturerName.toLowerCase())
      );
      lecturerId = foundLecturer?.id || `dosen-${Math.random().toString(36).substr(2, 6)}`;
    }

    const sks = parseInt(sksRaw, 10) || 2;
    const day = normalizeDay(dayStr);
    const prodi = normalizeProdi(prodiRaw || rombel);
    const meetingDates = parseMeetingDates(meetingDatesRaw);

    const scheduleItem: ScheduleItem = {
      id: `sch-${courseCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${rombel.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36).slice(-4)}-${idx}`,
      day,
      startTime: startTime.padStart(5, '0'),
      endTime: endTime.padStart(5, '0'),
      courseCode: courseCode.toUpperCase(),
      courseName,
      sks,
      lecturerId,
      lecturerName,
      room: room || 'RK 1',
      rombel: rombel || 'TI 1A',
      prodi,
      ...(meetingDates ? { meetingDates } : {}),
    };

    valid.push(scheduleItem);
  });

  return { valid, errors, totalRows: rows.length };
}

/**
 * Parse Pengguna from Excel sheet rows
 */
export function parseUsersFromRows(rows: any[]): ParseResult<User> {
  const valid: User[] = [];
  const errors: { row: number; item?: any; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const username = getNormalizedVal(row, ['Username (NIDN / NIM / ID)', 'Username', 'NIDN / NIM', 'ID']);
    const name = getNormalizedVal(row, ['Nama Lengkap & Gelar', 'Nama Lengkap', 'Nama', 'Name']);
    const roleRaw = getNormalizedVal(row, ['Peran (dosen / mahasiswa / admin)', 'Peran', 'Role']).toLowerCase();
    const email = getNormalizedVal(row, ['Email', 'Alamat Email']);
    const nidn = getNormalizedVal(row, ['NIDN']);
    const title = getNormalizedVal(row, ['Gelar / Jabatan', 'Gelar', 'Jabatan', 'Title']);
    const prodiRaw = getNormalizedVal(row, ['Program Studi', 'Prodi']);
    const rombel = getNormalizedVal(row, ['Rombel', 'Kelas']);
    const phone = getNormalizedVal(row, ['No Handphone', 'No HP', 'Phone', 'WhatsApp']);
    const officeRoom = getNormalizedVal(row, ['Ruang Kantor', 'Office']);
    const password = getNormalizedVal(row, ['Password Awal (Opsional)', 'Password']);

    if (!username || !name) {
      errors.push({ row: rowNum, item: row, reason: 'Username (NIDN/NIM) dan Nama Lengkap wajib diisi.' });
      return;
    }

    let role: Role = 'dosen';
    if (roleRaw.includes('mhs') || roleRaw.includes('mahasiswa')) {
      role = 'mahasiswa';
    } else if (roleRaw.includes('admin') || roleRaw.includes('baak')) {
      role = 'admin';
    }

    const prodi = prodiRaw ? normalizeProdi(prodiRaw) : undefined;
    const defaultEmail = email || `${username.toLowerCase()}@${role === 'mahasiswa' ? 'mhs.' : ''}stmik-arungbinang.ac.id`;

    const userItem: User = {
      id: `user-${role}-${username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      username,
      name,
      email: defaultEmail,
      role,
      nidn: nidn || (role === 'dosen' ? username : undefined),
      title: title || undefined,
      prodi,
      rombel: rombel || undefined,
      phone: phone || undefined,
      officeRoom: officeRoom || undefined,
      password: password || undefined,
      avatarUrl: role === 'dosen'
        ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
        : role === 'admin'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    };

    valid.push(userItem);
  });

  return { valid, errors, totalRows: rows.length };
}

/**
 * Parse Mahasiswa from Excel sheet rows
 */
export function parseStudentsFromRows(rows: any[]): ParseResult<Student> {
  const valid: Student[] = [];
  const errors: { row: number; item?: any; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const nim = getNormalizedVal(row, ['NIM', 'Nomor Induk Mahasiswa', 'NIM Mahasiswa']);
    const name = getNormalizedVal(row, ['Nama Mahasiswa', 'Nama', 'Nama Lengkap']);
    const prodiRaw = getNormalizedVal(row, ['Program Studi', 'Prodi']);
    const rombel = getNormalizedVal(row, ['Rombel / Kelas', 'Rombel', 'Kelas']);
    const email = getNormalizedVal(row, ['Email', 'Alamat Email']);
    const phone = getNormalizedVal(row, ['No Handphone / WA', 'No Handphone', 'No HP', 'Phone']);

    if (!nim || !name) {
      errors.push({ row: rowNum, item: row, reason: 'NIM dan Nama Mahasiswa wajib diisi.' });
      return;
    }

    const prodi = normalizeProdi(prodiRaw || rombel);
    const cleanNim = nim.toUpperCase();
    const defaultEmail = email || `${cleanNim.toLowerCase()}@mhs.stmik-arungbinang.ac.id`;

    const studentItem: Student = {
      nim: cleanNim,
      name,
      prodi,
      rombel: rombel || (prodi === 'Teknologi Informasi' ? 'TI 1A' : 'MI 1A'),
      email: defaultEmail,
      phone: phone || undefined,
    };

    valid.push(studentItem);
  });

  return { valid, errors, totalRows: rows.length };
}

/**
 * Parse Master Mata Kuliah from Excel sheet rows
 */
export function parseCoursesFromRows(rows: any[], existingLecturers: User[]): ParseResult<Course> {
  const valid: Course[] = [];
  const errors: { row: number; item?: any; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const code = getNormalizedVal(row, ['Kode MK', 'Kode', 'CourseCode', 'Kode Mata Kuliah']);
    const name = getNormalizedVal(row, ['Nama Mata Kuliah', 'Mata Kuliah', 'CourseName']);
    const sksRaw = getNormalizedVal(row, ['SKS', 'Bobot SKS']);
    const semesterRaw = getNormalizedVal(row, ['Semester']);
    const prodiRaw = getNormalizedVal(row, ['Program Studi', 'Prodi']);
    const lecturerName = getNormalizedVal(row, ['Nama Dosen Pengampu', 'Dosen Pengampu', 'Dosen']);
    const lecturerIdRaw = getNormalizedVal(row, ['ID / NIDN Dosen', 'ID Dosen', 'NIDN Dosen']);

    if (!code || !name) {
      errors.push({ row: rowNum, item: row, reason: 'Kode MK dan Nama Mata Kuliah wajib diisi.' });
      return;
    }

    const sks = parseInt(sksRaw, 10) || 2;
    const semester = parseInt(semesterRaw, 10) || 1;
    const prodi = normalizeProdi(prodiRaw || (code.toUpperCase().includes('MI') ? 'Manajemen Informatika' : 'Teknologi Informasi'));

    let defaultLecturerName = lecturerName || 'Dosen Pengampu';
    let defaultLecturerId = lecturerIdRaw;
    if (!defaultLecturerId) {
      const found = existingLecturers.find(l => l.role === 'dosen' && l.name.toLowerCase().includes(defaultLecturerName.toLowerCase()));
      defaultLecturerId = found?.id || 'dosen-1';
    }

    const courseItem: Course = {
      id: `course-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      code: code.toUpperCase(),
      name,
      sks,
      semester,
      prodi,
      defaultLecturerId,
      defaultLecturerName,
    };

    valid.push(courseItem);
  });

  return { valid, errors, totalRows: rows.length };
}

/**
 * Parse an entire uploaded Excel file (single sheet or multi-sheet)
 */
export async function parseExcelWorkbook(
  file: File,
  existingLecturers: User[],
  forcedCategory?: ImportCategory
): Promise<MultiSheetImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetNames = wb.SheetNames;

  const result: MultiSheetImportResult = {};

  // If forced to a specific single category
  if (forcedCategory && forcedCategory !== 'all') {
    const firstSheet = wb.Sheets[sheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet);

    if (forcedCategory === 'schedules') {
      result.schedules = parseSchedulesFromRows(rows, existingLecturers);
    } else if (forcedCategory === 'users') {
      result.users = parseUsersFromRows(rows);
    } else if (forcedCategory === 'students') {
      result.students = parseStudentsFromRows(rows);
    } else if (forcedCategory === 'courses') {
      result.courses = parseCoursesFromRows(rows, existingLecturers);
    }
    return result;
  }

  // Automatic multi-sheet detection
  for (const sheetName of sheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const lowerName = sheetName.toLowerCase();

    if (lowerName.includes('jadwal') || lowerName.includes('schedule')) {
      result.schedules = parseSchedulesFromRows(rows, existingLecturers);
    } else if (lowerName.includes('pengguna') || lowerName.includes('user') || lowerName.includes('dosen')) {
      result.users = parseUsersFromRows(rows);
    } else if (lowerName.includes('mahasiswa') || lowerName.includes('rombel') || lowerName.includes('student')) {
      result.students = parseStudentsFromRows(rows);
    } else if (lowerName.includes('mata kuliah') || lowerName.includes('course') || lowerName.includes('matakuliah')) {
      result.courses = parseCoursesFromRows(rows, existingLecturers);
    }
  }

  // If none matched by sheet name, analyze first sheet columns
  if (!result.schedules && !result.users && !result.students && !result.courses && sheetNames.length > 0) {
    const firstSheet = wb.Sheets[sheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet);
    if (rows.length > 0) {
      const firstRow = rows[0] as any;
      const keys = Object.keys(firstRow).map(k => k.toLowerCase());

      if (keys.some(k => k.includes('jam') || k.includes('hari') || k.includes('ruang'))) {
        result.schedules = parseSchedulesFromRows(rows, existingLecturers);
      } else if (keys.some(k => k.includes('nim') && !k.includes('dosen'))) {
        result.students = parseStudentsFromRows(rows);
      } else if (keys.some(k => k.includes('sks') && k.includes('semester'))) {
        result.courses = parseCoursesFromRows(rows, existingLecturers);
      } else {
        result.users = parseUsersFromRows(rows);
      }
    }
  }

  return result;
}
