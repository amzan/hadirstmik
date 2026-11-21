# Finalisasi review EXCLUDE legacy

20 November 2026, Asia/Jakarta. **Status migrasi: PARTIAL. Mekanisme review lokal selesai diuji; keputusan terhadap sumber nyata belum dilakukan.** Laporan ini menggantikan asumsi penerusan EXCLUDE otomatis dan syarat sesi pada izin dalam laporan sebelumnya.

## Hasil sumber nyata, read-only

| Ukuran | Jumlah |
| --- | ---: |
| Referensi EXCLUDE kehilangan target | 18 |
| ID jadwal lama yang berbeda | 1 |
| Mahasiswa terdampak | 18 |
| Keputusan admin tersimpan untuk sumber nyata dalam pekerjaan ini | 0 |
| CONTINUE / ARCHIVE / DEFER nyata | 0 / 0 / 0 |
| EXCLUDE belum terselesaikan | 18 |
| EXCLUDE valid yang tetap dipertahankan | 1 |
| Roster diterima berdasarkan keputusan pemilik | 30 |
| Record presensi dipertahankan | 644, tanpa duplikasi |
| Izin legacy tanpa penerima yang terbukti | 3 |

Jadwal lama adalah `sch-ti-senin-3`. Identitas mahasiswa tidak dimasukkan ke laporan. Daftar mahasiswa dan kandidat jadwal hanya tersedia di review privat admin setelah sumber dimuat secara eksplisit. Tidak ada sumber nyata yang dimasukkan ke database pada pekerjaan ini. Semua keputusan yang disimpan selama pengujian memakai fixture sintetis dan database disposable.

Dry-run terbaru menghasilkan hanya 18 `OVERRIDE_INVALID`. Tiga konflik `LEAVE_RECIPIENTS_REQUIRED` ditutup berdasarkan keputusan final pemilik: tiga izin valid sebagai arsip historis tanpa penerima. Status tetap PARTIAL karena 18 referensi EXCLUDE belum diputuskan. Tidak ada impor data nyata.

## Arsip izin legacy tanpa penerima

- Penanda `LEGACY_ARCHIVED_NO_RECIPIENT`, kebijakan `owner-legacy-no-recipient-v1`, dan SHA-256 field historis disimpan bersama pengajuan. Hash mendeteksi perubahan kandidat; hash bukan tanda tangan atau bukti keaslian sumber eksternal.
- Rekonsiliasi hanya mengarsipkan legacy dengan penerima tidak tersedia/kosong dan tanpa relasi sesi/jadwal. Relasi yang sudah terisi memerlukan review; tidak dihapus diam-diam. Sumber asli tidak dimutasi.
- ID, mahasiswa, tanggal, jenis, alasan, status, waktu pembuatan dan metadata review yang tersedia dipertahankan. Tidak membuat dosen, relasi sesi/jadwal, atau perubahan presensi.
- Admin dan mahasiswa pemilik dapat membaca arsip. Dosen dan mahasiswa lain tidak mendapat arsip. Unduhan bukti memakai pembatasan yang sama.
- Review arsip ditolak dengan `LEGACY_ARCHIVE_IMMUTABLE`, termasuk admin, sehingga status historis tetap. Penetapan penerima sah di masa depan memerlukan alur terpisah; belum dibuat.
- POST pengajuan baru menolak metadata arsip dan tetap mewajibkan penerima dosen aktif. Importer hanya menerima penerima kosong bila penanda, kebijakan, hash, serta ketiadaan relasi valid.
- Setiap insert arsip menghasilkan audit `LEGACY_LEAVE_ARCHIVED`; impor ulang memakai ledger hash dan tidak menggandakan arsip/audit. Provenance tetap dibawa backup domain. CLI lokal dapat mempunyai actor null; audit batch/arsip tetap membuktikan aksi, bukan identitas operator CLI.


## Aturan yang diterapkan

- Hanya admin mengelola INCLUDE/EXCLUDE dan membuat keputusan legacy; mahasiswa/dosen ditolak backend.
- CONTINUE membutuhkan target aktif yang dipilih admin, bukan hasil pencocokan otomatis. Target harus eligible pada kandidat atau memang sudah dikecualikan, tidak konflik dengan INCLUDE eksplisit, dan hasil SKS maksimal 20.
- ARCHIVE mempertahankan referensi asli pada sumber terenkripsi dan ledger; referensi putus tidak dimasukkan sebagai override aktif kandidat. Tidak menambah enrollment baru.
- DEFER menyimpan admin, waktu dan alasan, mempertahankan status unresolved serta tidak membuat pengecualian aktif baru.
- Keputusan final CONTINUE/ARCHIVE tidak diedit melalui endpoint ini. DEFER dapat dilanjutkan dengan keputusan eksplisit baru; ledger sebelumnya tetap tersimpan. Perubahan keputusan final memerlukan alur koreksi tersendiri yang ditinjau, bukan overwrite audit.
- Batch hanya untuk satu ID jadwal lama. Checkbox memungkinkan admin mengeluarkan mahasiswa tertentu dan menanganinya terpisah. Tidak ada tindakan atau target default.
- Semua override yang masih valid dipertahankan. Jadwal/sesi/record presensi sumber tidak digunakan sebagai tempat menyimpan keputusan EXCLUDE.
- TI 1 tetap alias TI 1A; TI 5 terpisah. Label kosong `5` tidak menjadi rombel aktif. Alias pada MI tidak ditambahkan.
- Roster sesi legacy tertutup diterima dari record sumber atas keputusan pemilik. Metadata peserta ditambahkan pada kandidat; nilai field historis asli dan seluruh presensi dipertahankan. Sesi tanpa record atau masih terbuka tidak memperoleh roster lengkap otomatis.
- Izin/sakit mempunyai tanggal, alasan dan satu atau beberapa dosen penerima, tanpa kewajiban sesi/jadwal. APPROVED/REJECTED hanya mengubah histori izin dan audit. Penutupan sesi tidak lagi menerapkan status dari persetujuan izin.

