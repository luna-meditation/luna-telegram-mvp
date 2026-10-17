export const disabledBackendFeatureFlags = Object.freeze({
  new_navigation: false,
  tarot_daily: false,
  tarot_spreads: false,
  astrology: false,
  moon_seeds_wallet_v2: false,
  moon_seeds_purchases: false,
  breathwork_audio: false,
  garden_atomic: false,
  personalization: false,
  personal_memory: false,
  cosmos_v2: false,
  ai_modes: false,
  tarot_history: false,
  tarot_ai: false
});

export type BackendFeatureFlags = Record<keyof typeof disabledBackendFeatureFlags, boolean>;
