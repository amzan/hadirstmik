import React, { useState, useEffect } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { generateAttendancePDF, ReportConfig } from '../../utils/pdfGenerator';
import { generateAttendanceExcel } from '../../utils/excelGenerator';
import { X, FileText, FileSpreadsheet, ShieldCheck } from 'lucide-react';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCourseCode?: string;
  defaultRombel?: string;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  defaultCourseCode,
  defaultRombel,
}) => {
  const { courses, schedules, sessions, records, currentUser, getStudentsForRombel } = useAttendance();

  const isDosen = currentUser.role === 'dosen';

  // Strict scope: Lecturer only has access to their assigned teaching schedules
  const mySchedules = schedules.filter(
    s => s.lecturerId === currentUser.id || s.lecturerName.includes(currentUser.name)
  );

  // If lecturer, ONLY allow courses taught by this lecturer
  const allowedCourses = isDosen
    ? courses.filter(c => mySchedules.some(sch => sch.courseCode === c.code))
    : courses;

  const safeAllowedCourses = allowedCourses.length > 0 ? allowedCourses : courses;

  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(
    defaultCourseCode && safeAllowedCourses.some(c => c.code === defaultCourseCode)
      ? defaultCourseCode
      : safeAllowedCourses[0]?.code || 'MKTI0109'
  );

  // Compute available rombels specifically for the selected course taught by this lecturer
  const availableRombels = isDosen
    ? Array.from(new Set(mySchedules.filter(sch => sch.courseCode === selectedCourseCode).map(sch => sch.rombel)))
    : Array.from(new Set(schedules.filter(sch => sch.courseCode === selectedCourseCode).map(sch => sch.rombel)));

  const safeAvailableRombels = availableRombels.length > 0 ? availableRombels : ['TI 3'];

  const [selectedRombel, setSelectedRombel] = useState<string>(
    defaultRombel && safeAvailableRombels.includes(defaultRombel)
      ? defaultRombel
      : safeAvailableRombels[0] || 'TI 3'
  );

  const [selectedMonth, setSelectedMonth] = useState<string>('Oktober 2026');

  // Synchronize state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      const initialCourse = defaultCourseCode && safeAllowedCourses.some(c => c.code === defaultCourseCode)
        ? defaultCourseCode
        : safeAllowedCourses[0]?.code || 'MKTI0109';
      setSelectedCourseCode(initialCourse);

      const rombels = isDosen
        ? Array.from(new Set(mySchedules.filter(sch => sch.courseCode === initialCourse).map(sch => sch.rombel)))
        : Array.from(new Set(schedules.filter(sch => sch.courseCode === initialCourse).map(sch => sch.rombel)));

      if (defaultRombel && rombels.includes(defaultRombel)) {
        setSelectedRombel(defaultRombel);
      } else if (rombels.length > 0) {
        setSelectedRombel(rombels[0]);
      }
    }
  }, [isOpen, defaultCourseCode, defaultRombel]);

  // Handle course change
  const handleCourseChange = (newCourseCode: string) => {
    setSelectedCourseCode(newCourseCode);
    const newRombels = isDosen
      ? Array.from(new Set(mySchedules.filter(sch => sch.courseCode === newCourseCode).map(sch => sch.rombel)))
      : Array.from(new Set(schedules.filter(sch => sch.courseCode === newCourseCode).map(sch => sch.rombel)));

    if (newRombels.length > 0 && !newRombels.includes(selectedRombel)) {
      setSelectedRombel(newRombels[0]);
    }
  };

  if (!isOpen) return null;

  const currentCourse = safeAllowedCourses.find(c => c.code === selectedCourseCode) || safeAllowedCourses[0];

  // Strictly filter sessions for this course and rombel
  const courseSessions = sessions.filter(
    s => s.courseCode === selectedCourseCode && (s.rombel === selectedRombel || s.rombel.includes(selectedRombel))
  );

  // Strictly filter students enrolled in this course and rombel
  const rombelStudents = getStudentsForRombel(selectedRombel);
  const totalEnrolled = rombelStudents.length;

  const config: ReportConfig = {
    courseCode: currentCourse.code,
    courseName: currentCourse.name,
    lecturerName: isDosen ? currentUser.name : currentCourse.defaultLecturerName,
    rombel: selectedRombel,
    sks: currentCourse.sks,
    prodi: currentCourse.prodi,
    monthName: selectedMonth,
  };

  const handleExportPDF = () => {
    generateAttendancePDF(config, rombelStudents, courseSessions, records);
  };

  const handleExportExcel = () => {
    generateAttendanceExcel(config, rombelStudents, courseSessions, records);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Clean Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Ekspor Rekapitulasi Presensi
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Laporan resmi perkuliahan format PDF & Excel
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Privacy Scope Notice */}
          {isDosen && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm text-slate-700 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block">
                  Akses Khusus Dosen Pengampu ({currentUser.name})
                </span>
                <span className="text-slate-600 mt-0.5 block leading-relaxed">
                  Sesuai kebijakan akademik, Anda hanya dapat mengunduh data presensi mahasiswa yang terdaftar pada mata kuliah yang Anda ampu.
                </span>
              </div>
            </div>
          )}

          {/* Form Filters */}
          <div className="space-y-4 text-sm">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Mata Kuliah Anda:
              </label>
              <select
                value={selectedCourseCode}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md font-medium text-slate-900 focus:outline-none focus:border-slate-500 text-sm"
              >
                {safeAllowedCourses.map(c => (
                  <option key={c.id} value={c.code}>
                    [{c.code}] {c.name} ({c.sks} SKS · {c.prodi})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Kelas / Rombel:
                </label>
                <select
                  value={selectedRombel}
                  onChange={(e) => setSelectedRombel(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md font-medium text-slate-900 focus:outline-none focus:border-slate-500 text-sm"
                >
                  {safeAvailableRombels.map(r => (
                    <option key={r} value={r}>Rombel {r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Periode Laporan:
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md font-medium text-slate-900 focus:outline-none focus:border-slate-500 text-sm"
                >
                  <option value="September 2026">September 2026</option>
                  <option value="Oktober 2026">Oktober 2026</option>
                  <option value="November 2026">November 2026</option>
                  <option value="Desember 2026">Desember 2026</option>
                  <option value="Semester Ganjil Penuh (16 Pertemuan)">Semester Penuh (16 Pertemuan)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clean Data Preview Summary */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            <span className="font-bold text-slate-900 block mb-1">
              Data yang Akan Diunduh:
            </span>
            <div className="flex items-center gap-2 font-medium">
              <span>{totalEnrolled} Mahasiswa Terdaftar ({selectedRombel})</span>
              <span aria-hidden="true">·</span>
              <span>{courseSessions.length} Sesi Terlaksana</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleExportPDF}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Unduh PDF Resmi</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Unduh Excel (.XLSX)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
          <span>Format: Kop Surat & TTD Dosen Pengampu</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md text-slate-600 hover:bg-slate-200 font-medium transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