## Skema dan operasi

Migrasi 001-009 tidak diedit.

| Migrasi | Isi |
| --- | --- |
| 010 | `legacy_exclude_batches`: sumber review terenkripsi AES-GCM, hash sumber dan hash kandidat. `legacy_exclude_items`: mahasiswa, ID lama, keputusan, ID baru, admin, waktu, alasan dan versi. `legacy_exclude_decisions`: ledger append-only dan idempotency request. |
| 012 | Penanda arsip, kebijakan provenance, hash historis dan constraint tanpa sesi; migrasi 001-011 tidak diedit. |
| 011 | Kolom mata kuliah izin boleh null; `leave_recipients` menghubungkan izin dengan satu atau beberapa dosen. Kolom sesi lama tetap disimpan untuk jejak legacy, tetapi tidak menjadi otoritas izin baru. |

Sumber review merupakan salinan logis tersanitasi di database privat saat admin memuatnya: password/token/perangkat dibuang, sedangkan referensi legacy tetap ada. File asli tidak ditulis ulang. Enkripsi memakai kunci backup yang sudah tersedia. Database produksi tidak diakses atau dimigrasi.

API di bawah `/api/v1/admin/legacy-excludes`, dilindungi role admin, CSRF, origin dan login terbaru:

| Endpoint | Perilaku |
| --- | --- |
| `POST /sources` | Mendaftarkan sumber review privat secara idempotent; tidak mengimpor tabel akademik. Menolak sumber tanpa EXCLUDE putus atau kerusakan struktur lain. |
| `GET /sources`, `GET /sources/:sourceHash` | Daftar sumber, item pekerjaan, keputusan tersimpan, dan kandidat jadwal sebagai informasi pembanding. |
| `POST /preview` | Preview setiap mahasiswa: enrollment sebelum/sesudah, SKS, versi dan hash. |
| `POST /decisions` | Simpan batch dalam satu transaksi dengan lock sumber, pemeriksaan hash preview dan request idempotency. Audit ditulis dalam transaksi yang sama. |
| `GET /sources/:sourceHash/candidate` | Menghasilkan kandidat dan bukti keputusan hanya ketika tidak ada item tanpa keputusan atau DEFER. Konflik lain tetap tercantum dan dapat menahan importer. |

Tidak ada query yang mengalihkan ID lama ke ID baru berdasarkan kemiripan. Target dipilih eksplisit dari sumber kandidat; preview ini bukan perubahan enrollment database aktif. CONTINUE membuat override aktif di kandidat yang diturunkan dari sumber dan keputusan tersimpan. Penerapan tabel akademik tetap melalui importer terpisah setelah semua validasi lolos.

Kandidat membawa `legacyReviewSource`. Frontend parser/export mempertahankan field tersebut. Importer memverifikasi hash kandidat terhadap ledger server sebelum menulis data; kandidat yang diubah atau keputusan yang kedaluwarsa ditolak. Jangan menghapus metadata untuk melewati validasi. Kandidat tidak dapat dipindahkan ke database lain tanpa ledger yang dipercaya dan prosedur transfer operator.

Frontend: panel **Review EXCLUDE Legacy** pada tab **Cadangan & Database**. Admin memuat sumber privat, memilih mahasiswa, tindakan dan target bila CONTINUE, mengisi alasan, memeriksa preview, lalu menyimpan. Mahasiswa/dosen tidak mendapat panel ini. Form izin kini memilih dosen penerima; desain lainnya dipertahankan.

## Bukti dan batas interpretasi

