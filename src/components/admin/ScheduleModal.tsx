import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleItem, User, Course, DayOfWeek, ProgramStudi } from '../../types/attendance';
import {
  Calendar, Clock, Building2, BookOpen, UserCheck, AlertCircle,
  CheckCircle2, Sparkles, Filter, Check, X, Info, ChevronRight
} from 'lucide-react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSchedule?: ScheduleItem | null;
  schedules: ScheduleItem[];
  users: User[];
  courses: Course[];
  onSave: (scheduleData: Omit<ScheduleItem, 'id'>) => void;
  onUpdate?: (id: string, scheduleData: Partial<ScheduleItem>) => void;
}

// Campus Workdays for scheduling
export const WORKDAYS: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

// Campus Standard Rooms
export const DEFAULT_CAMPUS_ROOMS = ['RK 1', 'RK 2', 'LAB 1', 'LAB 2', 'Ruang Seminar'];

// Convert "HH:mm" to minutes from midnight
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Convert minutes to "HH:mm"
export const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Check if two time intervals overlap
export const isTimeOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean => {
  const a1 = timeToMinutes(startA);
  const a2 = timeToMinutes(endA);
  const b1 = timeToMinutes(startB);
  const b2 = timeToMinutes(endB);
  return a1 < b2 && a2 > b1;
};

