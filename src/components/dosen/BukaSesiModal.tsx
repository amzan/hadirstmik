import React, { useState, useEffect } from 'react';
import { ScheduleItem } from '../../types/attendance';
import { useAttendance } from '../../context/AttendanceContext';
import { X, Calendar, BookOpen, ClipboardCheck, QrCode, UserCheck, AlertCircle } from 'lucide-react';

interface BukaSesiModalProps {
  schedule: ScheduleItem | null;
  isOpen: boolean;
  onClose: () => void;
  initialMeetingNumber?: number;
  onOpenManual: (sessionId: string) => void;
  onOpenQr: (sessionId: string) => void;
}

const EVALUATION_OPTIONS = [
  'Tanya Jawab & Keaktifan di Kelas',
  'Kuis Singkat (Pre-test / Post-test)',
  'Tugas Mandiri / Latihan Soal',
  'Praktikum / Studi Kasus Laboratorium',
  'Diskusi & Presentasi Kelompok',
  'Pemaparan Teori & Diskusi Terbimbing',
  'Ujian Tengah Semester (UTS)',
  'Ujian Akhir Semester (UAS)',
  'Lainnya (Ketik Manual)',
];

export const BukaSesiModal: React.FC<BukaSesiModalProps> = ({
  schedule,
  isOpen,
  onClose,
  initialMeetingNumber = 1,
  onOpenManual,
  onOpenQr,
}) => {
  const {
    sessions,
    createSession,
    setScheduleMeetingDate,
    getMeetingDateForSchedule,
  } = useAttendance();

  const [meetingNumber, setMeetingNumber] = useState<number>(initialMeetingNumber);
  const [date, setDate] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [selectedEvaluation, setSelectedEvaluation] = useState<string>(EVALUATION_OPTIONS[0]);
  const [customEvaluation, setCustomEvaluation] = useState<string>('');

  // Sync state whenever schedule or modal opens
  useEffect(() => {
    if (!schedule || !isOpen) return;

    const mNum = initialMeetingNumber || 1;
    setMeetingNumber(mNum);

    const mDate = getMeetingDateForSchedule(schedule, mNum);
    setDate(mDate);

    // Check if session for this meeting already exists to prefill topic / evaluation
    const existing = sessions.find(
      s => (s.scheduleId === schedule.id || (s.courseCode === schedule.courseCode && s.rombel === schedule.rombel)) &&
           s.meetingNumber === mNum
    );

    if (existing) {
      setTopic(existing.topic || `Perkuliahan Pertemuan ${mNum}: ${schedule.courseName}`);
      if (existing.evaluationMethod) {
        if (EVALUATION_OPTIONS.includes(existing.evaluationMethod)) {
          setSelectedEvaluation(existing.evaluationMethod);
          setCustomEvaluation('');
        } else {
          setSelectedEvaluation('Lainnya (Ketik Manual)');
          setCustomEvaluation(existing.evaluationMethod);
        }
      } else {
        setSelectedEvaluation(mNum === 8 ? 'Ujian Tengah Semester (UTS)' : mNum === 16 ? 'Ujian Akhir Semester (UAS)' : EVALUATION_OPTIONS[0]);
        setCustomEvaluation('');
      }
    } else {
      setTopic(`Pembahasan Materi Pertemuan ${mNum}: ${schedule.courseName}`);
      setSelectedEvaluation(mNum === 8 ? 'Ujian Tengah Semester (UTS)' : mNum === 16 ? 'Ujian Akhir Semester (UAS)' : EVALUATION_OPTIONS[0]);
      setCustomEvaluation('');
    }
  }, [schedule, isOpen, initialMeetingNumber, sessions, getMeetingDateForSchedule]);

  if (!schedule || !isOpen) return null;

  // Handler when meeting number changes in dropdown
  const handleMeetingChange = (newMeetingNum: number) => {
    setMeetingNumber(newMeetingNum);
    const mDate = getMeetingDateForSchedule(schedule, newMeetingNum);
    setDate(mDate);

    const existing = sessions.find(
      s => (s.scheduleId === schedule.id || (s.courseCode === schedule.courseCode && s.rombel === schedule.rombel)) &&
           s.meetingNumber === newMeetingNum
    );

    if (existing) {
      setTopic(existing.topic || `Perkuliahan Pertemuan ${newMeetingNum}: ${schedule.courseName}`);
      if (existing.evaluationMethod) {
        if (EVALUATION_OPTIONS.includes(existing.evaluationMethod)) {
          setSelectedEvaluation(existing.evaluationMethod);
          setCustomEvaluation('');
        } else {
          setSelectedEvaluation('Lainnya (Ketik Manual)');
          setCustomEvaluation(existing.evaluationMethod);
        }
      }
    } else {
      setTopic(`Pembahasan Materi Pertemuan ${newMeetingNum}: ${schedule.courseName}`);
      if (newMeetingNum === 8) {
        setSelectedEvaluation('Ujian Tengah Semester (UTS)');
      } else if (newMeetingNum === 16) {
        setSelectedEvaluation('Ujian Akhir Semester (UAS)');
      } else if (selectedEvaluation.includes('UTS') || selectedEvaluation.includes('UAS')) {
        setSelectedEvaluation(EVALUATION_OPTIONS[0]);
      }
    }
  };

  const finalEvaluation = selectedEvaluation === 'Lainnya (Ketik Manual)'
    ? customEvaluation.trim()
    : selectedEvaluation.trim();

  // Validation: all fields filled
  const isFormValid = Boolean(
    meetingNumber >= 1 &&
    meetingNumber <= 16 &&
    date.trim() &&
    topic.trim() &&
    finalEvaluation.trim()
  );

  const handleStartSession = (method: 'MANUAL' | 'QR') => {
    if (!isFormValid) return;

    // 1. Sync meeting date into schedule mapping
    setScheduleMeetingDate(schedule.id, meetingNumber, date);

    // 2. Create or update session
    const newSession = createSession({
      scheduleId: schedule.id,
      courseCode: schedule.courseCode,
      courseName: schedule.courseName,
      rombel: schedule.rombel,
      room: schedule.room,
      meetingNumber,
      topic: topic.trim(),
      evaluationMethod: finalEvaluation,
      date,
      isDynamicQr: method === 'QR',
    });

    onClose();

    if (method === 'MANUAL') {
      onOpenManual(newSession.id);
    } else {
      onOpenQr(newSession.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="font-mono text-slate-700">{schedule.courseCode}</span>
              <span aria-hidden="true">·</span>
              <span>{schedule.sks} SKS</span>
              <span aria-hidden="true">·</span>
              <span>{schedule.rombel}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
              Buka Sesi Perkuliahan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {schedule.courseName} · Ruang {schedule.room}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => e.preventDefault()} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm">
          {/* Field 1: Pertemuan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              1. Pertemuan <span className="text-rose-500">*</span>
            </label>
            <select
              value={meetingNumber}
              onChange={(e) => handleMeetingChange(Number(e.target.value))}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer text-sm"
            >
              {Array.from({ length: 16 }, (_, i) => i + 1).map((num) => {
                const isUts = num === 8;
                const isUas = num === 16;
                const marker = isUts ? ' (UTS)' : isUas ? ' (UAS)' : '';
                return (
                  <option key={num} value={num}>
                    Pertemuan ke-{num}{marker}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Field 2: Tanggal */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>2. Tanggal Perkuliahan</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-slate-900 transition cursor-pointer text-sm"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Tanggal ini terhubung khusus dengan Pertemuan ke-{meetingNumber}.
            </p>
          </div>

          {/* Field 3: Topik Pembahasan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>3. Topik Pembahasan</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Contoh: Pemodelan Relasional, Normalisasi Basis Data, dan Relasi ERD..."
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 text-sm leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Sesuaikan dengan materi Anda pada pertemuan ini
            </p>
          </div>

          {/* Field 4: Bentuk Evaluasi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>4. Bentuk Evaluasi</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedEvaluation}
              onChange={(e) => setSelectedEvaluation(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer text-sm"
            >
              {EVALUATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {selectedEvaluation === 'Lainnya (Ketik Manual)' && (
              <input
                type="text"
                required
                value={customEvaluation}
                onChange={(e) => setCustomEvaluation(e.target.value)}
                placeholder="Tulis bentuk evaluasi perkuliahan..."
                className="w-full mt-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 text-sm"
              />
            )}
          </div>

          {!isFormValid && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Lengkapi semua field (Pertemuan, Tanggal, Topik, dan Bentuk Evaluasi) untuk membuka opsi presensi.</span>
            </div>
          )}
        </form>

        {/* Modal Footer: Action Buttons (Presensi Manual / Presensi QR) */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200/70 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer order-last sm:order-first text-center"
          >
            Batal
          </button>

          <div className="flex items-center gap-2.5">
            {/* Tombol Presensi Manual */}
            <button
              type="button"
              disabled={!isFormValid}
              onClick={() => handleStartSession('MANUAL')}
              className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer border ${
                isFormValid
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
              title={isFormValid ? 'Buka sesi dan input presensi secara manual' : 'Isi semua field formulir terlebih dahulu'}
            >
              <UserCheck className="w-4 h-4 text-slate-600" />
              <span>Presensi Manual</span>
            </button>

            {/* Tombol Presensi QR */}
            <button
              type="button"
              disabled={!isFormValid}
              onClick={() => handleStartSession('QR')}
              className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                isFormValid
                  ? 'bg-slate-900 hover:bg-slate-800 active:bg-black text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
              title={isFormValid ? 'Buka sesi dan tampilkan layar Proyektor QR untuk discan mahasiswa' : 'Isi semua field formulir terlebih dahulu'}
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Presensi QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
