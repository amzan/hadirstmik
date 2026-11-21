# Hasil implementasi lokal P0/P1

Pembaruan 20 November 2026: sumber privat terbaru memiliki 644 presensi. Rekonstruksi relasi dan batas histori terbaru ada di [LEGACY_RECONCILIATION_REPORT.md](LEGACY_RECONCILIATION_REPORT.md). Angka 643 dan blocker audit di bawah adalah baseline 19 November, bukan status sumber terbaru.

19 November 2026. Status: implementasi inti dan pengujian lokal lulus; penerimaan menyeluruh serta cutover data nyata masih terhalang rekonsiliasi legacy dan kebijakan reset/restore. Tidak ada perubahan produksi, SSH, deploy, push, edit `.env`, atau impor data pengguna.

## Temuan dan hasil

| Prioritas | Hasil lokal | Sisa tindakan |
| --- | --- | --- |
| P0 data pribadi publik/bundle | Tiga JSON publik, master JSON, raw backup dan script seed dipindahkan privat; seed nyata tidak lagi dibundle. Gate source/artifact lulus. | Git history, release lama, CDN dan hosting aktif belum diperiksa/dibersihkan. Rotasi credential yang pernah terekspos memerlukan operator. |
| P0 autentikasi/OTP klien | Login, role, sesi, OTP dan password diverifikasi Express/MariaDB. Cookie opaque HttpOnly, SameSite, Secure production, digest DB, CSRF/origin, rate limit, expiry/attempt/single-use. | Email provider nyata, pengiriman mailbox dan konfigurasi proxy/cookie hosting belum diuji. |
| P1 reseed/localStorage | Context/App tidak menulis ulang penyimpanan lama; tidak ada fallback lokal ketika API gagal. Browser membuktikan seed lama dan snapshot tetap tersimpan. | Migrasi isi browser yang berbeda antarperangkat perlu ekstraksi dan rekonsiliasi eksplisit. |
| P1 data/relasi | API utama, transaksi akun-mahasiswa-rombel-jadwal, pagination, versi, arsip lunak, roster sesi dan constraint tambahan. | Seluruh drift/orphan pada skema hosting harus dipreflight; belum ada akses produksi. |
| P1 QR/presensi/izin | Token crypto utuh, expiry/waktu/aktor/roster server, lock sesi, unique presensi, audit, manual batch atomik dan izin sesi/tanggal tepat. | Kamera fisik, pencetakan QR dan skenario pengguna kampus nyata belum diuji. |
| P1 backup/import | JSON bervalidasi, dry-run, preview konflik DB, apply atomik/idempotent, bukti privat, round-trip ke database terpisah. Excel melakukan pembaruan berversi dan snapshot AES-GCM sebelum edit. | Overwrite restore konflik dan reset seed nyata sengaja ditolak. Kebijakan retensi/target pemulihan diperlukan; bukan implementasi fitur reset yang sudah selesai. |
| P1 runtime | Build frontend/backend, `app.cjs`, staging Basic Auth, cron sekali jalan, prosedur SSH/rollback. | Passenger/CloudLinux dan hak akun hosting belum dibuktikan. |
| P1 dependensi Excel | `xlsx` registry 0.18.5 memiliki advisory high. Diperbarui ke tarball resmi 0.20.3 dengan integrity lockfile dan tes parser. `npm audit` akhir melaporkan nol advisory. | Audit adalah snapshot registry, bukan jaminan bebas kerentanan. |

SheetJS menerbitkan rilis terbaru melalui CDN resmi; registry lama tidak menyediakan pembaruan tersebut. Referensi: [instalasi resmi SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). Tidak ada framework/ORM/dependensi fungsional baru yang ditambahkan.

## Perubahan utama

- `backend/{app,security,database,auth,domain,proofs,admin,bulk,importer,migrate,mail,close-expired}.mjs`: otoritas backend dan batas data privat.
- Migrasi 007: akun mahasiswa, active/version, override enrollment, roster sesi, challenge/limit OTP, ledger impor dan snapshot. Migrasi 008: bukti BLOB privat. Migrasi 009: FK dosen/mata kuliah, interval waktu dan unique sesi/izin. Baseline 001-006 dipertahankan.
- `AttendanceContext.tsx`, portal login, OTP/profil dan formulir domain: API async, polling/fokus, penghentian sesi dan notifikasi error. Navigasi/desain dipertahankan; header ponsel membungkus agar tombol keluar tetap terlihat.
- `databaseBackupService`, `serverBackup`, `legacyStorage`, gate privasi dan CI: backup server, pembacaan legacy tanpa reseed, pencegahan bundle pribadi dan integrasi MariaDB pada workflow CI.
- `AGENTS.md`, `IMPLEMENTATION_PLAN.md`, `OPERATIONS.md`: peta aktual, kontrak/status dan prosedur operator. Bagian audit lama di rencana ditandai sebagai baseline historis.

