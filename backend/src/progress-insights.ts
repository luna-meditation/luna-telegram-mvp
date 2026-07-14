export type PracticeTimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';

type MeditationSummary = {
  category?: string | null;
  title?: string | null;
};

export type ProgressHistoryInput = {
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
  completed_at?: string | null;
};

export type ProgressInsights = {
  favoriteCategory: string | null;
  favoriteMeditationTitle: string | null;
  favoritePracticeTime: PracticeTimeBucket | null;
  averageSessionMinutes: number;
  monthlyPracticeDays: number;
  monthlyConsistency: number;
  bestPracticeWeekday: number | null;
};

function mostFrequent(values: string[]) {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

function meditationFromHistory(item: ProgressHistoryInput) {
  return Array.isArray(item.meditations) ? item.meditations[0] : item.meditations;
}

function isCompletedHistory(item: ProgressHistoryInput) {
  const completionPercent = Number(item.completion_percent ?? 0);
  return Boolean(item.completed) || (Number.isFinite(completionPercent) && completionPercent >= 90);
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

export function buildProgressInsights(input: {
  history: ProgressHistoryInput[];
  breathSessions: ProgressBreathSessionInput[];
  practiceDays: ProgressPracticeDayInput[];
  practiceDayKeys: string[];
  totalListeningMinutes: number;
  totalSessions: number;
  localDate: string;
  timeZone?: string | null;
}): ProgressInsights {
  const completedHistory = input.history.filter(isCompletedHistory);
  const categories = completedHistory
    .map((item) => meditationFromHistory(item)?.category?.trim())
    .filter((value): value is string => Boolean(value));
  const meditationTitles = completedHistory
    .map((item) => meditationFromHistory(item)?.title?.trim())
    .filter((value): value is string => Boolean(value));

  const timeZone = input.timeZone?.trim() || 'UTC';
  const practiceTimes = [
    ...completedHistory.map((item) => item.last_played),
    ...input.breathSessions.map((item) => item.completed_at)
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => practiceTimeBucket(value, timeZone))
    .filter((value): value is PracticeTimeBucket => Boolean(value));

  const monthStart = startDateKey(input.localDate, 29);
  const monthlyPracticeDays = new Set(input.practiceDayKeys.filter((key) => key >= monthStart && key <= input.localDate)).size;

  const weekdayActivity = input.practiceDays.reduce<Record<number, number>>((result, item) => {
    if (!item.local_date || !/^\d{4}-\d{2}-\d{2}$/.test(item.local_date)) return result;
    const weekday = new Date(`${item.local_date}T12:00:00Z`).getUTCDay();
    const minutes = Math.max(0, Number(item.minutes ?? 0));
    const sessions = Math.max(0, Number(item.sessions ?? 0));
    result[weekday] = (result[weekday] ?? 0) + (Number.isFinite(minutes) ? minutes : 0) + (Number.isFinite(sessions) ? sessions * 0.25 : 0);
    return result;
  }, {});
  const bestPracticeWeekdayEntry = Object.entries(weekdayActivity)
    .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]))[0];

  const averageSessionMinutes = input.totalSessions > 0
    ? Math.round((Math.max(0, input.totalListeningMinutes) / input.totalSessions) * 10) / 10
    : 0;

  return {
    favoriteCategory: mostFrequent(categories),
    favoriteMeditationTitle: mostFrequent(meditationTitles),
    favoritePracticeTime: mostFrequent(practiceTimes) as PracticeTimeBucket | null,
    averageSessionMinutes,
    monthlyPracticeDays,
    monthlyConsistency: Math.min(100, Math.round((monthlyPracticeDays / 30) * 100)),
    bestPracticeWeekday: bestPracticeWeekdayEntry ? Number(bestPracticeWeekdayEntry[0]) : null
  };
}
