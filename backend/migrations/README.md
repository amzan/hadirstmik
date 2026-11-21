# Migrasi Database Hadir STMIK

Database: stmikkeb_hadir
Engine: MariaDB 11.4
Backend: Node.js + Express + mysql2

Tahapan:
001 - Users dan autentikasi
002 - Students dan rombels
003 - Courses dan schedules
004 - Attendance sessions dan records
005 - Leave requests
006 - Device sessions dan audit
007 - Migrasi data JSON/localStorage

Aturan:
- Jangan mengubah database stmikkeb_humas.
- Jangan menyimpan password plaintext.
- Jangan mengimpor data sebelum backup diverifikasi.
- Jalankan migrasi secara bertahap.
- Simpan file .env di luar Git.
