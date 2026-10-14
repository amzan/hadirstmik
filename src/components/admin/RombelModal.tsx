import React, { useState, useEffect, useMemo } from 'react';
import { Rombel, ScheduleItem, Course, ProgramStudi, DayOfWeek } from '../../types/attendance';
import { isStudentInRombel } from '../../data/initialData';
import {
  X, Layers, Calendar, Clock, BookOpen, Check,
  AlertCircle, Sparkles, Plus, Search, Filter,
  Building2, UserCheck, Shield, CheckCircle2, ChevronRight, Archive
} from 'lucide-react';

interface RombelModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRombel?: Rombel | null;
  schedules: ScheduleItem[];
  courses: Course[];
  existingRombels: Rombel[];
  onSave: (rombelData: Omit<Rombel, 'id'>, connectedScheduleIds: string[]) => void;
  onUpdate?: (id: string, rombelData: Partial<Rombel>, connectedScheduleIds?: string[], previousCode?: string) => void;
}

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const DAYS: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const RombelModal: React.FC<RombelModalProps> = ({
  isOpen,
  onClose,
  editingRombel,
  schedules,
  courses,
  existingRombels,
  onSave,
  onUpdate,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [prodi, setProdi] = useState<ProgramStudi>('Teknologi Informasi');
  const [semester, setSemester] = useState<number>(1);
  const [academicYear, setAcademicYear] = useState('2026/2027 Ganjil');
  const [description, setDescription] = useState('');
  const [isArchived, setIsArchived] = useState(false);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Schedule filtering state inside modal
  const [schSearch, setSchSearch] = useState('');
  const [schProdiFilter, setSchProdiFilter] = useState<string>('MATCH'); // 'MATCH' | 'ALL' | specific prodi
  const [schDayFilter, setSchDayFilter] = useState<string>('ALL');

  // Reset or populate state when opened
  useEffect(() => {
    if (!isOpen) return;

    if (editingRombel) {
      setCode(editingRombel.code);
      setName(editingRombel.name);
      setProdi(editingRombel.prodi);
      setSemester(editingRombel.semester || 1);
      setAcademicYear(editingRombel.academicYear || '2026/2027 Ganjil');
      setDescription(editingRombel.description || '');
      setIsArchived(Boolean(editingRombel.isArchived));

      // Identify currently connected schedules
      const currentlyConnected = editingRombel.scheduleIds && editingRombel.scheduleIds.length > 0
        ? editingRombel.scheduleIds
        : schedules.filter(s => isStudentInRombel(editingRombel.code, s.rombel)).map(s => s.id);

      setSelectedScheduleIds(currentlyConnected);
    } else {
      setCode('');
      setName('');
      setProdi('Teknologi Informasi');
      setSemester(1);
      setAcademicYear('2026/2027 Ganjil');
      setDescription('');
      setIsArchived(false);
      setSelectedScheduleIds([]);
    }
    setSchSearch('');
    setSchProdiFilter('MATCH');
    setSchDayFilter('ALL');
    setErrorMsg('');
  }, [isOpen, editingRombel, schedules]);

  // Handle auto-generating name based on code and prodi
  const handleCodeChange = (val: string) => {
    const clean = val.toUpperCase();
    setCode(clean);
    if (!editingRombel && (!name || name.startsWith('Rombel ') || name.includes('Kelas '))) {
      if (clean) {
        setName(`${prodi} Kelas ${clean}`);
      }
    }
  };

  const handleProdiChange = (newProdi: ProgramStudi) => {
    setProdi(newProdi);
    if (!editingRombel && code) {
      setName(`${newProdi} Kelas ${code}`);
    }
  };

  // Toggle single schedule selection
  const toggleSchedule = (scheduleId: string) => {
    setSelectedScheduleIds(prev =>
      prev.includes(scheduleId)
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  // Filter schedules available for linking
  const filteredSchedules = useMemo(() => {
    return schedules.filter(sch => {
      // Prodi filter
      if (schProdiFilter === 'MATCH' && sch.prodi !== prodi) return false;
      if (schProdiFilter !== 'MATCH' && schProdiFilter !== 'ALL' && sch.prodi !== schProdiFilter) return false;

      // Day filter
      if (schDayFilter !== 'ALL' && sch.day !== schDayFilter) return false;

      // Search filter
      if (schSearch.trim()) {
        const q = schSearch.toLowerCase();
        const match =
          sch.courseName.toLowerCase().includes(q) ||
          sch.courseCode.toLowerCase().includes(q) ||
          sch.lecturerName.toLowerCase().includes(q) ||
          sch.room.toLowerCase().includes(q) ||
          sch.rombel.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [schedules, prodi, schProdiFilter, schDayFilter, schSearch]);

  // Selected schedules details
  const selectedSchedulesList = useMemo(() => {
    return schedules.filter(s => selectedScheduleIds.includes(s.id));
  }, [schedules, selectedScheduleIds]);

  const totalSelectedSks = useMemo(() => {
    return selectedSchedulesList.reduce((acc, s) => acc + (s.sks || 0), 0);
  }, [selectedSchedulesList]);

  const uniqueSelectedDays = useMemo(() => {
    const set = new Set<string>();
    selectedSchedulesList.forEach(s => set.add(s.day));
    return Array.from(set);
  }, [selectedSchedulesList]);

  // Bulk selector helpers
  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredSchedules.map(s => s.id);
    setSelectedScheduleIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectAll = () => {
    setSelectedScheduleIds([]);
  };

  const handleSelectMatchingProdi = () => {
    const matchingIds = schedules.filter(s => s.prodi === prodi).map(s => s.id);
    setSelectedScheduleIds(matchingIds);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim() || `${prodi} Kelas ${cleanCode}`;

    if (!cleanCode) {
      setErrorMsg('Kode Rombel wajib diisi (misalnya TI 1B, TI 7, MI 3A).');
      return;
    }

    // Check duplicate code on create or edit
    if (!editingRombel) {
      const isDuplicate = existingRombels.some(
        r => r.code.trim().toUpperCase() === cleanCode
      );
      if (isDuplicate) {
        setErrorMsg(`Kode Rombel "${cleanCode}" sudah digunakan. Silakan gunakan kode lain.`);
        return;
      }
    } else if (editingRombel.code.trim().toUpperCase() !== cleanCode) {
      const isDuplicate = existingRombels.some(
        r => r.id !== editingRombel.id && r.code.trim().toUpperCase() === cleanCode
      );
      if (isDuplicate) {
        setErrorMsg(`Kode Rombel "${cleanCode}" sudah digunakan oleh rombel lain. Silakan gunakan kode unik.`);
        return;
      }
    }

    const payload: Omit<Rombel, 'id'> = {
      code: cleanCode,
      name: cleanName,
      prodi,
      semester,
      academicYear,
      description: description.trim() || undefined,
      scheduleIds: selectedScheduleIds,
      isArchived,
      archivedAt: isArchived ? (editingRombel?.archivedAt || new Date().toISOString()) : undefined,
    };

    if (editingRombel && onUpdate) {
      onUpdate(editingRombel.id, payload, selectedScheduleIds, editingRombel.code);
    } else {
      onSave(payload, selectedScheduleIds);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                <Shield className="w-3.5 h-3.5" />
                <span>Manajemen Master Rombel &amp; Relasi Jadwal</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                {editingRombel ? `Edit Rombel ${editingRombel.code}` : 'Tambah Rombel Baru & Hubungkan Jadwal'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Informasi Pokok Rombel */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                1
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Informasi Identitas Rombel
              </h4>
            </div>

            {editingRombel && (
              <div className="p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-indigo-950">Sinkronisasi Otomatis Relasi Data</span>
                  <p className="mt-0.5 text-indigo-800/90 leading-relaxed">
                    Perubahan nama atau kode rombel ini akan secara otomatis memperbarui relasi pada <strong>jadwal perkuliahan</strong>, <strong>data &amp; akun mahasiswa terdaftar</strong>, serta <strong>riwayat sesi presensi</strong>.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kode Rombel <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Contoh: TI 1B, TI 7, MI 3"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold uppercase placeholder:normal-case placeholder:font-normal focus:outline-none focus:border-indigo-600 transition"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Kode unik pengelompokan mahasiswa
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Lengkap Rombel / Kelas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Teknologi Informasi Kelas 1B Sore"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-600 transition"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {/* Program Studi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Program Studi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={prodi}
                  onChange={(e) => handleProdiChange(e.target.value as ProgramStudi)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-600 transition"
                >
                  <option value="Teknologi Informasi">Teknologi Informasi (TI)</option>
                  <option value="Manajemen Informatika">Manajemen Informatika (MI)</option>
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Semester / Tingkat <span className="text-rose-500">*</span>
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-600 transition"
                >
                  {SEMESTERS.map(sem => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>
              </div>

              {/* Tahun Akademik */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tahun Akademik
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2026/2027 Ganjil"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-600 transition"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Keterangan / Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Rombel kelas paralel baru, kelas malam, atau rombel khusus peminatan"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-600 transition"
              />
            </div>
          </div>

          {/* Section 2: Pemilihan Jadwal Mata Kuliah yang Dihubungkan */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  2
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Hubungkan dengan Jadwal Mata Kuliah
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Pilih beberapa jadwal perkuliahan yang akan dialokasikan untuk Rombel <strong>{code || 'ini'}</strong>.
                  </p>
                </div>
              </div>

              {/* Metrics Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-2xs">
                  {selectedScheduleIds.length} Jadwal Dipilih
                </span>
                <span className="px-3 py-1 bg-white border border-indigo-200 text-indigo-900 rounded-lg text-xs font-bold">
                  {totalSelectedSks} SKS
                </span>
              </div>
            </div>

            {/* Filter and Quick Select Buttons */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={schSearch}
                    onChange={(e) => setSchSearch(e.target.value)}
                    placeholder="Cari mata kuliah, kode, dosen pengampu, atau ruang..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Filter Prodi */}
                <select
                  value={schProdiFilter}
                  onChange={(e) => setSchProdiFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-medium"
                >
                  <option value="MATCH">Hanya Prodi Rombel ({prodi === 'Teknologi Informasi' ? 'TI' : 'MI'})</option>
                  <option value="ALL">Semua Program Studi</option>
                  <option value="Teknologi Informasi">Teknologi Informasi</option>
                  <option value="Manajemen Informatika">Manajemen Informatika</option>
                </select>

                {/* Filter Hari */}
                <select
                  value={schDayFilter}
                  onChange={(e) => setSchDayFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-medium"
                >
                  <option value="ALL">Semua Hari</option>
                  {DAYS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Quick action buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-slate-400 font-medium text-[11px]">Pilih Cepat:</span>
                <button
                  type="button"
                  onClick={handleSelectMatchingProdi}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
                >
                  Pilih Semua Jadwal Prodi Ini
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
                >
                  Pilih Semua Hasil Filter ({filteredSchedules.length})
                </button>
                {selectedScheduleIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg font-semibold transition cursor-pointer"
                  >
                    Kosongkan Pilihan
                  </button>
                )}
              </div>
            </div>

            {/* Schedules Grid / Checklist */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-2 bg-white">
              {filteredSchedules.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Calendar className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs font-semibold text-slate-600">Tidak ada jadwal yang cocok dengan filter</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Ubah kata kunci pencarian atau ubah pilihan prodi/hari di atas.</p>
                </div>
              ) : (
                filteredSchedules.map((sch) => {
                  const isSelected = selectedScheduleIds.includes(sch.id);

                  return (
                    <div
                      key={sch.id}
                      onClick={() => toggleSchedule(sch.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox box */}
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs font-bold border transition ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs">
                              {sch.courseName}
                            </span>
                            <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">
                              {sch.courseCode}
                            </span>
                            <span className="font-bold text-indigo-700 text-[11px]">
                              {sch.sks} SKS
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-700">
                              {sch.day}, {sch.startTime}–{sch.endTime}
                            </span>
                            <span>·</span>
                            <span className="font-medium text-slate-700">Ruang {sch.room}</span>
                            <span>·</span>
                            <span className="truncate">{sch.lecturerName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Current Rombel tag on this schedule */}
                      <div className="shrink-0 text-right">
                        <span className="text-[10px] text-slate-400 block font-medium">Rombel Saat Ini:</span>
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {sch.rombel || 'Belum diatur'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Connection Preview Summary */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-indigo-950 font-medium">
                  Rombel <strong>{code || '(Kode Rombel)'}</strong> akan otomatis terhubung ke{' '}
                  <strong>{selectedScheduleIds.length} jadwal</strong> ({totalSelectedSks} SKS){' '}
                  {uniqueSelectedDays.length > 0 && `pada hari ${uniqueSelectedDays.join(', ')}`}.
                </span>
              </div>
              <span className="text-[11px] text-indigo-800 font-semibold shrink-0">
                Otomatis disinkronkan ke presensi &amp; mahasiswa
              </span>
            </div>
          </div>

          {/* Archive Status Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isArchived ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                <Archive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Status Arsip Rombel
                </p>
                <p className="text-[11px] text-slate-500">
                  {isArchived
                    ? 'Rombel diarsipkan: Disembunyikan dari pemilihan jadwal baru tanpa menghapus data mahasiswa dan riwayat kelas.'
                    : 'Rombel aktif: Muncul di seluruh pilihan formulir jadwal dan daftar kelas aktif.'}
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isArchived}
                onChange={(e) => setIsArchived(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{editingRombel ? 'Simpan Perubahan Rombel' : 'Buat Rombel & Hubungkan Jadwal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
