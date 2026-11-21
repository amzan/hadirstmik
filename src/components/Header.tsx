import React from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { getStmikLogoDataUrl } from '../utils/logoStmik';
import {
  Clock, GraduationCap, LogOut, BookOpen, UserCog, KeyRound, ShieldCheck
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
  onOpenDeviceSessions?: () => void;
  onOpenForgotPassword?: () => void;
  onLogout?: () => void;
  isLoggedOut?: boolean;
  activeRoleTab?: 'mahasiswa' | 'dosen' | 'admin';
}

export const Header: React.FC<HeaderProps> = ({
  onOpenStudentLogin,
  onOpenDosenLogin,
  onOpenDosenProfile,
  onOpenMahasiswaProfile,
  onOpenBaakProfile,
  onOpenDeviceSessions,
  onOpenForgotPassword,
  onLogout,
  isLoggedOut = false,
  activeRoleTab = 'mahasiswa'
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

  const getInitials = (name: string) => {
    const parts = name
      .replace(/[.,]/g, '')
      .split(' ')
      .filter(p => p.length > 1 && !['Dr', 'Ir', 'MKom', 'SKom', 'MT', 'MM', 'MSi'].includes(p));
    if (parts.length === 0) return name.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#dddddd] w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 sm:py-0 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-8 w-full">
        {/* Zone 1: Brand Lockup (Single-Line Wordmark) */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="w-9 h-9 rounded-[6px] bg-[#fafafa] border border-[#dddddd] flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={getStmikLogoDataUrl()}
              alt="Logo STMIK PGRI Arungbinang"
              referrerPolicy="no-referrer"
              className="w-6 h-6 object-contain"
            />
          </div>
          <span className="text-sm sm:text-base font-semibold text-[#222222] tracking-tight whitespace-nowrap shrink-0">
            Presensi Kampus
          </span>
        </div>

        {/* Zone 2: Contextual Status & Schedule Metadata (Unboxed, Single-Line) */}
        <div className="hidden md:flex items-center gap-3.5 text-xs sm:text-sm text-[#555555] min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <Clock className="w-3.5 h-3.5 text-[#777777]" />
            <span className="font-mono tabular-nums text-[#222222] font-medium">
              {activeDay}, {simulatedTime} WIB
            </span>
          </div>

          {openSessionsCount > 0 && (
            <>
              <span aria-hidden="true" className="text-[#cccccc]">·</span>
              <span className="text-[#038585] font-medium whitespace-nowrap shrink-0 tabular-nums">
                {openSessionsCount} Sesi Terbuka
              </span>
            </>
          )}

          {activeSchedule && (
            <>
              <span aria-hidden="true" className="text-[#cccccc] hidden lg:inline">·</span>
              <div className="hidden lg:flex items-center gap-2.5 truncate text-xs text-[#555555]">
                <span className="font-medium text-[#222222] truncate">{activeSchedule.courseName}</span>
                <span aria-hidden="true" className="text-[#cccccc]">·</span>
                <span className="whitespace-nowrap shrink-0">{activeSchedule.room}</span>
                <span aria-hidden="true" className="text-[#cccccc]">·</span>
                <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                  {activeSchedule.startTime}–{activeSchedule.endTime}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Zone 3: Interactive Actions (Frost-UI Buttons) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {isLoggedOut && (
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {onOpenStudentLogin && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onOpenStudentLogin}
                  className={`frost-btn frost-btn-sm frost-btn-brand ${
                    activeRoleTab === 'mahasiswa' ? 'frost-btn-solid' : 'frost-btn-outline'
                  }`}
                  title="Tampilkan Tab Portal Login Mahasiswa"
                >
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Portal Mahasiswa</span>
                  <span className="sm:hidden">Mahasiswa</span>
                </button>
              )}

              {onOpenDosenLogin && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onOpenDosenLogin}
                  className={`frost-btn frost-btn-sm ${
                    activeRoleTab === 'dosen'
                      ? 'frost-btn-neutral frost-btn-solid'
                      : 'frost-btn-brand frost-btn-outline'
                  }`}
                  title="Tampilkan Tab Portal Login Dosen Pengampu"
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Portal Dosen</span>
                  <span className="sm:hidden">Dosen</span>
                </button>
              )}

              {onOpenForgotPassword && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onOpenForgotPassword}
                  className="hidden lg:inline-flex frost-btn frost-btn-sm frost-btn-brand frost-btn-subtle"
                  title="Atur Ulang Kata Sandi Akun via Email"
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span>Reset Sandi</span>
                </button>
              )}
            </div>
          )}

          {/* Mahasiswa Logged-in Controls */}
          {isMahasiswa && (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                data-frost="Button"
                onClick={onOpenMahasiswaProfile}
                className="frost-btn frost-btn-sm frost-btn-brand frost-btn-outline max-w-[160px] sm:max-w-[230px]"
                title="Konfigurasi Profil Mahasiswa & Ganti Sandi"
              >
                <span className="w-5 h-5 rounded-full bg-[#E4F2FF] text-[#0080FF] text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="Foto profil" className="w-full h-full rounded-full object-cover" /> : getInitials(currentUser.name)}
                </span>
                <span className="truncate font-medium text-[#222222]">{currentUser.name}</span>
                <UserCog className="w-3.5 h-3.5 text-[#777777] hidden sm:block shrink-0" />
              </button>

              {onOpenDeviceSessions && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onOpenDeviceSessions}
                  className="frost-btn frost-btn-sm frost-btn-teal frost-btn-subtle"
                  title="Status Sesi & Perangkat Terhubung"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="hidden xl:inline">Sesi Perangkat</span>
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onLogout}
                  className="frost-btn frost-btn-sm frost-btn-danger frost-btn-subtle"
                  title="Keluar dari akun mahasiswa"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          )}

          {/* Dosen Logged-in Controls */}
          {isDosen && (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                data-frost="Button"
                onClick={onOpenDosenProfile}
                className="frost-btn frost-btn-sm frost-btn-brand frost-btn-outline max-w-[160px] sm:max-w-[230px]"
                title="Konfigurasi Profil Dosen & Ganti Sandi"
              >
                <span className="w-5 h-5 rounded-full bg-[#eeeeee] text-[#222222] text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="Foto profil" className="w-full h-full rounded-full object-cover" /> : getInitials(currentUser.name)}
                </span>
                <span className="truncate font-medium text-[#222222]">{currentUser.name}</span>
                <UserCog className="w-3.5 h-3.5 text-[#777777] hidden sm:block shrink-0" />
              </button>

              {onOpenDeviceSessions && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onOpenDeviceSessions}
                  className="frost-btn frost-btn-sm frost-btn-teal frost-btn-subtle"
                  title="Status Sesi & Perangkat Terhubung"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="hidden xl:inline">Sesi Perangkat</span>
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onLogout}
                  className="frost-btn frost-btn-sm frost-btn-danger frost-btn-subtle"
                  title="Keluar dari akun dosen"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          )}

          {/* Administrator BAAK Logged-in Controls */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                data-frost="Button"
                onClick={onOpenBaakProfile}
                className="frost-btn frost-btn-sm frost-btn-brand frost-btn-outline max-w-[160px] sm:max-w-[230px]"
                title="Konfigurasi Profil Administrator BAAK & Ganti Sandi"
              >
                <span className="w-5 h-5 rounded-full bg-[#E4F2FF] text-[#0080FF] text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="Foto profil" className="w-full h-full rounded-full object-cover" /> : getInitials(currentUser.name)}
                </span>
                <span className="truncate font-medium text-[#222222]">{currentUser.name}</span>
                <UserCog className="w-3.5 h-3.5 text-[#777777] hidden sm:block shrink-0" />
              </button>

              {onOpenDeviceSessions && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onOpenDeviceSessions}
                  className="frost-btn frost-btn-sm frost-btn-teal frost-btn-subtle"
                  title="Status Sesi & Perangkat Terhubung"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="hidden xl:inline">Sesi Perangkat</span>
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  data-frost="Button"
                  onClick={onLogout}
                  className="frost-btn frost-btn-sm frost-btn-danger frost-btn-subtle"
                  title="Keluar dari akun administrator"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
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
