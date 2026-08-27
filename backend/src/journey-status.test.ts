import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildJourneyStatus, eligibleJourneyStatusRank, journeyStatusDefinitions } from './journey-status.js';

test('Journey status ladder keeps the ten approved statuses and thresholds', () => {
  assert.deepEqual(journeyStatusDefinitions.map((status) => status.id), [
    'initiate', 'seeker', 'adept', 'guardian', 'luminary',
    'sage', 'ascendant', 'celestial', 'ethereal', 'lunaris'
  ]);
  assert.deepEqual(journeyStatusDefinitions.at(-1)?.requirements, [
    { key: 'completedMeditations', target: 365 },
    { key: 'longestStreak', target: 100 },
    { key: 'unlockedAchievements', target: 15 },
    { key: 'gardenLevel', target: 7 }
  ]);
});

test('retroactive status calculation advances only through completed ladder steps', () => {
  assert.equal(eligibleJourneyStatusRank({ completedMeditations: 0 }), -1);
  assert.equal(eligibleJourneyStatusRank({ completedMeditations: 1 }), 0);
  assert.equal(eligibleJourneyStatusRank({ completedMeditations: 3, longestStreak: 3 }), 1);
  assert.equal(eligibleJourneyStatusRank({
    completedMeditations: 365,
    longestStreak: 100,
    unlockedAchievements: 15,
    gardenLevel: 7
  }), 9);
});

test('a saved status never downgrades when source metrics fall below its old threshold', () => {
  const state = buildJourneyStatus({
    completedMeditations: 2,
    longestStreak: 1,
    unlockedAchievements: 0,
    gardenLevel: 0
  }, 6, '2026-08-27T00:00:00.000Z');

  assert.equal(state.id, 'ascendant');
  assert.equal(state.rank, 6);
  assert.equal(state.earned, true);
  assert.equal(state.unlockedAt, '2026-08-27T00:00:00.000Z');
  assert.equal(state.next?.id, 'celestial');
});

test('next status progress combines every requirement and reports only unmet work', () => {
  const state = buildJourneyStatus({
    completedMeditations: 2,
    longestStreak: 1,
    unlockedAchievements: 0,
    gardenLevel: 0
  }, 0);

  assert.equal(state.next?.id, 'seeker');
  assert.equal(state.next?.progressPercent, 50);
  assert.deepEqual(state.next?.remaining, [
    { key: 'completedMeditations', current: 2, target: 3, remaining: 1 },
    { key: 'longestStreak', current: 1, target: 3, remaining: 2 }
  ]);
});

test('Journey status migration is additive and constrains the permanent rank', () => {
  const migration = readFileSync(resolve(process.cwd(), '../database/migrations/011_journey_status.sql'), 'utf8');
  assert.match(migration, /add column if not exists journey_status_rank smallint not null default -1/i);
  assert.match(migration, /add column if not exists journey_status_unlocked_at timestamptz/i);
  assert.match(migration, /check \(journey_status_rank between -1 and 9\)/i);
  assert.doesNotMatch(migration, /\bdrop\s+(table|column)\b/i);
});
