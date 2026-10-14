import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { DeviceSession, Role } from '../../types/attendance';
import {
  Laptop, Smartphone, Tablet, Shield, ShieldCheck, ShieldAlert,
  Clock, MapPin, Globe, LogOut, CheckCircle2, AlertTriangle,
  RefreshCw, Search, Check, Sparkles
} from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface DeviceSessionManagerProps {
  mode?: 'user' | 'admin';
  targetUserId?: string;
  onSessionTerminated?: () => void;
}

export const DeviceSessionManager: React.FC<DeviceSessionManagerProps> = ({
  mode = 'user',
  targetUserId,
  onSessionTerminated,
}) => {
  const {
    currentUser,
    deviceSessions,
    currentDeviceId,
    getUserDeviceSessions,
    terminateDeviceSession,
    terminateOtherDeviceSessions,
  } = useAttendance();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirm dialog state
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

  // Target user sessions vs all sessions for admin
  const isUserMode = mode === 'user';
  const effectiveUserId = targetUserId || currentUser.id;

  const userSessions = isUserMode
    ? getUserDeviceSessions(effectiveUserId)
    : deviceSessions;

  const currentActiveSession = userSessions.find(s => s.isCurrentDevice && s.status === 'ACTIVE');
  const otherSessions = userSessions.filter(s => !s.isCurrentDevice);
  const activeOtherSessionsCount = otherSessions.filter(s => s.status === 'ACTIVE').length;

  const filteredAdminSessions = userSessions.filter(s => {
    if (roleFilter !== 'all' && s.userRole !== roleFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.userName.toLowerCase().includes(q) ||
      s.userUsername.toLowerCase().includes(q) ||
      s.deviceName.toLowerCase().includes(q) ||
      s.browser.toLowerCase().includes(q) ||
      s.os.toLowerCase().includes(q) ||
      s.ipSimulated.toLowerCase().includes(q)
    );
  });

  const formatTimestamp = (ts: number): string => {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' WIB';
  };

  const formatRelativeTime = (ts: number): string => {
    if (!ts) return '-';
    const diffMs = Date.now() - ts;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari yang lalu`;
  };

  const getDeviceIcon = (deviceType: 'desktop' | 'mobile' | 'tablet') => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-indigo-600" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-purple-600" />;
      case 'desktop':
      default:
        return <Laptop className="w-5 h-5 text-blue-600" />;
    }
  };

  const handleTerminateSession = (session: DeviceSession) => {
    const isThisDevice = session.isCurrentDevice;
    setConfirmConfig({
      isOpen: true,
      title: isThisDevice ? 'Keluar dari Perangkat Ini?' : 'Putuskan Sesi Perangkat?',
      message: isThisDevice
        ? 'Anda akan dikeluarkan dari sistem presensi pada perangkat ini. Anda perlu login kembali untuk mengakses akun.'
        : `Putuskan akses sesi pada perangkat "${session.deviceName}" (${session.ipSimulated})? Perangkat tersebut tidak akan dapat mengakses akun tanpa login ulang.`,
      confirmLabel: 'Ya, Putuskan Sesi',
      isDestructive: true,
      onConfirm: () => {
        const res = terminateDeviceSession(session.id);
        if (res.success) {
          setActionNotice({ type: 'success', message: res.message });
          onSessionTerminated?.();
        } else {
          setActionNotice({ type: 'error', message: res.message });
        }
      },
    });
  };

  const handleTerminateAllOther = () => {
    if (activeOtherSessionsCount === 0) {
      setActionNotice({ type: 'success', message: 'Tidak ada sesi perangkat lain yang aktif.' });
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Putuskan Semua Sesi Perangkat Lain?',
      message: `Tindakan ini akan mencabut akses login akun Anda di ${activeOtherSessionsCount} perangkat lain (seperti smartphone, lab komputer, atau laptop lain). Hanya perangkat ini yang akan tetap aktif.`,
      confirmLabel: `Putuskan ${activeOtherSessionsCount} Sesi Lain`,
      isDestructive: true,
      onConfirm: () => {
        const res = terminateOtherDeviceSessions(effectiveUserId);
        setActionNotice({ type: 'success', message: res.message });
        onSessionTerminated?.();
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Alert Notice Banner */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs sm:text-sm animate-fadeIn ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{actionNotice.message}</div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Security Isolation Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm sm:text-base font-bold text-slate-900">
                  Proteksi Sesi Perangkat & Anti-Pembajakan Akun
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Aktif & Terproteksi
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                Setiap sesi terisolasi dan terikat pada sidik perangkat browser (<span className="font-mono text-slate-800 font-semibold">{currentDeviceId.slice(0, 14)}...</span>). Sistem secara ketat <strong>mencegah pengguna berpindah ke akun milik orang lain</strong> (contoh: mahasiswa ke dosen atau ke mahasiswa lain) tanpa otentikasi kata sandi resmi.
              </p>
            </div>
          </div>

          {isUserMode && activeOtherSessionsCount > 0 && (
            <button
              type="button"
              onClick={handleTerminateAllOther}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer shrink-0"
              title="Keluarkan akun dari semua perangkat lain selain perangkat ini"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Putuskan {activeOtherSessionsCount} Sesi Lain</span>
            </button>
          )}
        </div>
      </div>

      {isUserMode ? (
        /* USER MODE: Current Device Card + Other Devices List */
        <div className="space-y-5">
          {/* Section: Perangkat Ini (Current Device) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Perangkat Ini (Sedang Digunakan)</span>
              </h5>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Terverifikasi Aman
              </span>
            </div>

            {currentActiveSession ? (
              <div className="bg-white rounded-2xl border-2 border-emerald-500/60 p-4 sm:p-5 shadow-sm hover:shadow-md transition">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                      {getDeviceIcon(currentActiveSession.deviceType)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-bold text-slate-900">
                          {currentActiveSession.deviceName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider">
                          Perangkat Ini
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                        <span className="flex items-center gap-1 font-mono text-slate-700">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span>IP: {currentActiveSession.ipSimulated}</span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{currentActiveSession.locationCity}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Masuk: <strong>{formatTimestamp(currentActiveSession.loginTimestamp)}</strong></span>
                        </span>
                        <span>·</span>
                        <span>Aktivitas: <strong className="text-emerald-700">{formatRelativeTime(currentActiveSession.lastActiveTimestamp)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="sm:self-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sesi Aktif</span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-100 rounded-xl text-xs text-slate-500 text-center">
                Sesi perangkat saat ini sedang diinisialisasi ulang.
              </div>
            )}
          </div>

          {/* Section: Sesi di Perangkat Lain */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Riwayat Sesi di Perangkat Lain ({otherSessions.length})
              </h5>
              {activeOtherSessionsCount > 0 && (
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {activeOtherSessionsCount} perangkat lain aktif
                </span>
              )}
            </div>

            {otherSessions.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500">
                <Laptop className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Tidak ada sesi login dari perangkat lain</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Akun Anda saat ini hanya tercatat aktif pada perangkat browser ini saja.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {otherSessions.map(session => {
                  const isActive = session.status === 'ACTIVE';
                  return (
                    <div
                      key={session.id}
                      className={`rounded-2xl border p-4 transition ${
                        isActive
                          ? 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                          : 'bg-slate-50/70 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-400'
                          }`}>
                            {getDeviceIcon(session.deviceType)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">
                                {session.deviceName}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-200 text-slate-600'
                              }`}>
                                {isActive ? 'Aktif' : 'Diputuskan'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                              <span>IP: {session.ipSimulated}</span>
                              <span>·</span>
                              <span>{session.locationCity}</span>
                              <span>·</span>
                              <span>Aktivitas: {formatRelativeTime(session.lastActiveTimestamp)}</span>
                            </div>
                          </div>
                        </div>

                        {isActive && (
                          <button
                            type="button"
                            onClick={() => handleTerminateSession(session)}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                            title="Putuskan sesi perangkat ini"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Putuskan Sesi</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ADMIN MODE: Campus-wide Device Sessions Overview & Management */
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, NIM/NIDN, perangkat, atau IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-slate-800"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:border-slate-800"
              >
                <option value="all">Semua Hak Akses</option>
                <option value="mahasiswa">Mahasiswa</option>
                <option value="dosen">Dosen</option>
                <option value="admin">Administrator BAAK</option>
              </select>
            </div>
          </div>

          {/* Sessions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <th className="p-3.5">Pengguna & Peran</th>
                    <th className="p-3.5">Perangkat & Browser</th>
                    <th className="p-3.5">IP & Lokasi</th>
                    <th className="p-3.5">Waktu Login & Terakhir</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdminSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-xs sm:text-sm">
                        Tidak ada catatan sesi perangkat yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredAdminSessions.map(session => {
                      const isActive = session.status === 'ACTIVE';
                      return (
                        <tr key={session.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={session.userAvatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                                alt={session.userName}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{session.userName}</span>
                                  {session.isCurrentDevice && (
                                    <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                                      Anda
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                  {session.userUsername} · <span className="capitalize">{session.userRole}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(session.deviceType)}
                              <div>
                                <div className="font-semibold text-slate-800">{session.deviceName}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{session.deviceId.slice(0, 16)}...</div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="font-mono text-slate-700">{session.ipSimulated}</div>
                            <div className="text-[11px] text-slate-500">{session.locationCity}</div>
                          </td>

                          <td className="p-3.5">
                            <div className="text-xs text-slate-800">{formatTimestamp(session.loginTimestamp)}</div>
                            <div className="text-[11px] text-slate-500">
                              Aktif: <strong className="text-slate-700">{formatRelativeTime(session.lastActiveTimestamp)}</strong>
                            </div>
                          </td>

                          <td className="p-3.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {isActive ? 'Aktif' : 'Diputuskan'}
                            </span>
                          </td>

                          <td className="p-3.5 text-right">
                            {isActive && (
                              <button
                                type="button"
                                onClick={() => handleTerminateSession(session)}
                                className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition cursor-pointer"
                                title="Putuskan sesi perangkat ini secara paksa"
                              >
                                Putuskan
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={() => {
          confirmConfig.onConfirm();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