export interface RecommendedSlot {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string;
  durationMinutes: number;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  editingSchedule,
  schedules,
  users,
  courses,
  onSave,
  onUpdate,
}) => {
  const [day, setDay] = useState<DayOfWeek>('Senin');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:40');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [sks, setSks] = useState<number>(2);
  const [lecturerId, setLecturerId] = useState('');
  const [room, setRoom] = useState('RK 2');
  const [rombel, setRombel] = useState('TI 3');
  const [prodi, setProdi] = useState<ProgramStudi>('Teknologi Informasi');

  // UI state
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [filterRecDay, setFilterRecDay] = useState<string>('ALL');
  const [filterRecRoom, setFilterRecRoom] = useState<string>('ALL');
  const [formError, setFormError] = useState<string>('');

  // Collect all unique rooms currently used or standard
  const availableRooms = useMemo(() => {
    const set = new Set<string>(DEFAULT_CAMPUS_ROOMS);
    schedules.forEach(s => {
      if (s.room) set.add(s.room.trim());
    });
    return Array.from(set);
  }, [schedules]);

  // Lecturer list
  const lecturers = useMemo(() => {
    return users.filter(u => u.role === 'dosen');
  }, [users]);

  // Populate form on edit or new
  useEffect(() => {
    if (editingSchedule) {
      setDay(editingSchedule.day);
      setStartTime(editingSchedule.startTime);
      setEndTime(editingSchedule.endTime);
      setCourseCode(editingSchedule.courseCode);
      setCourseName(editingSchedule.courseName);
      setSks(editingSchedule.sks);
      setLecturerId(editingSchedule.lecturerId);
      setRoom(editingSchedule.room);
      setRombel(editingSchedule.rombel);
      setProdi(editingSchedule.prodi);
      setFormError('');
    } else {
      setDay('Senin');
      setStartTime('09:00');
      setEndTime('10:40');
      setCourseCode('');
      setCourseName('');
      setSks(2);
      setLecturerId(lecturers[0]?.id || 'dosen-3');
      setRoom('RK 2');
      setRombel('TI 3');
      setProdi('Teknologi Informasi');
      setFormError('');
    }
    setShowRecommendations(false);
  }, [editingSchedule, isOpen, lecturers]);

  // Sync end time when SKS or start time changes if not editing
  const handleSksChange = (newSks: number) => {
    setSks(newSks);
    const startMins = timeToMinutes(startTime);
    const duration = newSks === 1 ? 50 : newSks === 3 ? 150 : newSks === 4 ? 200 : 100;
    const newEndMins = Math.min(startMins + duration, 19 * 60); // Cap at 19:00
    setEndTime(minutesToTime(newEndMins));
  };

  // Rule 1: "tidak boleh ada jadwal baru dengan Kode & Mata kuliah yang sama."
  const duplicateCourseConflict = useMemo(() => {
    const cleanCode = courseCode.trim().toLowerCase();
    const cleanName = courseName.trim().toLowerCase();
    if (!cleanCode && !cleanName) return null;

    return schedules.find(s => {
      // Exclude self if editing
      if (editingSchedule && s.id === editingSchedule.id) return false;
      const matchCode = cleanCode && s.courseCode.trim().toLowerCase() === cleanCode;
      const matchName = cleanName && s.courseName.trim().toLowerCase() === cleanName;
      return matchCode || matchName;
    });
  }, [schedules, courseCode, courseName, editingSchedule]);

  // Rule 2: "Ruang dan Hari & Jam jadwal baru tidak boleh sama dengan jadwal yang sudah di-input."
  const roomScheduleConflict = useMemo(() => {
    const cleanRoom = room.trim().toLowerCase();
    if (!cleanRoom || !day || !startTime || !endTime) return null;

    return schedules.find(s => {
      // Exclude self if editing
      if (editingSchedule && s.id === editingSchedule.id) return false;
      // Must be same day and same room
      if (s.day !== day) return false;
      if (s.room.trim().toLowerCase() !== cleanRoom) return false;
      // Check time interval overlap
      return isTimeOverlap(startTime, endTime, s.startTime, s.endTime);
    });
  }, [schedules, day, room, startTime, endTime, editingSchedule]);

  // Optional: Lecturer time conflict check
  const lecturerTimeConflict = useMemo(() => {
    if (!lecturerId || !day || !startTime || !endTime) return null;

    return schedules.find(s => {
      if (editingSchedule && s.id === editingSchedule.id) return false;
      if (s.day !== day) return false;
      if (s.lecturerId !== lecturerId) return false;
      return isTimeOverlap(startTime, endTime, s.startTime, s.endTime);
    });
  }, [schedules, day, lecturerId, startTime, endTime, editingSchedule]);

  // Operating Hours check (Senin-Jumat : 09.00 - 19.00 WIB)
  const isOutsideOperatingHours = useMemo(() => {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    const openMins = 9 * 60; // 09:00
    const closeMins = 19 * 60; // 19:00

    const isWeekend = day === 'Sabtu';
    const isOutOfTime = startMins < openMins || endMins > closeMins || startMins >= endMins;
    return isWeekend || isOutOfTime;
  }, [day, startTime, endTime]);

  // System Recommendation Engine:
  // "Sistem bisa merekomendasikan hari, jam, dan ruangan yang tersedia pada hari kerja Senin-Jumat : 09.00 - 19.00 WIB"
  const recommendedSlots: RecommendedSlot[] = useMemo(() => {
    const slots: RecommendedSlot[] = [];
    const duration = sks === 1 ? 50 : sks === 3 ? 150 : 100; // minutes

    // Standard starting time blocks between 09:00 and 19:00
    const candidateStartTimes =
      duration === 150
        ? ['09:00', '13:00', '15:45']
        : ['09:00', '10:45', '13:00', '14:45', '16:30', '17:15'];

    for (const d of WORKDAYS) {
      for (const r of availableRooms) {
        for (const cStart of candidateStartTimes) {
          const startM = timeToMinutes(cStart);
          const endM = startM + duration;
          if (endM > 19 * 60) continue; // Exceeds 19:00 WIB

          const cEnd = minutesToTime(endM);

          // Check if room is in conflict on this day/time
          const hasRoomCollision = schedules.some(s => {
            if (editingSchedule && s.id === editingSchedule.id) return false;
            return s.day === d && s.room.trim().toLowerCase() === r.trim().toLowerCase() &&
                   isTimeOverlap(cStart, cEnd, s.startTime, s.endTime);
          });

          // Check if lecturer is free (if lecturer selected)
          const hasLecturerCollision = lecturerId ? schedules.some(s => {
            if (editingSchedule && s.id === editingSchedule.id) return false;
            return s.day === d && s.lecturerId === lecturerId &&
                   isTimeOverlap(cStart, cEnd, s.startTime, s.endTime);
          }) : false;

          if (!hasRoomCollision && !hasLecturerCollision) {
            slots.push({
              day: d,
              startTime: cStart,
              endTime: cEnd,
              room: r,
              durationMinutes: duration,
            });
          }
        }
      }
    }

    return slots;
  }, [schedules, availableRooms, sks, lecturerId, editingSchedule]);

  // Filtered recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendedSlots.filter(slot => {
      const matchDay = filterRecDay === 'ALL' || slot.day === filterRecDay;
      const matchRoom = filterRecRoom === 'ALL' || slot.room === filterRecRoom;
      return matchDay && matchRoom;
    });
  }, [recommendedSlots, filterRecDay, filterRecRoom]);

  // Apply a recommended slot
  const handleApplyRecommendation = (slot: RecommendedSlot) => {
    setDay(slot.day);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setRoom(slot.room);
    setFormError('');
    setShowRecommendations(false);
  };

  // Quick fill from Master Courses catalog
  const handleSelectMasterCourse = (selectedCourseId: string) => {
    const found = courses.find(c => c.id === selectedCourseId);
    if (found) {
      setCourseCode(found.code);
      setCourseName(found.name);
      handleSksChange(found.sks);
      setProdi(found.prodi);
      if (found.defaultLecturerId) {
        setLecturerId(found.defaultLecturerId);
      }
    }
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation 1: Required fields
    if (!courseCode.trim() || !courseName.trim()) {
      setFormError('Kode MK dan Nama Mata Kuliah wajib diisi.');
      return;
    }

    if (!room.trim()) {
      setFormError('Ruang perkuliahan wajib ditentukan.');
      return;
    }

    // Validation 2: Time sanity
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      setFormError('Jam mulai perkuliahan harus lebih awal dari jam selesai.');
      return;
    }

    // Rule 1 Enforcement:
    if (duplicateCourseConflict) {
      setFormError(
        `Aturan 1 Dilanggar: Jadwal untuk Kode MK "${duplicateCourseConflict.courseCode}" atau Mata Kuliah "${duplicateCourseConflict.courseName}" sudah ada dalam jadwal perkuliahan. Tidak boleh ada jadwal baru dengan Kode & Mata kuliah yang sama.`
      );
      return;
    }

    // Rule 2 Enforcement:
    if (roomScheduleConflict) {
      setFormError(
        `Aturan 2 Dilanggar: Ruang "${roomScheduleConflict.room}" sudah terpakai pada hari ${roomScheduleConflict.day} pukul ${roomScheduleConflict.startTime}–${roomScheduleConflict.endTime} untuk mata kuliah "${roomScheduleConflict.courseName}" (Rombel ${roomScheduleConflict.rombel}). Ruang, hari, dan jam tidak boleh sama dengan jadwal yang sudah di-input.`
      );
      return;
    }

    const lecturer = users.find(u => u.id === lecturerId);
    const lecturerName = lecturer?.name || 'Dosen Pengampu';

    const scheduleData: Omit<ScheduleItem, 'id'> = {
      day,
      startTime,
      endTime,
      courseCode: courseCode.trim().toUpperCase(),
      courseName: courseName.trim(),
      sks,
      lecturerId,
      lecturerName,
      room: room.trim().toUpperCase(),
      rombel: rombel.trim(),
      prodi,
    };

    if (editingSchedule && onUpdate) {
      onUpdate(editingSchedule.id, scheduleData);
    } else {
      onSave(scheduleData);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white shrink-0">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="text-xs text-indigo-300 font-semibold tracking-wider uppercase block">
                Manajemen Akademik BAAK
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                {editingSchedule ? 'Edit Jadwal Kuliah' : 'Tambah Jadwal Perkuliahan Baru'}
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

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Form Error Alert */}
          {formError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-rose-900">Perhatian Validasi Jadwal</div>
                <div className="leading-relaxed">{formError}</div>
              </div>
            </div>
          )}

          {/* Quick Select from Master Courses */}
          {!editingSchedule && courses.length > 0 && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-slate-600" />
                  Pilih Cepat dari Master Mata Kuliah
                </span>
                <span className="text-[11px] text-slate-400">Opsional</span>
              </div>
              <select
                onChange={(e) => handleSelectMasterCourse(e.target.value)}
                defaultValue=""
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-800 font-medium focus:outline-none focus:border-slate-900"
              >
                <option value="">-- Pilih Mata Kuliah untuk Isi Otomatis --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name} ({c.sks} SKS · {c.prodi})
                  </option>
                ))}
              </select>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* SECTION 1: Mata Kuliah & Kode */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Mata Kuliah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="MKTI0109"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono font-semibold placeholder:text-slate-400 focus:outline-none focus:border-slate-900 uppercase"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Mata Kuliah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Contoh: Matematika Diskrit"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Rule 1 Live Feedback */}
              {duplicateCourseConflict ? (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Aturan 1 (Bentrok):</strong> Kode MK atau Nama ini sudah terdaftar pada jadwal hari {duplicateCourseConflict.day} ({duplicateCourseConflict.startTime}–{duplicateCourseConflict.endTime}).
                  </span>
                </div>
              ) : courseCode.trim() ? (
                <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 pt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Aturan 1 Terpenuhi: Kode & Mata kuliah unik (belum pernah dijadwalkan).</span>
                </div>
              ) : null}
            </div>

            {/* SKS & Program Studi & Rombel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bobot SKS
                </label>
                <select
                  value={sks}
                  onChange={(e) => handleSksChange(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                >
                  <option value={1}>1 SKS (50 Menit)</option>
                  <option value={2}>2 SKS (100 Menit)</option>
                  <option value={3}>3 SKS (150 Menit)</option>
                  <option value={4}>4 SKS (200 Menit)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Program Studi
                </label>
                <select
                  value={prodi}
                  onChange={(e) => setProdi(e.target.value as ProgramStudi)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                >
                  <option value="Teknologi Informasi">Teknologi Informasi</option>
                  <option value="Manajemen Informatika">Manajemen Informatika</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kelas / Rombel
                </label>
                <input
                  type="text"
                  value={rombel}
                  onChange={(e) => setRombel(e.target.value)}
                  placeholder="TI 3 / MI 5"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 font-medium"
                  required
                />
              </div>
            </div>

            {/* Dosen Pengampu */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dosen Pengampu Perkuliahan
              </label>
              <select
                value={lecturerId}
                onChange={(e) => setLecturerId(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:border-slate-900"
              >
                {lecturers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} (NIDN: {d.username})
                  </option>
                ))}
              </select>
            </div>

            {/* SECTION 2: Hari, Waktu & Ruangan (Rule 2) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-700" />
                  Waktu & Ruangan Perkuliahan
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Senin–Jumat : 09.00–19.00 WIB
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Hari Kuliah
                  </label>
                  <select
                    value={day}
                    onChange={(e) => setDay(e.target.value as DayOfWeek)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    {WORKDAYS.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                    <option value="Sabtu">Sabtu (Khusus)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Ruangan
                  </label>
                  <input
                    type="text"
                    list="room-suggestions"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="RK 2 / LAB 1"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 uppercase"
                    required
                  />
                  <datalist id="room-suggestions">
                    {availableRooms.map(r => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Rule 2 Live Conflict Indicator */}
              {roomScheduleConflict ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Bentrok Jadwal Ruang (Aturan 2 Dilanggar):</span>
                  </div>
                  <p className="leading-relaxed">
                    Ruang <strong>{roomScheduleConflict.room}</strong> sudah digunakan pada hari <strong>{roomScheduleConflict.day}</strong> pukul <strong>{roomScheduleConflict.startTime}–{roomScheduleConflict.endTime}</strong> untuk mata kuliah <em>"{roomScheduleConflict.courseName}"</em> (Rombel {roomScheduleConflict.rombel}).
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRecommendations(true)}
                    className="mt-1 text-xs font-semibold text-rose-700 underline hover:text-rose-900 cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Lihat rekomendasi ruangan & jam yang masih kosong
                  </button>
                </div>
              ) : lecturerTimeConflict ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Dosen <strong>{lecturerTimeConflict.lecturerName}</strong> telah memiliki jadwal lain pada waktu ini ({lecturerTimeConflict.courseName} di ruang {lecturerTimeConflict.room}).
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Aturan 2 Terpenuhi: Ruang <strong>{room}</strong> pada hari <strong>{day}</strong> ({startTime}–{endTime}) tersedia bebas bentrok.
                  </span>
                </div>
              )}

              {/* Operating hours note */}
              {isOutsideOperatingHours && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Jadwal berada di luar standar operasional perkuliahan (Senin–Jumat : 09.00 – 19.00 WIB).</span>
                </div>
              )}
            </div>

            {/* Recommendation Button & Section */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowRecommendations(!showRecommendations)}
                className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Rekomendasi Hari, Jam & Ruangan Kosong ({recommendedSlots.length} Slot Tersedia)</span>
                </div>
                <span className="text-xs text-indigo-600 font-normal">
                  {showRecommendations ? 'Tutup Rekomendasi' : 'Buka Rekomendasi'}
                </span>
              </button>

              {/* Recommendation Panel */}
              {showRecommendations && (
                <div className="mt-2.5 p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-800">
                      Pilihan Slot Tersedia (Senin–Jumat, 09.00–19.00 WIB untuk {sks} SKS):
                    </span>

                    {/* Filter controls */}
                    <div className="flex items-center gap-2">
                      <select
                        value={filterRecDay}
                        onChange={(e) => setFilterRecDay(e.target.value)}
                        className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium"
                      >
                        <option value="ALL">Semua Hari</option>
                        {WORKDAYS.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>

                      <select
                        value={filterRecRoom}
                        onChange={(e) => setFilterRecRoom(e.target.value)}
                        className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium"
                      >
                        <option value="ALL">Semua Ruangan</option>
                        {availableRooms.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {filteredRecommendations.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs">
                      Tidak ada slot kosong yang cocok dengan filter. Silakan ubah filter hari atau ruangan.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {filteredRecommendations.slice(0, 12).map((slot, idx) => {
                        const isCurrentlySelected =
                          day === slot.day &&
                          startTime === slot.startTime &&
                          endTime === slot.endTime &&
                          room.trim().toLowerCase() === slot.room.trim().toLowerCase();

                        return (
                          <button
                            type="button"
                            key={`${slot.day}-${slot.room}-${slot.startTime}-${idx}`}
                            onClick={() => handleApplyRecommendation(slot)}
                            className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition cursor-pointer ${
                              isCurrentlySelected
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-xs">
                                <span>{slot.day}</span>
                                <span>·</span>
                                <span className="font-mono">{slot.startTime}–{slot.endTime}</span>
                              </div>
                              <div className={`text-[11px] mt-0.5 ${isCurrentlySelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                Ruangan: <strong className="font-semibold">{slot.room}</strong> ({slot.durationMinutes} mnt)
                              </div>
                            </div>
                            <div className="shrink-0 ml-2">
                              {isCurrentlySelected ? (
                                <span className="px-2 py-0.5 bg-white text-indigo-700 rounded text-[10px] font-bold">
                                  Terpilih
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-indigo-600 hover:underline">
                                  Terapkan
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 text-right">
                    Klik slot untuk mengisi Hari, Jam, dan Ruang secara otomatis.
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={Boolean(duplicateCourseConflict) || Boolean(roomScheduleConflict)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition cursor-pointer shadow-xs flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{editingSchedule ? 'Simpan Perubahan' : 'Tambah Jadwal Baru'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
