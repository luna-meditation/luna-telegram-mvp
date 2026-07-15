export type PracticeTimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';

type MeditationSummary = {
  category?: string | null;
  title?: string | null;
};

export type ProgressHistoryInput = {
  meditation_id?: string | null;
  completed?: boolean | null;
  completion_percent?: number | string | null;
  last_played?: string | null;
  meditations?: MeditationSummary | MeditationSummary[] | null;
};

export type ProgressPracticeDayInput = {
  local_date?: string | null;
  minutes?: number | string | null;
  sessions?: number | string | null;
};

export type ProgressBreathSessionInput = {
  duration_seconds?: number | null;
  completed_at?: string | null;
};

export type ProgressVerifiedSessionInput = {
  meditation_id?: string | null;
  listened_seconds?: number | string | null;
  completed_at?: string | null;
};

export type ProgressInsights = {
  favoriteCategory: string | null;
  favoriteCategoryCount: number;
  favoriteMeditationTitle: string | null;
  favoritePracticeTime: PracticeTimeBucket | null;
  favoritePracticeTimeCount: number;
  favoritePracticeTimeDays: number;
  averageSessionMinutes: number;
  completedPracticeSamples: number;
  monthlyPracticeDays: number;
  monthlyConsistency: number;
  bestPracticeWeekday: number | null;
  bestPracticeWeekdayCount: number;
  observedPracticeWeeks: number;
};

function mostFrequent(values: string[]) {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
  const entry = Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
  return {
    value: entry,
    count: entry ? counts[entry] ?? 0 : 0
  };
}

function meditationFromHistory(item: ProgressHistoryInput) {
  return Array.isArray(item.meditations) ? item.meditations[0] : item.meditations;
}

function hourInTimeZone(value: string, timeZone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone
    }).formatToParts(date).find((part) => part.type === 'hour')?.value;
    const parsed = Number(hour);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return date.getUTCHours();
  }
}

function practiceTimeBucket(value: string, timeZone: string): PracticeTimeBucket | null {
  const hour = hourInTimeZone(value, timeZone);
  if (hour == null) return null;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

function startDateKey(localDate: string, daysBack: number) {
  const date = new Date(`${localDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function dateKeyInTimeZone(value: string, timeZone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function mondayKey(localDate: string) {
  const date = new Date(`${localDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function buildProgressInsights(input: {
  history: ProgressHistoryInput[];
  verifiedSessions?: ProgressVerifiedSessionInput[];
  breathSessions: ProgressBreathSessionInput[];
  practiceDays: ProgressPracticeDayInput[];
  practiceDayKeys: string[];
  totalListeningMinutes: number;
  totalSessions: number;
  localDate: string;
  timeZone?: string | null;
}): ProgressInsights {
  const historyByMeditationId = new Map(input.history
    .filter((item) => item.meditation_id)
    .map((item) => [item.meditation_id as string, meditationFromHistory(item)]));
  const completedVerifiedSessions = (input.verifiedSessions ?? []).filter((item) => Boolean(item.completed_at));
  const verifiedMeditations = completedVerifiedSessions
    .map((item) => item.meditation_id ? historyByMeditationId.get(item.meditation_id) : null)
    .filter((item): item is MeditationSummary => Boolean(item));
  const categories = verifiedMeditations
    .map((item) => item.category?.trim())
    .filter((value): value is string => Boolean(value));
  const meditationTitles = verifiedMeditations
    .map((item) => item.title?.trim())
    .filter((value): value is string => Boolean(value));

  const timeZone = input.timeZone?.trim() || 'UTC';
  const completedTimestamps = [
    ...completedVerifiedSessions.map((item) => item.completed_at),
    ...input.breathSessions.map((item) => item.completed_at)
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, bucket: practiceTimeBucket(value, timeZone), localDate: dateKeyInTimeZone(value, timeZone) }))
    .filter((item): item is { value: string; bucket: PracticeTimeBucket; localDate: string } => Boolean(item.bucket && item.localDate));
  const practiceTimes = completedTimestamps.map((item) => item.bucket);

  const validPracticeDates = [...new Set(completedTimestamps.map((item) => item.localDate))];
  const monthStart = startDateKey(input.localDate, 29);
  const monthlyPracticeDays = validPracticeDates.filter((key) => key >= monthStart && key <= input.localDate).length;
  const weekdayActivity = validPracticeDates.reduce<Record<number, number>>((result, key) => {
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    result[weekday] = (result[weekday] ?? 0) + 1;
    return result;
  }, {});
  const bestPracticeWeekdayEntry = Object.entries(weekdayActivity)
    .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]))[0];

  const verifiedCompletedSeconds = completedVerifiedSessions.reduce((sum, item) => sum + Math.max(0, Number(item.listened_seconds ?? 0)), 0);
  const completedBreathSeconds = input.breathSessions.reduce((sum, item) => sum + Math.max(0, Number(item.duration_seconds ?? 0)), 0);
  const completedPracticeSamples = completedVerifiedSessions.length + input.breathSessions.length;
  const averageSessionMinutes = completedPracticeSamples > 0
    ? Math.round(((verifiedCompletedSeconds + completedBreathSeconds) / 60 / completedPracticeSamples) * 10) / 10
    : 0;

  const favoriteCategory = mostFrequent(categories);
  const favoriteMeditation = mostFrequent(meditationTitles);
  const favoritePracticeTime = mostFrequent(practiceTimes);
  const favoritePracticeTimeDays = favoritePracticeTime.value
    ? new Set(completedTimestamps.filter((item) => item.bucket === favoritePracticeTime.value).map((item) => item.localDate)).size
    : 0;
  const observedPracticeWeeks = new Set(validPracticeDates.map(mondayKey)).size;

  return {
    favoriteCategory: favoriteCategory.value,
    favoriteCategoryCount: favoriteCategory.count,
    favoriteMeditationTitle: favoriteMeditation.value,
    favoritePracticeTime: favoritePracticeTime.value as PracticeTimeBucket | null,
    favoritePracticeTimeCount: favoritePracticeTime.count,
    favoritePracticeTimeDays,
    averageSessionMinutes,
    completedPracticeSamples,
    monthlyPracticeDays,
    monthlyConsistency: Math.min(100, Math.round((monthlyPracticeDays / 30) * 100)),
    bestPracticeWeekday: bestPracticeWeekdayEntry ? Number(bestPracticeWeekdayEntry[0]) : null,
    bestPracticeWeekdayCount: bestPracticeWeekdayEntry ? Number(bestPracticeWeekdayEntry[1]) : 0,
    observedPracticeWeeks
  };
}
