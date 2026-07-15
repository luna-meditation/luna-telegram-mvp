import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCanonicalCurrentWeek, buildCanonicalDailyActivity, buildSevenDayMoodTrend, mondayForDateKey, shiftDateKey } from './progress-model.js';

test('local calendar week boundaries remain Monday through Sunday', () => {
  assert.equal(mondayForDateKey('2026-07-15'), '2026-07-13');
  assert.equal(shiftDateKey(mondayForDateKey('2026-07-15'), 6), '2026-07-19');
  assert.equal(shiftDateKey(mondayForDateKey('2026-07-15'), -1), '2026-07-12');
});

test('week totals and Monday-Sunday markers come from the same rows', () => {
  const week = buildCanonicalCurrentWeek({
    localDate: '2026-07-15',
    practiceDays: [
      { local_date: '2026-07-13', minutes: 12, sessions: 1 },
      { local_date: '2026-07-14', minutes: 21, sessions: 2 },
      { local_date: '2026-07-14', minutes: 3, sessions: 1 }
    ]
  });
  assert.equal(week.weekStart, '2026-07-13');
  assert.equal(week.completedDays, 2);
  assert.equal(week.completedSessions, 4);
  assert.equal(week.listeningMinutes, 36);
  assert.deepEqual(week.days.map((day) => day.state), ['completed', 'completed', 'current', 'future', 'future', 'future', 'future']);
});

test('a missing mood or practice day is never synthesized as completed', () => {
  const week = buildCanonicalCurrentWeek({ localDate: '2026-07-15', practiceDays: [] });
  assert.equal(week.completedDays, 0);
  assert.equal(week.listeningMinutes, 0);
  assert.equal(week.days[0]?.state, 'missed');
  assert.equal(week.days[2]?.state, 'current');
});

test('mood journey keeps one point per day and never invents Calm for empty dates', () => {
  const trend = buildSevenDayMoodTrend({
    localDate: '2026-07-15',
    checkins: [
      { local_date: '2026-07-13', mood: 'tired', sleep_range: '4_6' },
      { local_date: '2026-07-13', mood: 'focused', sleep_range: '6_8' }
    ],
    activity: { '2026-07-13': { minutes: 12, sessions: 1 } },
    practices: new Map([['2026-07-13', { id: 'focus-id', title: 'Focused Calm' }]])
  });

  assert.equal(trend.length, 7);
  assert.equal(trend.filter((day) => day.key === '2026-07-13').length, 1);
  assert.equal(trend.find((day) => day.key === '2026-07-13')?.mood, 'focused');
  assert.equal(trend.find((day) => day.key === '2026-07-13')?.listeningMinutes, 12);
  assert.equal(trend.find((day) => day.key === '2026-07-14')?.mood, null);
  assert.equal(trend.some((day) => day.mood === 'calm'), false);
});

test('verified playback replaces the meditation aggregate without double counting', () => {
  const week = buildCanonicalCurrentWeek({
    localDate: '2026-07-15',
    practiceDays: [
      { local_date: '2026-07-14', source: 'meditation', minutes: 15, sessions: 1 },
      { local_date: '2026-07-14', source: 'breath', minutes: 3, sessions: 1 }
    ],
    playbackSessions: [
      { local_date: '2026-07-14', listened_seconds: 600, completed_at: '2026-07-14T12:00:00Z' },
      { local_date: '2026-07-14', listened_seconds: 90, completed_at: null }
    ]
  });

  assert.equal(week.completedDays, 1);
  assert.equal(week.listeningMinutes, 14);
  assert.equal(week.completedSessions, 2);
  assert.equal(week.days[1]?.minutes, 14);
});

test('daily activity keeps verified playback authoritative across rolling mood dates', () => {
  const activity = buildCanonicalDailyActivity({
    practiceDays: [
      { local_date: '2026-07-11', source: 'meditation', minutes: 90, sessions: 1 },
      { local_date: '2026-07-11', source: 'breath', minutes: 3, sessions: 1 }
    ],
    playbackSessions: [
      { local_date: '2026-07-11', listened_seconds: 642.16, completed_at: '2026-07-11T20:00:00Z' }
    ]
  });

  assert.deepEqual(activity['2026-07-11'], { minutes: 13, sessions: 2 });
});

test('one verified minute counts as a practice day without inventing a completion', () => {
  const week = buildCanonicalCurrentWeek({
    localDate: '2026-07-15',
    practiceDays: [],
    playbackSessions: [{ local_date: '2026-07-15', listened_seconds: 60, completed_at: null }]
  });

  assert.equal(week.completedDays, 1);
  assert.equal(week.completedSessions, 0);
  assert.equal(week.listeningMinutes, 1);
  assert.equal(week.days[2]?.state, 'completed');
});