## Bukti pengujian

Eksekusi pada Node.js 24.11.1, MariaDB portable 11.4.5 loopback port 33079, database acak sintetis `_test`, Edge profil baru. Test database acak dibuang oleh runner setelah selesai; sumber data nyata tidak diimpor.

| Pemeriksaan | Hasil |
| --- | --- |
| TypeScript `npm run lint` | PASS; ini typecheck, bukan ESLint. |
| Unit/security/privacy/academic/Excel/staging | 20 PASS, 0 FAIL, 0 SKIP. |
| Integrasi MariaDB/HTTP | 24 PASS, 0 FAIL, 0 SKIP. |
| Browser | 4 subalur PASS; Node melaporkan 5 PASS termasuk suite induk, 0 FAIL/SKIP. |
| Build frontend/backend | PASS pada Node 24. |
| Gate sumber dan artefak privat | PASS. Pencocokan marker email/telepon/password terhadap backup privat dilakukan hanya dalam memori, tidak dicetak. |
| Startup compiled `app.cjs` | PASS untuk readiness database, SPA `/` dan `/portaladmin`; bukan bukti Passenger. |
| `npm audit`, termasuk development | 0 advisory pada pemeriksaan akhir. |

Integrasi mencakup tiga role, CSRF, scope, optimistic version, CRUD/arsip/pulihkan, relasi rollback, session idempotency, QR prefix/expiry/scan paralel, scan versus close paralel, persetujuan izin tepat, proof access, audit/manual batch rollback, sesi perangkat, OTP salah/expired/attempt exhaustion/replay/concurrent confirm/purpose ownership, enumeration response, backup round-trip dan checksum ledger.

Browser mencakup login mahasiswa/reload/preservasi localStorage lama, role palsu, portal admin, login dosen dan viewport 1366/768/390 tanpa horizontal overflow. Screenshot ponsel ditinjau. Browser belum mencakup setiap modal, alur email, ekspor PDF, kamera dan kegagalan jaringan; nama suite tidak memperluas cakupan bukti tersebut. Screenshot `.cache/browser` hanya fixture sintetis.

Vite masih memperingatkan chunk utama sekitar 2.20 MB sebelum gzip. Optimasi bundle terpisah dari keamanan/integritas; warning tidak disembunyikan. Workflow CI diperbarui, belum dijalankan di GitHub karena tidak ada push.

## Integritas sumber dan blocker data nyata

Tujuh file tracked yang dikeluarkan dari lokasi lama memiliki salinan di `private/legacy` dengan isi identik terhadap Git setelah normalisasi CRLF/LF. Hash byte terhadap Git berbeda karena checkout Windows memakai CRLF; tidak ada perbedaan isi. Source asli komponen/context/server yang diubah juga dicadangkan privat. Folder privat tetap diperlukan operator dan tidak boleh ikut release.

Dry-run read-only terhadap tiga backup asli menghasilkan 78 akun, 66 mahasiswa, 29 mata kuliah dan 34 jadwal per backup, tetapi tidak memiliki rombel. Backup terbaru memiliki 30 sesi, 643 presensi dan 3 izin. Import ditolak karena:

- 66 mahasiswa memerlukan pemetaan rombel.
- 18 mahasiswa memiliki override jadwal yang tidak dapat direkonsiliasi dari referensi yang tersedia.
- 34 jadwal memerlukan pemetaan rombel-jadwal.
- 30 sesi pada backup terbaru memerlukan roster historis yang berwenang.
- 3 izin memerlukan sesi/pertemuan tepat.

Tidak ada pemetaan yang ditebak, sumber yang dihapus, atau data pengguna yang ditimpa. Pemulihan penuh ke database aktif dan reset default belum memenuhi acceptance fitur; pembatasan ini mencegah kerusakan data, tetapi tetap pekerjaan tersisa.

## Langkah berikut yang paling tepat

Rekonsiliasi rombel, roster historis, override dan sesi izin dari sumber akademik yang disetujui. Tetapkan kebijakan reset/restore konflik dan akun awal. Setelah itu, ulangi dry-run serta round-trip pada database terpisah sebelum staging privat mengikuti `OPERATIONS.md`. Produksi memerlukan approval tindakan tersendiri.
