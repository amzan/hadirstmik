import { login } from '../../utils/api';
import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { User } from '../../types/attendance';
import { CAMPUS_INFO } from '../../data/initialData';
import { getStmikLogoDataUrl } from '../../utils/logoStmik';
import {
  Shield, KeyRound, Eye, EyeOff, ArrowRight, ArrowLeft,
  AlertCircle, CheckCircle2, Lock, Building
} from 'lucide-react';

interface AdminPortalPageProps {
  onLoginSuccess: (user: User) => void;
  onNavigateHome: () => void;
  onOpenForgotPassword: (role: 'admin', identifier?: string) => void;
}

export const AdminPortalPage: React.FC<AdminPortalPageProps> = ({
  onLoginSuccess,
  onNavigateHome,
  onOpenForgotPassword,
}) => {
  const { users, currentUser } = useAttendance();
  const [username, setUsername] = useState('baak');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isCurrentNonAdmin = currentUser && currentUser.role !== 'admin';

  const handleAdminLogin = async (e: React.FormEvent) => { e.preventDefault(); if(isLoading) return; setErrorMessage(''); setSuccessMessage(''); setIsLoading(true); try { const user = await login(username.trim(), password, 'admin'); setSuccessMessage('Login berhasil.'); onLoginSuccess(user);  } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Login gagal.'); } finally { setIsLoading(false); } };

  const stmikLogo = getStmikLogoDataUrl();

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#222222] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Back to public link */}
      <div className="w-full max-w-md mb-5 flex items-center justify-between text-xs text-[#555555]">
        <button
          type="button"
          data-frost="Button"
          onClick={onNavigateHome}
          className="frost-btn frost-btn-xs frost-btn-brand frost-btn-outline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Portal Utama</span>
        </button>
        <span className="text-[#777777] font-medium">BAAK & Akademik</span>
      </div>

      {/* Main Frost-UI Card */}
      <div className="frost-card shadow-[0_2px_6px_rgba(0,0,0,0.08)] max-w-md w-full overflow-hidden">
        {/* Card Header */}
        <div className="p-6 sm:p-8 border-b border-[#eeeeee] bg-white text-center space-y-2">
          <div className="w-14 h-14 rounded-[8px] bg-[#fafafa] border border-[#dddddd] mx-auto flex items-center justify-center p-2 mb-2">
            {stmikLogo ? (
              <img src={stmikLogo} alt="Logo STMIK" referrerPolicy="no-referrer" className="w-10 h-10 object-contain" />
            ) : (
              <Building className="w-7 h-7 text-[#0080FF]" />
            )}
          </div>

          <div className="text-xs font-medium text-[#555555]">
            Portal Administrator BAAK · {CAMPUS_INFO.semester}
          </div>

          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#222222]">
            Konsol Administrator
          </h1>
          <p className="text-xs text-[#777777]">
            {CAMPUS_INFO.name}
          </p>
        </div>

        {/* Warning if logged in as student or lecturer */}
        {isCurrentNonAdmin && (
          <div className="mx-6 sm:mx-8 mt-6 frost-callout frost-callout-warning text-xs">
            <Lock className="w-4 h-4 text-[#DE6F01] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#6F3800]">Sesi Non-Admin Terdeteksi</div>
              <p className="mt-1 leading-relaxed text-[#904900]">
                Anda saat ini aktif sebagai <strong>{currentUser.name}</strong> ({currentUser.role}). Masuk sebagai Administrator akan mengganti sesi aktif Anda.
              </p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {errorMessage && (
            <div data-frost="Callout" className="frost-callout frost-callout-error text-xs">
              <AlertCircle className="w-4 h-4 text-[#E54545] shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div data-frost="Callout" className="frost-callout frost-callout-success text-xs">
              <CheckCircle2 className="w-4 h-4 text-[#009499] shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div>
              <label className="frost-label">
                Username Administrator
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#777777]">
                  <Shield className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="baak"
                  className="frost-input pl-10 pr-4 font-mono"
                  autoComplete="username"
                  required
                />
              </div>
              <span className="text-xs text-[#777777] mt-2 block">
                Username default: <strong className="text-[#222222] font-mono">baak</strong>
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-semibold text-[#555555]">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => onOpenForgotPassword('admin', username)}
                  className="text-xs text-[#0080FF] hover:text-[#016FDE] hover:underline font-medium cursor-pointer"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#777777]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="frost-input pl-10 pr-10 font-mono"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#777777] hover:text-[#222222] cursor-pointer"
                  title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                data-frost="Button"
                disabled={isLoading}
                className="frost-btn frost-btn-lg frost-btn-solid frost-btn-brand frost-btn-full"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Akses...</span>
                  </div>
                ) : (
                  <>
                    <span className="label">Masuk ke Konsol BAAK</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="pt-5 border-t border-[#eeeeee] text-center">
            <p className="text-xs text-[#777777] leading-relaxed">
              Akses terisolasi khusus petugas akademik BAAK {CAMPUS_INFO.name}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
