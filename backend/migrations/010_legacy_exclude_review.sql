CREATE TABLE IF NOT EXISTS legacy_exclude_batches (
  source_hash CHAR(64) PRIMARY KEY,
  encrypted_source LONGTEXT NOT NULL,
  candidate_hash CHAR(64) NULL,
  created_by VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS legacy_exclude_items (
  id CHAR(64) PRIMARY KEY,
  source_hash CHAR(64) NOT NULL,
  student_nim VARCHAR(50) NOT NULL,
  old_schedule_id VARCHAR(100) NOT NULL,
  action ENUM('CONTINUE','ARCHIVE','DEFER') NULL,
  new_schedule_id VARCHAR(100) NULL,
  decided_by VARCHAR(100) NULL,
  decided_at DATETIME NULL,
  reason TEXT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE (source_hash,student_nim,old_schedule_id),
  FOREIGN KEY (source_hash) REFERENCES legacy_exclude_batches(source_hash) ON DELETE RESTRICT,
  FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS legacy_exclude_decisions (
  request_id VARCHAR(100) PRIMARY KEY,
  source_hash CHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  action ENUM('CONTINUE','ARCHIVE','DEFER') NOT NULL,
  new_schedule_id VARCHAR(100) NULL,
  student_items JSON NOT NULL,
  admin_id VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  decided_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result JSON NOT NULL,
  FOREIGN KEY (source_hash) REFERENCES legacy_exclude_batches(source_hash) ON DELETE RESTRICT,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
