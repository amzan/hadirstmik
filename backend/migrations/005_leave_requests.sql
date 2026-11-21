-- Migration 005: Pengajuan Izin dan Sakit

CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(100) PRIMARY KEY,
    student_nim VARCHAR(50) NOT NULL,
    student_name VARCHAR(200) NOT NULL,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    rombel VARCHAR(200) NOT NULL,
    date DATE NOT NULL,
    status ENUM('PENDING','APPROVED','REJECTED')
        NOT NULL DEFAULT 'PENDING',
    type ENUM('IZIN','SAKIT') NOT NULL,
    reason TEXT NOT NULL,
    proof_document_url TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_leave_student
        FOREIGN KEY (student_nim)
        REFERENCES students(nim)
        ON DELETE RESTRICT,

    INDEX idx_leave_student (student_nim),
    INDEX idx_leave_status (status),
    INDEX idx_leave_date (date),
    INDEX idx_leave_course (course_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
