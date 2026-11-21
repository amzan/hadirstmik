-- Preserve cancelled executions and their records while allowing a new execution.
ALTER TABLE attendance_sessions
  ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN archived_at DATETIME NULL,
  ADD COLUMN archived_by VARCHAR(100) NULL,
  ADD COLUMN archive_reason ENUM('RESET','ARCHIVE') NULL,
  ADD COLUMN reopened_at DATETIME NULL,
  ADD COLUMN active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN is_archived=0 THEN 1 ELSE NULL END) STORED,
  ADD CONSTRAINT fk_session_archive_actor FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT chk_session_archive_closed CHECK (is_archived=0 OR is_open=0),
  DROP INDEX uq_schedule_meeting,
  ADD CONSTRAINT uq_schedule_meeting UNIQUE (schedule_id,date,meeting_number,active_slot),
  ADD INDEX idx_session_archived (is_archived,lecturer_id);
ALTER TABLE attendance_record_audit ADD COLUMN method VARCHAR(30) NULL;
