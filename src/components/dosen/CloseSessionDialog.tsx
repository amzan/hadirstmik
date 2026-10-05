import React from 'react';
import { AttendanceSession } from '../../types/attendance';
import { X, Check, Lock } from 'lucide-react';

interface CloseSessionDialogProps {
  isOpen: boolean;
  session: AttendanceSession | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const CloseSessionDialog: React.FC<CloseSessionDialogProps> = ({
  isOpen,
  session,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Konfirmasi Penutupan Sesi
              </h3>
              <p className="text-sm text-slate-500">
                STMIK PGRI Arungbinang Kebumen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-base font-bold text-slate-900 leading-snug">
              Apakah sesi mata kuliah ini ingin diakhiri?
            </p>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
              Tutup sesi ini jika tidak ada data presensi yang ingin diubah lagi. Setelah sesi diakhiri, token QR akan dinonaktifkan dan mahasiswa yang belum presensi akan tercatat Alpha.
            </p>
          </div>

          {/* Session Detail Summary Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Mata Kuliah:</span>
              <strong className="text-slate-900 text-right">{session.courseName}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Pertemuan / Kelas:</span>
              <span className="font-semibold text-slate-800">
                Pertemuan {session.meetingNumber} · {session.rombel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Ruang & Waktu:</span>
              <span className="text-slate-700">
                {session.room} · {session.startTime}–{session.endTime} WIB
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            Batal
          </button>

          <button
            onClick={onConfirm}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Ya, Akhiri Sesi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
