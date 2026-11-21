# Rencana Implementasi Hadir STMIK

Tanggal audit dan implementasi lokal: 19 November 2026, Asia/Jakarta.

## Status implementasi terbaru

Implementasi lokal kini memakai Express + MariaDB, autentikasi cookie server, OTP, roster sesi, QR, administrasi backup, importer dan integrasi React. Bagian 1 dan seterusnya di bawah mempertahankan baseline audit serta rancangan sebagai catatan historis; deskripsi "saat ini", nomor baris lama, dan hambatan instalasi di bagian tersebut merujuk kondisi sebelum implementasi. Untuk kondisi yang berlaku gunakan tabel berikut, [laporan validasi](IMPLEMENTATION_REPORT.md) dan [runbook](OPERATIONS.md).

| Fase | Implementasi dan gate |
| --- | --- |
| P0 sumber publik | Data asli dipertahankan di private/legacy; tidak diimpor frontend. Gate sumber dan artefak wajib pada build/CI. Paparan historis belum ditangani pada hosting/Git. |
| P1 penyimpanan | Context memakai API, polling 15 detik/fokus; tidak menulis ulang localStorage. Data browser lama tetap utuh. Tidak ada import otomatis. |
| Skema | 001-006 dipertahankan; 007 relasi/keamanan/roster/versi/OTP/snapshot, 008 bukti BLOB privat, 009 FK/check/unique. Ledger checksum/advisory lock. |
| Auth | Scrypt bersalt; cookie opaque dengan digest DB, HttpOnly/SameSite/Secure production; CSRF/origin; timeout idle/absolut; OTP hash keyed, expiry/attempt/rate/single-use. |
| Domain | CRUD berparameter, pagination, versi, soft archive, transaksi relasi akun-mahasiswa-rombel-jadwal, roster snapshot, lock sesi, audit status. |
| Integrasi | Login tiga role, profil/OTP, formulir async, QR/izin/manual, snapshot/server backup, Excel transaksional dengan snapshot pra-edit. |
| JSON | Dry-run struktur dan preview konflik DB; apply atomik/idempotent; password dibuang; QR/sesi lama tidak diaktifkan. Konflik overwrite ditolak. |
| Operasional | Build terpisah dist/server.mjs dan startup app.cjs; staging Basic Auth; cron sekali jalan; runbook SSH/backup/rollback. Passenger nyata belum diuji. |

Batas penerimaan yang belum terpenuhi penuh: reset ke seed nyata tidak dijalankan; restore konflik memerlukan rekonsiliasi; sumber legacy yang kehilangan rombel/roster memerlukan data akademik berwenang. Jangan menyatakan seluruh fitur/data produksi siap hanya berdasarkan tes lokal.

Kontrak tambahan: semua respons sukses memakai data, daftar memakai meta halaman; error berisi code/message/requestId tanpa SQL. PATCH akademik membawa version. Bulk /api/v1/admin/bulk/preview dan /apply membawa data lalu sourceHash; snapshot pra-edit dan mutasi terjadi satu transaksi. JSON /admin/imports/preview dan /apply menolak konflik. Proof upload maksimal 2 MB PDF/PNG/JPEG, download hanya pemilik/reviewer/admin. Snapshot/export hanya admin dengan login terbaru maksimal 15 menit. Backup mengecualikan credential, OTP, dan sesi autentikasi.


## 1. Ruang lingkup dan dasar bukti

Tujuan: mempertahankan fitur dan desain React sambil memindahkan otoritas data, autentikasi, dan presensi ke Express + MariaDB. Tidak ada akses SSH, perubahan database, migrasi server, impor data pengguna, deployment, atau push pada audit ini. `.env` dan nilai kredensial tidak dibaca untuk audit.

Baseline memiliki perubahan pengguna: `package.json` termodifikasi; `app.cjs`, `backend/`, dan `package-lock.json` belum dilacak Git. Perubahan tersebut dipertahankan. Sinkronisasi terhadap server berasal dari keterangan pengguna; kesetaraan source dan skema server belum diverifikasi.

Inspeksi meliputi seluruh enam migrasi lokal, model TypeScript, entrypoint server, konfigurasi build/deployment, operasi context, jalur login/reset, layanan backup/perangkat, serta struktur JSON. Nilai record pribadi tidak disalin ke laporan. Pemeriksaan relasi JSON membaca data dalam memori dan hanya melaporkan jumlah pelanggaran.

## 2. Arsitektur dan alur data saat ini

| Bagian | Implementasi dan alur |
| --- | --- |
| UI | `src/main.tsx` memasang `App`; `AttendanceProvider` menyediakan state ke dashboard BAAK, dosen, mahasiswa, portal login, modal, dan laporan. `App.tsx` mengelola route berdasarkan pathname/hash, termasuk `/portaladmin`. |
| Penyimpanan domain | `AttendanceContext.tsx` memuat `INITIAL_*`, membaca JSON localStorage, memperbarui array React, lalu menyimpan kembali seluruh array. Tidak ada sinkronisasi database lintas perangkat. |
| localStorage domain | `stmik_users_v1`, `stmik_students_v1`, `stmik_courses_v1`, `stmik_schedules_v1`, `stmik_rombels_v1`, `stmik_sessions_v1`, `stmik_records_v1`, `stmik_leave_v1`, versi seed dan snapshot. |
| localStorage autentikasi | `SESSION_KEYS` menyimpan flag login, objek pengguna, ID, waktu aktivitas, role/username terakhir; `deviceSessionService.ts` menyimpan fingerprint, token, dan daftar sesi lokal. |
| JSON | Tiga backup di `public/assets/aistudio`; master di `src/data/master_database_backup.json`; sumber lama di `scripts/raw_backup.json`. `initialData.ts` berisi seed nyata yang ikut diimpor aplikasi, bukan sekadar fixture development. |
| Backup dan Excel | `databaseBackupService.ts` membuat JSON/Excel/snapshot; `excelBulkService.ts` menangani impor massal; `pdfGenerator.ts` dan `excelGenerator.ts` menangani laporan. Restore mengubah array dan localStorage. |
| API frontend | Pencarian `fetch` menemukan tiga panggilan di `src/utils/resendService.ts`: kirim email, uji email, kirim kode reset. CRUD akademik dan presensi belum memakai API. |
| Backend | `server.ts` menjalankan tiga endpoint email, Vite middleware saat development, dan static `dist` + SPA fallback saat production. `api/*.ts` menduplikasi handler email untuk Vercel. |
| Database | `backend/db.ts` membuat pool mysql2; belum ada route domain yang menggunakannya, migrator, ledger migrasi, atau repository database. Enam SQL membuat 15 tabel. |
| Runtime | `npm run dev` memakai tsx; `npm start` memakai `node server.ts`; `app.cjs` mencoba mengimpor `server.mjs` yang belum ada dan belum dihasilkan build. |

