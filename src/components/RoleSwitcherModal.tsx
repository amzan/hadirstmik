import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { User, Role } from '../types/attendance';
import {
  X, GraduationCap, UserCheck, Shield, Check, Search,
  Eye, EyeOff, AlertCircle, ArrowRight
} from 'lucide-react';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User;
  onSelectUser?: (user: User) => void;
  users?: User[];
  onOpenLoginPortal?: (defaultTab?: 'dosen' | 'admin') => void;
  onOpenStudentPortal?: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser: propCurrentUser,
  onSelectUser,
  users: propUsers,
  onOpenLoginPortal,
  onOpenStudentPortal,
}) => {
  const context = useAttendance();
  const users = propUsers || context.users;
  const currentUser = propCurrentUser || context.currentUser;
  const setCurrentUser = onSelectUser || context.setCurrentUser;

  const [selectedRoleTab, setSelectedRoleTab] = useState<Role>('mahasiswa');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => {
    const matchesTab = u.role === selectedRoleTab;
    const matchesQuery = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (u.rombel && u.rombel.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (u.title && u.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesQuery;
  });

  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              Ganti Pengguna & Hak Akses
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Peralihan Akun Terdaftar STMIK PGRI Arungbinang Kebumen
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Tabs */}
        <div className="flex border-b border-slate-200 gap-6 px-6 pt-3 text-sm font-semibold">
          <button
            onClick={() => setSelectedRoleTab('dosen')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              selectedRoleTab === 'dosen'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Dosen ({users.filter(u => u.role === 'dosen').length})</span>
          </button>

          <button
            onClick={() => setSelectedRoleTab('mahasiswa')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              selectedRoleTab === 'mahasiswa'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Mahasiswa ({users.filter(u => u.role === 'mahasiswa').length})</span>
          </button>

          <button
            onClick={() => setSelectedRoleTab('admin')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              selectedRoleTab === 'admin'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Administrator ({users.filter(u => u.role === 'admin').length})</span>
          </button>
        </div>

        {/* Tab Content */}
        {selectedRoleTab === 'dosen' ? (
          <div className="p-8 text-center flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h4 className="text-lg font-bold text-slate-900">Portal Login Dosen Pengampu</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Akun dosen terproteksi dengan autentikasi nama depan dan kata sandi default (dosen123). Sesuai aturan, akun dosen terisolasi dan tidak dapat login ke sistem BAAK.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenLoginPortal?.('dosen');
              }}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition"
            >
              <span>Buka Portal Login Dosen</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : selectedRoleTab === 'admin' ? (
          <div className="p-8 text-center flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center">
              <Shield className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h4 className="text-lg font-bold text-slate-900">Portal Login Administrator (BAAK)</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Akun administrator terproteksi dengan kredensial resmi BAAK (username: baak, password: baak123). Administrator tidak dapat login sebagai dosen.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenLoginPortal?.('admin');
              }}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition"
            >
              <span>Buka Portal Login Administrator</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama mahasiswa, NIM, atau rombel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-500 transition"
                />
              </div>
            </div>

            {/* User List */}
            <div className="overflow-y-auto p-4 sm:p-5 space-y-2.5 flex-1">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Tidak ada mahasiswa yang cocok dengan pencarian
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = currentUser.id === user.id;
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition ${
                        isCurrent
                          ? 'border-slate-900 bg-slate-50/80 ring-1 ring-slate-900'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm sm:text-base font-bold text-slate-900">{user.name}</span>
                            {isCurrent && (
                              <span className="text-xs font-semibold text-slate-900">
                                (Aktif)
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>NIM: <strong className="font-mono text-slate-700">{user.username}</strong></span>
                            {user.rombel && (
                              <>
                                <span>·</span>
                                <span>Rombel {user.rombel}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCurrent ? (
                          <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center">
                            <Check className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-1.5 rounded-md border border-slate-200 bg-white">
                            Pilih
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs sm:text-sm text-slate-500 flex items-center justify-between gap-3">
          {onOpenStudentPortal ? (
            <button
              onClick={() => {
                onClose();
                onOpenStudentPortal();
              }}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Login Mandiri dengan NIM & Password</span>
            </button>
          ) : (
            <span>STMIK PGRI Arungbinang Kebumen</span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-slate-600 hover:bg-slate-200 font-medium transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
