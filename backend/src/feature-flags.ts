import { env } from './config.js';
import type { BackendFeatureFlags } from './feature-flag-definitions.js';

export const backendFeatureFlags: BackendFeatureFlags = Object.freeze({
  new_navigation: env.FEATURE_NEW_NAVIGATION,
  tarot_daily: env.FEATURE_TAROT_DAILY,
  tarot_spreads: env.FEATURE_TAROT_SPREADS,
  astrology: env.FEATURE_ASTROLOGY,
  moon_seeds_wallet_v2: env.FEATURE_MOON_SEEDS_WALLET_V2,
  moon_seeds_purchases: env.FEATURE_MOON_SEEDS_PURCHASES,
  breathwork_audio: env.FEATURE_BREATHWORK_AUDIO,
  breathwork_guided: env.FEATURE_BREATHWORK_GUIDED,
  garden_atomic: env.FEATURE_GARDEN_ATOMIC,
  personalization: env.FEATURE_PERSONALIZATION,
  personal_memory: env.FEATURE_PERSONAL_MEMORY,
  cosmos_v2: env.FEATURE_COSMOS_V2,
  ai_modes: env.FEATURE_AI_MODES,
  tarot_history: env.FEATURE_TAROT_HISTORY,
  tarot_ai: env.FEATURE_TAROT_AI
});
