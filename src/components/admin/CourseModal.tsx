import React, { useState, useEffect } from 'react';
import { Course, ProgramStudi, User, ScheduleItem } from '../../types/attendance';
import {
  X, BookOpen, GraduationCap, Award, Shield,
  AlertCircle, Check, Info, Archive, Calendar,
  CheckCircle2, Sparkles, Hash
} from 'lucide-react';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCourse?: Course | null;
  users: User[];
  schedules: ScheduleItem[];
  existingCourses: Course[];
  onSave: (courseData: Omit<Course, 'id'>) => void;
  onUpdate?: (id: string, courseData: Partial<Course>) => void;
}

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const SKS_OPTIONS = [1, 2, 3, 4, 6];

export const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  editingCourse,
  users,
  schedules,
  existingCourses,
  onSave,
  onUpdate,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sks, setSks] = useState<number>(2);
  const [semester, setSemester] = useState<number>(1);
  const [prodi, setProdi] = useState<ProgramStudi>('Teknologi Informasi');
  const [defaultLecturerId, setDefaultLecturerId] = useState('');
  const [defaultLecturerName, setDefaultLecturerName] = useState('');
  const [description, setDescription] = useState('');
  const [isArchived, setIsArchived] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Lecturers list from users
  const lecturers = users.filter(u => u.role === 'dosen');

  // Schedules currently linking to this course
  const linkedSchedules = editingCourse
    ? schedules.filter(s => s.courseCode.trim().toUpperCase() === editingCourse.code.trim().toUpperCase())
    : [];

  useEffect(() => {
    if (!isOpen) return;

    if (editingCourse) {
      setCode(editingCourse.code);
      setName(editingCourse.name);
      setSks(editingCourse.sks || 2);
      setSemester(editingCourse.semester || 1);
      setProdi(editingCourse.prodi || 'Teknologi Informasi');
      setDefaultLecturerId(editingCourse.defaultLecturerId || '');
      setDefaultLecturerName(editingCourse.defaultLecturerName || '');
      setDescription(editingCourse.description || '');
      setIsArchived(Boolean(editingCourse.isArchived));
    } else {
      setCode('');
      setName('');
      setSks(2);
      setSemester(1);
      setProdi('Teknologi Informasi');
      if (lecturers.length > 0) {
        setDefaultLecturerId(lecturers[0].id);
        setDefaultLecturerName(lecturers[0].name);
      } else {
        setDefaultLecturerId('');
        setDefaultLecturerName('');
      }
      setDescription('');
      setIsArchived(false);
    }
    setErrorMsg('');
  }, [isOpen, editingCourse, users]);

  const handleLecturerSelect = (lecturerId: string) => {
    setDefaultLecturerId(lecturerId);
    const found = lecturers.find(l => l.id === lecturerId);
    if (found) {
      setDefaultLecturerName(found.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      setErrorMsg('Kode Mata Kuliah wajib diisi (contoh: MKTI0101, MKMI0201).');
      return;
    }
    if (!cleanName) {
      setErrorMsg('Nama Mata Kuliah wajib diisi.');
      return;
    }

    // Check duplicate code if creating or changing code
    if (!editingCourse || editingCourse.code.toUpperCase() !== cleanCode) {
      const isDuplicate = existingCourses.some(
        c => c.code.trim().toUpperCase() === cleanCode && (!editingCourse || c.id !== editingCourse.id)
      );
      if (isDuplicate) {
        setErrorMsg(`Kode Mata Kuliah "${cleanCode}" sudah terdaftar dalam Master Database.`);
        return;
      }
    }

    const payload: Omit<Course, 'id'> = {
      code: cleanCode,
      name: cleanName,
      sks,
      semester,
      prodi,
      defaultLecturerId: defaultLecturerId || 'dosen-1',
      defaultLecturerName: defaultLecturerName || 'Dosen Pengampu',
      description: description.trim() || undefined,
      isArchived,
      archivedAt: isArchived ? (editingCourse?.archivedAt || new Date().toISOString()) : undefined,
    };

    if (editingCourse && onUpdate) {
      onUpdate(editingCourse.id, payload);
    } else {
      onSave(payload);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
                <Shield className="w-3.5 h-3.5" />
                <span>Master Kurikulum &amp; Mata Kuliah</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                {editingCourse ? `Edit Mata Kuliah: ${editingCourse.name}` : 'Tambah Master Mata Kuliah Baru'}
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

          {/* Relation indicator if editing */}
          {editingCourse && (
            <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-900">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Mata kuliah ini terhubung ke <strong>{linkedSchedules.length} Jadwal Perkuliahan</strong> aktif.
                </span>
              </div>
              {linkedSchedules.length > 0 && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold text-[11px]">
                  Sinkronisasi Otomatis
                </span>
              )}
            </div>
          )}

          {/* Row 1: Kode & SKS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kode Mata Kuliah <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: MKTI0101, MKMI0205"
                  className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Kode unik resmi sesuai kurikulum program studi</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Bobot SKS <span className="text-rose-500">*</span>
              </label>
              <select
                value={sks}
                onChange={(e) => setSks(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {SKS_OPTIONS.map((num) => (
                  <option key={num} value={num}>
                    {num} SKS
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Nama Mata Kuliah */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nama Mata Kuliah <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Pemrograman Web, Basis Data Lanjut"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Row 3: Program Studi & Semester */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Program Studi <span className="text-rose-500">*</span>
              </label>
              <select
                value={prodi}
                onChange={(e) => setProdi(e.target.value as ProgramStudi)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Teknologi Informasi">Teknologi Informasi (TI)</option>
                <option value="Manajemen Informatika">Manajemen Informatika (MI)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Semester Kurikulum <span className="text-rose-500">*</span>
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem} {sem % 2 === 1 ? '(Ganjil)' : '(Genap)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Dosen Pengampu Utama */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Dosen Pengampu Utama / Koordinator
            </label>
            <div className="space-y-2">
              <select
                value={defaultLecturerId}
                onChange={(e) => handleLecturerSelect(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Pilih dari Daftar Dosen Terdaftar --</option>
                {lecturers.map((lec) => (
                  <option key={lec.id} value={lec.id}>
                    {lec.name} {lec.nidn ? `(NIDN: ${lec.nidn})` : ''} - {lec.title || ''}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={defaultLecturerName}
                  onChange={(e) => setDefaultLecturerName(e.target.value)}
                  placeholder="Atau ketik nama dosen pengampu lengkap dengan gelar..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Deskripsi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Deskripsi / Silabus Ringkas (Opsional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Cakupan materi, kompetensi lulusan, atau prasyarat mata kuliah..."
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Row 6: Mekanisme Arsip Status */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isArchived ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                <Archive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Status Arsip Data
                </p>
                <p className="text-[11px] text-slate-500">
                  {isArchived
                    ? 'Mata kuliah diarsipkan: Tidak dapat dipilih untuk jadwal baru, namun riwayat historis tetap aman.'
                    : 'Mata kuliah aktif: Tersedia penuh dalam kurikulum dan formulir jadwal perkuliahan.'}
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
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{editingCourse ? 'Simpan Perubahan Mata Kuliah' : 'Simpan Master Mata Kuliah'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
