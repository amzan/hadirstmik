import { validateAccountPassword } from '../../utils/passwordPolicy';
import { api } from '../../utils/api';
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types/attendance';
import {
  X, Mail, KeyRound, ArrowRight, ArrowLeft, CheckCircle2,
  AlertCircle, RefreshCw, Eye, EyeOff, ShieldCheck, Lock,
  Sparkles
} from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: 'mahasiswa' | 'dosen' | 'admin';
  initialIdentifier?: string;
  onResetSuccess?: (user: User, newPassword: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialRole,
  initialIdentifier = '',
  onResetSuccess,
}) => {


  // Wizard Steps: 1 = Input Identifier/Email, 2 = Verify OTP, 3 = New Password, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'mahasiswa' | 'dosen' | 'admin'>(
    initialRole || 'all'
  );

  // OTP states
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [sentCode, setSentCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [countdown, setCountdown] = useState(900); // 15 minutes in seconds
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  // New Password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Feedback states
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIdentifier(initialIdentifier);
      setSelectedRoleFilter(initialRole || 'all');
      setOtpCode(['', '', '', '', '', '']);
      setSentCode('');
      setCountdown(900); setCooldown(0);
      setNewPassword('');
      setConfirmPassword('');
      setErrorMessage('');
      setSuccessMessage('');
      setDemoNotice(null);
      setIsSendingOtp(false);
      setIsSubmittingPassword(false);

    }
  }, [isOpen, initialIdentifier, initialRole ]);

  // Countdown timer for OTP
  useEffect(() => {
    if (step !== 2 || countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, countdown]);

  useEffect(() => {
    if (!isOpen || cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [isOpen, cooldown]);

  if (!isOpen) return null;

  // Step 1: Search user & Send OTP
  const handleSearchAndSendOtp = async (e: React.FormEvent) => { e.preventDefault(); if(isSendingOtp)return; setErrorMessage(''); setDemoNotice(null); setIsSendingOtp(true); try { const result=await api<{challengeId:string;message:string}>('/auth/password-reset/request','POST',{identifier,role:selectedRoleFilter==='all'?(initialRole||'mahasiswa'):selectedRoleFilter}); setSentCode(result.challengeId); setSuccessMessage(result.message); setStep(2); setCountdown(900); setCooldown(60); } catch(error){setErrorMessage(error instanceof Error?error.message:'Permintaan gagal.');} finally{setIsSendingOtp(false);} };

  // Step 2: Handle OTP input
  const handleOtpChange = async (index: number, value: string) => {
    const digit = value.slice(-1);
    if (digit && !/^\d+$/.test(digit)) return;

    const newCode = [...otpCode];
    newCode[index] = digit;
    setOtpCode(newCode);

    // Auto-advance to next box
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newCode = [...otpCode];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setOtpCode(newCode);

    const nextIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIndex]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => { e.preventDefault(); if(isSendingOtp)return; setIsSendingOtp(true); setErrorMessage(''); try { await api('/auth/password-reset/verify','POST',{challengeId:sentCode,code:otpCode.join('')}); setStep(3); } catch(error){setErrorMessage(error instanceof Error?error.message:'Verifikasi gagal.');} finally{setIsSendingOtp(false);} };

  const handleResendOtp = async () => {
    if(isSendingOtp || cooldown > 0)return; setIsSendingOtp(true);setErrorMessage('');
    try { const result=await api<{challengeId:string;message:string}>('/auth/password-reset/request','POST',{identifier,role:selectedRoleFilter==='all'?(initialRole||'mahasiswa'):selectedRoleFilter});setSentCode(result.challengeId);setSuccessMessage(result.message);setCountdown(900);setCooldown(60);setOtpCode(['','','','','','']); }
    catch(error){setErrorMessage(error instanceof Error?error.message:'Permintaan gagal.');} finally{setIsSendingOtp(false);}
  };
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();if(isSubmittingPassword)return;
    if(newPassword!==confirmPassword){setErrorMessage('Konfirmasi kata sandi tidak cocok.');return;}
    setIsSubmittingPassword(true);setErrorMessage('');
    try { validateAccountPassword(newPassword); await api('/auth/password-reset/confirm','POST',{challengeId:sentCode,code:otpCode.join(''),newPassword});setNewPassword('');setConfirmPassword('');setStep(4);window.dispatchEvent(new Event('hadir-session-expired')); }
    catch(error){setErrorMessage(error instanceof Error?error.message:'Perubahan gagal.');}finally{setIsSubmittingPassword(false);}
  };
  const formatCountdown = (seconds: number) => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-labelledby="password-reset-title" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md my-auto overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 id="password-reset-title" className="font-bold text-base text-white leading-tight">
                Atur Ulang Kata Sandi
              </h3>
              <p className="text-xs text-slate-300">
                Verifikasi Email · STMIK PGRI Kebumen
              </p>
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

        {/* Wizard Step Progress Tracker */}
        <div className="bg-slate-100/70 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className={`flex items-center gap-1.5 font-semibold ${step >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>1</span>
            <span>Identitas</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center gap-1.5 font-semibold ${step >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>2</span>
            <span>Kode Email</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center gap-1.5 font-semibold ${step >= 3 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>3</span>
            <span>Sandi Baru</span>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {/* Global Alert Messages */}
          {errorMessage && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {demoNotice && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1 animate-fadeIn">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Simulasi Kode OTP Email:</span>
              </div>
              <p className="leading-relaxed">{demoNotice}</p>
            </div>
          )}

          {/* STEP 1: Search Account & Send OTP */}
          {step === 1 && (
            <form onSubmit={handleSearchAndSendOtp} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Masukkan NIM, NIDN, Username, atau Email akun Anda. Jika identitas dan email akun memenuhi syarat, kode dikirim ke email akun. Hubungi admin jika alamat email perlu diperbarui.
              </p>

              {/* Role filter buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kategori Pengguna:
                </label>
                <div className={`grid ${initialRole === 'admin' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium`}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleFilter('all')}
                    className={`py-1.5 rounded-md transition cursor-pointer text-center ${selectedRoleFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleFilter('mahasiswa')}
                    className={`py-1.5 rounded-md transition cursor-pointer text-center ${selectedRoleFilter === 'mahasiswa' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Mahasiswa
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleFilter('dosen')}
                    className={`py-1.5 rounded-md transition cursor-pointer text-center ${selectedRoleFilter === 'dosen' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Dosen
                  </button>
                  {initialRole === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setSelectedRoleFilter('admin')}
                      className={`py-1.5 rounded-md transition cursor-pointer text-center ${selectedRoleFilter === 'admin' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      BAAK
                    </button>
                  )}
                </div>
              </div>

              {/* Identifier Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email / NIM / NIDN / Username:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    aria-label="Email / NIM / NIDN / Username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Contoh: 25TI0003, mucharobin, baak, atau email"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden font-medium text-slate-900"
                    autoFocus
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSendingOtp}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {isSendingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Mengirim Kode...</span>
                    </>
                  ) : (
                    <>
                      <span>Kirim Kode OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Input OTP from Email */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700" role="status">
                {successMessage || 'Jika identitas dan email akun memenuhi syarat, kode dikirim ke email akun.'}
                <p className="mt-1">Periksa inbox dan spam. Tahap ini tidak memastikan email sudah diterima. Hubungi admin jika alamat email perlu diperbarui.</p>
              </div>

              <div>
                <label className="block text-center text-xs font-semibold text-slate-700 mb-2">
                  Masukkan 6-Digit Kode Verifikasi:
                </label>
                <div className="flex items-center justify-center gap-1.5 sm:gap-2" onPaste={handleOtpPaste}>
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`Digit OTP ${index + 1}`}
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      required
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-9 sm:w-11 h-12 text-center text-xl font-bold font-mono rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-hidden bg-slate-50/50 text-slate-900 transition"
                    />
                  ))}
                </div>
              </div>

              {/* Countdown & Resend */}
              <div className="text-center text-xs space-y-1">
                <p className="text-slate-500">
                  Masa berlaku kode: <strong className="font-mono text-slate-800">{formatCountdown(countdown)}</strong>
                </p>
                <p>
                  Tidak menerima email?{' '}
                  <button
                    type="button"
                    disabled={isSendingOtp || cooldown > 0}
                    onClick={handleResendOtp}
                    className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer disabled:opacity-50"
                  >
                    {cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : 'Kirim Ulang Kode'}
                  </button>
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isSendingOtp}
                  onClick={() => { setStep(1); setErrorMessage(''); }}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Ubah Identitas</span>
                </button>

                <button
                  type="submit"
                  disabled={isSendingOtp || countdown <= 0 || otpCode.some(digit => !digit)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>{isSendingOtp ? 'Memverifikasi...' : 'Verifikasi Kode'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Create New Password */}
          {step === 3 && (
            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold block">Verifikasi Identitas Berhasil!</span>
                  <span className="text-[11px] text-emerald-700">
                    Silakan tentukan kata sandi baru untuk akun Anda.
                  </span>
                </div>
              </div>

              {/* Kata Sandi Baru */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Sandi Baru:
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    aria-label="Kata Sandi Baru"
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden text-slate-900"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Kata Sandi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Konfirmasi Kata Sandi Baru:
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    aria-label="Konfirmasi Kata Sandi Baru"
                    placeholder="Ketik ulang kata sandi baru"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {isSubmittingPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Sandi...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Simpan Kata Sandi Baru</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Reset Success */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">Kata Sandi Berhasil Diperbarui!</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Kata sandi baru Anda telah aktif. Silakan gunakan kata sandi baru untuk masuk ke portal.
                </p>
              </div>


              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                Selesai & Masuk ke Portal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
