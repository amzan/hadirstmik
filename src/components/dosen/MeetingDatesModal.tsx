import React, { useState, useEffect } from 'react';
import { ScheduleItem } from '../../types/attendance';
import { useAttendance } from '../../context/AttendanceContext';
import { X, Calendar, Sparkles, Check, Clock, CheckCircle2 } from 'lucide-react';

interface MeetingDatesModalProps {
  schedule: ScheduleItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MeetingDatesModal: React.FC<MeetingDatesModalProps> = ({
  schedule,
  isOpen,
  onClose,
}) => {
  const {
    sessions,
    setScheduleAllMeetingDates,
    getMeetingDateForSchedule,
  } = useAttendance();

  const [dates, setDates] = useState<Record<number, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize dates for 16 meetings when schedule opens
  useEffect(() => {
    if (!schedule || !isOpen) return;

    const initialDates: Record<number, string> = {};
    for (let m = 1; m <= 16; m++) {
      initialDates[m] = getMeetingDateForSchedule(schedule, m);
    }
    setDates(initialDates);
    setSaveSuccess(false);
  }, [schedule, isOpen, getMeetingDateForSchedule]);

  if (!schedule || !isOpen) return null;

  const handleDateChange = (meetingNumber: number, newDate: string) => {
    setDates(prev => ({
      ...prev,
      [meetingNumber]: newDate,
    }));
  };

  // Helper to auto-generate weekly recurring dates starting from Pertemuan 1
  const handleAutoWeeklyFill = () => {
    const p1DateStr = dates[1] || getMeetingDateForSchedule(schedule, 1);
    const p1Date = new Date(p1DateStr);

    if (isNaN(p1Date.getTime())) return;

    const newDates: Record<number, string> = { ...dates };
    for (let m = 1; m <= 16; m++) {
      const nextDate = new Date(p1Date.getTime() + (m - 1) * 7 * 24 * 60 * 60 * 1000);
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dd = String(nextDate.getDate()).padStart(2, '0');
      newDates[m] = `${yyyy}-${mm}-${dd}`;
    }

    setDates(newDates);
  };

  const handleSave = () => {
    setScheduleAllMeetingDates(schedule.id, dates);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Kalender Jadwal Pertemuan</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700">{schedule.courseCode}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
              {schedule.courseName} ({schedule.rombel})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ruang {schedule.room} · Hari {schedule.day}, {schedule.startTime}–{schedule.endTime} WIB
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Auto generation info */}
        <div className="px-6 py-3 bg-blue-50/70 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-blue-900 font-medium">
            Tiap tanggal yang Anda tentukan di bawah ini akan terhubung langsung ke pertemuan perkuliahan yang dipilih.
          </p>

          <button
            type="button"
            onClick={handleAutoWeeklyFill}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Isi otomatis tiap minggu (+7 hari) dimulai dari tanggal Pertemuan 1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Otomatis Mingguan (+7 Hari)</span>
          </button>
        </div>

        {/* Body: 16 Meetings List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {Array.from({ length: 16 }, (_, i) => i + 1).map((m) => {
              const dateVal = dates[m] || '';
              const existingSession = sessions.find(
                s => s.courseCode === schedule.courseCode &&
                     s.rombel === schedule.rombel &&
                     s.meetingNumber === m
              );

              const isUts = m === 8;
              const isUas = m === 16;

              return (
                <div
                  key={m}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                    existingSession?.isOpen
                      ? 'bg-emerald-50/60 border-emerald-300'
                      : existingSession && !existingSession.isOpen
                      ? 'bg-slate-50 border-slate-200'
                      : isUts || isUas
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900">
                        Pertemuan {m}
                      </span>
                      {isUts && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          UTS
                        </span>
                      )}
                      {isUas && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          UAS
                        </span>
                      )}
                      {existingSession ? (
                        existingSession.isOpen ? (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Aktif
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500">
                            ✓ Selesai
                          </span>
                        )
                      ) : null}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {formatDateIndo(dateVal)}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <input
                      type="date"
                      value={dateVal}
                      onChange={(e) => handleDateChange(m, e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {saveSuccess ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Tanggal pertemuan berhasil diperbarui!
              </span>
            ) : (
              '16 Pertemuan perkuliahan Semester Ganjil 2026/2027'
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-200/70 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Tanggal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
