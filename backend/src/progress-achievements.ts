export type AchievementStats = {
  completedMeditations: number;
  completedBreathSessions: number;
  completed: number;
  minutesListened: number;
  currentStreak: number;
  longestStreak: number;
  checkinsCount: number;
  hasPremiumAccess: boolean;
  gardenLevel: number;
  hasMorningPractice: boolean;
  hasEveningPractice: boolean;
  practiceDays: number;
  completedWeeks: number;
  perfectWeeks: number;
  categoryCounts: Record<string, number>;
  tarotReadings?: number;
  dailyCards?: number;
  aiConversations?: number;
  calculatedCharts?:number;
  compatibilityReports?:number;
  confirmedMemories?:number;
};

export type AchievementCategory = 'practice' | 'rhythm' | 'wellness' | 'garden' | 'premium';

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  current: (stats: AchievementStats) => number;
  target: number;
};
export type AchievementFamily='seeker'|'oracle'|'guardian'|'explorer'|'devoted';
export function achievementFamily(definition:Pick<AchievementDefinition,'id'|'category'>):AchievementFamily {
 if(definition.id.startsWith('tarot_'))return 'oracle';
 if(['deep_sleep_explorer','anxiety_companion','focus_builder','calm_explorer'].includes(definition.id))return 'explorer';
 if(definition.category==='rhythm')return 'devoted';
 if(definition.category==='practice'||definition.category==='garden')return 'guardian';
 return 'seeker';
}

export type AchievementRow = {
  achievement_id: string;
  unlocked_at?: string | null;
  progress?: number | null;
};

