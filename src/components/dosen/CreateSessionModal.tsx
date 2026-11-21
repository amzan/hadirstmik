import React, { useState, useEffect, useRef } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { sessionsForSchedule } from '../../utils/sessionHistory';
import { ScheduleItem } from '../../types/attendance';
import { X, QrCode } from 'lucide-react';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (sessionId: string) => void;
  preselectedSchedule?: ScheduleItem | null;
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated,
  preselectedSchedule,
}) => {
  const { currentUser, schedules, courses, sessions, createSession } = useAttendance();

  // Find schedules for this lecturer
  const mySchedules = schedules.filter(s => s.lecturerId === currentUser.id);

  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    preselectedSchedule?.id || (mySchedules[0]?.id || '')
  );
  
  const currentSelectedSchedule = schedules.find(s => s.id === selectedScheduleId);

  const [courseCode, setCourseCode] = useState<string>(
    currentSelectedSchedule?.courseCode || mySchedules[0]?.courseCode || courses[0]?.code || ''
  );
  const [courseName, setCourseName] = useState<string>(
    currentSelectedSchedule?.courseName || mySchedules[0]?.courseName || courses[0]?.name || ''
  );
  const [rombel, setRombel] = useState<string>(
    currentSelectedSchedule?.rombel || mySchedules[0]?.rombel || 'TI 3'
  );
  const [room, setRoom] = useState<string>(
    currentSelectedSchedule?.room || mySchedules[0]?.room || 'RK 2'
  );
  const [meetingNumber, setMeetingNumber] = useState<number>(1);
  const [topic, setTopic] = useState<string>('');
  const [evaluation, setEvaluation] = useState<string>('');
  const [isDynamicQr, setIsDynamicQr] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  useEffect(() => {
    if (!isOpen || !currentSelectedSchedule) return;
    setDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
    setStartTime(currentSelectedSchedule.startTime); setEndTime(currentSelectedSchedule.endTime); setErrorMessage('');
  }, [isOpen, selectedScheduleId]);

  if (!isOpen) return null;

  const handleScheduleChange = (schId: string) => {
    setSelectedScheduleId(schId);
    setErrorMessage('');
    const sch = schedules.find(s => s.id === schId);
    if (sch) {
      setCourseCode(sch.courseCode);
      setCourseName(sch.courseName);
      setRombel(sch.rombel);
      setRoom(sch.room);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true; setSubmitting(true); setErrorMessage('');
    try {
    if (!courseCode || !rombel) {
      setErrorMessage('Pilih mata kuliah dan rombel terlebih dahulu.');
      return;
    }

    if (!currentSelectedSchedule) throw new Error('Pilih jadwal milik Anda terlebih dahulu.');
    const existing = sessionsForSchedule(currentSelectedSchedule, sessions).find(s => s.meetingNumber === Number(meetingNumber));
    if (existing) {
      if (!existing.isOpen) throw new Error('Pertemuan sudah selesai. Pilih pertemuan berikutnya atau minta admin melakukan Reset Sesi.');
      onClose(); onSessionCreated(existing.id); return;
    }
    if (!date || !startTime || startTime >= endTime) throw new Error('Isi tanggal dan rentang jam sesi yang valid.');
    const session = await createSession({
      date, startTime, endTime,
      scheduleId: selectedScheduleId || undefined,
      courseCode,
      courseName,
      rombel,
      room,
      meetingNumber: Number(meetingNumber),
      topic: topic || `Pertemuan ke-${meetingNumber}: Pembahasan Materi Perkuliahan`,
      evaluationMethod: evaluation || 'Kuis singkat & tanya jawab pemahaman materi',
      isDynamicQr,
    });

    onClose();
    onSessionCreated(session.id);
    } catch(error) { setErrorMessage(error instanceof Error ? error.message : 'Permintaan gagal.'); } finally { submittingRef.current = false; setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Buka Sesi Presensi Perkuliahan</h3>
              <p className="text-sm text-slate-500">Tampilkan QR Code interaktif untuk mahasiswa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg font-medium">
              {errorMessage}
            </div>
          )}

          {/* Quick Schedule Selector */}
          {mySchedules.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Pilih Jadwal Mengajar Anda:
              </label>
              <select
                value={selectedScheduleId}
                onChange={(e) => handleScheduleChange(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer"
              >
                {mySchedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.day} ({s.startTime}–{s.endTime}) · {s.courseName} [{s.rombel}]
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Course Code & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kode MK</label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="MKTI0109"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-500"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Mata Kuliah</label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Matematika Diskrit"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:border-slate-500"
                required
              />
            </div>
          </div>

          {/* Rombel, Ruangan, Pertemuan */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Rombel / Kelas
              </label>
              <input
                type="text"
                value={rombel}
                onChange={(e) => setRombel(e.target.value)}
                placeholder="TI 3"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Ruangan
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="RK 2"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Pertemuan Ke:
              </label>
              <select
                value={meetingNumber}
                onChange={(e) => setMeetingNumber(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer"
                required
              >
                {Array.from({ length: 16 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>
                    Pertemuan {num} {num === 8 ? '(UTS)' : num === 16 ? '(UAS)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3"><label>Tanggal<input aria-label="Tanggal sesi" type="date" required value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 border rounded-lg" /></label><label>Jam mulai (WIB)<input aria-label="Jam mulai sesi" type="time" required value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full p-2 border rounded-lg" /></label><label>Jam selesai (WIB)<input aria-label="Jam selesai sesi" type="time" required value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full p-2 border rounded-lg" /></label></div>
          {/* Topic */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Materi / Topik Pembahasan Perkuliahan *
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Contoh: Implementasi Normalisasi Basis Data dan Relasi Tabel"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:border-slate-500"
            />
          </div>

          {/* Evaluation */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Bentuk Evaluasi yang Diberikan
            </label>
            <input
              type="text"
              value={evaluation}
              onChange={(e) => setEvaluation(e.target.value)}
              placeholder="Contoh: Kuis 5 soal singkat & latihan mandiri pembuatan ERD"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:border-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Catatan evaluasi ini akan otomatis tercatat ke dalam dokumen <strong>Log Aktivitas Mengajar</strong>.
            </p>
          </div>

          {/* Dynamic QR Toggle */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
            <input
              type="checkbox"
              id="dynamicQrToggle"
              checked={isDynamicQr}
              onChange={(e) => setIsDynamicQr(e.target.checked)}
              className="mt-1 w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer"
            />
            <label htmlFor="dynamicQrToggle" className="text-sm cursor-pointer select-none">
              <span className="font-bold text-slate-900 block">
                Gunakan QR Code Dinamis (Anti-Joki Presensi)
              </span>
              <span className="text-slate-600 block mt-0.5">
                Token QR otomatis berubah setiap 15 detik untuk mencegah mahasiswa menitipkan foto kode QR.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Mulai Sesi & Tampilkan QR</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
