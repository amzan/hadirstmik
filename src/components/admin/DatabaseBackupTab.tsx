import React, { useState, useRef } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import {
  downloadDatabaseBackupFile,
  downloadDatabaseExcelFile,
  validateAndParseBackupFile,
  calculateDatabaseSizeEstimate,
  formatBytes
} from '../../utils/databaseBackupService';
import { DatabaseBackup, DatabaseSnapshot } from '../../types/attendance';
import { BulkExcelImportModal } from './BulkExcelImportModal';
import {
  Database, Download, Upload, Shield, RefreshCw, FileText,
  CheckCircle2, AlertTriangle, Clock, HardDrive, Trash2,
  FileSpreadsheet, ArrowRight, Sparkles, Check,
  AlertCircle, Info, Calendar, Users, BookOpen
} from 'lucide-react';

interface DatabaseBackupTabProps {
  onOpenResetConfirm?: () => void;
}

export const DatabaseBackupTab: React.FC<DatabaseBackupTabProps> = ({
  onOpenResetConfirm,
}) => {
  const {
    currentUser,
    users,
    students,
    courses,
    schedules,
    sessions,
    records,
    leaveRequests,
    getDatabaseBackupData,
    restoreDatabase,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    snapshots,
  } = useAttendance();

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Snapshot form state
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotNote, setSnapshotNote] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotSuccessMsg, setSnapshotSuccessMsg] = useState('');

  // File upload & restore state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<DatabaseBackup | null>(null);
  const [parseError, setParseError] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState('');
  const [restoreErrorMsg, setRestoreErrorMsg] = useState('');

  // Selected snapshot for restore preview
  const [snapshotToRestore, setSnapshotToRestore] = useState<DatabaseSnapshot | null>(null);

  // Current database statistics
  const currentBackupData = getDatabaseBackupData();
  const estimatedSizeBytes = calculateDatabaseSizeEstimate(currentBackupData);
  const totalEntities =
    users.length +
    students.length +
    courses.length +
    schedules.length +
    sessions.length +
    records.length +
    leaveRequests.length;

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError('');
    setRestoreSuccessMsg('');
    setRestoreErrorMsg('');
    setParsedBackup(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setParseError('File harus berupa dokumen cadangan format JSON (.json).');
      return;
    }

    setUploadedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setParseError('Isi file cadangan kosong.');
        return;
      }

      const validation = validateAndParseBackupFile(content);
      if (!validation.isValid || !validation.backup) {
        setParseError(validation.error || 'File cadangan tidak valid atau struktur data rusak.');
      } else {
        setParsedBackup(validation.backup);
      }
    };
    reader.onerror = () => {
      setParseError('Gagal membaca file dari penyimpanan lokal.');
    };
    reader.readAsText(file);
  };

  // Execute restore from uploaded JSON file
  const handleExecuteRestore = () => {
    if (!parsedBackup) return;

    setIsRestoring(true);
    setRestoreErrorMsg('');
    setRestoreSuccessMsg('');

    setTimeout(() => {
      const result = restoreDatabase(parsedBackup.data);
      setIsRestoring(false);

      if (result.success) {
        setRestoreSuccessMsg(
          `Berhasil memulihkan basis data! ${result.restoredCounts?.users || 0} akun, ${result.restoredCounts?.students || 0} mahasiswa, ${result.restoredCounts?.schedules || 0} jadwal, dan ${result.restoredCounts?.records || 0} rekap presensi telah disinkronkan kembali.`
        );
        setParsedBackup(null);
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setRestoreErrorMsg(result.message);
      }
    }, 400);
  };

  // Create manual local snapshot
  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingSnapshot(true);
    setSnapshotSuccessMsg('');

    setTimeout(() => {
      const newSnap = createSnapshot(
        snapshotName.trim() || undefined,
        snapshotNote.trim() || undefined
      );
      setIsCreatingSnapshot(false);
      setSnapshotName('');
      setSnapshotNote('');
      setSnapshotSuccessMsg(`Snapshot "${newSnap.name}" berhasil dibuat dan disimpan di browser!`);
      setTimeout(() => setSnapshotSuccessMsg(''), 4000);
    }, 300);
  };

  // Restore from snapshot
  const handleConfirmRestoreSnapshot = (snap: DatabaseSnapshot) => {
    const res = restoreSnapshot(snap.id);
    if (res.success) {
      setRestoreSuccessMsg(`Snapshot "${snap.name}" berhasil dipulihkan!`);
      setSnapshotToRestore(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setRestoreErrorMsg(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice: Developer Update Protection */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-700/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/30">
              <Shield className="w-3.5 h-3.5" />
              <span>Proteksi & Pemulihan Data BAAK</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Pusat Cadangan & Pemulihan Basis Data (Backup & Restore)
            </h3>
            <p className="text-sm text-indigo-200/90 max-w-2xl leading-relaxed">
              Unduh cadangan data sebelum pembaruan sistem oleh developer. Jika sistem diperbarui atau di-deploy ulang, seluruh jadwal, akun, rombel, dan rekapitulasi presensi dapat dipulihkan kapan saja dengan 1 klik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsBulkImportOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm cursor-pointer"
              title="Unggah dan perbarui data jadwal, pengguna, mahasiswa, atau mata kuliah dari file Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Impor Excel Massal</span>
            </button>
            <button
              onClick={() => downloadDatabaseBackupFile(currentBackupData, currentUser)}
              className="px-4 py-2.5 rounded-xl bg-white text-indigo-950 font-bold text-xs sm:text-sm flex items-center gap-2 hover:bg-indigo-50 active:bg-indigo-100 transition shadow-sm cursor-pointer"
              title="Unduh file backup JSON lengkap"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>Unduh Backup JSON</span>
            </button>
            <button
              onClick={() => downloadDatabaseExcelFile(currentBackupData)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm cursor-pointer"
              title="Unduh master database dalam format spreadsheet Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Arsip Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {restoreSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-start gap-3 animate-in fade-in duration-200 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-emerald-900">Pemulihan Data Berhasil</p>
            <p className="mt-0.5">{restoreSuccessMsg}</p>
          </div>
          <button
            onClick={() => setRestoreSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {restoreErrorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3 animate-in fade-in duration-200 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-rose-900">Gagal Memulihkan Basis Data</p>
            <p className="mt-0.5">{restoreErrorMsg}</p>
          </div>
          <button
            onClick={() => setRestoreErrorMsg('')}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Database Status Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Pengguna Sistem</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900">{users.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dosen, BAAK, Mhs</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Mahasiswa</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900">{students.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Data Rombel Aktif</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Jadwal Kuliah</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900">{schedules.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Kelas Terjadwal</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Mata Kuliah</span>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900">{courses.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Kurikulum Semester</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Presensi & Sesi</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900">{records.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{sessions.length} Sesi Terbuka/Tutup</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Ukuran Data</span>
            <HardDrive className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-indigo-700">{formatBytes(estimatedSizeBytes)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{totalEntities} Entitas Record</div>
        </div>
      </div>

      {/* Main Grid: Restore from File & Snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Restore dari File JSON Cadangan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900">
                  Pulihkan Basis Data dari File (.JSON)
                </h4>
                <p className="text-xs text-slate-500">
                  Unggah file cadangan yang telah diekspor sebelumnya untuk mengembalikan seluruh data.
                </p>
              </div>
            </div>

            {/* Upload Zone */}
            <div className="mt-4">
              <label
                htmlFor="db-restore-file-input"
                className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition ${
                  uploadedFile
                    ? 'border-indigo-400 bg-indigo-50/40'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100/70'
                }`}
              >
                <Upload className={`w-8 h-8 mb-2 ${uploadedFile ? 'text-indigo-600' : 'text-slate-400'}`} />
                <p className="text-sm font-semibold text-slate-800">
                  {uploadedFile ? uploadedFile.name : 'Klik untuk memilih file cadangan JSON'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Format yang didukung: <span className="font-mono font-medium">.json</span> (ukuran maks. 25 MB)
                </p>
                <input
                  id="db-restore-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {parseError && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>

            {/* Preview of Parsed Backup Data */}
            {parsedBackup && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>File Terverifikasi & Siap Dipulihkan</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">v{parsedBackup.version}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Pengguna</span>
                    <strong className="text-slate-900 font-bold">{parsedBackup.summary.totalUsers}</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Mahasiswa</span>
                    <strong className="text-slate-900 font-bold">{parsedBackup.summary.totalStudents}</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Jadwal</span>
                    <strong className="text-slate-900 font-bold">{parsedBackup.summary.totalSchedules}</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Presensi</span>
                    <strong className="text-slate-900 font-bold">{parsedBackup.summary.totalRecords}</strong>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1">
                  <p>
                    <span className="text-slate-400">Tanggal Ekspor:</span>{' '}
                    <strong>{new Date(parsedBackup.timestamp).toLocaleString('id-ID')}</strong>
                  </p>
                  <p>
                    <span className="text-slate-400">Pengekspor:</span>{' '}
                    <strong>{parsedBackup.exportedBy.userName}</strong>
                  </p>
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Sistem otomatis membuat rollback snapshot sebelum data saat ini ditimpa.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {parsedBackup ? 'Siap melakukan pemulihan' : 'Pilih file cadangan JSON di atas'}
            </span>
            <button
              onClick={handleExecuteRestore}
              disabled={!parsedBackup || isRestoring}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memulihkan Data...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Terapkan Pemulihan Database</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Buat Snapshot Lokal Cepat */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900">
                  Buat Snapshot Lokal Instan
                </h4>
                <p className="text-xs text-slate-500">
                  Simpan cadangan cepat di penyimpanan browser agar dapat dipulihkan dengan 1 klik tanpa file.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSnapshot} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama / Label Snapshot
                </label>
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder={`Contoh: Sebelum Update Developer ${new Date().toLocaleDateString('id-ID')}`}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={snapshotNote}
                  onChange={(e) => setSnapshotNote(e.target.value)}
                  placeholder="Catatan mengenai kondisi perubahan data terakhir (misal: rombel TI 1A baru diimpor)..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition resize-none"
                />
              </div>

              {snapshotSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{snapshotSuccessMsg}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Snapshot mencakup <strong>seluruh {totalEntities} data</strong>: Akun & Password, Mahasiswa, Jadwal, Pertemuan, Sesi QR, dan Presensi.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isCreatingSnapshot}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  {isCreatingSnapshot ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Snapshot...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-purple-300" />
                      <span>Simpan Snapshot Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Tersimpan {snapshots.length} snapshot di browser ini</span>
            <span>Maksimal 15 snapshot riwayat</span>
          </div>
        </div>
      </div>

      {/* Snapshots History Table / List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900">
                Riwayat Snapshot Tersimpan ({snapshots.length})
              </h4>
              <p className="text-xs text-slate-500">
                Pilih snapshot untuk dipulihkan kembali atau diunduh sebagai file cadangan fisik.
              </p>
            </div>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Clock className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
            <p className="text-sm font-semibold text-slate-700">Belum ada snapshot lokal tersimpan</p>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan formulir "Buat Snapshot Lokal Instan" di atas untuk menyimpan cadangan pertama Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{snap.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono font-medium">
                      {new Date(snap.timestamp).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {snap.note && (
                    <p className="text-xs text-slate-600 italic">
                      "{snap.note}"
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                    <span>{snap.summary.totalUsers} Akun</span>
                    <span>·</span>
                    <span>{snap.summary.totalStudents} Mahasiswa</span>
                    <span>·</span>
                    <span>{snap.summary.totalSchedules} Jadwal</span>
                    <span>·</span>
                    <span>{snap.summary.totalRecords} Rekap Presensi</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    onClick={() => downloadDatabaseBackupFile(snap.data, currentUser)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Unduh snapshot ini sebagai file JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh JSON</span>
                  </button>

                  <button
                    onClick={() => setSnapshotToRestore(snap)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    title="Pulihkan data aplikasi ke snapshot ini"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Pulihkan</span>
                  </button>

                  <button
                    onClick={() => deleteSnapshot(snap.id)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition cursor-pointer"
                    title="Hapus snapshot ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safety & Reset Zone */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Zona Pengaturan Awal (Default Reset)</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Ingin mengembalikan seluruh database ke template resmi awal kampus? Pastikan Anda telah mengunduh cadangan terlebih dahulu sebelum melakukan reset.
          </p>
        </div>

        {onOpenResetConfirm && (
          <button
            onClick={onOpenResetConfirm}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs transition cursor-pointer shrink-0"
          >
            Reset ke Data Awal Kampus
          </button>
        )}
      </div>

      {/* Modal Konfirmasi Pulihkan Snapshot */}
      {snapshotToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <RefreshCw className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Pulihkan ke Snapshot Ini?
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Anda akan memulihkan data sistem ke snapshot <strong className="text-indigo-950 font-bold">"{snapshotToRestore.name}"</strong> yang dibuat pada {new Date(snapshotToRestore.timestamp).toLocaleString('id-ID')}.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-200">
              <p className="font-semibold text-slate-700">Rangkuman Snapshot:</p>
              <p className="text-slate-600">
                {snapshotToRestore.summary.totalUsers} Pengguna · {snapshotToRestore.summary.totalStudents} Mahasiswa · {snapshotToRestore.summary.totalSchedules} Jadwal · {snapshotToRestore.summary.totalRecords} Presensi
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSnapshotToRestore(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleConfirmRestoreSnapshot(snapshotToRestore)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Ya, Terapkan Pemulihan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Excel Importer Modal */}
      <BulkExcelImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
      />
    </div>
  );
};
