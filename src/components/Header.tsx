import React from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { CAMPUS_INFO } from '../data/initialData';
import { getStmikLogoDataUrl } from '../utils/logoStmik';
import {
  Clock, ChevronDown, GraduationCap, LogOut, Shield, LogIn, BookOpen, UserCog, KeyRound
} from 'lucide-react';

interface HeaderProps {
  onOpenRoleSwitcher?: () => void;
  onOpenScheduleModal?: () => void;
  onOpenLoginPortal?: (defaultTab?: 'dosen' | 'admin') => void;
  onOpenStudentLogin?: () => void;
  onOpenDosenLogin?: () => void;
  onOpenDosenProfile?: () => void;
  onOpenMahasiswaProfile?: () => void;
  onOpenBaakProfile?: () => void;
  onOpenForgotPassword?: () => void;
  onLogout?: () => void;
  isLoggedOut?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenRoleSwitcher,
  onOpenLoginPortal,
  onOpenStudentLogin,
  onOpenDosenLogin,
  onOpenDosenProfile,
  onOpenMahasiswaProfile,
  onOpenBaakProfile,
  onOpenForgotPassword,
  onLogout,
  isLoggedOut = false
}) => {
  const {
    currentUser,
    activeDay,
    simulatedTime,
    getActiveScheduleNow,
    sessions
  } = useAttendance();

  const isDosen = !isLoggedOut && currentUser.role === 'dosen';
  const isAdmin = !isLoggedOut && currentUser.role === 'admin';
  const isMahasiswa = !isLoggedOut && currentUser.role === 'mahasiswa';
  const activeSchedule = getActiveScheduleNow();
  const openSessionsCount = sessions.filter(s => s.isOpen).length;

  const getRoleLabel = () => {
    switch (currentUser.role) {
      case 'admin':
        return 'Administrator';
      case 'dosen':
        return 'Dosen Pengampu';
      case 'mahasiswa':
        return `Mahasiswa · ${currentUser.rombel || 'Reguler'}`;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      {/* Top Hairline Bar: Campus Identity & Live Clock */}
      <div className="bg-slate-900 text-slate-300 px-2.5 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm w-full max-w-full overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3 w-full">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-white truncate text-[11px] sm:text-sm">STMIK PGRI Kebumen</span>
            <span className="text-slate-600 hidden xs:inline">·</span>
            <span className="text-slate-300 hidden md:inline">{CAMPUS_INFO.semester}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm shrink-0">
            {openSessionsCount > 0 && (
              <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px] sm:text-xs">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{openSessionsCount} <span className="hidden xs:inline">Sesi Aktif</span></span>
              </span>
            )}

            <div className="flex items-center gap-1 text-slate-300 font-medium text-[11px] sm:text-xs">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{activeDay}, {simulatedTime} WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 w-full">
        {/* Brand */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-2xs border border-slate-200">
            <img
              src={getStmikLogoDataUrl()}
              alt="Logo STMIK PGRI Arungbinang"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight leading-tight truncate">
              Presensi Kampus
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 leading-none mt-0.5 truncate hidden xs:block">
              STMIK PGRI Arungbinang
            </p>
          </div>
        </div>

        {/* Current Active Course Schedule */}
        {activeSchedule && (
          <div className="hidden lg:flex items-center gap-2.5 text-sm text-slate-600 bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-slate-900">{activeSchedule.courseName}</span>
            <span className="text-slate-400">·</span>
            <span>{activeSchedule.room}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 font-mono">{activeSchedule.startTime}–{activeSchedule.endTime}</span>
          </div>
        )}

        {/* User Profile & Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* If Logged Out: Show portal login buttons for each user role */}
          {isLoggedOut && (
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {onOpenStudentLogin && (
                <button
                  onClick={onOpenStudentLogin}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] sm:text-xs md:text-sm font-semibold transition cursor-pointer shadow-2xs shrink-0"
                  title="Buka Portal Login Mahasiswa (NIM & Password)"
                >
                  <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
                  <span className="hidden sm:inline">Portal Mahasiswa</span>
                  <span className="sm:hidden">Mhs</span>
                </button>
              )}

              {onOpenDosenLogin && (
                <button
                  onClick={onOpenDosenLogin}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] sm:text-xs md:text-sm font-semibold transition cursor-pointer shadow-2xs shrink-0"
                  title="Buka Portal Login Dosen Pengampu"
                >
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200 shrink-0" />
                  <span className="hidden sm:inline">Portal Dosen</span>
                  <span className="sm:hidden">Dosen</span>
                </button>
              )}

              {onOpenForgotPassword && (
                <button
                  onClick={onOpenForgotPassword}
                  className="hidden md:flex items-center gap-1 px-2.5 py-1.5 sm:py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer shrink-0 border border-slate-200"
                  title="Atur Ulang Kata Sandi Akun via Email"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Reset Sandi</span>
                </button>
              )}
            </div>
          )}

          {/* Mahasiswa: Logged in State with Profile Configuration */}
          {isMahasiswa && (
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenMahasiswaProfile}
                className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-blue-50/70 hover:bg-blue-100 hover:border-blue-300 border border-blue-200 text-left cursor-pointer max-w-[130px] sm:max-w-[220px] transition group"
                title="Klik untuk konfigurasi profil mahasiswa & ganti password OTP"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={currentUser.name}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-blue-300 group-hover:border-blue-500 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-900 group-hover:text-blue-700 truncate block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-blue-700 font-mono font-medium truncate block leading-tight mt-0.5">
                    {currentUser.username}
                  </span>
                </div>

                <UserCog className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600 hidden sm:block shrink-0" />
              </button>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 text-[11px] sm:text-xs font-semibold transition cursor-pointer shrink-0"
                  title="Keluar dari akun mahasiswa"
                >
                  <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          )}

          {/* Dosen: Profile with configuration access */}
          {isDosen && (
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenDosenProfile}
                className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-blue-300 border border-slate-200 text-left cursor-pointer max-w-[130px] sm:max-w-[220px] transition group"
                title="Klik untuk melihat dan konfigurasi profil dosen & ganti password OTP"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={currentUser.name}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-slate-200 group-hover:border-blue-400 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-900 group-hover:text-blue-700 truncate block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 truncate block leading-tight mt-0.5 flex items-center gap-1">
                    <span>NIDN {currentUser.nidn || currentUser.username}</span>
                  </span>
                </div>

                <UserCog className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 hidden sm:block shrink-0" />
              </button>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] sm:text-xs font-semibold transition cursor-pointer shrink-0"
                  title="Keluar dari akun dosen"
                >
                  <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          )}

          {/* Administrator BAAK: Profile with Configuration */}
          {isAdmin && (
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenBaakProfile}
                className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-indigo-50/70 hover:bg-indigo-100 hover:border-indigo-300 border border-indigo-200 text-left cursor-pointer max-w-[130px] sm:max-w-[220px] transition group"
                title="Klik untuk konfigurasi profil administrator BAAK & ganti password OTP"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.name}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-indigo-300 group-hover:border-indigo-500 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-900 group-hover:text-indigo-800 truncate block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-indigo-700 font-medium truncate block leading-tight mt-0.5">
                    BAAK
                  </span>
                </div>

                <UserCog className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600 hidden sm:block shrink-0" />
              </button>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] sm:text-xs font-semibold transition cursor-pointer shrink-0"
                  title="Keluar dari akun administrator"
                >
                  <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
