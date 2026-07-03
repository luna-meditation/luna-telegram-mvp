import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { env } from './config.js';
import { plans, type PlanId } from './plans.js';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: {
    transport: WebSocket as unknown as typeof globalThis.WebSocket
  }
});

export type TelegramUserInput = {
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export type MeditationInput = {
  title: string;
  subtitle?: string;
  description: string;
  category: string;
  duration: number;
  cover_image: string;
  audio_file: string;
  premium: boolean;
  published?: boolean;
  mood: 'Calm' | 'Stressed' | 'Focused' | 'Tired' | 'Anxious';
  translations?: Record<string, {
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
    audioUrl?: string | null;
  }>;
};

export type HistoryInput = {
  meditation_id: string;
  last_position: number;
  duration: number;
  completed?: boolean;
};

const moonGardenElements = [
  { id: 'moon-flower', cost: 2 },
  { id: 'calm-stone', cost: 3 },
  { id: 'water-ripple', cost: 5 },
  { id: 'golden-lantern', cost: 8 },
  { id: 'night-lily', cost: 10 },
  { id: 'crescent-tree', cost: 12 },
  { id: 'star-path', cost: 20 },
  { id: 'breathing-pond', cost: 25 }
];

const moonGardenElementCost = new Map(moonGardenElements.map((element) => [element.id, element.cost]));

export type DailyCheckinInput = {
  sleep_range: 'less_than_4' | '4_6' | '6_8' | '8_plus';
  mood: 'calm' | 'stressed' | 'tired' | 'anxious' | 'focused' | 'low_energy';
  available_minutes: '3' | '5' | '10' | '15_plus';
  local_date?: string;
};

export async function upsertUser(user: TelegramUserInput) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        ...user,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: 'telegram_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserAccess(telegramId: number) {
  const { data, error } = await supabase
    .from('users')
    .select('telegram_id, first_name, username, language_code, active_until, lifetime_access, free_used')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) throw error;

  const now = Date.now();
  const activeUntil = data?.active_until ? new Date(data.active_until).getTime() : 0;
  const hasPremium = Boolean(data?.lifetime_access || activeUntil > now);

  return {
    user: data,
    hasPremium,
    plan: data?.lifetime_access ? 'Lifetime' : activeUntil > now ? 'Monthly' : 'Free'
  };
}

