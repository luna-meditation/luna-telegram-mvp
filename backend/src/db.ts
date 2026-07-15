import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { env } from './config.js';
import { isPlanId, plans, type PlanId } from './plans.js';
import {
  applyPlaybackHeartbeat,
  mergePlaybackRanges,
  normalizePlaybackSeconds,
  playbackCoverageSeconds,
  playbackRewardDecision,
  PlaybackInputError
} from './playback-security.js';
import {
  buildActiveLunaDaySet,
  buildActiveLunaRhythm,
  buildCanonicalCurrentWeek,
  buildCanonicalDailyActivity,
  buildSevenDayMoodTrend,
  shiftDateKey
} from './progress-model.js';
import { buildProgressInsights } from './progress-insights.js';
import { achievementDefinitions, buildAchievementItems, type AchievementStats } from './progress-achievements.js';
import { logBackendError } from './error-logging.js';

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
  last_position?: unknown;
  duration?: unknown;
  completed?: boolean;
  session_id?: string;
  local_date?: string;
};

const moonGardenElements = [
  { id: 'first_bloom', cost: 10 },
  { id: 'lantern_glow', cost: 10 },
  { id: 'stone_path', cost: 10 },
  { id: 'twin_bloom', cost: 10 },
  { id: 'moon_bridge', cost: 10 },
  { id: 'reflection_garden', cost: 10 },
  { id: 'full_moon_garden', cost: 10 }
];

const moonGardenElementCost = new Map(moonGardenElements.map((element) => [element.id, element.cost]));
const fullMoonGardenCost = moonGardenElements.reduce((sum, element) => sum + element.cost, 0);
const legacyMoonGardenElementOrder = [
  'moon_flower',
  'calm_stone',
  'water_ripple',
  'golden_lantern',
  'night_lily',
  'crescent_tree',
  'star_path',
  'breathing_pond'
];

export type DailyCheckinInput = {
  sleep_range?: 'less_than_4' | '4_6' | '6_8' | '8_plus' | null;
  mood: 'calm' | 'stressed' | 'tired' | 'anxious' | 'focused' | 'low_energy';
  available_minutes?: '3' | '5' | '10' | '15_plus' | null;
  local_date?: string;
};

const allowedProfileGoals = new Set(['sleep', 'anxiety', 'focus', 'routine', 'stress']);

export type NotificationPreferences = {
  dailyReminder: boolean;
  newContent: boolean;
  reminderTime: string;
  timezone: string;
};

export function normalizeNotificationPreferences(input: Partial<NotificationPreferences> = {}): NotificationPreferences {
  const reminderTime = typeof input.reminderTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.reminderTime)
    ? input.reminderTime
    : '21:00';
  const timezone = typeof input.timezone === 'string' && input.timezone.length >= 2 && input.timezone.length <= 64
    ? input.timezone
    : 'UTC';

  return {
    dailyReminder: Boolean(input.dailyReminder),
    newContent: false,
    reminderTime,
    timezone
  };
}

function normalizeProfileGoals(goals: unknown) {
  if (!Array.isArray(goals)) return [];
  return Array.from(new Set(goals.map(String).filter((goal) => allowedProfileGoals.has(goal))));
}

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
    .select('telegram_id, first_name, username, language_code, active_until, lifetime_access, free_used, avatar_url')
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

export async function updateUserAvatar(telegramId: number, avatarUrl: string | null) {
  const { data, error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl, last_seen_at: new Date().toISOString() })
    .eq('telegram_id', telegramId)
    .select('avatar_url')
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserGoals(telegramId: number, goals: unknown) {
  const normalizedGoals = normalizeProfileGoals(goals);
  const { data, error } = await supabase
    .from('users')
    .update({ profile_goals: normalizedGoals, last_seen_at: new Date().toISOString() })
    .eq('telegram_id', telegramId)
    .select('profile_goals')
    .single();

  if (error) throw error;
  return { profile_goals: normalizeProfileGoals(data?.profile_goals) };
}

