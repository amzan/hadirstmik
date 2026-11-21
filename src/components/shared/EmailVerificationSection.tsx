import React, { useEffect, useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { api } from '../../utils/api';

export const EmailVerificationSection: React.FC<{ email: string }> = ({ email }) => {
  const { currentUser, refresh } = useAttendance();
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const savedEmail = currentUser.email || '';
  const changed = email.trim().toLowerCase() !== savedEmail.toLowerCase();

  useEffect(() => {
    setChallengeId(''); setCode(''); setError(''); setSent(false); setCooldown(0);
  }, [savedEmail, currentUser.id]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const request = async () => {
    if (busy || cooldown || changed) return;
    setBusy(true); setError('');
    try {
      const result = await api<{ challengeId: string; cooldown: number }>('/auth/email-verification/request', 'POST', {});
      setChallengeId(result.challengeId); setCode(''); setSent(true); setCooldown(result.cooldown);
    } catch (error) { setError(error instanceof Error ? error.message : 'Pengiriman OTP gagal.'); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (busy || changed || !/^\d{6}$/.test(code)) return;
    setBusy(true); setError('');
    try {
      await api('/auth/email-verification/confirm', 'POST', { challengeId, code });
      setCode(''); setChallengeId(''); setSent(false); await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Verifikasi OTP gagal.'); }
    finally { setBusy(false); }
  };

  return <section aria-label="Verifikasi email" className="mt-2 space-y-2 text-xs">
    <p role="status">{changed ? 'Simpan perubahan email sebelum meminta OTP.' : currentUser.emailVerified ? 'Email terverifikasi.' : 'Email belum terverifikasi. Verifikasi untuk pemulihan password melalui email.'}</p>
    {!currentUser.emailVerified && !changed && savedEmail && <>
      <button type="button" className="frost-btn" disabled={busy || cooldown > 0} onClick={request}>{cooldown ? `Kirim ulang dalam ${cooldown} detik` : sent ? 'Kirim ulang OTP email' : 'Kirim OTP verifikasi email'}</button>
      {sent && <p role="status">OTP dikirim ke email akun ini dan berlaku 15 menit.</p>}
      {challengeId && <div className="flex flex-wrap items-end gap-2">
        <label className="block">Kode OTP email<input aria-label="Kode OTP verifikasi email" className="frost-input block" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        <button type="button" className="frost-btn" disabled={busy || code.length !== 6} onClick={confirm}>Verifikasi email</button>
      </div>}
    </>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
  </section>;
};
