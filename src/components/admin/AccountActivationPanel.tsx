import { validateAccountPassword } from '../../utils/passwordPolicy';
import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { useAttendance } from '../../context/AttendanceContext';
import type { User } from '../../types/attendance';

type Account = User & { emailVerified: boolean; mustChangePassword: boolean };
type Preview = { accounts: Account[]; count: number; existingCredentialCount: number };
type EncryptedReport = { format: string; kdf: string; iterations: number; salt: string; iv: string; tag: string; ciphertext: string };
type ReportAccount = { name: string; username: string; role: string; loginAlias?: string; temporaryPassword: string };
const bytes = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));

export async function decryptActivationReport(report: EncryptedReport, passphrase: string): Promise<{ accounts: ReportAccount[] }> {
  if (report.format !== 'HADIR-ACTIVATION-1' || report.kdf !== 'PBKDF2-SHA256' || report.iterations !== 600000) throw new Error('Format laporan tidak didukung.');
  const source = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(report.salt), iterations: report.iterations }, source, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const payload = new Uint8Array([...bytes(report.ciphertext), ...bytes(report.tag)]);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(report.iv), tagLength: 128 }, key, payload);
  const decoded = JSON.parse(new TextDecoder().decode(plaintext));
  if (!Array.isArray(decoded.accounts) || decoded.accounts.length > 50 || decoded.accounts.some((account: ReportAccount) => !account || !['name', 'username', 'role', 'temporaryPassword'].every(field => typeof account[field as keyof ReportAccount] === 'string') || account.loginAlias !== undefined && typeof account.loginAlias !== 'string')) throw new Error('Isi laporan tidak valid.');
  return decoded;
}

