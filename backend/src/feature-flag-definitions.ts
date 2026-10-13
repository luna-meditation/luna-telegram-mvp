export const disabledBackendFeatureFlags = Object.freeze({
  new_navigation: false,
  tarot_daily: false,
  tarot_spreads: false,
  astrology: false,
  moon_seeds_wallet_v2: false,
  moon_seeds_purchases: false,
  breathwork_audio: false
});

export type BackendFeatureFlags = Record<keyof typeof disabledBackendFeatureFlags, boolean>;
