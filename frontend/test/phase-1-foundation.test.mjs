import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import {importTypescript} from './import-typescript.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
const source = resolve(root, 'src');

async function importTypescriptModule(path) {
  return importTypescript(path);
}

const navigation = await importTypescriptModule(resolve(source, 'navigation/navigationModel.ts'));
const flags = await importTypescriptModule(resolve(source, 'config/featureFlagDefinitions.ts'));
const app = readFileSync(resolve(source, 'App.tsx'), 'utf8');
const routeHook = readFileSync(resolve(source, 'navigation/useAppRouteState.ts'), 'utf8');
const bottomNavigation = readFileSync(resolve(source, 'design-system/components/BottomNavigation.tsx'), 'utf8');
const tokens = readFileSync(resolve(source, 'design-system/tokens.css'), 'utf8');
const frontendEnv = readFileSync(resolve(root, '.env.example'), 'utf8');

test('all Luna 2.0 feature flags are disabled unless explicitly enabled', () => {
  const disabled = flags.resolveFeatureFlags({});
  assert.deepEqual(disabled, {
    new_navigation: false,
    tarot_daily: false,
    tarot_spreads: false,
    astrology: false,
    moon_seeds_wallet_v2: false,
    moon_seeds_purchases: false,
    breathwork_audio: false,
    breathwork_guided: false,
    personalization: false,
    personal_memory: false,
    cosmos_v2: false,
    ai_voice_input:false,
    ai_central_experience: false,
    luna_intelligence:false,
    ai_modes: false,
    tarot_history: false,
    tarot_ai: false
  });
  assert.equal(flags.resolveFeatureFlags({ VITE_FEATURE_NEW_NAVIGATION: 'true' }).new_navigation, true);
  assert.equal(flags.resolveFeatureFlags({ VITE_FEATURE_TAROT_DAILY: '1' }).tarot_daily, false);
  for (const envName of Object.values(flags.featureFlagEnvironment)) {
    assert.match(frontendEnv, new RegExp(`^${envName}=false$`, 'm'));
  }
});

test('legacy navigation stays active while the three-tab Luna 2.5 model is ready behind its flag', () => {
  assert.deepEqual(navigation.primaryNavigation(false).map((item) => item.page), ['home', 'library', 'luna', 'progress', 'profile']);
  assert.deepEqual(navigation.primaryNavigation(true).map((item) => item.page), ['home', 'luna', 'cosmos']);
  assert.match(app, /newNavigation:\s*featureFlags\.new_navigation/);
  assert.match(bottomNavigation, /newNavigation = false/);
  const copy = readFileSync(resolve(source, 'luna2/copy.ts'), 'utf8');
  assert.match(copy, /explore: 'Explore'/);
  assert.match(copy, /explore: 'Открытия'/);
  assert.match(copy, /journey: 'Твой путь'/);
  assert.match(app, /showJourneyEntry=\{featureFlags\.new_navigation\}/);
});

test('route state preserves contextual back navigation and moves Journey under Profile only in Luna 2.0', () => {
  let legacy = navigation.initialRouteState('home', false);
  legacy = navigation.reduceRouteState(legacy, { type: 'navigate', page: 'player' }, false);
  assert.deepEqual(legacy, { current: 'player', trail: ['home'] });
  legacy = navigation.reduceRouteState(legacy, { type: 'back' }, false);
  assert.deepEqual(legacy, { current: 'home', trail: [] });

  const legacyJourney = navigation.reduceRouteState(legacy, { type: 'navigate', page: 'progress' }, false);
  assert.deepEqual(legacyJourney, { current: 'progress', trail: [] });

  const luna2Journey = navigation.reduceRouteState({ current: 'profile', trail: [] }, { type: 'navigate', page: 'progress' }, true);
  assert.deepEqual(luna2Journey, { current: 'progress', trail: ['profile'] });
  assert.equal(navigation.fallbackPage('moonGarden', true), 'cosmos');

  assert.match(routeHook, /WebApp\?\.BackButton/);
  assert.match(routeHook, /backButton\.onClick/);
  assert.match(routeHook, /backButton\.offClick/);
  assert.match(routeHook, /backButton\.show\(\)/);
  assert.match(routeHook, /backButton\.hide\(\)/);
  assert.match(routeHook, /window\.location\.pathname !== '\/admin'/);
  assert.match(routeHook, /window\.history\.replaceState/);
  assert.match(app, /const hasNestedSurface = view !== 'main' \|\| statusProgressionOpen \|\| avatarActionsOpen \|\| logoutOpen/);
  assert.match(app, /backButton\.onClick\(closeNestedSurface\)/);
});

test('existing and Luna 2.0 deep links resolve without changing meditation start parameters', () => {
  assert.equal(navigation.pageFromStartParam('library'), 'library');
  assert.equal(navigation.pageFromStartParam('saved'), 'library');
  assert.equal(navigation.pageFromStartParam('explore'), 'library');
  assert.equal(navigation.pageFromStartParam('journey'), 'progress');
  assert.equal(navigation.pageFromStartParam('moon-garden'), 'moonGarden');
  assert.equal(navigation.pageFromStartParam('luna-ai'), 'luna');
  assert.equal(navigation.initialPageFromLaunch('/admin', '', ''), 'admin');
  assert.equal(navigation.meditationIdFromStartParam('meditation_evening%20calm'), 'evening calm');
  assert.equal(navigation.meditationIdFromStartParam('meditation_%E0%A4%A'), null);
});

test('theme, safe-area, scroll reset, player and existing data flows remain outside feature gating', () => {
  assert.match(app, /useThemePreference\(\)/);
  assert.match(app, /document\.scrollingElement/);
  assert.match(app, /window\.requestAnimationFrame\(resetPrimaryScroll\)/);
  assert.match(app, /onPlaybackSessionStart/);
  assert.match(app, /onPlaybackHeartbeat/);
  assert.match(app, /saveHistory/);
  assert.match(app, /plantMoonGardenElement/);
  assert.match(app, /getLunaMemory/);
  assert.match(tokens, /--safe-area-bottom/);
  assert.match(tokens, /--app-navigation-height/);
  assert.match(app, /featureFlags\.new_navigation && page === 'tarot'/);
  assert.match(app, /featureFlags\.new_navigation && page === 'astrology'/);
  assert.match(app, /redesigned=\{featureFlags\.new_navigation\}/);
  assert.doesNotMatch(app, /featureFlags\.(moon_seeds_wallet_v2|moon_seeds_purchases)/);
});
