# Pengembangan, migrasi, deployment dan rollback

Prosedur operator, belum dieksekusi pada hosting. Tidak ada akses SSH, data nyata, atau produksi selama implementasi lokal.

## Environment

Tidak ada pembacaan `.env` otomatis. Atur environment melalui shell/panel, tanpa nilainya di Git/log.

| Variable | Kebutuhan |
| --- | --- |
| `NODE_ENV` | `production` di staging/hosting. Development hanya loopback `_dev`/`_test`. |
| `PORT` | Port Passenger/panel; development default 3000. |
| `APP_ORIGIN` | Origin tepat tanpa slash akhir; HTTPS wajib production. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Target yang disetujui, akun aplikasi dengan privilege minimum. |
| `AUTH_SECRET` | Rahasia acak minimal 32 karakter, stabil antarproses. Rotasi mencabut sesi/challenge. |
| `BACKUP_SECRET` | Kunci terpisah minimal 32 karakter untuk AES-GCM. Simpan escrow privat; kehilangan kunci berarti snapshot tidak terbaca. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | OTP dari domain pengirim terverifikasi; tanpa transport, gagal tertutup. |
| `TRUST_PROXY` | Hanya `loopback` jika topologi Passenger benar-benar memakai proxy loopback. Default false. |
| `STAGING` | `1` mengaktifkan Basic Auth sebelum aset dan API. |
| `STAGING_USERNAME`, `STAGING_PASSWORD_HASH` | Username staging dan SHA-256 password acak kuat; jangan gunakan password akun kampus. |

Frontend memakai `/api/v1` pada origin yang sama. Jangan menyediakan secret melalui prefix `VITE_`.

## Lokal dan pengujian

1. Node.js 24, MariaDB 11.4 loopback. Siapkan database kosong berakhiran `_dev`/`_test` dan akun lokal.
2. `npm ci --ignore-scripts --no-audit --no-fund` dari lockfile.
3. Set environment lokal, lalu `npm run db:migrate:local`. Runner memerlukan flag lokal, advisory lock dan checksum ledger.
4. `npm run dev`, gunakan profil browser baru. Aplikasi tidak menyalin atau menghapus data lama otomatis.
5. `npm run lint`, `npm test`, `npm run build`.
6. Set `HADIR_TEST_DB=1`, `HADIR_TEST_PORT` dan bila perlu `HADIR_TEST_PASSWORD`; `npm run test:integration`. Default port 33079, host 127.0.0.1. Runner memerlukan akun root pada instance test untuk CREATE/DROP database acak. Jangan memakai konfigurasi produksi.
7. Set `HADIR_BROWSER_TEST=1`; `node --test tests/browser/flows.test.mjs`. Runner memakai profil baru dan database sintetis. Screenshot masuk `.cache/browser`, diabaikan Git.

Tes membuat akun sintetis sendiri. Database development biasa tidak diisi akun default atau data kampus. Untuk demo, gunakan fixture sintetis melalui importer dan aktivasi OTP dengan transport sandbox yang disetujui.

## Migrasi JSON dan aktivasi akun

1. Simpan sumber asli read-only di luar document root. Catat hash, pemilik, izin dan jumlah entitas; jangan menyalin record ke laporan.
2. `node backend/importer.mjs PRIVATE_FILE`: dry-run struktur tanpa database, hanya jumlah/hash/entity/index/kode masalah.
3. Rekonsiliasi akun mahasiswa, rombel, roster sesi, referensi putus, duplikasi dan bukti eksternal. Format lama yang kehilangan rombel/roster memerlukan sumber akademik berwenang. Jangan menebak histori dari enrollment sekarang.
4. Uji fixture/sumber yang disetujui pada database kosong lokal; `--apply-local` hanya loopback `_dev`/`_test`. Buktikan hitungan, relasi, round-trip dan idempotensi. Sumber tidak diubah.
5. Admin API: `/admin/imports/preview` memeriksa struktur dan konflik database; `/admin/imports/apply` menerima `sourceHash`. Transaksi memeriksa kembali dan rollback saat konflik. Preview bukan jaminan terhadap perubahan konkuren.
6. Konflik record ditolak tanpa overwrite. Untuk pemulihan penuh, restore ke database kosong terpisah, bandingkan, rekonsiliasi lalu cutover setelah approval. Untuk edit terkontrol, CRUD berversi atau impor Excel; Excel membuat snapshot terenkripsi dalam transaksi yang sama.
7. Password plaintext lama tidak diimpor. Pengguna mengaktifkan akses lewat OTP email terdaftar yang telah diverifikasi operator. Akun admin awal berasal dari sumber privat yang disetujui; jangan memakai password demo pada hosting.
8. QR dan sesi autentikasi lama tidak dipulihkan; sesi kuliah hasil impor tertutup. Bukti BLOB tetap privat. Backup domain bukan pengganti backup SQL lengkap.

