import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CAMPUS_INFO } from '../data/initialData';
import { AttendanceRecord, AttendanceSession, Student } from '../types/attendance';

export interface ReportConfig {
  courseCode: string;
  courseName: string;
  lecturerName: string;
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
  
  // 1. Official Header (Kop Surat)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 30, 60);
  doc.text('SEKOLAH TINGGI MANAJEMEN INFORMATIKA DAN KOMPUTER (STMIK)', pageWidth / 2, 14, { align: 'center' });
  doc.text('PERSATUAN GURU REPUBLIK INDONESIA (PGRI) ARUNGBINANG KEBUMEN', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(CAMPUS_INFO.address, pageWidth / 2, 25, { align: 'center' });
  
  // Header underline double line
  doc.setLineWidth(0.8);
  doc.setDrawColor(20, 30, 60);
  doc.line(14, 28, pageWidth - 14, 28);
  doc.setLineWidth(0.3);
  doc.line(14, 29.2, pageWidth - 14, 29.2);

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

  // 5. Signatures block (Lecturer only)
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  const signatureY = finalY > 165 ? 165 : finalY;

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
  doc.text('Dosen STMIK PGRI Kebumen', rightSigX, signatureY + 33);

  // Footer stamp & date
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Dicetak otomatis melalui Sistem Presensi QR - STMIK PGRI Arungbinang Kebumen pada ${new Date().toLocaleString('id-ID')}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 6,
    { align: 'center' }
  );

  // Save the document
  const fileName = `Rekap_Presensi_${config.courseCode}_${config.rombel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(fileName);
}
