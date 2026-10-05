import React from 'react';
import { CAMPUS_INFO } from '../../data/initialData';
import {
  GraduationCap, BookOpen, Shield, ArrowRight,
  CheckCircle2, AlertTriangle, Lock, Calendar, Sparkles
} from 'lucide-react';

interface HomePageProps {
  onOpenStudentLogin: () => void;
  onOpenDosenLogin: () => void;
  onOpenBaakLogin: () => void;
  inactivityNotice?: string | null;
  onDismissInactivityNotice?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenStudentLogin,
  onOpenDosenLogin,
  onOpenBaakLogin,
  inactivityNotice,
  onDismissInactivityNotice,
}) => {
  return (
    <div className="py-6 sm:py-10 space-y-10 animate-fadeIn">
      {/* Inactivity Auto-Logout Alert Banner (if triggered) */}
      {inactivityNotice && (
        <div className="p-4 sm:p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Sesi Login Berakhir Otomatis
              </h4>
              <p className="text-xs sm:text-sm text-amber-800 mt-0.5 leading-relaxed">
                {inactivityNotice}
              </p>
            </div>
          </div>
          {onDismissInactivityNotice && (
            <button
              onClick={onDismissInactivityNotice}
              className="text-amber-700 hover:text-amber-900 p-1 rounded-lg text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Hero Welcome Section */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-xs font-bold uppercase tracking-wider shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Sistem Informasi Akademik & Presensi Kampus</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Presensi Perkuliahan Berbasis QR Code
        </h2>

        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Selamat datang di portal presensi digital <strong>{CAMPUS_INFO.name}</strong>. Silakan pilih portal masuk sesuai dengan peran Anda di kampus untuk memulai.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-500 pt-1 font-medium">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{CAMPUS_INFO.semester}</span>
          </span>
          <span className="hidden sm:inline">•</span>
          
        </div>
      </div>

      {/* 3 Dedicated Portal Login Gateway Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 max-w-6xl mx-auto">
        {/* CARD 1: PORTAL MAHASISWA */}
        <div className="bg-white border-2 border-blue-200 hover:border-blue-600 rounded-2xl p-5 sm:p-7 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between space-y-6 group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <GraduationCap className="w-8 h-8" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                NIM & Password
              </span>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Portal Mahasiswa
              </h3>
              <p className="text-xs text-blue-700 font-semibold mt-0.5">
                Presensi Mandiri & Jadwal Kuliah
              </p>
            </div>

            <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Scan QR presensi sesi mata kuliah aktif</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Rekapitulasi kehadiran real-time per semester</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Pengajuan permohonan izin / sakit online</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onOpenStudentLogin}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs group-hover:shadow-md"
          >
            <span>Masuk Portal Mahasiswa</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* CARD 2: PORTAL DOSEN PENGAMPU */}
        <div className="bg-white border-2 border-slate-200 hover:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between space-y-6 group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <BookOpen className="w-8 h-8" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Dosen Pengampu
              </span>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-slate-800 transition-colors">
                Portal Dosen
              </h3>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">
                Pengelolaan Sesi & QR Code Kelas
              </p>
            </div>

            <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0" />
                <span>Buka sesi kuliah & tayangkan Dynamic QR Code</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0" />
                <span>Verifikasi kehadiran manual & review izin</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0" />
                <span>Otomasi pengalihan mahasiswa tidak hadir ke Alpha</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onOpenDosenLogin}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs group-hover:shadow-md"
          >
            <span>Masuk Portal Dosen</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* CARD 3: PORTAL ADMINISTRATOR (BAAK) */}
        <div className="bg-white border-2 border-indigo-200 hover:border-indigo-600 rounded-2xl p-5 sm:p-7 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between space-y-6 group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-indigo-700 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Shield className="w-8 h-8 text-indigo-100" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Staf BAAK
              </span>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                Portal BAAK
              </h3>
              <p className="text-xs text-indigo-700 font-semibold mt-0.5">
                Biro Administrasi Akademik & Kemahasiswaan
              </p>
            </div>

            <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Monitoring sesi perkuliahan aktif & arsip sesi</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Reset presensi sesi tertutup & penghapusan sesi</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Master jadwal kuliah, rombel & ekspor laporan</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onOpenBaakLogin}
            className="w-full py-3 px-4 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs group-hover:shadow-md"
          >
            <span>Masuk Portal BAAK</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
