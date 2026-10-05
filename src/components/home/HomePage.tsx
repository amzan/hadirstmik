import React, { useState, useEffect } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { CAMPUS_INFO } from '../../data/initialData';
import { User } from '../../types/attendance';
import {
  GraduationCap, BookOpen, Shield, ArrowRight,
  AlertTriangle, Lock, Calendar, Eye, EyeOff,
  CheckCircle2, Sparkles, UserCheck, KeyRound, Smartphone
} from 'lucide-react';

interface HomePageProps {
  onLoginSuccess: (user: User) => void;
  activeRoleTab?: 'mahasiswa' | 'dosen' | 'admin';
  onChangeRoleTab?: (role: 'mahasiswa' | 'dosen' | 'admin') => void;
  inactivityNotice?: string | null;
  onDismissInactivityNotice?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onLoginSuccess,
  activeRoleTab: externalRoleTab = 'mahasiswa',
  onChangeRoleTab,
  inactivityNotice,
  onDismissInactivityNotice,
}) => {
  const { students, users, addUser } = useAttendance();

  const [activeTab, setActiveTab] = useState<'mahasiswa' | 'dosen' | 'admin'>(externalRoleTab);

  // Sync with external role tab if header button is clicked
  useEffect(() => {
    setActiveTab(externalRoleTab);
  }, [externalRoleTab]);

  const handleTabChange = (tab: 'mahasiswa' | 'dosen' | 'admin') => {
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
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

    setIsLoading(true);

    setTimeout(() => {
      // 1. MAHASISWA LOGIN
      if (activeTab === 'mahasiswa') {
        const cleanNim = cleanInput.toUpperCase();
        if (passwordInput !== 'pass123') {
          setIsLoading(false);
          setErrorMessage('Kata sandi salah. Silakan periksa kembali kata sandi Anda.');
          return;
        }

        const existingUser = users.find(
          u => u.username.toUpperCase() === cleanNim && u.role === 'mahasiswa'
        );

        if (existingUser) {
          setIsLoading(false);
          setSuccessMessage(`Login berhasil! Selamat datang, ${existingUser.name}.`);
          setTimeout(() => onLoginSuccess(existingUser), 400);
          return;
        }

        const foundStudent = students.find(s => s.nim.toUpperCase() === cleanNim);
        if (foundStudent) {
          const newStudentUser: User = {
            id: `mhs-${foundStudent.nim}`,
            username: foundStudent.nim,
            name: foundStudent.name,
            email: foundStudent.email,
            role: 'mahasiswa',
            prodi: foundStudent.prodi,
            rombel: foundStudent.rombel,
            phone: foundStudent.phone,
            avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          };
          addUser(newStudentUser);
          setIsLoading(false);
          setSuccessMessage(`Login berhasil! Selamat datang, ${newStudentUser.name}.`);
          setTimeout(() => onLoginSuccess(newStudentUser), 400);
          return;
        }

        setIsLoading(false);
        setErrorMessage(`NIM "${cleanNim}" tidak terdaftar dalam data rombel mahasiswa aktif.`);
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
            `Dosen dengan akun "${cleanInput}" tidak ditemukan. Silakan periksa kembali.`
          );
          return;
        }

        if (passwordInput !== 'dosen123' && passwordInput !== matchedDosen.username) {
          setIsLoading(false);
          setErrorMessage('Kata sandi dosen salah. Silakan periksa kembali.');
          return;
        }

        setIsLoading(false);
        setSuccessMessage(`Login berhasil! Selamat datang, ${matchedDosen.name}.`);
        setTimeout(() => onLoginSuccess(matchedDosen), 400);
        return;
      }

      // 3. BAAK / ADMIN LOGIN
      if (activeTab === 'admin') {
        const lowerInput = cleanInput.toLowerCase();
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

        if (lowerInput !== 'baak' && lowerInput !== 'admin') {
          setIsLoading(false);
          setErrorMessage('Username administrator tidak valid.');
          return;
        }

        if (passwordInput !== 'admin123' && passwordInput !== 'baak123') {
          setIsLoading(false);
          setErrorMessage('Kata sandi administrator salah. Silakan periksa kembali.');
          return;
        }

        setIsLoading(false);
        setSuccessMessage(`Login administrator berhasil. Mengalihkan...`);
        setTimeout(() => onLoginSuccess(adminUser), 400);
        return;
      }
    }, 350);
  };

  return (
    <div className="py-4 sm:py-8 space-y-6 sm:space-y-8 animate-fadeIn w-full max-w-full overflow-hidden">
      {/* Inactivity Auto-Logout Alert Banner (if triggered) */}
      {inactivityNotice && (
        <div className="max-w-xl mx-auto p-3.5 sm:p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-900">
                Sesi Login Berakhir Otomatis
              </h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                {inactivityNotice}
              </p>
            </div>
          </div>
          {onDismissInactivityNotice && (
            <button
              onClick={onDismissInactivityNotice}
              className="text-amber-700 hover:text-amber-900 p-1 rounded-lg text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Hero Welcome Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2.5 px-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>{CAMPUS_INFO.name}</span>
        </div>

        <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Portal Presensi Perkuliahan
        </h2>

        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
          Silakan pilih peran pengguna di bawah ini untuk mengakses layanan presensi QR, absensi kelas, dan pengawasan akademik.
        </p>

        <div className="flex items-center justify-center text-xs text-slate-500 pt-0.5 font-medium">
          <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-0.5 rounded-full text-slate-700 text-[11px]">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span>{CAMPUS_INFO.semester}</span>
          </span>
        </div>
      </div>

      {/* UNIFIED ROLE SWITCHER & LOGIN CARD */}
      <div className="max-w-xl mx-auto w-full px-2 sm:px-0">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden transition-all">
          {/* Segmented Tab Bar Switcher */}
          <div className="p-1.5 bg-slate-100 border-b border-slate-200 grid grid-cols-3 gap-1 text-xs sm:text-sm font-semibold select-none">
            {/* Tab 1: Mahasiswa */}
            <button
              type="button"
              onClick={() => handleTabChange('mahasiswa')}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'mahasiswa'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <GraduationCap className={`w-4 h-4 ${activeTab === 'mahasiswa' ? 'text-white' : 'text-blue-600'}`} />
              <span className="truncate">Mahasiswa</span>
            </button>

            {/* Tab 2: Dosen */}
            <button
              type="button"
              onClick={() => handleTabChange('dosen')}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'dosen'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <BookOpen className={`w-4 h-4 ${activeTab === 'dosen' ? 'text-white' : 'text-slate-800'}`} />
              <span className="truncate">Dosen</span>
            </button>

            {/* Tab 3: BAAK */}
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-indigo-700 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Shield className={`w-4 h-4 ${activeTab === 'admin' ? 'text-white' : 'text-indigo-700'}`} />
              <span className="truncate">BAAK</span>
            </button>
          </div>

          {/* Form Content Area */}
          <div className="p-5 sm:p-7 space-y-5">
            {/* Header info for chosen role */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {activeTab === 'mahasiswa' && 'Login Portal Mahasiswa'}
                  {activeTab === 'dosen' && 'Login Dosen Pengampu'}
                  {activeTab === 'admin' && 'Login Administrator BAAK'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeTab === 'mahasiswa' && 'Akses scan QR presensi mandiri & rekap kehadiran'}
                  {activeTab === 'dosen' && 'Buka sesi perkuliahan & tayangkan QR Code kelas'}
                  {activeTab === 'admin' && 'Pusat kendali akademik, jadwal, & monitoring sesi'}
                </p>
              </div>

              <div className="shrink-0">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  activeTab === 'mahasiswa' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  activeTab === 'dosen' ? 'bg-slate-100 text-slate-800 border border-slate-300' :
                  'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  {activeTab === 'mahasiswa' ? 'NIM Mahasiswa' :
                   activeTab === 'dosen' ? 'Akun Dosen' : 'Akun BAAK'}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs sm:text-sm flex items-start gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm flex items-start gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Main Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Field 1: Username / NIM */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  {activeTab === 'mahasiswa' ? 'Nomor Induk Mahasiswa (NIM)' :
                   activeTab === 'dosen' ? 'Nama Depan / NIDN Dosen' :
                   'Username Administrator'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    {activeTab === 'mahasiswa' ? <GraduationCap className="w-4 h-4" /> :
                     activeTab === 'dosen' ? <BookOpen className="w-4 h-4" /> :
                     <Shield className="w-4 h-4" />}
                  </div>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder={
                      activeTab === 'mahasiswa' ? 'Contoh: 26TI0001' :
                      activeTab === 'dosen' ? 'Contoh: nur / agus / teguh' :
                      'Contoh: baak'
                    }
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-900 transition"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Field 2: Password */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Kata Sandi (Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-900 transition"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-xl text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-70 ${
                  activeTab === 'mahasiswa' ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800' :
                  activeTab === 'dosen' ? 'bg-slate-900 hover:bg-slate-800 active:bg-slate-950' :
                  'bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Memverifikasi Akun...</span>
                  </span>
                ) : (
                  <>
                    <span>
                      {activeTab === 'mahasiswa' && 'Masuk sebagai Mahasiswa'}
                      {activeTab === 'dosen' && 'Masuk sebagai Dosen'}
                      {activeTab === 'admin' && 'Masuk sebagai Administrator BAAK'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Lightweight Feature Highlights Below */}
      <div className="max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 px-2 sm:px-0 text-center">
        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-800">
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            <span>Sesi Terisolasi</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Logout otomatis saat muat ulang</p>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-800">
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>Scan Kamera HP</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Presensi QR real-time instan</p>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-800">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Multi-Role Kampus</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Mahasiswa, Dosen & BAAK</p>
        </div>
      </div>
    </div>
  );
};