export async function updateUserNotificationPreferences(telegramId: number, preferences: Partial<NotificationPreferences>) {
  const normalizedPreferences = normalizeNotificationPreferences(preferences);
  const { data, error } = await supabase
    .from('users')
    .update({ notification_preferences: normalizedPreferences, last_seen_at: new Date().toISOString() })
    .eq('telegram_id', telegramId)
    .select('notification_preferences')
    .single();

  if (error) throw error;
  return { notification_preferences: normalizeNotificationPreferences(data?.notification_preferences ?? normalizedPreferences) };
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

export async function startPlaybackSession(telegramId: number, meditationId: string, requestedLocalDate?: string) {
  const meditation = await getMeditationById(meditationId);
  if (!meditation) throw new Error('Meditation not found.');

  const { data, error } = await supabase
    .from('playback_sessions')
    .insert({ telegram_id: telegramId, meditation_id: meditationId, local_date: todayKey(requestedLocalDate) })
    .select('id, meditation_id, started_at, last_heartbeat_at, listened_seconds, listened_ranges, local_date')
    .single();

  if (error) throw error;
  return data;
}

export async function heartbeatPlaybackSession(telegramId: number, sessionId: string, lastPosition: unknown) {
  const requestedPosition = normalizePlaybackSeconds(lastPosition, {
    field: 'last_position',
    fallback: 0
  });

  const { data: session, error: sessionError } = await supabase
    .from('playback_sessions')
    .select('id, meditation_id, last_heartbeat_at, listened_seconds, last_position, listened_ranges, local_date')
    .eq('id', sessionId)
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) return { ok: false, listened_seconds: 0 };

  const meditation = await getMeditationById(session.meditation_id);
  const duration = Math.max(1, normalizePlaybackSeconds(meditation?.duration, {
    field: 'meditation.duration',
    fallback: 1
  }));
  const currentPosition = Math.min(requestedPosition, duration);
  const lastHeartbeat = new Date(session.last_heartbeat_at).getTime();
  const elapsed = Number.isFinite(lastHeartbeat)
    ? Math.max(0, Math.min(30, Math.floor((Date.now() - lastHeartbeat) / 1000)))
    : 0;
  const coverage = applyPlaybackHeartbeat({
    ranges: session.listened_ranges,
    previousPosition: normalizePlaybackSeconds(session.last_position, {
      field: 'stored last_position',
      duration,
      fallback: 0
    }),
    currentPosition,
    elapsedSeconds: elapsed,
    duration
  });

  const { error } = await supabase
    .from('playback_sessions')
    .update({
      listened_seconds: coverage.listenedSeconds,
      listened_ranges: coverage.ranges,
      last_position: coverage.currentPosition,
      last_heartbeat_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('telegram_id', telegramId);

  if (error) throw error;
  await claimPlaybackPracticeDay(telegramId, sessionId, session.local_date, coverage.listenedSeconds);
  return { ok: true, listened_seconds: coverage.listenedSeconds, intervalAccepted: coverage.accepted };
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
  const requestedPosition = normalizePlaybackSeconds(input.last_position, {
    field: 'last_position',
    fallback: 0
  });
  if (input.duration !== undefined && input.duration !== null) {
    normalizePlaybackSeconds(input.duration, { field: 'duration' });
  }

  const meditation = await getMeditationById(input.meditation_id);
  const duration = Math.max(1, normalizePlaybackSeconds(meditation?.duration, {
    field: 'meditation.duration',
    fallback: 1
  }));
  const savedPosition = Math.min(requestedPosition, duration);
  let sessionRanges: Array<[number, number]> = [];
  let sessionCompletedBeforeRequest = false;

  if (input.session_id) {
    const { data: session, error: sessionError } = await supabase
      .from('playback_sessions')
      .select('last_heartbeat_at, listened_seconds, listened_ranges, last_position, completed_at, local_date')
      .eq('id', input.session_id)
      .eq('telegram_id', telegramId)
      .eq('meditation_id', input.meditation_id)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (session) {
      const lastHeartbeat = new Date(session.last_heartbeat_at).getTime();
      const elapsedSinceHeartbeat = Number.isFinite(lastHeartbeat)
        ? Math.max(0, Math.min(30, Math.floor((Date.now() - lastHeartbeat) / 1000)))
        : 0;
      const finalCoverage = applyPlaybackHeartbeat({
        ranges: session.listened_ranges,
        previousPosition: normalizePlaybackSeconds(session.last_position, {
          field: 'stored last_position',
          duration,
          fallback: 0
        }),
        currentPosition: savedPosition,
        elapsedSeconds: elapsedSinceHeartbeat,
        duration
      });
      sessionRanges = finalCoverage.ranges;
      sessionCompletedBeforeRequest = Boolean(session.completed_at);
      await supabase
        .from('playback_sessions')
        .update({
          listened_seconds: finalCoverage.listenedSeconds,
          listened_ranges: finalCoverage.ranges,
          last_position: savedPosition,
          last_heartbeat_at: new Date().toISOString()
        })
        .eq('id', input.session_id)
        .eq('telegram_id', telegramId);
      await claimPlaybackPracticeDay(telegramId, input.session_id, session.local_date ?? input.local_date, finalCoverage.listenedSeconds);
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('history')
    .select('play_count, seed_awarded_position, completion_seed_bonus_awarded, completed, listened_ranges, listened_seconds')
    .eq('telegram_id', telegramId)
    .eq('meditation_id', input.meditation_id)
    .maybeSingle();

  if (existingError) throw existingError;

  const listenedRanges = mergePlaybackRanges(existing?.listened_ranges, sessionRanges, duration);
  const trustedListenedSeconds = playbackCoverageSeconds(listenedRanges);
  const completion = Math.min(100, Math.round((trustedListenedSeconds / duration) * 100));
  const qualifiesForCompletion = Boolean(input.completed && completion >= 90);
  const completed = Boolean(existing?.completed || qualifiesForCompletion);
  let newlyCompletedSession = false;
  if (qualifiesForCompletion && input.session_id && !sessionCompletedBeforeRequest) {
    const { data: claimedSession, error: claimError } = await supabase
      .from('playback_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', input.session_id)
      .eq('telegram_id', telegramId)
      .is('completed_at', null)
      .select('id')
      .maybeSingle();
    if (claimError) throw claimError;
    newlyCompletedSession = Boolean(claimedSession);
  }

  const rewards = playbackRewardDecision({
    trustedListenedSeconds,
    previouslyAwardedPosition: Number(existing?.seed_awarded_position ?? 0),
    newlyCompletedSession,
    completionBonusAlreadyAwarded: Boolean(existing?.completion_seed_bonus_awarded)
  });
  const { nextAwardedPosition, completionBonusAwarded, moonSeedsAwarded } = rewards;

  const { error } = await supabase
    .from('history')
    .upsert(
      {
        telegram_id: telegramId,
        meditation_id: input.meditation_id,
        last_position: savedPosition,
        completion_percent: completion,
        completed,
        listened_seconds: trustedListenedSeconds,
        listened_ranges: listenedRanges,
        last_played: new Date().toISOString(),
        play_count: (existing?.play_count ?? 0) + 1,
        seed_awarded_position: nextAwardedPosition,
        completion_seed_bonus_awarded: Boolean(existing?.completion_seed_bonus_awarded || completionBonusAwarded)
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

  if (moonSeedsAwarded > 0) {
    await awardMoonSeeds(telegramId, moonSeedsAwarded);
  }

  if (completed) {
    await updateStreak(telegramId, input.local_date);
  }

  return {
    completion_percent: completion,
    completed,
    moonSeedsAwarded,
    completionBonusAwarded: completionBonusAwarded > 0
  };
}

export async function recordBreathSession(telegramId: number, input: {
  mode: string;
  duration_seconds: unknown;
  breath_count: unknown;
  local_date?: string;
}) {
  const mode = ['calm', 'box', 'reset'].includes(input.mode) ? input.mode : 'calm';
  const requestedDurationSeconds = normalizePlaybackSeconds(input.duration_seconds, {
    field: 'duration_seconds',
    fallback: 60
  });
  const requestedBreathCount = normalizePlaybackSeconds(input.breath_count, {
    field: 'breath_count',
    fallback: 1
  });
  if (requestedDurationSeconds === 0) {
    throw new PlaybackInputError('duration_seconds', 'must be greater than zero.');
  }
  if (requestedBreathCount === 0) {
    throw new PlaybackInputError('breath_count', 'must be greater than zero.');
  }
  const durationSeconds = Math.max(30, Math.min(600, requestedDurationSeconds));
  const breathCount = Math.max(1, Math.min(120, requestedBreathCount));

  const { error } = await supabase.from('breath_sessions').insert({
    telegram_id: telegramId,
    mode,
    duration_seconds: durationSeconds,
    breath_count: breathCount
  });

  if (error) throw error;
  await awardMoonSeeds(telegramId, 1);
  await recordPracticeDay(telegramId, 'breath', Math.max(1, Math.round(durationSeconds / 60)), input.local_date);
  await updateStreak(telegramId, input.local_date);

  return {
    completed: true,
    mode,
    duration_seconds: durationSeconds,
    breath_count: breathCount
  };
}

export async function recordSceneMoonSeed(telegramId: number, input: {
  scene_id?: string;
  duration_seconds: unknown;
  local_date?: string;
}) {
  const durationSeconds = normalizePlaybackSeconds(input.duration_seconds, {
    field: 'duration_seconds',
    fallback: 0
  });
  if (durationSeconds < 300) {
    return { awarded: false, moonSeeds: 0 };
  }

  await awardMoonSeeds(telegramId, 1);
  await recordPracticeDay(telegramId, 'scene', Math.max(5, Math.round(durationSeconds / 60)), input.local_date);
  await updateStreak(telegramId, input.local_date);
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

function validDateKey(value?: string | null) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function todayKey(requested?: string | null) {
  return validDateKey(requested) ?? new Date().toISOString().slice(0, 10);
}

async function recordPracticeDay(telegramId: number, source: 'meditation' | 'breath' | 'scene', minutes: number, requestedLocalDate?: string) {
  const localDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedLocalDate ?? '') ? requestedLocalDate! : todayKey();
  const { data: existing, error: readError } = await supabase
    .from('practice_days')
    .select('minutes, sessions')
    .eq('telegram_id', telegramId)
    .eq('local_date', localDate)
    .eq('source', source)
    .maybeSingle();

  if (readError) {
    logBackendError(readError, { endpoint: 'database practice day read', telegramId });
    return;
  }

  const { error } = await supabase
    .from('practice_days')
    .upsert(
      {
        telegram_id: telegramId,
        local_date: localDate,
        source,
        minutes: Math.max(0, Number(existing?.minutes ?? 0)) + Math.max(0, Math.round(minutes)),
        sessions: Math.max(0, Number(existing?.sessions ?? 0)) + 1,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'telegram_id,local_date,source' }
    );

  if (error) {
    logBackendError(error, { endpoint: 'database practice day save', telegramId });
  }
}

async function claimPlaybackPracticeDay(telegramId: number, sessionId: string, requestedLocalDate: string | null | undefined, listenedSeconds: number) {
  if (listenedSeconds < 60) return false;

  const { data: claimed, error } = await supabase
    .from('playback_sessions')
    .update({ practice_day_recorded: true })
    .eq('id', sessionId)
    .eq('telegram_id', telegramId)
    .eq('practice_day_recorded', false)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!claimed) return false;

  await recordPracticeDay(telegramId, 'meditation', 1, requestedLocalDate ?? undefined);
  await updateStreak(telegramId, requestedLocalDate ?? undefined);
  return true;
}

function mondayKey(date: Date) {
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

async function getStreakFreezeMax(telegramId: number) {
  const { data: user } = await supabase
    .from('users')
    .select('active_until, lifetime_access')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  const activeUntil = user?.active_until ? new Date(user.active_until).getTime() : 0;
  const hasPremium = Boolean(user?.lifetime_access || activeUntil > Date.now());
  return hasPremium ? 3 : 1;
}

function buildPracticeDaySet(input: {
  history: Array<{ completed?: boolean | null; last_played?: string | null }>;
  breathSessions: Array<{ completed_at?: string | null }>;
  practiceDays: Array<{ local_date?: string | null }>;
  timeZone: string;
}) {
  const days = new Set<string>();
  input.practiceDays.forEach((item) => {
    if (item.local_date) days.add(item.local_date);
  });
  input.history.forEach((item) => {
    const key = item.completed && item.last_played ? dateKeyInTimeZone(item.last_played, input.timeZone) : null;
    if (key) days.add(key);
  });
  input.breathSessions.forEach((item) => {
    const key = item.completed_at ? dateKeyInTimeZone(item.completed_at, input.timeZone) : null;
    if (key) days.add(key);
  });
  return days;
}

function countCompletedWeeks(practiceDayKeys: Set<string>) {
  const weeks = new Map<string, Set<string>>();
  practiceDayKeys.forEach((key) => {
    weeks.set(mondayKey(new Date(`${key}T12:00:00Z`)), (weeks.get(mondayKey(new Date(`${key}T12:00:00Z`))) ?? new Set()).add(key));
  });
  return [...weeks.values()].filter((days) => days.size >= 7).length;
}

function dateKeyInTimeZone(value: string | null | undefined, timeZone: string) {
  if (!value) return null;
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

function hourInTimeZone(value: string | null | undefined, timeZone: string) {
  if (!value) return -1;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return -1;
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone
    }).formatToParts(date).find((part) => part.type === 'hour')?.value;
    const parsed = Number(hour);
    return Number.isFinite(parsed) ? parsed : -1;
  } catch {
    return date.getUTCHours();
  }
}

function mostCommonValue<T extends string>(values: T[]) {
  const counts = values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>());
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function sleepScore(value: DailyCheckinInput['sleep_range']) {
  if (!value) return 0;
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

  const tiredDays = input.weeklyCheckins.filter((item) => item.sleep_range != null && ['less_than_4', '4_6'].includes(item.sleep_range)).length;
  const commonMood = mostCommonValue(input.weeklyCheckins.map((item) => item.mood));

  if (tiredDays >= 3) return 'Your week shows lower sleep. Choose gentler evening sessions and keep practices short.';
  if (commonMood === 'anxious' || commonMood === 'stressed') return 'You have been carrying extra tension. Breath-led meditations may help you reset faster.';
  if (input.currentStreak >= 3) return 'Your calm routine is becoming consistent. Keep the next session easy to protect the streak.';
  if (input.minutesListened > 0) return `You created ${input.minutesListened} minutes of calm. A small repeat tomorrow matters more than a perfect session.`;
  return 'A short check-in is enough to begin. Luna will personalize your next practice from there.';
}

export async function upsertDailyCheckin(telegramId: number, input: DailyCheckinInput) {
  const localDate = input.local_date ?? todayKey();
  const { data: existing, error: existingError } = await supabase
    .from('daily_checkins')
    .select('sleep_range, available_minutes')
    .eq('telegram_id', telegramId)
    .eq('local_date', localDate)
    .maybeSingle();

  if (existingError) throw existingError;

  const payload = {
    telegram_id: telegramId,
    mood: input.mood,
    local_date: localDate,
    sleep_range: input.sleep_range ?? existing?.sleep_range ?? '6_8',
    available_minutes: input.available_minutes ?? existing?.available_minutes ?? null
  };

  const { data, error } = await supabase
    .from('daily_checkins')
    .upsert(payload, { onConflict: 'telegram_id,local_date' })
    .select()
    .single();

  if (error) throw error;
  try {
    await updateStreak(telegramId, localDate);
  } catch (streakError) {
    logBackendError(streakError, { endpoint: 'daily check-in Active Luna Day streak update', telegramId });
  }
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

export async function getWellnessSummary(telegramId: number, localDate = todayKey()) {
  const requestedDate = todayKey(localDate);
  const requested = new Date(`${requestedDate}T12:00:00Z`);
  requested.setUTCDate(requested.getUTCDate() - 6);
  const weekStart = requested.toISOString().slice(0, 10);
  const [{ data: checkins, error: checkinsError }, profile] = await Promise.all([
    supabase
      .from('daily_checkins')
      .select('*')
      .eq('telegram_id', telegramId)
      .gte('local_date', weekStart)
      .order('local_date', { ascending: false }),
    getProfileStats(telegramId, requestedDate)
  ]);

  if (checkinsError) throw checkinsError;

  const weeklyCheckins = (checkins ?? []) as Array<DailyCheckinInput & { local_date: string; created_at?: string }>;
  const todayCheckin = weeklyCheckins.find((item) => item.local_date === requestedDate) ?? null;
  const mostCommonMood = mostCommonValue(weeklyCheckins.map((item) => item.mood));
  const sleepCheckins = weeklyCheckins.filter((item) => Boolean(item.sleep_range));
  const averageSleep = sleepCheckins.length
    ? Math.round(sleepCheckins.reduce((sum, item) => sum + sleepScore(item.sleep_range), 0) / sleepCheckins.length)
    : 0;
  const level = Math.max(1, Math.floor((profile.completed + profile.currentStreak + weeklyCheckins.length) / 5) + 1);
  const levelProgress = Math.min(100, ((profile.completed + weeklyCheckins.length) % 5) * 20);

  return {
    todayCheckin,
    weeklyCheckins,
    weeklyCheckinCount: weeklyCheckins.length,
    averageSleepHours: averageSleep,
    averageSleepLabel: sleepLabel(mostCommonValue(sleepCheckins.map((item) => item.sleep_range).filter((value): value is NonNullable<typeof value> => value != null))),
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

export async function updateStreak(telegramId: number, requestedLocalDate?: string) {
  const today = todayKey(requestedLocalDate);
  const todayDate = new Date(`${today}T12:00:00Z`);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setUTCDate(todayDate.getUTCDate() - 1);
  const twoDaysAgoDate = new Date(todayDate);
  twoDaysAgoDate.setUTCDate(todayDate.getUTCDate() - 2);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const twoDaysAgo = twoDaysAgoDate.toISOString().slice(0, 10);
  const freezeMax = await getStreakFreezeMax(telegramId);

  const { data: current, error: currentError } = await supabase
    .from('streaks')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (currentError) throw currentError;

  if (current?.last_completed_date === today) return current;

  let freezeCount = Math.min(freezeMax, Math.max(0, Number(current?.freeze_count ?? freezeMax)));
  let lastFreezeUsed = current?.last_freeze_used ?? null;
  let protectedByFreeze = false;
  let nextStreak = 1;

  if (current?.last_completed_date === yesterday) {
    nextStreak = (current.current_streak ?? 0) + 1;
  } else if (current?.last_completed_date === twoDaysAgo && freezeCount > 0) {
    freezeCount -= 1;
    protectedByFreeze = true;
    lastFreezeUsed = yesterday;
    nextStreak = (current.current_streak ?? 0) + 1;
  }

  const monday = mondayKey(todayDate);
  const freezeUsedThisWeek = Boolean(current?.last_freeze_used && current.last_freeze_used >= monday);
  const completedCleanPreviousWeek = current?.last_completed_date === yesterday
    && yesterdayDate.getUTCDay() === 0
    && !freezeUsedThisWeek
    && current?.last_clean_week_awarded !== monday;

  if (completedCleanPreviousWeek) {
    freezeCount = Math.min(freezeMax, freezeCount + 1);
  }

  const longest = Math.max(current?.longest_streak ?? 0, nextStreak);
  const payload = {
    telegram_id: telegramId,
    current_streak: nextStreak,
    longest_streak: longest,
    last_completed_date: today,
    freeze_count: freezeCount,
    last_freeze_used: lastFreezeUsed,
    last_clean_week_awarded: completedCleanPreviousWeek ? monday : current?.last_clean_week_awarded ?? null,
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
  if (protectedByFreeze) {
    console.info(`Streak protected with freeze for telegram_id=${telegramId}`);
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
  if (!Array.isArray(value)) return [];
  const normalized = [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/-/g, '_')))];
  const upgradedIds = normalized.filter((item) => moonGardenElementCost.has(item));
  if (upgradedIds.length > 0) return upgradedIds.slice(0, moonGardenElements.length);

  const legacyCount = legacyMoonGardenElementOrder.filter((item) => normalized.includes(item)).length;
  return moonGardenElements.slice(0, legacyCount).map((item) => item.id);
}

function plantedElementsCost(ids: string[]) {
  return ids.reduce((sum, id) => sum + (moonGardenElementCost.get(id) ?? 0), 0);
}

function gardenStageLevel(ids: string[]) {
  return Math.max(0, Math.min(moonGardenElements.length, ids.length));
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

async function syncAchievements(telegramId: number, stats: AchievementStats) {
  const unlockedDefinitions = achievementDefinitions.filter((definition) => definition.current(stats) >= definition.target);
  try {
    if (unlockedDefinitions.length > 0) {
      const now = new Date().toISOString();
      const { error: upsertError } = await supabase
        .from('achievements')
        .upsert(
          unlockedDefinitions.map((definition) => ({
            telegram_id: telegramId,
            achievement_id: definition.id,
            progress: 100,
            metadata: { category: definition.category },
            unlocked_at: now
          })),
          { onConflict: 'telegram_id,achievement_id', ignoreDuplicates: true }
        );
      if (upsertError) throw upsertError;
    }

    const { data, error } = await supabase
      .from('achievements')
      .select('achievement_id, unlocked_at, progress')
      .eq('telegram_id', telegramId);
    if (error) throw error;

    const items = buildAchievementItems(stats, data ?? []);

    return {
      unlocked: items.filter((item) => item.unlocked).length,
      total: achievementDefinitions.length,
      items
    };
  } catch (error) {
    logBackendError(error, { endpoint: 'database achievements lookup', telegramId });
    const items = buildAchievementItems(stats, []);
    return {
      unlocked: items.filter((item) => item.unlocked).length,
      total: achievementDefinitions.length,
      items
    };
  }
}

async function awardMoonSeeds(telegramId: number, amount: number) {
  if (amount <= 0) return;

  const { data: existing, error: readError } = await supabase
    .from('moon_gardens')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (readError) {
    logBackendError(readError, { endpoint: 'database Moon Seeds read', telegramId });
    return;
  }

  const plantedGardenElements = plantedElementIds(existing?.planted_garden_elements);
  const plantedCost = plantedElementsCost(plantedGardenElements);
  const currentAvailable = Math.max(0, Number(existing?.moon_seeds_available ?? 0));
  const currentEarnedTotal = Math.max(Number(existing?.moon_seeds_earned_total ?? 0), currentAvailable + plantedCost);
  const moonSeedsEarnedTotal = currentEarnedTotal + amount;
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
        garden_level: gardenStageLevel(plantedGardenElements),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'telegram_id' }
    );

  if (error) {
    logBackendError(error, { endpoint: 'database Moon Seeds save', telegramId });
  }
}

async function grantPremiumMoonSeedsBonus(telegramId: number) {
  const { data: existing, error: readError } = await supabase
    .from('moon_gardens')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (readError) {
    logBackendError(readError, { endpoint: 'database Premium Moon Seeds bonus read', telegramId });
    return false;
  }

  if (existing?.premium_bonus_granted_at) return false;

  const plantedGardenElements = plantedElementIds(existing?.planted_garden_elements);
  const plantedCost = plantedElementsCost(plantedGardenElements);
  const currentAvailable = Math.max(0, Number(existing?.moon_seeds_available ?? 0));
  const currentEarnedTotal = Math.max(Number(existing?.moon_seeds_earned_total ?? 0), currentAvailable + plantedCost);
  const moonSeedsAvailable = currentAvailable + 40;
  const moonSeedsEarnedTotal = currentEarnedTotal + 40;

  const { error } = await supabase
    .from('moon_gardens')
    .upsert(
      {
        telegram_id: telegramId,
        moon_seeds_available: moonSeedsAvailable,
        moon_seeds_earned_total: moonSeedsEarnedTotal,
        planted_garden_elements: plantedGardenElements,
        last_moon_seed_earned_at: new Date().toISOString(),
        premium_bonus_granted_at: new Date().toISOString(),
        garden_level: gardenStageLevel(plantedGardenElements),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'telegram_id' }
    );

  if (error) throw error;
  return true;
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
    logBackendError(error, { endpoint: 'database Moon Garden state read', telegramId });
    return {
      moonSeedsAvailable: earnedFromPractice,
      moonSeedsEarnedTotal: earnedFromPractice,
      plantedGardenElements: [] as string[],
      plantedElementsCount: 0,
      lastMoonSeedEarnedAt: null as string | null,
      gardenLevel: 0
    };
  }

  const plantedGardenElements = plantedElementIds(existing?.planted_garden_elements);
  const plantedCost = plantedElementsCost(plantedGardenElements);
  const rawStoredAvailable = Number(existing?.moon_seeds_available ?? 0);
  const storedAvailable = existing && Number.isFinite(rawStoredAvailable) ? Math.max(0, rawStoredAvailable) : 0;
  const rawStoredEarnedTotal = Number(existing?.moon_seeds_earned_total ?? 0);
  const storedEarnedTotal = Number.isFinite(rawStoredEarnedTotal) ? Math.max(0, rawStoredEarnedTotal) : 0;
  const availableFromStoredTotal = Math.max(0, storedEarnedTotal - plantedCost);
  const moonSeedsEarnedTotal = Math.max(storedEarnedTotal, earnedFromPractice, storedAvailable + plantedCost);
  const moonSeedsAvailable = existing ? Math.max(storedAvailable, availableFromStoredTotal) : Math.max(0, moonSeedsEarnedTotal - plantedCost);
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
    garden_level: gardenStageLevel(plantedGardenElements),
    updated_at: new Date().toISOString()
  };

  const { error: upsertError } = await supabase
    .from('moon_gardens')
    .upsert(payload, { onConflict: 'telegram_id' });

  if (upsertError) {
    logBackendError(upsertError, { endpoint: 'database Moon Garden state sync', telegramId });
  }

  return {
    moonSeedsAvailable,
    moonSeedsEarnedTotal,
    plantedGardenElements,
    plantedElementsCount: plantedGardenElements.length,
    lastMoonSeedEarnedAt,
    gardenLevel: gardenStageLevel(plantedGardenElements)
  };
}

export async function getProfileStats(telegramId: number, localDate = todayKey()) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('first_name, username, language_code, active_until, lifetime_access, avatar_url, profile_goals, notification_preferences')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (userError) throw userError;

  const [
    { data: history, error: historyError },
    { data: streak, error: streakError },
    { data: checkins, error: checkinsError },
    { data: practiceDays, error: practiceDaysError },
    { data: playbackSessions, error: playbackSessionsError }
  ] =
    await Promise.all([
      supabase.from('history').select('meditation_id, completion_percent, last_position, listened_seconds, completed, last_played, meditations(category, title)').eq('telegram_id', telegramId),
      supabase.from('streaks').select('*').eq('telegram_id', telegramId).maybeSingle(),
      supabase.from('daily_checkins').select('local_date, mood, sleep_range').eq('telegram_id', telegramId),
      supabase.from('practice_days').select('local_date, source, minutes, sessions').eq('telegram_id', telegramId).order('local_date', { ascending: false }),
      supabase.from('playback_sessions').select('meditation_id, listened_seconds, completed_at, created_at, local_date').eq('telegram_id', telegramId)
    ]);
  if (historyError) throw historyError;
  if (streakError) throw streakError;
  if (checkinsError) throw checkinsError;
  const safePracticeDays = practiceDaysError ? [] : (practiceDays ?? []);
  const safePlaybackSessions = playbackSessionsError ? [] : (playbackSessions ?? []);
  if (practiceDaysError) {
    logBackendError(practiceDaysError, { endpoint: 'database practice day stats', telegramId });
  }
  if (playbackSessionsError) {
    logBackendError(playbackSessionsError, { endpoint: 'database verified playback stats', telegramId });
  }

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
    logBackendError(breathError, { endpoint: 'database breath session stats', telegramId });
  }

  const verifiedCompletedSessions = safePlaybackSessions.filter((item) => item.completed_at).length;
  const legacyCompletedMeditations = (history ?? []).filter((item) => item.completed).length;
  const completedMeditations = Math.max(verifiedCompletedSessions, legacyCompletedMeditations) + (legacyProgress?.length ?? 0);
  const completedBreathSessions = safeBreathSessions.length;
  const completed = completedMeditations + completedBreathSessions;
  const verifiedMeditationSeconds = safePlaybackSessions.reduce((sum, item) => sum + Number(item.listened_seconds ?? 0), 0);
  const legacyMeditationSeconds = (history ?? []).reduce((sum, item) => sum + Number(item.listened_seconds ?? item.last_position ?? 0), 0);
  const meditationMinutes = Math.round(Math.max(verifiedMeditationSeconds, legacyMeditationSeconds) / 60);
  const breathMinutes = Math.round(safeBreathSessions.reduce((sum, item) => sum + (item.duration_seconds ?? 0), 0) / 60);
  const minutesListened = meditationMinutes + breathMinutes;
  const calmScore = Math.min(100, 42 + completed * 7);
  const lastMeditationDate = (history ?? [])
    .map((item) => item.last_played)
    .filter(Boolean)
    .sort()
    .at(-1);
  const lastBreathDate = safeBreathSessions[0]?.completed_at;
  const lastPlaybackDate = safePlaybackSessions.map((item) => item.completed_at ?? item.created_at).filter(Boolean).sort().at(-1);
  const lastPracticeDate = [lastMeditationDate, lastBreathDate, lastPlaybackDate].filter(Boolean).sort().at(-1) ?? null;
  const gardenLevel = minutesListened >= 150 ? 5 : minutesListened >= 60 ? 4 : minutesListened >= 30 ? 3 : minutesListened >= 10 ? 2 : 1;
  const activeUntil = user?.active_until ? new Date(user.active_until).getTime() : 0;
  const hasPremiumAccess = Boolean(user?.lifetime_access || activeUntil > Date.now());
  const notificationPreferences = normalizeNotificationPreferences(user?.notification_preferences ?? {});
  const hasMorningPractice = (history ?? []).some((item) => {
    const hour = hourInTimeZone(item.last_played, notificationPreferences.timezone);
    return hour >= 5 && hour < 12;
  });
  const hasEveningPractice = (history ?? []).some((item) => {
    const hour = hourInTimeZone(item.last_played, notificationPreferences.timezone);
    return hour >= 18 || (hour >= 0 && hour < 3);
  });
  const categoryCounts = (history ?? []).reduce<Record<string, number>>((map, item) => {
    if (!item.completed) return map;
    const meditation = Array.isArray(item.meditations) ? item.meditations[0] : item.meditations;
    const category = typeof meditation?.category === 'string' ? meditation.category : 'unknown';
    map[category] = (map[category] ?? 0) + 1;
    return map;
  }, {});
  const practiceDayKeys = buildPracticeDaySet({
    history: history ?? [],
    breathSessions: safeBreathSessions,
    practiceDays: safePracticeDays,
    timeZone: notificationPreferences.timezone
  });
  const normalizedPlaybackSessions = safePlaybackSessions.map((item) => ({
    ...item,
    local_date: item.local_date ?? dateKeyInTimeZone(item.created_at, notificationPreferences.timezone)
  }));
  const dailyActivity = buildCanonicalDailyActivity({
    practiceDays: safePracticeDays,
    playbackSessions: normalizedPlaybackSessions
  });
  const activeLunaDaySet = buildActiveLunaDaySet({
    checkins: checkins ?? [],
    activity: dailyActivity
  });
  const derivedRhythm = buildActiveLunaRhythm({
    localDate: todayKey(localDate),
    activeDates: activeLunaDaySet,
    lastFreezeUsed: streak?.last_freeze_used ?? null
  });
  const currentStreak = derivedRhythm.currentStreak;
  const longestStreak = Math.max(derivedRhythm.longestStreak, Number(streak?.longest_streak ?? 0));
  const moonGarden = await getMoonGardenState(telegramId, {
    completedMeditations,
    completedBreathSessions,
    currentStreak,
    longestStreak,
    gardenLevel
  });
  const currentWeek = buildCanonicalCurrentWeek({
    practiceDays: safePracticeDays,
    playbackSessions: normalizedPlaybackSessions,
    checkins: checkins ?? [],
    lastFreezeUsed: streak?.last_freeze_used ?? null,
    localDate: todayKey(localDate)
  });
  const previousWeek = buildCanonicalCurrentWeek({
    practiceDays: safePracticeDays,
    playbackSessions: normalizedPlaybackSessions,
    checkins: checkins ?? [],
    lastFreezeUsed: null,
    localDate: shiftDateKey(currentWeek.weekStart, -1)
  });
  const lifetimeStats = {
    totalListeningMinutes: minutesListened,
    totalSessions: completed,
    longestStreak,
    practiceDays: practiceDayKeys.size,
    completedWeeks: countCompletedWeeks(practiceDayKeys)
  };
  const practicesByDate = new Map<string, { id: string | null; title: string | null }>();
  [...(history ?? [])]
    .filter((item) => item.completed || Number(item.completion_percent ?? 0) >= 90)
    .sort((left, right) => String(left.last_played ?? '').localeCompare(String(right.last_played ?? '')))
    .forEach((item) => {
      const key = dateKeyInTimeZone(item.last_played, notificationPreferences.timezone);
      if (!key) return;
      const meditation = Array.isArray(item.meditations) ? item.meditations[0] : item.meditations;
      practicesByDate.set(key, {
        id: typeof item.meditation_id === 'string' ? item.meditation_id : null,
        title: typeof meditation?.title === 'string' ? meditation.title : null
      });
    });
  const moodTrend = buildSevenDayMoodTrend({
    checkins: checkins ?? [],
    localDate: todayKey(localDate),
    activity: dailyActivity,
    practices: practicesByDate
  });
  const progressInsights = buildProgressInsights({
    history: history ?? [],
    verifiedSessions: safePlaybackSessions,
    breathSessions: safeBreathSessions,
    practiceDays: safePracticeDays,
    practiceDayKeys: [...practiceDayKeys],
    totalListeningMinutes: minutesListened,
    totalSessions: completed,
    localDate: todayKey(localDate),
    timeZone: notificationPreferences.timezone
  });
  const achievements = await syncAchievements(telegramId, {
    completedMeditations,
    completedBreathSessions,
    completed,
    minutesListened,
    currentStreak,
    longestStreak,
    checkinsCount: checkins?.length ?? 0,
    hasPremiumAccess,
    gardenLevel: moonGarden.gardenLevel,
    hasMorningPractice,
    hasEveningPractice,
    practiceDays: practiceDayKeys.size,
    completedWeeks: lifetimeStats.completedWeeks,
    perfectWeeks: lifetimeStats.completedWeeks,
    categoryCounts
  });

  return {
    user: user ? {
      ...user,
      profile_goals: normalizeProfileGoals(user.profile_goals),
      notification_preferences: normalizeNotificationPreferences(user.notification_preferences ?? {})
    } : user,
    completed,
    completedMeditations,
    completedBreathSessions,
    dayStreak: currentStreak,
    currentStreak,
    longestStreak,
    freezeCount: streak?.freeze_count ?? (hasPremiumAccess ? 3 : 1),
    freezeMax: hasPremiumAccess ? 3 : 1,
    lastFreezeUsed: streak?.last_freeze_used ?? null,
    lastCleanWeekAwarded: streak?.last_clean_week_awarded ?? null,
    rewards: {
      7: Boolean(streak?.reward_7),
      14: Boolean(streak?.reward_14),
      30: Boolean(streak?.reward_30),
      100: Boolean(streak?.reward_100)
    },
    minutesListened,
    weeklyPracticeMinutes: currentWeek.listeningMinutes,
    weeklyStats: {
      listeningMinutes: currentWeek.listeningMinutes,
      completedSessions: currentWeek.completedSessions,
      checkins: (checkins ?? []).filter((item) => item.local_date && item.local_date >= currentWeek.weekStart && item.local_date <= todayKey(localDate)).length,
      activeDays: currentWeek.activeDays,
      practiceDays: currentWeek.practiceDays,
      completedDays: currentWeek.activeDays
    },
    previousWeek,
    lifetimeStats,
    currentWeek,
    moodTrend,
    progressInsights,
    totalPracticeMinutes: minutesListened,
    calmPoints: completed,
    moonSeeds: moonGarden.moonSeedsAvailable,
    moonSeedsAvailable: moonGarden.moonSeedsAvailable,
    moonSeedsEarnedTotal: moonGarden.moonSeedsEarnedTotal,
    plantedGardenElements: moonGarden.plantedGardenElements,
    plantedElementsCount: moonGarden.plantedElementsCount,
    lastMoonSeedEarnedAt: moonGarden.lastMoonSeedEarnedAt,
    gardenLevel: moonGarden.gardenLevel,
    streakDays: currentStreak,
    lastPracticeDate,
    purchasedPlan: user?.lifetime_access ? 'lifetime' : activeUntil > Date.now() ? 'monthly' : 'free',
    calmScore,
    achievements,
    progressDiagnostics: telegramId === env.ADMIN_TELEGRAM_ID ? {
      localWeekStart: currentWeek.weekStart,
      localWeekEnd: shiftDateKey(currentWeek.weekStart, 6),
      previousWeekStart: previousWeek.weekStart,
      previousWeekEnd: shiftDateKey(previousWeek.weekStart, 6),
      sourceSessionCount: safePlaybackSessions.length,
      verifiedListeningSeconds: verifiedMeditationSeconds,
      dailyActiveDates: [...activeLunaDaySet].sort(),
      currentStreak,
      longestStreak,
      moodEntriesCount: new Set((checkins ?? []).map((item) => item.local_date).filter(Boolean)).size,
      plantedGardenUpgrades: Math.min(7, moonGarden.plantedElementsCount),
      achievementCount: achievements.unlocked,
      lastProgressRefreshAt: new Date().toISOString()
    } : undefined
  };
}

export async function plantMoonGardenElement(telegramId: number, elementId: string) {
  const normalizedElementId = elementId.replace(/-/g, '_');
  const element = moonGardenElements.find((item) => item.id === normalizedElementId);
  if (process.env.NODE_ENV !== 'production') {
    console.info('[MOON_GARDEN_PLANT_ATTEMPT]', { telegramId, elementId: normalizedElementId });
  }
  if (!element) {
    if (process.env.NODE_ENV !== 'production') console.info('[MOON_GARDEN_PLANT_BLOCKED]', { reason: 'unknown_element', elementId: normalizedElementId });
    return { error: 'Unknown garden element.' as const, status: 400 };
  }

  const profile = await getProfileStats(telegramId);
  const planted = plantedElementIds(profile.plantedGardenElements);

  if (planted.includes(element.id)) {
    if (process.env.NODE_ENV !== 'production') console.info('[MOON_GARDEN_PLANT_BLOCKED]', { reason: 'already_planted', elementId: element.id });
    return { error: 'Garden element already planted.' as const, status: 409, profile };
  }

  const rawAvailableSeeds = Number(profile.moonSeedsAvailable ?? 0);
  const availableSeeds = Number.isFinite(rawAvailableSeeds) ? Math.max(0, rawAvailableSeeds) : 0;
  if (process.env.NODE_ENV !== 'production') {
    console.info('[MOON_GARDEN_BALANCE]', {
      elementId: element.id,
      availableSeeds,
      cost: element.cost,
      planted
    });
  }
  if (availableSeeds < element.cost) {
    if (process.env.NODE_ENV !== 'production') console.info('[MOON_GARDEN_PLANT_BLOCKED]', { reason: 'not_enough_seeds', elementId: element.id, availableSeeds, cost: element.cost });
    return {
      error: 'Not enough Moon Seeds.' as const,
      status: 400,
      needed: element.cost - availableSeeds,
      profile
    };
  }

  const nextPlanted = [...planted, element.id];
  const moonSeedsEarnedTotal = Math.max(
    Number(profile.moonSeedsEarnedTotal ?? 0),
    availableSeeds + plantedElementsCost(planted)
  );
  const moonSeedsAvailable = Math.max(0, availableSeeds - element.cost);

  const { error } = await supabase
    .from('moon_gardens')
    .upsert(
      {
        telegram_id: telegramId,
        moon_seeds_available: moonSeedsAvailable,
        moon_seeds_earned_total: moonSeedsEarnedTotal,
        planted_garden_elements: nextPlanted,
        last_moon_seed_earned_at: profile.lastMoonSeedEarnedAt ?? null,
        garden_level: gardenStageLevel(nextPlanted),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'telegram_id' }
    );

  if (error) throw error;
  if (process.env.NODE_ENV !== 'production') {
    console.info('[MOON_GARDEN_PLANT_SUCCESS]', {
      elementId: element.id,
      moonSeedsAvailable,
      plantedGardenElements: nextPlanted
    });
  }

  return {
    planted: true,
    elementId: element.id,
    moonSeedsAvailable,
    plantedGardenElements: nextPlanted,
    profile: await getProfileStats(telegramId)
  };
}

export async function updateMoonGardenDevState(
  telegramId: number,
  input: { action: string; seedBalance?: number; amount?: number; stageLevel?: number }
) {
  const profile = await getProfileStats(telegramId);
  const planted = plantedElementIds(profile.plantedGardenElements);
  const plantedCost = plantedElementsCost(planted);
  const rawAvailableSeeds = Number(profile.moonSeedsAvailable ?? 0);
  const currentAvailable = Number.isFinite(rawAvailableSeeds) ? Math.max(0, rawAvailableSeeds) : 0;
  const rawEarnedTotal = Number(profile.moonSeedsEarnedTotal ?? 0);
  const currentEarnedTotal = Math.max(Number.isFinite(rawEarnedTotal) ? rawEarnedTotal : 0, currentAvailable + plantedCost);

  let moonSeedsAvailable = currentAvailable;
  let moonSeedsEarnedTotal = currentEarnedTotal;
  let plantedGardenElements = planted;

  if (input.action === 'grant_100' || input.action === 'grant_seeds') {
    const amount = input.action === 'grant_100' ? 100 : Math.max(0, Math.round(Number(input.amount ?? 0)));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: 'Grant amount must be a positive number.' as const, status: 400 };
    }
    moonSeedsAvailable = currentAvailable + amount;
    moonSeedsEarnedTotal = Math.max(currentEarnedTotal + amount, moonSeedsAvailable + plantedCost);
  } else if (input.action === 'unlock_full') {
    plantedGardenElements = moonGardenElements.map((element) => element.id);
    moonSeedsAvailable = currentAvailable;
    moonSeedsEarnedTotal = Math.max(currentEarnedTotal, moonSeedsAvailable + fullMoonGardenCost);
  } else if (input.action === 'reset' || input.action === 'reset_all') {
    plantedGardenElements = [];
    moonSeedsAvailable = 0;
    moonSeedsEarnedTotal = 0;
  } else if (input.action === 'reset_planted') {
    plantedGardenElements = [];
    moonSeedsAvailable = currentAvailable;
    moonSeedsEarnedTotal = Math.max(currentEarnedTotal, moonSeedsAvailable);
  } else if (input.action === 'set_balance') {
    const nextBalance = Number(input.seedBalance ?? 0);
    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      return { error: 'Seed balance must be a non-negative number.' as const, status: 400 };
    }
    moonSeedsAvailable = Math.round(nextBalance);
    moonSeedsEarnedTotal = moonSeedsAvailable + plantedCost;
  } else if (input.action === 'set_stage') {
    const stageLevel = Math.max(0, Math.min(7, Math.round(Number(input.stageLevel ?? 0))));
    if (!Number.isFinite(stageLevel)) {
      return { error: 'Stage level must be a number.' as const, status: 400 };
    }
    plantedGardenElements = moonGardenElements.slice(0, stageLevel).map((element) => element.id);
    moonSeedsAvailable = currentAvailable;
    moonSeedsEarnedTotal = Math.max(currentEarnedTotal, moonSeedsAvailable + plantedElementsCost(plantedGardenElements));
  } else {
    return { error: 'Unknown Moon Garden dev action.' as const, status: 400 };
  }

  const { error } = await supabase
    .from('moon_gardens')
    .upsert(
      {
        telegram_id: telegramId,
        moon_seeds_available: moonSeedsAvailable,
        moon_seeds_earned_total: moonSeedsEarnedTotal,
        planted_garden_elements: plantedGardenElements,
        last_moon_seed_earned_at: new Date().toISOString(),
        garden_level: gardenStageLevel(plantedGardenElements),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'telegram_id' }
    );

  if (error) throw error;

  return {
    ok: true,
    moonSeedsAvailable,
    moonSeedsEarnedTotal,
    plantedGardenElements,
    profile: await getProfileStats(telegramId)
  };
}

