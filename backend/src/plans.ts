export type PlanId = 'monthly' | 'lifetime';

export const plans: Record<PlanId, { id: PlanId; title: string; amountStars: number; days?: number }> = {
  monthly: {
    id: 'monthly',
    title: 'Monthly Access',
    amountStars: 499,
    days: 30
  },
  lifetime: {
    id: 'lifetime',
    title: 'Lifetime Access',
    amountStars: 2499
  }
};

export function isPlanId(value: unknown): value is PlanId {
  return value === 'monthly' || value === 'lifetime';
}

export function isValidTelegramInvoiceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['t.me', 'telegram.me'].includes(url.hostname.toLowerCase())) return false;
    return /^\/\$(?!$)[^/]+$/.test(url.pathname) || /^\/invoice\/(?!$)[^/]+$/.test(url.pathname);
  } catch {
    return false;
  }
}
