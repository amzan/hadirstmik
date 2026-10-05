/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AttendanceProvider, useAttendance } from './context/AttendanceContext';
import { Header } from './components/Header';
import { DosenDashboard } from './components/dosen/DosenDashboard';
import { MahasiswaDashboard } from './components/mahasiswa/MahasiswaDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { RoleSwitcherModal } from './components/RoleSwitcherModal';
import { UnifiedLoginPortal } from './components/auth/UnifiedLoginPortal';
import { StudentLoginPortal } from './components/auth/StudentLoginPortal';
import { HomePage } from './components/home/HomePage';
import { CAMPUS_INFO } from './data/initialData';

const AppContent: React.FC = () => {
  const { currentUser, setCurrentUser, users } = useAttendance();

  // Modal open states
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [isUnifiedLoginOpen, setIsUnifiedLoginOpen] = useState(false);
  const [isStudentLoginOpen, setIsStudentLoginOpen] = useState(false);
  const [unifiedLoginTab, setUnifiedLoginTab] = useState<'dosen' | 'admin'>('dosen');
  const [activeRoleTab, setActiveRoleTab] = useState<'mahasiswa' | 'dosen' | 'admin'>('mahasiswa');

  // Authentication session state (DEFAULT: FALSE - always lands on Home Page on initial load/refresh)
  // "tidak boleh menampilkan tampilan user yang login sebelumnya."
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Inactivity tracking state (2-Hour Auto-Logout Rule)
  // "terapkan aturan logout otomatis selama 2 jam setiap sesi login jika tidak ada aktivitas."
  const [lastActivityTimestamp, setLastActivityTimestamp] = useState<number>(Date.now());
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);

  // 2-hour inactivity auto-logout effect
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleUserActivity = () => {
      setLastActivityTimestamp(Date.now());
    };

    const trackedEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    trackedEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours (7,200,000 ms)

    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityTimestamp >= INACTIVITY_TIMEOUT_MS) {
        // Trigger auto-logout due to 2 hours of inactivity
        setIsAuthenticated(false);
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
    setUnifiedLoginTab('dosen');
  }, []);

  const handleOpenBaakLogin = useCallback(() => {
    setInactivityNotice(null);
    setActiveRoleTab('admin');
    setUnifiedLoginTab('admin');
  }, []);

  const handleLoginSuccess = useCallback((user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setIsRoleSwitcherOpen(false);
    setIsUnifiedLoginOpen(false);
    setIsStudentLoginOpen(false);
    setInactivityNotice(null);
  }, [setCurrentUser]);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setIsRoleSwitcherOpen(false);
    setIsUnifiedLoginOpen(false);
    setIsStudentLoginOpen(false);
    setInactivityNotice(null);
  }, []);

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
        onOpenBaakLogin={handleOpenBaakLogin}
        onLogout={handleLogout}
      />

      {/* Main View Port */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
        {!isAuthenticated ? (
          /* Default Tampilan Awal / Home Page with Role Tab Switcher */
          <HomePage
            onLoginSuccess={handleLoginSuccess}
            activeRoleTab={activeRoleTab}
            onChangeRoleTab={(tab) => setActiveRoleTab(tab)}
            inactivityNotice={inactivityNotice}
            onDismissInactivityNotice={() => setInactivityNotice(null)}
          />
        ) : (
          /* User Dashboard saat berhasil login */
          <>
            {currentUser.role === 'dosen' && <DosenDashboard />}
            {currentUser.role === 'mahasiswa' && <MahasiswaDashboard />}
            {currentUser.role === 'admin' && <AdminDashboard />}
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
          onOpenLoginPortal={(tab = 'dosen') => {
            setIsRoleSwitcherOpen(false);
            setUnifiedLoginTab(tab);
            setIsUnifiedLoginOpen(true);
          }}
          onOpenStudentPortal={() => {
            setIsRoleSwitcherOpen(false);
            setIsStudentLoginOpen(true);
          }}
        />
      )}

      {/* Portal Login Terpadu (Dosen Pengampu & Administrator BAAK) */}
      <UnifiedLoginPortal
        isOpen={isUnifiedLoginOpen}
        onClose={() => setIsUnifiedLoginOpen(false)}
        defaultTab={unifiedLoginTab}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          setLastActivityTimestamp(Date.now());
          setInactivityNotice(null);
          setIsUnifiedLoginOpen(false);
        }}
        onLogoutAndSwitch={(target) => {
          setIsAuthenticated(false);
          setUnifiedLoginTab(target);
        }}
        onOpenStudentPortal={() => {
          setIsUnifiedLoginOpen(false);
          setIsStudentLoginOpen(true);
        }}
      />

      {/* Portal Login Terpisah Mahasiswa (NIM & Password) */}
      <StudentLoginPortal
        isOpen={isStudentLoginOpen}
        onClose={() => setIsStudentLoginOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          setLastActivityTimestamp(Date.now());
          setInactivityNotice(null);
          setIsStudentLoginOpen(false);
        }}
        onOpenStaffPortal={() => {
          setIsStudentLoginOpen(false);
          setUnifiedLoginTab('dosen');
          setIsUnifiedLoginOpen(true);
        }}
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