Dependensi utama: React 19, Express 4, Vite 8, Tailwind 4, TypeScript 7, mysql2, Resend, html5-qrcode, qrcode, XLSX, jsPDF, motion, lucide-react. GenAI tercantum dalam package tetapi tidak menjadi kebutuhan arsitektur target. Audit ini tidak menyatakan dependensi aman dari CVE; audit advisory belum dijalankan.

Fitur yang menjadi baseline regresi: login tiga role, logout dan timeout; profil dan ganti/reset password; perangkat aktif/revokasi; mahasiswa dan multi-rombel; mata kuliah/jadwal, tanggal pertemuan, arsip/pulihkan dan pengelolaan relasi; pengecualian/tambahan jadwal dan perhitungan SKS; buka/tutup/buka ulang sesi, QR statis/dinamis, presensi manual/massal, penandaan ALPHA otomatis; izin/sakit dan bukti; monitoring, sinkronisasi, laporan PDF/Excel; backup, snapshot, restore dan impor Excel. Kemampuan reset/penghapusan tetap memerlukan padanan aman dengan otorisasi dan perlindungan histori.

## 3. Temuan menurut prioritas

| Prioritas | Bukti lokal | Dampak dan keputusan |
| --- | --- | --- |
| P0 | Tiga JSON pada `public/assets/aistudio` dilacak Git; masing-masing memiliki 78 pengguna, 66 mahasiswa, email/telepon, serta field password terisi pada 2 pengguna dan 1 mahasiswa. | Berpotensi tersedia tanpa login setelah build. Jangan tampilkan nilainya. Blokir artefak publik, isolasi salinan privat, dan rencanakan reset kredensial yang terdampak; keberadaan file pada hosting aktif belum diuji. |
| P0 | `initialData.ts:205` dan seterusnya berisi data nyata; context dan layanan backup mengimpor seed. | Menghapus JSON dari folder publik saja tidak cukup: data dapat tetap masuk bundle JS. Audit sumber, bundle, source map, arsip release, dan cache sebagai gate terpisah. |
| P0 | `HomePage.tsx:122`, `StudentLoginPortal.tsx:62`, `UnifiedLoginPortal.tsx:122`, `App.tsx:235`; autentikasi dan password diperiksa/disimpan browser. | Flag/role/data browser dapat dimanipulasi. Pindahkan verifikasi password, sesi, dan otorisasi ke server; hentikan password bawaan bersama. |
| P0 | `ForgotPasswordModal.tsx:137,224,292`, `ChangePasswordOtpSection.tsx:88,231`; OTP dibuat/diverifikasi klien. `server.ts:92` dan padanan Vercel menerima kode dari klien dan memiliki fallback simulasi. | Reset bukan bukti kepemilikan akun. Server harus menerbitkan dan memverifikasi challenge, membatasi percobaan, serta gagal tertutup tanpa membocorkan kode. |
| P1 | `AttendanceContext.tsx:252-278` mengganti semua array ketika versi seed berubah; `2647` memakai `localStorage.clear()`. | Pembukaan aplikasi dapat menimpa data browser. Jangan menjalankan aplikasi pada profil pengguna; hilangkan reseed otomatis pada fase keselamatan. |
| P1 | `AttendanceContext.tsx:986-1119` menerima kecocokan prefix QR dan tidak memeriksa `qrExpiresAt`; token dibuat melalui Math.random. | QR kedaluwarsa atau suffix palsu dapat diterima secara lokal. Validasi token utuh, masa berlaku, roster, aktor, dan waktu harus dilakukan server. |
| P1 | `AttendanceContext.tsx:1238` memilih sesi untuk persetujuan izin melalui mata kuliah/rombel tanpa tanggal. | Izin dapat diterapkan ke pertemuan salah. Kontrak target harus membawa identitas sesi atau menolak pencocokan ambigu. |
| P1 | `databaseBackupService.ts:139-171,495-523` tidak memasukkan rombels/deviceSessions ke hasil; normalisasi `380-436` juga kehilangan relasi tersebut. | Backup yang terlihat lengkap tidak menjamin pemulihan relasi. Buat format berversi dengan uji round-trip; sesi autentikasi tidak boleh dipulihkan. |
| P1 | Restore `AttendanceContext.tsx:2818-2883` melanjutkan meski snapshot gagal; penulisan lokal bertahap. | Restore dapat parsial. Ganti dengan preview tervalidasi, backup terverifikasi dan transaksi server; jangan menjalankan restore pada audit. |
| P1 | `databaseBackupService.ts:30` dan jalur bulk/restore memaksakan perubahan mata kuliah tertentu. | Transformasi data tersembunyi dapat mengubah histori. Dokumentasikan aturan lama sebagai kasus regresi; jangan terapkan koreksi nama/jadwal otomatis saat migrasi. |
| P1 | `server.ts:24,65`, `api/send-email.ts:6`, `api/test-resend.ts:6` tidak memiliki auth/rate limit; endpoint uji mengirim email. | Risiko penyalahgunaan layanan dan kuota. Jangan memanggil endpoint saat audit. Tutup endpoint uji di production; batasi template/penerima dan izin email server. |
| P1 | `app.cjs:1`, `package.json` scripts, `vercel.json`, `vite.config.ts`. | Jalur Vercel dan Express berbeda; build belum menghasilkan server.mjs. SPA fallback dapat menyamarkan API tidak dikenal menjadi HTML 200. Tetapkan satu runtime production dan API 404 JSON. |
| P2 | `deviceSessionService.ts:74,165` memakai IP simulasi dan token lokal. | Daftar perangkat bukan kontrol keamanan lintas perangkat. Gunakan tabel 006; IP terpercaya berasal dari konfigurasi proxy terverifikasi, bukan request bebas. |

