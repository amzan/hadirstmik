import { CURRENT_ACADEMIC_PERIOD } from '../../shared/attendance-policy.mjs';
import type { AttendanceSession, ScheduleItem } from '../types/attendance';

export function sessionsForSchedule(schedule: ScheduleItem, sessions: AttendanceSession[]): AttendanceSession[] {
  // Historical rombel/name labels may differ from the current schedule display.
  return sessions.filter(session => (!session.academicPeriod || session.academicPeriod === CURRENT_ACADEMIC_PERIOD) && !session.isArchived && session.scheduleId === schedule.id && session.lecturerId === schedule.lecturerId);
}
