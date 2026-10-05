import * as XLSX from 'xlsx';
import { CAMPUS_INFO } from '../data/initialData';
import { AttendanceRecord, AttendanceSession, Student } from '../types/attendance';
import { ReportConfig } from './pdfGenerator';

export function generateAttendanceExcel(
  config: ReportConfig,
  students: Student[],
  sessions: AttendanceSession[],
  records: AttendanceRecord[]
) {
  const sortedSessions = [...sessions].sort((a, b) => a.meetingNumber - b.meetingNumber);

  // Metadata rows
  const worksheetData: (string | number)[][] = [
    [CAMPUS_INFO.name],
    [CAMPUS_INFO.address],
    ['LAPORAN REKAPITULASI PRESENSI MAHASISWA'],
    [''],
    ['Mata Kuliah', `: ${config.courseName} (${config.courseCode})`, '', 'Dosen Pengampu', `: ${config.lecturerName}`],
    ['Program Studi', `: ${config.prodi}`, '', 'Kelas / Rombel', `: ${config.rombel}`],
    ['Bobot SKS', `: ${config.sks} SKS`, '', 'Semester', `: ${CAMPUS_INFO.semester}`],
    ['Periode', `: ${config.monthName || 'Oktober 2026'}`, '', 'Waktu Unduh', `: ${new Date().toLocaleString('id-ID')}`],
    [''],
  ];

  // Header row
  const sessionHeaders = sortedSessions.map(s => `P${s.meetingNumber} (${s.date})`);
  const headerRow = [
    'No',
    'NIM',
    'Nama Mahasiswa',
    'Rombel',
    ...sessionHeaders,
    'Hadir (H)',
    'Izin (I)',
    'Sakit (S)',
    'Alpha (A)',
    'Total Sesi',
    'Persentase (%)',
  ];
  worksheetData.push(headerRow);

  // Student rows
  students.forEach((student, index) => {
    let hadirCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let alphaCount = 0;

    const sessionCols = sortedSessions.map(session => {
      const rec = records.find(r => r.sessionId === session.id && r.studentNim === student.nim);
      if (!rec) return '-';
      if (rec.status === 'HADIR') {
        hadirCount++;
        return 'H';
      }
      if (rec.status === 'IZIN') {
        izinCount++;
        return 'I';
      }
      if (rec.status === 'SAKIT') {
        sakitCount++;
        return 'S';
      }
      if (rec.status === 'ALPHA') {
        alphaCount++;
        return 'A';
      }
      return '-';
    });

    const totalHeld = sortedSessions.length;
    const percentage = totalHeld > 0 ? Math.round((hadirCount / totalHeld) * 100) : 100;

    worksheetData.push([
      index + 1,
      student.nim,
      student.name,
      student.rombel,
      ...sessionCols,
      hadirCount,
      izinCount,
      sakitCount,
      alphaCount,
      totalHeld,
      `${percentage}%`,
    ]);
  });

  // Summary row
  worksheetData.push(['']);
  worksheetData.push([
    '',
    '',
    'Total Mahasiswa Terdaftar:',
    students.length,
    '',
    '',
    '',
    '',
    'Dosen Pengampu Mata Kuliah:',
    '',
    config.lecturerName
  ]);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Column width configuration
  const colWidths = [
    { wch: 6 },  // No
    { wch: 14 }, // NIM
    { wch: 32 }, // Nama
    { wch: 10 }, // Rombel
    ...sortedSessions.map(() => ({ wch: 14 })), // Sessions
    { wch: 10 }, // H
    { wch: 10 }, // I
    { wch: 10 }, // S
    { wch: 10 }, // A
    { wch: 12 }, // Total Sesi
    { wch: 15 }, // %
  ];
  ws['!cols'] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi');

  // Trigger download
  const fileName = `Rekap_Presensi_${config.courseCode}_${config.rombel.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
