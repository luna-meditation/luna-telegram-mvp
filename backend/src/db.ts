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

  const { data: progress, error: progressError } = await supabase
    .from('progress')
    .select('completed_at')
    .eq('telegram_id', telegramId)
    .order('completed_at', { ascending: false });
  if (progressError) throw progressError;

  const completed = progress?.length ?? 0;
  const uniqueDays = new Set((progress ?? []).map((item) => item.completed_at.slice(0, 10)));
  const calmScore = Math.min(100, 42 + completed * 7);

  return {
    user,
    completed,
    dayStreak: uniqueDays.size,
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
