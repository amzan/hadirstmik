import React, { useMemo } from 'react';
import { Student, ScheduleItem } from '../../types/attendance';
import { isStudentInRombel, getStudentRombelList, getStudentEnrolledSchedules } from '../../data/initialData';
import {
  X, Calendar, Clock, BookOpen, User, Building2,
  CheckCircle2, Sparkles, GraduationCap, Edit, ExternalLink,
  AlertTriangle, ShieldAlert
} from 'lucide-react';

interface StudentScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  schedules: ScheduleItem[];
  onEditStudent?: (student: Student) => void;
}

export const StudentScheduleDetailModal: React.FC<StudentScheduleDetailModalProps> = ({
  isOpen,
  onClose,
  student,
  schedules,
  onEditStudent,
}) => {
  if (!isOpen || !student) return null;

  const rombelList = student.rombels && student.rombels.length > 0
    ? student.rombels
    : getStudentRombelList(student.rombel);

  // Filter all active schedules matching this student's rombels, excluding any dropped
  const enrolledSchedules = useMemo(() => {
    return getStudentEnrolledSchedules(student, schedules);
  }, [student, schedules]);

  // Compute total SKS
  const totalSks = useMemo(() => {
    return enrolledSchedules.reduce((acc, sch) => acc + (sch.sks || 0), 0);
  }, [enrolledSchedules]);

  const isOverSks = totalSks > 20;

  // Group schedules by day
  const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const sortedSchedules = useMemo(() => {
    return [...enrolledSchedules].sort((a, b) => {
      const dayDiff = daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [enrolledSchedules]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isOverSks
                ? 'bg-rose-600/30 border-rose-500/50 text-rose-400'
                : 'bg-indigo-600/30 border-indigo-500/50 text-indigo-400'
            }`}>
              {isOverSks ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <GraduationCap className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                <span className="font-mono text-indigo-300">NIM {student.nim}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-300">{student.prodi}</span>
                {isOverSks && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-2xs animate-pulse">
                    ⚠️ Flag: &gt;20 SKS ({totalSks} SKS)
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                {student.name}
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

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Warning Banner if SKS > 20 */}
          {isOverSks && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-950 shadow-xs animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-rose-900">
                      Peringatan Beban SKS Berlebih: {totalSks} SKS
                    </h4>
                    <span className="px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 text-[10px] font-bold">
                      Melebihi Batas 20 SKS
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    Mahasiswa ini terdaftar pada total <strong>{totalSks} SKS</strong> (melebihi batas akademik 20 SKS). Admin dapat menyesuaikan pilihan rombel atau mengecualikan mata kuliah untuk menurunkan beban studi mahasiswa.
                  </p>
                </div>
              </div>

              {onEditStudent && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditStudent(student);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 transition flex items-center gap-1.5 shadow-xs cursor-pointer w-full sm:w-auto justify-center"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Ubah Rombel / SKS Mahasiswa</span>
                </button>
              )}
            </div>
          )}

          {/* Rombel Enrolled & Metrics Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 block">
                Rombel / Kelas Mahasiswa:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {rombelList.map((r) => (
                  <span
                    key={r}
                    className="px-3 py-1 rounded-xl bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 shadow-2xs"
                  >
                    Rombel {r}
                  </span>
                ))}
                {rombelList.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold">
                    Multi-Rombel ({rombelList.length} Rombel)
                  </span>
                )}
                {student.excludedScheduleIds && student.excludedScheduleIds.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                    {student.excludedScheduleIds.length} Mata Kuliah Dikecualikan
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
              <div className="text-center px-3 py-1.5 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Total Jadwal</span>
                <strong className="text-sm font-bold text-slate-900">{enrolledSchedules.length} Kelas</strong>
              </div>
              <div className={`text-center px-3 py-1.5 rounded-xl border ${
                isOverSks
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-white border-slate-200 text-indigo-700'
              }`}>
                <span className="text-[10px] uppercase tracking-wider block font-medium opacity-80">
                  {isOverSks ? 'Beban Berlebih' : 'Beban Studi'}
                </span>
                <strong className="text-sm font-bold flex items-center justify-center gap-1">
                  {isOverSks && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                  <span>{totalSks} SKS</span>
                </strong>
              </div>
            </div>
          </div>

          {/* Connected Schedules Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Mata Kuliah & Jadwal yang Diikuti ({enrolledSchedules.length})</span>
              </h4>
              <span className="text-xs text-slate-500">
                Otomatis terhubung dari rombel mahasiswa
              </span>
            </div>

            {sortedSchedules.length === 0 ? (
              <div className="py-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                <Calendar className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
                <p className="text-sm font-semibold text-slate-700">Tidak ada jadwal perkuliahan terhubung</p>
                <p className="text-xs text-slate-500 mt-1">
                  Pastikan rombel mahasiswa cocok dengan rombel pada jadwal mata kuliah yang ada.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse min-w-[580px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">Hari & Jam</th>
                      <th className="py-2.5 px-3">Kode</th>
                      <th className="py-2.5 px-3">Mata Kuliah</th>
                      <th className="py-2.5 px-3 text-center">SKS</th>
                      <th className="py-2.5 px-3">Dosen Pengampu</th>
                      <th className="py-2.5 px-3">Ruangan</th>
                      <th className="py-2.5 px-3">Rombel Jadwal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedSchedules.map((sch) => (
                      <tr key={sch.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {sch.day}, {sch.startTime} - {sch.endTime}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{sch.courseCode}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{sch.courseName}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">
                            {sch.sks}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{sch.lecturerName}</td>
                        <td className="py-2.5 px-3 font-mono text-purple-700">{sch.room}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                            {sch.rombel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Email: <strong className="font-mono text-slate-700">{student.email}</strong>
            {student.phone && <> · HP: <strong className="font-mono text-slate-700">{student.phone}</strong></>}
          </div>

          <div className="flex items-center gap-2">
            {onEditStudent && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditStudent(student);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                  isOverSks
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-2xs'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}
              >
                <Edit className="w-3.5 h-3.5" />
                <span>{isOverSks ? '⚡ Ubah Rombel & Sesuaikan SKS' : 'Ubah Rombel / Edit Mahasiswa'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
