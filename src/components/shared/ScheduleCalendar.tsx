import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { DayOfWeek, ProgramStudi, ScheduleItem } from '../../types/attendance';
import { Calendar, Clock, MapPin, Users, Play } from 'lucide-react';

interface ScheduleCalendarProps {
  onSelectScheduleForSession?: (schedule: ScheduleItem) => void;
}

const DAYS: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({ onSelectScheduleForSession }) => {
  const { schedules, currentUser, activeDay, simulatedTime } = useAttendance();
  const [selectedProdi, setSelectedProdi] = useState<'ALL' | ProgramStudi>('ALL');
  const [activeTabDay, setActiveTabDay] = useState<DayOfWeek>(activeDay);

  const filteredSchedules = schedules.filter(item => {
    const matchesProdi = selectedProdi === 'ALL' || item.prodi === selectedProdi;
    const matchesDay = item.day === activeTabDay;
    return matchesProdi && matchesDay;
  });

  // Sort by startTime
  filteredSchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const isScheduleActiveNow = (item: ScheduleItem) => {
    if (activeDay !== item.day) return false;
    return simulatedTime >= item.startTime && simulatedTime <= item.endTime;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Calendar Header */}
      <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-800" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Jadwal Kuliah Semester Ganjil 2026/2027
            </h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Acuan sinkronisasi otomatis status presensi kelas STMIK PGRI Arungbinang Kebumen
          </p>
        </div>

        {/* Prodi filter buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-sm font-medium">
          <button
            onClick={() => setSelectedProdi('ALL')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              selectedProdi === 'ALL'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Prodi
          </button>
          <button
            onClick={() => setSelectedProdi('Teknologi Informasi')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              selectedProdi === 'Teknologi Informasi'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Teknologi Informasi
          </button>
          <button
            onClick={() => setSelectedProdi('Manajemen Informatika')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              selectedProdi === 'Manajemen Informatika'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manajemen Informatika
          </button>
        </div>
      </div>

      {/* Day Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto bg-white px-6">
        {DAYS.map((day) => {
          const count = schedules.filter(s => s.day === day && (selectedProdi === 'ALL' || s.prodi === selectedProdi)).length;
          const isToday = day === activeDay;
          const isActive = day === activeTabDay;

          return (
            <button
              key={day}
              onClick={() => setActiveTabDay(day)}
              className={`py-3 px-5 font-semibold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{day}</span>
              {isToday && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Hari aktif"></span>
              )}
              <span className="text-xs text-slate-400">
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Schedule list */}
      <div className="p-5 sm:p-6 divide-y divide-slate-100">
        {filteredSchedules.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Tidak ada jadwal perkuliahan untuk kriteria yang dipilih.
          </div>
        ) : (
          filteredSchedules.map((item) => {
            const isLive = isScheduleActiveNow(item);
            const isMyClass = currentUser.role === 'dosen' && item.lecturerId === currentUser.id;

            return (
              <div
                key={item.id}
                className={`py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all rounded-xl p-3.5 ${
                  isLive
                    ? 'bg-emerald-50/50 border border-emerald-300'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg flex flex-col items-center justify-center shrink-0 w-28 text-center ${
                    isLive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                  }`}>
                    <span className="text-xs font-mono font-bold">{item.startTime}</span>
                    <span className="text-xs opacity-70">s/d</span>
                    <span className="text-xs font-mono font-bold">{item.endTime}</span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono font-bold text-slate-900">
                        {item.courseCode}
                      </span>
                      <h4 className="font-bold text-slate-900 text-base">
                        {item.courseName}
                      </h4>
                      {isLive && (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Sedang Berlangsung
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mt-1">
                      <span>Dosen: <strong>{item.lecturerName}</strong></span>
                      <span>·</span>
                      <span>Ruang: <strong>{item.room}</strong></span>
                      <span>·</span>
                      <span>Rombel: <strong>{item.rombel}</strong></span>
                      <span>·</span>
                      <span>{item.sks} SKS</span>
                    </div>
                  </div>
                </div>

                {onSelectScheduleForSession && isMyClass && (
                  <button
                    onClick={() => onSelectScheduleForSession(item)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer self-start sm:self-center"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Buka Sesi Ini</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
