import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleItem, User, Course, DayOfWeek, ProgramStudi, Rombel, Student } from '../../types/attendance';
import { isStudentInRombel, getStudentRombelList, INITIAL_ROMBELS } from '../../data/initialData';
import {
  Calendar, Clock, Building2, BookOpen, UserCheck, AlertCircle,
  CheckCircle2, Sparkles, Filter, Check, X, Info, ChevronRight,
  Users, Plus, Search, Database, Layers, ExternalLink, BookmarkCheck,
  GraduationCap
} from 'lucide-react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSchedule?: ScheduleItem | null;
  schedules: ScheduleItem[];
  users: User[];
  courses: Course[];
  rombels?: Rombel[];
  students?: Student[];
  onSave: (scheduleData: Omit<ScheduleItem, 'id'>) => void;
  onUpdate?: (id: string, scheduleData: Partial<ScheduleItem>) => void;
  onAddCourse?: (course: Omit<Course, 'id'>) => void;
  onAddRombel?: (rombelData: Omit<Rombel, 'id'>, connectedScheduleIds?: string[]) => { success: boolean; message: string; rombel?: Rombel };
}

// Campus Workdays for scheduling
export const WORKDAYS: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

// Campus Standard Rooms
export const DEFAULT_CAMPUS_ROOMS = ['RK 1', 'RK 2', 'LAB 1', 'LAB 2', 'Ruang Seminar', 'LAB KOMPUTER'];

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
  rombels,
  students = [],
  onSave,
  onUpdate,
  onAddCourse,
  onAddRombel,
}) => {
  // Form fields
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

  // Master Course picker state
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseSearch, setCourseSearch] = useState('');
  const [courseProdiFilter, setCourseProdiFilter] = useState<string>('ALL');
  const [courseSemesterFilter, setCourseSemesterFilter] = useState<string>('ALL');
  const [showCourseCatalog, setShowCourseCatalog] = useState(false);

  // Quick Add Course Form state
  const [showQuickAddCourse, setShowQuickAddCourse] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseSks, setNewCourseSks] = useState(2);
  const [newCourseProdi, setNewCourseProdi] = useState<ProgramStudi>('Teknologi Informasi');
  const [newCourseSemester, setNewCourseSemester] = useState(1);

  // Rombel selection state
  const [isMultiRombelMode, setIsMultiRombelMode] = useState(false);
  const [selectedRombelCodes, setSelectedRombelCodes] = useState<string[]>(['TI 3']);
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const [studentSearchPreview, setStudentSearchPreview] = useState('');

  // Recommendation engine state
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [filterRecDay, setFilterRecDay] = useState<string>('ALL');
  const [filterRecRoom, setFilterRecRoom] = useState<string>('ALL');
  const [formError, setFormError] = useState<string>('');

  // Active list of database rombels (excluding archived unless editing schedule)
  const activeRombelsList = useMemo(() => {
    const source = (rombels && rombels.length > 0) ? rombels : INITIAL_ROMBELS;
    return source.filter(r => !r.isArchived || (editingSchedule && isStudentInRombel(r.code, editingSchedule.rombel)));
  }, [rombels, editingSchedule]);

  // Lecturers list
  const lecturers = useMemo(() => {
    return users.filter(u => u.role === 'dosen');
  }, [users]);

  // Collect all unique rooms currently used or standard
  const availableRooms = useMemo(() => {
    const set = new Set<string>(DEFAULT_CAMPUS_ROOMS);
    schedules.forEach(s => {
      if (s.room) set.add(s.room.trim().toUpperCase());
    });
    return Array.from(set);
  }, [schedules]);

  // Filtered Master Courses list for catalog
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      // Exclude archived courses unless currently assigned to this schedule
      if (c.isArchived && (!editingSchedule || editingSchedule.courseCode !== c.code)) {
        return false;
      }
      if (courseProdiFilter !== 'ALL' && c.prodi !== courseProdiFilter) return false;
      if (courseSemesterFilter !== 'ALL' && c.semester !== Number(courseSemesterFilter)) return false;
      if (courseSearch.trim()) {
        const q = courseSearch.toLowerCase();
        const matchCode = c.code.toLowerCase().includes(q);
        const matchName = c.name.toLowerCase().includes(q);
        return matchCode || matchName;
      }
      return true;
    });
  }, [courses, courseProdiFilter, courseSemesterFilter, courseSearch, editingSchedule]);

  // Matched Master Course in database
  const matchedMasterCourse = useMemo(() => {
    if (selectedCourseId) {
      const byId = courses.find(c => c.id === selectedCourseId);
      if (byId) return byId;
    }
    const cleanCode = courseCode.trim().toLowerCase();
    const cleanName = courseName.trim().toLowerCase();
    if (!cleanCode && !cleanName) return null;
    return courses.find(c =>
      (cleanCode && c.code.toLowerCase() === cleanCode) ||
      (cleanName && c.name.toLowerCase() === cleanName)
    ) || null;
  }, [courses, selectedCourseId, courseCode, courseName]);

  // Compute how many students in the database belong to a rombel code
  const getRombelStudentCount = (rombelCode: string): number => {
    return students.filter(st => isStudentInRombel(rombelCode, st.rombel, st.rombels)).length;
  };

  // Connected students for current selected schedule rombel (from Mahasiswa database)
  const connectedStudents = useMemo(() => {
    if (!rombel.trim() || students.length === 0) return [];
    const parts = rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);
    return students.filter(st => {
      return parts.some(part => isStudentInRombel(part, st.rombel, st.rombels));
    });
  }, [students, rombel]);

  // Filtered connected students for preview search
  const filteredConnectedStudents = useMemo(() => {
    if (!studentSearchPreview.trim()) return connectedStudents;
    const q = studentSearchPreview.toLowerCase();
    return connectedStudents.filter(st =>
      st.name.toLowerCase().includes(q) ||
      st.nim.toLowerCase().includes(q) ||
      st.prodi.toLowerCase().includes(q)
    );
  }, [connectedStudents, studentSearchPreview]);

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;

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

      // Parse rombels
      const parts = editingSchedule.rombel.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);
      setSelectedRombelCodes(parts);
      setIsMultiRombelMode(parts.length > 1);

      // Match master course
      const matched = courses.find(c =>
        c.code.toLowerCase() === editingSchedule.courseCode.toLowerCase() ||
        c.name.toLowerCase() === editingSchedule.courseName.toLowerCase()
      );
      if (matched) {
        setSelectedCourseId(matched.id);
      } else {
        setSelectedCourseId('');
      }

      setFormError('');
    } else {
      setDay('Senin');
      setStartTime('09:00');
      setEndTime('10:40');
      setSks(2);
      setLecturerId(lecturers[0]?.id || '');
      setRoom('RK 2');
      setProdi('Teknologi Informasi');

      // Default to first rombel in database
      const firstRombel = activeRombelsList[0]?.code || 'TI 3';
      setRombel(firstRombel);
      setSelectedRombelCodes([firstRombel]);
      setIsMultiRombelMode(false);

      // Default course from master if available
      if (courses.length > 0) {
        const firstCourse = courses[0];
        setSelectedCourseId(firstCourse.id);
        setCourseCode(firstCourse.code);
        setCourseName(firstCourse.name);
        setSks(firstCourse.sks);
        setProdi(firstCourse.prodi);
        if (firstCourse.defaultLecturerId) {
          setLecturerId(firstCourse.defaultLecturerId);
        }
      } else {
        setCourseCode('');
        setCourseName('');
        setSelectedCourseId('');
      }
      setFormError('');
    }

    setShowRecommendations(false);
    setShowCourseCatalog(false);
    setShowQuickAddCourse(false);
    setShowStudentPreview(false);
    setStudentSearchPreview('');
  }, [editingSchedule, isOpen, courses, lecturers, activeRombelsList]);

  // Sync end time when SKS changes
  const handleSksChange = (newSks: number) => {
    setSks(newSks);
    const startMins = timeToMinutes(startTime);
    const duration = newSks === 1 ? 50 : newSks === 3 ? 150 : newSks === 4 ? 200 : 100;
    const newEndMins = Math.min(startMins + duration, 19 * 60); // Cap at 19:00
    setEndTime(minutesToTime(newEndMins));
  };

  // Select course from Master Database
  const handleSelectMasterCourse = (selectedCourse: Course) => {
    setSelectedCourseId(selectedCourse.id);
    setCourseCode(selectedCourse.code);
    setCourseName(selectedCourse.name);
    setProdi(selectedCourse.prodi);
    handleSksChange(selectedCourse.sks);
    if (selectedCourse.defaultLecturerId) {
      setLecturerId(selectedCourse.defaultLecturerId);
    }
    setShowCourseCatalog(false);
    setFormError('');
  };

  // Handle Quick Add New Course to Master Database
  const handleCreateNewMasterCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode.trim() || !newCourseName.trim()) {
      alert('Kode dan Nama Mata Kuliah wajib diisi.');
      return;
    }

    const cleanCode = newCourseCode.trim().toUpperCase();
    const cleanName = newCourseName.trim();

    if (onAddCourse) {
      onAddCourse({
        code: cleanCode,
        name: cleanName,
        sks: newCourseSks,
        prodi: newCourseProdi,
        semester: newCourseSemester,
        defaultLecturerId: lecturerId || (lecturers[0]?.id || ''),
        defaultLecturerName: lecturers.find(l => l.id === lecturerId)?.name || 'Dosen Pengampu',
      });
    }

    // Immediately bind this new course
    setCourseCode(cleanCode);
    setCourseName(cleanName);
    setProdi(newCourseProdi);
    handleSksChange(newCourseSks);
    setShowQuickAddCourse(false);
    setShowCourseCatalog(false);
    setNewCourseCode('');
    setNewCourseName('');
  };

  // Handle Rombel Selection (Single or Multi-select)
  const handleToggleRombel = (rCode: string) => {
    if (isMultiRombelMode) {
      const exists = selectedRombelCodes.includes(rCode);
      let updated: string[];
      if (exists) {
        updated = selectedRombelCodes.filter(c => c !== rCode);
      } else {
        updated = [...selectedRombelCodes, rCode];
      }
      setSelectedRombelCodes(updated);
      setRombel(updated.join(' & '));
    } else {
      setSelectedRombelCodes([rCode]);
      setRombel(rCode);
    }
  };

  // Toggle multi-rombel mode
  const handleToggleMultiMode = (checked: boolean) => {
    setIsMultiRombelMode(checked);
    if (!checked && selectedRombelCodes.length > 1) {
      const single = selectedRombelCodes[0] || 'TI 3';
      setSelectedRombelCodes([single]);
      setRombel(single);
    }
  };

  // Rule 1: Duplicate schedule check for the same rombel
  const duplicateCourseConflict = useMemo(() => {
    const cleanCode = courseCode.trim().toLowerCase();
    const cleanName = courseName.trim().toLowerCase();
    if (!cleanCode && !cleanName) return null;

    return schedules.find(s => {
      if (editingSchedule && s.id === editingSchedule.id) return false;
      const matchCode = cleanCode && s.courseCode.trim().toLowerCase() === cleanCode;
      const matchName = cleanName && s.courseName.trim().toLowerCase() === cleanName;
      if (!matchCode && !matchName) return false;

      // Check if for same or overlapping rombel
      const sameRombel = s.rombel.trim().toLowerCase() === rombel.trim().toLowerCase() ||
        isStudentInRombel(rombel, s.rombel) ||
        isStudentInRombel(s.rombel, rombel);
      return sameRombel;
    });
  }, [schedules, courseCode, courseName, rombel, editingSchedule]);

  // Rule 2: Room and Time Conflict
  const roomScheduleConflict = useMemo(() => {
    const cleanRoom = room.trim().toLowerCase();
    if (!cleanRoom || !day || !startTime || !endTime) return null;

    return schedules.find(s => {
      if (editingSchedule && s.id === editingSchedule.id) return false;
      if (s.day !== day) return false;
      if (s.room.trim().toLowerCase() !== cleanRoom) return false;
      return isTimeOverlap(startTime, endTime, s.startTime, s.endTime);
    });
  }, [schedules, day, room, startTime, endTime, editingSchedule]);

  // Lecturer time conflict check
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

  // System Recommendation Engine
  const recommendedSlots: RecommendedSlot[] = useMemo(() => {
    const slots: RecommendedSlot[] = [];
    const duration = sks === 1 ? 50 : sks === 3 ? 150 : 100;

    const candidateStartTimes =
      duration === 150
        ? ['09:00', '13:00', '15:45']
        : ['09:00', '10:45', '13:00', '14:45', '16:30', '17:15'];

    for (const d of WORKDAYS) {
      for (const r of availableRooms) {
        for (const cStart of candidateStartTimes) {
          const startM = timeToMinutes(cStart);
          const endM = startM + duration;
          if (endM > 19 * 60) continue;

          const cEnd = minutesToTime(endM);

          const hasRoomCollision = schedules.some(s => {
            if (editingSchedule && s.id === editingSchedule.id) return false;
            return s.day === d && s.room.trim().toLowerCase() === r.trim().toLowerCase() &&
                   isTimeOverlap(cStart, cEnd, s.startTime, s.endTime);
          });

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

  const filteredRecommendations = useMemo(() => {
    return recommendedSlots.filter(slot => {
      const matchDay = filterRecDay === 'ALL' || slot.day === filterRecDay;
      const matchRoom = filterRecRoom === 'ALL' || slot.room === filterRecRoom;
      return matchDay && matchRoom;
    });
  }, [recommendedSlots, filterRecDay, filterRecRoom]);

  const handleApplyRecommendation = (slot: RecommendedSlot) => {
    setDay(slot.day);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setRoom(slot.room);
    setFormError('');
    setShowRecommendations(false);
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!courseCode.trim() || !courseName.trim()) {
      setFormError('Kode MK dan Nama Mata Kuliah wajib terhubung dengan database master mata kuliah.');
      return;
    }

    if (!rombel.trim()) {
      setFormError('Rombel wajib dipilih dari database rombel & mahasiswa.');
      return;
    }

    if (!room.trim()) {
      setFormError('Ruang perkuliahan wajib ditentukan.');
      return;
    }

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      setFormError('Jam mulai perkuliahan harus lebih awal dari jam selesai.');
      return;
    }

    if (duplicateCourseConflict) {
      setFormError(
        `Aturan Bentrok Jadwal: Jadwal mata kuliah "${duplicateCourseConflict.courseName}" (${duplicateCourseConflict.courseCode}) sudah terdaftar untuk rombel "${duplicateCourseConflict.rombel}" pada hari ${duplicateCourseConflict.day}.`
      );
      return;
    }

    if (roomScheduleConflict) {
      setFormError(
        `Aturan Bentrok Ruangan: Ruang "${roomScheduleConflict.room}" sudah terpakai pada hari ${roomScheduleConflict.day} pukul ${roomScheduleConflict.startTime}–${roomScheduleConflict.endTime} untuk mata kuliah "${roomScheduleConflict.courseName}" (Rombel ${roomScheduleConflict.rombel}).`
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-auto overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white shrink-0">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-indigo-300 font-semibold tracking-wider uppercase">
                  Manajemen Akademik BAAK
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-medium">
                  Terhubung Master Database
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                {editingSchedule ? 'Edit Jadwal Perkuliahan' : 'Tambah Jadwal Perkuliahan Baru'}
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Validation Alert */}
          {formError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-rose-900">Perhatian Validasi Jadwal</div>
                <div className="leading-relaxed">{formError}</div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGIAN 1: KODE & MATA KULIAH TERHUBUNG DENGAN DATABASE MASTER MATA KULIAH */}
          {/* ========================================================================= */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-indigo-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>1. Terhubung dengan Database Master Mata Kuliah</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                      Master DB Sync
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Pilih mata kuliah dari katalog master. Kode, nama, SKS, dan prodi otomatis tersinkronisasi.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCourseCatalog(!showCourseCatalog)}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{showCourseCatalog ? 'Tutup Katalog' : 'Pilih dari Master MK'}</span>
                </button>

                {onAddCourse && (
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCourse(!showQuickAddCourse)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Buat Master MK Baru</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Add New Master Course Drawer */}
            {showQuickAddCourse && (
              <form onSubmit={handleCreateNewMasterCourse} className="p-4 bg-white border border-indigo-300 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>Daftarkan Mata Kuliah Baru ke Database Master</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCourse(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Batal
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Kode Mata Kuliah *
                    </label>
                    <input
                      type="text"
                      value={newCourseCode}
                      onChange={(e) => setNewCourseCode(e.target.value.toUpperCase())}
                      placeholder="Contoh: MKTI0115"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-semibold uppercase focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nama Mata Kuliah *
                    </label>
                    <input
                      type="text"
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      placeholder="Contoh: Pemrograman Web Lanjut"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Bobot SKS
                      </label>
                      <select
                        value={newCourseSks}
                        onChange={(e) => setNewCourseSks(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                      >
                        <option value={1}>1 SKS</option>
                        <option value={2}>2 SKS</option>
                        <option value={3}>3 SKS</option>
                        <option value={4}>4 SKS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Semester
                      </label>
                      <select
                        value={newCourseSemester}
                        onChange={(e) => setNewCourseSemester(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                          <option key={s} value={s}>Semester {s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Program Studi
                    </label>
                    <select
                      value={newCourseProdi}
                      onChange={(e) => setNewCourseProdi(e.target.value as ProgramStudi)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                    >
                      <option value="Teknologi Informasi">Teknologi Informasi</option>
                      <option value="Manajemen Informatika">Manajemen Informatika</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan ke Master Database & Pilih</span>
                  </button>
                </div>
              </form>
            )}

            {/* Course Catalog Search & Dropdown Panel */}
            {showCourseCatalog && (
              <div className="p-3.5 bg-white border border-indigo-200 rounded-xl space-y-2.5 animate-fadeIn">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Katalog Database Master Mata Kuliah ({filteredCourses.length} Mata Kuliah Tersedia)
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={courseProdiFilter}
                      onChange={(e) => setCourseProdiFilter(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50"
                    >
                      <option value="ALL">Semua Prodi</option>
                      <option value="Teknologi Informasi">Teknologi Informasi</option>
                      <option value="Manajemen Informatika">Manajemen Informatika</option>
                    </select>
                    <select
                      value={courseSemesterFilter}
                      onChange={(e) => setCourseSemesterFilter(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50"
                    >
                      <option value="ALL">Semua Sem.</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <option key={s} value={s}>Sem. {s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari kode MK (cth: MKTI) atau nama mata kuliah..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100">
                  {filteredCourses.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      Tidak ditemukan mata kuliah master yang cocok.
                    </div>
                  ) : (
                    filteredCourses.map(c => {
                      const isSelected = selectedCourseId === c.id || (c.code === courseCode && c.name === courseName);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectMasterCourse(c)}
                          className={`w-full p-2 text-left rounded-lg flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-300'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-900 font-bold">
                                {c.code}
                              </span>
                              <span className="text-xs font-semibold">{c.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {c.sks} SKS · Semester {c.semester} · {c.prodi}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold">
                              Terpilih
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Live Master Course Connection Status */}
            {matchedMasterCourse ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900">
                <div className="flex items-center gap-2.5">
                  <BookmarkCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span>Terhubung Master: {matchedMasterCourse.code} - {matchedMasterCourse.name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold text-[10px]">
                        {matchedMasterCourse.sks} SKS
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-700">
                      Semester {matchedMasterCourse.semester || '-'} · {matchedMasterCourse.prodi}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCourseCatalog(true)}
                  className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
                >
                  Ganti MK
                </button>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Mata kuliah belum tersambung ke database master mata kuliah.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCourseCatalog(true)}
                  className="text-xs font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
                >
                  Pilih dari Master
                </button>
              </div>
            )}

            {/* Form Fields for Course */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Mata Kuliah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
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

            {/* SKS & Program Studi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>

          {/* ========================================================================= */}
          {/* BAGIAN 2: ROMBEL SUDAH TERHUBUNG DENGAN DATABASE ROMBEL & MAHASISWA       */}
          {/* ========================================================================= */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-900 text-white rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>2. Terhubung dengan Database Rombel & Mahasiswa</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200">
                      Rombel & Mahasiswa Sync
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Pilih rombel perkuliahan. Mahasiswa yang berada di rombel ini otomatis terhubung pada jadwal ini.
                  </p>
                </div>
              </div>

              {/* Multi-rombel mode toggle */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMultiRombelMode}
                    onChange={(e) => handleToggleMultiMode(e.target.checked)}
                    className="w-3.5 h-3.5 text-slate-900 rounded border-slate-300 focus:ring-slate-900"
                  />
                  <span>Kelas Gabungan (Multi-Rombel)</span>
                </label>
              </div>
            </div>

            {/* Rombel Cards Grid from Database */}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2">
                Pilih dari Database Master Rombel Kampus:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeRombelsList.map(r => {
                  const isSelected = selectedRombelCodes.includes(r.code);
                  const studentCount = getRombelStudentCount(r.code);

                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => handleToggleRombel(r.code)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer relative ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white hover:bg-slate-100/80 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="font-bold text-xs tracking-wide">
                          {r.code}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          isSelected ? 'bg-slate-800 text-indigo-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          Sem {r.semester || '-'}
                        </span>
                      </div>

                      <div className={`text-[11px] truncate mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {r.name}
                      </div>

                      <div className="flex items-center gap-1 mt-2 pt-1 border-t border-slate-200/40 text-[10px]">
                        <Users className={`w-3 h-3 ${isSelected ? 'text-indigo-300' : 'text-indigo-600'}`} />
                        <span className={isSelected ? 'text-indigo-200 font-bold' : 'text-slate-700 font-bold'}>
                          {studentCount} Mahasiswa
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom/Selected Rombel Value */}
            <div className="pt-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Keterangan Rombel Jadwal:
              </label>
              <input
                type="text"
                value={rombel}
                onChange={(e) => {
                  setRombel(e.target.value);
                  setSelectedRombelCodes(e.target.value.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean));
                }}
                placeholder="Contoh: TI 3 atau TI 1 & 5"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:border-slate-900"
                required
              />
            </div>

            {/* Connected Students from Mahasiswa Database Preview */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                    {connectedStudents.length}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      Mahasiswa Terhubung dari Database Mahasiswa:
                    </span>
                    <span className="text-[11px] text-slate-500 ml-1.5">
                      ({connectedStudents.length} Mahasiswa aktif terdaftar)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowStudentPreview(!showStudentPreview)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                >
                  <span>{showStudentPreview ? 'Sembunyikan Roster' : 'Lihat Daftar Mahasiswa'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showStudentPreview ? 'rotate-90' : ''}`} />
                </button>
              </div>

              {/* Expandable Mahasiswa Roster */}
              {showStudentPreview && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 animate-fadeIn">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari mahasiswa terhubung (NIM/Nama)..."
                      value={studentSearchPreview}
                      onChange={(e) => setStudentSearchPreview(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100">
                    {filteredConnectedStudents.length === 0 ? (
                      <div className="py-2 text-center text-xs text-slate-500">
                        Tidak ada mahasiswa yang ditemukan untuk rombel ini.
                      </div>
                    ) : (
                      filteredConnectedStudents.map((st, idx) => (
                        <div key={st.nim} className="py-1 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-mono text-[10px] w-4">{idx + 1}.</span>
                            <span className="font-mono font-semibold text-slate-900">{st.nim}</span>
                            <span className="text-slate-700 font-medium">{st.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              {st.prodi}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                              {st.rombel}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    Seluruh {connectedStudents.length} mahasiswa ini otomatis memiliki jadwal ini dan dapat mengisi presensi.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BAGIAN 3: HARI, WAKTU & RUANGAN PERKULIAHAN (ATURAN 2 & ENGINE REKOMENDASI)*/}
          {/* ========================================================================= */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-700" />
                <span>3. Waktu & Ruangan Perkuliahan Bebas Bentrok</span>
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
                  onChange={(e) => setRoom(e.target.value.toUpperCase())}
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

            {/* Bentrok & Validasi Live Indicator */}
            {duplicateCourseConflict ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Bentrok Jadwal Rombel Terdeteksi:</span>
                </div>
                <p className="leading-relaxed">
                  Mata kuliah <strong>{duplicateCourseConflict.courseName}</strong> ({duplicateCourseConflict.courseCode}) sudah dijadwalkan pada hari <strong>{duplicateCourseConflict.day}</strong> ({duplicateCourseConflict.startTime}–{duplicateCourseConflict.endTime}) untuk rombel <strong>{duplicateCourseConflict.rombel}</strong>.
                </p>
              </div>
            ) : roomScheduleConflict ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Bentrok Jadwal Ruangan Terdeteksi:</span>
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
                  Ruang <strong>{room}</strong> pada hari <strong>{day}</strong> ({startTime}–{endTime}) bebas bentrok dan siap dijadwalkan.
                </span>
              </div>
            )}

            {isOutsideOperatingHours && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Jadwal berada di luar standar operasional reguler (Senin–Jumat : 09.00 – 19.00 WIB).</span>
              </div>
            )}
          </div>

          {/* Rekomendasi Slot Kosong Panel */}
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

            {showRecommendations && (
              <div className="mt-2.5 p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-800">
                    Pilihan Slot Tersedia (Senin–Jumat, 09.00–19.00 WIB untuk {sks} SKS):
                  </span>

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
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>Tersinkronisasi otomatis dengan Database Master MK & Rombel-Mahasiswa</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg cursor-pointer transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={Boolean(duplicateCourseConflict) || Boolean(roomScheduleConflict)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition cursor-pointer shadow-xs flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{editingSchedule ? 'Simpan Perubahan Jadwal' : 'Simpan & Jadwalkan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
