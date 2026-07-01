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
