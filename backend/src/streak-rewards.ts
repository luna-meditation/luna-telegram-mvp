export const streakMoonSeedBonuses = [
  { days: 7, seeds: 5, flag: 'reward_7' },
  { days: 14, seeds: 10, flag: 'reward_14' },
  { days: 30, seeds: 25, flag: 'reward_30' },
  { days: 100, seeds: 100, flag: 'reward_100' }
] as const;

export type StreakRewardFlags = Partial<Record<(typeof streakMoonSeedBonuses)[number]['flag'], boolean>>;

export function streakMoonSeedTotal(longestStreak: number) {
  const days = Math.max(0, Math.floor(longestStreak));
  return days + streakMoonSeedBonuses.reduce((total, reward) => total + (days >= reward.days ? reward.seeds : 0), 0);
}

export function moonSeedsForNewActiveDay(nextStreak: number, claimed: StreakRewardFlags) {
  return 1 + streakMoonSeedBonuses.reduce(
    (total, reward) => total + (nextStreak >= reward.days && !claimed[reward.flag] ? reward.seeds : 0),
    0
  );
}
