import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyPlaybackHeartbeat,
  countCompletedMeditationSessions,
  mergePlaybackRanges,
  normalizePlaybackSeconds,
  playbackCompletionThresholdSeconds,
  playbackCoverageSeconds,
  playbackRewardDecision,
  qualifiesForPlaybackCompletion
} from './playback-security.js';

test('normalizes fractional playback seconds before persistence', () => {
  assert.equal(normalizePlaybackSeconds(642.1611224006544, { field: 'last_position' }), 642);
  assert.equal(normalizePlaybackSeconds('642.1611224006544', { field: 'last_position' }), 642);
  assert.equal(normalizePlaybackSeconds(642, { field: 'last_position' }), 642);
  assert.equal(normalizePlaybackSeconds(999, { field: 'last_position', duration: 700 }), 700);
});

test('rejects invalid playback numbers instead of coercing them to zero', () => {
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, 'NaN', 'not-a-number', '', {}, true]) {
    assert.throws(() => normalizePlaybackSeconds(value, { field: 'last_position' }), /last_position/);
  }
});

test('fractional heartbeat positions remain integer coverage and preserve anti-seek checks', () => {
  const result = applyPlaybackHeartbeat({
    ranges: [],
    previousPosition: 642.1611224006544,
    currentPosition: 653.1610510933482,
    elapsedSeconds: 11.9,
    duration: 900
  });
  assert.equal(result.currentPosition, 653);
  assert.equal(result.listenedSeconds, 11);
  assert.equal(Number.isInteger(result.currentPosition), true);
  assert.equal(Number.isInteger(result.listenedSeconds), true);
});

test('seeking directly to the end does not create listened coverage', () => {
  const result = applyPlaybackHeartbeat({
    ranges: [], previousPosition: 0, currentPosition: 590, elapsedSeconds: 10, duration: 600
  });
  assert.equal(result.accepted, false);
  assert.equal(result.listenedSeconds, 0);
});

test('completion requires ninety percent of trusted per-session coverage', () => {
  assert.equal(playbackCompletionThresholdSeconds(629), 567);
  assert.equal(qualifiesForPlaybackCompletion({ listenedSeconds: 566, duration: 629 }), false);
  assert.equal(qualifiesForPlaybackCompletion({ listenedSeconds: 567, duration: 629 }), true);
});

test('completed meditation count preserves legacy completions and counts verified repeats', () => {
  assert.equal(countCompletedMeditationSessions({
    history: [
      { meditation_id: 'calm', completed: true },
      { meditation_id: 'sleep', completed: true }
    ],
    playbackSessions: [
      { meditation_id: 'calm', completed_at: '2026-09-01T10:00:00Z' },
      { meditation_id: 'calm', completed_at: '2026-09-02T10:00:00Z' },
      { meditation_id: 'sleep', completed_at: null },
      { meditation_id: 'focus', completed_at: '2026-09-03T10:00:00Z' }
    ]
  }), 4);
});

test('repeated seeks and overlapping playback are not double-counted', () => {
  const first = applyPlaybackHeartbeat({
    ranges: [], previousPosition: 0, currentPosition: 10, elapsedSeconds: 10, duration: 600
  });
  const seek = applyPlaybackHeartbeat({
    ranges: first.ranges, previousPosition: 10, currentPosition: 300, elapsedSeconds: 1, duration: 600
  });
  const replay = applyPlaybackHeartbeat({
    ranges: seek.ranges, previousPosition: 0, currentPosition: 10, elapsedSeconds: 10, duration: 600
  });
  assert.equal(seek.listenedSeconds, 10);
  assert.equal(replay.listenedSeconds, 10);
});

test('pause and resume builds genuine contiguous coverage', () => {
  const first = applyPlaybackHeartbeat({
    ranges: [], previousPosition: 0, currentPosition: 10, elapsedSeconds: 10, duration: 60
  });
  const resumed = applyPlaybackHeartbeat({
    ranges: first.ranges, previousPosition: 10, currentPosition: 20, elapsedSeconds: 10, duration: 60
  });
  assert.equal(resumed.listenedSeconds, 20);
});

test('ranges from closed and reopened sessions merge without overlap', () => {
  const ranges = mergePlaybackRanges([[0, 30]], [[25, 60]], 120);
  assert.deepEqual(ranges, [[0, 60]]);
  assert.equal(playbackCoverageSeconds(ranges), 60);
});

test('duplicate heartbeat and duplicate completion coverage are idempotent', () => {
  const ranges = mergePlaybackRanges([[0, 100]], [[0, 100]], 100);
  assert.equal(playbackCoverageSeconds(ranges), 100);
});

test('a long inactive heartbeat gap does not mint background listening credit', () => {
  const result = applyPlaybackHeartbeat({
    ranges: [[0, 20]], previousPosition: 20, currentPosition: 180, elapsedSeconds: 30, duration: 600
  });
  assert.equal(result.accepted, false);
  assert.equal(result.listenedSeconds, 20);
});

test('replaying a completed meditation does not repeat listening or one-time completion rewards', () => {
  const reward = playbackRewardDecision({
    trustedListenedSeconds: 600,
    previouslyAwardedPosition: 600,
    completionBonusEligible: true,
    completionBonusAlreadyAwarded: true
  });
  assert.equal(reward.moonSeedsAwarded, 0);
});

test('a duplicate completion request cannot repeat its completion bonus', () => {
  const first = playbackRewardDecision({
    trustedListenedSeconds: 600,
    previouslyAwardedPosition: 600,
    completionBonusEligible: true,
    completionBonusAlreadyAwarded: false
  });
  const duplicate = playbackRewardDecision({
    trustedListenedSeconds: 600,
    previouslyAwardedPosition: first.nextAwardedPosition,
    completionBonusEligible: true,
    completionBonusAlreadyAwarded: true
  });
  assert.equal(first.completionBonusAwarded, 2);
  assert.equal(duplicate.moonSeedsAwarded, 0);
});

test('database completion flow uses current session coverage instead of the client ended flag', () => {
  const databaseSource = readFileSync(resolve(process.cwd(), 'src/db.ts'), 'utf8');
  assert.match(databaseSource, /sessionQualifiesForCompletion = completion\.qualified/);
  assert.match(databaseSource, /completed = Boolean\(existing\?\.completed \|\| sessionQualifiesForCompletion\)/);
  assert.doesNotMatch(databaseSource, /input\.completed && completion >= 90/);
  assert.match(databaseSource, /countCompletedMeditationSessions\(\{/);
});

test('verified repeat completion migration is additive, idempotent, and anti-seek based', () => {
  const migration = readFileSync(resolve(process.cwd(), '../database/migrations/012_verified_repeat_completions.sql'), 'utf8');
  assert.match(migration, /playback\.completed_at is null/i);
  assert.match(migration, /playback\.listened_seconds >= ceil\(meditation\.duration \* 0\.90\)/i);
  assert.match(migration, /greatest\(history\.completion_percent, 90\)/i);
  assert.doesNotMatch(migration, /\b(delete|truncate|drop)\b/i);
});