| Klaim | Bukti aktual | Jenis dan batas |
| --- | --- | --- |
| Sumber nyata memiliki 18 referensi untuk satu jadwal lama | Pembacaan JSON privat dan `scripts/reconcile-legacy.mjs`; hasil `excludeReview` 18/0/0/0/0/18. | Observasi langsung lokal, bukan pembacaan database produksi. |
| Tidak ada keputusan nyata yang dianggap selesai | Tidak dilakukan registrasi/impor sumber nyata; CLI hanya membaca dan tidak menerima keputusan default. | Batas pekerjaan sesi ini; tidak mengklaim keadaan sistem eksternal. |
| Mahasiswa/dosen ditolak | Tes `only admin can review legacy EXCLUDE...` pada HTTP/MariaDB. | Runtime lokal dengan fixture sintetis. |
| Batch, pengecualian individu, idempotency dan concurrency aman pada skenario uji | Tes `admin bulk preview, selected exceptions, final decisions, idempotency, concurrent guards and audit`. | 16 CONTINUE, satu ARCHIVE dan satu DEFER diuji; DEFER tetap unresolved sampai tindakan baru eksplisit. Audit dan collision request diperiksa. Ini bukan keputusan atas 18 mahasiswa nyata. |
| 644 presensi tidak berubah saat review | Tes integrasi `synthetic legacy reconciliation imports 644 records...` membandingkan seluruh baris sebelum/sesudah keputusan ARCHIVE pada database yang berisi 644 record sintetis. Tes kandidat juga membandingkan 644 record sebelum/sesudah. | Runtime sintetis dan kesetaraan payload; produksi tidak diuji. |
| Izin independen tidak mengubah presensi | Tes HTTP membuktikan approval tidak menimpa HADIR dan tidak membuat attendance record; proof download dibatasi pemilik/penerima/admin. | Runtime lokal, provider email dan pengguna nyata tidak dilibatkan. |
| UI review benar-benar dapat menyimpan DEFER | Tes Edge `admin reviews synthetic legacy EXCLUDE with explicit DEFER and persistent audit`. | Profil browser baru, satu pilihan eksplisit, preview 18 menjadi 18 SKS, unresolved tetap 18. |

Pada fase sebelumnya, tes browser sempat gagal: bootstrap CSRF baru mengganti nonce cookie sehingga token frontend yang tersimpan menjadi tidak valid. Endpoint bootstrap kini memakai kembali nonce valid; pemeriksaan origin/HMAC tetap berlaku. Tes integrasi mengunci perilaku bootstrap berulang dan tes browser kemudian lulus. Validasi tidak dinonaktifkan.

## Hasil verifikasi akhir

- Unit: **32 PASS, 0 FAIL, 0 SKIP**.
- Integrasi Node.js 24 / MariaDB 11.4: **27 PASS, 0 FAIL, 0 SKIP**.
- Browser Edge pada fase sebelumnya: **6 subalur PASS**; Node melaporkan 7 termasuk induk, 0 FAIL/SKIP.
- Typecheck, build frontend/backend, gate source/artifact dan pemeriksaan diff: PASS.
- Dry-run data nyata: PARTIAL; hanya 18 keputusan EXCLUDE belum tersedia. Tiga arsip valid, tanpa relasi sesi/jadwal. Record tetap 644; field historis sesi asli tidak berubah; sumber JSON/Excel tidak berubah; konflik workbook 0.

Peringatan ukuran chunk Vite tetap ada. Pengujian browser tidak mencakup seluruh kombinasi CONTINUE/ARCHIVE massal; kombinasi tersebut diuji melalui HTTP/MariaDB. Tidak ada bukti Passenger/IDwebhost, SMTP nyata atau produksi dari tes lokal.

## Tindakan review berikutnya

1. Setelah otorisasi pemrosesan sumber nyata pada lingkungan review privat, admin memuat JSON dan memeriksa 18 mahasiswa di panel. Tidak ada pemuatan sumber nyata yang dilakukan otomatis oleh implementasi ini.
2. Admin memilih target dan alasan masing-masing atau massal, mengecualikan mahasiswa yang memerlukan keputusan individual, memeriksa enrollment/SKS lalu menyimpan. DEFER tetap masuk daftar pekerjaan.
3. Pertahankan tiga izin sebagai arsip tanpa penerima sesuai keputusan pemilik. Jangan menambahkan penerima/sesi hasil tebakan.
4. Ulangi dry-run kandidat dengan ledger yang sesuai, kemudian backup SQL lengkap dan uji restore sebelum mempertimbangkan cutover. Backup SQL harus menyertakan tabel review/ledger dan kunci enkripsi tersimpan privat; JSON domain biasa bukan pengganti ledger tersebut.

Tidak dilakukan SSH, impor data nyata, deployment, push GitHub, perubahan `.env`, atau perubahan database produksi. Pembuatan UI review tidak dihitung sebagai penyelesaian 18 konflik.

## Bukti tambahan finalisasi arsip

Tes unit `three legacy archives preserve history...` memeriksa tiga status, seluruh field sumber, sumber tidak berubah, hash deterministik, penolakan provenance berubah, serta penolakan legacy tanpa penanda pada importer biasa. Tes integrasi `synthetic legacy reconciliation imports 644 records...` kini juga mengimpor tiga arsip sintetis, mengulang impor, memeriksa tepat tiga audit, akses arsip dan unduhan bukti privat bagi admin/pemilik/dosen/mahasiswa lain, penolakan review arsip dan penolakan spoofing arsip pada pengajuan baru. Seluruh 644 baris presensi dibandingkan sebelum/sesudah operasi. Fixture tidak berasal dari data pribadi.
