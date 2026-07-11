import { z } from 'zod';

export const memoryCategories = [
  'identity_preference', 'communication_preference', 'mindfulness_goal', 'sleep', 'stress',
  'routine', 'meditation_preference', 'ongoing_context', 'avoidance_preference'
] as const;

export const memoryCandidateSchema = z.object({
  category: z.enum(memoryCategories),
  key: z.string().regex(/^[a-z0-9_]{3,64}$/),
  value: z.string().min(5).max(300),
  confidence: z.number().min(0).max(1)
});

export function validMemoryCandidates(candidates: unknown[]) {
  return candidates.flatMap((candidate) => {
    const parsed = memoryCandidateSchema.safeParse(candidate);
    return parsed.success && parsed.data.confidence >= 0.78 ? [parsed.data] : [];
  }).slice(0, 3);
}

export function isCrisisMessage(message: string) {
  return /\b(kill myself|suicide|end my life|hurt myself|cannot stay safe|can't stay safe)\b/i.test(message) ||
    /(покончи(ть)? с собой|самоубий|убить себя|навредить себе|не могу оставаться в безопасности)/i.test(message);
}

export function safetyCategory(message: string): 'self_harm' | 'medical_emergency' | 'violence' | null {
  if (isCrisisMessage(message)) return 'self_harm';
  if (/\b(chest pain|cannot breathe|can't breathe|severe bleeding|overdose|unconscious)\b/i.test(message) || /(боль в груди|не могу дышать|сильное кровотечение|передозиров|без сознания)/i.test(message)) return 'medical_emergency';
  if (/\b(immediate danger|being attacked|someone will hurt me|domestic violence)\b/i.test(message) || /(непосредственной опасности|на меня напали|меня избивают|домашнее насилие)/i.test(message)) return 'violence';
  return null;
}

export function validatedMeditationId(candidate: string | null, availableIds: Iterable<string>) {
  if (!candidate) return null;
  return new Set(availableIds).has(candidate) ? candidate : null;
}
