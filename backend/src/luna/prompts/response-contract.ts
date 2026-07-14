export const recommendationGoals = ['sleep', 'anxiety', 'focus', 'grounding', 'self_compassion', 'morning_clarity', 'stress_reset'] as const;
export const detectedIntents = ['chat', 'request_meditation', 'request_in_chat_exercise', 'emotional_support', 'app_question', 'other'] as const;

export const responseContractPrompt = `Return only the structured response contract. UUIDs, database IDs, URLs, raw JSON, catalog keys, and schema field names must never appear inside message. preferredCatalogKey is a backend-safe catalog key from CATALOG or null; never copy it into visible text. meditationAction is structured metadata only and must be null unless a published catalog meditation is genuinely selected.`;
