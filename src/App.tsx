import { InitialPasswordForm } from './components/auth/InitialPasswordForm';
import { api } from './utils/api';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AttendanceProvider, useAttendance, SESSION_KEYS } from './context/AttendanceContext';
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
import { Shield } from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours (7,200,000 ms)

const AppContent: React.FC = () => {
  const {
    currentUser,
    setCurrentUser,
    users,
    logoutSession,
    registerDeviceSession,
    validateCurrentDeviceSession,
  } = useAttendance();

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

  const checkIsAdminPath = (str: string): boolean => {
    if (!str) return false;
    const lower = str.toLowerCase();
    return (
      lower.includes('portaladmin') ||
      lower.includes('portal-admin') ||
      lower.includes('/admin') ||
      lower.includes('admin=true') ||
      lower.includes('portal=admin')
    );
  };

  const isAdminRoute = 
    checkIsAdminPath(currentPath) ||
    (typeof window !== 'undefined' && (
      checkIsAdminPath(window.location.pathname) ||
      checkIsAdminPath(window.location.hash) ||
      checkIsAdminPath(window.location.search)
    ));

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
  const [profileModalTab, setProfileModalTab] = useState<'profil' | 'password' | 'sesi'>('profil');

  const isAuthenticated = currentUser.id !== 'guest';
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = false;
    const markActive = () => { active = true; };
    const events = ['mousedown','keydown','touchstart','scroll'];
    events.forEach(name => window.addEventListener(name, markActive, {passive:true}));
    const interval = setInterval(() => { if(active) { active=false; void api('/auth/heartbeat','POST',{}).catch(()=>{}); } },60000);
    return () => { clearInterval(interval); events.forEach(name => window.removeEventListener(name,markActive)); };
  }, [isAuthenticated]);

  // Handlers to open each user's login portal / switch role tab
  const handleOpenStudentLogin = useCallback(() => {
    setInactivityNotice(null);
    setActiveRoleTab('mahasiswa');
    setIsStudentLoginOpen(false);
    setIsUnifiedLoginOpen(false);
  }, []);

  const handleOpenDosenLogin = useCallback(() => {
    setInactivityNotice(null);
    setActiveRoleTab('dosen');
    setIsStudentLoginOpen(false);
    setIsUnifiedLoginOpen(false);
  }, []);

  const handleLoginSuccess = useCallback((user: any) => {
    setCurrentUser(user);
    setIsRoleSwitcherOpen(false); setIsUnifiedLoginOpen(false); setIsStudentLoginOpen(false); setInactivityNotice(null);
  }, [setCurrentUser]);
  const handleLogout = useCallback(async () => {
    try { await logoutSession(); setIsRoleSwitcherOpen(false); setIsUnifiedLoginOpen(false); setIsStudentLoginOpen(false); setIsForgotPasswordOpen(false); }
    catch { setInactivityNotice('Logout belum berhasil. Coba kembali.'); }
  }, [logoutSession]);

  const handleOpenForgotPassword = useCallback((role?: 'mahasiswa' | 'dosen' | 'admin', identifier?: string) => {
    setForgotPasswordRole(role);
    setForgotPasswordIdentifier(identifier || '');
    setIsForgotPasswordOpen(true);
  }, []);

  if (isAuthenticated && currentUser.mustChangePassword) return <InitialPasswordForm />;

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
    <div className="min-h-screen flex flex-col bg-[#fafafa] font-sans text-[#222222] w-full max-w-full overflow-x-hidden">
      {/* Campus Header & System Bar */}
      <Header
        isLoggedOut={!isAuthenticated}
        activeRoleTab={activeRoleTab}
        onOpenStudentLogin={handleOpenStudentLogin}
        onOpenDosenLogin={handleOpenDosenLogin}
        onOpenDosenProfile={() => {
          setProfileModalTab('profil');
          setIsDosenProfileOpen(true);
        }}
        onOpenMahasiswaProfile={() => {
          setProfileModalTab('profil');
          setIsMahasiswaProfileOpen(true);
        }}
        onOpenBaakProfile={() => {
          setProfileModalTab('profil');
          setIsBaakProfileOpen(true);
        }}
        onOpenDeviceSessions={() => {
          setProfileModalTab('sesi');
          if (currentUser.role === 'dosen') setIsDosenProfileOpen(true);
          else if (currentUser.role === 'admin') setIsBaakProfileOpen(true);
          else setIsMahasiswaProfileOpen(true);
        }}
        onOpenForgotPassword={() => handleOpenForgotPassword(activeRoleTab)}
        onLogout={handleLogout}
      />

      {/* Main View Port */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 min-w-0 overflow-x-hidden">
        {!isAuthenticated ? (
          /* Default Tampilan Awal / Home Page with Role Tab Switcher (Mahasiswa & Dosen ONLY) */
          <HomePage
            onLoginSuccess={handleLoginSuccess}
            activeRoleTab={activeRoleTab}
            onChangeRoleTab={(tab) => setActiveRoleTab(tab)}
            onOpenForgotPassword={handleOpenForgotPassword}
            onNavigateToAdmin={() => navigateTo('/portaladmin')}
            inactivityNotice={inactivityNotice}
            onDismissInactivityNotice={() => setInactivityNotice(null)}
          />
        ) : (
          /* User Dashboard saat berhasil login */
          <>
            {currentUser.role === 'dosen' && <DosenDashboard key={currentUser.id} />}
            {currentUser.role === 'mahasiswa' && (
              <MahasiswaDashboard key={currentUser.id} onOpenProfile={() => setIsMahasiswaProfileOpen(true)} />
            )}
            {currentUser.role === 'admin' && (
              <AdminDashboard key={currentUser.id} onOpenProfile={() => setIsBaakProfileOpen(true)} />
            )}
          </>
        )}
      </main>

      {/* Campus Footer */}
      <footer className="bg-white border-t border-[#dddddd] mt-auto py-6 px-4 sm:px-6 lg:px-8 text-xs sm:text-sm text-[#555555] w-full max-w-full">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <p className="font-semibold text-[#222222]">
              {CAMPUS_INFO.name}
            </p>
            <p className="text-[#777777] text-xs">
              {CAMPUS_INFO.address}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 text-[#555555] font-medium text-xs">
            <span>Sistem Presensi QR Perkuliahan</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#222222] font-semibold">{CAMPUS_INFO.semester}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => navigateTo('/portaladmin')}
              className="inline-flex items-center gap-1.5 text-[#555555] hover:text-[#0080FF] font-medium transition cursor-pointer"
              title="Akses Konsol Administrator BAAK (/portaladmin)"
            >
              <Shield className="w-3.5 h-3.5 text-[#0080FF] shrink-0" />
              <span>Portal Admin</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Role Switcher Modal (Strictly Anti-Tampering: Enforces Logout before Switch) */}
      {isAuthenticated && currentUser.role === 'mahasiswa' && (
        <RoleSwitcherModal
          isOpen={isRoleSwitcherOpen}
          onClose={() => setIsRoleSwitcherOpen(false)}
          currentUser={currentUser}
          onLogout={handleLogout}
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
          key={currentUser.id}
          isOpen={isDosenProfileOpen}
          onClose={() => setIsDosenProfileOpen(false)}
          defaultTab={profileModalTab}
        />
      )}

      {/* Modal Konfigurasi Profil Mahasiswa */}
      {isAuthenticated && currentUser.role === 'mahasiswa' && (
        <MahasiswaProfileModal
          key={currentUser.id}
          isOpen={isMahasiswaProfileOpen}
          onClose={() => setIsMahasiswaProfileOpen(false)}
          defaultTab={profileModalTab}
        />
      )}

      {/* Modal Konfigurasi Profil Petugas BAAK */}
      {isAuthenticated && currentUser.role === 'admin' && (
        <BaakProfileModal
          key={currentUser.id}
          isOpen={isBaakProfileOpen}
          onClose={() => setIsBaakProfileOpen(false)}
          defaultTab={profileModalTab}
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

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, AppErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi gangguan saat memuat komponen aplikasi.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('AppErrorBoundary caught error:', error);
  }

  handleRecover = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 font-sans text-[#222222]">
          <div className="frost-card max-w-md w-full p-6 space-y-4 text-center">
            <h2 className="text-lg font-semibold text-[#222222]">
              Sinkronisasi Ulang Penyimpanan Browser
            </h2>
            <p className="text-xs text-[#555555] leading-relaxed">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleRecover}
              className="frost-btn frost-btn-md frost-btn-brand frost-btn-solid frost-btn-full"
            >
              Muat Ulang & Sinkronkan Database
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <AppErrorBoundary>
      <AttendanceProvider>
        <AppContent />
      </AttendanceProvider>
    </AppErrorBoundary>
  );
}

export default App;
