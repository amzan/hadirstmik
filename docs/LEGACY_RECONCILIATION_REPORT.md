# Rekonsiliasi relasi akademik legacy

## Pembaruan keputusan pemilik: finalisasi EXCLUDE

Status terbaru ada di [LEGACY_EXCLUDE_REVIEW_REPORT.md](LEGACY_EXCLUDE_REVIEW_REPORT.md). Hanya admin memutuskan CONTINUE/ARCHIVE/DEFER; 18 referensi nyata belum mendapat keputusan. Roster 30 sesi diterima dari presensi sumber atas keputusan pemilik, label kosong `5` tidak aktif, dan izin independen dari sesi serta tidak mengubah presensi. Tiga izin valid sebagai `LEGACY_ARCHIVED_NO_RECIPIENT` sesuai keputusan final pemilik; tiga konflik penerima ditutup tanpa menebak dosen/sesi. Dry-run terbaru mempunyai hanya 18 isu EXCLUDE, bukan 52 isu baseline. Bagian berikut mempertahankan bukti audit sebelum keputusan final dan tidak boleh digunakan sebagai aturan bisnis terbaru.

Tanggal: 20 November 2026, Asia/Jakarta. **Kesiapan: PARTIAL. Impor penuh data nyata masih BLOCKED.** Rekonstruksi relasi saat ini berhasil; roster historis, override putus, dan pengajuan izin belum mempunyai bukti cukup. Tidak ada impor data nyata, perubahan produksi, deployment, push, atau perubahan `.env`.

## Sumber dan batas bukti

Analisis read-only atas JSON terbaru, Excel Master, dan sepuluh screenshot dalam `D:\hadirstmik-private`. Tidak ada record, nama, NIM, email, telepon, credential, atau salinan berkas sumber dimasukkan ke repository/fixture/laporan. Payload kandidat hanya berada dalam memori; CLI mencetak jumlah dan kode masalah. Hash sebelum/sesudah pembacaan JSON/Excel membuktikan sumber tidak berubah.

Keputusan pemilik pada permintaan ini merupakan otoritas alias. Screenshot membuktikan tampilan dan angka yang terlihat, bukan kelengkapan peserta sesi pada waktu lampau. Logika legacy dipakai untuk menjelaskan perhitungan UI, bukan untuk mengarang roster.

## 1. Matriks konsistensi sumber

| Entitas | JSON terbaru | Excel | Pencocokan dan bukti |
| --- | ---: | ---: | --- |
| Pengguna | 78 | 78 | 78 ID cocok; username, nama, email dan role cocok. Role uppercase Excel dinormalisasi hanya untuk perbandingan. Komposisi: 1 admin, 11 dosen, 66 mahasiswa. |
| Mahasiswa | 66 | 66 | 66 NIM cocok, field nama/email/prodi/label rombel cocok; tepat satu akun mahasiswa per NIM. |
| Mata kuliah | 29 | 29 | 29 kode cocok; nama, SKS, semester dan prodi cocok. |
| Jadwal | 34 | 34 | 34 ID cocok; kode mata kuliah, label rombel, SKS dan hari cocok. |
| Sesi | 30 | 30 | 30 ID cocok; mata kuliah, label rombel dan nomor pertemuan cocok. |
| Presensi | 644 | 644 | 644 ID cocok; NIM, mata kuliah, status dan label rombel cocok. Tidak ada ID atau pasangan sesi-mahasiswa ganda. |
| Izin/sakit | 3 | 3 | Tiga kombinasi mahasiswa/mata kuliah/jenis/status/alasan cocok; Excel tidak menyediakan identitas sesi untuk menyelesaikan ambiguitas. |

Perbandingan Excel dibatasi pada field tersebut. Format waktu, topik, metadata lain dan seluruh field spreadsheet tidak diklaim identik. Tidak ada mismatch pada field yang diperiksa; tidak ada identitas Excel ganda.

Screenshot monitoring dan statistik backup menunjukkan 30 sesi, 644 presensi, dan 521 HADIR. JSON memiliki 521 HADIR, 5 IZIN, 7 SAKIT dan 111 ALPHA, total 644. Kartu master legacy pada screenshot yang sama masih menyebut 643; itu bukan dasar menghapus satu record.

