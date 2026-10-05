import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { X, Send, FileText } from 'lucide-react';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, courses, submitLeaveRequest } = useAttendance();

  const [courseCode, setCourseCode] = useState<string>(courses[0]?.code || 'MKTI0109');
  const [type, setType] = useState<'IZIN' | 'SAKIT'>('IZIN');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const selectedCourse = courses.find(c => c.code === courseCode) || courses[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage('Mohon cantumkan alasan atau keterangan izin/sakit.');
      return;
    }
    setErrorMessage('');

    submitLeaveRequest({
      studentNim: currentUser.username,
      studentName: currentUser.name,
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,
      rombel: currentUser.rombel || 'TI 3',
      date,
      type,
      reason,
    });

    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-slate-800" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Form Pengajuan Izin / Sakit</h3>
              <p className="text-sm text-slate-500">Pengajuan akan diverifikasi oleh dosen pengampu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Pengajuan Terkirim!</h4>
            <p className="text-sm text-slate-600 mt-1">
              Surat permohonan izin/sakit Anda telah masuk ke sistem dosen untuk ditinjau.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg font-medium">
                {errorMessage}
              </div>
            )}

            {/* Student Info */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm space-y-1">
              <div className="font-bold text-slate-900">{currentUser.name}</div>
              <div className="text-slate-500">NIM: <strong className="font-mono text-slate-800">{currentUser.username}</strong> · Rombel: {currentUser.rombel || 'Reguler'}</div>
            </div>

            {/* Type */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Jenis Keterangan</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('IZIN')}
                  className={`py-2 px-3 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    type === 'IZIN'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Izin (Dispensasi)
                </button>
                <button
                  type="button"
                  onClick={() => setType('SAKIT')}
                  className={`py-2 px-3 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    type === 'SAKIT'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Sakit
                </button>
              </div>
            </div>

            {/* Course */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Mata Kuliah</label>
              <select
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.code}>
                    [{c.code}] {c.name} ({c.sks} SKS)
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Tanggal Tidak Hadir</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-500"
                required
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Alasan / Penjelasan
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Tuliskan keterangan lengkap izin atau sakit..."
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-500"
                required
              />
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
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Permohonan</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
