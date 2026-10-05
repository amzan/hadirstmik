import React, { useState, useEffect, useRef } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { ProgramStudi } from '../../types/attendance';
import {
  X, User, Mail, Phone, BookOpen, Shield, Check,
  Camera, Building, FileCheck, CheckCircle2, AlertCircle, Sparkles, Upload, Image as ImageIcon
} from 'lucide-react';

interface DosenProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Preset professional avatar options for easy one-click selection
const AVATAR_PRESETS = [
  {
    label: 'Pria Formal 1',
    url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  },
  {
    label: 'Pria Formal 2',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  {
    label: 'Pria Formal 3',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    label: 'Pria Kacamata',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  },
  {
    label: 'Wanita Hijab 1',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  },
  {
    label: 'Wanita Hijab 2',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  },
];

export const DosenProfileModal: React.FC<DosenProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, updateUser, schedules } = useAttendance();

  // Form states initialized from currentUser
  const [name, setName] = useState(currentUser.name || '');
  const [nidn, setNidn] = useState(currentUser.nidn || currentUser.username || '');
  const [title, setTitle] = useState(currentUser.title || 'Dosen Tetap');
  const [academicRank, setAcademicRank] = useState(currentUser.academicRank || 'Lektor');
  const [prodi, setProdi] = useState<ProgramStudi>(currentUser.prodi || 'Teknologi Informasi');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [officeRoom, setOfficeRoom] = useState(currentUser.officeRoom || 'Gedung A Lt. 2 R. Dosen');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || AVATAR_PRESETS[0].url);
  const [showCustomAvatarInput, setShowCustomAvatarInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccessInfo, setUploadSuccessInfo] = useState<string>('');

  // Status feedback
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || '');
      setNidn(currentUser.nidn || currentUser.username || '');
      setTitle(currentUser.title || 'Dosen Tetap');
      setAcademicRank(currentUser.academicRank || 'Lektor');
      setProdi(currentUser.prodi || 'Teknologi Informasi');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setOfficeRoom(currentUser.officeRoom || 'Gedung A Lt. 2 R. Dosen');
      setAvatarUrl(currentUser.avatarUrl || AVATAR_PRESETS[0].url);
      setSaveSuccess(false);
      setErrorMessage('');
      setUploadError('');
      setUploadSuccessInfo('');
      setShowCustomAvatarInput(false);
    }
  }, [isOpen, currentUser]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    setUploadSuccessInfo('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict validation: must be a JPG / JPEG file
    const lowerName = file.name.toLowerCase();
    const isJpg = file.type === 'image/jpeg' || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');
    if (!isJpg) {
      setUploadError('Format tidak sesuai. Hanya file foto JPG (.jpg / .jpeg) yang dapat diunggah.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Strict validation: max 10 MB (10 * 1024 * 1024 bytes)
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setUploadError(`Ukuran file (${sizeMb} MB) melebihi batas maksimal 10 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Process image with FileReader
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      // Rescale high-res uploads to crisp profile avatar dimensions using canvas to optimize memory
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

  // Schedules taught by this lecturer
  const mySchedules = schedules.filter(
    s => s.lecturerId === currentUser.id || s.lecturerName.includes(currentUser.name)
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = name.trim();
    const cleanNidn = nidn.trim();

    if (!cleanName) {
      setErrorMessage('Nama lengkap dan gelar tidak boleh kosong.');
      return;
    }

    if (!cleanNidn) {
      setErrorMessage('NIDN / NIP tidak boleh kosong.');
      return;
    }

    // Update user in context
    updateUser(currentUser.id, {
      name: cleanName,
      username: cleanNidn,
      nidn: cleanNidn,
      title: title.trim(),
      academicRank: academicRank.trim(),
      prodi,
      email: email.trim(),
      phone: phone.trim(),
      officeRoom: officeRoom.trim(),
      avatarUrl: avatarUrl.trim(),
    });

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white leading-snug">
                Konfigurasi Profil Dosen
              </h3>
              <p className="text-xs text-slate-300">
                STMIK PGRI Arungbinang Kebumen · Semester Ganjil 2026/2027
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5 max-h-[calc(85vh-130px)] overflow-y-auto">
          {/* Success Banner */}
          {saveSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-sm animate-in fade-in duration-150">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold">Profil Berhasil Diperbarui!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Perubahan nama, NIDN, dan kontak otomatis tersinkronisasi ke jadwal mengajar dan berkas PDF resmi.
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

          {/* Profile Card & Avatar Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Hidden File Input for JPG Upload */}
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
                className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border-2 border-white shadow-md cursor-pointer group-hover:ring-2 group-hover:ring-blue-400 transition"
                onClick={() => fileInputRef.current?.click()}
                title="Klik untuk unggah foto JPG baru (Maksimal 10 MB)"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition cursor-pointer"
                title="Unggah Foto JPG (Maksimal 10 MB)"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  Dosen Pengampu
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {academicRank || 'Lektor'}
                </span>
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-1 truncate">
                {name || 'Nama Dosen Pengampu'}
              </h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                NIDN: {nidn || 'Belum diatur'} · {prodi}
              </p>

              {/* Upload Action & Format Reminder */}
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                  title="Pilih file JPG dari perangkat Anda"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah File JPG</span>
                  <span className="text-[10px] text-blue-100 font-normal">(Maks. 10 MB)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCustomAvatarInput(!showCustomAvatarInput)}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer"
                >
                  {showCustomAvatarInput ? 'Tutup URL' : 'Tautan URL'}
                </button>
              </div>

              {/* Upload Status Feedback */}
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

              {/* Avatar Preset Quick Selector */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                <p className="text-[11px] font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Atau pilih foto preset dosen STMIK:</span>
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  {AVATAR_PRESETS.map((p, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => {
                        setAvatarUrl(p.url);
                        setUploadSuccessInfo('');
                        setUploadError('');
                      }}
                      className={`w-7 h-7 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                        avatarUrl === p.url ? 'border-blue-600 ring-2 ring-blue-300' : 'border-slate-200 hover:border-slate-400'
                      }`}
                      title={p.label}
                    >
                      <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Avatar URL Field */}
              {showCustomAvatarInput && (
                <div className="mt-2.5">
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://contoh-link-foto.com/foto.jpg"
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Form Fields: Grid 2 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nama Lengkap & Gelar */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Lengkap & Gelar Akademik <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Ammar Fauzan, S.Pd., M.Kom."
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden font-medium text-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Nama ini akan dicetak resmi pada kop tanda tangan berkas PDF Rekapitulasi Presensi & Log Aktivitas Mengajar.
              </p>
            </div>

            {/* NIDN / NIP */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NIDN / NIP <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nidn}
                onChange={(e) => setNidn(e.target.value)}
                placeholder="Contoh: 198711102013011010"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden font-mono text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Nomor identitas dosen resmi di STMIK PGRI Kebumen.
              </p>
            </div>

            {/* Program Studi Homebase */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Program Studi Homebase
              </label>
              <select
                value={prodi}
                onChange={(e) => setProdi(e.target.value as ProgramStudi)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white text-slate-900"
              >
                <option value="Teknologi Informasi">Teknologi Informasi (S1)</option>
                <option value="Manajemen Informatika">Manajemen Informatika (D3)</option>
              </select>
            </div>

            {/* Jabatan Fungsional */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jabatan Fungsional Akademik
              </label>
              <select
                value={academicRank}
                onChange={(e) => setAcademicRank(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white text-slate-900"
              >
                <option value="Tenaga Pengajar">Tenaga Pengajar</option>
                <option value="Asisten Ahli">Asisten Ahli</option>
                <option value="Lektor">Lektor</option>
                <option value="Lektor Kepala">Lektor Kepala</option>
                <option value="Guru Besar / Profesor">Guru Besar / Profesor</option>
              </select>
            </div>

            {/* Status / Jabatan Struktural */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status / Tugas Tambahan
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Dosen Tetap / Dosen Wali"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden text-slate-900"
              />
            </div>

            {/* Email Resmi */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Kampus / Korespondensi
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dosen@stmik-arungbinang.ac.id"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden text-slate-900"
                />
              </div>
            </div>

            {/* Nomor HP / WA */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                No. Handphone / WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden text-slate-900"
              />
            </div>

            {/* Ruang Kerja / Kantor */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ruang Kerja / Kantor Dosen
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={officeRoom}
                  onChange={(e) => setOfficeRoom(e.target.value)}
                  placeholder="Contoh: Gedung A Lantai 2 R. Dosen 204"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Pratinjau Tanda Tangan PDF Resmi */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-blue-600" />
                <span>Pratinjau Tanda Tangan Dokumen PDF Resmi</span>
              </span>
              <span className="text-[10px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-sm">
                Otomatis dihitung +3mm di bawah tabel
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 text-right max-w-sm ml-auto">
              <p className="text-xs text-slate-700">Kebumen, {todayFormatted}</p>
              <p className="text-xs text-slate-600 mt-0.5">Dosen Pengampu Mata Kuliah,</p>

              <div className="my-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-mono text-slate-500">
                <Shield className="w-3 h-3 text-blue-600" />
                <span>TERVERIFIKASI SISTEM AKADEMIK</span>
              </div>

              <p className="text-xs font-bold text-slate-900 underline underline-offset-2">
                {name || 'Nama Lengkap Dosen'}
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                NIDN. {nidn || '-----------------'}
              </p>
            </div>
          </div>

          {/* Penugasan Mengajar Semester Ini */}
          {mySchedules.length > 0 && (
            <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Mata Kuliah Diampu Semester Ini ({mySchedules.length} Kelas)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mySchedules.map((sch) => (
                  <div key={sch.id} className="text-xs bg-white border border-slate-200 rounded-lg p-2.5">
                    <div className="font-semibold text-slate-900">{sch.courseName}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5 flex items-center justify-between">
                      <span>{sch.courseCode} · Rombel {sch.rombel}</span>
                      <span className="font-mono text-slate-600">{sch.day}, {sch.startTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Perubahan Profil</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