export function AccountActivationPanel() {
  const { currentUser, refresh } = useAttendance();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [role, setRole] = useState('all');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [manual, setManual] = useState(false);
  const [confirmExisting, setConfirmExisting] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [report, setReport] = useState<EncryptedReport | null>(null);
  const [individual, setIndividual] = useState<ReportAccount | null>(null);
  const [emailAccount, setEmailAccount] = useState<Account | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedReport, setSavedReport] = useState<EncryptedReport | null>(null);
  const [reportAccounts, setReportAccounts] = useState<ReportAccount[]>([]);
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const load = async () => setAccounts(await api<Account[]>('/admin/accounts'));
  useEffect(() => { void load().catch(error => setError(error.message)); }, []);
  useEffect(() => {
    if (!report && reportAccounts.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [report, reportAccounts.length]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : 'Permintaan gagal.'); } finally { setBusy(false); }
  };
  const openPreview = (userIds = selected, useManualPassword = false) => run(async () => {
    const result = await api<Preview>('/admin/accounts/activation-preview', 'POST', { userIds });
    setPreview(result); setRequestId(crypto.randomUUID()); setConfirmExisting(false); setAdminPassword(''); setPassphrase(''); setManualPassword(''); setManual(useManualPassword);
  });
  const activate = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (manual) validateAccountPassword(manualPassword);
      const result = await api<{ report: EncryptedReport; count: number }>('/admin/accounts/activate', 'POST', {
        userIds: preview!.accounts.map(account => account.id), requestId, adminPassword,
        confirmExistingCredentials: confirmExisting, reportPassphrase: passphrase,
        ...(manual ? { manualPassword } : {}),
      });
      setReport(result.report); setAdminPassword(''); setManualPassword('');
      if (result.count === 1) {
        try { setIndividual((await decryptActivationReport(result.report, passphrase)).accounts[0]); }
        catch { setError('Laporan terenkripsi tersedia. Unduh sebelum menutup; jika tidak dapat dibaca, reset akun kembali.'); }
      }
      setPassphrase(''); setPreview(null); setSelected([]);
      setNotice(`${result.count} akun berhasil diaktifkan. Simpan laporan sekarang; server tidak menyimpan password sementara.`);
      await load(); await refresh();
    });
  };
  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'hadir-aktivasi-terenkripsi.json'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const visible = accounts.filter(account => role === 'all' || account.role === role);
  return <section className="border border-[#dddddd] rounded-lg p-4 space-y-4" aria-label="Aktivasi akun">
    <h3 className="font-bold text-lg">Email dan Aktivasi Akun</h3>
    <p className="text-sm text-[#555555]">Maksimal 50 akun per batch. Setiap password otomatis terdiri dari 6 karakter, berbeda, dan wajib diganti saat login.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status" className="text-[#016F73]">{notice}</p>}
    <details className="text-sm"><summary className="cursor-pointer">Buka laporan terenkripsi yang sudah diunduh</summary>
      <form className="space-y-3 pt-3" onSubmit={event => { event.preventDefault(); void run(async () => { if (!savedReport) throw new Error('Pilih laporan terenkripsi.'); const decoded = await decryptActivationReport(savedReport, unlockPassphrase); setReportAccounts(decoded.accounts); setUnlockPassphrase(''); setSavedReport(null); }); }}>
        <label className="block">File laporan terenkripsi<input type="file" accept="application/json,.json" disabled={busy} onChange={async event => { setError(''); setReportAccounts([]); const file = event.target.files?.[0]; if (!file) return; try { if (file.size > 1024 * 1024) throw new Error('File laporan terlalu besar.'); setSavedReport(JSON.parse(await file.text())); } catch { setError('File laporan tidak valid.'); setSavedReport(null); } event.target.value = ''; }} /></label>
        <label className="block">Frasa sandi laporan<input className="frost-input" type="password" required autoComplete="off" value={unlockPassphrase} onChange={event => setUnlockPassphrase(event.target.value)} /></label>
        <button className="frost-btn" disabled={busy || !savedReport}>Buka laporan di layar</button>
      </form>
      {reportAccounts.length > 0 && <div className="space-y-2 mt-3"><p>Laporan hanya didekripsi di perangkat ini dan tidak dikirim ke server.</p><div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Password sementara</th></tr></thead><tbody>{reportAccounts.map((account, index) => <tr key={index}><td>{account.name}</td><td>{account.loginAlias || account.username}</td><td>{account.role}</td><td><code className="select-all">{account.temporaryPassword}</code></td></tr>)}</tbody></table></div><button type="button" className="frost-btn" onClick={() => setReportAccounts([])}>Tutup hasil dekripsi</button></div>}
    </details>
    {report ? <div className="frost-callout space-y-3">
      <h4 className="font-bold">Laporan Password Sementara</h4>
      <p className="font-semibold">Laporan hanya tersedia selama panel ini terbuka. Jika hilang, lakukan reset ulang.</p>
      {individual && <div className="space-y-1"><p>{individual.name} | {individual.loginAlias || individual.username} | {individual.role}</p><p>Password sementara: <code className="select-all break-all">{individual.temporaryPassword}</code></p></div>}
      <button type="button" className="frost-btn frost-btn-primary" onClick={download}>Unduh laporan terenkripsi</button>
      <button type="button" className="frost-btn" onClick={() => { setReport(null); setIndividual(null); setNotice('Laporan ditutup. Password sementara tidak dapat ditampilkan kembali.'); }}>Tutup dan hapus laporan dari layar</button>
      <p className="text-xs">Simpan frasa sandi secara terpisah. Ekspor memakai PBKDF2-SHA256 dan AES-256-GCM.</p>
    </div> : <>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm">Role <select aria-label="Filter role aktivasi" className="frost-select" value={role} onChange={event => setRole(event.target.value)}><option value="all">Semua</option><option value="mahasiswa">Mahasiswa</option><option value="dosen">Dosen</option><option value="admin">Admin</option></select></label>
        <button type="button" className="frost-btn" disabled={busy} onClick={() => { setSelected(visible.filter(account => account.id !== currentUser.id && !account.hasCredentials).slice(0, 50).map(account => account.id)); setPreview(null); }}>Pilih belum aktif sesuai role</button>
        <button type="button" className="frost-btn frost-btn-primary" disabled={busy || selected.length === 0 || selected.length > 50} onClick={() => void openPreview()}>Preview aktivasi / reset ({selected.length})</button>
        <button type="button" className="frost-btn" disabled={busy || selected.length === 0 || selected.length > 50} onClick={() => void openPreview()}>Aktivasi Massal (maksimal 50 akun)</button>
      </div>
      <div className="max-h-80 overflow-auto"><table className="w-full text-sm text-left"><thead><tr><th>Pilih</th><th>Nama / Username</th><th>Role</th><th>Email</th><th>Status</th><th>Password</th></tr></thead><tbody>
        {visible.map(account => <tr key={account.id} className="border-t border-[#eeeeee]">
          <td className="py-2"><input type="checkbox" aria-label={`Pilih ${account.username}`} disabled={busy || account.id === currentUser.id} checked={selected.includes(account.id)} onChange={event => { setSelected(previous => event.target.checked ? [...previous, account.id] : previous.filter(id => id !== account.id)); setPreview(null); }} /></td>
          <td>{account.name}<span className="block text-xs">{account.username}</span>{account.role === 'dosen' && <span className="block text-xs">Alias login: {account.loginAlias || 'Belum tersedia'}</span>}</td><td>{account.role}</td>
          <td><span className="break-all">{account.email || '-'}</span><span className="block text-xs">{account.emailVerified ? 'Terverifikasi' : 'Belum terverifikasi'}</span>{account.role !== 'admin' && <button type="button" className="text-[#015BB5] underline" disabled={busy} onClick={() => { setEmailAccount(account); setEmail(account.email || ''); }}>Ubah Email</button>}</td>
          <td>{account.hasCredentials ? account.mustChangePassword ? 'Password sementara' : 'Kredensial aktif' : 'Belum aktif'}</td>
          <td><div className="flex flex-wrap gap-2 py-2">
            <button type="button" className="frost-btn frost-btn-xs" disabled={busy || account.id === currentUser.id} onClick={() => void openPreview([account.id], true)}>Reset Password Manual</button>
            <button type="button" className="frost-btn frost-btn-xs" disabled={busy || account.id === currentUser.id} onClick={() => void openPreview([account.id])}>Buat Password Acak</button>
          </div></td>
        </tr>)}
      </tbody></table></div>
      {selected.length > 50 && <p role="alert">Pilih maksimal 50 akun.</p>}
      {preview && <form onSubmit={activate} className="frost-callout space-y-3">
        <h4 className="font-bold">Preview: {preview.count} akun, {preview.existingCredentialCount} sudah berkredensial</h4>
        <ul className="max-h-40 overflow-auto text-sm">{preview.accounts.map(account => <li key={account.id}>{account.name} ({account.username}) - {account.role}</li>)}</ul>
        {preview.existingCredentialCount > 0 && <label className="flex gap-2"><input type="checkbox" required checked={confirmExisting} onChange={event => setConfirmExisting(event.target.checked)} />Saya mengonfirmasi reset akun yang sudah berkredensial dan pencabutan sesi lamanya.</label>}
        {preview.count === 1 && <><label className="flex gap-2"><input type="checkbox" checked={manual} onChange={event => { setManual(event.target.checked); setManualPassword(''); }} />Ketik password sementara manual (jika tidak dipilih, sistem membuat password acak 6 karakter)</label>{manual && <label className="block">Password sementara<input className="frost-input" type="password" required minLength={6} autoComplete="new-password" placeholder="Minimal 6 karakter, hindari pola umum" value={manualPassword} onChange={event => setManualPassword(event.target.value)} /></label>}</>}
        <label className="block">Password admin untuk autentikasi ulang<input className="frost-input" type="password" required autoComplete="current-password" value={adminPassword} onChange={event => setAdminPassword(event.target.value)} /></label>
        <label className="block">Frasa sandi enkripsi laporan (minimal 12 karakter)<input className="frost-input" type="password" required minLength={12} autoComplete="new-password" value={passphrase} onChange={event => setPassphrase(event.target.value)} /></label>
        <p className="text-sm">Simpan frasa sandi ini. Password sementara tidak dapat diambil kembali setelah laporan ditutup.</p>
        <button className="frost-btn frost-btn-primary" disabled={busy}>Aktifkan / reset {preview.count} akun</button><button type="button" className="frost-btn" disabled={busy} onClick={() => { setPreview(null); setAdminPassword(''); setPassphrase(''); setManualPassword(''); }}>Batal</button>
      </form>}
      {emailAccount && <form className="frost-callout space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => { await api(`/admin/accounts/${encodeURIComponent(emailAccount.id)}/email`, 'PATCH', { email }); setEmailAccount(null); setEmail(''); await load(); await refresh(); setNotice('Email diperbarui dan ditandai belum terverifikasi.'); }); }}>
        <label className="block">Email {emailAccount.name}<input type="email" className="frost-input" required value={email} onChange={event => setEmail(event.target.value)} /></label>
        <button className="frost-btn frost-btn-primary" disabled={busy}>Simpan email</button><button type="button" className="frost-btn" disabled={busy} onClick={() => setEmailAccount(null)}>Batal</button>
      </form>}
    </>}
  </section>;
}
