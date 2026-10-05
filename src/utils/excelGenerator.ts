import * as XLSX from 'xlsx';
import { CAMPUS_INFO } from '../data/initialData';
import { AttendanceRecord, AttendanceSession, Student } from '../types/attendance';
import { ReportConfig, TeachingLogConfig } from './pdfGenerator';

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

export function generateTeachingLogExcel(
  config: TeachingLogConfig,
  scheduleMeetingDates: Record<number, string> | undefined,
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  totalEnrolledStudents: number
) {
  const formatDateIndo = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const calculateFallbackDate = (dayOfWeek: string, meetingNumber: number): string => {
    const dayOffsets: Record<string, number> = {
      'Senin': 0, 'Selasa': 1, 'Rabu': 2, 'Kamis': 3, 'Jumat': 4, 'Sabtu': 5,
    };
    const offset = dayOffsets[dayOfWeek] ?? 0;
    const baseDate = new Date(2026, 8, 7);
    const target = new Date(baseDate.getTime() + (offset + (meetingNumber - 1) * 7) * 24 * 60 * 60 * 1000);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Metadata Header rows
  const worksheetData: (string | number)[][] = [
    [CAMPUS_INFO.name],
    [CAMPUS_INFO.address],
    ['REKAPAN LOG AKTIVITAS MENGAJAR DOSEN'],
    [`SEMESTER GANJIL TAHUN AKADEMIK ${config.academicYear || '2026/2027'}`],
    [''],
    ['Kode Mata Kuliah', `: ${config.courseCode}`, '', 'Dosen Pengampu', `: ${config.lecturerName}`],
    ['Nama Mata Kuliah', `: ${config.courseName}`, '', 'NIDN Dosen', `: ${config.lecturerNidn || '-'}`],
    ['Bobot SKS / Prodi', `: ${config.sks} SKS (${config.prodi})`, '', 'Kelas / Rombel', `: ${config.rombel}`],
    ['Jadwal Rutin', `: ${config.day}, ${config.timeRange} WIB`, '', 'Ruang Perkuliahan', `: ${config.room}`],
    ['Waktu Unduh', `: ${new Date().toLocaleString('id-ID')}`],
    [''],
  ];

  // Column Headers
  const headerRow = [
    'No',
    'Pertemuan ke-',
    'Tanggal Perkuliahan',
    'Topik Pembahasan',
    'Bentuk Evaluasi',
    'Total Hadir',
    'Total Mahasiswa',
    'Persentase Kehadiran (%)',
  ];
  worksheetData.push(headerRow);

  // 16 Meeting Rows
  for (let m = 1; m <= 16; m++) {
    const isUts = m === 8;
    const isUas = m === 16;
    const ses = sessions.find(s => s.meetingNumber === m);

    let rawDate = ses?.date || (scheduleMeetingDates && scheduleMeetingDates[m]) || '';
    if (!rawDate) {
      rawDate = calculateFallbackDate(config.day, m);
    }
    const formattedDate = formatDateIndo(rawDate);

    let topic = ses?.topic || '';
    if (!topic) {
      if (isUts) topic = 'Ujian Tengah Semester: Evaluasi Komprehensif Materi Pertemuan 1 - 7';
      else if (isUas) topic = 'Ujian Akhir Semester: Evaluasi Akhir Capaian Pembelajaran';
      else topic = `Materi Pertemuan ke-${m}: ${config.courseName}`;
    }

    let evaluation = ses?.evaluationMethod || '';
    if (!evaluation) {
      if (isUts) evaluation = 'Ujian Tengah Semester (UTS)';
      else if (isUas) evaluation = 'Ujian Akhir Semester (UAS)';
      else evaluation = 'Tanya Jawab & Keaktifan di Kelas';
    }

    let hadirCount = 0;
    const total = totalEnrolledStudents > 0 ? totalEnrolledStudents : 20;
    let pct = 0;
    let statusText = 'Terjadwal';

    if (ses) {
      const sRecords = records.filter(r => r.sessionId === ses.id);
      hadirCount = sRecords.filter(r => r.status === 'HADIR').length;
      pct = Math.round((hadirCount / total) * 100);
      statusText = `${pct}%`;
    }

    const meetingLabel = `Pertemuan ${m}${isUts ? ' (UTS)' : isUas ? ' (UAS)' : ''}`;

    worksheetData.push([
      m,
      meetingLabel,
      formattedDate,
      topic,
      evaluation,
      ses ? hadirCount : 0,
      total,
      ses ? `${pct}%` : statusText,
    ]);
  }

  // Signature section rows
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  worksheetData.push(['']);
  worksheetData.push(['', '', '', '', 'Kebumen, ' + todayFormatted]);
  worksheetData.push(['', '', '', '', 'Dosen Pengampu Mata Kuliah,']);
  worksheetData.push(['']);
  worksheetData.push(['']);
  worksheetData.push(['', '', '', '', config.lecturerName]);
  worksheetData.push(['', '', '', '', config.lecturerNidn ? `NIDN. ${config.lecturerNidn}` : 'Dosen Pengampu']);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Column width configuration
  const colWidths = [
    { wch: 6 },  // No
    { wch: 22 }, // Pertemuan
    { wch: 26 }, // Tanggal
    { wch: 50 }, // Topik Pembahasan
    { wch: 35 }, // Bentuk Evaluasi
    { wch: 14 }, // Total Hadir
    { wch: 16 }, // Total Mhs
    { wch: 25 }, // % Kehadiran
  ];
  ws['!cols'] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Log Aktivitas Mengajar');

  // Trigger download
  const fileName = `Log_Aktivitas_Mengajar_${config.courseCode}_${config.rombel.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