Dibanding backup 643 record pada pekerjaan sebelumnya, sumber terbaru memiliki satu ID tambahan, tidak kehilangan ID, dan mengubah 22 record lama: 22 perubahan `scannedAt`, termasuk 3 perubahan status. Sumber terbaru dipertahankan apa adanya; versi lama tidak digabung atau ditimpa otomatis. Laporan implementasi 19 November adalah bukti baseline lama, bukan jumlah terkini.

## 2. Alias dan jadwal bersama

Aturan `owner-confirmed-2026-11-20` dalam `shared/academic-relations.mjs`:

- Hanya `TI 1` menjadi `TI 1A`. Label `TI 1` tetap tersedia pada sumber privat dan metadata bukti dalam memori.
- `TI 5` tetap identitas terpisah.
- `TI 1 & 5` diurai menjadi dua relasi: `TI 1A` dan `TI 5`. Tidak dibuat rombel gabungan, jadwal salinan, atau mahasiswa salinan.
- Separator pada label gabungan tidak menciptakan alias. `MI 5` dan `MI 5A` tetap berbeda; `MI 1A` dan `MI 1U` juga berbeda sampai ada keputusan baru.
- Label angka tunggal `5` tanpa prefix tidak memperoleh program studi dari tebakan.
- ID sesi, ID presensi, status, waktu, dan label historis tidak dinormalisasi ulang.

UI menampilkan sembilan label: `5`, `MI 1A`, `MI 1U`, `MI 5`, `MI 5A`, `TI 1`, `TI 1A`, `TI 3`, `TI 5`. Setelah alias terkonfirmasi disatukan, terdapat tujuh identitas berprefix yang dapat direpresentasikan dan satu label tanpa identitas yang terbukti. Sembilan label tidak berarti sembilan rombel kanonis. Identitas `MI 1A` terbukti terlihat di UI, tetapi keanggotaan dan jadwalnya kosong pada sumber utama.

| Identitas kanonis | Mahasiswa saat ini | Relasi jadwal | Dasar |
| --- | ---: | ---: | --- |
| TI 1A | 11 | 9 | Label mahasiswa TI 1/TI 1A dan keputusan pemilik. |
| TI 5 | 8 | 9 | Label eksplisit mahasiswa/jadwal. |
| TI 3 | 23 | 8 | Label eksplisit mahasiswa/jadwal. |
| MI 1U | 6 | 10 | Label eksplisit mahasiswa/jadwal. |
| MI 5A | 18 | 8 | Label eksplisit mahasiswa/jadwal. |
| MI 5 | 0 | 8 | Label eksplisit pada jadwal bersama; bukan alias MI 5A. |
| MI 1A | 0 | 0 | Terlihat di UI; tidak diberi mahasiswa atau jadwal buatan. |
| **Total** | **66** | **52** | Enam kelompok mempunyai relasi jadwal; tujuh identitas termasuk kelompok kosong yang terlihat di UI. |

## 3. Rekonstruksi deterministik

**184 relasi saat ini terbukti:** 66 akun-mahasiswa, 66 mahasiswa-rombel dan 52 rombel-jadwal. Relasi ini tidak dinyatakan sudah diimpor. Rombel hasil rekonstruksi memakai ID deterministik pada kandidat dalam memori; collision dengan katalog yang sudah ada ditolak, bukan digabung diam-diam.

| Label jadwal legacy | Jumlah jadwal | Tujuan rombel | Jumlah relasi |
| --- | ---: | --- | ---: |
| TI 3 | 8 | TI 3 | 8 |
| TI 1 & 5 | 8 | TI 1A; TI 5 | 16 |
| MI 5, MI 5A | 8 | MI 5; MI 5A | 16 |
| MI 1U & TI 5 & TI 1A | 1 | MI 1U; TI 5; TI 1A | 3 |
| MI 1U | 9 | MI 1U | 9 |
| **Total** | **34** | | **52** |

Semua referensi dosen pada mata kuliah/jadwal/sesi menunjuk akun dosen yang tersedia. Semua sesi menunjuk jadwal tersedia dengan mata kuliah yang cocok; semua presensi menunjuk sesi dengan mata kuliah cocok dan mahasiswa tersedia. Tidak ditemukan mismatch pada pemeriksaan tersebut.

Ada 33 mahasiswa dengan array `rombels` terisi; semuanya konsisten dengan label scalar setelah normalisasi. Tiap mahasiswa hanya menghasilkan satu enrollment, tidak dihitung ulang karena alias. Tidak ada INCLUDE pada sumber. Ada 19 EXCLUDE: satu target jadwal tersedia dan 18 referensi menunjuk satu ID jadwal yang sudah tidak ada. Referensi putus dipertahankan, tidak dipetakan ke jadwal lain hanya karena pola ID atau mata kuliah tampak serupa.

