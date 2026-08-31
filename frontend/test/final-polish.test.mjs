import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const hero = readFileSync(resolve(process.cwd(), 'src/v2/components/V2Hero.tsx'), 'utf8');
const progress = readFileSync(resolve(process.cwd(), 'src/components/progress/ProgressExperience.tsx'), 'utf8');
const progressCopy = readFileSync(resolve(process.cwd(), 'src/components/progress/progressCopy.ts'), 'utf8');
const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const homeStyles = readFileSync(resolve(process.cwd(), 'src/v2/design-system/homeV2.css'), 'utf8');

test('Profile and Journey share one status resolver and one visual mark', () => {
  assert.match(progress, /export function resolveJourneyStatus/);
  assert.match(progress, /export function JourneyStatusMark/);
  assert.match(progress, /const status = resolveJourneyStatus\(profile\)/);
  assert.match(app, /const journeyStatus = resolveJourneyStatus\(profile\)/);
  assert.match(app, /<JourneyStatusMark compact/);
  assert.match(app, /className="profile-journey-status" onClick=\{onJourney\}/);
  assert.match(styles, /\.profile-journey-status/);
  assert.match(styles, /\.profile-plan-status\.is-premium/);
});

test('Home hero has theme-specific assets and one reusable non-emoji mood component', () => {
  assert.match(hero, /dark: '\/images\/home\/hero-night\.png'/);
  assert.match(hero, /light: '\/images\/home\/hero-light\.png'/);
  assert.match(hero, /function MoodOption/);
  assert.match(hero, /function MoodGlyph/);
  assert.match(hero, /aria-pressed=\{selected\}/);
  assert.doesNotMatch(hero, /[😀😌😐😟😴]/u);
  assert.match(homeStyles, /\.home-v2-hero-light \{ display: none; \}/);
  assert.match(homeStyles, /:root\[data-theme="light"\] \.home-v2-hero-light/);
  assert.match(homeStyles, /object-position: 38% center/);
  assert.match(homeStyles, /filter: saturate\(1\.02\) contrast\(1\.01\) brightness\(\.99\)/);
  assert.match(homeStyles, /:root\[data-theme="light"\] \.home-v2-hero-dark/);
});

test('Journey streak labels and 1-3 digit typography are explicit', () => {
  assert.match(progressCopy, /currentRhythm: 'Streak'/);
  assert.match(progressCopy, /longestRhythm: 'Longest streak'/);
  assert.match(progress, /data-digits=\{Math\.min\(3, String\(streak\)\.length\)\}/);
  assert.match(styles, /strong\[data-digits="2"\]/);
  assert.match(styles, /strong\[data-digits="3"\]/);
});

test('narrow recommendation headings stack without truncating the title', () => {
  assert.match(homeStyles, /@media \(max-width: 430px\)/);
  assert.match(homeStyles, /\.home-v2-recommendation-section \.home-v2-section-heading-row/);
  assert.match(homeStyles, /display: grid/);
  assert.match(homeStyles, /font-size: clamp\(1\.2rem, 5\.5vw, 1\.4rem\)/);
});
