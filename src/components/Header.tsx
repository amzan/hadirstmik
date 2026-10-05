import React from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { CAMPUS_INFO } from '../data/initialData';
import {
  Clock, QrCode, ChevronDown, GraduationCap, LogOut, Shield, LogIn
} from 'lucide-react';

interface HeaderProps {
  onOpenRoleSwitcher?: () => void;
  onOpenScheduleModal?: () => void;
  onOpenLoginPortal?: (defaultTab?: 'dosen' | 'admin') => void;
  onOpenStudentLogin?: () => void;
  onLogout?: () => void;
  isLoggedOut?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenRoleSwitcher,
  onOpenLoginPortal,
  onOpenStudentLogin,
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
      <div className="bg-slate-900 text-slate-300 px-4 sm:px-6 py-2 text-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">STMIK PGRI Kebumen</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 hidden sm:inline">{CAMPUS_INFO.semester}</span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            {openSessionsCount > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {openSessionsCount} Sesi Aktif
              </span>
            )}

            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{activeDay}, {simulatedTime} WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none">
              Presensi Perkuliahan
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              STMIK PGRI Arungbinang Kebumen
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
        <div className="flex items-center gap-2.5">
          {/* If Logged Out: Show portal login buttons */}
          {isLoggedOut && (
            <div className="flex items-center gap-2">
              {onOpenStudentLogin && (
                <button
                  onClick={onOpenStudentLogin}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs"
                  title="Buka Portal Login Mahasiswa (NIM & Password)"
                >
                  <GraduationCap className="w-4 h-4 text-white" />
                  <span>Portal Mahasiswa</span>
                </button>
              )}

              {onOpenLoginPortal && (
                <button
                  onClick={() => onOpenLoginPortal('dosen')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs"
                  title="Buka Portal Login Dosen & Administrator BAAK"
                >
                  <LogIn className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Portal Dosen & BAAK</span>
                  <span className="sm:hidden">Dosen/BAAK</span>
                </button>
              )}
            </div>
          )}

          {/* Mahasiswa: Logged in State - NO portal buttons, replaced with Keluar button */}
          {isMahasiswa && (
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-blue-50/70 border border-blue-200 text-left select-none"
                title={`Akun Mahasiswa Aktif: ${currentUser.name}`}
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-blue-300"
                />

                <div>
                  <span className="text-sm font-semibold text-slate-900 max-w-[180px] truncate block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-xs text-blue-700 font-mono font-medium block leading-tight mt-0.5">
                    NIM: {currentUser.username} · {currentUser.rombel || 'Reguler'}
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 text-xs sm:text-sm font-semibold transition cursor-pointer"
                  title="Keluar dari akun mahasiswa"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          )}

          {/* Dosen: Strictly Locked Profile */}
          {isDosen && (
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-slate-50 border border-slate-200 text-left select-none"
                title="Akun Dosen Aktif (Terisolasi dari sistem BAAK)"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />

                <div>
                  <span className="text-sm font-semibold text-slate-900 max-w-[180px] truncate block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-xs text-slate-500 block leading-tight mt-0.5">
                    {getRoleLabel()}
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs sm:text-sm font-semibold transition cursor-pointer"
                  title="Keluar dari akun dosen"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              )}
            </div>
          )}

          {/* Administrator BAAK: Strictly Locked Profile */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-indigo-50/60 border border-indigo-200 text-left select-none"
                title="Akun Administrator BAAK Aktif (Terisolasi dari ruang Dosen)"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-indigo-300"
                />

                <div>
                  <span className="text-sm font-semibold text-slate-900 max-w-[180px] truncate block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-xs text-indigo-700 font-medium block leading-tight mt-0.5">
                    Administrator (BAAK)
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs sm:text-sm font-semibold transition cursor-pointer"
                  title="Keluar dari akun administrator"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
