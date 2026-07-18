export type PersonalizationGoal = 'sleep' | 'anxiety' | 'focus' | 'routine' | 'stress';

export type RecommendationMeditation = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  mood?: string | null;
  duration?: number | null;
  play_count?: number | null;
  translations?: Record<string, { title?: string | null; subtitle?: string | null; description?: string | null }> | null;
  history?: { last_played?: string | null; completed?: boolean | null } | null;
};

export type RecommendationContext = {
  goals?: string[] | null;
  checkinMood?: string | null;
  availableMinutes?: string | null;
  localHour?: number;
  language?: 'en' | 'ru' | string | null;
  recentMeditationIds?: string[];
};

const goalTerms: Record<PersonalizationGoal, string[]> = {
  sleep: ['sleep', 'night', 'evening', 'rest', 'wind down', 'relax'],
  anxiety: ['anxiety', 'anxious', 'breath', 'ground', 'calm', 'release'],
  focus: ['focus', 'clarity', 'morning', 'energy', 'concentration'],
  routine: ['daily', 'routine', 'short', 'quick', 'morning', 'evening'],
  stress: ['stress', 'reset', 'calm', 'release', 'breath', 'relax']
};

const moodTerms: Record<string, string[]> = {
  tired: ['sleep', 'rest', 'night', 'relax'],
  anxious: ['anxiety', 'ground', 'breath', 'calm'],
  stressed: ['stress', 'reset', 'breath', 'calm'],
  focused: ['focus', 'clarity', 'morning'],
  low_energy: ['energy', 'morning', 'clarity', 'focus'],
  calm: ['calm', 'mindful', 'gratitude', 'body']
};

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function meditationSearchText(meditation: RecommendationMeditation) {
  const translations = Object.values(meditation.translations ?? {}).flatMap((translation) => [
    translation?.title,
    translation?.subtitle,
    translation?.description
  ]);
  return [
    meditation.title,
    meditation.subtitle,
    meditation.description,
    meditation.category,
    meditation.mood,
    ...translations
  ].map(normalize).join(' ');
}

function validGoals(goals?: string[] | null): PersonalizationGoal[] {
  return Array.from(new Set((goals ?? []).filter((goal): goal is PersonalizationGoal => goal in goalTerms)));
}

function matchingTerms(text: string, terms: string[]) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function timeTerms(hour: number) {
  if (hour >= 5 && hour < 12) return ['morning', 'focus', 'clarity', 'energy'];
  if (hour >= 18 || hour < 4) return ['sleep', 'night', 'evening', 'rest', 'calm'];
  return ['calm', 'reset', 'focus', 'stress'];
}

function availableSeconds(value?: string | null) {
  if (value === '3') return 3 * 60;
  if (value === '5') return 5 * 60;
  if (value === '10') return 10 * 60;
  if (value === '15_plus') return 60 * 60;
  return null;
}

export function recommendationScore(meditation: RecommendationMeditation, context: RecommendationContext) {
  const text = meditationSearchText(meditation);
  const goals = validGoals(context.goals);
  const recentIds = new Set(context.recentMeditationIds ?? []);
  let score = 0;

  for (const goal of goals) score += matchingTerms(text, goalTerms[goal]) * 9;
  score += matchingTerms(text, moodTerms[normalize(context.checkinMood)] ?? []) * 11;
  score += matchingTerms(text, timeTerms(Number.isFinite(context.localHour) ? Number(context.localHour) : 12)) * 4;

  const limit = availableSeconds(context.availableMinutes);
  const duration = Math.max(0, Number(meditation.duration ?? 0));
  if (limit && duration > 0) score += duration <= limit ? 7 : -8;
  if (goals.includes('routine') && duration > 0 && duration <= 10 * 60) score += 8;
  if (recentIds.has(meditation.id)) score -= 20;
  if (meditation.history?.completed) score -= 4;
  const language = normalize(context.language);
  if (language === 'en') score += meditation.title ? 3 : -3;
  if (language === 'ru') score += meditation.translations?.ru?.title ? 3 : -3;
  score += Math.min(3, Math.log10(Math.max(1, Number(meditation.play_count ?? 0) + 1)));

  return score;
}

export function rankPersonalizedMeditations<T extends RecommendationMeditation>(meditations: T[], context: RecommendationContext): T[] {
  return meditations
    .map((meditation, index) => ({ meditation, index, score: recommendationScore(meditation, context) }))
    .sort((left, right) => right.score - left.score || left.index - right.index || left.meditation.id.localeCompare(right.meditation.id))
    .map(({ meditation }) => meditation);
}

export function primaryRecommendationSignal(context: RecommendationContext) {
  const goal = validGoals(context.goals)[0] ?? null;
  if (goal) return { type: 'goal' as const, value: goal };
  const mood = normalize(context.checkinMood);
  if (mood) return { type: 'checkin' as const, value: mood };
  return { type: 'time' as const, value: String(Number.isFinite(context.localHour) ? context.localHour : 12) };
}
