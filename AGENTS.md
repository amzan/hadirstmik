# Hadir STMIK

## Peta proyek

- React/Vite/Tailwind: `src/components`, `src/types/attendance.ts`, aturan akademik murni `src/data/initialData.ts`.
- `src/context/AttendanceContext.tsx`: API, sinkronisasi 15 detik/fokus, operasi async. Tunggu mutasi sebelum menutup form atau menyatakan sukses.
- Express: `server.ts`, build `server.mjs`, startup Passenger `app.cjs`. `backend/app.mjs` merangkai auth, domain, administrasi dan bukti privat.
- `backend/database.mjs`: pool/transaksi; `auth.mjs`: cookie/CSRF/OTP; `domain.mjs`: CRUD/roster/QR/izin; `importer.mjs`: JSON; `bulk.mjs`: Excel; `admin.mjs`: snapshot AES-GCM.
- `shared/academic-relations.mjs`: hanya alias terkonfirmasi `TI 1` menjadi `TI 1A`; rombel lain tidak memperoleh alias otomatis. `backend/reconciliation.mjs` dan `scripts/reconcile-legacy.mjs` membuat analisis read-only; hasil PARTIAL bukan izin impor. Bukti/status: `docs/LEGACY_RECONCILIATION_REPORT.md`.
- Review EXCLUDE: `backend/legacy-excludes.mjs`, panel `LegacyExcludeReview`, migrasi 010. Hanya admin memutuskan CONTINUE/ARCHIVE/DEFER dengan preview dan ledger; jangan otomatis meneruskan EXCLUDE. Roster legacy tertutup diterima dari record sumber atas keputusan pemilik. Izin independen memakai `leave_recipients` (011); approval/rejection tidak menulis attendance. Aturan terbaru: `docs/LEGACY_EXCLUDE_REVIEW_REPORT.md`.
- Migrasi 001-006 baseline; 007-009 menambah relasi, keamanan, bukti dan constraint. Jangan mengedit migrasi yang sudah diterapkan.
- Status: `docs/IMPLEMENTATION_PLAN.md`; operasional: `docs/OPERATIONS.md`; bukti/batas: `docs/IMPLEMENTATION_REPORT.md`.

## Batas keselamatan

- Jangan mengakses produksi/SSH, menjalankan migrasi server, impor data nyata, mengubah `.env`, deploy atau push tanpa otorisasi eksplisit untuk tindakan tersebut.
- Jangan mencetak credential, isi backup atau record pribadi. Laporkan field/jumlah/kode konflik saja.
- `private/legacy` menyimpan sumber asli di luar build dan diabaikan Git. Jangan hapus, upload atau jadikan fixture. Jangan rewrite histori otomatis.
- Pertahankan localStorage/snapshot lama. Tidak ada reseed atau fallback menulis browser saat API gagal.
- Pengujian hanya loopback, database disposable `_test`; development `_dev`. Jangan memuat `.env` otomatis.
- Reset seed nyata dan restore yang menimpa konflik belum diizinkan. Jangan menggantinya dengan penghapusan diam-diam.

## Aturan perubahan

- Cari simbol/pemanggil dengan `rg`; baca bagian relevan. Delegasikan investigasi/review independen jika agen memiliki alat; jangan menduplikasi pekerjaan.
- Pertahankan desain, label navigasi, route `/portaladmin`, fitur akademik dan histori presensi.
- Reuse helper/dependensi. Tidak perlu framework/ORM baru.
- Role, identitas mahasiswa, waktu, roster dan token adalah otoritas backend. DTO memakai allowlist.
- Query berparameter; operasi terkait satu transaksi; versi record untuk edit; kunci sesi untuk QR/tutup/review; audit perubahan presensi.
- Backup domain tidak membawa password/hash, OTP atau token perangkat. Restore tidak mengaktifkan sesi/QR lama.
- Kegagalan harus mempertahankan input dan tampil ke pengguna. Jangan memakai hasil simulasi.

## Verifikasi

- Node.js 24 dan MariaDB 11.4. Windows: gunakan `npm.cmd` bila `npm.ps1` diblokir.
- `npm ci --ignore-scripts --no-audit --no-fund`; `npm run lint` adalah typecheck, bukan ESLint.
- `npm test`; set `HADIR_TEST_DB=1`, `HADIR_TEST_PORT`, lalu `npm run test:integration` pada instance sintetis lokal.
- `npm run build`: gate sumber privat, build frontend/backend, gate artefak. Jangan melewati gate privasi.
- Browser: `HADIR_BROWSER_TEST=1`, `HADIR_TEST_PORT`, `node --test tests/browser/flows.test.mjs`; Edge terpasang atau `HADIR_BROWSER_PATH` ke Chrome/Edge.
- Fixture hanya `tests/fixtures.mjs`. Tes lokal tidak membuktikan provider email, kamera fisik, Passenger atau produksi.
- Laporkan PASS/FAIL/SKIP dan batas bukti. Jalankan pemeriksaan relevan tanpa perluasan pekerjaan yang tidak diminta.

## Komunikasi

- Bahasa Indonesia jelas dan ringkas. `remove-ai-marks` best effort jika layanan tersedia; jangan mengklaim pembersihan tanpa hasil layanan.

- Migrasi 012: arsip legacy tanpa penerima hanya admin/pemilik, immutable; pengajuan baru tetap wajib penerima. Provenance arsip wajib dipertahankan saat backup/import.
