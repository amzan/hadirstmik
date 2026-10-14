const fs = require('fs');
const path = require('path');

const userBackup = {
  "version": "1.0.0",
  "timestamp": "2026-10-13T09:30:16.694Z",
  "appName": "Sistem Presensi QR Kampus - STMIK PGRI Arungbinang Kebumen",
  "campusName": "STMIK PERSATUAN GURU REPUBLIK INDONESIA (PGRI) ARUNGBINANG KEBUMEN",
  "semester": "Semester Ganjil 2026/2027",
  "exportedBy": {
    "userId": "user-admin-1",
    "userName": "Administrator Akademik (BAAK)",
    "role": "admin"
  },
  "summary": {
    "totalUsers": 17,
    "totalStudents": 64,
    "totalCourses": 29,
    "totalSchedules": 35,
    "totalSessions": 4,
    "totalRecords": 84,
    "totalLeaveRequests": 3
  },
  "data": {
    "users": [
      {
        "id": "user-admin-1",
        "username": "baak",
        "name": "Administrator Akademik (BAAK)",
        "email": "baak@stmikkebumen.ac.id",
        "role": "admin",
        "avatarUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "title": "Kepala BAAK",
        "phone": "081234567890",
        "rombel": "",
        "prodi": "Teknologi Informasi"
      },
      {
        "id": "dosen-1",
        "username": "197805122005011001",
        "nidn": "197805122005011001",
        "name": "Mucharobin, S.Pd.I., M.Pd.",
        "email": "mucharobin@stmikarungbinang.ac.id",
        "role": "dosen",
        "prodi": "Teknologi Informasi",
        "academicRank": "Lektor",
        "title": "Dosen Tetap",
        "officeRoom": "Gedung A Lt. 2 R. Dosen 201",
        "avatarUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "phone": "081234567801",
        "rombel": ""
      },
      {
        "id": "dosen-2",
        "username": "198203152008012002",
        "nidn": "198203152008012002",
        "name": "Ahirul Hasanah, S.Pd.I., M.M.",
        "email": "ahirul.hasanah@stmikarungbinang.ac.id",
        "role": "dosen",
        "prodi": "Teknologi Informasi",
        "academicRank": "Lektor",
        "title": "Dosen Tetap",
        "officeRoom": "Gedung A Lt. 2 R. Dosen 202",
        "avatarUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
        "phone": "081234567802",
        "rombel": ""
      },
      {
        "id": "dosen-3",
        "username": "197508202003011003",
        "nidn": "197508202003011003",
        "name": "Nur Wasito, S.Pd., M.Pd.",
        "email": "nur.wasito@stmikarungbinang.ac.id",
        "role": "dosen",
        "prodi": "Teknologi Informasi",
        "academicRank": "Lektor Kepala",
        "title": "Wakil Ketua I Bidang Akademik",
        "officeRoom": "Gedung Rektorat Lt. 1 R. Warek 1",
        "avatarUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
        "phone": "081234567803",
        "rombel": ""
      },
      {
        "id": "dosen-4",
        "username": "198011242006041004",
        "nidn": "198011242006041004",
        "name": "Agus Jaka Sri Hartanta, S.Pd., M.Kom.",
        "email": "agus.jaka@stmik-arungbinang.ac.id",
        "role": "dosen",
        "prodi": "Teknologi Informasi",
        "academicRank": "Lektor",
        "title": "Dosen Wali TI / Dosen Tetap",
        "officeRoom": "Gedung Lab Komputer Lt. 2 R. Kaprodi TI",
        "avatarUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        "phone": "081234567804"
      },
      {
        "id": "dosen-5",
        "username": "198509182010011005",
        "nidn": "198509182010011005",
        "name": "Ahmad Fauzi Mabrur, S.T., M.Eng.",
        "email": "ahmad.fauzi@stmik-arungbinang.ac.id",
        "role": "dosen",
        "prodi": "Teknologi Informasi",
        "academicRank": "Asisten Ahli",
        "title": "Dosen Tetap",
        "officeRoom": "Gedung A Lt. 2 R. Dosen 205",
        "avatarUrl": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
        "phone": "081234567805"
      },
      {
        "id": "dosen-6",
        "username": "198604122012022006",
        "nidn": "198604122012022006",
        "name": "Fitriani Dwi Ratna Sari, S.T., M.M.",
        "email": "fitriani.dwi@stmik-arungbinang.ac.id",
        "role": "dosen",
        "prodi": "Manajemen Informatika",
        "academicRank": "Lektor",
        "title": "Dosen Wali MI / Dosen Tetap",
        "officeRoom": "Gedung Lab Komputer Lt. 2 R. Kaprodi MI",
        "avatarUrl": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
        "phone": "081234567806"
      },
      {
        "id": "dosen-7",
        "username": "199002142015011007",
        "nidn": "199002142015011007",
        "name": "Habib Pijar Bawana Naryananda, S.T., MEM",
        "email": "habib.pijar@stmik-arungbinang.ac.id",
        "role": "dosen",
        "prodi": "Teknologi Informasi",
        "academicRank": "Asisten Ahli",
        "title": "Dosen Tetap",
        "officeRoom": "Gedung A Lt. 2 R. Dosen 207",
        "avatarUrl": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150",
        "phone": "081234567807"
      },
      {
        "id": "dosen-8",
        "username": "197001011998031008",
        "nidn": "197001011998031008",
        "name": "Dr. Teguh Rokhmani, S.Pd., M.M.",
        "email": "teguh.rokhmani@stmik-arungbinang.ac.id",
        "role": "dosen",
        "prodi": "Teknologi Informasi",
        "academicRank": "Lektor Kepala",
        "title": "Dosen Senior",
        "officeRoom": "Gedung Pascasarjana Lt. 1",
        "avatarUrl": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150",
        "phone": "081234567808"
      },
      {
        "id": "dosen-9",
        "username": "198906232014021009",
        "nidn": "198906232014021009",
        "name": "Fandi Ahmad Kurniawan, S.Pd., M.M.",
        "email": "fandi.ahmad@stmik-arungbinang.ac.id",
        "role": "dosen",
        "prodi": "Manajemen Informatika",
        "academicRank": "Asisten Ahli",
        "title": "Dosen Tetap",
        "officeRoom": "Gedung A Lt. 2 R. Dosen 209",
        "avatarUrl": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150",
        "phone": "081234567809"
      },
      {
        "id": "dosen-10",
        "username": "0105049302",
        "nidn": "0105049302",
        "name": "Ammar Fauzan, S.Pd., M.Kom.",
        "email": "fauzan.ammar@gmail.com",
        "role": "dosen",
        "prodi": "Teknologi Informasi",
        "academicRank": "Asisten Ahli",
        "title": "Dosen Tetap",
        "officeRoom": "Gedung A Lt. 2 R. Dosen TI 210",
        "avatarUrl": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150", // or the uploaded avatar
        "phone": "081234567810",
        "rombel": "",
        "password": "1993Amzan.0504"
      },
      {
        "id": "dosen-11",
        "username": "197607142004011011",
        "nidn": "197607142004011011",
        "name": "Muhyat, S.E., M.E.",
        "email": "muhyat@stmik-arungbinang.ac.id",
        "role": "dosen",
        "prodi": "Manajemen Informatika",
        "academicRank": "Lektor",
        "title": "Dosen Tetap",
        "officeRoom": "Gedung A Lt. 2 R. Dosen MI 211",
        "avatarUrl": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150",
        "phone": "081234567811"
      },
      {
        "id": "mhs-25TI0003",
        "username": "25TI0003",
        "name": "Ahmad Saefudin",
        "email": "25ti0003@student.stmik-arungbinang.ac.id",
        "role": "mahasiswa",
        "prodi": "Teknologi Informasi",
        "rombel": "TI 3",
        "avatarUrl": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150",
        "phone": "085712340003"
      },
      {
        "id": "mhs-26TI0001",
        "username": "26TI0001",
        "name": "Anggi Nauli Utami",
        "email": "26ti0001@student.stmik-arungbinang.ac.id",
        "role": "mahasiswa",
        "prodi": "Teknologi Informasi",
        "rombel": "TI 1A",
        "avatarUrl": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        "phone": "085712340001"
      },
      {
        "id": "mhs-24MI0001",
        "username": "24MI0001",
        "name": "Ahmad Abror",
        "email": "24mi0001@student.stmik-arungbinang.ac.id",
        "role": "mahasiswa",
        "prodi": "Manajemen Informatika",
        "rombel": "MI 5A",
        "avatarUrl": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150",
        "phone": "085712340011"
      },
      {
        "id": "mhs-23MI0130",
        "username": "23MI0130",
        "name": "LUHUR BUDI UTAMI",
        "email": "23mi0130@student.stmik-arungbinang.ac.id",
        "role": "mahasiswa",
        "prodi": "Manajemen Informatika",
        "rombel": "MI 1A",
        "avatarUrl": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
        "phone": "085712340021"
      },
      {
        "id": "mhs-24TI0001",
        "username": "24TI0001",
        "name": "Achmad Charis Muhlasin",
        "email": "24ti0001@student.stmik-arungbinang.ac.id",
        "role": "mahasiswa",
        "prodi": "Teknologi Informasi",
        "rombel": "TI 5",
        "avatarUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "phone": "085712340031"
      }
    ]
  }
};

console.log("Loaded backup with", userBackup.data.users.length, "users");
