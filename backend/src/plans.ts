export type PlanId = 'annual' | 'lifetime';
export type LegacyPlanId = 'monthly';
export type PaymentPayloadPlanId = PlanId | LegacyPlanId;
export type StoredPlanId = 'monthly' | 'lifetime';

export const plans: Record<PlanId, { id: PlanId; title: string; amountStars: number; days?: number }> = {
  annual: {
    id: 'annual',
    title: 'Annual Premium',
    amountStars: 750,
    days: 365
  },
  lifetime: {
    id: 'lifetime',
    title: 'Lifetime Access',
    amountStars: 2499
  }
};

export function isPlanId(value: unknown): value is PlanId {
  return value === 'annual' || value === 'lifetime';
}

export function isPaymentPayloadPlanId(value: unknown): value is PaymentPayloadPlanId {
  return isPlanId(value) || value === 'monthly';
}

export function paymentPlanDetails(planId: PaymentPayloadPlanId) {
  if (planId === 'monthly') {
    return { id: planId, title: 'Monthly Access', amountStars: 499, days: 30 } as const;
  }
  return plans[planId];
}

// Production payments historically store fixed-term access as "monthly".
// Keep that storage contract until a dedicated schema migration is scheduled.
export function storedPlanId(planId: PaymentPayloadPlanId): StoredPlanId {
  return planId === 'lifetime' ? 'lifetime' : 'monthly';
}

export function payloadPlanFromStoredPayment(planId: unknown, amountStars: unknown): PaymentPayloadPlanId | null {
  if (planId === 'lifetime') return 'lifetime';
  if (planId !== 'monthly') return null;
  return Number(amountStars) === plans.annual.amountStars ? 'annual' : 'monthly';
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