P0 berarti penghambat publikasi berikutnya, bukan bukti eksploitasi server aktif. Penanganan hosting, riwayat Git, atau reset akun nyata membutuhkan tugas terpisah yang diizinkan.

Pemeriksaan otomatis read-only atas master lokal terbaru: 78 users, 66 students, 29 courses, 34 schedules, 30 sessions, 643 records, 3 leaveRequests. Tidak ditemukan duplikat ID pengguna/record/NIM, username case-insensitive, pasangan session/student, orphan record/student/session, orphan session/schedule, orphan leave/student, atau referensi schedule/course/lecturer. Nomor pertemuan berada dalam 1-16. Ini bukan validasi seluruh backup, seluruh kolom, atau produksi. Master tidak memiliki array rombels dan deviceSessions; jangan menganggap relasi itu kosong di sumber lain.

## 4. Kesesuaian TypeScript dengan migrasi 001-006

| Migrasi / model | Sesuai | Gap dan pemetaan target |
| --- | --- | --- |
| 001 / User | ID, username, nama, role tiga nilai, kontak, profil dosen. | camelCase menjadi snake_case. `password` tidak masuk DTO: hanya `user_credentials.password_hash`. Reset memakai token_hash, expiry, attempts dan used_at. `User.rombel/rombels`, custom/excluded schedule tidak ada di users dan harus diturunkan dari relasi mahasiswa. Email hanya berindeks, bukan unik: reset berdasarkan email saja harus menolak ambigu tanpa membocorkan akun. |
| 002 / Student, Rombel | PK nim; rombel, semester, prodi, arsip; student_rombels untuk multi-rombel. | Student belum terkait users secara FK. Tambahkan relasi akun unik nullable setelah rekonsiliasi, tanpa mengandalkan prefix ID. Profile ganda harus punya sumber otoritatif: users untuk nama/kontak, students untuk akademik; duplikasi lama diperbarui atomik. Rombel.scheduleIds berasal dari rombel_schedules, bukan kolom array. |
| 003 / Course, ScheduleItem | Metadata, snapshot dosen/mata kuliah, TIME, meeting_dates JSON, arsip, rombel_schedules. | Tidak ada FK ke mata kuliah/dosen. Validasi service dahulu; tambahkan FK hanya setelah rekonsiliasi dan kebijakan histori. Tambahkan student_schedule_overrides untuk INCLUDE/EXCLUDE dengan pasangan nim/schedule unik; EXCLUDE menang sesuai helper lama. MeetingDates wajib key 1-16 dan tanggal valid. |
| 004 / AttendanceSession | scheduleId nullable, nomor 1-16, QR, sesi terbuka, metadata pertemuan. | TS menganggap qrExpiresAt string wajib tetapi DB nullable. DTO target null eksplisit untuk histori tanpa expiry; scan menolak expiry kosong. Snapshot metadata sesi dipertahankan; jangan menulis ulang sesi lama ketika jadwal berubah. Tambahkan roster sesi tersimpan supaya perubahan enrollment tidak mengubah histori. |
| 004 / AttendanceRecord | Empat status, empat verificationMethod, FK RESTRICT, UNIQUE(session_id,student_nim). | `location` menjadi latitude/longitude/location_accuracy nullable. DECIMAL dapat berupa string dari driver: mapper mengonversi terkontrol, bukan mengubah semua BIGINT/DECIMAL global. Validasi rentang koordinat. scannedAt menjadi UTC DATETIME dan kembali sebagai ISO. |
| 005 / LeaveRequest | Status/type, alasan, tanggal, referensi bukti, FK mahasiswa. | Belum ada pengikat sesi, reviewer atau waktu keputusan. Tambahkan session_id nullable, reviewed_by dan reviewed_at; permintaan bertanggal tanpa sesi tetap boleh PENDING, penerapan ke record harus punya satu sesi pasti. |
| 006 / DeviceSession | User FK, perangkat, token hash, login/aktivitas/expiry/revoked/status. | Jangan kirim sessionToken/hash ke browser. userName/email/role adalah join terbatas; isCurrentDevice dihitung server. ipSimulated/locationCity tidak dianggap fakta; timestamp millis dipetakan dari datetime. Tambahkan DTO khusus, tanpa memaksakan model simulasi lama ke DB. |
| 006 / Audit, Backup | Tersedia audit perubahan status dan log umum. | Belum ada model/implementasi audit frontend. Audit ditulis dalam transaksi yang sama, actor dari sesi. Backup operasional database dan ekspor akademik dipisah; kredensial, reset token, dan sesi tidak masuk ekspor browser. |

Lintas model: optional TypeScript, undefined, SQL NULL, BOOLEAN 0/1, JSON MariaDB, DATE lokal dan datetime UTC harus diuji melalui mapper eksplisit. NIM/NIDN/username tetap string, termasuk nol di depan. Pemeriksaan panjang/rentang, prodi, SKS, semester, waktu mulai/akhir, dan arsip harus dilakukan server; tipe TypeScript bukan validasi runtime.

