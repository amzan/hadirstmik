-- Preserve millisecond timestamps from legacy JSON instead of truncating historical evidence.
ALTER TABLE attendance_records MODIFY COLUMN scanned_at DATETIME(3) NOT NULL;
ALTER TABLE attendance_sessions MODIFY COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