async function applySuccessfulPaymentEntitlement(telegramId: number, planId: PlanId) {
  const now = new Date();
  const activeUntil = planId === 'monthly'
    ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const currentAccess = await getUserAccess(telegramId);
  const updates = currentAccess.plan === 'Lifetime'
    ? { lifetime_access: true, active_until: null }
    : planId === 'lifetime'
      ? { lifetime_access: true, active_until: null }
      : { lifetime_access: false, active_until: activeUntil };

  const { error: userError } = await supabase
    .from('users')
    .update(updates)
    .eq('telegram_id', telegramId);

  if (userError) throw userError;

  const seedsGranted = await grantPremiumMoonSeedsBonus(telegramId);
  return { seedsGranted, access: await getUserAccess(telegramId) };
}

export async function recordSuccessfulPayment(input: {
  telegram_id: number;
  plan: PlanId;
  telegram_payment_charge_id?: string;
  provider_payment_charge_id?: string;
}) {
  const plan = plans[input.plan];

  if (input.telegram_payment_charge_id) {
    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from('payments')
      .select('id, telegram_id, plan')
      .eq('telegram_payment_charge_id', input.telegram_payment_charge_id)
      .maybeSingle();

    if (existingPaymentError) throw existingPaymentError;
    if (existingPayment) {
      if (Number(existingPayment.telegram_id) !== input.telegram_id || !isPlanId(existingPayment.plan)) {
        throw new Error('Telegram payment charge does not match the Luna account.');
      }
      const recovered = await applySuccessfulPaymentEntitlement(input.telegram_id, existingPayment.plan);
      return { isNewPayment: false, ...recovered };
    }
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    telegram_id: input.telegram_id,
    plan: input.plan,
    amount_stars: plan.amountStars,
    currency: 'XTR',
    telegram_payment_charge_id: input.telegram_payment_charge_id,
    provider_payment_charge_id: input.provider_payment_charge_id,
    status: 'paid'
  });

  if (paymentError) {
    if ('code' in paymentError && paymentError.code === '23505') {
      const recovered = await applySuccessfulPaymentEntitlement(input.telegram_id, input.plan);
      return { isNewPayment: false, ...recovered };
    }
    throw paymentError;
  }

  const applied = await applySuccessfulPaymentEntitlement(input.telegram_id, input.plan);
  return {
    isNewPayment: true,
    ...applied
  };
}

export async function getRecentSuccessfulPayments(telegramId: number) {
  const { data, error } = await supabase
    .from('payments')
    .select('plan, amount_stars, currency, status, created_at')
    .eq('telegram_id', telegramId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
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
  if (action !== 'remove_premium') {
    await grantPremiumMoonSeedsBonus(telegramId);
  }
  return data;
}