Batas standar SKS tetap **20**. Hasil sebelum/sesudah normalisasi sama: 18 mahasiswa mengambil 16 SKS, satu mengambil 18 SKS dan 47 mengambil 20 SKS; tidak ada yang melewati 20. Digest daftar enrollment per mahasiswa sebelum/sesudah identik. Referensi EXCLUDE yang putus diabaikan oleh perhitungan legacy karena target tidak ada; nilai referensinya tetap disimpan sebagai konflik, bukan dihapus.

## 4. Roster dan angka UI

644 pasangan sesi-mahasiswa terbukti melalui record presensi. Ini adalah peserta yang tercatat, **bukan bukti bahwa roster lengkap berjumlah 644 pasangan**. Sumber tidak memiliki snapshot roster lengkap pada 30 sesi. Rekonsiliator tidak mengisi `studentNims` memakai enrollment hari ini atau jumlah peserta yang terlihat di UI.

| Kelompok label historis | Sesi | Presensi yang dipertahankan | Roster lengkap terbukti |
| --- | ---: | ---: | ---: |
| TI 3 | 12 | 281 | 0 |
| MI 5, MI 5A | 12 | 216 | 0 |
| MI 1U & TI 5 & TI 1A | 5 | 129 | 0 |
| TI 1 & 5 | 1 | 18 | 0 |
| **Total** | **30** | **644** | **0** |

Ditemukan pemanggil legacy yang membalik argumen `isStudentInRombel` sambil mengirim array rombel mahasiswa. Array tersebut menggantikan argumen pertama, sehingga penghitung dapat mencocokkan mahasiswa terhadap rombel dirinya sendiri. Pemecahan label mentah juga menghasilkan token `5` tanpa prefix. Ini menjelaskan mengapa screenshot jumlah peserta jadwal tidak layak sebagai bukti historis; misalnya UI memperlihatkan 55 pada jadwal TI 3, sedangkan keanggotaan scalar/array sumber adalah 23. Setelah EXCLUDE, jumlah efektif per jadwal TI 3 adalah 22 atau 23.

Pemanggil di dashboard, modal jadwal dan preview peserta kini memakai arah argumen benar dan helper enrollment yang memperhitungkan INCLUDE/EXCLUDE. Opsi rombel memakai parser bersama agar `TI 1 & 5` tidak menghasilkan rombel baru bernama `5`. Desain/CSS dan navigasi tidak diubah. Snapshot `session_roster` tidak diperbarui saat enrollment berubah.

## 5. Konflik dan keputusan yang diperlukan

| Konflik | Kasus | Keputusan/bukti yang masih diperlukan |
| --- | ---: | --- |
| Label rombel `5` tanpa identitas | 1 | Tentukan apakah artefak parser atau entitas akademik; jangan mengasumsikan TI 5. |
| EXCLUDE menunjuk jadwal tidak tersedia | 18 | Otoritas akademik menetapkan apakah override historis tetap disimpan sebagai obsolete atau mempunyai penerus eksplisit. Jangan hapus referensi otomatis. |
| Roster historis tidak lengkap | 30 | Roster/as-of enrollment yang berwenang, atau pernyataan eksplisit pemilik bahwa daftar presensi tiap sesi memang lengkap. Daftar saat ini belum menjadi bukti. |
| Izin mempunyai dua kandidat sesi | 2 | Tentukan sesi/pertemuan yang benar, termasuk keterkaitan roster pada tanggal tersebut. |
| Izin tidak mempunyai sesi pada mata kuliah/tanggalnya | 1 | Bukti sesi yang hilang atau koreksi akademik yang disetujui; jangan membuat sesi buatan. |
| **Total kasus rekonsiliasi** | **52** | Beberapa kasus berbagi akar masalah; angka ini bukan 52 entitas independen. |

MI 1A, MI 1U, MI 5 dan MI 5A tidak digabung. Penggabungan tambahan memerlukan keputusan pemilik terpisah. Bukti lengkap histori belum tersedia; menutup konflik tersebut otomatis akan melampaui sumber.

## 6. Dry-run dan perubahan kode

CLI read-only:

