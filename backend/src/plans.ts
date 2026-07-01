export type PlanId = 'monthly' | 'lifetime';

export const plans: Record<PlanId, { id: PlanId; title: string; amountStars: number; days?: number }> = {
  monthly: {
    id: 'monthly',
    title: 'Monthly Access',
    amountStars: 299,
    days: 30
  },
  lifetime: {
    id: 'lifetime',
    title: 'Lifetime Access',
    amountStars: 1999
  }
};

export function isPlanId(value: unknown): value is PlanId {
  return value === 'monthly' || value === 'lifetime';
}
