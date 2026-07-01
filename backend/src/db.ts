import { createClient } from '@supabase/supabase-js';
import { env } from './config.js';
import { plans, type PlanId } from './plans.js';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
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
};

export type HistoryInput = {
  meditation_id: string;
  last_position: number;
  duration: number;
  completed?: boolean;
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
    .select('telegram_id, first_name, username, active_until, lifetime_access, free_used')
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

  if (completed) await updateStreak(telegramId);

  return { completion_percent: completion, completed };
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
  return data;
}

export async function createMeditation(input: MeditationInput) {
  const { data, error } = await supabase.from('meditations').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateMeditation(id: string, input: Partial<MeditationInput>) {
  const { data, error } = await supabase
    .from('meditations')
    .update({ ...input, updated_at: new Date().toISOString() })
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

export async function getProfileStats(telegramId: number) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('first_name, username, active_until, lifetime_access')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (userError) throw userError;

  const [{ data: history, error: historyError }, { data: streak, error: streakError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase.from('history').select('completion_percent, last_position, completed').eq('telegram_id', telegramId),
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

  const completed = (history ?? []).filter((item) => item.completed).length + (legacyProgress?.length ?? 0);
  const minutesListened = Math.round((history ?? []).reduce((sum, item) => sum + (item.last_position ?? 0), 0) / 60);
  const calmScore = Math.min(100, 42 + completed * 7);

  return {
    user,
    completed,
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
    purchasedPlan: payments?.[0]?.plan ?? 'free',
    calmScore
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
    { data: streaks, error: streaksError }
  ] = await Promise.all([
    supabase.from('users').select('telegram_id, username, first_name, last_name, created_at, last_seen_at, active_until, lifetime_access'),
    supabase.from('payments').select('telegram_id, plan, amount_stars, status, created_at').order('created_at', { ascending: false }),
    supabase.from('meditations').select('id, title, category, premium, published, play_count, duration, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('history').select('telegram_id, meditation_id, last_played, play_count, completion_percent, last_position, completed'),
    supabase.from('streaks').select('telegram_id, current_streak, longest_streak')
  ]);

  if (usersError) throw usersError;
  if (paymentsError) throw paymentsError;
  if (meditationsError) throw meditationsError;
  if (historyError) throw historyError;
  if (streaksError) throw streaksError;

  const userRows = users ?? [];
  const paymentRows = (payments ?? []).filter((payment) => payment.status === 'paid');
  const meditationRows = meditations ?? [];
  const historyRows = history ?? [];
  const streakRows = streaks ?? [];
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
    topUsers: {
      topListeners: [...adminUsers].sort((left, right) => right.totalMinutesListened - left.totalMinutesListened).slice(0, 10),
      longestStreaks: [...adminUsers].sort((left, right) => right.longestStreak - left.longestStreak).slice(0, 10),
      mostCompleted: [...adminUsers].sort((left, right) => right.completedMeditations - left.completedMeditations).slice(0, 10)
    },
    recentActivity: {
      latestRegistrations: [...userRows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()).slice(0, 10),
      latestPurchases,
      latestMeditationPlays: latestPlays,
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
