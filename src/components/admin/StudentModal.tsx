import React, { useState, useEffect, useMemo } from 'react';
import { Student, ScheduleItem, Course, ProgramStudi, Rombel } from '../../types/attendance';
import { isStudentInRombel, getStudentRombelList } from '../../data/initialData';
import {
  X, UserPlus, Users, BookOpen, Calendar, Clock,
  CheckCircle2, AlertCircle, AlertTriangle, Sparkles, Building2,
  Check, Plus, Trash2, Shield, Info, Minus, RefreshCw
} from 'lucide-react';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingStudent?: Student | null;
  schedules: ScheduleItem[];
  courses: Course[];
  existingStudents: Student[];
  existingRombels?: Rombel[];
  onSave: (studentData: Student) => void;
}

const DEFAULT_ROMBELS: string[] = ['TI 1A', 'TI 3', 'TI 5', 'MI 1A', 'MI 5A', 'MI 1U'];

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  editingStudent,
  schedules,
  courses,
  existingStudents,
  existingRombels = [],
  onSave,
}) => {
  const [nim, setNim] = useState('');
  const [name, setName] = useState('');
  const [prodi, setProdi] = useState<ProgramStudi>('Teknologi Informasi');
  const [selectedRombels, setSelectedRombels] = useState<string[]>([]);
  const [excludedScheduleIds, setExcludedScheduleIds] = useState<string[]>([]);
  const [customRombelInput, setCustomRombelInput] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Collect all unique rombels from existing rombels, students, schedules + defaults
  const allAvailableRombels = useMemo(() => {
    const set = new Set<string>(DEFAULT_ROMBELS);
    existingRombels.forEach(r => {
      if (r.code) set.add(r.code.trim().toUpperCase());
    });
    existingStudents.forEach(s => {
      const list = s.rombels && s.rombels.length > 0 ? s.rombels : getStudentRombelList(s.rombel);
      list.forEach(r => set.add(r));
    });
    schedules.forEach(s => {
      const parts = s.rombel ? s.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean) : [];
      parts.forEach(p => set.add(p));
    });
    return Array.from(set).sort();
  }, [existingStudents, schedules, existingRombels]);

  // Reset or populate on open/edit
  useEffect(() => {
    if (!isOpen) return;

    if (editingStudent) {
      setNim(editingStudent.nim);
      setName(editingStudent.name);
      setProdi(editingStudent.prodi);
      const list = editingStudent.rombels && editingStudent.rombels.length > 0
        ? editingStudent.rombels
        : getStudentRombelList(editingStudent.rombel);
      setSelectedRombels(list.length > 0 ? list : ['TI 3']);
      setExcludedScheduleIds(editingStudent.excludedScheduleIds || []);
      setEmail(editingStudent.email || '');
      setPhone(editingStudent.phone || '');
    } else {
      setNim('');
      setName('');
      setProdi('Teknologi Informasi');
      setSelectedRombels(['TI 1A']);
      setExcludedScheduleIds([]);
      setEmail('');
      setPhone('');
    }
    setCustomRombelInput('');
    setErrorMsg('');
  }, [isOpen, editingStudent]);

  // Automatically compute linked schedules from selected rombels
  const linkedSchedules = useMemo(() => {
    if (selectedRombels.length === 0) return [];
    return schedules.filter(s => isStudentInRombel(selectedRombels, s.rombel));
  }, [selectedRombels, schedules]);

  // Active enrolled schedules (excluding any that admin dropped/excluded)
  const activeEnrolledSchedules = useMemo(() => {
    return linkedSchedules.filter(s => !excludedScheduleIds.includes(s.id));
  }, [linkedSchedules, excludedScheduleIds]);

  // Automatically compute total SKS linked from active schedules
  const totalLinkedSks = useMemo(() => {
    return activeEnrolledSchedules.reduce((acc, sch) => acc + (sch.sks || 0), 0);
  }, [activeEnrolledSchedules]);

  // Gross SKS before any exclusion
  const grossSks = useMemo(() => {
    return linkedSchedules.reduce((acc, sch) => acc + (sch.sks || 0), 0);
  }, [linkedSchedules]);

  const isExceeding20Sks = totalLinkedSks > 20;

  // Toggle exclusion of an individual schedule
  const toggleExcludeSchedule = (scheduleId: string) => {
    setExcludedScheduleIds(prev => {
      if (prev.includes(scheduleId)) {
        return prev.filter(id => id !== scheduleId);
      } else {
        return [...prev, scheduleId];
      }
    });
  };

  // Smart auto-fit helper to drop enough courses to reach <= 20 SKS
  const handleAutoFitSks = () => {
    let currentSks = totalLinkedSks;
    const newExcluded = [...excludedScheduleIds];
    
    // Sort active schedules to find courses to drop until total <= 20
    for (let i = activeEnrolledSchedules.length - 1; i >= 0; i--) {
      if (currentSks <= 20) break;
      const sch = activeEnrolledSchedules[i];
      newExcluded.push(sch.id);
      currentSks -= (sch.sks || 0);
    }
    setExcludedScheduleIds(newExcluded);
  };

  const handleResetExclusions = () => {
    setExcludedScheduleIds([]);
  };

  if (!isOpen) return null;

  const toggleRombel = (rName: string) => {
    setSelectedRombels(prev => {
      if (prev.includes(rName)) {
        return prev.filter(r => r !== rName);
      } else {
        return [...prev, rName];
      }
    });
  };

  const handleAddCustomRombel = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customRombelInput.trim().toUpperCase();
    if (!clean) return;
    if (!selectedRombels.includes(clean)) {
      setSelectedRombels(prev => [...prev, clean]);
    }
    setCustomRombelInput('');
  };

  const handleProdiChange = (newProdi: ProgramStudi) => {
    setProdi(newProdi);
    // If empty or only default, give smart recommendation
    if (selectedRombels.length <= 1) {
      if (newProdi === 'Teknologi Informasi') {
        setSelectedRombels(['TI 1A']);
      } else {
        setSelectedRombels(['MI 1A']);
      }
    }
  };

  const handleNimChange = (val: string) => {
    const clean = val.trim();
    setNim(clean);
    if (!editingStudent && (!email || email.includes('@student.stmik-arungbinang.ac.id'))) {
      if (clean) {
        setEmail(`${clean.toLowerCase()}@student.stmik-arungbinang.ac.id`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanNim = nim.trim();
    const cleanName = name.trim();

    if (!cleanNim) {
      setErrorMsg('NIM mahasiswa wajib diisi.');
      return;
    }
    if (!cleanName) {
      setErrorMsg('Nama lengkap mahasiswa wajib diisi.');
      return;
    }
    if (selectedRombels.length === 0) {
      setErrorMsg('Pilih minimal 1 rombel agar mahasiswa terhubung ke jadwal mata kuliah.');
      return;
    }

    // Check duplicate NIM on create
    if (!editingStudent) {
      const isDuplicate = existingStudents.some(
        s => s.nim.trim().toUpperCase() === cleanNim.toUpperCase()
      );
      if (isDuplicate) {
        setErrorMsg(`NIM "${cleanNim}" sudah terdaftar pada sistem.`);
        return;
      }
    }

    const finalEmail = email.trim() || `${cleanNim.toLowerCase()}@student.stmik-arungbinang.ac.id`;

    onSave({
      nim: cleanNim,
      name: cleanName,
      prodi,
      rombel: selectedRombels.join(', '),
      rombels: selectedRombels,
      email: finalEmail,
      phone: phone.trim() || undefined,
      excludedScheduleIds: excludedScheduleIds.length > 0
        ? excludedScheduleIds.filter(id => linkedSchedules.some(s => s.id === id))
        : undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                <Shield className="w-3.5 h-3.5" />
                <span>Manajemen Relasi Mahasiswa & Rombel</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                {editingStudent ? 'Edit Mahasiswa & Pilihan Rombel' : 'Tambah Mahasiswa & Relasi Rombel'}
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
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Identity Grid: NIM, Name & Prodi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                NIM Mahasiswa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nim}
                onChange={(e) => handleNimChange(e.target.value)}
                placeholder="Contoh: 26TI0001 atau 24MI0012"
                disabled={!!editingStudent}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-600 disabled:opacity-60 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                NIM digunakan sebagai username login portal mahasiswa
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Lengkap Mahasiswa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Bagus Dwi Saputra"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
              />
            </div>
          </div>

          {/* Program Studi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Program Studi <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleProdiChange('Teknologi Informasi')}
                className={`py-2.5 px-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  prodi === 'Teknologi Informasi'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${prodi === 'Teknologi Informasi' ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                <span>Teknologi Informasi (TI)</span>
              </button>

              <button
                type="button"
                onClick={() => handleProdiChange('Manajemen Informatika')}
                className={`py-2.5 px-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  prodi === 'Manajemen Informatika'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${prodi === 'Manajemen Informatika' ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                <span>Manajemen Informatika (MI)</span>
              </button>
            </div>
          </div>

          {/* Pilihan Rombel (Multi-Select Support) */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-900">
                  Pilihan Rombel Mahasiswa (Bisa Lebih dari 1 Rombel) <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Pilih satu atau beberapa rombel. Mahasiswa akan <strong>otomatis terhubung</strong> ke seluruh jadwal mata kuliah dari rombel-rombel ini.
                </p>
              </div>

              <div className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg shrink-0">
                {selectedRombels.length} Rombel Terpilih
              </div>
            </div>

            {/* Rombel Selection Chips / Checkboxes */}
            <div className="flex flex-wrap gap-2 pt-1">
              {allAvailableRombels.map((rName) => {
                const isSelected = selectedRombels.includes(rName);
                return (
                  <button
                    key={rName}
                    type="button"
                    onClick={() => toggleRombel(rName)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'border border-slate-300 text-transparent'
                    }`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <span>{rName}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Rombel Input */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
              <input
                type="text"
                value={customRombelInput}
                onChange={(e) => setCustomRombelInput(e.target.value)}
                placeholder="Tambah rombel khusus (misal: TI 1B, TI 7, MI 3)..."
                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <button
                type="button"
                onClick={handleAddCustomRombel}
                disabled={!customRombelInput.trim()}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          {/* Real-time Enrolled Schedule Preview Card with SKS Flag & Adjustment */}
          <div className={`border-2 rounded-2xl p-4 sm:p-5 space-y-4 transition ${
            isExceeding20Sks
              ? 'bg-rose-50/70 border-rose-300 shadow-sm'
              : 'bg-gradient-to-br from-indigo-50/90 to-purple-50/70 border-indigo-200/80'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isExceeding20Sks
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-indigo-600 text-white'
                }`}>
                  {isExceeding20Sks ? <AlertTriangle className="w-5 h-5" /> : <Sparkles className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      Rincian Mata Kuliah & Beban SKS Mahasiswa
                    </h4>
                    {isExceeding20Sks && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-2xs">
                        ⚠️ FLAG: SKS &gt; 20
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Berdasarkan rombel: {selectedRombels.length > 0 ? selectedRombels.join(', ') : 'Belum ada rombel dipilih'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-bold text-xs shadow-2xs">
                  {activeEnrolledSchedules.length} dari {linkedSchedules.length} Kelas
                </span>
                <span className={`px-3 py-1 rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1 border ${
                  isExceeding20Sks
                    ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                    : 'bg-emerald-600 text-white border-emerald-600'
                }`}>
                  {isExceeding20Sks ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{totalLinkedSks} / 20 SKS</span>
                </span>
              </div>
            </div>

            {/* Warning Alert if > 20 SKS */}
            {isExceeding20Sks && (
              <div className="p-3.5 bg-rose-100/90 border border-rose-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-950 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-rose-900">
                      Peringatan Akademik: Total Beban ({totalLinkedSks} SKS) Melebihi Batas Maksimal 20 SKS!
                    </h5>
                    <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                      Sesuai peraturan akademik kampus, beban studi reguler maksimal adalah <strong>20 SKS</strong>. Anda dapat mengurangi pilihan rombel di atas atau klik <strong>"Drop"</strong> pada mata kuliah di bawah untuk mengeluarkan jadwal berlebih.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAutoFitSks}
                  className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Otomatis keluarkan mata kuliah tambahan sampai SKS <= 20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Otomatis Sesuaikan ke ≤ 20 SKS</span>
                </button>
              </div>
            )}

            {/* Notice if exclusions exist and SKS is compliant */}
            {!isExceeding20Sks && excludedScheduleIds.length > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2 text-emerald-900 text-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Beban SKS telah disesuaikan: <strong>{totalLinkedSks} SKS</strong> (Terdapat {excludedScheduleIds.length} mata kuliah yang di-drop).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetExclusions}
                  className="text-[11px] text-emerald-800 hover:text-emerald-950 font-bold underline cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset Kembali Semua</span>
                </button>
              </div>
            )}

            {linkedSchedules.length === 0 ? (
              <div className="py-6 text-center text-slate-500 bg-white/70 rounded-xl border border-indigo-100">
                <Calendar className="w-6 h-6 mx-auto text-slate-400 mb-1 opacity-60" />
                <p className="text-xs font-semibold text-slate-700">Belum ada jadwal yang terhubung</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Centang salah satu rombel di atas untuk melihat mata kuliah yang akan diikuti mahasiswa.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {linkedSchedules.map((sch) => {
                  const isExcluded = excludedScheduleIds.includes(sch.id);

                  return (
                    <div
                      key={sch.id}
                      className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                        isExcluded
                          ? 'bg-slate-100/90 border-slate-300 opacity-60'
                          : 'bg-white border-slate-200 shadow-2xs hover:border-indigo-300'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold truncate ${isExcluded ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                            {sch.courseName}
                          </span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-mono text-[10px] rounded">
                            {sch.courseCode}
                          </span>
                          <span className={`px-2 py-0.5 font-bold text-[10px] rounded ${
                            isExcluded
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {isExcluded ? '0 SKS (Di-drop)' : `${sch.sks} SKS`}
                          </span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded">
                            Rombel {sch.rombel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          Dosen: <strong className="text-slate-700 font-medium">{sch.lecturerName}</strong> · {sch.day}, {sch.startTime}-{sch.endTime} ({sch.room})
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isExcluded ? (
                          <button
                            type="button"
                            onClick={() => toggleExcludeSchedule(sch.id)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Ambil kembali mata kuliah ini"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Ambil Kembali (+{sch.sks} SKS)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleExcludeSchedule(sch.id)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Keluarkan/Drop mata kuliah ini untuk mengurangi SKS"
                          >
                            <Minus className="w-3.5 h-3.5" />
                            <span>Drop Mata Kuliah (-{sch.sks} SKS)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contact Details: Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Mahasiswa
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nim@student.stmik-arungbinang.ac.id"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                No. HP / WhatsApp (Opsional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {linkedSchedules.length} jadwal terhubung otomatis
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>{editingStudent ? 'Perbarui Data Mahasiswa' : 'Simpan & Hubungkan Jadwal'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