export function progressToTarget(current: number, target: number) {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

const booleanValue = (value: boolean) => value ? 1 : 0;
const strongestStreak = (stats: AchievementStats) => Math.max(stats.currentStreak, stats.longestStreak);

// These definitions are the single backend source for unlock state and in-progress percentages.
export const achievementDefinitions: AchievementDefinition[] = [
  {id:'astrology_first_chart',title:'Your Sky',description:'Calculate a natal chart from saved birth details.',category:'wellness',current:s=>s.calculatedCharts??0,target:1},
  {id:'astrology_two_perspectives',title:'Two Perspectives',description:'Save a symbolic reflection on two calculated charts.',category:'wellness',current:s=>s.compatibilityReports??0,target:1},
  {id:'first_confirmed_memory',title:'A Little More You',description:'Choose and confirm one fact in Luna memory.',category:'wellness',current:s=>s.confirmedMemories??0,target:1},
  {id:'first_breathwork',title:'Your Own Rhythm',description:'Complete one verified breathing practice.',category:'practice',current:s=>s.completedBreathSessions,target:1},
  { id: 'tarot_first_reading', title: 'First Symbol', description: 'Saved your first completed Tarot reflection.', category: 'wellness', current: (stats) => stats.tarotReadings ?? 0, target: 1 },
  { id: 'tarot_seven_daily_cards', title: 'Seven Daily Reflections', description: 'Explored seven different daily cards.', category: 'wellness', current: (stats) => stats.dailyCards ?? 0, target: 7 },
  { id: 'tarot_ten_readings', title: 'The Oracle', description: 'Explored ten completed Tarot reflections.', category: 'wellness', current: (stats) => stats.tarotReadings ?? 0, target: 10 },
  { id: 'first_luna_conversation', title: 'A Space to Reflect', description: 'Started a conversation with Luna AI.', category: 'wellness', current: (stats) => stats.aiConversations ?? 0, target: 1 },
  { id: 'first_meditation', title: 'First Meditation', description: 'Completed your first Luna meditation.', category: 'practice', current: (stats) => stats.completedMeditations, target: 1 },
  { id: 'first_week', title: 'First Week', description: 'Completed practice days across your first week.', category: 'rhythm', current: (stats) => Math.max(stats.practiceDays, stats.completedWeeks > 0 ? 7 : 0), target: 7 },
  { id: 'first_month', title: 'First Month', description: 'Built a month of Luna returns.', category: 'rhythm', current: (stats) => stats.practiceDays, target: 30 },
  { id: 'three_meditations', title: 'Three Calm Returns', description: 'Completed three meditation sessions.', category: 'practice', current: (stats) => stats.completedMeditations, target: 3 },
  { id: 'seven_day_rhythm', title: '7-Day Rhythm', description: 'Protected a full week of quiet rhythm.', category: 'rhythm', current: strongestStreak, target: 7 },
  { id: 'fourteen_day_rhythm', title: '14-Day Rhythm', description: 'Returned for two gentle weeks.', category: 'rhythm', current: strongestStreak, target: 14 },
  { id: 'thirty_day_rhythm', title: '30-Day Rhythm', description: 'Built a lasting Luna rhythm.', category: 'rhythm', current: strongestStreak, target: 30 },
  { id: 'sixty_day_rhythm', title: '60-Day Rhythm', description: 'Protected your practice through many days.', category: 'rhythm', current: strongestStreak, target: 60 },
  { id: 'hundred_day_rhythm', title: '100-Day Rhythm', description: 'Created a rare long-term rhythm.', category: 'rhythm', current: strongestStreak, target: 100 },
  { id: 'hundred_minutes', title: '100 Listening Minutes', description: 'Spent 100 verified minutes with Luna.', category: 'practice', current: (stats) => stats.minutesListened, target: 100 },
  { id: 'five_hundred_minutes', title: '500 Listening Minutes', description: 'Created a deep practice foundation.', category: 'practice', current: (stats) => stats.minutesListened, target: 500 },
  { id: 'thousand_minutes', title: '1000 Listening Minutes', description: 'Returned to calm again and again.', category: 'practice', current: (stats) => stats.minutesListened, target: 1000 },
  { id: 'ten_sessions', title: '10 Sessions', description: 'Completed ten Luna practices.', category: 'practice', current: (stats) => stats.completed, target: 10 },
  { id: 'fifty_sessions', title: '50 Sessions', description: 'Completed fifty Luna practices.', category: 'practice', current: (stats) => stats.completed, target: 50 },
  { id: 'hundred_sessions', title: '100 Sessions', description: 'Completed one hundred Luna practices.', category: 'practice', current: (stats) => stats.completed, target: 100 },
  { id: 'morning_practice', title: 'Morning Practice', description: 'Started a day with Luna.', category: 'practice', current: (stats) => booleanValue(stats.hasMorningPractice), target: 1 },
  { id: 'evening_practice', title: 'Evening Practice', description: 'Closed a day with Luna.', category: 'practice', current: (stats) => booleanValue(stats.hasEveningPractice), target: 1 },
  { id: 'deep_sleep_explorer', title: 'Deep Sleep Explorer', description: 'Completed a sleep practice.', category: 'practice', current: (stats) => stats.categoryCounts.sleep ?? 0, target: 1 },
  { id: 'anxiety_companion', title: 'Anxiety Companion', description: 'Completed an anxiety-support practice.', category: 'practice', current: (stats) => stats.categoryCounts.anxiety ?? 0, target: 1 },
  { id: 'focus_builder', title: 'Focus Builder', description: 'Completed a focus practice.', category: 'practice', current: (stats) => stats.categoryCounts.focus ?? 0, target: 1 },
  { id: 'first_checkin', title: 'First Check-in', description: 'Checked in with your inner weather.', category: 'wellness', current: (stats) => stats.checkinsCount, target: 1 },
  { id: 'seven_checkins', title: 'Seven Check-ins', description: 'Built a gentle reflection habit.', category: 'wellness', current: (stats) => stats.checkinsCount, target: 7 },
  { id: 'thirty_checkins', title: 'Thirty Check-ins', description: 'Created a fuller picture of your rhythm.', category: 'wellness', current: (stats) => stats.checkinsCount, target: 30 },
  { id: 'one_hundred_checkins', title: '100 Check-ins', description: 'Built a deep reflection history.', category: 'wellness', current: (stats) => stats.checkinsCount, target: 100 },
  { id: 'premium_member', title: 'Premium Member', description: 'Unlocked the deeper Luna experience.', category: 'premium', current: (stats) => booleanValue(stats.hasPremiumAccess), target: 1 },
  { id: 'moon_garden_level_3', title: 'Garden Taking Shape', description: 'Planted three Moon Garden upgrades.', category: 'garden', current: (stats) => stats.gardenLevel, target: 3 },
  { id: 'moon_garden_level_5', title: 'Moonlit Garden', description: 'Planted five Moon Garden upgrades.', category: 'garden', current: (stats) => stats.gardenLevel, target: 5 },
  { id: 'moon_garden_level_7', title: 'Full Moon Garden', description: 'Planted all seven Moon Garden upgrades.', category: 'garden', current: (stats) => stats.gardenLevel, target: 7 },
  { id: 'seven_perfect_weeks', title: 'Seven Complete Weeks', description: 'Completed seven full practice weeks.', category: 'rhythm', current: (stats) => stats.perfectWeeks, target: 7 },
  { id: 'thirty_perfect_days', title: 'Thirty Practice Days', description: 'Completed thirty practice days.', category: 'rhythm', current: (stats) => stats.practiceDays, target: 30 },
  { id: 'one_year_together', title: 'One Year Together', description: 'Returned to Luna across 365 practice days.', category: 'rhythm', current: (stats) => stats.practiceDays, target: 365 },
  { id: 'calm_explorer', title: 'Calm Explorer', description: 'Completed five practices across Luna.', category: 'practice', current: (stats) => stats.completed, target: 5 }
];

export function buildAchievementItems(stats: AchievementStats, rows: AchievementRow[]) {
  const unlockedById = new Map(rows.map((item) => [item.achievement_id, item]));
  return achievementDefinitions.map((definition) => {
    const current = Math.max(0, definition.current(stats));
    const stored = unlockedById.get(definition.id);
    const unlocked = current >= definition.target||Boolean(stored?.unlocked_at)||Number(stored?.progress)>=100;
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      category: definition.category,
      family:achievementFamily(definition),
      unlocked,
      unlockedAt: stored?.unlocked_at ?? null,
      progress: unlocked ? 100 : Math.max(progressToTarget(current, definition.target),Math.min(99,Math.max(0,Number(stored?.progress)||0))),
      current,
      target: definition.target
    };
  });
}
