import { resolveFeatureFlags } from './featureFlagDefinitions';

export const featureFlags = Object.freeze(resolveFeatureFlags(import.meta.env));
