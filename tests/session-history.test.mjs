import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionsForSchedule } from '../src/utils/sessionHistory.ts';
import { lecturerHistoryFixture } from './fixtures.mjs';

test('history follows schedule and lecturer IDs despite historical names and rombel labels', () => {
  const source = lecturerHistoryFixture(), before = JSON.stringify(source);
  const history = sessionsForSchedule(source.schedules[0], source.sessions);
  assert.deepEqual(history.map(session => session.meetingNumber), [1, 2, 3, 4, 5]);
  assert(history.every(session => !session.isOpen));
  assert.equal(JSON.stringify(source), before);
});

test('same course and label never transfer history across schedules or lecturer IDs', () => {
  const source = lecturerHistoryFixture();
  assert.deepEqual(sessionsForSchedule(source.schedules[1], source.sessions), []);
  assert.deepEqual(sessionsForSchedule(source.schedules[2], source.sessions), []);
  const schedule = source.schedules[0];
  assert.deepEqual(sessionsForSchedule(schedule, [{ ...source.sessions[0], lecturerId: 'other-lecturer' }]), []);
  assert.deepEqual(sessionsForSchedule(schedule, [{ ...source.sessions[0], scheduleId: undefined }]), []);
  assert.deepEqual(sessionsForSchedule(schedule, [{ ...source.sessions[0], isArchived: true }]), []);
});
