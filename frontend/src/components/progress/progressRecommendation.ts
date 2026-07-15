import type { AppLanguage, DailyCheckin, Meditation, ProfileStats, WellnessSummary } from '../../api';

export type ProgressRecommendation = {
  meditation: Meditation;
  reason: string;
  locked: boolean;
  signal: 'mood' | 'category' | 'time' | 'duration' | 'catalog';
};

function normalize(value: unknown) {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[^a-zа-я0-9]+/gi, ' ').trim()
    : '';
}

function localizedMetadata(meditation: Meditation, language: AppLanguage) {
  const translation = meditation.translations?.[language];
  return normalize([
    meditation.title,
    meditation.subtitle,
    meditation.description,
    meditation.category,
    meditation.mood,
    translation?.title,
    translation?.subtitle,
    translation?.description
  ].filter(Boolean).join(' '));
}

function currentTimeSignal(hour: number) {
  if (hour >= 5 && hour < 12) return { bucket: 'morning', terms: ['morning', 'focus', 'clarity', 'energy'] };
  if (hour >= 12 && hour < 18) return { bucket: 'afternoon', terms: ['focus', 'reset', 'calm', 'clarity'] };
  if (hour >= 18 && hour < 23) return { bucket: 'evening', terms: ['evening', 'calm', 'sleep', 'rest', 'release'] };
  return { bucket: 'night', terms: ['sleep', 'night', 'rest', 'release'] };
}

function moodTerms(mood: DailyCheckin['mood'] | null, hour: number) {
  if (mood === 'anxious' || mood === 'stressed') return ['anxiety', 'stress', 'breath', 'calm', 'reset', 'relief'];
  if (mood === 'tired') return hour >= 18 || hour < 5 ? ['sleep', 'rest', 'night', 'release'] : ['calm', 'reset', 'rest'];
  if (mood === 'low_energy') return ['energy', 'morning', 'focus', 'reset'];
  if (mood === 'focused') return ['focus', 'clarity', 'attention'];
  if (mood === 'calm') return ['calm', 'mindfulness', 'balance'];
  return [];
}

function availableMinutes(value: DailyCheckin['available_minutes']) {
  if (value === '15_plus') return 15;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function reasonFor(input: {
  language: AppLanguage;
  signal: ProgressRecommendation['signal'];
  mood: DailyCheckin['mood'] | null;
  category: string | null;
  timeBucket: string;
  targetMinutes: number | null;
}) {
  if (input.signal === 'mood' && input.mood) {
    return input.language === 'en'
      ? 'Recommended for the state you shared in today’s check-in.'
      : 'Подходит состоянию из сегодняшнего чек-ина.';
  }
  if (input.signal === 'category' && input.category) {
    return input.language === 'en'
      ? `Recommended because ${input.category} is the category you complete most often.`
      : `Рекомендация основана на категории «${input.category}», которую ты завершаешь чаще всего.`;
  }
  if (input.signal === 'duration' && input.targetMinutes) {
    return input.language === 'en'
      ? `Fits the ${input.targetMinutes} minutes you have available today.`
      : `Подходит под ${input.targetMinutes} минут, которые у тебя есть сегодня.`;
  }
  if (input.signal === 'time') {
    return input.language === 'en'
      ? `Chosen for your ${input.timeBucket} practice window.`
      : 'Выбрано с учётом времени дня и твоего привычного ритма.';
  }
  return input.language === 'en'
    ? 'A published Luna practice you can begin right now.'
    : 'Опубликованная практика Luna, которую можно начать прямо сейчас.';
}

export function resolveProgressRecommendation(input: {
  meditations: Meditation[];
  profile: ProfileStats | null;
  wellness: WellnessSummary | null;
  language: AppLanguage;
  hasPremium: boolean;
  hour?: number;
}): ProgressRecommendation | null {
  const hour = input.hour ?? new Date().getHours();
  const time = currentTimeSignal(hour);
  const latestMood = input.wellness?.todayCheckin?.mood
    ?? [...(input.profile?.moodTrend ?? [])].reverse().find((item) => item.mood)?.mood
    ?? null;
  const preferredCategory = input.profile?.progressInsights?.favoriteCategory ?? null;
  const categoryIsSupported = (input.profile?.progressInsights?.favoriteCategoryCount ?? 0) >= 2;
  const targetMinutes = availableMinutes(input.wellness?.todayCheckin?.available_minutes ?? null);
  const moodKeywords = moodTerms(latestMood, hour);
  const categoryKeywords = categoryIsSupported && preferredCategory ? normalize(preferredCategory).split(' ') : [];

  const candidates = input.meditations
    .filter((item) => item.published !== false && Boolean(item.audio_file) && Boolean(item.id))
    .map((meditation) => {
      const metadata = localizedMetadata(meditation, input.language);
      const moodMatches = moodKeywords.filter((term) => metadata.includes(normalize(term))).length;
      const categoryMatches = categoryKeywords.filter((term) => metadata.includes(term)).length;
      const timeMatches = time.terms.filter((term) => metadata.includes(term)).length;
      const durationMinutes = Math.max(1, Math.round(Number(meditation.duration || 0) / 60));
      const durationDifference = targetMinutes == null ? null : Math.abs(durationMinutes - targetMinutes);
      const durationScore = durationDifference == null ? 0 : Math.max(0, 7 - durationDifference);
      const score = moodMatches * 12 + categoryMatches * 9 + timeMatches * 3 + durationScore + (!meditation.premium || input.hasPremium ? 2 : 0);
      const signal: ProgressRecommendation['signal'] = moodMatches > 0
        ? 'mood'
        : categoryMatches > 0
          ? 'category'
          : durationScore >= 4
            ? 'duration'
            : timeMatches > 0
              ? 'time'
              : 'catalog';
      return { meditation, score, signal };
    })
    .sort((left, right) => right.score - left.score || Number(left.meditation.premium) - Number(right.meditation.premium) || left.meditation.title.localeCompare(right.meditation.title));

  if (!candidates.length) return null;
  let selected = candidates[0];
  if (!input.hasPremium && selected.meditation.premium) {
    const freeCandidate = candidates.find((item) => !item.meditation.premium);
    if (freeCandidate && freeCandidate.score >= selected.score - 4) selected = freeCandidate;
  }

  return {
    meditation: selected.meditation,
    locked: selected.meditation.premium && !input.hasPremium,
    signal: selected.signal,
    reason: reasonFor({
      language: input.language,
      signal: selected.signal,
      mood: latestMood,
      category: preferredCategory,
      timeBucket: time.bucket,
      targetMinutes
    })
  };
}
