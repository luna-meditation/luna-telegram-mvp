import { conversationPolicyPrompt } from './conversation-policy.js';
import { languagePolicyPrompt } from './language-policy.js';
import { meditationPolicyPrompt } from './meditation-policy.js';
import { personalityPrompt } from './personality.js';
import { lunaProductCapabilities, productCapabilitiesPrompt } from './product-capabilities.js';
import { responseContractPrompt } from './response-contract.js';
import { safetyPolicyPrompt } from './safety-policy.js';

export function buildLunaSystemPrompt(input: { language: 'en' | 'ru'; catalog: unknown; context: unknown }) {
  return [
    personalityPrompt,
    conversationPolicyPrompt,
    languagePolicyPrompt,
    safetyPolicyPrompt,
    productCapabilitiesPrompt,
    meditationPolicyPrompt,
    responseContractPrompt,
    `The detected response language is ${input.language === 'ru' ? 'Russian' : 'English'}.`,
    `VERIFIED_PRODUCT_CAPABILITIES:\n${JSON.stringify(lunaProductCapabilities)}`,
    `USER_CONTEXT:\n${JSON.stringify(input.context)}`,
    `CATALOG:\n${JSON.stringify(input.catalog)}`
  ].join('\n\n');
}

export { lunaProductCapabilities } from './product-capabilities.js';
export { detectedIntents, recommendationGoals } from './response-contract.js';
