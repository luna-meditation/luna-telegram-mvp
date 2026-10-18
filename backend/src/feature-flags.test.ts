import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { disabledBackendFeatureFlags } from './feature-flag-definitions.js';

test('every Luna 2.0 backend feature remains disabled by default in Phase 1', () => {
  assert.deepEqual(disabledBackendFeatureFlags, {
    new_navigation: false,
    tarot_daily: false,
    tarot_spreads: false,
    astrology: false,
    moon_seeds_wallet_v2: false,
    moon_seeds_purchases: false,
    breathwork_audio: false,
    breathwork_guided: false,
    garden_atomic: false,
    personalization: false,
    personal_memory: false,
    cosmos_v2: false,
    ai_modes: false,
    tarot_history: false,
    tarot_ai: false,
    luna_intelligence: false
  });
  const versionSource = readFileSync(resolve(process.cwd(), 'src/version.ts'), 'utf8');
  assert.match(versionSource, /featureFlags: backendFeatureFlags/);
});
