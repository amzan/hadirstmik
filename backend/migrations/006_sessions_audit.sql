-- Migration 006: Device Sessions & Audit

CREATE TABLE IF NOT EXISTS device_sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(200),
    device_type ENUM('desktop','mobile','tablet'),
    browser VARCHAR(100),
    os VARCHAR(100),
    ip_address VARCHAR(45),
    session_token_hash VARCHAR(255) NOT NULL,
    login_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    status ENUM('ACTIVE','TERMINATED')
        NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT fk_device_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_device_user (user_id),
    INDEX idx_device_status (status),
    INDEX idx_device_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance_record_audit (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    attendance_record_id VARCHAR(100) NOT NULL,
    old_status ENUM('HADIR','IZIN','SAKIT','ALPHA') NULL,
    new_status ENUM('HADIR','IZIN','SAKIT','ALPHA') NOT NULL,
    changed_by VARCHAR(100) NULL,
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_record
        FOREIGN KEY (attendance_record_id)
        REFERENCES attendance_records(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_audit_actor
        FOREIGN KEY (changed_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_audit_record (attendance_record_id),
    INDEX idx_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_user_id VARCHAR(100) NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    details JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_log_actor
        FOREIGN KEY (actor_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_log_entity (entity_type, entity_id),
    INDEX idx_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
