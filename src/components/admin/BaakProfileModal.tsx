import React, { useState, useEffect, useRef } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { ChangePasswordOtpSection } from '../shared/ChangePasswordOtpSection';
import {
  X, User, Mail, Phone, Shield, Check,
  Camera, Building, CheckCircle2, AlertCircle, Sparkles, Upload, KeyRound
} from 'lucide-react';

interface BaakProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'profil' | 'password';
}

const BAAK_AVATAR_PRESETS = [
  {
    label: 'Petugas BAAK 1',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  {
    label: 'Petugas BAAK 2',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  },
  {
    label: 'Petugas Formal 1',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  {
    label: 'Petugas Formal 2',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    label: 'Petugas Formal 3',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  },
];

export const BaakProfileModal: React.FC<BaakProfileModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'profil',
}) => {
  const { currentUser, updateUser } = useAttendance();

  const [activeTab, setActiveTab] = useState<'profil' | 'password'>(defaultTab);

  // Form states
  const [name, setName] = useState(currentUser.name || 'Administrator Akademik (BAAK)');
  const [title, setTitle] = useState(currentUser.title || 'Kepala Bagian BAAK');
  const [email, setEmail] = useState(currentUser.email || 'baak@stmik-arungbinang.ac.id');
  const [phone, setPhone] = useState(currentUser.phone || '081234567890');
  const [officeRoom, setOfficeRoom] = useState(currentUser.officeRoom || 'Gedung Rektorat Lt. 1 Ruang BAAK');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || BAAK_AVATAR_PRESETS[0].url);
  const [showCustomAvatarInput, setShowCustomAvatarInput] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccessInfo, setUploadSuccessInfo] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync on open
  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || 'Administrator Akademik (BAAK)');
      setTitle(currentUser.title || 'Kepala Bagian BAAK');
      setEmail(currentUser.email || 'baak@stmik-arungbinang.ac.id');
      setPhone(currentUser.phone || '081234567890');
      setOfficeRoom(currentUser.officeRoom || 'Gedung Rektorat Lt. 1 Ruang BAAK');
      setAvatarUrl(currentUser.avatarUrl || BAAK_AVATAR_PRESETS[0].url);
      setSaveSuccess(false);
      setErrorMessage('');
      setUploadError('');
      setUploadSuccessInfo('');
      setShowCustomAvatarInput(false);
      setActiveTab(defaultTab);
    }
  }, [isOpen, currentUser, defaultTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    setUploadSuccessInfo('');
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isJpg = file.type === 'image/jpeg' || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');
    if (!isJpg) {
      setUploadError('Format tidak sesuai. Hanya file foto JPG (.jpg / .jpeg) yang dapat diunggah.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setUploadError(`Ukuran file (${sizeMb} MB) melebihi batas maksimal 10 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 512;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedJpeg = canvas.toDataURL('image/jpeg', 0.9);
            setAvatarUrl(optimizedJpeg);
          } else {
            setAvatarUrl(result);
          }
        } catch {
          setAvatarUrl(result);
        }

        const sizeKb = Math.round(file.size / 1024);
        const displaySize = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
        setUploadSuccessInfo(`Foto JPG "${file.name}" (${displaySize}) berhasil dimuat.`);
      };
      img.onerror = () => {
        setUploadError('Gagal memproses file foto JPG. Pastikan file gambar tidak rusak.');
      };
      img.src = result;
    };
    reader.onerror = () => {
      setUploadError('Terjadi kesalahan saat membaca file gambar.');
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage('Nama administrator BAAK tidak boleh kosong.');
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Alamat email BAAK harus valid.');
      return;
    }

    updateUser(currentUser.id, {
      name: cleanName,
      title: title.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      officeRoom: officeRoom.trim(),
      avatarUrl: avatarUrl.trim(),
    });

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden animate-in fade-in duration-200">
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-4 bg-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center text-indigo-200">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white leading-snug">
                Konfigurasi Profil Petugas BAAK
              </h3>
              <p className="text-xs text-indigo-300">
                Biro Administrasi Akademik & Kemahasiswaan · STMIK PGRI Kebumen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-indigo-900 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('profil')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'profil'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Data Petugas BAAK</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'password'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Ganti Password (OTP Email)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
              Resend OTP
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[calc(85vh-140px)] overflow-y-auto">
          {activeTab === 'profil' ? (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Success Banner */}
              {saveSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-sm animate-in fade-in duration-150">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-semibold">Profil BAAK Berhasil Diperbarui!</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Perubahan nama pengelola, email kontak, dan ruang layanan telah tersimpan.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-sm">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Avatar Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,image/jpeg"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="relative group shrink-0">
                  <img
                    src={avatarUrl}
                    alt={name || 'Foto Profil'}
                    className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border-2 border-white shadow-md cursor-pointer group-hover:ring-2 group-hover:ring-indigo-400 transition"
                    onClick={() => fileInputRef.current?.click()}
                    title="Klik untuk unggah foto JPG baru (Maks. 10 MB)"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition cursor-pointer"
                    title="Unggah Foto JPG"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Administrator BAAK
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-200 text-slate-800">
                      User: baak
                    </span>
                  </div>

                  <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-1 truncate">
                    {name || 'Administrator BAAK'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {title} · {officeRoom}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah File JPG</span>
                      <span className="text-[10px] text-indigo-100">(Maks. 10 MB)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCustomAvatarInput(!showCustomAvatarInput)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer"
                    >
                      {showCustomAvatarInput ? 'Tutup URL' : 'Tautan URL'}
                    </button>
                  </div>

                  {uploadError && (
                    <div className="mt-2 text-left p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {uploadSuccessInfo && (
                    <div className="mt-2 text-left p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 text-emerald-800 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>{uploadSuccessInfo}</span>
                    </div>
                  )}

                  {/* Avatar Preset */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                    <p className="text-[11px] font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Pilih foto profil preset administrator:</span>
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      {BAAK_AVATAR_PRESETS.map((p, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => {
                            setAvatarUrl(p.url);
                            setUploadSuccessInfo('');
                            setUploadError('');
                          }}
                          className={`w-7 h-7 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                            avatarUrl === p.url ? 'border-indigo-600 ring-2 ring-indigo-300' : 'border-slate-200 hover:border-slate-400'
                          }`}
                          title={p.label}
                        >
                          <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {showCustomAvatarInput && (
                    <div className="mt-2.5">
                      <input
                        type="url"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://contoh-link-foto.com/foto.jpg"
                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Petugas / Administrator BAAK <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Administrator Akademik (BAAK)"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username / ID Login Administrator
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.username}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 bg-slate-100 font-mono text-slate-600 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Akses eksklusif melalui direktori ~/portaladmin
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jabatan / Unit Kerja
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Kepala Biro BAAK / Staf Akademik"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Resmi BAAK (Untuk Notifikasi & Verifikasi OTP) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="baak@stmik-arungbinang.ac.id"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden text-slate-900 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Kode verifikasi OTP ganti password admin akan dikirimkan ke email ini.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. Handphone / WhatsApp Layanan BAAK
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lokasi Kantor / Loket BAAK
                  </label>
                  <input
                    type="text"
                    value={officeRoom}
                    onChange={(e) => setOfficeRoom(e.target.value)}
                    placeholder="Gedung Rektorat Lt. 1 Ruang BAAK"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden text-slate-900"
                  />
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('password')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Ingin ubah kata sandi admin? Buka Tab Password</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Simpan Profil BAAK</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Tab Ganti Password dengan OTP Email */
            <div className="space-y-4">
              <ChangePasswordOtpSection
                currentUser={currentUser}
                overrideEmail={email}
                onPasswordChanged={() => {}}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