Jangan mengedit 001-006. README menyebut 007 untuk migrasi data, tetapi file 007 belum ada. Saat implementasi, tetapkan urutan baru lewat ledger: contoh 007 relasi/override/roster dan 008 review izin/constraint setelah audit data. Proses impor data adalah alat terpisah, bukan seed otomatis atau efek samping startup. Nomor final mengikuti ledger tujuan yang diizinkan.

## 5. Arsitektur target

Frontend mempertahankan komponen, CSS, label, route, dan keluaran laporan. Tambahkan klien API berbasis fetch yang sudah tersedia; context menjadi state/cache serta adapter ke service, dipindah per domain. Tidak perlu Redux, ORM, framework server baru, atau rewrite routing. Operasi jaringan menjadi async, loading/error terlihat, tombol submit mencegah duplikasi, dan input tidak hilang saat gagal. Jangan laporkan sukses sebelum server commit.

Sebelum perubahan UI pertama, rekam matriks route/role/aksi dan screenshot dengan fixture sintetis pada desktop serta ponsel. Bandingkan sesudah setiap domain dipindah. Saat logout, ganti akun, sesi kedaluwarsa, reload dan perubahan sesi tab lain, kosongkan cache privat dalam memori sebelum memuat identitas berikutnya; jangan menghapus data legacy pengguna untuk melakukan ini. Uji navigasi keyboard, modal, loading/error, kamera ditolak, QR berulang, perpindahan hari WIB, serta konsistensi dashboard dengan PDF/XLSX.

Express menjadi satu otoritas API same-origin `/api/v1`. Struktur minimal yang dibuat bertahap: route, validasi/otorisasi, service transaksi, query mysql2 berparameter, mapper DTO. Pisahkan pembuatan app dari listen agar dapat diuji tanpa side effect email/database. `backend/db.ts` tetap satu pool setelah validasi konfigurasi; pool baru tersambung ketika diperlukan. Environment lokal harus eksplisit memakai akun/database development, tanpa fallback ke produksi. Secret Resend/DB hanya ada di server; jangan memakai prefix VITE untuk secret.

MariaDB menjadi sumber kebenaran. Runtime account memiliki hak DML seperlunya; migrator memakai akun terpisah. Query wajib menyeleksi field yang boleh keluar, membatasi ukuran/pagination, dan mengotorisasi objek. Domain yang pindah ke API tidak dual-write dan tidak kembali ke localStorage ketika jaringan putus. localStorage tersisa hanya preferensi nonrahasia dan penanda UI, dengan kebijakan privasi untuk username yang diingat.

Roster sesi dibekukan saat sesi dibuka; sesi lama mempertahankan snapshot mata kuliah/dosen/rombel. Perubahan roster setelah pembukaan harus tindakan eksplisit berizin dan diaudit. Enrollment baru memengaruhi sesi berikutnya. Laporan mempertahankan aturan 20 SKS, 16 pertemuan, toleransi maksimal dua IZIN dan dua SAKIT sebagai hadir efektif, serta hasil ALPHA/rounding lama melalui fixture sintetis sebelum dipindahkan ke service bersama.

## 6. Autentikasi dan otorisasi server-side

- Gunakan hash password `node:crypto.scrypt` dengan salt acak, format berversi dan parameter yang dikalibrasi pada hosting; bandingkan secara constant-time. Simpan di user_credentials saja. Jangan memigrasikan password plaintext atau memakai password bersama. Akun migrasi tanpa kredensial aman masuk alur aktivasi/reset melalui alamat yang sudah diverifikasi, tanpa email otomatis pada impor.
- Sesi opaque acak kriptografis dikirim melalui cookie HttpOnly, Secure production, SameSite=Lax, Path=/; hash token disimpan pada device_sessions. Tidak memakai JWT/localStorage untuk otoritas. TTL awal mengikuti timeout idle UI dua jam, dengan batas absolut yang ditetapkan eksplisit, misalnya 24 jam. DB memeriksa expiry/revocation setiap request; heartbeat tidak boleh memperpanjang tanpa batas.
- Rotasi token saat login/perubahan hak, revokasi saat logout/reset password, dan logout perangkat lain berdasarkan sesi server. Jangan mempercayai fingerprint sebagai identitas; jangan memulihkan token dari backup. Terapkan Origin allowlist + token CSRF untuk mutasi cookie, termasuk login/logout; hindari CORS wildcard dengan credentials.
- Login dan reset memakai pesan generik, pembatasan per-IP dan per-akun, cooldown, serta pencatatan tersaring. Limiter satu proses hanya boleh dipakai bila hosting dijamin satu worker; selain itu gunakan penyimpanan bersama. Proxy trust harus mengikuti topologi hosting yang diverifikasi.
- Server membuat OTP kriptografis, menyimpan digest ber-key server dan challenge, batas percobaan, expiry 15 menit, serta used_at atomik. Pengiriman ulang membatalkan challenge lama. Jangan menerima kode buatan klien, menaruh OTP di subject/log, atau mengembalikan kode simulasi. Gagal kirim tidak mengubah password atau dianggap sukses.
- Admin BAAK mengelola master, enrollment, backup dan audit. Dosen hanya mengelola jadwal/sesi yang ditugaskan serta peserta/izin terkait. Mahasiswa hanya profil, jadwal, presensi dan izin sendiri. Pengikatan ID dosen/akun harus direkonsiliasi; tolak bila ambigu. Pemilihan role UI tidak memberikan role server.
- Uji IDOR pada setiap endpoint ber-ID, termasuk export, download bukti, daftar perangkat, revoke, bulk dan arsip. Jangan menerima role, actor ID, NIM presensi, atau timestamp otoritatif dari payload mahasiswa.
- Bukti izin disimpan privat di luar static root; akses melalui endpoint berizin. Validasi ukuran, tipe isi, nama acak dan download aman; tolak URL/path arbitrer untuk mencegah traversal/SSRF. Jangan menganggap koordinat browser sebagai bukti kehadiran yang tidak dapat dipalsukan.

## 7. Kontrak API dan integrasi frontend

