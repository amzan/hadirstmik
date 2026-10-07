import React, { useState, useRef } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import {
  downloadDatabaseBackupFile,
  downloadDatabaseExcelFile,
  validateAndParseBackupFile,
  calculateDatabaseSizeEstimate,
  formatBytes
} from '../../utils/databaseBackupService';
import { DatabaseBackup } from '../../types/attendance';
import {
  X, Database, Download, Upload, Shield, RefreshCw,
  CheckCircle2, AlertCircle, FileSpreadsheet,
  Check, Sparkles, ExternalLink, HardDrive
} from 'lucide-react';

interface DatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: () => void;
}

export const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTab,
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
  } = useAttendance();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<DatabaseBackup | null>(null);
  const [parseError, setParseError] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'export' | 'restore' | 'snapshot'>('export');

  // Quick snapshot state
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [snapshotSuccess, setSnapshotSuccess] = useState('');

  if (!isOpen) return null;

  const currentData = getDatabaseBackupData();
  const estimatedSize = calculateDatabaseSizeEstimate(currentData);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError('');
    setRestoreSuccess('');
    setParsedBackup(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setParseError('Pilih file cadangan dengan ekstensi .json');
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

      const res = validateAndParseBackupFile(content);
      if (!res.isValid || !res.backup) {
        setParseError(res.error || 'Format file cadangan tidak valid.');
      } else {
        setParsedBackup(res.backup);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = () => {
    if (!parsedBackup) return;
    setIsRestoring(true);
    setParseError('');
    setRestoreSuccess('');

    setTimeout(() => {
      const res = restoreDatabase(parsedBackup.data);
      setIsRestoring(false);
      if (res.success) {
        setRestoreSuccess(res.message);
        setParsedBackup(null);
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setParseError(res.message);
      }
    }, 400);
  };

  const handleCreateQuickSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    const snap = createSnapshot(snapshotLabel.trim() || undefined);
    setSnapshotSuccess(`Snapshot "${snap.name}" berhasil disimpan di browser!`);
    setSnapshotLabel('');
    setTimeout(() => setSnapshotSuccess(''), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                <Shield className="w-3.5 h-3.5" />
                <span>Konsol BAAK & Administrator</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                Cadangan & Pemulihan Basis Data
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

        {/* Navigation Tabs inside modal */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 shrink-0 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-3 sm:px-4 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Ekspor / Unduh</span>
          </button>

          <button
            onClick={() => setActiveTab('restore')}
            className={`py-3 px-3 sm:px-4 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'restore'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Pulihkan File JSON</span>
          </button>

          <button
            onClick={() => setActiveTab('snapshot')}
            className={`py-3 px-3 sm:px-4 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'snapshot'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Snapshot Lokal</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs sm:text-sm text-indigo-900 leading-relaxed">
                <p className="font-bold text-indigo-950 flex items-center gap-1.5 mb-1">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Amankan Data Sebelum Pembaruan Developer</span>
                </p>
                Unduh file cadangan secara berkala atau sebelum developer meng-update proyek. Data yang diunduh mencakup seluruh akun, password kustom, rombel mahasiswa, jadwal kuliah, dan riwayat presensi.
              </div>

              {/* Status Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Total Pengguna</span>
                  <span className="font-bold text-slate-900 text-sm">{users.length} Akun</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Mahasiswa</span>
                  <span className="font-bold text-slate-900 text-sm">{students.length} Orang</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Jadwal Kuliah</span>
                  <span className="font-bold text-slate-900 text-sm">{schedules.length} Sesi</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Ukuran File</span>
                  <span className="font-bold text-indigo-700 text-sm">{formatBytes(estimatedSize)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => downloadDatabaseBackupFile(currentData, currentUser)}
                  className="w-full p-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-between transition cursor-pointer shadow-sm group"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold">Unduh File Cadangan JSON (Lengkap)</div>
                      <div className="text-xs text-slate-400 font-normal">
                        Format resmi untuk pemulihan instan 1-klik di aplikasi ini
                      </div>
                    </div>
                  </div>
                  <span className="text-xs bg-slate-800 group-hover:bg-slate-700 px-3 py-1 rounded-lg">
                    .JSON
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadDatabaseExcelFile(currentData)}
                  className="w-full p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 text-emerald-950 font-bold text-sm flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-lg bg-emerald-200 flex items-center justify-center text-emerald-800">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-900">Unduh Arsip Master Excel (.xlsx)</div>
                      <div className="text-xs text-emerald-700 font-normal">
                        Spreadsheet multi-sheet untuk arsip cetak, pelaporan, dan audit
                      </div>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-200 text-emerald-900 px-3 py-1 rounded-lg">
                    .XLSX
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RESTORE */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              {restoreSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{restoreSuccess}</span>
                </div>
              )}

              {parseError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="modal-db-restore-file"
                  className={`border-2 border-dashed rounded-xl p-5 text-center flex flex-col items-center justify-center cursor-pointer transition ${
                    uploadedFile ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50'
                  }`}
                >
                  <Upload className={`w-7 h-7 mb-1.5 ${uploadedFile ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <p className="text-xs sm:text-sm font-semibold text-slate-800">
                    {uploadedFile ? uploadedFile.name : 'Pilih file cadangan JSON dari perangkat Anda'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hanya file berformat <span className="font-mono">.json</span>
                  </p>
                  <input
                    id="modal-db-restore-file"
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {parsedBackup && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>Pratinjau Isi Cadangan:</span>
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Terverifikasi
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                    <div>Pengguna: <strong>{parsedBackup.summary.totalUsers}</strong></div>
                    <div>Mahasiswa: <strong>{parsedBackup.summary.totalStudents}</strong></div>
                    <div>Jadwal: <strong>{parsedBackup.summary.totalSchedules}</strong></div>
                    <div>Presensi: <strong>{parsedBackup.summary.totalRecords}</strong></div>
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    Waktu Cadangan: <strong>{new Date(parsedBackup.timestamp).toLocaleString('id-ID')}</strong>
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={!parsedBackup || isRestoring}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memulihkan Seluruh Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Terapkan Pemulihan Sekarang</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: SNAPSHOT */}
          {activeTab === 'snapshot' && (
            <div className="space-y-4">
              <form onSubmit={handleCreateQuickSnapshot} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Label Snapshot Cepat
                  </label>
                  <input
                    type="text"
                    value={snapshotLabel}
                    onChange={(e) => setSnapshotLabel(e.target.value)}
                    placeholder={`Snapshot ${new Date().toLocaleDateString('id-ID')}`}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {snapshotSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{snapshotSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  <span>Simpan Snapshot ke Browser</span>
                </button>
              </form>

              {onNavigateToTab && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTab();
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Buka Tab Kelola Database Lengkap & Riwayat Snapshot</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 text-xs">
          {onNavigateToTab ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToTab();
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Buka Konsol Database Lengkap</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-slate-400">STMIK PGRI Arungbinang Kebumen</span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
