import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceSession } from '../../types/attendance';
import { ManualAttendanceModal } from './ManualAttendanceModal';
import { CloseSessionDialog } from './CloseSessionDialog';
import {
  X, Maximize2, Minimize2, RefreshCw, UserCheck
} from 'lucide-react';

interface QrSessionModalProps {
  session: AttendanceSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QrSessionModal: React.FC<QrSessionModalProps> = ({ session, isOpen, onClose }) => {
  const { refreshQrToken, closeSession, records, getStudentsForRombel } = useAttendance();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dynamicSeconds, setDynamicSeconds] = useState(15);
  const [isManualRollCallOpen, setIsManualRollCallOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Render QR Code onto canvas
  useEffect(() => {
    if (!session || !isOpen) return;

    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        session.qrToken,
        {
          width: 300,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('QR rendering error:', error);
        }
      );
    }
  }, [session?.qrToken, isOpen]);

  // Countdown timer for 15s rotating dynamic QR
  useEffect(() => {
    if (!isOpen || !session || !session.isOpen || !session.isDynamicQr) return;

    setDynamicSeconds(15);
    const timer = setInterval(() => {
      setDynamicSeconds(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, session?.isOpen, session?.isDynamicQr, session?.id]);

  // When timer reaches 0, trigger refreshQrToken safely in effect
  useEffect(() => {
    if (dynamicSeconds === 0 && isOpen && session && session.isOpen && session.isDynamicQr) {
      refreshQrToken(session.id);
      setDynamicSeconds(15);
    }
  }, [dynamicSeconds, isOpen, session?.id, session?.isOpen, session?.isDynamicQr, refreshQrToken]);

  if (!session || !isOpen) return null;

  const sessionRecords = records.filter(r => r.sessionId === session.id);
  const enrolledStudents = getStudentsForRombel(session.rombel);
  const totalEnrolled = enrolledStudents.length || 20;
  const hadirCount = sessionRecords.filter(r => r.status === 'HADIR').length;

  const handleCopyToken = () => {
    navigator.clipboard.writeText(session.qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleCloseSession = () => {
    setIsCloseDialogOpen(true);
  };

  const handleConfirmClose = () => {
    closeSession(session.id);
    setIsCloseDialogOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        ref={modalContainerRef}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] overflow-y-auto flex flex-col"
      >
        {/* Clean Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Layar QR Presensi · {session.courseName} (Pertemuan {session.meetingNumber})
              </h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Ruang {session.room} · {session.rombel} · {session.startTime}–{session.endTime} WIB
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Layar Penuh"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: Left QR Code, Right Attendees */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left: QR Canvas */}
          <div className="md:col-span-6 flex flex-col items-center text-center">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <canvas ref={canvasRef} className="rounded-lg max-w-full" />
            </div>

            {session.isDynamicQr && (
              <div className="w-full max-w-xs mt-4">
                <div className="flex items-center justify-between text-sm text-slate-500 mb-1.5">
                  <span className="font-medium">Pembaruan Token Otomatis</span>
                  <span className="font-mono text-slate-900 font-bold">{dynamicSeconds}s</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900 transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(dynamicSeconds / 15) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Quick copy token */}
            <div className="mt-4 flex items-center gap-2.5 text-sm text-slate-600">
              <span className="font-mono text-xs bg-slate-50 border border-slate-200 px-2.5 py-1 rounded truncate max-w-[220px]">
                {session.qrToken}
              </span>
              <button
                onClick={handleCopyToken}
                className="text-slate-900 hover:text-black font-semibold cursor-pointer underline text-xs"
              >
                {copied ? 'Tersalin' : 'Salin Kode'}
              </button>
            </div>
          </div>

          {/* Right: Real-time Attendees List */}
          <div className="md:col-span-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200 pt-6 md:pt-0 md:pl-8">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Mahasiswa Masuk
                </h3>
                <span className="text-sm font-bold text-emerald-700">
                  {hadirCount} / {totalEnrolled} Hadir
                </span>
              </div>

              <div className="mt-3 max-h-80 overflow-y-auto divide-y divide-slate-100 text-sm">
                {sessionRecords.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    Menunggu mahasiswa scan QR...
                  </div>
                ) : (
                  sessionRecords.map((record) => (
                    <div key={record.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{record.studentName}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {record.studentNim} · {new Date(record.scannedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        record.status === 'HADIR' ? 'bg-emerald-50 text-emerald-700' :
                        record.status === 'IZIN' ? 'bg-blue-50 text-blue-700' :
                        record.status === 'SAKIT' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {record.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refreshQrToken(session.id)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Segarkan</span>
                </button>

                <button
                  onClick={() => setIsManualRollCallOpen(true)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                >
                  <UserCheck className="w-4 h-4 text-slate-600" />
                  <span>Roll-Call</span>
                </button>
              </div>

              <button
                onClick={handleCloseSession}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition cursor-pointer"
              >
                Tutup Sesi
              </button>
            </div>
          </div>
        </div>
      </div>

      <ManualAttendanceModal
        isOpen={isManualRollCallOpen}
        onClose={() => setIsManualRollCallOpen(false)}
        defaultSessionId={session?.id}
      />

      <CloseSessionDialog
        isOpen={isCloseDialogOpen}
        session={session}
        onClose={() => setIsCloseDialogOpen(false)}
        onConfirm={handleConfirmClose}
      />
    </div>
  );
};