Kontrak berikut adalah target yang akan dibuat, bukan endpoint yang sudah tersedia. Semua request/response JSON kecuali upload multipart dan download. ID tetap string. Waktu kejadian memakai ISO 8601 UTC; tanggal akademik YYYY-MM-DD dan jam HH:mm memakai Asia/Jakarta. Respons sukses `{data: ...}`; list `{data: [...], meta: {page, pageSize, total}}`, default 50 maksimal 100. Error `{error: {code, message, fields?}, requestId}` tanpa stack/SQL/secret.

Status: 200/201 sukses, 204 tanpa body, 400 JSON/range salah, 401 tanpa sesi sah, 403 tanpa izin/CSRF salah, 404 objek tidak ada atau tidak boleh diketahui, 409 konflik versi/relasi/transisi, 413 file terlalu besar, 422 validasi field, 429 rate limit, 503 dependensi belum siap. Mutasi menerima field allowlist saja. Header If-Match/version diperlukan pada edit rawan konflik; response membawa versi terbaru, dengan kolom version tambahan pada domain yang menggunakannya.

| Endpoint `/api/v1` | Akses dan payload inti | Integrasi |
| --- | --- | --- |
| GET `/health`, GET `/ready` | Health minimal tanpa secret; ready memeriksa DB dengan timeout, tidak membocorkan konfigurasi. | Monitoring, bukan endpoint pengirim email. |
| POST `/auth/login`, GET `/auth/me`, POST `/auth/logout` | Login `{identifier,password,role}`; role hanya membatasi pencarian, diverifikasi terhadap akun. Respons safe User dan CSRF token; cookie sesi. | HomePage, dua portal login, App bootstrap dan timeout. |
| POST `/auth/password-reset/request`, POST `/auth/password-reset/confirm` | Request `{identifier,role}` selalu pesan generik + challengeId opaque; confirm `{challengeId,code,newPassword}`. | ForgotPasswordModal; hapus verifikasi dan password lokal. |
| POST `/auth/password-change/request`, POST `/auth/password-change/confirm` | Wajib sesi, recent authentication, OTP ke email akun; confirm `{challengeId,code,newPassword}`. | ChangePasswordOtpSection; perubahan email butuh verifikasi terpisah. |
| GET/PATCH `/me` | Hanya profil field yang diizinkan; email sensitif memakai proses verifikasi. | Tiga modal profil; respons tidak memiliki password/hash. |
| GET `/me/device-sessions`, DELETE `/me/device-sessions/:id`, POST `/me/device-sessions/revoke-others` | Pemilik akun; token/hash tidak dikirim. | DeviceSessionManager; monitoring seluruh akun memakai endpoint admin berizin terpisah. |
| GET/POST `/users`, PATCH `/users/:id`, POST `/users/:id/deactivate` | Admin; provisioning lewat aktivasi, bukan pengiriman password bersama. | AdminDashboard dan manajemen dosen/BAAK. |
| GET/POST `/students`, GET/PATCH `/students/:nim`, POST `/students/:nim/deactivate` | Admin; mahasiswa memakai `/me`. Metadata historis dipertahankan. | StudentModal, roster, sinkronisasi akun sebagai transaksi server. |
| GET/POST `/rombels`, PATCH `/rombels/:id`, PUT `/rombels/:id/schedules` | Admin, `{scheduleIds:[...]}` untuk relasi. | RombelModal, RelationshipBlockModal. |
| GET/POST `/courses`, PATCH `/courses/:id`; GET/POST `/schedules`, PATCH `/schedules/:id` | Admin mutasi; pembacaan dibatasi role/scope. | CourseModal, ScheduleModal, kalender dan detail jadwal. |
| POST `/{courses,schedules,rombels}/:id/archive`, POST `/{courses,schedules,rombels}/:id/restore` | Admin, histori tidak dihapus. DELETE hanya objek tanpa relasi, selain itu 409 dengan ringkasan aman. | Kontrol arsip/pulihkan dan pemeriksaan relasi yang ada. |
| PUT `/students/:nim/rombels`, PUT `/students/:nim/schedule-overrides` | Admin; `{rombelIds:[...]}` atau `{includedIds:[],excludedIds:[]}`. | Multi-rombel, custom/drop, total SKS; endpoint mengembalikan enrollment efektif. |
| PUT `/schedules/:id/meeting-dates` | Admin/dosen penanggung jawab; `{meetingDates:{"1":"YYYY-MM-DD"}}`. | MeetingDatesModal, pertemuan 1-16. |
| GET/POST `/attendance-sessions`, POST `/attendance-sessions/:id/{close,reopen,rotate-qr}` | Dosen penanggung jawab/admin. Create `{scheduleId,meetingNumber,date,startTime,endTime,topic,evaluationMethod,isDynamicQr}`; server membentuk metadata/token. | Modal buka sesi, QR, penutupan, monitoring. Mutasi massal/session reset harus scope jelas dan diaudit. |
| POST `/attendance/scan` | Mahasiswa; `{token}`; mahasiswa dari sesi login. Respons record aman dan serverTime. | QrScannerModal. Token utuh, expiry, roster, sesi terbuka; scan ulang mengembalikan record sama. |
| GET `/attendance-records`, PATCH `/attendance-records/:id`, POST `/attendance-sessions/:id/records/batch` | Dosen terkait/admin mutasi `{status,notes,reason}`; mahasiswa GET milik sendiri. Batch `{updates:[{studentNim,status,reason}]}` dibatasi ukuran. | Presensi manual/massal, koreksi dan audit. |
| GET/POST `/leave-requests`, POST `/leave-requests/:id/review` | Mahasiswa create `{sessionId?,courseCode,date,type,reason,proofId?}`; dosen terkait/admin review `{decision,sessionId?,reason}`. | LeaveRequestModal dan persetujuan. SessionId wajib saat penerapan ke record. |
| POST `/leave-proofs`, GET `/leave-proofs/:id` | Upload/download privat berdasarkan pemilik dan peninjau. | Bukti izin, tanpa static URL bebas. |
| GET `/reports/attendance`, GET `/reports/attendance/export` | Filter semester/course/schedule/student dalam scope; format PDF/XLSX. | Awalnya generator frontend memakai dataset tersaring server; kemudian server jika ukuran memerlukan. |
| POST `/admin/imports/preview`, POST `/admin/imports/:id/apply` | Admin recent-auth; preview upload privat, apply memakai hash preview + conflict decisions + idempotency key. | BulkExcelImportModal; batas ukuran dan transaksi, bukan restore bebas. |
| GET `/admin/backups`, POST `/admin/backups`, POST `/admin/restores/preview`, POST `/admin/restores/:id/apply`, GET `/admin/audit-logs` | Admin recent-auth, audit; download cadangan privat dan terbatas. | DatabaseBackupTab/Modal, snapshot dan restore. Tombol reset menjadi operasi eksplisit berizin dengan preview; tidak memanggil localStorage.clear. |

