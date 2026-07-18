import assert from 'node:assert/strict';
import test from 'node:test';
import { dueReminderTypes, normalizeNotificationPreferences, reminderIdempotencyKey } from './notification-policy.js';

test('notification preferences require explicit consent and preserve a validated timezone', () => {
  const normalized = normalizeNotificationPreferences({
    remindersEnabled: true,
    reminderTypes: ['morning', 'streak_risk'],
    reminderTime: '08:15',
    timezone: 'Asia/Makassar',
    consentedAt: '2026-07-18T00:00:00.000Z'
  });
  assert.equal(normalized.remindersEnabled, true);
  assert.deepEqual(normalized.reminderTypes, ['morning', 'streak_risk']);
  assert.equal(normalized.timezone, 'Asia/Makassar');
  assert.equal(normalizeNotificationPreferences({ timezone: 'Not/AZone' }).timezone, 'UTC');
});

test('scheduler emits only due configured reminders and requires consent', () => {
  const now = new Date('2026-07-18T00:15:00.000Z'); // 08:15 in Makassar
  const preferences = { remindersEnabled: true, reminderTypes: ['morning', 'streak_risk'] as const, reminderTime: '08:15', timezone: 'Asia/Makassar', consentedAt: now.toISOString() };
  assert.deepEqual(dueReminderTypes({ preferences: { ...preferences, reminderTypes: [...preferences.reminderTypes] }, now, currentStreak: 4, lastPracticeDate: '2026-07-17' }), ['morning', 'streak_risk']);
  assert.deepEqual(dueReminderTypes({ preferences: { ...preferences, consentedAt: null, reminderTypes: [...preferences.reminderTypes] }, now }), []);
});

test('delivery key is deterministic for duplicate prevention', () => {
  assert.equal(reminderIdempotencyKey(42, 'daily', '2026-07-18'), reminderIdempotencyKey(42, 'daily', '2026-07-18'));
  assert.notEqual(reminderIdempotencyKey(42, 'daily', '2026-07-18'), reminderIdempotencyKey(42, 'daily', '2026-07-19'));
});