```powershell
node scripts/reconcile-legacy.mjs PRIVATE_JSON PRIVATE_XLSX '5;MI 1A;MI 1U;MI 5;MI 5A;TI 1;TI 1A;TI 3;TI 5'
```

Argumen terakhir adalah label yang benar-benar diamati pada screenshot, bukan roster atau data mahasiswa. CLI tidak mempunyai flag apply, tidak membuka database, dan tidak menyimpan payload hasil rekonstruksi. Output hanya statistik struktural; sumber tidak dimodifikasi.

Dry-run kandidat: 78 pengguna, 66 mahasiswa, 7 rombel, 29 mata kuliah, 34 jadwal, 30 sesi, 644 presensi dan 3 izin. Validasi impor tetap **FAIL sebagaimana diharapkan**: 18 `OVERRIDE_INVALID`, 30 `ROSTER_RECONCILIATION_REQUIRED`, 3 `EXACT_SESSION_REQUIRED` = 51 isu importer. Label `5` dikeluarkan dari kandidat dan tetap konflik rekonsiliasi tambahan, sehingga total rekonsiliasi 52. Tidak ada penerapan parsial data nyata.

Kode utama:

- `shared/academic-relations.mjs`: aturan alias eksplisit, pemecahan label gabungan dan deduplikasi.
- `backend/reconciliation.mjs`: kandidat dan bukti dalam memori, pelestarian label sumber, konflik, peserta historis yang benar-benar tercatat.
- `scripts/reconcile-legacy.mjs`: pembandingan JSON/Excel dan statistik read-only tanpa payload pribadi.
- `initialData.ts`, context dan pemanggil admin: semantik alias bersama, deduplikasi jadwal dan perhitungan peserta yang benar.
- `backend/importer.mjs`: mapping alias, collision katalog, penolakan presensi di luar roster eksplisit serta pemeriksaan izin terhadap sesi/roster.
- Gate privasi juga memeriksa `shared/`. Migrasi 001-009 tidak diubah; migrasi tambahan belum diperlukan. Skema relasi yang tersedia sudah mendukung rombel terpisah dan satu sesi dengan banyak rombel.

## 7. Hasil pengujian

Node.js 24.11.1, MariaDB 11.4.5 loopback, Edge profil baru. Seluruh impor pengujian memakai fixture sintetis dalam database acak disposable, bukan sumber privat.

| Pemeriksaan | Hasil akhir |
| --- | --- |
| Unit/keamanan/akademik/rekonsiliasi/Excel | 26 PASS, 0 FAIL, 0 SKIP. |
| Integrasi MariaDB/HTTP | 25 PASS, 0 FAIL, 0 SKIP. |
| Browser | 5 subalur PASS; Node melaporkan 6 termasuk induk, 0 FAIL/SKIP. |
| Typecheck | PASS. |
| Build frontend/backend | PASS. |
| Gate privasi source/artifact | PASS. |
| Dry-run privat | PARTIAL, validasi impor ditolak secara sengaja karena konflik di atas. |

Tes baru mencakup alias TI 1/TI 1A, pemisahan TI 5, tidak menerapkan alias pada MI, dua relasi jadwal bersama, deduplikasi, prioritas EXCLUDE/INCLUDE, SKS tetap, pelestarian 644 presensi sintetis, impor ulang idempotent, roster tetap setelah keanggotaan berubah, collision dan penolakan izin ambigu. Tes browser baru membuktikan satu peserta yang eligible tetap dihitung satu saat array rombel tersedia.

Percobaan integrasi pertama gagal karena instance test belum ready. Setelah readiness diperiksa, tes baru mendeteksi collision fixture dengan katalog test sebelumnya. Pengujian 644 record kemudian dipisahkan ke database kosong tersendiri; collision tetap ditolak oleh kode aplikasi. Hasil akhir 25/25 lulus tanpa menonaktifkan validasi. Vite masih memberi warning chunk besar yang telah ada; tidak disembunyikan.

## 8. Keputusan kesiapan

**PARTIAL:** rekonstruksi 184 relasi saat ini dapat direproduksi, seluruh 644 presensi sumber tetap utuh, dan perubahan lokal telah diuji. **Belum READY untuk migrasi penuh:** 52 kasus rekonsiliasi memerlukan keputusan/bukti, terutama 30 roster dan tiga izin. Langkah berikut adalah memperoleh bukti tersebut lalu mengulang CLI dan tes round-trip pada database terpisah. Tidak ada alasan melakukan impor produksi sebelum konflik selesai.