Aturan transaksi yang wajib diuji: scan dan close mengambil lock baris sesi dengan urutan sama; scan sebelum close diterima, sesudah close ditolak. UNIQUE session/student menangani retry paralel tanpa record ganda. Close idempotent mengisi ALPHA hanya bagi roster tanpa record dan menerapkan izin yang sudah sah. Persetujuan izin tidak menimpa HADIR otomatis; kembalikan konflik untuk koreksi eksplisit dengan alasan. Batch, review izin, dan audit commit atau rollback bersama. Reopen membatalkan token lama; penghapusan sesi ber-record memakai arsip/konflik, bukan cascade.

## 8. Panduan migrasi data yang dapat dipakai ulang

1. Tentukan sumber otoritatif melalui manifest privat: versi, waktu, hash file, jumlah per entitas dan asal browser/perangkat. Jangan menganggap backup bertanggal terbaru mencakup seluruh perubahan localStorage. Jangan menggabungkan semua backup secara otomatis.
2. Pada tugas impor yang diizinkan nanti, minta pemilik mengekspor data browser sebelum menjalankan versi aplikasi yang reseed. Simpan salinan di lokasi privat terenkripsi dengan akses/retensi terbatas; jangan mengubah file asal atau memuatnya ke fixture.
3. Buat fixture sintetis dan database disposable lokal. Migrator wajib memeriksa host, nama database, identitas lingkungan, ledger dan checksum; tolak target produksi/nonlokal pada test. Uji 001 sampai 006 berurutan dan migrasi tambahan pada MariaDB versi target.
4. Jalankan dry-run parser tanpa DB write untuk semua field, enum, panjang, tanggal, ID ganda, FK, NIM/nol depan, mapping akun dan rombel, custom/excluded schedule, arsip serta histori. Konflik masuk laporan karantina privat; output terminal hanya jumlah dan kode masalah.
5. Rencanakan resolusi eksplisit untuk profil User/Student berbeda, email ganda, referensi hilang, sesi/record duplikat dan rombel gabungan. Jangan membuat record mahasiswa palsu, mengambil status terbaru, mengoreksi jadwal khusus, atau membuang orphan secara diam-diam.
6. Jalankan DDL terpisah dari impor DML. MariaDB DDL dapat menyebabkan implicit commit; transaksi SQL bukan mekanisme rollback seluruh migrasi skema. Gunakan ledger/checksum dan perbaikan maju; validasi skema aktual, sebab IF NOT EXISTS tidak memperbaiki struktur yang melenceng.
7. Urutan impor staging yang disetujui: users, students beserta mapping akun, rombels, courses, schedules, student_rombels, rombel_schedules, override, sessions, roster historis yang dapat direkonsiliasi, records, leave_requests. Histori yang roster-nya tidak pasti harus ditandai untuk rekonsiliasi, bukan ditebak. Jangan impor plaintext password, OTP, atau sesi login lama.
8. Gunakan satu koneksi transaksi untuk unit DML yang disepakati; parameterized INSERT, bukan REPLACE atau upsert yang menimpa konflik. Simpan ledger batch/hash dan keputusan konflik agar retry idempotent. Gagal validasi membatalkan batch, tidak melanjutkan sebagian tanpa laporan.
9. Verifikasi jumlah, relasi, checksum data kanonis nonrahasia, dan kesetaraan laporan terhadap manifest. Uji restore backup ke database disposable lain. Backup tanpa uji restore tidak memenuhi gate.
10. Cutover per domain tanpa dual-write: validasi staging, hentikan penulisan lama pada jendela terencana, rekonsiliasi delta, aktifkan API, lalu pantau. localStorage lama tetap tidak dihapus otomatis. Rollback aplikasi setelah transaksi baru masuk tidak boleh mengaktifkan penulisan localStorage atau memulihkan database lama tanpa rekonsiliasi.

## 9. Workflow dan kemampuan yang tersedia

| Tersedia saat audit | Penggunaan efisien |
| --- | --- |
| PowerShell, rg, Git, Node v26.12.1, npm 11.20.0, OpenSSH client | Pencarian terarah, inspeksi diff, parsing struktur tanpa mencetak record, pemeriksaan dokumen dan fixture sintetis. Adanya SSH client bukan bukti akses hosting. |
| package-lock.json v3 dan bun.lock | Root dependencies/devDependencies pada npm lock cocok dengan package.json. Pilih npm karena script/proses lokal memakai npm; jangan memperbarui dua lockfile tanpa kebutuhan. |
| TypeScript/Vite dalam deklarasi dependensi | `npm.cmd run lint` untuk tipe; `npm.cmd run build` untuk frontend setelah instalasi berhasil. Jangan menyebut keduanya sebagai pengujian integrasi. |
| node:test, node:assert, fetch bawaan Node | Runner backend tanpa dependensi baru; test app pada port lokal sementara dan fixture sintetis. Driver mysql2 yang sudah ada untuk test MariaDB terisolasi. |
| Delegasi cavecrew | Dua investigator dipanggil; tool filesystem tidak tersedia di subagen. Audit file dilakukan agen utama; review risiko menggunakan ringkasan tersaring, bukan klaim pemeriksaan independen file. |
| Web sumber resmi | Digunakan untuk batas DDL MariaDB dan alur cPanel. Tidak digunakan mengakses akun/server pengguna. |