`legacyStorage.mjs` hanya membaca. Data browser antarperangkat yang bertentangan memerlukan rekonsiliasi manual. Reset ke seed nyata diblokir; jangan menghapus data untuk menyamakan versi.

## Deployment IDwebhost via SSH setelah approval terpisah

1. Verifikasi paket Node.js 24, MariaDB 11.4, Passenger, SSH, cron pengguna, app root, document root dan executable panel. Semua ini belum dibuktikan pada hosting.
2. Siapkan staging HTTPS dengan Basic Auth, database dan secret terpisah.
3. Dari checkout yang ditinjau, lint/unit/integrasi/build/gate privasi wajib lulus. Buat manifest hash. Upload release lewat SSH/SFTP ke luar document root: `app.cjs`, `server.mjs`, `dist/`, package/lockfile, `backend/` dan `shared/` untuk migrasi/cron/importer. Jangan upload `.git`, `.env`, `private`, `.cache`, test-results atau backup sumber.
4. Di release: `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` melalui Node/npm panel. Backend telah dibundle; dev dependencies tidak diperlukan saat runtime. Jangan memakai permission world-writable.
5. Sebelum schema berubah: maintenance window, hentikan penulisan, backup SQL lengkap lewat credential privat operator, checksum, lalu buktikan restore ke database terpisah. Snapshot aplikasi tidak memuat credential/audit/sesi autentikasi.
6. Inspeksi `information_schema`, ledger/checksum tujuan, orphan FK, duplikasi, collision dan relasi mahasiswa. Runner belum memvalidasi seluruh drift skema. Bila berbeda, hentikan dan buat migrasi rekonsiliasi tambahan; jangan mengedit 001-006.
7. Setelah approval target dan backup, panggil library `migrate(pool)` melalui entrypoint operator yang ditinjau dengan environment production tepat. CLI repo sengaja hanya lokal; jangan memalsukan host/nama untuk melewati guard. DDL MariaDB implicit commit: kegagalan dapat meninggalkan DDL parsial. Ledger dicatat setelah seluruh file sukses; inspeksi sebelum retry tetap wajib.
8. Atur Node app root ke release, startup `app.cjs`, environment production dan origin HTTPS. Passenger harus menyuntikkan port/menangkap listen sesuai panel. Validasi di staging; jangan menjalankan Vite development pada hosting.
9. Restart lewat panel Passenger atau `touch tmp/restart.txt` hanya bila setup hosting mendukungnya.
10. Cron pengguna: `node backend/close-expired.mjs` tiap menit, environment privat sama. Proses sekali jalan, hingga 100 sesi per run; pantau backlog/exit code tanpa mencatat data pribadi.
11. Smoke staging: health/ready, tiga role, cookie Secure/HttpOnly/SameSite, CSRF, OTP sandbox, revokasi lintasperangkat, CRUD sintetis, QR expiry/replay, izin sesi tepat, backup round-trip, `/portaladmin`, dan URL JSON lama. Periksa cache/CDN/arsip release lama.
12. Cutover produksi setelah review staging dan rekonsiliasi. Setelah cutover, smoke read-only dan pantau error/pool/OTP/cron. Tidak ada impor ulang otomatis.

## Rollback dan paparan historis

- Sebelum cutover gagal: release lama tetap aktif; sumber/database staging dipertahankan.
- Setelah cutover gagal: hentikan penulisan, simpan SQL/data delta. Kembalikan release hanya jika kompatibel dengan schema tambahan. Rilis lama yang melakukan reseed browser bukan rollback aman.
- Rollback data: restore SQL lengkap ke database baru, validasi integritas/credential/audit, lalu ubah target setelah approval. Jangan DROP/TRUNCATE database aktif atau memakai down migration destruktif.
- Snapshot pra-Excel menyimpan kondisi sebelum perubahan; restore konflik perlu rekonsiliasi.
- Git dan artefak lama mungkin memuat password/data pribadi. Rotasi credential terdampak, cabut sesi, purge cache/artefak lewat prosedur privat. Rewrite histori adalah keputusan pemilik repository, tidak dilakukan otomatis.
