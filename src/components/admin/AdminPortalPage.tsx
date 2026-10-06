import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { User } from '../../types/attendance';
import { CAMPUS_INFO } from '../../data/initialData';
import { getStmikLogoDataUrl } from '../../utils/logoStmik';
import {
  Shield, KeyRound, Eye, EyeOff, ArrowRight, ArrowLeft,
  AlertCircle, CheckCircle2, Lock, Sparkles, Building
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

  // Check if non-admin is currently logged in
  const isCurrentNonAdmin = currentUser && currentUser.role !== 'admin';

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanInput = username.trim().toLowerCase();
    if (!cleanInput) {
      setErrorMessage('Silakan masukkan username administrator BAAK.');
      return;
    }

    if (!password) {
      setErrorMessage('Silakan masukkan kata sandi administrator.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const adminUser = users.find(u => u.role === 'admin') || {
        id: 'user-admin-1',
        username: 'baak',
        name: 'Administrator Akademik (BAAK)',
        email: 'baak@stmik-arungbinang.ac.id',
        role: 'admin',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        title: 'Kepala BAAK',
        phone: '081234567890',
      };

      if (cleanInput !== 'baak' && cleanInput !== adminUser.username.toLowerCase()) {
        setIsLoading(false);
        setErrorMessage('Username administrator tidak valid.');
        return;
      }

      // Password verification: jika admin sudah pernah ganti password via email, password default TIDAK BERLAKU LAGI
      if (adminUser.password) {
        if (password !== adminUser.password) {
          setIsLoading(false);
          if (password === 'baak123' || password === 'admin123') {
            setErrorMessage('Kata sandi default (baak123) sudah tidak berlaku karena Anda telah memperbarui kata sandi via email. Silakan gunakan kata sandi baru Anda.');
          } else {
            setErrorMessage('Kata sandi administrator salah. Silakan periksa kembali atau gunakan fitur Atur Ulang Kata Sandi.');
          }
          return;
        }
      } else {
        if (password !== 'baak123' && password !== 'admin123') {
          setIsLoading(false);
          setErrorMessage('Kata sandi administrator salah. Gunakan password resmi: baak123');
          return;
        }
      }

      setIsLoading(false);
      setSuccessMessage('Autentikasi Administrator BAAK berhasil. Mengalihkan ke konsol...');

      setTimeout(() => {
        onLoginSuccess(adminUser);
      }, 400);
    }, 350);
  };

  const stmikLogo = getStmikLogoDataUrl();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Back to public link */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Kembali ke Portal Publik</span>
        </button>
        <span className="font-mono text-slate-500 text-[11px]">DIR: ~/portaladmin</span>
      </div>

      {/* Main Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100 relative z-10">
        {/* Card Header */}
        <div className="p-6 sm:p-7 border-b border-slate-800 bg-slate-900/90 text-center relative">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border border-slate-700 mx-auto flex items-center justify-center p-2 mb-3 shadow-inner">
            {stmikLogo ? (
              <img src={stmikLogo} alt="Logo STMIK" className="w-12 h-12 object-contain" />
            ) : (
              <Building className="w-8 h-8 text-indigo-400" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-950/70 border border-indigo-700/50 rounded-full text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-2">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>PORTAL EKSKLUSIF BAAK</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Konsol Administrator
          </h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {CAMPUS_INFO.name}
          </p>
        </div>

        {/* Warning if logged in as student or lecturer */}
        {isCurrentNonAdmin && (
          <div className="mx-6 mt-6 p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Sesi Non-Admin Terdeteksi</span>
            </div>
            <p className="leading-relaxed">
              Anda saat ini aktif sebagai <strong className="text-white">{currentUser.name}</strong> ({currentUser.role.toUpperCase()}). Masuk sebagai Administrator akan mengganti sesi aktif Anda.
            </p>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 sm:p-7 space-y-4">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/50 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-950/50 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username Administrator
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Shield className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="baak"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
                  autoComplete="username"
                  required
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Username default: <strong className="text-slate-300 font-mono">baak</strong>
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => onOpenForgotPassword('admin', username)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-medium cursor-pointer"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-900/30 mt-2"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi Akses...</span>
                </div>
              ) : (
                <>
                  <span>Masuk ke Konsol BAAK</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security footnote */}
          <div className="pt-3 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              🔒 Jalur akses terenkripsi dan terisolasi. Seluruh sesi diawasi sesuai protokol keamanan akademik STMIK PGRI Arungbinang.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
