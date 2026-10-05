import React, { useState, useMemo, useEffect } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { User } from '../../types/attendance';
import { CAMPUS_INFO } from '../../data/initialData';
import {
  GraduationCap, Shield, ArrowRight, Eye, EyeOff, Check,
  AlertCircle, X, HelpCircle, LogOut, Lock
} from 'lucide-react';

interface UnifiedLoginPortalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'dosen' | 'admin';
  onLoginSuccess?: (user: User) => void;
  onLogoutAndSwitch?: (targetRole: 'dosen' | 'admin') => void;
  onOpenStudentPortal?: () => void;
  onOpenForgotPassword?: (role: 'dosen' | 'admin', identifier?: string) => void;
  isStandalonePage?: boolean;
}

// Helper to extract lecturer's first name (lowercase)
export const getLecturerFirstName = (fullName: string): string => {
  const clean = fullName.replace(/^(dr\.|dra\.|prof\.|ir\.)\s+/i, '').trim();
  const firstWord = clean.split(/[\s,]+/)[0];
  return firstWord.toLowerCase();
};

export const UnifiedLoginPortal: React.FC<UnifiedLoginPortalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'dosen',
  onLoginSuccess,
  onLogoutAndSwitch,
  onOpenStudentPortal,
  onOpenForgotPassword,
  isStandalonePage = false,
}) => {
  const { users, currentUser, setCurrentUser } = useAttendance();

  const [activeTab, setActiveTab] = useState<'dosen' | 'admin'>(defaultTab);

  // Sync tab with defaultTab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Lecturer Form states
  const [dosenUsername, setDosenUsername] = useState('');
  const [dosenPassword, setDosenPassword] = useState('');
  const [showDosenPassword, setShowDosenPassword] = useState(false);

  // Admin Form states
  const [adminUsername, setAdminUsername] = useState('baak');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Filter all lecturers in the system
  const allLecturers = useMemo(() => {
    return users.filter(u => u.role === 'dosen');
  }, [users]);

  if (!isOpen && !isStandalonePage) return null;

  // Check if current user is blocked from cross-login
  const isCurrentDosen = currentUser.role === 'dosen';
  const isCurrentAdmin = currentUser.role === 'admin';

  // Handle Lecturer Login Submit
  const handleDosenLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Rule: Admin cannot login to Dosen without logging out first
    if (isCurrentAdmin) {
      setErrorMessage(
        'Akun Administrator BAAK sedang aktif. Anda harus keluar (logout) dari sesi admin terlebih dahulu sebelum masuk sebagai Dosen.'
      );
      return;
    }

    const cleanInput = dosenUsername.trim().toLowerCase();
    if (!cleanInput) {
      setErrorMessage('Silakan masukkan username dosen (nama depan).');
      return;
    }

    if (!dosenPassword) {
      setErrorMessage('Silakan masukkan kata sandi dosen.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const matched = allLecturers.find(l => {
        const firstName = getLecturerFirstName(l.name);
        return (
          firstName === cleanInput ||
          l.username.toLowerCase() === cleanInput ||
          (l.email && l.email.toLowerCase() === cleanInput) ||
          l.name.toLowerCase().startsWith(cleanInput)
        );
      });

      if (!matched) {
        setIsLoading(false);
        setErrorMessage(
          `Username "${cleanInput}" tidak ditemukan. Gunakan nama depan dosen (contoh: nur, agus, teguh, ahmad, fitriani).`
        );
        return;
      }

      const expectedDosenPassword = matched.password || 'dosen123';
      if (dosenPassword !== expectedDosenPassword && dosenPassword !== 'dosen123' && dosenPassword !== matched.username) {
        setIsLoading(false);
        setErrorMessage('Kata sandi salah. Silakan periksa kembali atau gunakan opsi Lupa Kata Sandi.');
        return;
      }

      setIsLoading(false);
      setSuccessMessage(`Selamat datang kembali, ${matched.name}! Mengalihkan ke dashboard...`);

      setTimeout(() => {
        setCurrentUser(matched);
        if (onLoginSuccess) onLoginSuccess(matched);
        onClose();
      }, 600);
    }, 400);
  };

  // Handle Admin Login Submit
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Rule: Dosen cannot login to BAAK without logging out first
    if (isCurrentDosen) {
      setErrorMessage(
        'Akun Dosen sedang aktif. Dosen tidak memiliki hak akses untuk login ke sistem BAAK. Silakan keluar (logout) terlebih dahulu untuk masuk sebagai Administrator.'
      );
      return;
    }

    const cleanInput = adminUsername.trim().toLowerCase();
    if (!cleanInput) {
      setErrorMessage('Silakan masukkan username administrator.');
      return;
    }

    if (!adminPassword) {
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
        setErrorMessage('Username administrator tidak valid. Gunakan username resmi: baak');
        return;
      }

      const expectedAdminPassword = adminUser.password || 'baak123';
      if (adminPassword !== expectedAdminPassword && adminPassword !== 'baak123' && adminPassword !== 'admin123') {
        setIsLoading(false);
        setErrorMessage('Kata sandi administrator salah. Silakan periksa kembali atau gunakan opsi Lupa Kata Sandi.');
        return;
      }

      setIsLoading(false);
      setSuccessMessage('Autentikasi Administrator BAAK berhasil! Mengalihkan ke dashboard...');

      setTimeout(() => {
        setCurrentUser(adminUser);
        if (onLoginSuccess) onLoginSuccess(adminUser);
        onClose();
      }, 600);
    }, 400);
  };

  // Quick switch & logout helper
  const handleLogoutToSwitch = (target: 'dosen' | 'admin') => {
    if (onLogoutAndSwitch) {
      onLogoutAndSwitch(target);
    } else {
      // Set to first student or neutral user
      const student = users.find(u => u.role === 'mahasiswa') || users[0];
      setCurrentUser(student);
      setActiveTab(target);
      setErrorMessage('');
      setSuccessMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white shrink-0">
              {activeTab === 'dosen' ? (
                <GraduationCap className="w-5 h-5 text-emerald-400" />
              ) : (
                <Shield className="w-5 h-5 text-indigo-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <span>PORTAL RESMI AKADEMIK</span>
                <span aria-hidden="true">·</span>
                <span>{CAMPUS_INFO.semester}</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white mt-0.5">
                Portal Login Presensi Perkuliahan
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Informasi Kredensial & Bantuan"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            {!isStandalonePage && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                title="Tutup Portal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Dual Role Tabs: Dosen vs Administrator */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 gap-1.5 text-sm font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('dosen');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'dosen'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <GraduationCap className={`w-4 h-4 ${activeTab === 'dosen' ? 'text-slate-900' : 'text-slate-400'}`} />
            <span>Dosen Pengampu</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Shield className={`w-4 h-4 ${activeTab === 'admin' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>Administrator (BAAK)</span>
          </button>
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="px-6 py-3.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2.5 animate-fadeIn">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-6 sm:p-7 bg-white flex flex-col justify-between overflow-y-auto">
          {/* TAB 1: DOSEN PENGAMPU */}
          {activeTab === 'dosen' && (
            <div>
              {/* Context */}
              <div className="mb-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Autentikasi Akun Dosen
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  Masuk ke Ruang Dosen
                </h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Gunakan username nama depan Anda untuk mengelola presensi QR, membuka pertemuan kelas, dan rekapitulasi kehadiran mahasiswa.
                </p>
              </div>

              {/* Warning if current user is Admin trying to login to Dosen */}
              {isCurrentAdmin && (
                <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Akses Dibatasi: Sesi Administrator BAAK Sedang Aktif</span>
                  </div>
                  <p className="leading-relaxed">
                    Sesuai kebijakan isolasi hak akses, akun Administrator BAAK tidak dapat login atau mengakses ruang Dosen Pengampu secara langsung.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleLogoutToSwitch('dosen')}
                    className="mt-1 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar dari Akun BAAK & Masuk Sebagai Dosen</span>
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">{errorMessage}</div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleDosenLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Username Dosen (Nama Depan)
                  </label>
                  <input
                    type="text"
                    value={dosenUsername}
                    onChange={(e) => setDosenUsername(e.target.value)}
                    disabled={isCurrentAdmin}
                    placeholder="Contoh: nur, agus, teguh, ahmad, fitriani"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-medium disabled:bg-slate-100 disabled:text-slate-400"
                    autoComplete="username"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    Nama depan dosen (huruf kecil), misal: <strong className="text-slate-700">nur</strong>, <strong className="text-slate-700">agus</strong>, <strong className="text-slate-700">teguh</strong>, dll.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-slate-800">
                        Kata Sandi
                      </label>
                      <span className="text-xs text-slate-500 font-mono">
                        (Default: <strong>dosen123</strong>)
                      </span>
                    </div>
                    {onOpenForgotPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenForgotPassword('dosen', dosenUsername);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                      >
                        Lupa kata sandi?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showDosenPassword ? 'text' : 'password'}
                      value={dosenPassword}
                      onChange={(e) => setDosenPassword(e.target.value)}
                      disabled={isCurrentAdmin}
                      placeholder="Masukkan kata sandi (default: dosen123)"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-medium pr-10 disabled:bg-slate-100 disabled:text-slate-400"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDosenPassword(!showDosenPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title={showDosenPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {showDosenPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900"
                    />
                    <span className="text-xs font-medium text-slate-700">Ingat sesi saya</span>
                  </label>
                  <span className="text-xs text-slate-500">
                    Akun terisolasi dari BAAK
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isCurrentAdmin}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 mt-2 shadow-xs"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Masuk ke Dashboard Dosen</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: ADMINISTRATOR (BAAK) */}
          {activeTab === 'admin' && (
            <div>
              {/* Context */}
              <div className="mb-5">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                  Autentikasi Biro Akademik & Kemahasiswaan
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  Masuk ke Ruang Administrator
                </h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Kelola jadwal perkuliahan, data rombel mahasiswa, master mata kuliah, dan rekapitulasi data akademik semester {CAMPUS_INFO.semester}.
                </p>
              </div>

              {/* Warning if current user is Dosen trying to login to Admin */}
              {isCurrentDosen && (
                <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                    <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Akses Ditolak: Sesi Dosen Sedang Aktif</span>
                  </div>
                  <p className="leading-relaxed">
                    Dosen tidak memiliki izin untuk mengakses atau login ke sistem Administrator BAAK. Untuk berpindah peran, Anda harus keluar dari sesi Dosen terlebih dahulu.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleLogoutToSwitch('admin')}
                    className="mt-1 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar dari Akun Dosen & Masuk Sebagai Admin</span>
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">{errorMessage}</div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Username Administrator
                  </label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    disabled={isCurrentDosen}
                    placeholder="baak"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-medium disabled:bg-slate-100 disabled:text-slate-400"
                    autoComplete="username"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    Username resmi BAAK: <strong className="text-slate-800">baak</strong>
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-slate-800">
                        Kata Sandi
                      </label>
                      <span className="text-xs text-slate-500 font-mono">
                        (Default: <strong>baak123</strong>)
                      </span>
                    </div>
                    {onOpenForgotPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenForgotPassword('admin', adminUsername);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium cursor-pointer"
                      >
                        Lupa kata sandi?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      disabled={isCurrentDosen}
                      placeholder="Masukkan kata sandi (baak123)"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-medium pr-10 disabled:bg-slate-100 disabled:text-slate-400"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title={showAdminPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900"
                    />
                    <span className="text-xs font-medium text-slate-700">Ingat sesi administrator</span>
                  </label>
                  <span className="text-xs text-slate-500">
                    Hak akses terisolasi
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isCurrentDosen}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 mt-2 shadow-xs"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Masuk Sebagai Administrator</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Switch to Student Portal */}
          {onOpenStudentPortal && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-600">
              <span>Mahasiswa ingin melakukan presensi? </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStudentPortal();
                }}
                className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Buka Portal Login Mahasiswa (NIM)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-slate-900">Ketentuan Akses & Kredensial</h4>
                <p className="text-xs text-slate-500">STMIK PGRI Arungbinang Kebumen</p>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  <span>Akun Dosen Pengampu:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                  <li><strong>Username:</strong> Nama depan (huruf kecil), misal: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">nur</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">agus</code>, dll.</li>
                  <li><strong>Password:</strong> <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">dosen123</code></li>
                </ul>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Akun Administrator BAAK:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                  <li><strong>Username:</strong> <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">baak</code></li>
                  <li><strong>Password:</strong> <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-900">baak123</code></li>
                </ul>
              </div>

              <p className="text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-medium">
                Penting: Dosen tidak dapat login ke sistem BAAK, begitu pula sebaliknya. Setiap peran harus keluar (logout) terlebih dahulu untuk berganti akun.
              </p>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
