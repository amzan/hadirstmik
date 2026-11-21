CREATE TABLE IF NOT EXISTS leave_proofs (
  id VARCHAR(100) PRIMARY KEY,
  owner_user_id VARCHAR(100) NOT NULL,
  mime_type ENUM('application/pdf','image/png','image/jpeg') NOT NULL,
  content MEDIUMBLOB NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS proof_id VARCHAR(100) NULL;
ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_proof FOREIGN KEY (proof_id) REFERENCES leave_proofs(id) ON DELETE RESTRICT;
