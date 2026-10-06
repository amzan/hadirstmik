/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AttendanceProvider, useAttendance } from './context/AttendanceContext';
import { Header } from './components/Header';
import { DosenDashboard } from './components/dosen/DosenDashboard';
import { MahasiswaDashboard } from './components/mahasiswa/MahasiswaDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminPortalPage } from './components/admin/AdminPortalPage';
import { RoleSwitcherModal } from './components/RoleSwitcherModal';
import { UnifiedLoginPortal } from './components/auth/UnifiedLoginPortal';
import { StudentLoginPortal } from './components/auth/StudentLoginPortal';
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal';
import { DosenProfileModal } from './components/dosen/DosenProfileModal';
import { MahasiswaProfileModal } from './components/mahasiswa/MahasiswaProfileModal';
import { BaakProfileModal } from './components/admin/BaakProfileModal';
import { HomePage } from './components/home/HomePage';
import { CAMPUS_INFO } from './data/initialData';

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours (7,200,000 ms)
const AUTH_SESSION_KEY = 'stmik_auth_session_active';
const LAST_ACTIVITY_KEY = 'stmik_last_activity_timestamp';

const AppContent: React.FC = () => {
  const { currentUser, setCurrentUser, users } = useAttendance();

  // Route state to support ~/portaladmin exclusively for BAAK Administrator
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || window.location.hash || '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || window.location.hash || '/');
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigateTo = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    setCurrentPath(path);
  }, []);

  const isAdminRoute = 
    currentPath.toLowerCase().includes('portaladmin') ||
    window.location.pathname.toLowerCase().includes('portaladmin') ||
    window.location.hash.toLowerCase().includes('portaladmin');

  // Modal open states
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [isUnifiedLoginOpen, setIsUnifiedLoginOpen] = useState(false);
  const [isStudentLoginOpen, setIsStudentLoginOpen] = useState(false);
  const [isDosenProfileOpen, setIsDosenProfileOpen] = useState(false);
  const [isMahasiswaProfileOpen, setIsMahasiswaProfileOpen] = useState(false);
  const [isBaakProfileOpen, setIsBaakProfileOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordRole, setForgotPasswordRole] = useState<'mahasiswa' | 'dosen' | 'admin' | undefined>(undefined);
  const [forgotPasswordIdentifier, setForgotPasswordIdentifier] = useState<string>('');
  const [activeRoleTab, setActiveRoleTab] = useState<'mahasiswa' | 'dosen'>('mahasiswa');

  // Authentication session state:
  // "Logout otomatis hanya dilakukan dalam waktu 2 jam setelah tidak ada aktivitas user di dalam aplikasi, batalkan logout otomatis saat muat ulang"
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const savedAuth = localStorage.getItem(AUTH_SESSION_KEY);
      const savedTime = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (savedAuth === 'true' && savedTime) {
        const lastTime = Number(savedTime);
        const now = Date.now();
        if (!isNaN(lastTime) && (now - lastTime < INACTIVITY_TIMEOUT_MS)) {
          // Sesi masih valid dalam batas 2 jam: tetap login saat muat ulang (reload)
          return true;
        }
      }
    } catch {
      // fallback
    }
    return false;
  });

  // Inactivity tracking state (2-Hour Inactivity Rule)
  const [lastActivityTimestamp, setLastActivityTimestamp] = useState<number>(() => {
    try {
      const savedTime = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (savedTime) {
        const parsed = Number(savedTime);
        if (!isNaN(parsed)) return parsed;
      }
    } catch {}
    return Date.now();
  });

  const [inactivityNotice, setInactivityNotice] = useState<string | null>(() => {
    try {
      const savedAuth = localStorage.getItem(AUTH_SESSION_KEY);
      const savedTime = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (savedAuth === 'true' && savedTime) {
        const lastTime = Number(savedTime);
        const now = Date.now();
        if (!isNaN(lastTime) && (now - lastTime >= INACTIVITY_TIMEOUT_MS)) {
          // Melewati 2 jam tanpa aktivitas sebelum reload: bersihkan sesi dan beri tahu pengguna
          localStorage.removeItem(AUTH_SESSION_KEY);
          localStorage.removeItem(LAST_ACTIVITY_KEY);
          return 'Sesi Anda telah berakhir secara otomatis karena tidak ada aktivitas selama 2 jam. Silakan pilih portal login untuk masuk kembali.';
        }
      }
    } catch {}
    return null;
  });

  const lastStorageSyncRef = useRef<number>(Date.now());

  // 2-hour inactivity auto-logout effect (hanya logout jika tidak ada aktivitas selama 2 jam)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleUserActivity = () => {
      const now = Date.now();
      setLastActivityTimestamp(now);
      // Sync ke localStorage secara berkala (maksimal sekali per 5 detik)
      if (now - lastStorageSyncRef.current > 5000) {
        lastStorageSyncRef.current = now;
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      }
    };

    const trackedEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    trackedEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const intervalId = setInterval(() => {
      const now = Date.now();
      const saved = localStorage.getItem(LAST_ACTIVITY_KEY);
      const currentLastActivity = saved ? Number(saved) : lastActivityTimestamp;

      if (!isNaN(currentLastActivity) && (now - currentLastActivity >= INACTIVITY_TIMEOUT_MS)) {
        // Trigger auto-logout due to 2 hours of inactivity
        setIsAuthenticated(false);
        localStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        setIsRoleSwitcherOpen(false);
        setIsUnifiedLoginOpen(false);
        setIsStudentLoginOpen(false);
        setInactivityNotice(
          'Sesi Anda telah berakhir secara otomatis karena tidak ada aktivitas selama 2 jam. Silakan pilih portal login untuk masuk kembali.'
        );
      }
    }, 10000); // Check every 10 seconds

    return () => {
      trackedEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(intervalId);
    };
  }, [isAuthenticated, lastActivityTimestamp]);

  // Handlers to open each user's login portal / switch role tab
  const handleOpenStudentLogin = useCallback(() => {
    setInactivityNotice(null);
    setActiveRoleTab('mahasiswa');
    setIsStudentLoginOpen(false);
  }, []);

  const handleOpenDosenLogin = useCallback(() => {
    setInactivityNotice(null);
    setActiveRoleTab('dosen');
    setIsUnifiedLoginOpen(true);
  }, []);

  const handleLoginSuccess = useCallback((user: any) => {
    const now = Date.now();
    setCurrentUser(user);
    setIsAuthenticated(true);
    setLastActivityTimestamp(now);
    lastStorageSyncRef.current = now;
    localStorage.setItem(AUTH_SESSION_KEY, 'true');
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    setIsRoleSwitcherOpen(false);
    setIsUnifiedLoginOpen(false);
    setIsStudentLoginOpen(false);
    setInactivityNotice(null);
  }, [setCurrentUser]);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem('stmik_current_user_id_v1');
    setIsRoleSwitcherOpen(false);
    setIsUnifiedLoginOpen(false);
    setIsStudentLoginOpen(false);
    setIsForgotPasswordOpen(false);
    setInactivityNotice(null);
  }, []);

  const handleOpenForgotPassword = useCallback((role?: 'mahasiswa' | 'dosen' | 'admin', identifier?: string) => {
    setForgotPasswordRole(role);
    setForgotPasswordIdentifier(identifier || '');
    setIsForgotPasswordOpen(true);
  }, []);

  // EXCLUSIVE ACCESS: If visiting ~/portaladmin and not yet logged in as Admin, show AdminPortalPage
  if (isAdminRoute && (!isAuthenticated || currentUser.role !== 'admin')) {
    return (
      <>
        <AdminPortalPage
          onLoginSuccess={(user) => {
            handleLoginSuccess(user);
          }}
          onNavigateHome={() => {
            navigateTo('/');
          }}
          onOpenForgotPassword={(role, id) => {
            handleOpenForgotPassword(role, id);
          }}
        />

        {/* Modal Atur Ulang Password via Email (Resend API) */}
        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
          initialRole={forgotPasswordRole}
          initialIdentifier={forgotPasswordIdentifier}
          onResetSuccess={() => {}}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 w-full max-w-full overflow-x-hidden">
      {/* Campus Header & System Bar */}
      <Header
        isLoggedOut={!isAuthenticated}
        onOpenRoleSwitcher={() => {
          if (isAuthenticated && currentUser.role === 'mahasiswa') {
            setIsRoleSwitcherOpen(true);
          }
        }}
        onOpenStudentLogin={handleOpenStudentLogin}
        onOpenDosenLogin={handleOpenDosenLogin}
        onOpenDosenProfile={() => setIsDosenProfileOpen(true)}
        onOpenMahasiswaProfile={() => setIsMahasiswaProfileOpen(true)}
        onOpenBaakProfile={() => setIsBaakProfileOpen(true)}
        onOpenForgotPassword={() => handleOpenForgotPassword(activeRoleTab)}
        onLogout={handleLogout}
      />

      {/* Main View Port */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
        {!isAuthenticated ? (
          /* Default Tampilan Awal / Home Page with Role Tab Switcher (Mahasiswa & Dosen ONLY) */
          <HomePage
            onLoginSuccess={handleLoginSuccess}
            activeRoleTab={activeRoleTab}
            onChangeRoleTab={(tab) => setActiveRoleTab(tab)}
            onOpenForgotPassword={handleOpenForgotPassword}
            inactivityNotice={inactivityNotice}
            onDismissInactivityNotice={() => setInactivityNotice(null)}
          />
        ) : (
          /* User Dashboard saat berhasil login */
          <>
            {currentUser.role === 'dosen' && <DosenDashboard />}
            {currentUser.role === 'mahasiswa' && (
              <MahasiswaDashboard onOpenProfile={() => setIsMahasiswaProfileOpen(true)} />
            )}
            {currentUser.role === 'admin' && (
              <AdminDashboard onOpenProfile={() => setIsBaakProfileOpen(true)} />
            )}
          </>
        )}
      </main>

      {/* Campus Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-5 px-3 sm:px-6 text-sm text-slate-500 w-full max-w-full">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <p className="font-semibold text-slate-900">
              {CAMPUS_INFO.name}
            </p>
            <p className="text-slate-500 mt-0.5">
              {CAMPUS_INFO.address}
            </p>
          </div>
          <div className="flex items-center gap-3 text-slate-500 font-medium">
            <span>Sistem Presensi Berbasis QR Real-Time</span>
            <span>·</span>
            <span className="text-slate-900 font-semibold">{CAMPUS_INFO.semester}</span>
          </div>
        </div>
      </footer>

      {/* Role Switcher Modal (Mahasiswa only when logged in) */}
      {isAuthenticated && currentUser.role === 'mahasiswa' && (
        <RoleSwitcherModal
          isOpen={isRoleSwitcherOpen}
          onClose={() => setIsRoleSwitcherOpen(false)}
          currentUser={currentUser}
          onSelectUser={(u) => {
            setCurrentUser(u);
            setIsRoleSwitcherOpen(false);
          }}
          users={users}
          onOpenLoginPortal={() => {
            setIsRoleSwitcherOpen(false);
            setIsUnifiedLoginOpen(true);
          }}
          onOpenStudentPortal={() => {
            setIsRoleSwitcherOpen(false);
            setIsStudentLoginOpen(true);
          }}
        />
      )}

      {/* Portal Login Dosen Pengampu */}
      <UnifiedLoginPortal
        isOpen={isUnifiedLoginOpen}
        onClose={() => setIsUnifiedLoginOpen(false)}
        defaultTab="dosen"
        onLoginSuccess={(user) => {
          handleLoginSuccess(user);
        }}
        onOpenStudentPortal={() => {
          setIsUnifiedLoginOpen(false);
          setIsStudentLoginOpen(true);
        }}
        onOpenForgotPassword={(role, id) => {
          setIsUnifiedLoginOpen(false);
          handleOpenForgotPassword(role, id);
        }}
      />

      {/* Portal Login Terpisah Mahasiswa (NIM & Password) */}
      <StudentLoginPortal
        isOpen={isStudentLoginOpen}
        onClose={() => setIsStudentLoginOpen(false)}
        onLoginSuccess={(user) => {
          handleLoginSuccess(user);
        }}
        onOpenStaffPortal={() => {
          setIsStudentLoginOpen(false);
          setIsUnifiedLoginOpen(true);
        }}
        onOpenForgotPassword={(role, id) => {
          setIsStudentLoginOpen(false);
          handleOpenForgotPassword(role, id);
        }}
      />

      {/* Modal Konfigurasi Profil Dosen Pengampu */}
      {isAuthenticated && currentUser.role === 'dosen' && (
        <DosenProfileModal
          isOpen={isDosenProfileOpen}
          onClose={() => setIsDosenProfileOpen(false)}
        />
      )}

      {/* Modal Konfigurasi Profil Mahasiswa */}
      {isAuthenticated && currentUser.role === 'mahasiswa' && (
        <MahasiswaProfileModal
          isOpen={isMahasiswaProfileOpen}
          onClose={() => setIsMahasiswaProfileOpen(false)}
        />
      )}

      {/* Modal Konfigurasi Profil Petugas BAAK */}
      {isAuthenticated && currentUser.role === 'admin' && (
        <BaakProfileModal
          isOpen={isBaakProfileOpen}
          onClose={() => setIsBaakProfileOpen(false)}
        />
      )}

      {/* Modal Atur Ulang Password via Email (Resend API) */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialRole={forgotPasswordRole}
        initialIdentifier={forgotPasswordIdentifier}
        onResetSuccess={() => {}}
      />
    </div>
  );
};

export function App() {
  return (
    <AttendanceProvider>
      <AppContent />
    </AttendanceProvider>
  );
}

export default App;
