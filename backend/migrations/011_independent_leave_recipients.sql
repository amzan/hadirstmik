ALTER TABLE leave_requests MODIFY COLUMN course_code VARCHAR(50) NULL;
ALTER TABLE leave_requests MODIFY COLUMN course_name VARCHAR(200) NULL;
CREATE TABLE IF NOT EXISTS leave_recipients (
  leave_id VARCHAR(100) NOT NULL,
  lecturer_id VARCHAR(100) NOT NULL,
  PRIMARY KEY (leave_id,lecturer_id),
  FOREIGN KEY (leave_id) REFERENCES leave_requests(id) ON DELETE RESTRICT,
  FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
