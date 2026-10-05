/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AttendanceProvider, useAttendance } from './context/AttendanceContext';
import { Header } from './components/Header';
import { DosenDashboard } from './components/dosen/DosenDashboard';
import { MahasiswaDashboard } from './components/mahasiswa/MahasiswaDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { RoleSwitcherModal } from './components/RoleSwitcherModal';
import { UnifiedLoginPortal } from './components/auth/UnifiedLoginPortal';
import { StudentLoginPortal } from './components/auth/StudentLoginPortal';
import { CAMPUS_INFO } from './data/initialData';
import { GraduationCap, Shield, ArrowRight } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, setCurrentUser, users } = useAttendance();
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [isUnifiedLoginOpen, setIsUnifiedLoginOpen] = useState(false);
  const [isStudentLoginOpen, setIsStudentLoginOpen] = useState(false);
  const [unifiedLoginTab, setUnifiedLoginTab] = useState<'dosen' | 'admin'>('dosen');
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      {/* Campus Header & System Bar */}
      <Header
        isLoggedOut={isLoggedOut}
        onOpenRoleSwitcher={() => {
          if (!isLoggedOut && currentUser.role === 'mahasiswa') {
            setIsRoleSwitcherOpen(true);
          }
        }}
        onOpenLoginPortal={(defaultTab = 'dosen') => {
          setUnifiedLoginTab(defaultTab);
          setIsUnifiedLoginOpen(true);
        }}
        onOpenStudentLogin={() => setIsStudentLoginOpen(true)}
        onLogout={() => {
          const prevRole = currentUser.role;
          setIsLoggedOut(true);
          if (prevRole === 'mahasiswa') {
            setIsStudentLoginOpen(true);
          } else {
            setUnifiedLoginTab(prevRole === 'admin' ? 'admin' : 'dosen');
            setIsUnifiedLoginOpen(true);
          }
        }}
      />

      {/* Main View Port */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {isLoggedOut ? (
          <div className="py-12 sm:py-20 flex flex-col items-center justify-center text-center space-y-8 animate-fadeIn">
            <div className="max-w-xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-xs font-bold uppercase tracking-wider">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                <span>Portal Layanan Akademik Kampus</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Sistem Presensi Perkuliahan QR
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Silakan masuk menggunakan akun resmi Anda untuk mengakses jadwal, perkuliahan, dan presensi QR kampus STMIK PGRI Arungbinang Kebumen.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl w-full">
              {/* Card 1: Portal Mahasiswa */}
              <div className="bg-white border-2 border-blue-200 hover:border-blue-500 rounded-2xl p-6 text-left shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-5 group">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <GraduationCap className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition">
                      Portal Mahasiswa
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Masuk menggunakan Nomor Induk Mahasiswa (NIM) untuk melakukan scan QR kehadiran dan melihat riwayat presensi perkuliahan.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsStudentLoginOpen(true)}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <span>Masuk Portal Mahasiswa</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Card 2: Portal Dosen & BAAK */}
              <div className="bg-white border border-slate-200 hover:border-slate-800 rounded-2xl p-6 text-left shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-5 group">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                    <Shield className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-slate-900 transition">
                      Portal Dosen & BAAK
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Akses terpadu untuk Dosen Pengampu mata kuliah dan Administrator Biro Administrasi Akademik (BAAK).
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setUnifiedLoginTab('dosen');
                    setIsUnifiedLoginOpen(true);
                  }}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <span>Masuk Dosen / BAAK</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {currentUser.role === 'dosen' && <DosenDashboard />}
            {currentUser.role === 'mahasiswa' && <MahasiswaDashboard />}
            {currentUser.role === 'admin' && <AdminDashboard />}
          </>
        )}
      </main>

      {/* Campus Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6 px-4 text-sm text-slate-500">
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

      {/* Role Switcher Modal (Mahasiswa only: Dosen and Admin are locked) */}
      {currentUser.role === 'mahasiswa' && (
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
          setIsLoggedOut(false);
          setIsUnifiedLoginOpen(false);
        }}
        onLogoutAndSwitch={(target) => {
          const defaultStudent = users.find(u => u.role === 'mahasiswa') || users[0];
          setCurrentUser(defaultStudent);
          setUnifiedLoginTab(target);
        }}
        onOpenStudentPortal={() => {
          setIsUnifiedLoginOpen(false);
          setIsStudentLoginOpen(true);
        }}
      />

      {/* Portal Login Terpisah Mahasiswa (NIM & pass123) */}
      <StudentLoginPortal
        isOpen={isStudentLoginOpen}
        onClose={() => setIsStudentLoginOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsLoggedOut(false);
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
