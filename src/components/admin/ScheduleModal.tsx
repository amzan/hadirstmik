import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleItem, User, Course, DayOfWeek, ProgramStudi, Rombel, Student } from '../../types/attendance';
import { isStudentInRombel, getStudentRombelList, INITIAL_ROMBELS } from '../../data/initialData';
import {
  Calendar, Clock, Building2, BookOpen, UserCheck, AlertCircle,
  CheckCircle2, Sparkles, Filter, Check, X, Info, ChevronRight,
  Users, Plus, Search, Database, Layers, ExternalLink, BookmarkCheck,
  GraduationCap, RefreshCw, ShieldCheck, GitMerge
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
  const [syncStatusNotice, setSyncStatusNotice] = useState<string>('');
  const [isSyncingRoster, setIsSyncingRoster] = useState(false);

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

  // Directly remove a rombel from the schedule
  const handleRemoveRombel = (rCode: string) => {
    const updated = selectedRombelCodes.filter(c => c.toUpperCase() !== rCode.toUpperCase());
    const count = getRombelStudentCount(rCode);
    setSelectedRombelCodes(updated);
    setRombel(updated.join(' & '));
    if (updated.length <= 1) {
      setIsMultiRombelMode(false);
    }
    setSyncStatusNotice(`Rombel "${rCode}" dihilangkan dari jadwal. ${count} mahasiswa dari rombel ini tidak lagi terhubung.`);
    setTimeout(() => setSyncStatusNotice(''), 4500);
  };

  // Directly select or toggle a rombel (add if not present, remove if present)
  const handleToggleRombel = (rCode: string) => {
    const cleanR = rCode.trim();
    const exists = selectedRombelCodes.some(c => c.toUpperCase() === cleanR.toUpperCase());
    let updated: string[];

    if (exists) {
      updated = selectedRombelCodes.filter(c => c.toUpperCase() !== cleanR.toUpperCase());
      const count = getRombelStudentCount(cleanR);
      setSyncStatusNotice(`Rombel "${cleanR}" dihilangkan dari jadwal (-${count} mahasiswa).`);
      if (updated.length <= 1) {
        setIsMultiRombelMode(false);
      }
    } else {
      if (isMultiRombelMode || selectedRombelCodes.length >= 1) {
        updated = [...selectedRombelCodes, cleanR];
        setIsMultiRombelMode(true);
      } else {
        updated = [cleanR];
      }
      const count = getRombelStudentCount(cleanR);
      setSyncStatusNotice(`Rombel "${cleanR}" ditambahkan ke jadwal (+${count} mahasiswa otomatis tersinkron).`);
    }

    setSelectedRombelCodes(updated);
    setRombel(updated.join(' & '));
    setTimeout(() => setSyncStatusNotice(''), 4500);
  };

  // Clear all rombels
  const handleClearAllRombels = () => {
    setSelectedRombelCodes([]);
    setRombel('');
    setIsMultiRombelMode(false);
    setSyncStatusNotice('Seluruh rombel telah dihilangkan dari jadwal.');
    setTimeout(() => setSyncStatusNotice(''), 4000);
  };

  // Select all rombels from a specific Program Studi
  const handleSelectAllProdiRombels = (targetProdi: ProgramStudi) => {
    const prodiRombels = activeRombelsList.filter(r => r.prodi === targetProdi).map(r => r.code);
    if (prodiRombels.length === 0) return;
    const combined = Array.from(new Set([...selectedRombelCodes, ...prodiRombels]));
    setSelectedRombelCodes(combined);
    setRombel(combined.join(' & '));
    setIsMultiRombelMode(combined.length > 1);
    setSyncStatusNotice(`Semua rombel ${targetProdi} (${prodiRombels.join(', ')}) berhasil ditambahkan dan disinkronkan ke jadwal.`);
    setTimeout(() => setSyncStatusNotice(''), 4500);
  };

  // Manual Trigger to re-sync roster
  const handleManualSyncRoster = () => {
    setIsSyncingRoster(true);
    setTimeout(() => {
      setIsSyncingRoster(false);
      setSyncStatusNotice(`Sinkronisasi Berhasil! ${connectedStudents.length} mahasiswa dari rombel [${selectedRombelCodes.join(', ') || '-'}] telah terverifikasi dan terhubung otomatis untuk presensi QR.`);
      setTimeout(() => setSyncStatusNotice(''), 5000);
    }, 450);
  };

  // Toggle multi-rombel mode
  const handleToggleMultiMode = (checked: boolean) => {
    setIsMultiRombelMode(checked);
    if (!checked && selectedRombelCodes.length > 1) {
      const single = selectedRombelCodes[0] || 'TI 3';
      setSelectedRombelCodes([single]);
      setRombel(single);
      setSyncStatusNotice(`Mode kelas tunggal diaktifkan: hanya rombel ${single} yang dipertahankan.`);
      setTimeout(() => setSyncStatusNotice(''), 4000);
    }
  };

  // Helper to determine program studi for a given rombel code
  const getRombelProdi = (rombelCode: string): ProgramStudi => {
    const clean = rombelCode.trim().toUpperCase();
    const found = activeRombelsList.find(r => r.code.toUpperCase() === clean);
    if (found?.prodi && found.prodi !== 'Lintas Program Studi') return found.prodi;
    if (clean.startsWith('TI') || clean.includes('TI ') || clean.includes('TI-')) return 'Teknologi Informasi';
    if (clean.startsWith('MI') || clean.includes('MI ') || clean.includes('MI-')) return 'Manajemen Informatika';
    return 'Teknologi Informasi';
  };

  // Group selected rombels by their program studi
  const selectedRombelsProdiMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    selectedRombelCodes.forEach(code => {
      const p = getRombelProdi(code);
      if (p) {
        if (!map[p]) map[p] = [];
        map[p].push(code);
      }
    });
    return map;
  }, [selectedRombelCodes, activeRombelsList]);

  // Unique list of distinct program studi present in selected rombels
  const distinctSelectedProdis = useMemo(() => {
    return Object.keys(selectedRombelsProdiMap);
  }, [selectedRombelsProdiMap]);

  // Multi-rombel with different prodis detected!
  const hasDifferentProdis = distinctSelectedProdis.length > 1;

  // Handle validate and merge cross-prodi multi-rombel
  const handleValidateAndMergeCrossProdi = () => {
    setProdi('Lintas Program Studi');
    setSyncStatusNotice('Multi-rombel dengan Prodi yang berbeda divalidasi & digabungkan. Field Program Studi diubah menjadi "Lintas Program Studi".');
    setTimeout(() => setSyncStatusNotice(''), 5500);
  };

  // Handle cancel/separate cross-prodi
  const handleSeparateCrossProdi = () => {
    const defaultProdi = (distinctSelectedProdis[0] as ProgramStudi) || 'Teknologi Informasi';
    setProdi(defaultProdi);
    setSyncStatusNotice(`Penggabungan lintas prodi dibatalkan. Field Program Studi dikembalikan ke "${defaultProdi}".`);
    setTimeout(() => setSyncStatusNotice(''), 4500);
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Program Studi
                  </label>
                  {prodi === 'Lintas Program Studi' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200 flex items-center gap-1 animate-fadeIn">
                      <GitMerge className="w-3 h-3 text-purple-600" />
                      <span>Lintas Program Studi</span>
                    </span>
                  )}
                </div>
                <select
                  value={prodi}
                  onChange={(e) => setProdi(e.target.value as ProgramStudi)}
                  className={`w-full px-3.5 py-2 bg-white border rounded-lg text-sm font-medium focus:outline-none transition ${
                    prodi === 'Lintas Program Studi'
                      ? 'border-purple-400 ring-2 ring-purple-100 text-purple-950 font-bold'
                      : 'border-slate-300 text-slate-900 focus:border-slate-900'
                  }`}
                >
                  <option value="Teknologi Informasi">Teknologi Informasi</option>
                  <option value="Manajemen Informatika">Manajemen Informatika</option>
                  <option value="Lintas Program Studi">Lintas Program Studi</option>
                </select>
                {hasDifferentProdis && prodi !== 'Lintas Program Studi' && (
                  <p className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Multi-rombel dari prodi berbeda terdeteksi. Silakan validasi penggabungan di bawah.</span>
                  </p>
                )}
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

            {/* 2.1: Rombel Terpilih pada Jadwal Ini (Bisa Dihilangkan Langsung) */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Rombel Terpilih pada Jadwal:</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    ({selectedRombelCodes.length} rombel aktif)
                  </span>
                </span>
                
                {selectedRombelCodes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllRombels}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Hilangkan Semua Rombel</span>
                  </button>
                )}
              </div>

              {selectedRombelCodes.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {selectedRombelCodes.map(rCode => {
                    const stCount = getRombelStudentCount(rCode);
                    return (
                      <span
                        key={rCode}
                        className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold shadow-xs border border-slate-800 animate-fadeIn"
                      >
                        <span>Rombel {rCode}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-semibold">
                          {stCount} Mhs
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRombel(rCode)}
                          className="p-1 text-slate-400 hover:text-white hover:bg-rose-600 rounded transition cursor-pointer"
                          title={`Hilangkan Rombel "${rCode}" secara langsung dari jadwal ini`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Belum ada rombel yang dipilih untuk jadwal ini. Silakan klik salah satu atau beberapa rombel di bawah.
                  </span>
                </div>
              )}
            </div>

            {/* 2.1.b: NOTIFIKASI & VALIDASI MULTI-ROMBEL LINTAS PRODI */}
            {hasDifferentProdis && (
              <div className={`p-4 rounded-xl border transition-all animate-fadeIn ${
                prodi === 'Lintas Program Studi'
                  ? 'bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-purple-300 shadow-xs'
                  : 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-300 shadow-xs'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      prodi === 'Lintas Program Studi'
                        ? 'bg-purple-600 text-white'
                        : 'bg-amber-500 text-white animate-pulse'
                    }`}>
                      <GitMerge className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                          <span>Multi-rombel dengan Prodi yang berbeda</span>
                        </h5>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          prodi === 'Lintas Program Studi'
                            ? 'bg-purple-100 text-purple-900 border-purple-300'
                            : 'bg-amber-200/80 text-amber-900 border-amber-300'
                        }`}>
                          {prodi === 'Lintas Program Studi' ? 'Sudah Digabungkan' : 'Konfirmasi Diperlukan'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Rombel yang dipilih berasal dari program studi yang berbeda:{' '}
                        <span className="font-bold text-slate-900">
                          {distinctSelectedProdis.map(p => `${p} (${selectedRombelsProdiMap[p]?.join(', ')})`).join(' dan ')}
                        </span>.
                        {prodi === 'Lintas Program Studi' ? (
                          <span className="text-purple-900 font-semibold ml-1">
                            Multi-rombel telah divalidasi dan field Program Studi berhasil diubah menjadi "Lintas Program Studi".
                          </span>
                        ) : (
                          <span className="text-amber-900 font-medium ml-1">
                            Apakah multi rombel lintas prodi ini akan digabungkan ke dalam satu jadwal perkuliahan?
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {prodi !== 'Lintas Program Studi' ? (
                      <button
                        type="button"
                        onClick={handleValidateAndMergeCrossProdi}
                        className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs hover:shadow-md"
                        title="Validasi penggabungan multi-rombel lintas prodi dan ubah Program Studi menjadi 'Lintas Program Studi'"
                      >
                        <GitMerge className="w-3.5 h-3.5 text-purple-200" />
                        <span>Validasi & Gabungkan Lintas Prodi</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-purple-800 bg-purple-100/90 px-3 py-1.5 rounded-lg border border-purple-200 flex items-center gap-1.5 shadow-2xs">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          <span>Tergabung: Lintas Program Studi</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleSeparateCrossProdi}
                          className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer px-1"
                          title="Batalkan penggabungan dan kembalikan Program Studi ke salah satu prodi"
                        >
                          Batalkan
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2.2: Rombel Cards Grid from Database & Quick Selectors */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-700">
                  Pilih atau Hilangkan Rombel dari Database Master Kampus:
                </span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSelectAllProdiRombels('Teknologi Informasi')}
                    className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                  >
                    + Semua Rombel TI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAllProdiRombels('Manajemen Informatika')}
                    className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                  >
                    + Semua Rombel MI
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeRombelsList.map(r => {
                  const isSelected = selectedRombelCodes.some(c => c.toUpperCase() === r.code.toUpperCase());
                  const studentCount = getRombelStudentCount(r.code);

                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => handleToggleRombel(r.code)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer relative group ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white hover:bg-slate-100/80 border-slate-200 text-slate-800'
                      }`}
                      title={isSelected ? `Klik untuk menghilangkan Rombel ${r.code}` : `Klik untuk menambahkan Rombel ${r.code}`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="font-bold text-xs tracking-wide flex items-center gap-1.5">
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          <span>{r.code}</span>
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

                      <div className="flex items-center justify-between gap-1 mt-2 pt-1 border-t border-slate-200/40 text-[10px]">
                        <div className="flex items-center gap-1">
                          <Users className={`w-3 h-3 ${isSelected ? 'text-indigo-300' : 'text-indigo-600'}`} />
                          <span className={isSelected ? 'text-indigo-200 font-bold' : 'text-slate-700 font-bold'}>
                            {studentCount} Mahasiswa
                          </span>
                        </div>
                        <span className={`text-[9px] font-semibold ${isSelected ? 'text-rose-300 opacity-80 group-hover:opacity-100' : 'text-indigo-600'}`}>
                          {isSelected ? '✕ Hilangkan' : '+ Pilih'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom/Selected Rombel Text Output */}
            <div className="pt-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Keterangan Teks Rombel Jadwal:
              </label>
              <input
                type="text"
                value={rombel}
                onChange={(e) => {
                  setRombel(e.target.value);
                  const parsed = e.target.value.split(/[,;&/]+/).map(p => p.trim()).filter(Boolean);
                  setSelectedRombelCodes(parsed);
                  if (parsed.length > 1) setIsMultiRombelMode(true);
                }}
                placeholder="Contoh: TI 3 atau TI 1 & 5"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:border-slate-900 font-mono"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Otomatis diselaraskan ketika Anda memilih atau menghilangkan rombel di atas.
              </p>
            </div>

            {/* 2.3: MEKANISME SINKRONISASI DAFTAR MAHASISWA TERHUBUNG */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
              {/* Sync notification banner */}
              {syncStatusNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-semibold flex items-center justify-between gap-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{syncStatusNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSyncStatusNotice('')}
                    className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    {connectedStudents.length}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        Sinkronisasi Daftar Mahasiswa Terhubung
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                        Otomatis Terhubung
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {connectedStudents.length} Mahasiswa aktif otomatis terdaftar pada jadwal ini dan siap melakukan presensi QR
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualSyncRoster}
                    disabled={isSyncingRoster}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-300 disabled:opacity-50"
                    title="Jalankan sinkronisasi ulang daftar mahasiswa terhubung"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncingRoster ? 'animate-spin text-indigo-600' : ''}`} />
                    <span>{isSyncingRoster ? 'Menyinkronkan...' : 'Sinkronkan Ulang'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowStudentPreview(!showStudentPreview)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 transition"
                  >
                    <span>{showStudentPreview ? 'Tutup Roster' : 'Lihat Roster Mahasiswa'}</span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showStudentPreview ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Rombel Contribution Breakdown Pills */}
              {selectedRombelCodes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-500">Distribusi Mahasiswa:</span>
                  {selectedRombelCodes.map(code => (
                    <span key={code} className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium border border-slate-200">
                      Rombel {code}: <strong className="text-indigo-700">{getRombelStudentCount(code)} mhs</strong>
                    </span>
                  ))}
                </div>
              )}

              {/* Expandable Mahasiswa Roster Table */}
              {showStudentPreview && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2.5 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Daftar Mahasiswa Terhubung ({filteredConnectedStudents.length})
                    </span>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari mahasiswa terhubung (NIM/Nama)..."
                        value={studentSearchPreview}
                        onChange={(e) => setStudentSearchPreview(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {filteredConnectedStudents.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500">
                        {connectedStudents.length === 0
                          ? 'Belum ada rombel yang dipilih. Pilih rombel di atas untuk menghubungkan mahasiswa.'
                          : 'Tidak ada mahasiswa yang cocok dengan pencarian di rombel ini.'}
                      </div>
                    ) : (
                      filteredConnectedStudents.map((st, idx) => (
                        <div key={st.nim} className="py-2 px-3 flex items-center justify-between text-xs hover:bg-slate-50/80 transition">
                          <div className="flex items-center gap-2.5">
                            <span className="text-slate-400 font-mono text-[10px] w-5 text-right">{idx + 1}.</span>
                            <div>
                              <span className="font-mono font-bold text-slate-900 mr-2">{st.nim}</span>
                              <span className="text-slate-800 font-semibold">{st.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {st.prodi}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold">
                              {st.rombel}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>Akun Siap QR</span>
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>
                      ✓ Setiap nama mahasiswa terdaftar dijamin memiliki akun pengguna untuk presensi QR tanpa error.
                    </span>
                    <span className="font-bold text-slate-700">
                      Total: {connectedStudents.length} Mahasiswa
                    </span>
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
