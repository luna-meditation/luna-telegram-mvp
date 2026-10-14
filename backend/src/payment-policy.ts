import type { PaymentPayloadPlanId } from './plans.js';
import {paymentPlanDetails} from './plans.js';

export function validExistingPlanPayment(plan:PaymentPayloadPlanId,currency:unknown,amount:unknown,chargeId?:unknown) {
  return currency==='XTR'&&Number.isSafeInteger(amount)&&amount===paymentPlanDetails(plan).amountStars
    &&(chargeId===undefined||(typeof chargeId==='string'&&chargeId.length>0&&chargeId.length<=512));
}

export function paymentEligibility(currentPlan: string, requestedPlan: PaymentPayloadPlanId) {
  if (currentPlan === 'Lifetime') {
    return { allowed: false, code: 'lifetime_owned' as const };
  }
  if (currentPlan === 'Monthly' && requestedPlan !== 'lifetime') {
    return { allowed: false, code: 'fixed_term_active' as const };
  }
  return { allowed: true, code: 'allowed' as const };
}
