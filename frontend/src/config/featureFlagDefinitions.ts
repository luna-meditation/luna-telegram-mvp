export const featureFlagKeys = [
  'new_navigation',
  'tarot_daily',
  'tarot_spreads',
  'astrology',
  'moon_seeds_wallet_v2',
  'moon_seeds_purchases',
  'breathwork_audio',
  'personalization',
  'personal_memory',
  'cosmos_v2',
  'ai_central_experience',
  'ai_modes',
  'tarot_history',
  'tarot_ai'
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
  breathwork_audio: 'VITE_FEATURE_BREATHWORK_AUDIO',
  personalization: 'VITE_FEATURE_PERSONALIZATION',
  personal_memory: 'VITE_FEATURE_PERSONAL_MEMORY',
  cosmos_v2: 'VITE_FEATURE_COSMOS_V2',
  ai_central_experience: 'VITE_FEATURE_AI_CENTRAL_EXPERIENCE',
  ai_modes: 'VITE_FEATURE_AI_MODES',
  tarot_history: 'VITE_FEATURE_TAROT_HISTORY',
  tarot_ai: 'VITE_FEATURE_TAROT_AI'
};

export function resolveFeatureFlags(source: Record<string, unknown>): FeatureFlags {
  return Object.fromEntries(featureFlagKeys.map((key) => [
    key,
    String(source[featureFlagEnvironment[key]] ?? '').trim().toLowerCase() === 'true'
  ])) as FeatureFlags;
}
