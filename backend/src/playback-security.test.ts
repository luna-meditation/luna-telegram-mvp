import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPlaybackHeartbeat,
  mergePlaybackRanges,
  normalizePlaybackSeconds,
  playbackCoverageSeconds,
  playbackRewardDecision
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

test('replaying a completed meditation does not repeat listening or completion rewards', () => {
  const reward = playbackRewardDecision({
    trustedListenedSeconds: 600,
    previouslyAwardedPosition: 600,
    newlyCompletedSession: true,
    completionBonusAlreadyAwarded: true
  });
  assert.equal(reward.moonSeedsAwarded, 0);
});

test('a duplicate completion request cannot repeat its completion bonus', () => {
  const first = playbackRewardDecision({
    trustedListenedSeconds: 600,
    previouslyAwardedPosition: 600,
    newlyCompletedSession: true,
    completionBonusAlreadyAwarded: false
  });
  const duplicate = playbackRewardDecision({
    trustedListenedSeconds: 600,
    previouslyAwardedPosition: first.nextAwardedPosition,
    newlyCompletedSession: false,
    completionBonusAlreadyAwarded: true
  });
  assert.equal(first.completionBonusAwarded, 2);
  assert.equal(duplicate.moonSeedsAwarded, 0);
});
