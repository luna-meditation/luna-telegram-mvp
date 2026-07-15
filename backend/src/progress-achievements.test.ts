import assert from 'node:assert/strict';
import test from 'node:test';
import { achievementDefinitions, buildAchievementItems, progressToTarget, type AchievementStats } from './progress-achievements.js';

const baseStats: AchievementStats = {
  completedMeditations: 2,
  completedBreathSessions: 0,
  completed: 2,
  minutesListened: 42,
  currentStreak: 4,
  longestStreak: 6,
  checkinsCount: 3,
  hasPremiumAccess: false,
  gardenLevel: 2,
  hasMorningPractice: false,
  hasEveningPractice: true,
  practiceDays: 5,
  completedWeeks: 0,
  perfectWeeks: 0,
  categoryCounts: { sleep: 2 }
};

test('achievement progress is deterministic and clamped', () => {
  assert.equal(progressToTarget(42, 100), 42);
  assert.equal(progressToTarget(120, 100), 100);
  assert.equal(progressToTarget(-1, 10), 0);

  const items = buildAchievementItems(baseStats, []);
  assert.equal(items.find((item) => item.id === 'three_meditations')?.progress, 67);
  assert.equal(items.find((item) => item.id === 'evening_practice')?.unlocked, true);
  assert.equal(items.find((item) => item.id === 'seven_day_rhythm')?.progress, 86);
});

test('Moon Garden achievements stop at the real seven-upgrade maximum', () => {
  const gardenDefinitions = achievementDefinitions.filter((item) => item.category === 'garden');
  assert.deepEqual(gardenDefinitions.map((item) => item.target), [3, 5, 7]);
  assert.equal(gardenDefinitions.some((item) => item.target > 7), false);

  const items = buildAchievementItems({ ...baseStats, gardenLevel: 7 }, []);
  assert.equal(items.filter((item) => item.category === 'garden' && item.unlocked).length, 3);
});
