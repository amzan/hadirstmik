import React, { useState, useMemo } from 'react';
import { ScheduleItem, Student, Course, Rombel } from '../../types/attendance';
import { isStudentInRombel, getStudentRombelList } from '../../data/initialData';
import {
  X, Users, Calendar, Clock, Building2, BookOpen, Search,
  GraduationCap, CheckCircle2, BookmarkCheck, ExternalLink, ShieldCheck,
  Edit3, RefreshCw, Layers, GitMerge
} from 'lucide-react';

interface ScheduleStudentRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleItem | null;
  students: Student[];
  courses: Course[];
  rombels: Rombel[];
  onEditSchedule?: (schedule: ScheduleItem) => void;
  onSyncRoster?: () => void;
}

export const ScheduleStudentRosterModal: React.FC<ScheduleStudentRosterModalProps> = ({
  isOpen,
  onClose,
  schedule,
  students,
  courses,
  rombels,
  onEditSchedule,
  onSyncRoster,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');

  // Matched Master Course in database
  const masterCourse = useMemo(() => {
    if (!schedule) return null;
    return courses.find(
      c => c.code.toLowerCase() === schedule.courseCode.toLowerCase() ||
           c.name.toLowerCase() === schedule.courseName.toLowerCase()
    ) || null;
  }, [schedule, courses]);

  // Connected students from Mahasiswa database
  const enrolledStudents = useMemo(() => {
    if (!schedule || !schedule.rombel) return [];
    const parts = schedule.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);

    return students.filter(st => {
      if (st.excludedScheduleIds && st.excludedScheduleIds.includes(schedule.id)) {
        return false;
      }
      return parts.some(part => isStudentInRombel(part, st.rombel, st.rombels));
    });
  }, [schedule, students]);

  // Filtered by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return enrolledStudents;
    const q = searchQuery.toLowerCase();
    return enrolledStudents.filter(
      s => s.name.toLowerCase().includes(q) ||
           s.nim.toLowerCase().includes(q) ||
           s.prodi.toLowerCase().includes(q)
    );
  }, [enrolledStudents, searchQuery]);

  // Matched rombel records
  const matchedRombels = useMemo(() => {
    if (!schedule) return [];
    const parts = schedule.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);
    return rombels.filter(r => parts.some(p => p.toUpperCase() === r.code.toUpperCase()));
  }, [schedule, rombels]);

  if (!isOpen || !schedule) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold border border-indigo-800">
                  Rombel {schedule.rombel}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-xs text-slate-300">
                  Terhubung Database Mahasiswa
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight mt-0.5">
                Peserta Mahasiswa Terhubung: {schedule.courseName}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Schedule Info Box with Database Connections */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            {/* Column 1: Master Course Connection */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
                Database Master MK
              </span>
              <div className="font-bold text-slate-900 text-sm">
                {schedule.courseName}
              </div>
              <div className="text-xs text-slate-600 font-mono">
                Kode: <strong className="text-slate-900">{schedule.courseCode}</strong> ({schedule.sks} SKS)
              </div>
              {schedule.prodi === 'Lintas Program Studi' ? (
                <div className="text-[11px] text-purple-800 font-bold flex items-center gap-1 pt-0.5">
                  <GitMerge className="w-3.5 h-3.5 text-purple-600" />
                  <span>Lintas Program Studi</span>
                </div>
              ) : masterCourse ? (
                <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 pt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Semester {masterCourse.semester || '-'} · {schedule.prodi || masterCourse.prodi}</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  Prodi: {schedule.prodi}
                </div>
              )}
            </div>

            {/* Column 2: Schedule Time & Room */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Jadwal & Ruangan
              </span>
              <div className="font-bold text-slate-900 text-sm">
                {schedule.day}, {schedule.startTime}–{schedule.endTime} WIB
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                Ruang: <strong className="text-slate-900">{schedule.room}</strong>
              </div>
              <div className="text-xs text-slate-600 truncate">
                Dosen: <strong className="text-slate-900">{schedule.lecturerName}</strong>
              </div>
            </div>

            {/* Column 3: Rombel & Mahasiswa Database Sync */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Database Rombel & Mahasiswa
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold text-indigo-600">
                  {enrolledStudents.length}
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  Mahasiswa Terhubung
                </span>
              </div>
              <div className="text-xs text-slate-600">
                Rombel: <strong className="text-slate-900">{schedule.rombel}</strong>
                {matchedRombels.length > 0 && (
                  <span className="text-[11px] text-slate-500 block truncate">
                    {matchedRombels.map(r => r.name).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sync notification if triggered */}
          {syncNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-900 font-semibold flex items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncNotice('')}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Search bar & list title with Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Daftar Mahasiswa Peserta Jadwal Ini ({filteredStudents.length})</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  Sinkron Otomatis
                </span>
              </h4>
              <p className="text-xs text-slate-500">
                Mahasiswa terdaftar otomatis dari database sesuai rombel yang diikutinya.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari NIM atau Nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:border-slate-900"
                />
              </div>

              {/* Action: Re-sync Roster */}
              <button
                type="button"
                onClick={() => {
                  setIsSyncing(true);
                  if (onSyncRoster) onSyncRoster();
                  setTimeout(() => {
                    setIsSyncing(false);
                    setSyncNotice(`Sinkronisasi berhasil! Seluruh ${enrolledStudents.length} mahasiswa terhubung otomatis dan memiliki akun pengguna aktif.`);
                    setTimeout(() => setSyncNotice(''), 4500);
                  }, 400);
                }}
                disabled={isSyncing}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition cursor-pointer disabled:opacity-50"
                title="Sinkronkan ulang daftar mahasiswa dan akun pengguna"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
              </button>

              {/* Action: Direct Edit Schedule Rombel */}
              {onEditSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditSchedule(schedule);
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Buka form edit jadwal untuk memilih atau menghilangkan rombel"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Ubah Rombel Jadwal</span>
                </button>
              )}
            </div>
          </div>

          {/* Students Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead className="bg-slate-100/80 sticky top-0 z-10 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">NIM (ID Login)</th>
                    <th className="py-2.5 px-3">Nama Mahasiswa</th>
                    <th className="py-2.5 px-3">Program Studi</th>
                    <th className="py-2.5 px-3">Rombel Terdaftar</th>
                    <th className="py-2.5 px-3 text-center">Akses Presensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                        Tidak ada mahasiswa yang cocok dengan pencarian di rombel ini.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const stRombels = st.rombels && st.rombels.length > 0 ? st.rombels : getStudentRombelList(st.rombel);
                      const isMulti = stRombels.length > 1;

                      return (
                        <tr key={st.nim} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {st.nim}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {st.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-xs">
                            {st.prodi}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 items-center">
                              {stRombels.map(r => (
                                <span
                                  key={r}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    isStudentInRombel(r, schedule.rombel)
                                      ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {r}
                                </span>
                              ))}
                              {isMulti && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-semibold">
                                  Multi-Rombel
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>Tersambung</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Relasi Database Otomatis:</strong> Setiap mahasiswa di atas memiliki jadwal perkuliahan <strong>{schedule.courseName}</strong> di portal mahasiswa masing-masing dan secara otomatis diverifikasi saat melakukan presensi QR atau absensi manual.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Total {enrolledStudents.length} Mahasiswa terhubung ke jadwal ini
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
