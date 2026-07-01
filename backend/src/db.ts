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
