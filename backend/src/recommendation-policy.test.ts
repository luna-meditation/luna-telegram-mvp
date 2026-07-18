import assert from 'node:assert/strict';
import test from 'node:test';
import { rankPersonalizedMeditations, recommendationScore } from './recommendation-policy.js';

const catalog = [
  { id: 'sleep', title: 'Deep Sleep', category: 'sleep', description: 'Evening rest', duration: 600 },
  { id: 'focus', title: 'Morning Clarity', category: 'focus', description: 'Energy and concentration', duration: 300 },
  { id: 'calm', title: 'Anxiety Relief', category: 'anxiety', description: 'Breath and calm reset', duration: 420 }
];

test('goals, check-in, time, and available duration rank only real catalog meditations', () => {
  assert.equal(rankPersonalizedMeditations(catalog, { goals: ['sleep'], checkinMood: 'tired', localHour: 22 })[0]?.id, 'sleep');
  assert.equal(rankPersonalizedMeditations(catalog, { goals: ['focus'], checkinMood: 'focused', localHour: 8 })[0]?.id, 'focus');
  assert.equal(rankPersonalizedMeditations(catalog, { goals: ['anxiety'], checkinMood: 'anxious', availableMinutes: '5', localHour: 15 })[0]?.id, 'calm');
});

test('recent recommendations receive a deterministic repetition penalty', () => {
  const firstScore = recommendationScore(catalog[0], { goals: ['sleep'], recentMeditationIds: [] });
  const repeatedScore = recommendationScore(catalog[0], { goals: ['sleep'], recentMeditationIds: ['sleep'] });
  assert.equal(firstScore - repeatedScore, 20);
  assert.notEqual(rankPersonalizedMeditations(catalog, { goals: ['sleep'], recentMeditationIds: ['sleep'] })[0]?.id, 'sleep');
});

test('selected locale gently favors catalog items with official localization', () => {
  const localizedCatalog = [
    { ...catalog[0], translations: { ru: { title: 'Глубокий сон' } } },
    { ...catalog[0], id: 'sleep-en-only', title: 'Sleep in English' }
  ];
  assert.equal(rankPersonalizedMeditations(localizedCatalog, { goals: ['sleep'], language: 'ru' })[0]?.id, 'sleep');
});
