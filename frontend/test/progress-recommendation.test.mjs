import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), 'src/components/progress/progressRecommendation.ts'), 'utf8');

test('Progress recommendation uses published catalog metadata and opens a real meditation id', () => {
  assert.match(source, /resolveProgressRecommendation/);
  assert.match(source, /item\.published !== false/);
  assert.match(source, /Boolean\(item\.audio_file\)/);
  assert.match(source, /meditation: selected\.meditation/);
  assert.doesNotMatch(source, /Deep Sleep|Anxiety Relief|Focused Calm/);
});

test('Progress recommendation respects access and supports EN and RU reasons', () => {
  assert.match(source, /input\.hasPremium/);
  assert.match(source, /freeCandidate/);
  assert.match(source, /Recommended for the state/);
  assert.match(source, /Подходит состоянию/);
});
