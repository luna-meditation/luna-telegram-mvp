export const featureFlagKeys = [
  'new_navigation',
  'tarot_daily',
  'tarot_spreads',
  'astrology',
  'moon_seeds_wallet_v2',
  'moon_seeds_purchases',
  'breathwork_audio'
] as const;

export type FeatureFlagKey = typeof featureFlagKeys[number];
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const featureFlagEnvironment: Record<FeatureFlagKey, string> = {
  new_navigation: 'VITE_FEATURE_NEW_NAVIGATION',
  tarot_daily: 'VITE_FEATURE_TAROT_DAILY',
  tarot_spreads: 'VITE_FEATURE_TAROT_SPREADS',
  astrology: 'VITE_FEATURE_ASTROLOGY',
  moon_seeds_wallet_v2: 'VITE_FEATURE_MOON_SEEDS_WALLET_V2',
  moon_seeds_purchases: 'VITE_FEATURE_MOON_SEEDS_PURCHASES',
  breathwork_audio: 'VITE_FEATURE_BREATHWORK_AUDIO'
};

export function resolveFeatureFlags(source: Record<string, unknown>): FeatureFlags {
  return Object.fromEntries(featureFlagKeys.map((key) => [
    key,
    String(source[featureFlagEnvironment[key]] ?? '').trim().toLowerCase() === 'true'
  ])) as FeatureFlags;
}
