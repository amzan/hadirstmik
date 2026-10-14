import React from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { User } from '../types/attendance';
import {
  X, ShieldAlert, LogOut, ArrowRight, Laptop, CheckCircle2, Lock
} from 'lucide-react';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User;
  onSelectUser?: (user: User) => void;
  users?: User[];
  onOpenLoginPortal?: (defaultTab?: 'dosen' | 'admin') => void;
  onOpenStudentPortal?: () => void;
  onLogout?: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser: propCurrentUser,
  onOpenLoginPortal,
  onOpenStudentPortal,
  onLogout,
}) => {
  const context = useAttendance();
  const currentUser = propCurrentUser || context.currentUser;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Proteksi Akses & Isolasi Akun
              </h3>
              <p className="text-xs text-slate-300">
                STMIK PGRI Arungbinang Kebumen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Peralihan Akun Langsung Dilarang
              </h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Demi melindungi integritas data presensi dan mencegah mahasiswa beralih/menggunakan akun milik dosen (seperti Bpk. Nur Wasito) atau akun mahasiswa lain, fitur perpindahan akun tanpa login resmi telah <strong>dinonaktifkan secara permanen</strong>.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Akun Aktif Anda Saat Ini:
            </div>
            <div className="flex items-center gap-3">
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={currentUser.name}
                className="w-11 h-11 rounded-full object-cover border border-slate-300 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</div>
                <div className="text-xs text-slate-500 font-mono">
                  {currentUser.role === 'mahasiswa' ? `NIM: ${currentUser.username}` : `Username: ${currentUser.username}`} · <span className="capitalize font-semibold text-slate-700">{currentUser.role}</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Sesi Terkunci
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-600 space-y-2">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Untuk Masuk Menggunakan Akun Lain:</span>
            </p>
            <p className="pl-5.5 text-slate-500">
              Silakan keluar (logout) dari akun ini terlebih dahulu, lalu lakukan autentikasi kredensial resmi pada portal login yang sesuai (Portal Mahasiswa atau Portal Dosen).
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-200/60 transition cursor-pointer"
          >
            Tetap di Akun Ini
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onLogout) {
                onLogout();
              } else {
                context.logoutSession();
              }
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar (Logout) untuk Ganti Akun</span>
          </button>
        </div>
      </div>
    </div>
  );
};
