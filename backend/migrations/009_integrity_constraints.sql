ALTER TABLE courses ADD CONSTRAINT fk_course_lecturer FOREIGN KEY (default_lecturer_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE schedules ADD CONSTRAINT fk_schedule_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE schedules ADD CONSTRAINT fk_schedule_course FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE RESTRICT;
ALTER TABLE attendance_sessions ADD CONSTRAINT fk_session_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE schedules ADD CONSTRAINT chk_schedule_time CHECK (start_time < end_time);
ALTER TABLE attendance_sessions ADD CONSTRAINT chk_session_time CHECK (start_time < end_time);
ALTER TABLE attendance_sessions ADD CONSTRAINT uq_schedule_meeting UNIQUE (schedule_id,date,meeting_number);
ALTER TABLE leave_requests ADD CONSTRAINT uq_leave_session_student UNIQUE (session_id,student_nim);
