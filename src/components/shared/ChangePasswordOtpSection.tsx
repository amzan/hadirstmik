import React, { useState, useEffect, useRef } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { User } from '../../types/attendance';
import { sendPasswordResetEmail } from '../../utils/resendService';
import {
  KeyRound, Mail, ShieldCheck, CheckCircle2, AlertCircle,
  Eye, EyeOff, RefreshCw, Send, Lock, Clock, Sparkles
} from 'lucide-react';

interface ChangePasswordOtpSectionProps {
  currentUser: User;
  onPasswordChanged?: (newPassword: string) => void;
  overrideEmail?: string;
  onEmailUpdated?: (newEmail: string) => void;
}

export const ChangePasswordOtpSection: React.FC<ChangePasswordOtpSectionProps> = ({
  currentUser,
  onPasswordChanged,
  overrideEmail,
}) => {
  const { resetUserPassword, updateUser } = useAttendance();

  // Target email
  const targetEmail = (overrideEmail !== undefined ? overrideEmail : currentUser.email) || `${currentUser.username}@stmik-arungbinang.ac.id`;

  // State
  const [step, setStep] = useState<1 | 2>(1); // 1: Pre-send, 2: OTP entered & new password
  const [isSending, setIsSending] = useState(false);
  const [sentOtpCode, setSentOtpCode] = useState<string>('');
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // OTP 6-digits input
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Timers
  const [expiresCountdown, setExpiresCountdown] = useState<number>(900); // 15 minutes
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Timer countdown effect
  useEffect(() => {
    if (step !== 2) return;

    const interval = setInterval(() => {
      setExpiresCountdown(prev => (prev > 0 ? prev - 1 : 0));
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  const maskEmail = (em: string) => {
    if (!em) return '';
    const parts = em.split('@');
    if (parts.length < 2) return em;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name.slice(0, 2)}***${name[name.length - 1]}@${domain}`;
  };

  // Generate and send OTP
  const handleSendOtp = async () => {
    setErrorMessage('');
    setSuccessNotice(null);
    setDemoNotice(null);

    const emailToSend = targetEmail.trim();
    if (!emailToSend || !emailToSend.includes('@')) {
      setErrorMessage('Alamat email belum valid. Harap periksa email pada tab profil.');
      return;
    }

    setIsSending(true);
    // Generate 6-digit random OTP
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSentOtpCode(generatedCode);

    try {
      const res = await sendPasswordResetEmail({
        to: emailToSend,
        name: currentUser.name || 'Pengguna STMIK',
        role: currentUser.role,
        code: generatedCode,
      });

      if (res.isDemo) {
        setDemoNotice(
          `Mode Simulasi Resend: Kode OTP Anda adalah ${generatedCode}. Salin atau ketik kode ini untuk verifikasi.`
        );
      } else {
        setSuccessNotice(`Kode OTP 6-digit berhasil dikirim ke ${maskEmail(emailToSend)}. Periksa kotak masuk atau spam.`);
      }

      setStep(2);
      setExpiresCountdown(900);
      setResendCooldown(60); // 60s cooldown before resend
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      console.error('Error sending OTP email:', err);
      // Fallback gracefully so testing is never blocked
      setDemoNotice(
        `Pengiriman email terkendala jaringan/API Resend. Kode OTP simulasi untuk verifikasi: ${generatedCode}`
      );
      setStep(2);
      setExpiresCountdown(900);
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 150);
    } finally {
      setIsSending(false);
    }
  };

  // OTP inputs handling
  const handleDigitChange = (index: number, val: string) => {
    const digit = val.slice(-1);
    if (digit && !/^\d+$/.test(digit)) return;

    const copy = [...otpDigits];
    copy[index] = digit;
    setOtpDigits(copy);

    if (digit && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const copy = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      copy[i] = pasted[i];
    }
    setOtpDigits(copy);
    const targetIdx = Math.min(pasted.length, 5);
    digitInputRefs.current[targetIdx]?.focus();
  };

  // Format countdown mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'Kosong', color: 'bg-slate-200' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score: 1, label: 'Lemah', color: 'bg-rose-500' };
    if (score <= 4) return { score: 2, label: 'Sedang', color: 'bg-amber-500' };
    return { score: 3, label: 'Sangat Kuat', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);

  // Submit verify OTP and change password
  const handleVerifyAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const fullOtp = otpDigits.join('');
    if (fullOtp.length < 6) {
      setErrorMessage('Harap lengkapi 6-digit kode OTP verifikasi.');
      return;
    }

    if (fullOtp !== sentOtpCode) {
      setErrorMessage('Kode OTP verifikasi tidak cocok. Silakan periksa kembali email Anda.');
      return;
    }

    if (expiresCountdown <= 0) {
      setErrorMessage('Kode OTP telah kedaluwarsa. Silakan kirim ulang kode baru.');
      return;
    }

    if (!newPassword) {
      setErrorMessage('Kata sandi baru tidak boleh kosong.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('Kata sandi baru minimal terdiri dari 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok dengan kata sandi baru.');
      return;
    }

    setIsUpdating(true);

    try {
      // 1. Update in AttendanceContext using resetUserPassword & updateUser
      const res = resetUserPassword(currentUser.username, newPassword);
      updateUser(currentUser.id, { password: newPassword });

      if (onPasswordChanged) {
        onPasswordChanged(newPassword);
      }

      setIsDone(true);
      setSuccessNotice(
        res.message || 'Kata sandi berhasil diperbarui! Silakan gunakan kata sandi baru untuk login selanjutnya.'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memperbarui kata sandi. Silakan coba kembali.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetForm = () => {
    setStep(1);
    setOtpDigits(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
    setSentOtpCode('');
    setDemoNotice(null);
    setSuccessNotice(null);
    setErrorMessage('');
    setIsDone(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Title & Description */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              Ganti Kata Sandi dengan Verifikasi OTP Email
            </h4>
            <p className="text-xs text-slate-500">
              Penggantian password diverifikasi via kode 6-digit OTP melalui Resend API
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verifikasi Aman</span>
        </span>
      </div>

      {/* Success Notification after password changed */}
      {isDone && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-emerald-900">
              <p className="font-bold">Kata Sandi Berhasil Diperbarui!</p>
              <p className="text-xs text-emerald-700 mt-1">
                Kata sandi baru untuk akun <strong>{currentUser.name}</strong> ({currentUser.username}) telah aktif dan disimpan ke sistem.
                Gunakan kata sandi baru ini untuk login berikutnya.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs font-semibold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
            >
              Ubah Lagi / Selesai
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Demo / Simulation Notice Banner */}
      {demoNotice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-blue-900 text-xs animate-in fade-in duration-150">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{demoNotice}</p>
            <p className="text-[11px] text-blue-700 mt-0.5">
              Klik kotak kode di bawah untuk memasukkan kode atau salin langsung.
            </p>
          </div>
          {sentOtpCode && (
            <button
              type="button"
              onClick={() => {
                const arr = sentOtpCode.split('');
                setOtpDigits(arr);
              }}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs rounded shadow-2xs cursor-pointer transition shrink-0"
              title="Tempel kode OTP otomatis"
            >
              Isi {sentOtpCode}
            </button>
          )}
        </div>
      )}

      {/* Success send banner */}
      {successNotice && !isDone && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {!isDone && (
        <>
          {/* Target Email Info Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 block">Email Penerima Kode OTP:</span>
                <span className="text-xs sm:text-sm font-semibold font-mono text-slate-900 truncate block">
                  {targetEmail}
                </span>
              </div>
            </div>

            {step === 1 && (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isSending}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim OTP...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim Kode OTP</span>
                  </>
                )}
              </button>
            )}

            {step === 2 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Berlaku: {formatTime(expiresCountdown)}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={resendCooldown > 0 || isSending}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:text-slate-400 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition cursor-pointer"
                >
                  {resendCooldown > 0 ? `Kirim Ulang (${resendCooldown}s)` : 'Kirim Ulang OTP'}
                </button>
              </div>
            )}
          </div>

          {/* Step 1 Pre-send Guide */}
          {step === 1 && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Petunjuk Ganti Kata Sandi:</span>
              </p>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5 pl-1">
                <li>Klik tombol <strong>"Kirim Kode OTP"</strong> di atas.</li>
                <li>Sistem akan mengirimkan 6-digit kode verifikasi ke alamat email Anda.</li>
                <li>Masukkan kode verifikasi bersama dengan kata sandi baru yang ingin Anda gunakan.</li>
                <li>Kata sandi baru minimal 6 karakter.</li>
              </ul>
            </div>
          )}

          {/* Step 2: Form OTP Verification & New Password */}
          {step === 2 && (
            <form onSubmit={handleVerifyAndSubmit} className="space-y-4 pt-1">
              {/* 6 Digits OTP Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Masukkan 6-Digit Kode OTP Verifikasi <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2 sm:gap-3 justify-center sm:justify-start">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => {
                        digitInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleDigitChange(idx, e.target.value)}
                      onKeyDown={e => handleDigitKeyDown(idx, e)}
                      onPaste={handleDigitPaste}
                      className="w-10 h-11 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-bold font-mono rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition shadow-2xs"
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cek email Anda dan masukkan kode 6 angka yang dikirimkan.
                </p>
              </div>

              {/* Grid: Kata Sandi Baru & Konfirmasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Kata Sandi Baru */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Kata Sandi Baru <span className="text-rose-500">*</span>
                    </label>
                    {newPassword && (
                      <span className="text-[10px] font-semibold text-slate-600">
                        Kekuatan: {strength.label}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength Bar */}
                  {newPassword && (
                    <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${(strength.score / 3) * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Konfirmasi Kata Sandi Baru */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi baru"
                      className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword === newPassword && (
                    <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Kata sandi cocok</span>
                    </p>
                  )}
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-[11px] text-rose-500 font-medium mt-1">
                      Kata sandi belum cocok
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verifikasi OTP & Perbarui Kata Sandi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
};
