-- Hadir STMIK
-- Migration 004: Attendance Sessions and Records

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id VARCHAR(100) PRIMARY KEY,
    schedule_id VARCHAR(100) NULL,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    lecturer_id VARCHAR(100) NOT NULL,
    lecturer_name VARCHAR(200) NOT NULL,
    rombel VARCHAR(200) NOT NULL,
    room VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    meeting_number TINYINT UNSIGNED NOT NULL,
    topic TEXT NOT NULL,
    evaluation_method VARCHAR(200) NULL,
    qr_token VARCHAR(255) NOT NULL,
    is_dynamic_qr BOOLEAN NOT NULL DEFAULT FALSE,
    qr_expires_at DATETIME NULL,
    is_open BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_attendance_schedule
        FOREIGN KEY (schedule_id)
        REFERENCES schedules(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_meeting_number
        CHECK (meeting_number BETWEEN 1 AND 16),

    INDEX idx_session_date (date),
    INDEX idx_session_course (course_code),
    INDEX idx_session_lecturer (lecturer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(100) PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    student_nim VARCHAR(50) NOT NULL,
    student_name VARCHAR(200) NOT NULL,
    rombel VARCHAR(200) NOT NULL,
    status ENUM(
        'HADIR','IZIN','SAKIT','ALPHA'
    ) NOT NULL,
    scanned_at DATETIME NOT NULL,
    verification_method ENUM(
        'QR_SCAN',
        'MANUAL_DOSEN',
        'AUTO_SCHEDULE',
        'IZIN_APPROVED'
    ) NOT NULL,
    notes TEXT NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    location_accuracy DECIMAL(10,2) NULL,

    CONSTRAINT fk_record_session
        FOREIGN KEY (session_id)
        REFERENCES attendance_sessions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_record_student
        FOREIGN KEY (student_nim)
        REFERENCES students(nim)
        ON DELETE RESTRICT,

    CONSTRAINT uq_session_student
        UNIQUE (session_id, student_nim),

    INDEX idx_record_student (student_nim),
    INDEX idx_record_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
