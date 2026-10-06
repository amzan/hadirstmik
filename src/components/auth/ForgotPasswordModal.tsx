import React, { useState, useEffect, useRef } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { User } from '../../types/attendance';
import { sendPasswordResetEmail } from '../../utils/resendService';
import { CAMPUS_INFO } from '../../data/initialData';
import {
  X, Mail, KeyRound, ArrowRight, ArrowLeft, CheckCircle2,
  AlertCircle, RefreshCw, Eye, EyeOff, ShieldCheck, Lock,
  GraduationCap, BookOpen, Shield, HelpCircle, Sparkles
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
  const { findUserByIdentifier, resetUserPassword } = useAttendance();

  // Wizard Steps: 1 = Input Identifier/Email, 2 = Verify OTP, 3 = New Password, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'mahasiswa' | 'dosen' | 'admin'>(
    initialRole || 'all'
  );
  const [targetUser, setTargetUser] = useState<User | null>(null);

  // OTP states
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [sentCode, setSentCode] = useState('');
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
      setTargetUser(null);
      setOtpCode(['', '', '', '', '', '']);
      setSentCode('');
      setCountdown(900);
      setNewPassword('');
      setConfirmPassword('');
      setErrorMessage('');
      setSuccessMessage('');
      setDemoNotice(null);

      // If initialIdentifier provided, look up immediately
      if (initialIdentifier) {
        const found = findUserByIdentifier(initialIdentifier);
        if (found) {
          setTargetUser(found);
        }
      }
    }
  }, [isOpen, initialIdentifier, initialRole, findUserByIdentifier]);

  // Countdown timer for OTP
  useEffect(() => {
    if (step !== 2 || countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, countdown]);

  if (!isOpen) return null;

  // Mask email for privacy (e.g. m***@stmik-arungbinang.ac.id)
  const maskEmail = (email: string) => {
    if (!email) return 'email@stmik-arungbinang.ac.id';
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name.slice(0, 2)}***${name[name.length - 1]}@${domain}`;
  };

  // Step 1: Search user & Send OTP
  const handleSearchAndSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setDemoNotice(null);

    const clean = identifier.trim();
    if (!clean) {
      setErrorMessage('Silakan masukkan Email, NIM, NIDN, atau Username akun Anda.');
      return;
    }

    const found = findUserByIdentifier(clean);
    if (!found) {
      setErrorMessage(
        `Akun dengan identitas "${clean}" tidak ditemukan dalam sistem STMIK PGRI Kebumen. Pastikan penulisan NIM/NIDN/Email sudah benar.`
      );
      return;
    }

    // Role check if filter active
    if (selectedRoleFilter !== 'all' && found.role !== selectedRoleFilter) {
      setErrorMessage(
        `Akun ${found.name} terdaftar sebagai ${found.role.toUpperCase()}, bukan ${selectedRoleFilter.toUpperCase()}. Silakan sesuaikan kategori akun.`
      );
      return;
    }

    setTargetUser(found);
    setIsSendingOtp(true);

    // Generate 6-digit random code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSentCode(generatedCode);

    try {
      const emailRecipient = found.email || `${found.username}@stmik-arungbinang.ac.id`;
      const result = await sendPasswordResetEmail({
        to: emailRecipient,
        name: found.name,
        role: found.role,
        code: generatedCode,
      });

      if (result.isDemo) {
        setDemoNotice(
          `Mode Simulasi Resend: Kode verifikasi Anda adalah: ${generatedCode} (Gunakan kode ini untuk melanjutkan pengetesan).`
        );
      } else {
        setSuccessMessage(`Kode verifikasi 6-digit telah dikirim ke ${maskEmail(emailRecipient)}.`);
      }

      setCountdown(900); // 15 mins
      setStep(2);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      console.error('Failed to send reset email:', err);
      // Fallback: don't block user test if network or key issue
      setDemoNotice(
        `Pengiriman email terhalang (Resend API). Kode verifikasi simulasi untuk pengetesan: ${generatedCode}`
      );
      setCountdown(900);
      setStep(2);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
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

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const fullCode = otpCode.join('');
    if (fullCode.length < 6) {
      setErrorMessage('Harap masukkan 6-digit kode verifikasi lengkap.');
      return;
    }

    if (fullCode !== sentCode) {
      setErrorMessage('Kode verifikasi salah atau tidak sesuai. Silakan periksa kembali email Anda.');
      return;
    }

    if (countdown <= 0) {
      setErrorMessage('Kode verifikasi telah kedaluwarsa. Silakan kirim ulang kode baru.');
      return;
    }

    setErrorMessage('');
    setStep(3);
  };

  const handleResendOtp = async () => {
    if (!targetUser) return;
    setIsSendingOtp(true);
    setErrorMessage('');
    setDemoNotice(null);

    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSentCode(generatedCode);
    setOtpCode(['', '', '', '', '', '']);

    try {
      const emailRecipient = targetUser.email || `${targetUser.username}@stmik-arungbinang.ac.id`;
      const result = await sendPasswordResetEmail({
        to: emailRecipient,
        name: targetUser.name,
        role: targetUser.role,
        code: generatedCode,
      });

      if (result.isDemo) {
        setDemoNotice(`Kode verifikasi baru: ${generatedCode}`);
      } else {
        setSuccessMessage(`Kode verifikasi baru telah dikirimkan ke email.`);
      }
      setCountdown(900);
      otpInputRefs.current[0]?.focus();
    } catch {
      setDemoNotice(`Kode verifikasi baru: ${generatedCode}`);
      setCountdown(900);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 3: Save new password
  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!targetUser) return;

    if (newPassword.length < 6) {
      setErrorMessage('Kata sandi baru minimal 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSubmittingPassword(true);

    setTimeout(() => {
      const result = resetUserPassword(targetUser.id, newPassword);

      setIsSubmittingPassword(false);
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setStep(4);
      if (onResetSuccess) {
        onResetSuccess(result.user || targetUser, newPassword);
      }
    }, 500);
  };

  // Helpers
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'dosen':
        return <BookOpen className="w-4 h-4 text-emerald-600" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-indigo-600" />;
      default:
        return <GraduationCap className="w-4 h-4 text-blue-600" />;
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'dosen':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Dosen Pengampu</span>;
      case 'admin':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">Administrator BAAK</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">Mahasiswa</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md my-auto overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs animate-fadeIn">
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
                Masukkan NIM, NIDN, Username, atau Email akun Anda. Sistem akan memverifikasi dan mengirimkan 6-digit kode OTP ke email yang terdaftar.
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
          {step === 2 && targetUser && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* Account summary banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                <img
                  src={targetUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={targetUser.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-300 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {getRoleBadge(targetUser.role)}
                    <span className="text-[11px] text-slate-500 font-mono">({targetUser.username})</span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 truncate mt-0.5">{targetUser.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Dikirim ke: <strong className="text-slate-700">{maskEmail(targetUser.email)}</strong>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-center text-xs font-semibold text-slate-700 mb-2">
                  Masukkan 6-Digit Kode Verifikasi:
                </label>
                <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-11 h-12 text-center text-xl font-bold font-mono rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-hidden bg-slate-50/50 text-slate-900 transition"
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
                    disabled={isSendingOtp}
                    onClick={handleResendOtp}
                    className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer disabled:opacity-50"
                  >
                    Kirim Ulang Kode
                  </button>
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Ubah Identitas</span>
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>Verifikasi Kode</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Create New Password */}
          {step === 3 && targetUser && (
            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold block">Verifikasi Identitas Berhasil!</span>
                  <span className="text-[11px] text-emerald-700">
                    Silakan tentukan kata sandi baru untuk akun <strong>{targetUser.name}</strong>.
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
          {step === 4 && targetUser && (
            <div className="text-center py-4 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">Kata Sandi Berhasil Diperbarui!</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Kata sandi baru untuk akun <strong>{targetUser.name}</strong> ({targetUser.role.toUpperCase()}) telah aktif. Silakan gunakan kata sandi baru untuk masuk ke portal.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Username / Identitas:</span>
                  <span className="font-mono font-bold text-slate-900">{targetUser.username}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Peran Pengguna:</span>
                  <span className="font-bold text-slate-900 capitalize">{targetUser.role}</span>
                </div>
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
