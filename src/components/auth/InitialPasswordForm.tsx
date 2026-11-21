import { validateAccountPassword } from '../../utils/passwordPolicy';
import React, { useState } from 'react';
import { api, invalidateApiSession } from '../../utils/api';

export function InitialPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <main className="min-h-screen flex items-center justify-center bg-[#fafafa] p-5"><form className="frost-card p-7 w-full max-w-md space-y-4" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    if (password !== confirmation) { setError('Konfirmasi password tidak sama.'); return; }
    setBusy(true); setError('');
    try { validateAccountPassword(password); await api('/auth/initial-password', 'POST', { newPassword: password }); setPassword(''); setConfirmation(''); invalidateApiSession(); window.dispatchEvent(new Event('hadir-session-expired')); }
    catch (error) { setError(error instanceof Error ? error.message : 'Password belum disimpan.'); }
    finally { setBusy(false); }
  }}>
    <h1 className="font-bold text-xl">Ganti Password Sementara</h1>
    <p className="text-sm">Buat password pribadi minimal 6 karakter, hindari password umum atau berurutan. Ganti password sementara sebelum mengakses aplikasi. Setelah berhasil, masuk kembali memakai password baru.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <label className="block">Password baru<input aria-label="Password baru aktivasi" className="frost-input" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={event => setPassword(event.target.value)} /></label>
    <label className="block">Konfirmasi password baru<input aria-label="Konfirmasi password baru aktivasi" className="frost-input" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
    <button className="frost-btn frost-btn-primary" disabled={busy}>Simpan password pribadi</button>
  </form></main>;
}
