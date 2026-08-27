export type JourneyStatusId =
  | 'initiate'
  | 'seeker'
  | 'adept'
  | 'guardian'
  | 'luminary'
  | 'sage'
  | 'ascendant'
  | 'celestial'
  | 'ethereal'
  | 'lunaris';

export type JourneyStatusRequirementKey =
  | 'completedMeditations'
  | 'longestStreak'
  | 'unlockedAchievements'
  | 'gardenLevel';

export type JourneyStatusMetrics = Record<JourneyStatusRequirementKey, number>;

export type JourneyStatusRequirement = {
  key: JourneyStatusRequirementKey;
  target: number;
};

export type JourneyStatusDefinition = {
  id: JourneyStatusId;
  rank: number;
  requirements: JourneyStatusRequirement[];
};

export const journeyStatusDefinitions: JourneyStatusDefinition[] = [
  { id: 'initiate', rank: 0, requirements: [{ key: 'completedMeditations', target: 1 }] },
  { id: 'seeker', rank: 1, requirements: [{ key: 'completedMeditations', target: 3 }, { key: 'longestStreak', target: 3 }] },
  { id: 'adept', rank: 2, requirements: [{ key: 'completedMeditations', target: 10 }, { key: 'longestStreak', target: 5 }] },
  { id: 'guardian', rank: 3, requirements: [{ key: 'completedMeditations', target: 20 }, { key: 'unlockedAchievements', target: 3 }] },
  { id: 'luminary', rank: 4, requirements: [{ key: 'completedMeditations', target: 35 }, { key: 'longestStreak', target: 10 }, { key: 'gardenLevel', target: 3 }] },
  { id: 'sage', rank: 5, requirements: [{ key: 'completedMeditations', target: 50 }, { key: 'unlockedAchievements', target: 7 }] },
  { id: 'ascendant', rank: 6, requirements: [{ key: 'completedMeditations', target: 75 }, { key: 'longestStreak', target: 21 }, { key: 'gardenLevel', target: 5 }] },
  { id: 'celestial', rank: 7, requirements: [{ key: 'completedMeditations', target: 100 }, { key: 'longestStreak', target: 30 }, { key: 'unlockedAchievements', target: 10 }] },
  { id: 'ethereal', rank: 8, requirements: [{ key: 'completedMeditations', target: 200 }, { key: 'longestStreak', target: 60 }, { key: 'gardenLevel', target: 7 }] },
  { id: 'lunaris', rank: 9, requirements: [{ key: 'completedMeditations', target: 365 }, { key: 'longestStreak', target: 100 }, { key: 'unlockedAchievements', target: 15 }, { key: 'gardenLevel', target: 7 }] }
];

function safeMetric(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

export function normalizedJourneyStatusMetrics(metrics: Partial<JourneyStatusMetrics>): JourneyStatusMetrics {
  return {
    completedMeditations: safeMetric(metrics.completedMeditations),
    longestStreak: safeMetric(metrics.longestStreak),
    unlockedAchievements: safeMetric(metrics.unlockedAchievements),
    gardenLevel: safeMetric(metrics.gardenLevel)
  };
}

export function eligibleJourneyStatusRank(metricsInput: Partial<JourneyStatusMetrics>) {
  const metrics = normalizedJourneyStatusMetrics(metricsInput);
  let eligibleRank = -1;

  for (const status of journeyStatusDefinitions) {
    if (!status.requirements.every((requirement) => metrics[requirement.key] >= requirement.target)) break;
    eligibleRank = status.rank;
  }

  return eligibleRank;
}

export function buildJourneyStatus(
  metricsInput: Partial<JourneyStatusMetrics>,
  storedRankInput = -1,
  unlockedAt: string | null = null
) {
  const metrics = normalizedJourneyStatusMetrics(metricsInput);
  const normalizedStoredRank = Number.isFinite(storedRankInput) ? Math.floor(storedRankInput) : -1;
  const storedRank = Math.max(-1, Math.min(journeyStatusDefinitions.length - 1, normalizedStoredRank));
  const eligibleRank = eligibleJourneyStatusRank(metrics);
  const rank = Math.max(storedRank, eligibleRank);
  const currentDefinition = journeyStatusDefinitions[Math.max(0, rank)];
  const nextDefinition = journeyStatusDefinitions[rank + 1] ?? null;

  const next = nextDefinition ? (() => {
    const ratios = nextDefinition.requirements.map((requirement) => Math.min(1, metrics[requirement.key] / requirement.target));
    const progressPercent = Math.round((ratios.reduce((sum, value) => sum + value, 0) / Math.max(1, ratios.length)) * 100);
    const remaining = nextDefinition.requirements
      .map((requirement) => ({
        key: requirement.key,
        current: metrics[requirement.key],
        target: requirement.target,
        remaining: Math.max(0, requirement.target - metrics[requirement.key])
      }))
      .filter((requirement) => requirement.remaining > 0);

    return {
      id: nextDefinition.id,
      rank: nextDefinition.rank,
      progressPercent,
      remaining
    };
  })() : null;

  return {
    id: currentDefinition.id,
    rank,
    earned: rank >= 0,
    eligibleRank,
    unlockedAt,
    next
  };
}
