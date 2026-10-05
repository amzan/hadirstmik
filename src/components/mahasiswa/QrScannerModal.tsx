import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceSession } from '../../types/attendance';
import {
  X, Camera, Upload, CheckCircle2, AlertCircle, RefreshCw,
  QrCode, KeyRound, ShieldCheck
} from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, scanQrCode } = useAttendance();
  const [scanMode, setScanMode] = useState<'camera' | 'upload' | 'token'>('camera');
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    session?: AttendanceSession;
    scannedToken?: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualTokenInput, setManualTokenInput] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = 'html5qr-code-full-region';

  // Initialize or teardown camera scanner when mode changes
  useEffect(() => {
    if (!isOpen || scanMode !== 'camera') {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          setIsScanning(false);
        });
      }
      return;
    }

    let isMounted = true;
    const startScanner = async () => {
      try {
        setCameraError(null);
        const scanner = new Html5Qrcode(qrRegionId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (isMounted) {
              handleTokenScanned(decodedText);
              scanner.stop().catch(() => {});
              setIsScanning(false);
            }
          },
          () => {}
        );
        if (isMounted) setIsScanning(true);
      } catch (err: any) {
        if (isMounted) {
          console.warn('Camera start error:', err);
          setCameraError(
            'Kamera tidak dapat diakses atau izin belum diberikan. Silakan gunakan opsi "Unggah QR" atau "Ketik Token Sesi".'
          );
          setIsScanning(false);
        }
      }
    };

    const timer = setTimeout(startScanner, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isOpen, scanMode]);

  // Handle scanned token
  const handleTokenScanned = (token: string) => {
    const result = scanQrCode(token, currentUser.username);
    setScanResult({
      ...result,
      scannedToken: token,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const html5QrCode = new Html5Qrcode('qr-upload-temp-region');
    html5QrCode
      .scanFile(file, true)
      .then((decodedText) => {
        handleTokenScanned(decodedText);
      })
      .catch(() => {
        setScanResult({
          success: false,
          message: 'QR Code tidak terdeteksi pada gambar. Pastikan gambar jelas dan tidak buram.',
        });
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-slate-900" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Pindai QR Presensi Kuliah
              </h3>
              <p className="text-sm text-slate-500">
                Validasi kehadiran kelas STMIK PGRI Arungbinang Kebumen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        {!scanResult && (
          <div className="flex border-b border-slate-200 bg-slate-50 px-4 py-2 gap-2 text-sm font-semibold">
            <button
              onClick={() => setScanMode('camera')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                scanMode === 'camera'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Kamera Langsung</span>
            </button>
            <button
              onClick={() => setScanMode('upload')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                scanMode === 'upload'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Unggah QR</span>
            </button>
            <button
              onClick={() => setScanMode('token')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                scanMode === 'token'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Ketik Token</span>
            </button>
          </div>
        )}

        {/* Body content */}
        <div className="p-6 overflow-y-auto flex-1 text-sm">
          {/* Result view */}
          {scanResult ? (
            <div className="flex flex-col items-center text-center animate-scaleUp py-4">
              {scanResult.success ? (
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
                  <AlertCircle className="w-10 h-10" />
                </div>
              )}

              <h4 className={`text-xl font-bold ${scanResult.success ? 'text-emerald-800' : 'text-rose-800'}`}>
                {scanResult.success ? 'Presensi Berhasil Diverifikasi!' : 'Presensi Tidak Berhasil'}
              </h4>

              <p className="text-sm text-slate-600 mt-2 max-w-sm leading-relaxed">
                {scanResult.message}
              </p>

              {scanResult.session && (
                <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl w-full text-left text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Mata Kuliah:</span>
                    <span className="font-bold text-slate-900">{scanResult.session.courseName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Pertemuan:</span>
                    <span className="font-bold text-slate-900">Pertemuan {scanResult.session.meetingNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Dosen Pengampu:</span>
                    <span className="font-medium text-slate-800">{scanResult.session.lecturerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Ruangan:</span>
                    <span className="font-medium text-slate-800">{scanResult.session.room}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Waktu Presensi:</span>
                    <span className="font-mono text-emerald-700 font-semibold">{new Date().toLocaleTimeString('id-ID')} WIB</span>
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center gap-3 w-full">
                <button
                  onClick={() => setScanResult(null)}
                  className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg border border-slate-300 transition cursor-pointer"
                >
                  Scan Lagi
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Token Mode */}
              {scanMode === 'token' && (
                <div className="space-y-4 py-2">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <span className="font-bold block text-slate-900 mb-0.5">Validasi Kode Token Sesi:</span>
                    Masukkan kode token presensi yang ditampilkan pada layar proyektor dosen di ruang kuliah.
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 block">
                      Kode Token Presensi:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Contoh: STMIK-MKTI0109-P1-AB12CD"
                        value={manualTokenInput}
                        onChange={(e) => setManualTokenInput(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-900 uppercase font-semibold focus:outline-none focus:border-slate-900"
                      />
                      <button
                        onClick={() => {
                          if (manualTokenInput.trim()) {
                            handleTokenScanned(manualTokenInput.trim());
                          }
                        }}
                        disabled={!manualTokenInput.trim()}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-sm font-semibold cursor-pointer transition shadow-xs"
                      >
                        Validasi
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Camera Mode */}
              {scanMode === 'camera' && (
                <div className="flex flex-col items-center">
                  <div
                    id={qrRegionId}
                    className="w-full max-w-[320px] aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center text-white text-sm relative"
                  >
                    {!isScanning && !cameraError && (
                      <div className="text-center p-4">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                        <span>Mengaktifkan kamera perangkat...</span>
                      </div>
                    )}
                  </div>

                  {cameraError && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm text-left">
                      {cameraError}
                    </div>
                  )}
                  <p className="text-sm text-slate-500 mt-3 text-center">
                    Arahkan kamera ke layar proyektor dosen yang menampilkan QR Code
                  </p>
                </div>
              )}

              {/* Upload Mode */}
              {scanMode === 'upload' && (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Pilih Berkas Gambar QR Code</h4>
                  <p className="text-sm text-slate-500 max-w-xs mt-1 mb-5">
                    Unggah tangkapan layar atau foto QR Code presensi untuk divalidasi sistem
                  </p>

                  <label className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg cursor-pointer transition">
                    Pilih File Foto QR
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <div id="qr-upload-temp-region" className="hidden"></div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Sistem Validasi Resmi STMIK PGRI
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
