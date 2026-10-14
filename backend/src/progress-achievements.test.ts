import assert from 'node:assert/strict';
import test from 'node:test';
import { achievementDefinitions, buildAchievementItems, progressToTarget, type AchievementStats } from './progress-achievements.js';
import { moonSeedsForNewActiveDay, streakMoonSeedTotal } from './streak-rewards.js';

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
test('previously earned achievements and stored progress never disappear after changing criteria',()=>{
 const rows=[{achievement_id:'hundred_sessions',unlocked_at:'2026-01-01',progress:100},{achievement_id:'thousand_minutes',progress:75}];
 const items=buildAchievementItems(baseStats,rows);
 assert.equal(items.find(i=>i.id==='hundred_sessions')?.unlocked,true);
 assert.equal(items.find(i=>i.id==='hundred_sessions')?.unlockedAt,'2026-01-01');
 assert.equal(items.find(i=>i.id==='thousand_minutes')?.progress,75);
 assert.equal(items.find(i=>i.id==='first_week')?.family,'devoted');
});
test('Oracle achievements use completed distinct stored readings and never grant Moon Seeds',()=>{
 const items=buildAchievementItems({...baseStats,tarotReadings:10,dailyCards:7,aiConversations:1},[]);
 assert.equal(items.filter(i=>i.family==='oracle'&&i.unlocked).length,3);
 assert.equal(items.find(i=>i.id==='first_luna_conversation')?.family,'seeker');
 assert.equal(items.some(i=>'moonSeeds' in i||'reward' in i),false);
});

test('each new streak day earns a Moon Seed and milestones add one-time bonuses', () => {
  assert.equal(streakMoonSeedTotal(1), 1);
  assert.equal(streakMoonSeedTotal(7), 12);
  assert.equal(streakMoonSeedTotal(14), 29);
  assert.equal(moonSeedsForNewActiveDay(7, {}), 6);
  assert.equal(moonSeedsForNewActiveDay(7, { reward_7: true }), 1);
  assert.equal(moonSeedsForNewActiveDay(14, { reward_7: true }), 11);
});
