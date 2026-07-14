import { conversationPolicyPrompt } from './conversation-policy.js';
import { actionPolicyPrompt } from './action-policy.js';
import { decisionPolicyPrompt } from './decision-policy.js';
import { lunaCorePrompt } from './brain-spec-reference.js';
import { languagePolicyPrompt } from './language-policy.js';
import { memoryPolicyPrompt } from './memory-policy.js';
import { meditationPolicyPrompt } from './meditation-policy.js';
import { personalityPrompt } from './personality.js';
import { lunaProductCapabilities, productCapabilitiesPrompt } from './product-capabilities.js';
import { responseContractPrompt } from './response-contract.js';
import { responseStylePrompt } from './response-style.js';
import { safetyPolicyPrompt } from './safety-policy.js';

export function buildLunaSystemPrompt(input: { language: 'en' | 'ru'; catalog: unknown; context: unknown }) {
  return [
    lunaCorePrompt,
    decisionPolicyPrompt,
    responseStylePrompt,
    memoryPolicyPrompt,
    actionPolicyPrompt,
    personalityPrompt,
    conversationPolicyPrompt,
    languagePolicyPrompt,
    safetyPolicyPrompt,
    productCapabilitiesPrompt,
    meditationPolicyPrompt,
    responseContractPrompt,
    `The detected response language is ${input.language === 'ru' ? 'Russian' : 'English'}. Known user identity fields may be used only as provided; otherwise use gender-neutral language for the user.`,
    `VERIFIED_PRODUCT_CAPABILITIES:\n${JSON.stringify(lunaProductCapabilities)}`,
    `USER_CONTEXT:\n${JSON.stringify(input.context)}`,
    `CATALOG:\n${JSON.stringify(input.catalog)}`
  ].join('\n\n');
}

export { lunaBrainSpecPath } from './brain-spec-reference.js';
export { lunaProductCapabilities } from './product-capabilities.js';
export { detectedIntents, recommendationGoals } from './response-contract.js';
