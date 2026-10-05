import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { User } from '../../types/attendance';
import { CAMPUS_INFO } from '../../data/initialData';
import {
  GraduationCap, Eye, EyeOff, Check, AlertCircle, X,
  ArrowRight
} from 'lucide-react';

interface StudentLoginPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  onOpenStaffPortal?: () => void;
}

export const StudentLoginPortal: React.FC<StudentLoginPortalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenStaffPortal,
}) => {
  const { students, users, addUser } = useAttendance();

  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanNim = nim.trim().toUpperCase();

    if (!cleanNim) {
      setErrorMessage('Silakan masukkan Nomor Induk Mahasiswa (NIM).');
      return;
    }

    if (!password) {
      setErrorMessage('Silakan masukkan password.');
      return;
    }

    // Password validation rule
    if (password !== 'pass123') {
      setErrorMessage('Password salah! Silakan periksa kembali password Anda.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // 1. Check if user already exists in users list
      const existingUser = users.find(
        u => u.username.toUpperCase() === cleanNim && u.role === 'mahasiswa'
      );

      if (existingUser) {
        setIsLoading(false);
        setSuccessMessage(`Login berhasil! Selamat datang, ${existingUser.name}.`);
        setTimeout(() => {
          onLoginSuccess(existingUser);
        }, 500);
        return;
      }

      // 2. Check if student exists in master students database
      const foundStudent = students.find(s => s.nim.toUpperCase() === cleanNim);

      if (foundStudent) {
        // Create user record for this student
        const newStudentUser: User = {
          id: `mhs-${foundStudent.nim}`,
          username: foundStudent.nim,
          name: foundStudent.name,
          email: foundStudent.email,
          role: 'mahasiswa',
          prodi: foundStudent.prodi,
          rombel: foundStudent.rombel,
          phone: foundStudent.phone,
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        };

        addUser(newStudentUser);
        setIsLoading(false);
        setSuccessMessage(`Login berhasil! Selamat datang, ${foundStudent.name}.`);
        setTimeout(() => {
          onLoginSuccess(newStudentUser);
        }, 500);
        return;
      }

      // If NIM not found in system
      setIsLoading(false);
      setErrorMessage(
        `NIM "${cleanNim}" tidak ditemukan dalam database mahasiswa STMIK PGRI Arungbinang. Silakan periksa kembali NIM Anda.`
      );
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full my-auto overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 border border-blue-500 flex items-center justify-center text-white shrink-0 shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block">
                SIAKAD & Presensi QR
              </span>
              <h3 className="text-lg font-bold text-white leading-tight">
                Portal Login Mahasiswa
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {CAMPUS_INFO.name}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5 animate-fadeIn font-semibold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* NIM Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Induk Mahasiswa (NIM) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nim}
                onChange={(e) => setNim(e.target.value.toUpperCase())}
                placeholder="Masukkan NIM Anda"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-mono font-semibold placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition"
                required
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-mono placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs mt-3"
            >
              {isLoading ? (
                <span>Memverifikasi Akun...</span>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Staff Portal */}
          {onOpenStaffPortal && (
            <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
              <span>Bukan Mahasiswa? </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStaffPortal();
                }}
                className="font-semibold text-slate-900 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Portal Login Dosen & Administrator BAAK</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
