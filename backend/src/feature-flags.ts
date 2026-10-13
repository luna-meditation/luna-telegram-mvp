import { env } from './config.js';
import type { BackendFeatureFlags } from './feature-flag-definitions.js';

export const backendFeatureFlags: BackendFeatureFlags = Object.freeze({
  new_navigation: env.FEATURE_NEW_NAVIGATION,
  tarot_daily: env.FEATURE_TAROT_DAILY,
  tarot_spreads: env.FEATURE_TAROT_SPREADS,
  astrology: env.FEATURE_ASTROLOGY,
  moon_seeds_wallet_v2: env.FEATURE_MOON_SEEDS_WALLET_V2,
  moon_seeds_purchases: env.FEATURE_MOON_SEEDS_PURCHASES,
  breathwork_audio: env.FEATURE_BREATHWORK_AUDIO
});
