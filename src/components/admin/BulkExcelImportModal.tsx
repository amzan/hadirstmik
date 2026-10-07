import React, { useState, useRef } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import {
  ImportCategory,
  ImportMode,
  MultiSheetImportResult,
  downloadScheduleTemplate,
  downloadUserTemplate,
  downloadStudentTemplate,
  downloadCourseTemplate,
  downloadAllInOneTemplate,
  parseExcelWorkbook
} from '../../utils/excelBulkService';
import {
  X, FileSpreadsheet, Download, Upload, CheckCircle2,
  AlertCircle, AlertTriangle, RefreshCw, Check, ArrowRight,
  Calendar, Users, BookOpen, GraduationCap, Layers, Sparkles
} from 'lucide-react';

interface BulkExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: ImportCategory;
  onSuccess?: () => void;
}

export const BulkExcelImportModal: React.FC<BulkExcelImportModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'all',
  onSuccess,
}) => {
  const {
    users,
    bulkUpdateSchedules,
    bulkUpdateUsers,
    bulkUpdateStudents,
    bulkUpdateCourses,
    bulkImportAll,
  } = useAttendance();

  const [category, setCategory] = useState<ImportCategory>(initialCategory);
  const [mode, setMode] = useState<ImportMode>('merge');

  // File parsing states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [importResult, setImportResult] = useState<MultiSheetImportResult | null>(null);

  // Execution states
  const [isApplying, setIsApplying] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    if (category === 'schedules') downloadScheduleTemplate();
    else if (category === 'users') downloadUserTemplate();
    else if (category === 'students') downloadStudentTemplate();
    else if (category === 'courses') downloadCourseTemplate();
    else downloadAllInOneTemplate();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError('');
    setSuccessMsg('');
    setImportResult(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setParseError('Format file harus berupa Microsoft Excel (.xlsx atau .xls).');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);

    try {
      const result = await parseExcelWorkbook(file, users, category);
      setIsParsing(false);

      const hasAnyData =
        (result.schedules && result.schedules.valid.length > 0) ||
        (result.users && result.users.valid.length > 0) ||
        (result.students && result.students.valid.length > 0) ||
        (result.courses && result.courses.valid.length > 0);

      if (!hasAnyData) {
        setParseError('Tidak ditemukan baris data valid di dalam file Excel. Silakan periksa kembali judul kolom sesuai template.');
      } else {
        setImportResult(result);
      }
    } catch (err: any) {
      setIsParsing(false);
      setParseError(`Gagal membaca berkas Excel: ${err?.message || 'File rusak atau tidak dapat diproses'}`);
    }
  };

  const handleExecuteImport = () => {
    if (!importResult) return;

    setIsApplying(true);
    setParseError('');
    setSuccessMsg('');

    setTimeout(() => {
      try {
        let schedulesUpdated = 0;
        let usersUpdated = 0;
        let studentsUpdated = 0;
        let coursesUpdated = 0;

        if (category === 'schedules' && importResult.schedules) {
          const res = bulkUpdateSchedules(importResult.schedules.valid, mode);
          schedulesUpdated = res.total;
        } else if (category === 'users' && importResult.users) {
          const res = bulkUpdateUsers(importResult.users.valid, mode);
          usersUpdated = res.total;
        } else if (category === 'students' && importResult.students) {
          const res = bulkUpdateStudents(importResult.students.valid, mode);
          studentsUpdated = res.total;
        } else if (category === 'courses' && importResult.courses) {
          const res = bulkUpdateCourses(importResult.courses.valid, mode);
          coursesUpdated = res.total;
        } else {
          // 'all' category: bulkImportAll
          const res = bulkImportAll({
            schedules: importResult.schedules?.valid,
            users: importResult.users?.valid,
            students: importResult.students?.valid,
            courses: importResult.courses?.valid,
          }, mode);
          schedulesUpdated = res.schedulesCount;
          usersUpdated = res.usersCount;
          studentsUpdated = res.studentsCount;
          coursesUpdated = res.coursesCount;
        }

        setIsApplying(false);
        const parts: string[] = [];
        if (schedulesUpdated > 0) parts.push(`${schedulesUpdated} jadwal kuliah`);
        if (usersUpdated > 0) parts.push(`${usersUpdated} akun pengguna`);
        if (studentsUpdated > 0) parts.push(`${studentsUpdated} data mahasiswa rombel`);
        if (coursesUpdated > 0) parts.push(`${coursesUpdated} master mata kuliah`);

        const summaryText = parts.length > 0 ? parts.join(', ') : 'Data';
        setSuccessMsg(`Berhasil mengimpor & memperbarui ${summaryText} via Excel (${mode === 'merge' ? 'Mode Gabung' : 'Mode Timpa Total'})!`);
        setImportResult(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (onSuccess) onSuccess();
      } catch (err: any) {
        setIsApplying(false);
        setParseError(`Gagal menerapkan pembaruan data: ${err?.message || 'Kesalahan sistem'}`);
      }
    }, 400);
  };

  // Compute total parsed items
  const totalParsedValid =
    (importResult?.schedules?.valid.length || 0) +
    (importResult?.users?.valid.length || 0) +
    (importResult?.students?.valid.length || 0) +
    (importResult?.courses?.valid.length || 0);

  const totalErrorsCount =
    (importResult?.schedules?.errors.length || 0) +
    (importResult?.users?.errors.length || 0) +
    (importResult?.students?.errors.length || 0) +
    (importResult?.courses?.errors.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
                <span>Pusat Unggah Excel Massal</span>
                <span>·</span>
                <span>Konsol BAAK</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                Impor & Perbarui Data Massal via Excel
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 overflow-x-auto shrink-0 text-xs sm:text-sm font-semibold gap-1 sm:gap-2">
          <button
            onClick={() => {
              setCategory('all');
              setImportResult(null);
            }}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              category === 'all'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Semua (Multi-Sheet)</span>
          </button>

          <button
            onClick={() => {
              setCategory('schedules');
              setImportResult(null);
            }}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              category === 'schedules'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Jadwal Perkuliahan</span>
          </button>

          <button
            onClick={() => {
              setCategory('users');
              setImportResult(null);
            }}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              category === 'users'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Pengguna & Dosen</span>
          </button>

          <button
            onClick={() => {
              setCategory('students');
              setImportResult(null);
            }}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              category === 'students'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Rombel & Mahasiswa</span>
          </button>

          <button
            onClick={() => {
              setCategory('courses');
              setImportResult(null);
            }}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              category === 'courses'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Master Mata Kuliah</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Success Banner */}
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in duration-150">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-emerald-950">Impor Data Berhasil</p>
                <p className="mt-0.5">{successMsg}</p>
              </div>
              <button
                onClick={() => setSuccessMsg('')}
                className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Error Banner */}
          {parseError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in duration-150">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-rose-950">Terjadi Kendala</p>
                <p className="mt-0.5">{parseError}</p>
              </div>
              <button
                onClick={() => setParseError('')}
                className="text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Step 1 & 2 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Download Template */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">1</span>
                  <span>Unduh Format Template Excel Resmi</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Gunakan format kolom resmi agar data dapat terbaca sempurna oleh sistem presensi kampus.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full py-2.5 px-3.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Unduh Template ({category === 'all' ? 'Lengkap Multi-Sheet' : category})</span>
              </button>
            </div>

            {/* Step 2: Choose Mode */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">2</span>
                  <span>Pilih Metode Pembaruan Data</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Tentukan bagaimana sistem menangani data lama yang sudah ada di basis data.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('merge')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    mode === 'merge'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>Gabung & Update</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Data baru ditambah, data sama diperbarui
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('replace')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    mode === 'replace'
                      ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>Timpa Penuh (Replace)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Ganti seluruh data dengan isi file Excel
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Upload Excel File */}
          <div>
            <label
              htmlFor="bulk-excel-upload-input"
              className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition ${
                selectedFile
                  ? 'border-emerald-500 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-slate-100/70'
              }`}
            >
              <FileSpreadsheet className={`w-8 h-8 mb-2 ${selectedFile ? 'text-emerald-600' : 'text-slate-400'}`} />
              <p className="text-sm font-semibold text-slate-900">
                {selectedFile ? selectedFile.name : 'Pilih atau Tarik Berkas File Excel (.xlsx / .xls)'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Kategori: <strong className="text-slate-700 uppercase">{category}</strong> · Klik di sini untuk memilih berkas dari komputer
              </p>
              <input
                id="bulk-excel-upload-input"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Loading parsing indicator */}
          {isParsing && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-600 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Memproses & memvalidasi struktur berkas Excel...</span>
            </div>
          )}

          {/* Parsing Summary & Preview */}
          {importResult && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Summary Stats Badges */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800">
                    Ditemukan {totalParsedValid} baris data siap diimpor
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {importResult.schedules && (
                    <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-medium">
                      Jadwal: <strong>{importResult.schedules.valid.length}</strong>
                    </span>
                  )}
                  {importResult.users && (
                    <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-medium">
                      Pengguna: <strong>{importResult.users.valid.length}</strong>
                    </span>
                  )}
                  {importResult.students && (
                    <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-medium">
                      Mahasiswa: <strong>{importResult.students.valid.length}</strong>
                    </span>
                  )}
                  {importResult.courses && (
                    <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-medium">
                      Mata Kuliah: <strong>{importResult.courses.valid.length}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Warning if there are errors */}
              {totalErrorsCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Peringatan ({totalErrorsCount} baris tidak lengkap):</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Baris yang tidak memiliki data wajib diabaikan secara otomatis. Baris yang valid tetap dapat diimpor.
                    </p>
                  </div>
                </div>
              )}

              {/* Tabular Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Pratinjau Data (Contoh Baris Teratas):</span>
                  <span className="text-[11px] font-normal text-slate-500">Maks. 5 baris pertama</span>
                </div>

                <div className="overflow-x-auto text-xs">
                  {/* Schedules Preview */}
                  {importResult.schedules && importResult.schedules.valid.length > 0 && (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-[11px] border-b border-slate-200">
                          <th className="p-2 text-left">Hari</th>
                          <th className="p-2 text-left">Jam</th>
                          <th className="p-2 text-left">Kode MK</th>
                          <th className="p-2 text-left">Mata Kuliah</th>
                          <th className="p-2 text-left">Dosen Pengampu</th>
                          <th className="p-2 text-left">Rombel</th>
                          <th className="p-2 text-left">Ruang</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importResult.schedules.valid.slice(0, 5).map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2 font-medium">{s.day}</td>
                            <td className="p-2 font-mono text-[11px]">{s.startTime}-{s.endTime}</td>
                            <td className="p-2 font-mono text-[11px]">{s.courseCode}</td>
                            <td className="p-2 font-semibold">{s.courseName}</td>
                            <td className="p-2">{s.lecturerName}</td>
                            <td className="p-2 font-medium text-emerald-800">{s.rombel}</td>
                            <td className="p-2">{s.room}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Students Preview */}
                  {importResult.students && importResult.students.valid.length > 0 && (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-[11px] border-b border-slate-200">
                          <th className="p-2 text-left">NIM</th>
                          <th className="p-2 text-left">Nama Mahasiswa</th>
                          <th className="p-2 text-left">Program Studi</th>
                          <th className="p-2 text-left">Rombel</th>
                          <th className="p-2 text-left">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importResult.students.valid.slice(0, 5).map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2 font-mono text-[11px] font-bold">{s.nim}</td>
                            <td className="p-2 font-semibold">{s.name}</td>
                            <td className="p-2">{s.prodi}</td>
                            <td className="p-2 font-medium text-emerald-800">{s.rombel}</td>
                            <td className="p-2 text-slate-500 text-[11px]">{s.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Users Preview */}
                  {importResult.users && importResult.users.valid.length > 0 && (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-[11px] border-b border-slate-200">
                          <th className="p-2 text-left">Username</th>
                          <th className="p-2 text-left">Nama Lengkap</th>
                          <th className="p-2 text-left">Peran</th>
                          <th className="p-2 text-left">Email</th>
                          <th className="p-2 text-left">Prodi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importResult.users.valid.slice(0, 5).map((u, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2 font-mono text-[11px] font-bold">{u.username}</td>
                            <td className="p-2 font-semibold">{u.name}</td>
                            <td className="p-2 font-medium uppercase text-[10px] text-indigo-700">{u.role}</td>
                            <td className="p-2 text-slate-500 text-[11px]">{u.email}</td>
                            <td className="p-2">{u.prodi || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Courses Preview */}
                  {importResult.courses && importResult.courses.valid.length > 0 && (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-[11px] border-b border-slate-200">
                          <th className="p-2 text-left">Kode MK</th>
                          <th className="p-2 text-left">Nama Mata Kuliah</th>
                          <th className="p-2 text-left">SKS</th>
                          <th className="p-2 text-left">Semester</th>
                          <th className="p-2 text-left">Program Studi</th>
                          <th className="p-2 text-left">Dosen Pengampu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importResult.courses.valid.slice(0, 5).map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2 font-mono text-[11px] font-bold">{c.code}</td>
                            <td className="p-2 font-semibold">{c.name}</td>
                            <td className="p-2 font-medium">{c.sks} SKS</td>
                            <td className="p-2">Sem {c.semester}</td>
                            <td className="p-2">{c.prodi}</td>
                            <td className="p-2">{c.defaultLecturerName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-500">
            {importResult ? (
              <span>Metode: <strong className="text-slate-800">{mode === 'merge' ? 'Gabung (Merge)' : 'Timpa Penuh (Replace)'}</strong></span>
            ) : (
              <span>Pilih file Excel untuk mulai impor data</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold cursor-pointer transition"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={!importResult || totalParsedValid === 0 || isApplying}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold flex items-center gap-2 cursor-pointer transition shadow-xs"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memperbarui Basis Data...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Terapkan Impor ({totalParsedValid} Data)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