Tidak ditemukan CLI mysql/mariadb/docker melalui PATH; ketersediaan server lokal belum dibuktikan. Tidak ada test script, CI workflow, atau browser runner dalam source yang diinventarisasi. Jangan menambah tool baru sebelum kebutuhan fase jelas. Bila uji UI otomatis dibutuhkan, periksa browser/tool yang tersedia dahulu; tambah Playwright hanya bila belum ada alternatif yang memenuhi gate.

Alur perubahan: investigasi simbol/pemanggil, tetapkan acceptance criteria fase, ubah lapisan terkecil, jalankan test relevan, review diff dan akses data, lalu laporkan bukti serta batasnya. Panduan migrasi, kontrak API dan auth ada dalam dokumen ini agar tidak menduplikasi instruksi dalam beberapa file.

## 10. Urutan implementasi dan gate setiap fase

Semua pengujian berikut adalah pekerjaan fase mendatang kecuali yang secara eksplisit dicatat pada bagian 12. Fase berikutnya dimulai setelah gate dependensinya lulus.

| Fase | Bergantung | Hasil dan acceptance criteria | Pengujian otomatis wajib |
| --- | --- | --- | --- |
| 0. Audit dan rencana | Tidak ada | AGENTS dan dokumen ini; daftar risiko dan gap terbukti; tidak mengubah runtime/data. | Struktur dokumen, referensi file, validitas kontrak yang dirujuk, serta diff hanya dokumentasi. Selesai pada tugas ini. |
| 1. Lindungi data dan reproduksi lingkungan | 0 | Blokir build dengan JSON/seed pribadi; hentikan reseed otomatis; pisahkan helper akademik dari seed nyata tanpa menghapus sumber; fixture sintetis lokal; dependencies terpasang dari lock; runtime production dipilih. | Perubahan versi seed tidak mengubah data browser; quota/JSON rusak tidak menyebabkan overwrite; scan artefak public/JS/map gagal jika data pribadi/token masuk; typecheck dan build lulus setelah isolasi. |
| 2. Fondasi backend dan skema lokal | 1 | App Express dapat diuji tanpa listen side effect; environment tervalidasi; migrator+ledger lokal; mapper; migrasi tambahan relasi/override/roster/version. | Fresh DB 001-006 + tambahan, ledger retry/checksum, drift ditolak, CHECK/FK/UNIQUE, boolean/JSON/null/date/decimal round-trip; guard menolak target nonlokal. GET API tak dikenal 404 JSON; health tidak membocorkan secret. |
| 3. Autentikasi dan scope | 2 | Login/me/logout/reset/change/device sessions server; semua jalur login memakai API; endpoint email lama ditutup atau dilindungi konsisten pada kedua entrypoint. | Hash+verify scrypt, login salah, role palsu, IDOR, expiry/revoke, CSRF/Origin, limiter, OTP salah/kedaluwarsa/replay/resend/percobaan bersamaan, gagal email; tidak ada password/token/OTP dalam DTO/log/browser storage. |
| 4. Master dan enrollment | 3 | CRUD user/student/rombel/course/schedule, arsip/pulihkan, tanggal pertemuan, multi-rombel dan overrides. Admin UI tetap sama; state memuat server. | RBAC dosen/mahasiswa, konflik version/relasi, transaksi profil ganda, nol depan, 20 SKS dan override EXCLUDE, soft-delete menjaga histori, API gagal tidak menulis fallback lokal. |
| 5. Sesi, QR, presensi dan izin | 4 | Semua mutasi presensi lewat server; lock/unik/audit; scheduler penutupan tidak bergantung tab browser; bukti privat; sinkronisasi lintas perangkat. | Scan paralel satu record, token prefix palsu/expired/rotasi ditolak, race scan-close dan izin-HADIR, batas pertemuan/waktu, roster snapshot, ALPHA idempotent, batch rollback+audit, izin beda tanggal/rombel ditolak, file upload/IDOR ditolak. |
| 6. Laporan, backup dan rehearsal data | 5 | Laporan setara, backup lengkap berversi, preview impor/restore, recovery ke DB disposable, manifest dry-run tanpa data pengguna di test. | Toleransi IZIN/SAKIT 0/1/2/3 dan rounding, PDF/XLSX sesuai dataset berizin, formula injection Excel dicegah, round-trip rombel/relasi/arsip, penolakan import rusak, idempotensi batch, restore failure rollback dan akun tanpa sesi/kredensial impor. |
| 7. Staging dan kesiapan hosting | 6 | Release server.mjs + dist, konfigurasi hosting tervalidasi, staging fixture sintetis dan runbook rollback. Tidak otomatis deploy produksi. | Smoke tiga role lintas dua browser/perangkat, refresh /portaladmin, API JSON, HTTPS/cookie/proxy, tidak ada JSON/seed/source map privat, restart process, DB timeout, backup-restore, batas kuota dan upload. |
| 8. Cutover produksi terpisah | 7 + izin eksplisit baru | Baru dijadwalkan setelah akses hosting, backup terverifikasi, manifest data, jendela tulis, recovery dan keputusan pemilik siap. | Rekonsiliasi staging/produksi berizin, smoke non-destruktif, monitor error dan rollback yang tidak kehilangan transaksi baru. Tidak dilakukan dalam tugas audit. |

Scheduler fase 5 memakai cron hosting atau job process yang benar-benar tersedia, bukan interval browser. Job menutup sesi kedaluwarsa secara idempotent memakai lock DB. Jangan menambah queue/broker sebelum batas hosting menuntutnya.

