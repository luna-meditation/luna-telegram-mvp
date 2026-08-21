import type { PaymentPayloadPlanId } from './plans.js';

export function paymentEligibility(currentPlan: string, requestedPlan: PaymentPayloadPlanId) {
  if (currentPlan === 'Lifetime') {
    return { allowed: false, code: 'lifetime_owned' as const };
  }
  if (currentPlan === 'Monthly' && requestedPlan !== 'lifetime') {
    return { allowed: false, code: 'fixed_term_active' as const };
  }
  return { allowed: true, code: 'allowed' as const };
}
