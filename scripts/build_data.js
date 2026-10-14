const fs = require('fs');
const path = require('path');

// Raw user backup data from user prompt
const rawDataPath = path.join(__dirname, 'raw_backup.json');
const rawBackup = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));

// Apply the EXCEPTION for Algoritma dan Pemrograman:
// "tapi kecualikan database matakuliah algoritma pemrograman, karena itu sudah milik Ammar Fauzan, bukan milik Bu Fitri."

// 1. Courses Exception
const sanitizedCourses = rawBackup.data.courses.map(c => {
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

// 2. Schedules Exception:
// Any schedule of Algoritma dan Pemrograman should be on Rabu at 18.00 WIB (18:00 - 19:40, 2 SKS) for Ammar Fauzan
const sanitizedSchedules = [];

for (const s of rawBackup.data.schedules) {
  if (s.courseCode === 'MKMI0105' || s.courseName.toLowerCase().includes('algoritma dan pemrograman')) {
    if (s.id.includes('ti') || s.rombel.includes('TI')) {
      sanitizedSchedules.push({
        id: 'sch-ti-rabu-4',
        day: 'Rabu',
        startTime: '18:00',
        endTime: '19:40',
        courseCode: 'MKMI0105',
        courseName: 'Algoritma dan Pemrograman',
        sks: 2,
        lecturerId: 'dosen-10',
        lecturerName: 'Ammar Fauzan, S.Pd., M.Kom.',
        room: 'Lab Komputer',
        rombel: 'TI 1 & 5',
        prodi: 'Teknologi Informasi',
        meetingDates: s.meetingDates || undefined,
      });
    } else {
      sanitizedSchedules.push({
        id: 'sch-mi-rabu-5',
        day: 'Rabu',
        startTime: '18:00',
        endTime: '19:40',
        courseCode: 'MKMI0105',
        courseName: 'Algoritma dan Pemrograman',
        sks: 2,
        lecturerId: 'dosen-10',
        lecturerName: 'Ammar Fauzan, S.Pd., M.Kom.',
        room: 'Lab Komputer 2',
        rombel: 'MI 1U',
        prodi: 'Manajemen Informatika',
        meetingDates: s.meetingDates || undefined,
      });
    }
  } else if (s.id === 'sch-ti-rabu-3') {
    // Make sure Sistem Operasi ends at 17:40 before 18:00
    sanitizedSchedules.push({
      ...s,
      startTime: '16:00',
      endTime: '17:40',
    });
  } else {
    sanitizedSchedules.push(s);
  }
}

// 3. Construct updated initialData.ts
const codeContent = `import { Course, ScheduleItem, Student, User, AttendanceSession, AttendanceRecord, LeaveRequest } from '../types/attendance';

export const CAMPUS_INFO = {
  name: 'STMIK PERSATUAN GURU REPUBLIK INDONESIA (PGRI) ARUNGBINANG KEBUMEN',
  shortName: 'STMIK PGRI Arungbinang Kebumen',
  address: 'Jl. Cendrawasih No.27A Tamanwinangun Telp. 386630 Kebumen 54313',
  semester: 'Semester Ganjil 2026/2027',
  wakilKetua1: 'Nur Wasito, S.Pd., M.Pd.',
  dosenWaliTI: 'Agus Jaka Sri Hartanta, S.Pd., M.Kom.',
  dosenWaliMI: 'Fitriani Dwi Ratna Sari, S.T., M.M.',
};

export const INITIAL_USERS: User[] = ${JSON.stringify(rawBackup.data.users, null, 2)};

export const INITIAL_STUDENTS: Student[] = ${JSON.stringify(rawBackup.data.students, null, 2)};

export const INITIAL_COURSES: Course[] = ${JSON.stringify(sanitizedCourses, null, 2)};

export const INITIAL_SCHEDULES: ScheduleItem[] = ${JSON.stringify(sanitizedSchedules, null, 2)};

export const INITIAL_SESSIONS: AttendanceSession[] = ${JSON.stringify(rawBackup.data.sessions, null, 2)};

export const INITIAL_RECORDS: AttendanceRecord[] = ${JSON.stringify(rawBackup.data.records, null, 2)};

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = ${JSON.stringify(rawBackup.data.leaveRequests, null, 2)};

// Helper to determine whether a student belongs to a schedule's rombel
export function isStudentInRombel(studentRombel: string, scheduleRombel: string): boolean {
  if (!studentRombel || !scheduleRombel) return false;
  const sRombel = studentRombel.trim().toUpperCase();
  const schRombel = scheduleRombel.trim().toUpperCase();
  if (sRombel === schRombel) return true;
  if (schRombel.includes('&')) {
    const parts = schRombel.split('&').map(p => p.trim());
    return parts.some(p => sRombel.startsWith(p) || sRombel === p);
  }
  if (sRombel.startsWith(schRombel) || schRombel.startsWith(sRombel)) {
    return true;
  }
  return false;
}
`;

fs.writeFileSync(path.join(__dirname, '../src/data/initialData.ts'), codeContent, 'utf8');

// Also save sanitized master backup JSON for direct reference/download
const updatedBackup = {
  ...rawBackup,
  timestamp: new Date().toISOString(),
  data: {
    ...rawBackup.data,
    courses: sanitizedCourses,
    schedules: sanitizedSchedules,
  }
};
fs.writeFileSync(path.join(__dirname, '../src/data/master_database_backup.json'), JSON.stringify(updatedBackup, null, 2), 'utf8');

console.log('Successfully generated initialData.ts and master_database_backup.json');
