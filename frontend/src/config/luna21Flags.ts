// Separate rollout gates: building the UX must never silently activate billing.
export function resolveLuna21Flags(source:Record<string,unknown>) {
 const enabled=(name:string)=>String(source[name]??'').trim().toLowerCase()==='true';
 return Object.freeze({daily_card_v2:enabled('VITE_FEATURE_DAILY_CARD_V2'),
  economy_rewards_v2:enabled('VITE_FEATURE_ECONOMY_REWARDS_V2'),
  tarot_paid_readings:enabled('VITE_FEATURE_TAROT_PAID_READINGS'),
  premium_v2:enabled('VITE_FEATURE_PREMIUM_V2')});
}
export const luna21Flags=resolveLuna21Flags(import.meta.env);