export async function updateUserLanguage(telegramId: number, language: 'en' | 'ru') {
  const { data, error } = await supabase
    .from('users')
    .update({ language_code: language, last_seen_at: new Date().toISOString() })
    .eq('telegram_id', telegramId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPractices() {
  const { data, error } = await supabase
    .from('practices')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getMeditations(telegramId?: number, includeUnpublished = false) {
  let query = supabase
    .from('meditations')
    .select('*')
    .order('created_at', { ascending: false });

  if (!includeUnpublished) query = query.eq('published', true);

  const { data: meditations, error } = await query;

  if (error) throw error;
  if (!telegramId) return meditations ?? [];

  const [{ data: favorites }, { data: history }] = await Promise.all([
    supabase.from('favorites').select('meditation_id').eq('telegram_id', telegramId),
    supabase.from('history').select('*').eq('telegram_id', telegramId)
  ]);

  const favoriteIds = new Set((favorites ?? []).map((item) => item.meditation_id));
  const historyByMeditation = new Map((history ?? []).map((item) => [item.meditation_id, item]));

  return (meditations ?? []).map((meditation) => ({
    ...meditation,
    favorite: favoriteIds.has(meditation.id),
    history: historyByMeditation.get(meditation.id) ?? null
  }));
}

export async function getMeditationById(id: string) {
  const { data, error } = await supabase
    .from('meditations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertFavorite(telegramId: number, meditationId: string, favorite: boolean) {
  if (!favorite) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('telegram_id', telegramId)
      .eq('meditation_id', meditationId);
    if (error) throw error;
    return { favorite: false };
  }

  const { error } = await supabase
    .from('favorites')
    .upsert({ telegram_id: telegramId, meditation_id: meditationId }, { onConflict: 'telegram_id,meditation_id' });

  if (error) throw error;
  return { favorite: true };
}

export async function getFavorites(telegramId: number) {
  const { data, error } = await supabase
    .from('favorites')
    .select('created_at, meditations(*)')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item) => ({ ...item.meditations, favorite: true }));
}

export async function upsertHistory(telegramId: number, input: HistoryInput) {
  const completion = input.duration > 0 ? Math.min(100, Math.round((input.last_position / input.duration) * 100)) : 0;
  const completed = Boolean(input.completed || completion >= 90);

  const { data: existing, error: existingError } = await supabase
    .from('history')
    .select('play_count')
    .eq('telegram_id', telegramId)
    .eq('meditation_id', input.meditation_id)
    .maybeSingle();

  if (existingError) throw existingError;

  const { error } = await supabase
    .from('history')
    .upsert(
      {
        telegram_id: telegramId,
        meditation_id: input.meditation_id,
        last_position: Math.max(0, Math.floor(input.last_position)),
        completion_percent: completion,
        completed,
        last_played: new Date().toISOString(),
        play_count: (existing?.play_count ?? 0) + 1
      },
      { onConflict: 'telegram_id,meditation_id' }
    );

  if (error) throw error;

  await supabase.rpc('increment_meditation_play_count', { meditation_uuid: input.meditation_id }).then(async ({ error: rpcError }) => {
    if (rpcError) {
      const meditation = await getMeditationById(input.meditation_id);
      await supabase
        .from('meditations')
        .update({ play_count: (meditation?.play_count ?? 0) + 1 })
        .eq('id', input.meditation_id);
    }
  });

  if (completed) {
    await awardMoonSeeds(telegramId, 1);
    await updateStreak(telegramId);
  }

  return { completion_percent: completion, completed };
}

export async function recordBreathSession(telegramId: number, input: {
  mode: string;
  duration_seconds: number;
  breath_count: number;
}) {
  const mode = ['calm', 'box', 'reset'].includes(input.mode) ? input.mode : 'calm';
  const durationSeconds = Math.max(30, Math.min(600, Math.floor(input.duration_seconds || 60)));
  const breathCount = Math.max(1, Math.min(120, Math.floor(input.breath_count || 1)));

  const { error } = await supabase.from('breath_sessions').insert({
    telegram_id: telegramId,
    mode,
    duration_seconds: durationSeconds,
    breath_count: breathCount
  });

  if (error) throw error;
  await awardMoonSeeds(telegramId, 1);
  await updateStreak(telegramId);

  return {
    completed: true,
    mode,
    duration_seconds: durationSeconds,
    breath_count: breathCount
  };
}

export async function recordSceneMoonSeed(telegramId: number, input: {
  scene_id?: string;
  duration_seconds: number;
}) {
  const durationSeconds = Math.max(0, Math.floor(input.duration_seconds || 0));
  if (durationSeconds < 300) {
    return { awarded: false, moonSeeds: 0 };
  }

  await awardMoonSeeds(telegramId, 1);
  return {
    awarded: true,
    moonSeeds: 1,
    scene_id: input.scene_id ?? null
  };
}

export async function getHistory(telegramId: number) {
  const { data, error } = await supabase
    .from('history')
    .select('*, meditations(*)')
    .eq('telegram_id', telegramId)
    .order('last_played', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item) => ({ ...item, meditation: item.meditations }));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function mostCommonValue<T extends string>(values: T[]) {
  const counts = values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>());
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function sleepScore(value: DailyCheckinInput['sleep_range']) {
  if (value === 'less_than_4') return 3;
  if (value === '4_6') return 5;
  if (value === '6_8') return 7;
  return 8;
}

function sleepLabel(value: DailyCheckinInput['sleep_range'] | null) {
  if (!value) return 'No check-ins yet';
  if (value === 'less_than_4') return '<4h';
  if (value === '4_6') return '4-6h';
  if (value === '6_8') return '6-8h';
  return '8h+';
}

function moodLabel(value: DailyCheckinInput['mood'] | null) {
  if (!value) return 'Not enough data yet';
  return value.replace('_', ' ');
}

function buildWeeklyInsight(input: {
  weeklyCheckins: Array<DailyCheckinInput & { created_at?: string }>;
  completed: number;
  minutesListened: number;
  currentStreak: number;
}) {
  if (!input.weeklyCheckins.length && input.completed === 0) {
    return 'Start with one short practice today. Luna will build your weekly insight as you check in and listen.';
  }

  const tiredDays = input.weeklyCheckins.filter((item) => ['less_than_4', '4_6'].includes(item.sleep_range)).length;
  const commonMood = mostCommonValue(input.weeklyCheckins.map((item) => item.mood));

  if (tiredDays >= 3) return 'Your week shows lower sleep. Choose gentler evening sessions and keep practices short.';
  if (commonMood === 'anxious' || commonMood === 'stressed') return 'You have been carrying extra tension. Breath-led meditations may help you reset faster.';
  if (input.currentStreak >= 3) return 'Your calm routine is becoming consistent. Keep the next session easy to protect the streak.';
  if (input.minutesListened > 0) return `You created ${input.minutesListened} minutes of calm. A small repeat tomorrow matters more than a perfect session.`;
  return 'A short check-in is enough to begin. Luna will personalize your next practice from there.';
}

export async function upsertDailyCheckin(telegramId: number, input: DailyCheckinInput) {
  const payload = {
    telegram_id: telegramId,
    sleep_range: input.sleep_range,
    mood: input.mood,
    available_minutes: input.available_minutes,
    local_date: input.local_date ?? todayKey()
  };

  const { data, error } = await supabase
    .from('daily_checkins')
    .upsert(payload, { onConflict: 'telegram_id,local_date' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTodayCheckin(telegramId: number, localDate = todayKey()) {
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('telegram_id', telegramId)
    .eq('local_date', localDate)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getWellnessSummary(telegramId: number) {
  const weekStart = daysAgo(6).toISOString().slice(0, 10);
  const [{ data: checkins, error: checkinsError }, profile] = await Promise.all([
    supabase
      .from('daily_checkins')
      .select('*')
      .eq('telegram_id', telegramId)
      .gte('local_date', weekStart)
      .order('local_date', { ascending: false }),
    getProfileStats(telegramId)
  ]);

  if (checkinsError) throw checkinsError;

  const weeklyCheckins = (checkins ?? []) as Array<DailyCheckinInput & { local_date: string; created_at?: string }>;
  const todayCheckin = weeklyCheckins.find((item) => item.local_date === todayKey()) ?? null;
  const mostCommonMood = mostCommonValue(weeklyCheckins.map((item) => item.mood));
  const averageSleep = weeklyCheckins.length
    ? Math.round(weeklyCheckins.reduce((sum, item) => sum + sleepScore(item.sleep_range), 0) / weeklyCheckins.length)
    : 0;
  const level = Math.max(1, Math.floor((profile.completed + profile.currentStreak + weeklyCheckins.length) / 5) + 1);
  const levelProgress = Math.min(100, ((profile.completed + weeklyCheckins.length) % 5) * 20);

  return {
    todayCheckin,
    weeklyCheckins,
    weeklyCheckinCount: weeklyCheckins.length,
    averageSleepHours: averageSleep,
    averageSleepLabel: sleepLabel(mostCommonValue(weeklyCheckins.map((item) => item.sleep_range))),
    mostCommonMood,
    mostCommonMoodLabel: moodLabel(mostCommonMood),
    weeklyInsight: buildWeeklyInsight({
      weeklyCheckins,
      completed: profile.completed,
      minutesListened: profile.minutesListened,
      currentStreak: profile.currentStreak
    }),
    recommendedFocus:
      mostCommonMood === 'anxious' || mostCommonMood === 'stressed'
        ? 'Breath and anxiety relief'
        : averageSleep > 0 && averageSleep < 6
          ? 'Sleep recovery'
          : profile.currentStreak > 0
            ? 'Keep the streak gentle'
            : 'A short calm reset',
    level: {
      title: level >= 5 ? 'Moon Guide' : level >= 3 ? 'Calm Builder' : 'First Light',
      current: level,
      progress: levelProgress,
      next: level >= 5 ? 'Deep Practice' : level >= 3 ? 'Moon Guide' : 'Calm Builder'
    },
    achievements: [
      {
        id: 'first_checkin',
        title: 'First Check-in',
        description: 'Shared how you feel today.',
        unlocked: weeklyCheckins.length > 0
      },
      {
        id: 'three_sessions',
        title: 'Three Sessions',
        description: 'Completed three meditations.',
        unlocked: profile.completed >= 3
      },
      {
        id: 'weekly_rhythm',
        title: 'Weekly Rhythm',
        description: 'Checked in three times this week.',
        unlocked: weeklyCheckins.length >= 3
      },
      {
        id: 'seven_day_streak',
        title: '7 Day Streak',
        description: 'Built a full week of calm.',
        unlocked: profile.currentStreak >= 7
      }
    ]
  };
}

export async function updateStreak(telegramId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: current, error: currentError } = await supabase
    .from('streaks')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (currentError) throw currentError;

  if (current?.last_completed_date === today) return current;

  const nextStreak = current?.last_completed_date === yesterday ? current.current_streak + 1 : 1;
  const longest = Math.max(current?.longest_streak ?? 0, nextStreak);
  const payload = {
    telegram_id: telegramId,
    current_streak: nextStreak,
    longest_streak: longest,
    last_completed_date: today,
    reward_7: nextStreak >= 7 || Boolean(current?.reward_7),
    reward_14: nextStreak >= 14 || Boolean(current?.reward_14),
    reward_30: nextStreak >= 30 || Boolean(current?.reward_30),
    reward_100: nextStreak >= 100 || Boolean(current?.reward_100),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('streaks')
    .upsert(payload, { onConflict: 'telegram_id' })
    .select()
    .single();

  if (error) throw error;
  if (nextStreak >= 7 && !current?.reward_7) {
    await awardMoonSeeds(telegramId, 5);
  }
  return data;
}

function normalizeMeditationInput<T extends Partial<MeditationInput>>(input: T) {
  const hasContent =
    Object.prototype.hasOwnProperty.call(input, 'translations') ||
    Object.prototype.hasOwnProperty.call(input, 'title') ||
    Object.prototype.hasOwnProperty.call(input, 'subtitle') ||
    Object.prototype.hasOwnProperty.call(input, 'description') ||
    Object.prototype.hasOwnProperty.call(input, 'audio_file');

  if (!hasContent) return input;

  const translations = {
    ...(input.translations ?? {}),
    en: {
      ...(input.translations?.en ?? {}),
      title: input.translations?.en?.title ?? input.title,
      subtitle: input.translations?.en?.subtitle ?? input.subtitle ?? '',
      description: input.translations?.en?.description ?? input.description,
      audioUrl: input.translations?.en?.audioUrl ?? input.audio_file
    }
  };

  return { ...input, translations };
}

export async function createMeditation(input: MeditationInput) {
  const { data, error } = await supabase.from('meditations').insert(normalizeMeditationInput(input)).select().single();
  if (error) throw error;
  return data;
}

export async function updateMeditation(id: string, input: Partial<MeditationInput>) {
  const { data, error } = await supabase
    .from('meditations')
    .update({ ...normalizeMeditationInput(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMeditation(id: string) {
  const { error } = await supabase.from('meditations').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertCategory(input: { name: string; slug: string; sort_order?: number }) {
  const { data, error } = await supabase
    .from('categories')
    .upsert(input, { onConflict: 'slug' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(slug: string) {
  const { error } = await supabase.from('categories').delete().eq('slug', slug);
  if (error) throw error;
}

export async function markPracticeComplete(input: {
  telegram_id: number;
  practice_id: string;
  mood_before?: string;
  mood_after?: string;
}) {
  const { error } = await supabase.from('progress').insert(input);
  if (error) throw error;
}

function plantedElementIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && moonGardenElementCost.has(item))
    : [];
}

function plantedElementsCost(ids: string[]) {
  return ids.reduce((sum, id) => sum + (moonGardenElementCost.get(id) ?? 0), 0);
}

function earnedMoonSeeds(input: {
  completedMeditations: number;
  completedBreathSessions: number;
  currentStreak: number;
  longestStreak: number;
}) {
  const streakBonus = Math.max(input.currentStreak, input.longestStreak) >= 7 ? 5 : 0;
  return input.completedMeditations + input.completedBreathSessions + streakBonus;
}

async function awardMoonSeeds(telegramId: number, amount: number) {
  if (amount <= 0) return;

  const { data: existing, error: readError } = await supabase
    .from('moon_gardens')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (readError) {
    console.warn('Moon Seeds could not be awarded yet; Moon Garden table may be pending migration.', readError.message);
    return;
  }

  const plantedGardenElements = plantedElementIds(existing?.planted_garden_elements);
  const moonSeedsEarnedTotal = Number(existing?.moon_seeds_earned_total ?? 0) + amount;
  const moonSeedsAvailable = Math.max(0, moonSeedsEarnedTotal - plantedElementsCost(plantedGardenElements));

  const { error } = await supabase
    .from('moon_gardens')
    .upsert(
      {
        telegram_id: telegramId,
        moon_seeds_available: moonSeedsAvailable,
        moon_seeds_earned_total: moonSeedsEarnedTotal,
        planted_garden_elements: plantedGardenElements,
        last_moon_seed_earned_at: new Date().toISOString(),
        garden_level: existing?.garden_level ?? 1,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'telegram_id' }
    );

  if (error) {
    console.warn('Moon Seeds award could not be saved.', error.message);
  }
}

async function getMoonGardenState(telegramId: number, input: {
  completedMeditations: number;
  completedBreathSessions: number;
  currentStreak: number;
  longestStreak: number;
  gardenLevel: number;
}) {
  const earnedFromPractice = earnedMoonSeeds(input);
  const { data: existing, error } = await supabase
    .from('moon_gardens')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) {
    console.warn('Moon Garden state unavailable; using safe fallback.', error.message);
    return {
      moonSeedsAvailable: earnedFromPractice,
      moonSeedsEarnedTotal: earnedFromPractice,
      plantedGardenElements: [] as string[],
      plantedElementsCount: 0,
      lastMoonSeedEarnedAt: null as string | null,
      gardenLevel: input.gardenLevel
    };
  }

  const plantedGardenElements = plantedElementIds(existing?.planted_garden_elements);
  const moonSeedsEarnedTotal = Math.max(Number(existing?.moon_seeds_earned_total ?? 0), earnedFromPractice);
  const moonSeedsAvailable = Math.max(0, moonSeedsEarnedTotal - plantedElementsCost(plantedGardenElements));
  const lastMoonSeedEarnedAt =
    moonSeedsEarnedTotal > Number(existing?.moon_seeds_earned_total ?? 0)
      ? new Date().toISOString()
      : existing?.last_moon_seed_earned_at ?? null;

  const payload = {
    telegram_id: telegramId,
    moon_seeds_available: moonSeedsAvailable,
    moon_seeds_earned_total: moonSeedsEarnedTotal,
    planted_garden_elements: plantedGardenElements,
    last_moon_seed_earned_at: lastMoonSeedEarnedAt,
    garden_level: input.gardenLevel,
    updated_at: new Date().toISOString()
  };

  const { error: upsertError } = await supabase
    .from('moon_gardens')
    .upsert(payload, { onConflict: 'telegram_id' });

  if (upsertError) {
    console.warn('Moon Garden state could not be synced; using computed state.', upsertError.message);
  }

  return {
    moonSeedsAvailable,
    moonSeedsEarnedTotal,
    plantedGardenElements,
    plantedElementsCount: plantedGardenElements.length,
    lastMoonSeedEarnedAt,
    gardenLevel: input.gardenLevel
  };
}

export async function getProfileStats(telegramId: number) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('first_name, username, language_code, active_until, lifetime_access')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (userError) throw userError;

  const [{ data: history, error: historyError }, { data: streak, error: streakError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase.from('history').select('completion_percent, last_position, completed, last_played').eq('telegram_id', telegramId),
      supabase.from('streaks').select('*').eq('telegram_id', telegramId).maybeSingle(),
      supabase.from('payments').select('plan, created_at').eq('telegram_id', telegramId).order('created_at', { ascending: false })
    ]);
  if (historyError) throw historyError;
  if (streakError) throw streakError;
  if (paymentsError) throw paymentsError;

  const { data: legacyProgress, error: progressError } = await supabase
    .from('progress')
    .select('completed_at')
    .eq('telegram_id', telegramId)
    .order('completed_at', { ascending: false });
  if (progressError) throw progressError;

  const { data: breathSessions, error: breathError } = await supabase
    .from('breath_sessions')
    .select('duration_seconds, completed_at')
    .eq('telegram_id', telegramId)
    .order('completed_at', { ascending: false });

  const safeBreathSessions = breathError ? [] : (breathSessions ?? []);
  if (breathError) {
    console.warn('Breath session stats unavailable; continuing with meditation stats only.', breathError.message);
  }

  const completedMeditations = (history ?? []).filter((item) => item.completed).length + (legacyProgress?.length ?? 0);
  const completedBreathSessions = safeBreathSessions.length;
  const completed = completedMeditations + completedBreathSessions;
  const meditationMinutes = Math.round((history ?? []).reduce((sum, item) => sum + (item.last_position ?? 0), 0) / 60);
  const breathMinutes = Math.round(safeBreathSessions.reduce((sum, item) => sum + (item.duration_seconds ?? 0), 0) / 60);
  const minutesListened = meditationMinutes + breathMinutes;
  const weekStart = daysAgo(6).toISOString();
  const weeklyMeditationMinutes = Math.round((history ?? [])
    .filter((item) => item.last_played && new Date(item.last_played).toISOString() >= weekStart)
    .reduce((sum, item) => sum + (item.last_position ?? 0), 0) / 60);
  const weeklyBreathMinutes = Math.round(safeBreathSessions
    .filter((item) => item.completed_at && new Date(item.completed_at).toISOString() >= weekStart)
    .reduce((sum, item) => sum + (item.duration_seconds ?? 0), 0) / 60);
  const weeklyPracticeMinutes = weeklyMeditationMinutes + weeklyBreathMinutes;
  const calmScore = Math.min(100, 42 + completed * 7);
  const lastMeditationDate = (history ?? [])
    .map((item) => item.last_played)
    .filter(Boolean)
    .sort()
    .at(-1);
  const lastBreathDate = safeBreathSessions[0]?.completed_at;
  const lastPracticeDate = [lastMeditationDate, lastBreathDate].filter(Boolean).sort().at(-1) ?? null;
  const gardenLevel = minutesListened >= 150 ? 5 : minutesListened >= 60 ? 4 : minutesListened >= 30 ? 3 : minutesListened >= 10 ? 2 : 1;
  const moonGarden = await getMoonGardenState(telegramId, {
    completedMeditations,
    completedBreathSessions,
    currentStreak: streak?.current_streak ?? 0,
    longestStreak: streak?.longest_streak ?? 0,
    gardenLevel
  });

  return {
    user,
    completed,
    completedMeditations,
    completedBreathSessions,
    dayStreak: streak?.current_streak ?? 0,
    currentStreak: streak?.current_streak ?? 0,
    longestStreak: streak?.longest_streak ?? 0,
    rewards: {
      7: Boolean(streak?.reward_7),
      14: Boolean(streak?.reward_14),
      30: Boolean(streak?.reward_30),
      100: Boolean(streak?.reward_100)
    },
    minutesListened,
    weeklyPracticeMinutes,
    totalPracticeMinutes: minutesListened,
    calmPoints: completed,
    moonSeeds: moonGarden.moonSeedsAvailable,
    moonSeedsAvailable: moonGarden.moonSeedsAvailable,
    moonSeedsEarnedTotal: moonGarden.moonSeedsEarnedTotal,
    plantedGardenElements: moonGarden.plantedGardenElements,
    plantedElementsCount: moonGarden.plantedElementsCount,
    lastMoonSeedEarnedAt: moonGarden.lastMoonSeedEarnedAt,
    gardenLevel: moonGarden.gardenLevel,
    streakDays: streak?.current_streak ?? 0,
    lastPracticeDate,
    purchasedPlan: payments?.[0]?.plan ?? 'free',
    calmScore
  };
}

export async function plantMoonGardenElement(telegramId: number, elementId: string) {
  const element = moonGardenElements.find((item) => item.id === elementId);
  if (!element) {
    return { error: 'Unknown garden element.' as const, status: 400 };
  }

  const profile = await getProfileStats(telegramId);
  const planted = plantedElementIds(profile.plantedGardenElements);

  if (planted.includes(element.id)) {
    return { error: 'Garden element already planted.' as const, status: 409, profile };
  }

  const availableSeeds = Number(profile.moonSeedsAvailable ?? profile.moonSeeds ?? 0);
  if (availableSeeds < element.cost) {
    return {
      error: 'Not enough Moon Seeds.' as const,
      status: 400,
      needed: element.cost - availableSeeds,
      profile
    };
  }

  const nextPlanted = [...planted, element.id];
  const moonSeedsEarnedTotal = Number(profile.moonSeedsEarnedTotal ?? 0);
  const moonSeedsAvailable = Math.max(0, moonSeedsEarnedTotal - plantedElementsCost(nextPlanted));

  const { error } = await supabase
    .from('moon_gardens')
    .upsert(
      {
        telegram_id: telegramId,
        moon_seeds_available: moonSeedsAvailable,
        moon_seeds_earned_total: moonSeedsEarnedTotal,
        planted_garden_elements: nextPlanted,
        last_moon_seed_earned_at: profile.lastMoonSeedEarnedAt ?? null,
        garden_level: profile.gardenLevel ?? 1,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'telegram_id' }
    );

  if (error) throw error;

  return {
    planted: true,
    elementId: element.id,
    moonSeedsAvailable,
    plantedGardenElements: nextPlanted,
    profile: await getProfileStats(telegramId)
  };
}

export async function recordSuccessfulPayment(input: {
  telegram_id: number;
  plan: PlanId;
  telegram_payment_charge_id?: string;
  provider_payment_charge_id?: string;
}) {
  const plan = plans[input.plan];
  const now = new Date();
  const activeUntil =
    input.plan === 'monthly'
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { error: paymentError } = await supabase.from('payments').insert({
    telegram_id: input.telegram_id,
    plan: input.plan,
    amount_stars: plan.amountStars,
    currency: 'XTR',
    telegram_payment_charge_id: input.telegram_payment_charge_id,
    provider_payment_charge_id: input.provider_payment_charge_id,
    status: 'paid'
  });

  if (paymentError) throw paymentError;

  const updates =
    input.plan === 'lifetime'
      ? { lifetime_access: true, active_until: null }
      : { lifetime_access: false, active_until: activeUntil };

  const { error: userError } = await supabase
    .from('users')
    .update(updates)
    .eq('telegram_id', input.telegram_id);

  if (userError) throw userError;
}

export async function getAdminStats() {
  const [{ count: totalUsers }, { data: users }, { data: payments }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('active_until, lifetime_access'),
    supabase.from('payments').select('amount_stars, plan, status')
  ]);

  const now = Date.now();
  const paidUsers = (users ?? []).filter(
    (user) => user.lifetime_access || (user.active_until && new Date(user.active_until).getTime() > now)
  );
  const monthlyUsers = (users ?? []).filter(
    (user) => !user.lifetime_access && user.active_until && new Date(user.active_until).getTime() > now
  );
  const lifetimeUsers = (users ?? []).filter((user) => user.lifetime_access);
  const totalStars = (payments ?? []).reduce((sum, payment) => {
    return payment.status === 'paid' ? sum + payment.amount_stars : sum;
  }, 0);

  return {
    totalUsers: totalUsers ?? 0,
    paidUsers: paidUsers.length,
    monthlyUsers: monthlyUsers.length,
    lifetimeUsers: lifetimeUsers.length,
    totalStars
  };
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysAgo(days: number) {
  const date = startOfUtcDay();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function dateKey(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function countSince<T extends Record<string, unknown>>(rows: T[], field: keyof T, since: Date) {
  return rows.filter((row) => {
    const value = row[field];
    return typeof value === 'string' && new Date(value).getTime() >= since.getTime();
  }).length;
}

function groupCountByDay<T extends Record<string, unknown>>(rows: T[], field: keyof T, days = 14) {
  const start = daysAgo(days - 1);
  const counts = new Map<string, number>();

  for (let index = 0; index < days; index += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    counts.set(day.toISOString().slice(0, 10), 0);
  }

  rows.forEach((row) => {
    const value = row[field];
    if (typeof value !== 'string') return;
    const key = dateKey(value);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return [...counts.entries()].map(([date, value]) => ({ date, value }));
}

function groupSumByDay<T extends Record<string, unknown>>(rows: T[], dateField: keyof T, valueField: keyof T, days = 14) {
  const start = daysAgo(days - 1);
  const sums = new Map<string, number>();

  for (let index = 0; index < days; index += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    sums.set(day.toISOString().slice(0, 10), 0);
  }

  rows.forEach((row) => {
    const dateValue = row[dateField];
    const numberValue = row[valueField];
    if (typeof dateValue !== 'string' || typeof numberValue !== 'number') return;
    const key = dateKey(dateValue);
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + numberValue);
  });

  return [...sums.entries()].map(([date, value]) => ({ date, value }));
}

export async function getAdminDashboard() {
  const [
    { data: users, error: usersError },
    { data: payments, error: paymentsError },
    { data: meditations, error: meditationsError },
    { data: history, error: historyError },
    { data: streaks, error: streaksError },
    { data: checkins, error: checkinsError }
  ] = await Promise.all([
    supabase.from('users').select('telegram_id, username, first_name, last_name, created_at, last_seen_at, active_until, lifetime_access'),
    supabase.from('payments').select('telegram_id, plan, amount_stars, status, created_at').order('created_at', { ascending: false }),
    supabase.from('meditations').select('id, title, category, premium, published, play_count, duration, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('history').select('telegram_id, meditation_id, last_played, play_count, completion_percent, last_position, completed'),
    supabase.from('streaks').select('telegram_id, current_streak, longest_streak'),
    supabase.from('daily_checkins').select('telegram_id, sleep_range, mood, available_minutes, local_date, created_at').order('created_at', { ascending: false })
  ]);

  if (usersError) throw usersError;
  if (paymentsError) throw paymentsError;
  if (meditationsError) throw meditationsError;
  if (historyError) throw historyError;
  if (streaksError) throw streaksError;
  if (checkinsError) throw checkinsError;

  const userRows = users ?? [];
  const paymentRows = (payments ?? []).filter((payment) => payment.status === 'paid');
  const meditationRows = meditations ?? [];
  const historyRows = history ?? [];
  const streakRows = streaks ?? [];
  const checkinRows = checkins ?? [];
  const now = Date.now();
  const today = startOfUtcDay();
  const weekStart = daysAgo(6);
  const monthStart = daysAgo(29);
  const userByTelegramId = new Map(userRows.map((user) => [user.telegram_id, user]));
  const streakByTelegramId = new Map(streakRows.map((streak) => [streak.telegram_id, streak]));
  const historyByMeditation = new Map<string, typeof historyRows>();

  historyRows.forEach((item) => {
    const list = historyByMeditation.get(item.meditation_id) ?? [];
    list.push(item);
    historyByMeditation.set(item.meditation_id, list);
  });

  const monthlyUsers = userRows.filter((user) => !user.lifetime_access && user.active_until && new Date(user.active_until).getTime() > now);
  const lifetimeUsers = userRows.filter((user) => user.lifetime_access);
  const activePremiumUsers = userRows.filter((user) => user.lifetime_access || (user.active_until && new Date(user.active_until).getTime() > now));
  const expiredPremiumUsers = userRows.filter((user) => !user.lifetime_access && user.active_until && new Date(user.active_until).getTime() <= now);
  const freeUsers = userRows.length - activePremiumUsers.length;
  const totalRevenue = paymentRows.reduce((sum, payment) => sum + payment.amount_stars, 0);
  const monthlyRevenue = paymentRows
    .filter((payment) => new Date(payment.created_at).getTime() >= monthStart.getTime())
    .reduce((sum, payment) => sum + payment.amount_stars, 0);
  const payingUsers = new Set(paymentRows.map((payment) => payment.telegram_id));
  const revenueByPlan = {
    monthly: paymentRows.filter((payment) => payment.plan === 'monthly').reduce((sum, payment) => sum + payment.amount_stars, 0),
    lifetime: paymentRows.filter((payment) => payment.plan === 'lifetime').reduce((sum, payment) => sum + payment.amount_stars, 0)
  };

  const adminUsers = userRows.map((user) => {
    const userHistory = historyRows.filter((item) => item.telegram_id === user.telegram_id);
    const userPayments = paymentRows.filter((payment) => payment.telegram_id === user.telegram_id);
    const activeUntil = user.active_until ? new Date(user.active_until).getTime() : 0;
    const premiumStatus = user.lifetime_access ? 'lifetime' : activeUntil > now ? 'monthly' : activeUntil ? 'expired' : 'free';

    return {
      telegram_id: user.telegram_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      created_at: user.created_at,
      last_seen_at: user.last_seen_at,
      active_until: user.active_until,
      lifetime_access: user.lifetime_access,
      premiumStatus,
      totalMinutesListened: Math.round(userHistory.reduce((sum, item) => sum + (item.last_position ?? 0), 0) / 60),
      completedMeditations: userHistory.filter((item) => item.completed).length,
      currentStreak: streakByTelegramId.get(user.telegram_id)?.current_streak ?? 0,
      longestStreak: streakByTelegramId.get(user.telegram_id)?.longest_streak ?? 0,
      totalStars: userPayments.reduce((sum, payment) => sum + payment.amount_stars, 0)
    };
  });

  const latestPurchases = paymentRows.slice(0, 10).map((payment) => ({
    ...payment,
    user: userByTelegramId.get(payment.telegram_id) ?? null,
    expiryDate: payment.plan === 'monthly'
      ? userByTelegramId.get(payment.telegram_id)?.active_until ?? null
      : null
  }));

  const meditationStats = meditationRows.map((meditation) => {
    const plays = historyByMeditation.get(meditation.id) ?? [];
    const averageCompletionRate = plays.length
      ? Math.round(plays.reduce((sum, item) => sum + Number(item.completion_percent ?? 0), 0) / plays.length)
      : 0;

    return {
      ...meditation,
      completionRate: averageCompletionRate,
      listeningMinutes: Math.round(plays.reduce((sum, item) => sum + (item.last_position ?? 0), 0) / 60)
    };
  });

  const latestPlays = [...historyRows]
    .sort((left, right) => new Date(right.last_played).getTime() - new Date(left.last_played).getTime())
    .slice(0, 10)
    .map((play) => ({
      ...play,
      user: userByTelegramId.get(play.telegram_id) ?? null,
      meditation: meditationRows.find((meditation) => meditation.id === play.meditation_id) ?? null
    }));
  const latestCheckins = checkinRows.slice(0, 10).map((checkin) => ({
    ...checkin,
    user: userByTelegramId.get(checkin.telegram_id) ?? null
  }));
  const checkinMood = mostCommonValue(checkinRows.map((item) => item.mood));
  const checkinSleep = mostCommonValue(checkinRows.map((item) => item.sleep_range));

  return {
    users: {
      totalRegistered: userRows.length,
      newToday: countSince(userRows, 'created_at', today),
      newThisWeek: countSince(userRows, 'created_at', weekStart),
      activeToday: countSince(userRows, 'last_seen_at', today),
      activeThisMonth: countSince(userRows, 'last_seen_at', monthStart)
    },
    subscriptions: {
      freeUsers,
      monthlySubscribers: monthlyUsers.length,
      lifetimeSubscribers: lifetimeUsers.length,
      activePremiumUsers: activePremiumUsers.length,
      expiredPremiumUsers: expiredPremiumUsers.length
    },
    revenue: {
      totalStars: totalRevenue,
      todayStars: paymentRows
        .filter((payment) => new Date(payment.created_at).getTime() >= today.getTime())
        .reduce((sum, payment) => sum + payment.amount_stars, 0),
      monthStars: monthlyRevenue,
      revenueByPlan,
      averageRevenuePerPayingUser: payingUsers.size ? Math.round(totalRevenue / payingUsers.size) : 0,
      conversionRate: userRows.length ? Math.round((payingUsers.size / userRows.length) * 100) : 0,
      latestPurchases
    },
    meditations: {
      total: meditationRows.length,
      published: meditationRows.filter((meditation) => meditation.published).length,
      drafts: meditationRows.filter((meditation) => !meditation.published).length,
      mostPlayed: [...meditationRows].sort((left, right) => (right.play_count ?? 0) - (left.play_count ?? 0))[0] ?? null,
      totalListeningMinutes: Math.round(historyRows.reduce((sum, item) => sum + (item.last_position ?? 0), 0) / 60),
      averageCompletionRate: historyRows.length
        ? Math.round(historyRows.reduce((sum, item) => sum + Number(item.completion_percent ?? 0), 0) / historyRows.length)
        : 0,
      items: meditationStats
    },
    wellness: {
      totalCheckins: checkinRows.length,
      checkinsToday: checkinRows.filter((item) => item.local_date === today.toISOString().slice(0, 10)).length,
      checkinsThisWeek: checkinRows.filter((item) => new Date(item.local_date).getTime() >= weekStart.getTime()).length,
      mostCommonMood: checkinMood,
      mostCommonMoodLabel: moodLabel(checkinMood),
      averageSleepLabel: sleepLabel(checkinSleep),
      mostRequestedDuration: mostCommonValue(checkinRows.map((item) => item.available_minutes)),
      latestCheckins
    },
    topUsers: {
      topListeners: [...adminUsers].sort((left, right) => right.totalMinutesListened - left.totalMinutesListened).slice(0, 10),
      longestStreaks: [...adminUsers].sort((left, right) => right.longestStreak - left.longestStreak).slice(0, 10),
      mostCompleted: [...adminUsers].sort((left, right) => right.completedMeditations - left.completedMeditations).slice(0, 10)
    },
    recentActivity: {
      latestRegistrations: [...userRows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()).slice(0, 10),
      latestPurchases,
      latestMeditationPlays: latestPlays,
      latestCheckins,
      latestAdminUploads: meditationRows.slice(0, 10)
    },
    charts: {
      registrationsByDay: groupCountByDay(userRows, 'created_at'),
      purchasesByDay: groupCountByDay(paymentRows, 'created_at'),
      revenueByDay: groupSumByDay(paymentRows, 'created_at', 'amount_stars'),
      listeningMinutesByDay: groupSumByDay(historyRows.map((item) => ({ ...item, minutes: Math.round((item.last_position ?? 0) / 60) })), 'last_played', 'minutes'),
      meditationPlaysByDay: groupCountByDay(historyRows, 'last_played')
    },
    usersList: adminUsers,
    subscriptionsList: adminUsers.filter((user) => user.premiumStatus !== 'free'),
    purchaseHistory: latestPurchases
  };
}

export async function updateAdminUserAccess(telegramId: number, action: 'grant_monthly' | 'grant_lifetime' | 'extend_monthly' | 'remove_premium') {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('active_until')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) throw new Error('User not found.');

  const now = Date.now();
  const currentActiveUntil = user.active_until ? new Date(user.active_until).getTime() : 0;
  const extensionBase = Math.max(now, currentActiveUntil);
  const monthlyUntil = new Date(extensionBase + 30 * 24 * 60 * 60 * 1000).toISOString();

  const updates =
    action === 'grant_lifetime'
      ? { lifetime_access: true, active_until: null }
      : action === 'remove_premium'
        ? { lifetime_access: false, active_until: null }
        : { lifetime_access: false, active_until: monthlyUntil };

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('telegram_id', telegramId)
    .select('telegram_id, username, first_name, active_until, lifetime_access')
    .single();

  if (error) throw error;
  return data;
}