## 11. Strategi deployment IDwebhost melalui SSH

Bagian ini runbook untuk tugas berikutnya; tidak ada perintah SSH atau deployment yang dijalankan sekarang. Dokumentasi IDwebhost menjelaskan Setup Node.js App dan environment cPanel, tetapi artikel tidak membuktikan fitur/versi pada paket pengguna saat ini. Periksa dukungan paket dengan pemilik/cPanel saat diizinkan.

1. Preflight read-only berizin: catat versi Node yang benar-benar tersedia, MariaDB, SQL mode/timezone/collation, engine InnoDB, SSH, path aplikasi, quota memory/storage/process, akses jaringan email, cron, reverse proxy, TLS dan metode restart. Jangan menyalin secret ke terminal/laporan.
2. Pilih satu Node LTS yang tersedia di hosting dan memenuhi engine seluruh lockfile. Node lokal 26 bukan bukti kompatibilitas hosting. Build dan test dengan versi yang sama sebelum release; jangan mengasumsikan rentang versi dari artikel lama masih berlaku.
3. Siapkan build frontend dan backend di lingkungan tepercaya: Vite menghasilkan dist; esbuild yang sudah ada menghasilkan server.mjs untuk Node dengan package eksternal. Runtime production harus tidak mengimpor Vite/devDependency. Uji `app.cjs` mengimpor server.mjs dan entrypoint tersebut dipilih di cPanel; perbaikan script adalah fase implementasi, bukan audit ini.
4. Buat manifest release berisi hash file yang diizinkan: dist yang sudah lolos gate privasi, server.mjs, app.cjs, package manifest/lock runtime yang konsisten. Jangan sertakan .env, .git, dump/JSON pribadi, scripts pembangun seed, source map privat, atau node_modules Windows.
5. Melalui SSH/SCP pada tugas deployment yang diizinkan, unggah ke direktori release baru di luar public_html. Aktifkan environment Node dari perintah yang ditampilkan cPanel; instal dependency runtime sesuai lock di Linux. Secret disetel di panel atau file privat dengan izin minimum, bukan di command line/history. Tidak memerlukan push GitHub.
6. Hubungkan static/API same-origin melalui URL aplikasi cPanel; pastikan fallback SPA hanya untuk route frontend dan `/api` selalu JSON. Tidak perlu menjalankan Vercel function bersamaan di hosting Express. Jangan mengubah konfigurasi domain lain, termasuk database stmikkeb_humas.
7. Migrasi adalah langkah manual terpisah dengan izin baru, akun DDL, ledger, backup yang sudah diuji restore, dan window yang disepakati. Tidak ada auto-migrate pada start/restart. Aplikasi memakai akun DML ke database yang ditetapkan, bukan hak root.
8. Uji staging dahulu: route utama dan /portaladmin, assets, health/ready, login/logout/reset melalui email sandbox, RBAC, dua klien, QR dan laporan. Pastikan endpoint uji email/JSON publik tidak tersedia. Jangan mengirim email nyata dari smoke test.
9. Saat cutover disetujui, switch application root/release menggunakan mekanisme panel yang tersedia lalu restart terkontrol; symlink atomik hanya bila hosting mendukung. Simpan release sebelumnya. Probe health/ready dan log tersaring. Jangan menerbitkan source atau backup untuk mempermudah debugging.
10. Rollback kode memakai release sebelumnya yang kompatibel skema. Jangan otomatis down-migrate, truncate, atau restore database lama setelah ada transaksi baru. Hentikan penulisan dan rekonsiliasi bila rollback data diperlukan. Tetapkan retensi audit, upload, backup dan log, serta larang token/password/OTP/lokasi presisi dalam log.

Sumber resmi: [IDwebhost: instalasi Node.js di cPanel](https://idwebhost.com/blog/cara-install-nodejs-di-cpanel/) dan [cPanel: instalasi aplikasi Node.js](https://support.cpanel.net/hc/en-us/articles/6840609038103-How-to-install-a-Node-js-application). Perilaku DDL: [MariaDB: statements causing implicit commit](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit). Referensi diakses saat audit; konfigurasi akun hosting tetap belum diverifikasi.

## 12. Hasil verifikasi audit dan hambatan

- Lulus: parsing struktur lima JSON, pemeriksaan jumlah/relasi master yang dirinci pada bagian 3, pencocokan dependency root npm lock terhadap package.json, inventaris file/tool, serta pembacaan enam migrasi. Ini bukan eksekusi SQL.
- `npm.cmd run lint` gagal: tsc belum tersedia. `npm.cmd run build` gagal: vite belum tersedia. Awalnya node_modules tidak ada.
- Instalasi `npm.cmd ci --ignore-scripts --offline --no-audit --no-fund` gagal ENOTCACHED untuk satu tarball; percobaan registry dengan retries=0 dan timeout terbatas gagal EACCES. npm juga melaporkan cleanup EPERM; node_modules mungkin parsial dan tidak boleh dianggap instalasi sah. Lockfile dan source tidak diubah untuk mengakali kegagalan.
- Pengujian MariaDB, browser, server startup production, keamanan runtime, integrasi email, dan hosting belum dilakukan. Tidak ada klaim aplikasi siap production. Tidak ada akses endpoint email untuk pengujian.
- Layanan remove-ai-marks tidak dapat dijangkau melalui health check. Tidak ada klaim teks dibersihkan layanan tersebut.

Tugas implementasi pertama: fase 1, guard keselamatan data dan build. Mulai dengan pengujian sintetis yang membuktikan perubahan versi seed tidak menimpa localStorage, serta gate artefak yang menolak backup/data pribadi. Pisahkan helper akademik dari seed nyata dan isolasi data dari output tanpa menghapus sumber. Selesaikan instalasi dependency serta typecheck/build pada lingkungan yang dapat mengakses registry. Baru lanjut ke fondasi backend setelah gate ini lulus.
