ALTER TABLE leave_requests
  ADD COLUMN archive_marker VARCHAR(50) NULL,
  ADD COLUMN legacy_archive_policy VARCHAR(80) NULL,
  ADD COLUMN legacy_source_hash CHAR(64) NULL,
  ADD CONSTRAINT chk_legacy_leave_archive CHECK (
    (archive_marker IS NULL AND legacy_archive_policy IS NULL AND legacy_source_hash IS NULL)
    OR (archive_marker = 'LEGACY_ARCHIVED_NO_RECIPIENT'
      AND legacy_archive_policy = 'owner-legacy-no-recipient-v1'
      AND legacy_source_hash IS NOT NULL AND session_id IS NULL)
  );
