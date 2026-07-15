import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProgressInsights } from './progress-insights.js';

test('progress insights are derived from completed practice history', () => {
  const insights = buildProgressInsights({
    history: [
      { meditation_id: 'sleep', completed: true, completion_percent: 96, last_played: '2026-07-14T20:15:00Z', meditations: { category: 'sleep', title: 'Deep Sleep' } },
      { meditation_id: 'focus', completed: true, completion_percent: 92, last_played: '2026-07-12T09:00:00Z', meditations: { category: 'focus', title: 'Focused Calm' } },
      { meditation_id: 'anxiety', completed: false, completion_percent: 10, last_played: '2026-07-11T20:00:00Z', meditations: { category: 'anxiety', title: 'Anxiety Relief' } }
    ],
    verifiedSessions: [
      { meditation_id: 'sleep', listened_seconds: 900, completed_at: '2026-07-14T20:15:00Z' },
      { meditation_id: 'sleep', listened_seconds: 600, completed_at: '2026-07-13T21:00:00Z' },
      { meditation_id: 'focus', listened_seconds: 1020, completed_at: '2026-07-12T09:00:00Z' }
    ],
    breathSessions: [],
    practiceDays: [
      { local_date: '2026-07-13', minutes: 20, sessions: 2 },
      { local_date: '2026-07-14', minutes: 10, sessions: 1 },
      { local_date: '2026-06-01', minutes: 90, sessions: 8 }
    ],
    practiceDayKeys: ['2026-07-12', '2026-07-13', '2026-07-14', '2026-06-01'],
    totalListeningMinutes: 42,
    totalSessions: 3,
    localDate: '2026-07-15',
    timeZone: 'UTC'
  });

  assert.equal(insights.favoriteCategory, 'sleep');
  assert.equal(insights.favoriteCategoryCount, 2);
  assert.equal(insights.favoriteMeditationTitle, 'Deep Sleep');
  assert.equal(insights.favoritePracticeTime, 'evening');
  assert.equal(insights.favoritePracticeTimeCount, 2);
  assert.equal(insights.favoritePracticeTimeDays, 2);
  assert.equal(insights.averageSessionMinutes, 14);
  assert.equal(insights.completedPracticeSamples, 3);
  assert.equal(insights.monthlyPracticeDays, 3);
  assert.equal(insights.monthlyConsistency, 10);
  assert.equal(insights.bestPracticeWeekday, 0);
  assert.equal(insights.bestPracticeWeekdayCount, 1);
  assert.equal(insights.observedPracticeWeeks, 2);
});

test('progress insights return honest empty values without practice data', () => {
  const insights = buildProgressInsights({
    history: [],
    breathSessions: [],
    practiceDays: [],
    practiceDayKeys: [],
    totalListeningMinutes: 0,
    totalSessions: 0,
    localDate: '2026-07-15',
    timeZone: 'Invalid/Timezone'
  });

  assert.deepEqual(insights, {
    favoriteCategory: null,
    favoriteCategoryCount: 0,
    favoriteMeditationTitle: null,
    favoritePracticeTime: null,
    favoritePracticeTimeCount: 0,
    favoritePracticeTimeDays: 0,
    averageSessionMinutes: 0,
    completedPracticeSamples: 0,
    monthlyPracticeDays: 0,
    monthlyConsistency: 0,
    bestPracticeWeekday: null,
    bestPracticeWeekdayCount: 0,
    observedPracticeWeeks: 0
  });
});

test('legacy completion rows cannot create confident patterns without verified sessions', () => {
  const insights = buildProgressInsights({
    history: [
      { meditation_id: 'sleep', completed: true, last_played: '2026-07-14T20:15:00Z', meditations: { category: 'sleep', title: 'Deep Sleep' } }
    ],
    verifiedSessions: [],
    breathSessions: [],
    practiceDays: [],
    practiceDayKeys: ['2026-07-14'],
    totalListeningMinutes: 90,
    totalSessions: 1,
    localDate: '2026-07-15',
    timeZone: 'UTC'
  });

  assert.equal(insights.completedPracticeSamples, 0);
  assert.equal(insights.averageSessionMinutes, 0);
  assert.equal(insights.favoriteCategory, null);
  assert.equal(insights.favoritePracticeTime, null);
});
