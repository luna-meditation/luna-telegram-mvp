import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const hero = readFileSync(resolve(process.cwd(), 'src/v2/components/V2Hero.tsx'), 'utf8');
const homeStyles = readFileSync(resolve(process.cwd(), 'src/v2/design-system/homeV2.css'), 'utf8');
const progress = readFileSync(resolve(process.cwd(), 'src/components/progress/ProgressExperience.tsx'), 'utf8');
const statuses = readFileSync(resolve(process.cwd(), 'src/components/progress/StatusProgressionSheet.tsx'), 'utf8');
const statusRules = readFileSync(resolve(process.cwd(), '../backend/src/journey-status.ts'), 'utf8');
const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const primitives = readFileSync(resolve(process.cwd(), 'src/design-system/primitives.css'), 'utf8');

test('Home keeps the conversational question before and after check-in', () => {
  assert.match(hero, /<h1>\{headline\}<\/h1>/);
  assert.doesNotMatch(hero, /Today’s check-in|Сегодняшний чек-ин/);
  assert.match(hero, /language === 'ru' \? 'Сегодня' : 'Today'/);
  assert.match(homeStyles, /\.home-v2-mood-saved[\s\S]*width: max-content/);
  assert.match(homeStyles, /margin: auto 14px 14px/);
});

test('Profile and Journey open the same ten-status progression sheet', () => {
  assert.match(app, /<StatusProgressionSheet profile=\{profile\}/);
  assert.match(progress, /<StatusProgressionSheet profile=\{profile\}/);
  assert.match(progress, /<JourneyStatusHero[^>]*onOpen=\{\(\) => setStatusOpen\(true\)\}/);
  assert.match(statuses, /journeyStatusDefinitions\.map/);
  assert.match(statuses, /from '\.\.\/\.\.\/\.\.\/\.\.\/backend\/src\/journey-status'/);
  assert.equal([...statusRules.matchAll(/\{ id: '(initiate|seeker|adept|guardian|luminary|sage|ascendant|celestial|ethereal|lunaris)'/g)].length, 10);
});

test('Light Journey streak uses the approved daytime hero while Dark stays nocturnal', () => {
  assert.match(progress, /progress-v3-rhythm-image-dark/);
  assert.match(progress, /src="\/images\/home\/hero-light\.png"[^>]*progress-v3-rhythm-image-light/);
  assert.match(styles, /:root\[data-theme="light"\] \.progress-v3-rhythm-image-dark \{ display: none; \}/);
  assert.match(styles, /:root\[data-theme="light"\] \.progress-v3-rhythm-image-light/);
});

test('Favorites are optimistic, race-guarded, cached, and revert on failure', () => {
  const toggle = app.slice(app.indexOf('const toggleFavorite'), app.indexOf('const withCheckinAuthFallback'));
  assert.match(toggle, /favoritePendingRef\.current\.has/);
  assert.match(toggle, /favoriteOverridesRef\.current\.set/);
  assert.match(toggle, /setFavorites\(nextFavorites\)/);
  assert.match(toggle, /await setFavorite/);
  assert.match(toggle, /setFavorites\(revertedFavorites\)/);
  assert.doesNotMatch(toggle, /refreshAccount\(/);
  assert.match(primitives, /meditation-card-favorite:disabled/);
  assert.match(primitives, /data-theme="light"[^\n]*meditation-card-favorite svg\.is-favorite/);
});

test('Light textual CTAs and achievement states use readable semantic colors', () => {
  for (const selector of ['home-v2-view-all', 'home-v2-practice-tile small', 'home-v2-sound-text', 'home-v2-home-action em']) {
    assert.ok(homeStyles.includes(selector), `missing light CTA selector: ${selector}`);
  }
  assert.match(styles, /progress-v4-achievement\.is-unlocked \.progress-v4-achievement-icon/);
  assert.match(styles, /progress-v4-achievement\.is-locked \.progress-v4-achievement-icon/);
});
