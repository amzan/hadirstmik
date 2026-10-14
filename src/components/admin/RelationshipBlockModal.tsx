import React from 'react';
import { ScheduleItem, Student, AttendanceSession } from '../../types/attendance';
import {
  ShieldAlert, AlertTriangle, Archive, Calendar, Users,
  ClipboardList, X, ArrowRight, ShieldCheck, CheckCircle2,
  Clock, MapPin, UserCheck
} from 'lucide-react';

interface RelationshipBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'rombel' | 'course' | 'student';
  entityName: string;
  entityId: string;
  entityCode?: string;
  schedules?: ScheduleItem[];
  students?: Student[];
  sessions?: AttendanceSession[];
  onArchive?: (idOrCode: string) => void;
  isAlreadyArchived?: boolean;
}

export const RelationshipBlockModal: React.FC<RelationshipBlockModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityName,
  entityId,
  entityCode,
  schedules = [],
  students = [],
  sessions = [],
  onArchive,
  isAlreadyArchived = false,
}) => {
  if (!isOpen) return null;

  const typeLabels = {
    rombel: 'Rombel Kelas',
    course: 'Master Mata Kuliah',
    student: 'Data Mahasiswa',
  };

  const handleArchiveClick = () => {
    if (onArchive) {
      onArchive(entityId || entityCode || '');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-rose-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with High-Impact Warning Banner */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white flex items-start justify-between shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/30 border border-rose-400/50 flex items-center justify-center text-rose-200 shrink-0 shadow-inner">
              <ShieldAlert className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>Pencegahan Penghapusan Data Terkait</span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-white mt-1">
                Data Tidak Dapat Dihapus
              </h3>
              <p className="text-xs text-rose-100/90 mt-0.5">
                {typeLabels[entityType]} <span className="font-bold underline text-white">{entityName}</span> memiliki relasi aktif di sistem.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1 text-slate-800">
          {/* Explanation Alert */}
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Integritas Relasi Akademik Terproteksi</p>
              <p className="mt-1 text-slate-700">
                Untuk mencegah kerusakan riwayat presensi, data KRS, dan jadwal perkuliahan, sistem melarang keras penghapusan data master yang masih terikat dengan data aktif lainnya.
              </p>
            </div>
          </div>

          {/* Detected Active Relations Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Daftar Relasi Aktif yang Terdeteksi:
            </h4>

            {/* 1. Linked Schedules */}
            {schedules.length > 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>Terhubung ke {schedules.length} Jadwal Perkuliahan</span>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-[11px]">
                    {schedules.length} Kelas
                  </span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {schedules.map((sch) => (
                    <div
                      key={sch.id}
                      className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {sch.courseName} <span className="text-slate-400 font-mono text-[11px]">({sch.courseCode})</span>
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {sch.day}, {sch.startTime}-{sch.endTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {sch.room}
                          </span>
                          <span>· Rombel: {sch.rombel}</span>
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                        {sch.lecturerName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Enrolled Students */}
            {students.length > 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Ditempati oleh {students.length} Mahasiswa Terdaftar</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[11px]">
                    {students.length} Mahasiswa
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                  {students.slice(0, 16).map((st) => (
                    <span
                      key={st.nim}
                      className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1"
                    >
                      <span className="font-mono text-slate-400 text-[10px]">{st.nim}</span>
                      <span>{st.name}</span>
                    </span>
                  ))}
                  {students.length > 16 && (
                    <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[11px] font-bold">
                      +{students.length - 16} mahasiswa lainnya
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 3. Attendance Sessions */}
            {sessions.length > 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <ClipboardList className="w-4 h-4 text-amber-600" />
                    <span>Riwayat Presensi: {sessions.length} Sesi Pertemuan</span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[11px]">
                    {sessions.length} Sesi
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Data kehadiran mahasiswa telah tercatat pada sesi ini dan tidak boleh hilang demi akuntabilitas akademik.
                </p>
              </div>
            )}
          </div>

          {/* Solution: Mekanisme Arsip Data Card */}
          <div className="p-4.5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300/80 rounded-2xl space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                  <span>Solusi Direkomendasikan: Arsipkan Data</span>
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-extrabold rounded-full">
                    Aman &amp; Teruji
                  </span>
                </h4>
                <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                  Dengan <strong>mengarsipkan data</strong>, entitas ini akan dinonaktifkan sehingga tidak dapat dipilih untuk kelas/jadwal baru di semester depan. Namun, <strong>seluruh riwayat mahasiswa, presensi, dan jadwal yang sudah ada tetap aman dan utuh</strong>. Anda dapat memulihkannya kembali kapan saja.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Tutup &amp; Batalkan
          </button>

          {!isAlreadyArchived && onArchive && (
            <button
              type="button"
              onClick={handleArchiveClick}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/30 flex items-center gap-2 transition cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>Arsipkan Data Ini Sekarang (Aman)</span>
            </button>
          )}

          {isAlreadyArchived && (
            <span className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              Data ini sudah berstatus diarsipkan
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
