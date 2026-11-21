-- The owner confirmed that all existing sessions belong to the current period.
ALTER TABLE attendance_sessions
  ADD COLUMN academic_period VARCHAR(100) NOT NULL DEFAULT 'Semester Ganjil 2026/2027',
  DROP INDEX uq_schedule_meeting,
  ADD CONSTRAINT uq_schedule_meeting UNIQUE (schedule_id,academic_period,date,meeting_number,active_slot);
