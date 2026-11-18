import React, { useState, useEffect } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { User } from '../../types/attendance';
import {
  GraduationCap, BookOpen, ArrowRight,
  AlertTriangle, Eye, EyeOff,
  CheckCircle2, KeyRound
} from 'lucide-react';

interface HomePageProps {
  onLoginSuccess: (user: User) => void;
  activeRoleTab?: 'mahasiswa' | 'dosen';
  onChangeRoleTab?: (role: 'mahasiswa' | 'dosen') => void;
  onOpenForgotPassword?: (role?: 'mahasiswa' | 'dosen' | 'admin', identifier?: string) => void;
  onNavigateToAdmin?: () => void;
  inactivityNotice?: string | null;
  onDismissInactivityNotice?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onLoginSuccess,
  activeRoleTab: externalRoleTab = 'mahasiswa',
  onChangeRoleTab,
  onOpenForgotPassword,
  inactivityNotice,
  onDismissInactivityNotice,
}) => {
  const { students, users, addUser } = useAttendance();

  const [activeTab, setActiveTab] = useState<'mahasiswa' | 'dosen'>(
    externalRoleTab === 'dosen' ? 'dosen' : 'mahasiswa'
  );

  // Sync with external role tab if header button is clicked
  useEffect(() => {
    if (externalRoleTab === 'dosen' || externalRoleTab === 'mahasiswa') {
      setActiveTab(externalRoleTab);
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [externalRoleTab]);

  const handleTabChange = (tab: 'mahasiswa' | 'dosen') => {
    setActiveTab(tab);
    if (onChangeRoleTab) {
      onChangeRoleTab(tab);
    }
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Form inputs
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Auto-populate remembered username if previously saved for this role
  useEffect(() => {
    try {
      const savedRole = localStorage.getItem('stmik_remembered_role');
      const savedUser = localStorage.getItem('stmik_remembered_username');
      if (savedUser && !usernameInput && savedRole === activeTab) {
        setUsernameInput(savedUser);
      }
    } catch {}
  }, [activeTab]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanInput = usernameInput.trim();
    if (!cleanInput) {
      if (activeTab === 'mahasiswa') {
        setErrorMessage('Silakan masukkan Nomor Induk Mahasiswa (NIM).');
      } else if (activeTab === 'dosen') {
        setErrorMessage('Silakan masukkan username atau NIDN dosen.');
      } else {
        setErrorMessage('Silakan masukkan username administrator BAAK.');
      }
      return;
    }

    if (!passwordInput) {
      setErrorMessage('Silakan masukkan kata sandi Anda.');
      return;
    }

    const saveRememberedState = (usernameVal: string) => {
      try {
        if (rememberMe) {
          localStorage.setItem('stmik_remembered_role', activeTab);
          localStorage.setItem('stmik_remembered_username', usernameVal);
        } else {
          localStorage.removeItem('stmik_remembered_role');
          localStorage.removeItem('stmik_remembered_username');
        }
      } catch {}
    };

    setIsLoading(true);

    setTimeout(() => {
      // 1. MAHASISWA LOGIN
      if (activeTab === 'mahasiswa') {
        const cleanNim = cleanInput.toUpperCase();
        const lowerInput = cleanInput.toLowerCase();

        const existingUser = users.find(
          u => (u.username.toUpperCase() === cleanNim || (u.email && u.email.toLowerCase() === lowerInput)) && u.role === 'mahasiswa'
        );

        const foundStudent = students.find(
          s => s.nim.toUpperCase() === cleanNim || (s.email && s.email.toLowerCase() === lowerInput)
        );

        const currentPassword = existingUser?.password || foundStudent?.password;

        if (currentPassword) {
          if (passwordInput !== currentPassword) {
            setIsLoading(false);
            if (passwordInput === 'pass123') {
              setErrorMessage('Kata sandi default (pass123) sudah tidak berlaku karena Anda telah memperbarui kata sandi. Silakan gunakan kata sandi baru Anda.');
            } else {
              setErrorMessage('Kata sandi salah. Silakan periksa kembali kata sandi baru Anda atau gunakan fitur Lupa Kata Sandi.');
            }
            return;
          }
        } else {
          if (passwordInput !== 'pass123') {
            setIsLoading(false);
            setErrorMessage('Kata sandi salah. Silakan periksa kembali kata sandi Anda atau gunakan fitur Lupa Kata Sandi.');
            return;
          }
        }

        if (existingUser) {
          const canonicalUser: User = {
            ...existingUser,
            id: existingUser.id || `mhs-${existingUser.username}`,
            password: currentPassword,
          };
          addUser(canonicalUser);
          saveRememberedState(canonicalUser.username);
          setIsLoading(false);
          setSuccessMessage(`Login berhasil! Selamat datang, ${canonicalUser.name}.`);
          setTimeout(() => onLoginSuccess(canonicalUser), 400);
          return;
        }

        if (foundStudent) {
          const newStudentUser: User = {
            id: `mhs-${foundStudent.nim}`,
            username: foundStudent.nim,
            name: foundStudent.name,
            email: foundStudent.email,
            password: foundStudent.password,
            role: 'mahasiswa',
            prodi: foundStudent.prodi,
            rombel: foundStudent.rombel,
            phone: foundStudent.phone,
            avatarUrl: '',
          };
          addUser(newStudentUser);
          saveRememberedState(foundStudent.nim);
          setIsLoading(false);
          setSuccessMessage(`Login berhasil! Selamat datang, ${newStudentUser.name}.`);
          setTimeout(() => onLoginSuccess(newStudentUser), 400);
          return;
        }

        setIsLoading(false);
        setErrorMessage(`Identitas mahasiswa "${cleanInput}" tidak terdaftar dalam basis data rombel mahasiswa aktif.`);
        return;
      }

      // 2. DOSEN LOGIN
      if (activeTab === 'dosen') {
        const lowerInput = cleanInput.toLowerCase();
        const allLecturers = users.filter(u => u.role === 'dosen');

        const matchedDosen = allLecturers.find(l => {
          const firstName = l.name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') || '';
          return (
            firstName === lowerInput ||
            l.username.toLowerCase() === lowerInput ||
            (l.email && l.email.toLowerCase() === lowerInput) ||
            l.name.toLowerCase().includes(lowerInput)
          );
        });

        if (!matchedDosen) {
          setIsLoading(false);
          setErrorMessage(
            `Dosen dengan akun atau email "${cleanInput}" tidak ditemukan. Silakan periksa kembali.`
          );
          return;
        }

        if (matchedDosen.password) {
          if (passwordInput !== matchedDosen.password) {
            setIsLoading(false);
            if (passwordInput === 'dosen123' || passwordInput === matchedDosen.username) {
              setErrorMessage('Kata sandi default dosen sudah tidak berlaku karena Anda telah memperbarui kata sandi via email. Silakan gunakan kata sandi baru Anda.');
            } else {
              setErrorMessage('Kata sandi salah. Silakan periksa kembali kata sandi baru Anda atau gunakan fitur Lupa Kata Sandi.');
            }
            return;
          }
        } else {
          if (passwordInput !== 'dosen123' && passwordInput !== matchedDosen.username) {
            setIsLoading(false);
            setErrorMessage('Kata sandi dosen salah. Silakan periksa kembali atau gunakan fitur Lupa Kata Sandi.');
            return;
          }
        }

        saveRememberedState(matchedDosen.username);
        setIsLoading(false);
        setSuccessMessage(`Login berhasil! Selamat datang, ${matchedDosen.name}.`);
        setTimeout(() => onLoginSuccess(matchedDosen), 400);
        return;
      }
    }, 350);
  };

  return (
    <div className="py-2 sm:py-6 space-y-8 sm:space-y-10 w-full max-w-full">
      {/* Inactivity Auto-Logout Alert Banner (Frost-UI Warning Callout) */}
      {inactivityNotice && (
        <div className="max-w-xl mx-auto frost-callout frost-callout-warning justify-between items-center">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#DE6F01]" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[#6F3800]">
                Sesi Login Berakhir Otomatis
              </h4>
              <p className="text-xs text-[#904900] leading-relaxed">
                {inactivityNotice}
              </p>
            </div>
          </div>
          {onDismissInactivityNotice && (
            <button
              type="button"
              data-frost="Button"
              onClick={onDismissInactivityNotice}
              className="frost-btn frost-btn-xxs frost-btn-neutral shrink-0"
            >
              Tutup
            </button>
          )}
        </div>
      )}

      {/* Hero Header (Clean Frost-UI Typography, Balanced Spacing) */}
      <div className="text-center max-w-2xl mx-auto px-2">
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#222222] tracking-tight leading-tight"
          style={{ textWrap: 'balance' }}
        >
          Portal Presensi Perkuliahan
        </h2>
      </div>

      {/* UNIFIED ROLE SWITCHER & LOGIN CARD (Frost-UI Surface & Tabs) */}
      <div className="max-w-xl mx-auto w-full">
        <div className="frost-card overflow-hidden">
          {/* Frost-UI Tabs Switcher (Tab-BQdeouhM.css specification) */}
          <div className="frost-tabs grid grid-cols-2 bg-[#fafafa] gap-0">
            <button
              type="button"
              data-frost="Button"
              onClick={() => handleTabChange('mahasiswa')}
              className={`frost-tab-btn w-full h-12 ${
                activeTab === 'mahasiswa' ? 'frost-tab-btn-active' : ''
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span className="label truncate">Portal Mahasiswa</span>
            </button>

            <button
              type="button"
              data-frost="Button"
              onClick={() => handleTabChange('dosen')}
              className={`frost-tab-btn w-full h-12 ${
                activeTab === 'dosen' ? 'frost-tab-btn-active' : ''
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="label truncate">Portal Dosen</span>
            </button>
          </div>

          {/* Form Content Area */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Header info for chosen role */}
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#eeeeee]">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-semibold text-[#222222]">
                  {activeTab === 'mahasiswa' ? 'Login Portal Mahasiswa' : 'Login Dosen Pengampu'}
                </h3>
                <p className="text-xs sm:text-sm text-[#555555] leading-relaxed">
                  {activeTab === 'mahasiswa'
                    ? 'Akses scan QR presensi mandiri & kartu kehadiran semester'
                    : 'Buka sesi perkuliahan & tayangkan QR Code kelas'}
                </p>
              </div>

              <span className="text-xs text-[#555555] font-medium whitespace-nowrap shrink-0 pt-0.5">
                {activeTab === 'mahasiswa' ? 'Akun Mahasiswa' : 'Akun Dosen'}
              </span>
            </div>

            {/* Error Message (Frost-UI Error Callout) */}
            {errorMessage && (
              <div data-frost="Callout" className="frost-callout frost-callout-error">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#E54545]" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message (Frost-UI Success Callout) */}
            {successMessage && (
              <div data-frost="Callout" className="frost-callout frost-callout-success">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#009499]" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Main Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              {/* Field 1: Username / NIM (Frost-UI TextInput) */}
              <div>
                <label className="frost-label">
                  {activeTab === 'mahasiswa' ? 'Nomor Induk Mahasiswa (NIM)' : 'Nama Depan / NIDN Dosen'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#777777]">
                    {activeTab === 'mahasiswa' ? <GraduationCap className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                  </div>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder={
                      activeTab === 'mahasiswa' ? 'Contoh: 26TI0001' : 'Contoh: nur / agus / teguh'
                    }
                    className="frost-input pl-10 pr-4"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Field 2: Password (Frost-UI TextInput) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[13px] font-semibold text-[#555555]">
                    Kata Sandi
                  </label>
                  {onOpenForgotPassword && (
                    <button
                      type="button"
                      onClick={() => onOpenForgotPassword(activeTab, usernameInput)}
                      className="text-xs text-[#0080FF] hover:text-[#016FDE] font-medium hover:underline cursor-pointer"
                    >
                      Lupa kata sandi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#777777]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Masukkan kata sandi"
                    className="frost-input pl-10 pr-10"
                    disabled={isLoading}
                    autoComplete="current-password"
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

              {/* Remember Session Option */}
              <div className="flex items-center justify-between text-xs text-[#555555] pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-[4px] border-[#dddddd] text-[#0080FF] focus:ring-[#0080FF] cursor-pointer accent-[#0080FF]"
                  />
                  <span className="font-medium text-[#333333]">Ingat sesi di browser ini</span>
                </label>
                <span className="text-xs text-[#777777] tabular-nums">Durasi sesi 2 jam</span>
              </div>

              {/* Submit Button (Frost-UI Button lg solid) */}
              <div className="pt-1">
                <button
                  type="submit"
                  data-frost="Button"
                  disabled={isLoading}
                  className={`frost-btn frost-btn-lg frost-btn-full frost-btn-solid ${
                    activeTab === 'mahasiswa' ? 'frost-btn-brand' : 'frost-btn-neutral'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memverifikasi Akun...</span>
                    </span>
                  ) : (
                    <>
                      <span className="label">
                        {activeTab === 'mahasiswa' ? 'Masuk sebagai Mahasiswa' : 'Masuk sebagai Dosen'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
