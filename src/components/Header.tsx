import React from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { CAMPUS_INFO } from '../data/initialData';
import {
  Clock, QrCode, ChevronDown, GraduationCap, LogOut, Shield, LogIn, BookOpen
} from 'lucide-react';

interface HeaderProps {
  onOpenRoleSwitcher?: () => void;
  onOpenScheduleModal?: () => void;
  onOpenLoginPortal?: (defaultTab?: 'dosen' | 'admin') => void;
  onOpenStudentLogin?: () => void;
  onOpenDosenLogin?: () => void;
  onOpenBaakLogin?: () => void;
  onLogout?: () => void;
  isLoggedOut?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenRoleSwitcher,
  onOpenLoginPortal,
  onOpenStudentLogin,
  onOpenDosenLogin,
  onOpenBaakLogin,
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
      <div className="bg-slate-900 text-slate-300 px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-semibold text-white truncate max-w-[130px] sm:max-w-none">STMIK PGRI Kebumen</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 hidden sm:inline">{CAMPUS_INFO.semester}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm shrink-0">
            {openSessionsCount > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{openSessionsCount} <span className="hidden sm:inline">Sesi Aktif</span></span>
              </span>
            )}

            <div className="flex items-center gap-1 sm:gap-1.5 text-slate-300 font-medium">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
              <span>{activeDay}, {simulatedTime} WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0">
            <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-bold text-slate-900 tracking-tight leading-none">
              Presensi Perkuliahan
            </h1>
            <p className="text-[11px] sm:text-sm text-slate-500 mt-0.5 sm:mt-1 truncate max-w-[120px] sm:max-w-none">
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
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* If Logged Out: Show portal login buttons for each user role */}
          {isLoggedOut && (
            <div className="flex items-center gap-1 sm:gap-2">
              {onOpenStudentLogin && (
                <button
                  onClick={onOpenStudentLogin}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs"
                  title="Buka Portal Login Mahasiswa (NIM & Password)"
                >
                  <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  <span className="hidden sm:inline">Portal Mahasiswa</span>
                  <span className="sm:hidden">Mahasiswa</span>
                </button>
              )}

              {onOpenDosenLogin && (
                <button
                  onClick={onOpenDosenLogin}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs"
                  title="Buka Portal Login Dosen Pengampu"
                >
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200" />
                  <span className="hidden sm:inline">Portal Dosen</span>
                  <span className="sm:hidden">Dosen</span>
                </button>
              )}

              {onOpenBaakLogin && (
                <button
                  onClick={onOpenBaakLogin}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs"
                  title="Buka Portal Login Administrator BAAK"
                >
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-200" />
                  <span className="hidden sm:inline">Portal BAAK</span>
                  <span className="sm:hidden">BAAK</span>
                </button>
              )}
            </div>
          )}

          {/* Mahasiswa: Logged in State - NO portal buttons, replaced with Keluar button */}
          {isMahasiswa && (
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <div
                className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3.5 py-1 sm:py-2 rounded-lg bg-blue-50/70 border border-blue-200 text-left select-none max-w-[140px] sm:max-w-[220px]"
                title={`Akun Mahasiswa Aktif: ${currentUser.name}`}
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={currentUser.name}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-blue-300 shrink-0"
                />

                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] sm:text-xs text-blue-700 font-mono font-medium truncate block leading-tight mt-0.5">
                    {currentUser.username} · {currentUser.rombel || 'Reguler'}
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0"
                  title="Keluar dari akun mahasiswa"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          )}

          {/* Dosen: Strictly Locked Profile */}
          {isDosen && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3.5 py-1 sm:py-2 rounded-lg bg-slate-50 border border-slate-200 text-left select-none max-w-[140px] sm:max-w-[220px]"
                title="Akun Dosen Aktif (Terisolasi dari sistem BAAK)"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={currentUser.name}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-200 shrink-0"
                />

                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-500 truncate block leading-tight mt-0.5">
                    {getRoleLabel()}
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0"
                  title="Keluar dari akun dosen"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          )}

          {/* Administrator BAAK: Strictly Locked Profile */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3.5 py-1 sm:py-2 rounded-lg bg-indigo-50/60 border border-indigo-200 text-left select-none max-w-[140px] sm:max-w-[220px]"
                title="Akun Administrator BAAK Aktif (Terisolasi dari ruang Dosen)"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.name}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-indigo-300 shrink-0"
                />

                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] sm:text-xs text-indigo-700 font-medium truncate block leading-tight mt-0.5">
                    BAAK
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0"
                  title="Keluar dari akun administrator"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
