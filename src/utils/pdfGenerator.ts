import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CAMPUS_INFO } from '../data/initialData';
import { AttendanceRecord, AttendanceSession, Student } from '../types/attendance';
import { getStmikLogoDataUrl } from './logoStmik';

export interface ReportConfig {
  courseCode: string;
  courseName: string;
  lecturerName: string;
  lecturerNidn?: string;
  rombel: string;
  sks: number;
  prodi: string;
  monthName?: string;
  year?: string;
}

export function generateAttendancePDF(
  config: ReportConfig,
  students: Student[],
  sessions: AttendanceSession[],
  records: AttendanceRecord[]
) {
  // Sort sessions by meetingNumber or date
  const sortedSessions = [...sessions].sort((a, b) => a.meetingNumber - b.meetingNumber);
  
  // Create jsPDF instance in landscape for attendance matrices
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // 1. Official Header (Kop Surat Resmi dengan Logo STMIK di sebelah kiri)
  const logoDataUrl = getStmikLogoDataUrl();
  const logoSize = 18; // mm (ukuran proporsional kop surat resmi)
  const logoX = 14;
  const logoY = 8;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch {
      // safe fallback
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 30, 60);
  doc.text('SEKOLAH TINGGI MANAJEMEN INFORMATIKA DAN KOMPUTER (STMIK)', pageWidth / 2 + 5, 13.5, { align: 'center' });
  doc.text('PERSATUAN GURU REPUBLIK INDONESIA (PGRI) ARUNGBINANG KEBUMEN', pageWidth / 2 + 5, 19.5, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(CAMPUS_INFO.address, pageWidth / 2 + 5, 24.5, { align: 'center' });
  
  // Header underline double line
  doc.setLineWidth(0.8);
  doc.setDrawColor(20, 30, 60);
  doc.line(14, 27.5, pageWidth - 14, 27.5);
  doc.setLineWidth(0.3);
  doc.line(14, 28.5, pageWidth - 14, 28.5);

  // 2. Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const title = `DAFTAR REKAPITULASI PRESENSI MAHASISWA`;
  doc.text(title, pageWidth / 2, 36, { align: 'center' });
  doc.setFontSize(10);
  doc.text(CAMPUS_INFO.semester.toUpperCase(), pageWidth / 2, 41, { align: 'center' });

  // 3. Metadata details (2 columns)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  // Left col
  const leftX = 14;
  doc.text(`Program Studi`, leftX, 48);
  doc.text(`: ${config.prodi}`, leftX + 32, 48);
  doc.text(`Mata Kuliah`, leftX, 53);
  doc.text(`: ${config.courseName} (${config.courseCode})`, leftX + 32, 53);
  doc.text(`Bobot SKS`, leftX, 58);
  doc.text(`: ${config.sks} SKS`, leftX + 32, 58);

  // Right col
  const rightX = pageWidth / 2 + 20;
  doc.text(`Dosen Pengampu`, rightX, 48);
  doc.text(`: ${config.lecturerName}`, rightX + 32, 48);
  doc.text(`Kelas / Rombel`, rightX, 53);
  doc.text(`: ${config.rombel}`, rightX + 32, 53);
  doc.text(`Periode Laporan`, rightX, 58);
  doc.text(`: ${config.monthName || 'Oktober 2026'}`, rightX + 32, 58);

  // 4. Construct Table Data
  // Dynamic columns: No, NIM, Nama Mahasiswa, P1, P2, ..., Pn, H, I, S, A, %
  const sessionHeaders = sortedSessions.map(s => `P${s.meetingNumber}`);
  const headRow = [
    'No',
    'NIM',
    'Nama Mahasiswa',
    ...sessionHeaders,
    'H',
    'I',
    'S',
    'A',
    'Total %',
  ];

  const bodyRows = students.map((student, index) => {
    let hadirCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let alphaCount = 0;

    const sessionStatuses = sortedSessions.map(session => {
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

    return [
      (index + 1).toString(),
      student.nim,
      student.name,
      ...sessionStatuses,
      hadirCount.toString(),
      izinCount.toString(),
      sakitCount.toString(),
      alphaCount.toString(),
      `${percentage}%`,
    ];
  });

  // Render Table via autotable
  autoTable(doc, {
    startY: 62,
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 58, 138], // Dark primary indigo/blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' }, // No
      1: { cellWidth: 24, halign: 'center', fontStyle: 'bold' }, // NIM
      2: { cellWidth: 50, halign: 'left' }, // Nama
      // summary columns
      [headRow.length - 5]: { cellWidth: 10, halign: 'center', fontStyle: 'bold', fillColor: [240, 253, 244] }, // H
      [headRow.length - 4]: { cellWidth: 10, halign: 'center', fillColor: [239, 246, 255] }, // I
      [headRow.length - 3]: { cellWidth: 10, halign: 'center', fillColor: [254, 252, 232] }, // S
      [headRow.length - 2]: { cellWidth: 10, halign: 'center', fillColor: [254, 242, 242] }, // A
      [headRow.length - 1]: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }, // %
    },
    didParseCell: (data) => {
      // Color-code the attendance letters
      if (data.section === 'body') {
        const val = data.cell.raw;
        if (val === 'H') {
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'A') {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 226, 226];
        } else if (val === 'I') {
          data.cell.styles.textColor = [29, 78, 216];
        } else if (val === 'S') {
          data.cell.styles.textColor = [180, 83, 9];
        }
      }
    },
  });

  // 5. Signatures block (Lecturer only) - Must strictly appear below the table, never overlap
  const finalY = (doc as any).lastAutoTable.finalY;
  const pageHeight = doc.internal.pageSize.getHeight();
  const requiredSignatureHeight = 44;

  let signatureY = finalY + 3;
  // If not enough space remaining below the table, move signature block to a new page
  if (signatureY + requiredSignatureHeight > pageHeight - 12) {
    doc.addPage();
    signatureY = 25;
  }

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  // Signature: Lecturer (Dosen Pengampu)
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const rightSigX = pageWidth - 90;
  doc.text(`Kebumen, ${todayFormatted}`, rightSigX, signatureY);
  doc.text('Dosen Pengampu Mata Kuliah,', rightSigX, signatureY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(config.lecturerName, rightSigX, signatureY + 28);
  doc.line(rightSigX, signatureY + 29, rightSigX + 65, signatureY + 29);
  doc.setFont('helvetica', 'normal');
  const nidnText = config.lecturerNidn ? `NIDN. ${config.lecturerNidn}` : 'Dosen STMIK PGRI Kebumen';
  doc.text(nidnText, rightSigX, signatureY + 33);

  // Footer stamp & date on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Halaman ${p} dari ${totalPages} · Dicetak otomatis melalui Sistem Presensi QR - STMIK PGRI Arungbinang Kebumen pada ${new Date().toLocaleString('id-ID')}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  // Save the document
  const fileName = `Rekap_Presensi_${config.courseCode}_${config.rombel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(fileName);
}

export interface TeachingLogConfig {
  courseCode: string;
  courseName: string;
  lecturerName: string;
  lecturerNidn?: string;
  rombel: string;
  sks: number;
  prodi: string;
  room: string;
  day: string;
  timeRange: string;
  academicYear?: string;
}

export function generateTeachingLogPDF(
  config: TeachingLogConfig,
  scheduleMeetingDates: Record<number, string> | undefined,
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  totalEnrolledStudents: number
) {
  // Create jsPDF instance in portrait format for teaching log document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Official Letterhead (Kop Surat Resmi dengan Logo STMIK di sebelah kiri)
  const logoDataUrl = getStmikLogoDataUrl();
  const logoSize = 17.5; // mm (ukuran proporsional kop surat resmi portrait)
  const logoX = 14;
  const logoY = 8.5;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch {
      // safe fallback
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 30, 60);
  doc.text('SEKOLAH TINGGI MANAJEMEN INFORMATIKA DAN KOMPUTER (STMIK)', (pageWidth + 14) / 2, 13.5, { align: 'center' });
  doc.text('PERSATUAN GURU REPUBLIK INDONESIA (PGRI) ARUNGBINANG KEBUMEN', (pageWidth + 14) / 2, 18.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(CAMPUS_INFO.address, (pageWidth + 14) / 2, 23.5, { align: 'center' });

  // Double separator line under kop surat
  doc.setLineWidth(0.8);
  doc.setDrawColor(20, 30, 60);
  doc.line(14, 27.5, pageWidth - 14, 27.5);
  doc.setLineWidth(0.3);
  doc.line(14, 28.5, pageWidth - 14, 28.5);

  // 2. Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('REKAPAN LOG AKTIVITAS MENGAJAR DOSEN', pageWidth / 2, 35.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`SEMESTER GANJIL TAHUN AKADEMIK ${config.academicYear || '2026/2027'}`, pageWidth / 2, 40.5, { align: 'center' });

  // 3. Identitas Mata Kuliah (Structured Metadata Box)
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 44, pageWidth - 28, 22, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const col1X = 18;
  const col1ValX = 54;
  const col2X = pageWidth / 2 + 5;
  const col2ValX = col2X + 40;

  // Left column: Kode, Nama MK, Bobot/Prodi
  doc.text('Kode Mata Kuliah', col1X, 49.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${config.courseCode}`, col1ValX, 49.5);
  doc.setFont('helvetica', 'normal');

  doc.text('Nama Mata Kuliah', col1X, 55);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${config.courseName}`, col1ValX, 55);
  doc.setFont('helvetica', 'normal');

  doc.text('Bobot & Prodi', col1X, 60.5);
  doc.text(`: ${config.sks} SKS · ${config.prodi}`, col1ValX, 60.5);

  // Right column: Dosen Pengampu, Kelas/Rombel, Jadwal Rutin
  doc.text('Dosen Pengampu', col2X, 49.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${config.lecturerName}`, col2ValX, 49.5);
  doc.setFont('helvetica', 'normal');

  doc.text('Kelas / Rombel', col2X, 55);
  doc.text(`: ${config.rombel}`, col2ValX, 55);

  doc.text('Jadwal Rutin', col2X, 60.5);
  doc.text(`: ${config.day}, ${config.timeRange} WIB (${config.room})`, col2ValX, 60.5);

  // Helper date formatter
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
    const baseDate = new Date(2026, 8, 7); // Sept 7, 2026
    const target = new Date(baseDate.getTime() + (offset + (meetingNumber - 1) * 7) * 24 * 60 * 60 * 1000);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // 4. Construct Table Rows for 16 Meetings
  const headRow = [
    'Pertemuan ke-',
    'Tanggal Perkuliahan',
    'Topik Pembahasan',
    'Bentuk Evaluasi',
    'Kehadiran (%)',
  ];

  const bodyRows: string[][] = [];

  for (let m = 1; m <= 16; m++) {
    const isUts = m === 8;
    const isUas = m === 16;
    const ses = sessions.find(s => s.meetingNumber === m);

    // Tanggal
    let rawDate = ses?.date || (scheduleMeetingDates && scheduleMeetingDates[m]) || '';
    if (!rawDate) {
      rawDate = calculateFallbackDate(config.day, m);
    }
    const formattedDate = formatDateIndo(rawDate);

    // Topik Pembahasan
    let topic = ses?.topic || '';
    if (!topic) {
      if (isUts) topic = 'Ujian Tengah Semester: Evaluasi Komprehensif Materi Pertemuan 1 - 7';
      else if (isUas) topic = 'Ujian Akhir Semester: Evaluasi Akhir Capaian Pembelajaran';
      else topic = `Materi Pertemuan ke-${m}: ${config.courseName}`;
    }

    // Bentuk Evaluasi
    let evaluation = ses?.evaluationMethod || '';
    if (!evaluation) {
      if (isUts) evaluation = 'Ujian Tengah Semester (UTS)';
      else if (isUas) evaluation = 'Ujian Akhir Semester (UAS)';
      else evaluation = 'Tanya Jawab & Keaktifan di Kelas';
    }

    // Persentase Kehadiran
    let attendanceText = '-';
    if (ses) {
      const sRecords = records.filter(r => r.sessionId === ses.id);
      const hadirCount = sRecords.filter(r => r.status === 'HADIR').length;
      const total = totalEnrolledStudents > 0 ? totalEnrolledStudents : 20;
      const pct = Math.round((hadirCount / total) * 100);
      attendanceText = `${pct}% (${hadirCount}/${total})`;
    } else {
      attendanceText = 'Terjadwal';
    }

    const meetingLabel = `Pertemuan ${m}${isUts ? ' (UTS)' : isUas ? ' (UAS)' : ''}`;

    bodyRows.push([
      meetingLabel,
      formattedDate,
      topic,
      evaluation,
      attendanceText,
    ]);
  }

  // Render Table
  autoTable(doc, {
    startY: 69,
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 62, halign: 'left' },
      3: { cellWidth: 38, halign: 'left' },
      4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Highlight UTS & UAS rows with a subtle tint
      if (data.section === 'body') {
        const rowIndex = data.row.index;
        if (rowIndex === 7 || rowIndex === 15) {
          data.cell.styles.fillColor = [254, 243, 199]; // Light amber
        }
      }
    },
  });

  // 5. Official Signature Block (Dosen Pengampu Mata Kuliah) - Strictly below table, never overlap
  const finalY = (doc as any).lastAutoTable.finalY;
  const requiredSignatureHeight = 44;

  let signatureY = finalY + 3;
  // If not enough room remaining on current page below the table, cleanly push to a new page
  if (signatureY + requiredSignatureHeight > pageHeight - 14) {
    doc.addPage();
    signatureY = 25;
  }

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const rightSigX = pageWidth - 85;

  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.text(`Kebumen, ${todayFormatted}`, rightSigX, signatureY);
  doc.text('Dosen Pengampu Mata Kuliah,', rightSigX, signatureY + 4.5);

  // Digital verification stamp icon/text
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightSigX, signatureY + 7, 58, 12, 1, 1, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TERVERIFIKASI SISTEM AKADEMIK', rightSigX + 4, signatureY + 11.5);
  doc.text('STMIK PGRI ARUNGBINANG', rightSigX + 4, signatureY + 15.5);

  // Lecturer Name and underline
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(config.lecturerName, rightSigX, signatureY + 24);
  doc.setLineWidth(0.4);
  doc.setDrawColor(15, 23, 42);
  doc.line(rightSigX, signatureY + 25, rightSigX + 65, signatureY + 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const nidnText = config.lecturerNidn ? `NIDN. ${config.lecturerNidn}` : 'Dosen Pengampu Mata Kuliah';
  doc.text(nidnText, rightSigX, signatureY + 29);

  // 6. Document Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${p} dari ${totalPages} · Dokumen resmi Rekapan Log Aktivitas Mengajar dicetak melalui Sistem Presensi STMIK PGRI Arungbinang Kebumen pada ${new Date().toLocaleString('id-ID')}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  // Save the document
  const fileName = `Log_Aktivitas_Mengajar_${config.courseCode}_${config.rombel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(fileName);
}

export interface KartuPresensiCourseItem {
  courseCode: string;
  courseName: string;
  sks: number;
  lecturerName: string;
  rombel: string;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  totalHeld: number;
  percentage: number;
  eligibleExam: boolean;
}

export interface KartuPresensiStudentData {
  nim: string;
  name: string;
  prodi: string;
  rombel: string;
  academicYear?: string;
  semester?: string;
  advisorName?: string;
}

/**
 * Generate PDF Kartu Presensi Mahasiswa
 * Berisi ringkasan jumlah kehadiran mahasiswa di semua mata kuliah
 * Dilengkapi dua kotak kosong untuk verifikasi kehadiran saat UTS dan UAS
 */
export function generateKartuPresensiPDF(
  student: KartuPresensiStudentData,
  courses: KartuPresensiCourseItem[],
  overallRate: { totalSessions: number; hadir: number; izin: number; sakit: number; alpha: number; percentage: number }
) {
  // A4 Portrait for official academic cards
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Official Kop Surat Resmi STMIK PGRI Arungbinang Kebumen
  const logoDataUrl = getStmikLogoDataUrl();
  const logoSize = 18;
  const logoX = 14;
  const logoY = 9;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch {
      // safe fallback
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 30, 60);
  doc.text('SEKOLAH TINGGI MANAJEMEN INFORMATIKA DAN KOMPUTER (STMIK)', pageWidth / 2 + 6, 13.5, { align: 'center' });
  doc.text('PERSATUAN GURU REPUBLIK INDONESIA (PGRI) ARUNGBINANG KEBUMEN', pageWidth / 2 + 6, 18.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`${CAMPUS_INFO.address} · Telp: (0287) 381116`, pageWidth / 2 + 6, 23, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Laman Resmi: www.stmik-arungbinang.ac.id · Surel: baak@stmik-arungbinang.ac.id', pageWidth / 2 + 6, 26.5, { align: 'center' });

  // Double line separator under Kop Surat
  doc.setLineWidth(0.8);
  doc.setDrawColor(20, 30, 60);
  doc.line(14, 29.5, pageWidth - 14, 29.5);
  doc.setLineWidth(0.3);
  doc.line(14, 30.5, pageWidth - 14, 30.5);

  // 2. Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(15, 23, 42);
  doc.text('KARTU PRESENSI MAHASISWA', pageWidth / 2, 37, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const semesterTitle = (student.semester || CAMPUS_INFO.semester).toUpperCase();
  doc.text(`${semesterTitle} · TAHUN AKADEMIK ${student.academicYear || '2026/2027'}`, pageWidth / 2, 41.5, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Lembar Verifikasi Persyaratan Mengikuti Ujian Tengah Semester (UTS) & Ujian Akhir Semester (UAS)', pageWidth / 2, 45.5, { align: 'center' });

  // 3. Student Biodata Card (2-column layout with sleek border)
  const biodataY = 48.5;
  const biodataHeight = 19;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, biodataY, pageWidth - 28, biodataHeight, 1.5, 1.5, 'FD');

  const leftBioX = 18;
  const rightBioX = pageWidth / 2 + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  // Left column
  doc.text('Nama Mahasiswa', leftBioX, biodataY + 5);
  doc.text(':', leftBioX + 28, biodataY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(student.name, leftBioX + 31, biodataY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('NIM', leftBioX, biodataY + 10);
  doc.text(':', leftBioX + 28, biodataY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(student.nim, leftBioX + 31, biodataY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Program Studi', leftBioX, biodataY + 15);
  doc.text(':', leftBioX + 28, biodataY + 15);
  doc.setTextColor(15, 23, 42);
  doc.text(student.prodi, leftBioX + 31, biodataY + 15);

  // Right column
  doc.setTextColor(71, 85, 105);
  doc.text('Kelas / Rombel', rightBioX, biodataY + 5);
  doc.text(':', rightBioX + 28, biodataY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(student.rombel, rightBioX + 31, biodataY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Total Mata Kuliah', rightBioX, biodataY + 10);
  doc.text(':', rightBioX + 28, biodataY + 10);
  doc.setTextColor(15, 23, 42);
  const totalSksTaken = courses.reduce((acc, c) => acc + c.sks, 0);
  doc.text(`${courses.length} MK (${totalSksTaken} SKS)`, rightBioX + 31, biodataY + 10);

  doc.setTextColor(71, 85, 105);
  doc.text('Status Kelayakan', rightBioX, biodataY + 15);
  doc.text(':', rightBioX + 28, biodataY + 15);
  if (overallRate.percentage >= 75) {
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'bold');
    doc.text(`MEMENUHI SYARAT (${overallRate.percentage}%)`, rightBioX + 31, biodataY + 15);
  } else {
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.text(`DI BAWAH STANDAR (${overallRate.percentage}%)`, rightBioX + 31, biodataY + 15);
  }

  // 4. Table Ringkasan Jumlah Kehadiran di Semua Mata Kuliah
  const headRow = [
    'No',
    'Kode MK',
    'Mata Kuliah',
    'SKS',
    'Dosen Pengampu',
    'Rombel',
    'H',
    'I',
    'S',
    'A',
    'Total',
    '%',
    'Status Ujian',
  ];

  const bodyRows = courses.map((item, index) => {
    const isEligible = item.percentage >= 75;
    return [
      (index + 1).toString(),
      item.courseCode,
      item.courseName,
      `${item.sks}`,
      item.lecturerName,
      item.rombel,
      item.hadir.toString(),
      item.izin.toString(),
      item.sakit.toString(),
      item.alpha.toString(),
      item.totalHeld.toString(),
      `${item.percentage}%`,
      isEligible ? 'MEMENUHI (>=75%)' : 'BELUM ( <75% )',
    ];
  });

  // Summary footer row
  const totalHadir = courses.reduce((sum, c) => sum + c.hadir, 0);
  const totalIzin = courses.reduce((sum, c) => sum + c.izin, 0);
  const totalSakit = courses.reduce((sum, c) => sum + c.sakit, 0);
  const totalAlpha = courses.reduce((sum, c) => sum + c.alpha, 0);
  const totalAllSessions = courses.reduce((sum, c) => sum + c.totalHeld, 0);

  const footRow = [
    '',
    'TOTAL',
    'Kumulatif Seluruh Mata Kuliah',
    `${totalSksTaken}`,
    '-',
    '-',
    `${totalHadir}`,
    `${totalIzin}`,
    `${totalSakit}`,
    `${totalAlpha}`,
    `${totalAllSessions}`,
    `${overallRate.percentage}%`,
    overallRate.percentage >= 75 ? 'BERHAK UJIAN' : 'EVALUASI BAAK',
  ];

  autoTable(doc, {
    startY: biodataY + biodataHeight + 4,
    head: [headRow],
    body: bodyRows,
    foot: [footRow],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' }, // No
      1: { cellWidth: 19, halign: 'center', fontStyle: 'bold' }, // Kode
      2: { cellWidth: 42, halign: 'left', fontStyle: 'bold' }, // Nama MK
      3: { cellWidth: 9, halign: 'center' }, // SKS
      4: { cellWidth: 32, halign: 'left' }, // Dosen
      5: { cellWidth: 14, halign: 'center' }, // Rombel
      6: { cellWidth: 7.5, halign: 'center', fillColor: [240, 253, 244] }, // H
      7: { cellWidth: 6.5, halign: 'center' }, // I
      8: { cellWidth: 6.5, halign: 'center' }, // S
      9: { cellWidth: 6.5, halign: 'center', fillColor: [254, 242, 242] }, // A
      10: { cellWidth: 9, halign: 'center' }, // Total
      11: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }, // %
      12: { cellWidth: 21, halign: 'center', fontStyle: 'bold' }, // Status Ujian
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        // Highlight status ujian column
        if (data.column.index === 12) {
          const raw = String(data.cell.raw);
          if (raw.includes('MEMENUHI')) {
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [254, 226, 226];
          }
        }
        // Color alpha column
        if (data.column.index === 9 && Number(data.cell.raw) > 0) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // 5. DUA KOTAK KOSONG UNTUK TANDA TANGAN VERIFIKASI KEHADIRAN UTS & UAS
  const finalTableY = (doc as any).lastAutoTable.finalY;
  const verificationBoxHeight = 44; // mm
  const signatureHeight = 32; // mm
  const totalBottomHeight = verificationBoxHeight + signatureHeight + 18;

  let boxStartY = finalTableY + 4;
  // If not enough remaining room on the current page, start clean on next page
  if (boxStartY + totalBottomHeight > pageHeight - 14) {
    doc.addPage();
    boxStartY = 20;
  }

  // Section Header for Verification Boxes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('KOTAK VERIFIKASI KEHADIRAN UJIAN MAHASISWA (UTS & UAS)', 14, boxStartY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('* Wajib ditandatangani oleh Pengawas Ruang Ujian sebagai bukti kehadiran fisik & pemenuhan kuota perkuliahan.', 14, boxStartY + 3.8);

  const boxesY = boxStartY + 5.5;
  const boxWidth = 88;
  const boxHeight = 36;
  const gap = (pageWidth - 28 - (boxWidth * 2)); // spacing between the 2 boxes

  // -------------------------------------------------------------
  // KOTAK 1: VERIFIKASI KEHADIRAN UTS (Ujian Tengah Semester)
  // -------------------------------------------------------------
  const box1X = 14;
  // Outer Box Border
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.4);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(box1X, boxesY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

  // Top Title Bar for Box 1
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(box1X, boxesY, boxWidth, 7, 1.5, 1.5, 'F');
  doc.line(box1X, boxesY + 7, box1X + boxWidth, boxesY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('1. VERIFIKASI KEHADIRAN UTS', box1X + 4, boxesY + 4.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('(Sesi 1 s/d Pertemuan 7/8)', box1X + boxWidth - 4, boxesY + 4.8, { align: 'right' });

  // Inside Box 1: Criteria & Status
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('Syarat Minimal Kehadiran : 75% Pertemuan Efektif', box1X + 4, boxesY + 11);
  doc.text(`Status Kehadiran Sistem    : ${overallRate.percentage >= 75 ? 'MEMENUHI SYARAT UTS' : 'DISPENSASI / EVALUASI'}`, box1X + 4, boxesY + 14.5);

  // EMPTY BOX FOR PHYSICAL SIGNATURE & EXAM STAMP
  const emptyBox1Y = boxesY + 16.5;
  const emptyBox1Height = 13.5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.setFillColor(250, 250, 250);
  doc.rect(box1X + 4, emptyBox1Y, boxWidth - 8, emptyBox1Height, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(160, 174, 192);
  doc.text('[ KOTAK KOSONG TEMPAT TANDA TANGAN / PARAF PENGAWAS UTS ]', box1X + (boxWidth / 2), emptyBox1Y + (emptyBox1Height / 2) + 1.2, { align: 'center' });

  // Signature verification labels at bottom of Box 1
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Tanda Tangan Pengawas: ( ............................................... )', box1X + 4, boxesY + boxHeight - 2.2);

  // -------------------------------------------------------------
  // KOTAK 2: VERIFIKASI KEHADIRAN UAS (Ujian Akhir Semester)
  // -------------------------------------------------------------
  const box2X = box1X + boxWidth + gap;
  // Outer Box Border
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.4);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(box2X, boxesY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

  // Top Title Bar for Box 2
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(box2X, boxesY, boxWidth, 7, 1.5, 1.5, 'F');
  doc.line(box2X, boxesY + 7, box2X + boxWidth, boxesY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. VERIFIKASI KEHADIRAN UAS', box2X + 4, boxesY + 4.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('(Total Seluruh Pertemuan Semester)', box2X + boxWidth - 4, boxesY + 4.8, { align: 'right' });

  // Inside Box 2: Criteria & Status
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('Syarat Minimal Kehadiran : 75% Total Sesi Semester', box2X + 4, boxesY + 11);
  doc.text(`Status Kehadiran Sistem    : ${overallRate.percentage >= 75 ? 'MEMENUHI SYARAT UAS' : 'DISPENSASI / EVALUASI'}`, box2X + 4, boxesY + 14.5);

  // EMPTY BOX FOR PHYSICAL SIGNATURE & EXAM STAMP
  const emptyBox2Y = boxesY + 16.5;
  const emptyBox2Height = 13.5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.setFillColor(250, 250, 250);
  doc.rect(box2X + 4, emptyBox2Y, boxWidth - 8, emptyBox2Height, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(160, 174, 192);
  doc.text('[ KOTAK KOSONG TEMPAT TANDA TANGAN / PARAF PENGAWAS UAS ]', box2X + (boxWidth / 2), emptyBox2Y + (emptyBox2Height / 2) + 1.2, { align: 'center' });

  // Signature verification labels at bottom of Box 2
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Tanda Tangan Pengawas: ( ............................................... )', box2X + 4, boxesY + boxHeight - 2.2);

  // 6. Signatures Section: Mahasiswa & BAAK
  const signatureY = boxesY + boxHeight + 4;
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Left: Mahasiswa
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Kebumen, ${todayFormatted}`, 14, signatureY);
  doc.text('Mahasiswa yang bersangkutan,', 14, signatureY + 4);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(student.name, 14, signatureY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`NIM. ${student.nim}`, 14, signatureY + 23.5);

  // Right: Bagian Administrasi Akademik & Kemahasiswaan (BAAK)
  const rightSigX = pageWidth - 78;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Mengetahui & Memvalidasi,', rightSigX, signatureY);
  doc.text('Bagian Administrasi Akademik (BAAK)', rightSigX, signatureY + 4);

  // Digital verification badge
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightSigX, signatureY + 6.5, 64, 10, 1, 1, 'FD');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DOKUMEN RESMI TERSINKRONISASI', rightSigX + 3.5, signatureY + 10.5);
  doc.text('STMIK PGRI ARUNGBINANG KEBUMEN', rightSigX + 3.5, signatureY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Kepala Biro Administrasi Akademik', rightSigX, signatureY + 20);
  doc.setLineWidth(0.3);
  doc.setDrawColor(15, 23, 42);
  doc.line(rightSigX, signatureY + 21, rightSigX + 60, signatureY + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('NIP. 198205142010121001', rightSigX, signatureY + 24.5);

  // 7. Academic Notes / Notice
  const noteY = signatureY + 27;
  if (noteY + 12 < pageHeight - 8) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, noteY, pageWidth - 28, 10.5, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Ketentuan Penting Penggunaan Kartu Presensi:', 17, noteY + 3.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    doc.text('1. Kartu ini wajib dicetak dan dibawa mahasiswa pada setiap pelaksanaan UTS & UAS untuk diverifikasi oleh Pengawas Ruang Ujian.', 17, noteY + 6.8);
    doc.text('2. Hak mengikuti ujian diberikan bagi mahasiswa dengan persentase kehadiran minimal 75% pada masing-masing mata kuliah yang ditempuh.', 17, noteY + 9.5);
  }

  // 8. Page Numbering & Document Footers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${p} dari ${totalPages} · Dokumen resmi "Kartu Presensi Mahasiswa" dicetak otomatis melalui Portal Presensi STMIK PGRI Arungbinang pada ${new Date().toLocaleString('id-ID')} WIB`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // 9. Save PDF with the exact name requested: "Kartu Presensi Mahasiswa"
  const cleanNim = student.nim.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Kartu_Presensi_Mahasiswa_${cleanNim}.pdf`;
  doc.save(fileName);
}

