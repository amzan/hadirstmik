-- Preserve every student reference when an admin corrects its login identifier.
ALTER TABLE student_rombels DROP FOREIGN KEY fk_sr_student,
 ADD CONSTRAINT fk_sr_student_identity FOREIGN KEY (student_nim) REFERENCES students(nim) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE attendance_records DROP FOREIGN KEY fk_record_student,
 ADD CONSTRAINT fk_record_student_identity FOREIGN KEY (student_nim) REFERENCES students(nim) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE leave_requests DROP FOREIGN KEY fk_leave_student,
 ADD CONSTRAINT fk_leave_student_identity FOREIGN KEY (student_nim) REFERENCES students(nim) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE student_schedule_overrides DROP FOREIGN KEY student_schedule_overrides_ibfk_1,
 ADD CONSTRAINT student_schedule_overrides_ibfk_1_identity FOREIGN KEY (student_nim) REFERENCES students(nim) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE session_roster DROP FOREIGN KEY session_roster_ibfk_2,
 ADD CONSTRAINT session_roster_ibfk_2_identity FOREIGN KEY (student_nim) REFERENCES students(nim) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE audit_logs ADD COLUMN change_details JSON NULL;

