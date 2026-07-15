import type { ProfileStats } from '../../api';

type ProgressInsights = NonNullable<ProfileStats['progressInsights']>;

export const progressPatternThresholds = {
  preferredTimeSessions: 5,
  preferredTimeDays: 3,
  familiarCategoryCompletions: 3,
  strongestWeekdayDays: 3,
  strongestWeekdayWeeks: 2,
  averagePracticeSamples: 3
} as const;

export function progressPatternEvidence(insight: ProgressInsights | null | undefined) {
  if (!insight) {
    return { time: false, category: false, weekday: false, average: false };
  }
  return {
    time: insight.completedPracticeSamples >= progressPatternThresholds.preferredTimeSessions
      && insight.favoritePracticeTimeCount >= progressPatternThresholds.preferredTimeSessions
      && insight.favoritePracticeTimeDays >= progressPatternThresholds.preferredTimeDays,
    category: insight.favoriteCategoryCount >= progressPatternThresholds.familiarCategoryCompletions,
    weekday: insight.bestPracticeWeekdayCount >= progressPatternThresholds.strongestWeekdayDays
      && insight.observedPracticeWeeks >= progressPatternThresholds.strongestWeekdayWeeks,
    average: insight.completedPracticeSamples >= progressPatternThresholds.averagePracticeSamples
      && insight.averageSessionMinutes > 0
  };
}
