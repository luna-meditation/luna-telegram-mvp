import type { PlanId } from './plans.js';

export function paymentEligibility(currentPlan: string, requestedPlan: PlanId) {
  if (currentPlan === 'Lifetime') {
    return { allowed: false, code: 'lifetime_owned' as const };
  }
  if (currentPlan === 'Monthly' && requestedPlan === 'monthly') {
    return { allowed: false, code: 'monthly_active' as const };
  }
  return { allowed: true, code: 'allowed' as const };
}
