-- Hadir STMIK
-- Migration 002: Students and Rombels

CREATE TABLE IF NOT EXISTS rombels (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    prodi VARCHAR(100) NOT NULL,
    semester INT NOT NULL,
    academic_year VARCHAR(50),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at DATETIME NULL,
    INDEX idx_rombel_prodi (prodi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS students (
    nim VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    prodi VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_name (name),
    INDEX idx_student_prodi (prodi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS student_rombels (
    student_nim VARCHAR(50) NOT NULL,
    rombel_id VARCHAR(100) NOT NULL,
    PRIMARY KEY (student_nim, rombel_id),
    CONSTRAINT fk_sr_student
        FOREIGN KEY (student_nim)
        REFERENCES students(nim)
        ON DELETE CASCADE,
    CONSTRAINT fk_sr_rombel
        FOREIGN KEY (rombel_id)
        REFERENCES rombels(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
