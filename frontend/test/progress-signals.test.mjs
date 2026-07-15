import assert from 'node:assert/strict';
import test from 'node:test';
import { wellbeingSignalPath, wellbeingSignalsForCheckin } from '../src/components/progress/progressMoodSignals.ts';
import { progressPatternEvidence } from '../src/components/progress/progressPatterns.ts';

test('wellbeing graph mapping is deterministic and never defaults an empty day to Calm', () => {
  assert.deepEqual(wellbeingSignalsForCheckin(null, null), { calm: null, stress: null, sleep: null });
  assert.deepEqual(wellbeingSignalsForCheckin('calm', '8_plus'), { calm: 4, stress: 0, sleep: 4 });
  assert.deepEqual(wellbeingSignalsForCheckin('focused', '6_8'), { calm: 3, stress: 1, sleep: 3 });
  assert.deepEqual(wellbeingSignalsForCheckin('anxious', '4_6'), { calm: 0, stress: 4, sleep: 1 });
  assert.deepEqual(wellbeingSignalsForCheckin('tired', 'less_than_4'), { calm: 1, stress: 2, sleep: 0 });
});

test('missing graph days split the path instead of implying interpolation', () => {
  const path = wellbeingSignalPath([4, null, 2]);
  assert.equal((path.match(/M/g) ?? []).length, 2);
  assert.equal((path.match(/L/g) ?? []).length, 0);
});

test('Personal Patterns only become available after their evidence thresholds', () => {
  const base = {
    favoriteCategory: 'sleep', favoriteCategoryCount: 2, favoriteMeditationTitle: 'Deep Sleep',
    favoritePracticeTime: 'evening', favoritePracticeTimeCount: 4, favoritePracticeTimeDays: 2,
    averageSessionMinutes: 14, completedPracticeSamples: 4, monthlyPracticeDays: 4, monthlyConsistency: 13,
    bestPracticeWeekday: 1, bestPracticeWeekdayCount: 2, observedPracticeWeeks: 1
  };
  assert.deepEqual(progressPatternEvidence(base), { time: false, category: false, weekday: false, average: true });
  assert.deepEqual(progressPatternEvidence({
    ...base,
    favoriteCategoryCount: 3,
    favoritePracticeTimeCount: 5,
    favoritePracticeTimeDays: 3,
    completedPracticeSamples: 5,
    bestPracticeWeekdayCount: 3,
    observedPracticeWeeks: 2
  }), { time: true, category: true, weekday: true, average: true });
});
