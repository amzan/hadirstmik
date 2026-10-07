import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { User, ScheduleItem, Role, DayOfWeek, ProgramStudi } from '../../types/attendance';
import { ReportExportModal } from '../shared/ReportExportModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { ScheduleModal } from './ScheduleModal';
import { SessionMonitoringTab } from './SessionMonitoringTab';
import { DatabaseBackupTab } from './DatabaseBackupTab';
import { DatabaseBackupModal } from './DatabaseBackupModal';
import {
  Shield, Users, Calendar, BookOpen, UserPlus, Plus,
  Trash2, Edit2, Search, Download, RefreshCw, GraduationCap, Clock, Radio, UserCog,
  Database
} from 'lucide-react';

interface AdminDashboardProps {
  onOpenProfile?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenProfile
}) => {
  const {
    users,
    students,
    courses,
    schedules,
    sessions,
    records,
    activeDay,
    simulatedTime,
    addUser,
    updateUser,
    deleteUser,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    resetToDefaultData
  } = useAttendance();

  const [activeTab, setActiveTab] = useState<'sessions' | 'schedules' | 'users' | 'students' | 'courses' | 'database'>('sessions');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Confirm dialog state (replaces window.confirm)
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Quick Summary Statistics Data for Admin
  const todayCampusSchedules = schedules.filter(s => s.day === activeDay);
  const openSessionsCount = sessions.filter(s => s.isOpen).length;
  const totalCampusRecords = records.length;
  const totalCampusHadir = records.filter(r => r.status === 'HADIR').length;
  const campusAttendanceRate = totalCampusRecords > 0 ? Math.round((totalCampusHadir / totalCampusRecords) * 100) : 93;

  // User form state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<Role>('dosen');
  const [userTitle, setUserTitle] = useState('');
  const [userRombel, setUserRombel] = useState('');
  const [userProdi, setUserProdi] = useState<ProgramStudi>('Teknologi Informasi');
  const [searchUser, setSearchUser] = useState('');

  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState<ScheduleItem | null>(null);

  // Open User modal
  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUserId(user.id);
      setUserName(user.name);
      setUserUsername(user.username);
      setUserEmail(user.email);
      setUserRole(user.role);
      setUserTitle(user.title || '');
      setUserRombel(user.rombel || '');
      setUserProdi(user.prodi || 'Teknologi Informasi');
    } else {
      setEditingUserId(null);
      setUserName('');
      setUserUsername('');
      setUserEmail('');
      setUserRole('dosen');
      setUserTitle('');
      setUserRombel('');
      setUserProdi('Teknologi Informasi');
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userUsername) return;

    if (editingUserId) {
      updateUser(editingUserId, {
        name: userName,
        username: userUsername,
        email: userEmail || `${userUsername.toLowerCase()}@stmik-arungbinang.ac.id`,
        role: userRole,
        title: userTitle,
        rombel: userRombel,
        prodi: userProdi,
      });
    } else {
      addUser({
        name: userName,
        username: userUsername,
        email: userEmail || `${userUsername.toLowerCase()}@stmik-arungbinang.ac.id`,
        role: userRole,
        title: userTitle,
        rombel: userRombel,
        prodi: userProdi,
      });
    }
    setIsUserModalOpen(false);
  };

  // Open Schedule modal
  const handleOpenScheduleModal = (sch?: ScheduleItem) => {
    setSelectedScheduleForEdit(sch || null);
    setIsScheduleModalOpen(true);
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const q = searchUser.toLowerCase();
    return u.name.toLowerCase().includes(q) ||
           u.username.toLowerCase().includes(q) ||
           u.role.toLowerCase().includes(q) ||
           (u.rombel && u.rombel.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Admin Minimalist Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                <span>Panel Administrator BAAK & IT</span>
                <span aria-hidden="true">·</span>
                <span>Hak Akses Penuh Sistem</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 tracking-tight">
                Kelola Basis Data & Jadwal Kampus
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Sinkronisasi data mahasiswa, jadwal perkuliahan, mata kuliah, dan rekapitulasi kehadiran
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onOpenProfile && (
              <button
                onClick={onOpenProfile}
                className="px-4 py-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-semibold text-sm flex items-center gap-2 transition cursor-pointer shadow-2xs"
                title="Konfigurasi Profil Petugas BAAK & Ganti Password dengan OTP Email"
              >
                <UserCog className="w-4 h-4 text-indigo-600" />
                <span>Profil BAAK</span>
              </button>
            )}

            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm flex items-center gap-2 transition cursor-pointer shadow-xs"
              title="Cadangkan, Ekspor, dan Pulihkan Database Proyek"
            >
              <Database className="w-4 h-4" />
              <span>Backup & Pulihkan DB</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Master Presensi</span>
            </button>

            <button
              onClick={() => {
                setConfirmConfig({
                  isOpen: true,
                  title: 'Reset ke Data Default?',
                  message: 'Tindakan ini akan mengembalikan seluruh jadwal, pengguna, sesi presensi, dan data mahasiswa ke kondisi bawaan STMIK PGRI Arungbinang Kebumen.',
                  confirmLabel: 'Ya, Reset Data',
                  isDestructive: true,
                  onConfirm: () => {
                    resetToDefaultData();
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                  },
                });
              }}
              className="px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center gap-2 border border-slate-300 transition cursor-pointer"
              title="Reset data ke bawaan dokumen"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>Reset Data Default</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Summary Statistics Component for Admin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Classes Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Kelas Kampus Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {todayCampusSchedules.length} Kelas
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Hari {activeDay} · {schedules.length} total sesi per minggu
            </p>
          </div>
        </div>

        {/* Stat 2: Active Sessions */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Sesi Presensi Terbuka</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{openSessionsCount} Sesi</span>
              {openSessionsCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1 truncate">
              {openSessionsCount > 0
                ? 'Dosen sedang membuka presensi real-time'
                : 'Tidak ada sesi terbuka saat ini'}
            </p>
          </div>
        </div>

        {/* Stat 3: Campus Attendance Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Rata-rata Kehadiran Kampus</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {campusAttendanceRate}%
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {totalCampusHadir} hadir dari {totalCampusRecords} total rekaman
            </p>
          </div>
        </div>

        {/* Stat 4: Total Campus Community */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Komunitas Terdaftar</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {students.length} Mhs · {users.filter(u => u.role === 'dosen').length} Dosen
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {courses.length} mata kuliah aktif kurikulum
            </p>
          </div>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="flex border-b border-slate-200 gap-6 sm:gap-8 text-sm sm:text-base font-medium overflow-x-auto">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 border-b-2 flex items-center gap-2 shrink-0 transition cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Monitoring Sesi ({sessions.length})</span>
          {openSessionsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'schedules'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Jadwal Perkuliahan ({schedules.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'users'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Kelola Pengguna ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'students'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Rombel & Mahasiswa ({students.length})
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-3 border-b-2 shrink-0 transition cursor-pointer ${
            activeTab === 'courses'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Master Mata Kuliah ({courses.length})
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`pb-3 border-b-2 shrink-0 flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === 'database'
              ? 'border-indigo-600 text-indigo-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4 text-indigo-600" />
          <span>Cadangan & Database</span>
        </button>
      </div>

      {/* TAB 0: SESSIONS MONITORING & CONTROL */}
      {activeTab === 'sessions' && <SessionMonitoringTab />}

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Daftar Akun Pengguna Sistem</h3>
              <p className="text-sm text-slate-500">Kelola akun Dosen, Mahasiswa, dan Administrator Kampus</p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari pengguna..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full sm:w-auto pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:border-slate-500"
                />
              </div>

              <button
                onClick={() => handleOpenUserModal()}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Pengguna</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-3">Pengguna</th>
                  <th className="py-3 px-3">NIDN / NIM</th>
                  <th className="py-3 px-3">Peran (Role)</th>
                  <th className="py-3 px-3">Keterangan / Rombel</th>
                  <th className="py-3 px-3">Email Kampus</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div className="font-semibold text-slate-900">{user.name}</div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-900">{user.username}</td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-700 capitalize">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {user.rombel ? `Rombel ${user.rombel}` : user.title || '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-xs">{user.email}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenUserModal(user)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                          title="Edit Pengguna"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmConfig({
                              isOpen: true,
                              title: 'Hapus Pengguna?',
                              message: `Apakah Anda yakin ingin menghapus akun ${user.name} (${user.username})? Tindakan ini tidak dapat dibatalkan.`,
                              confirmLabel: 'Ya, Hapus',
                              isDestructive: true,
                              onConfirm: () => {
                                deleteUser(user.id);
                                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULE MANAGEMENT */}
      {activeTab === 'schedules' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Manajemen Jadwal Perkuliahan</h3>
              <p className="text-sm text-slate-500">
                Atur jadwal hari, jam, ruang, dan dosen pengampu sebagai acuan sinkronisasi presensi otomatis
              </p>
            </div>

            <button
              onClick={() => handleOpenScheduleModal()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal Baru</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-3">Hari & Jam</th>
                  <th className="py-3 px-3">Kode & Mata Kuliah</th>
                  <th className="py-3 px-3">SKS</th>
                  <th className="py-3 px-3">Dosen Pengampu</th>
                  <th className="py-3 px-3">Ruang</th>
                  <th className="py-3 px-3">Rombel</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((sch) => (
                  <tr key={sch.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 block">{sch.day}</span>
                      <span className="text-xs text-slate-500 font-mono">{sch.startTime}–{sch.endTime}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        {sch.courseCode}
                      </span>
                      <div className="font-semibold text-slate-900">{sch.courseName}</div>
                      <div className="text-xs text-slate-400">{sch.prodi}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{sch.sks} SKS</td>
                    <td className="py-3 px-3 text-slate-800 font-medium">{sch.lecturerName}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{sch.room}</td>
                    <td className="py-3 px-3 font-medium text-slate-800">{sch.rombel}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenScheduleModal(sch)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmConfig({
                              isOpen: true,
                              title: 'Hapus Jadwal Kuliah?',
                              message: `Apakah Anda yakin ingin menghapus jadwal ${sch.courseName} (${sch.day}, ${sch.startTime}–${sch.endTime}) untuk rombel ${sch.rombel}?`,
                              confirmLabel: 'Ya, Hapus Jadwal',
                              isDestructive: true,
                              onConfirm: () => {
                                deleteSchedule(sch.id);
                                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STUDENTS & ROMBEL */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Data Peserta Rombel Mahasiswa ({students.length})
              </h3>
              <p className="text-sm text-slate-500">
                Berdasarkan arsip resmi Semester Ganjil 2026/2027 STMIK PGRI Arungbinang Kebumen
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-3">No</th>
                  <th className="py-3 px-3">NIM</th>
                  <th className="py-3 px-3">Nama Mahasiswa</th>
                  <th className="py-3 px-3">Program Studi</th>
                  <th className="py-3 px-3">Kelas / Rombel</th>
                  <th className="py-3 px-3">Email Mahasiswa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, idx) => (
                  <tr key={student.nim} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-900">{student.nim}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{student.name}</td>
                    <td className="py-3 px-3 text-slate-600">{student.prodi}</td>
                    <td className="py-3 px-3 font-medium text-slate-800">{student.rombel}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-xs">{student.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COURSES */}
      {activeTab === 'courses' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Master Mata Kuliah ({courses.length})
              </h3>
              <p className="text-sm text-slate-500">
                Katalog mata kuliah kurikulum STMIK PGRI Arungbinang Kebumen
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div key={course.id} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between hover:border-slate-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {course.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">{course.sks} SKS</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-2">{course.name}</h4>
                  <p className="text-sm text-slate-500 mt-0.5">{course.prodi} · Semester {course.semester}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-sm text-slate-600">
                  Dosen Pengampu: <span className="font-semibold text-slate-800">{course.defaultLecturerName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: DATABASE BACKUP & RESTORE */}
      {activeTab === 'database' && (
        <DatabaseBackupTab
          onOpenResetConfirm={() => {
            setConfirmConfig({
              isOpen: true,
              title: 'Reset ke Data Default?',
              message: 'Tindakan ini akan mengembalikan seluruh jadwal, pengguna, sesi presensi, dan data mahasiswa ke kondisi bawaan STMIK PGRI Arungbinang Kebumen.',
              confirmLabel: 'Ya, Reset Data',
              isDestructive: true,
              onConfirm: () => {
                resetToDefaultData();
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
              },
            });
          }}
        />
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {editingUserId ? 'Edit Akun Pengguna' : 'Tambah Pengguna Baru'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4 text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Contoh: Budi Santoso, M.Kom."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md font-medium text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">NIM / NIDN</label>
                  <input
                    type="text"
                    value={userUsername}
                    onChange={(e) => setUserUsername(e.target.value)}
                    placeholder="26TI0010"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md font-mono text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Peran (Role)</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as Role)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                  >
                    <option value="dosen">Dosen</option>
                    <option value="mahasiswa">Mahasiswa</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="email@stmik-arungbinang.ac.id"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                />
              </div>

              {userRole === 'mahasiswa' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Rombel / Kelas</label>
                    <input
                      type="text"
                      value={userRombel}
                      onChange={(e) => setUserRombel(e.target.value)}
                      placeholder="TI 3"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Program Studi</label>
                    <select
                      value={userProdi}
                      onChange={(e) => setUserProdi(e.target.value as ProgramStudi)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                    >
                      <option value="Teknologi Informasi">Teknologi Informasi</option>
                      <option value="Manajemen Informatika">Manajemen Informatika</option>
                    </select>
                  </div>
                </div>
              )}

              {userRole === 'dosen' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Jabatan / Gelar</label>
                  <input
                    type="text"
                    value={userTitle}
                    onChange={(e) => setUserTitle(e.target.value)}
                    placeholder="Contoh: Dosen Tetap / Dosen Wali"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                  />
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold cursor-pointer"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal with Rule 1, Rule 2 & Slot Recommendation Engine */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        editingSchedule={selectedScheduleForEdit}
        schedules={schedules}
        users={users}
        courses={courses}
        onSave={(data) => addSchedule(data)}
        onUpdate={(id, data) => updateSchedule(id, data)}
      />

      {/* Export Modal */}
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Database Backup & Restore Center Modal */}
      <DatabaseBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onNavigateToTab={() => setActiveTab('database')}
      />

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
