-- Hadir STMIK
-- Migration 003: Courses, Schedules and Rombel Relations

CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    sks TINYINT UNSIGNED NOT NULL,
    prodi VARCHAR(100) NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    default_lecturer_id VARCHAR(100) NOT NULL,
    default_lecturer_name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at DATETIME NULL,
    INDEX idx_courses_prodi_semester (prodi, semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR(100) PRIMARY KEY,
    day ENUM('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    sks TINYINT UNSIGNED NOT NULL,
    lecturer_id VARCHAR(100) NOT NULL,
    lecturer_name VARCHAR(200) NOT NULL,
    room VARCHAR(100) NOT NULL,
    rombel VARCHAR(200) NOT NULL,
    prodi VARCHAR(100) NOT NULL,
    meeting_dates JSON NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at DATETIME NULL,
    INDEX idx_schedule_course (course_code),
    INDEX idx_schedule_lecturer (lecturer_id),
    INDEX idx_schedule_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rombel_schedules (
    rombel_id VARCHAR(100) NOT NULL,
    schedule_id VARCHAR(100) NOT NULL,
    PRIMARY KEY (rombel_id, schedule_id),
    CONSTRAINT fk_rs_rombel
        FOREIGN KEY (rombel_id)
        REFERENCES rombels(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_rs_schedule
        FOREIGN KEY (schedule_id)
        REFERENCES schedules(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
