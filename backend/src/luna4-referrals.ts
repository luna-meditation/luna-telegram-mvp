import type {SupabaseClient}from'@supabase/supabase-js';
import{FoundationError}from'./foundation-error.js';
import{z}from'zod';
const summarySchema=z.object({seedsEarned:z.number().int().nonnegative(),policy:z.object({inviter:z.number().int().min(0).max(10000),invitee:z.number().int().min(0).max(10000),firstPurchase:z.number().int().min(0).max(10000)}).strict(),monthlyCap:z.number().int().min(0).max(100)}).strict();
export function referralSummary(value:unknown){const parsed=summarySchema.safeParse(value);if(!parsed.success)throw new FoundationError(503,'referrals_unavailable','Invitation totals could not be verified.');return parsed.data;}
export async function referralContractRpc(db:SupabaseClient,name:string,legacy:string,args:Record<string,unknown>,version:unknown){const r=await db.rpc(name,args);if(r.error?.code==='PGRST202'&&['luna-3.4','luna-4.3'].includes(String(version)))return db.rpc(legacy,args);if(r.error)throw new FoundationError(503,'referrals_unavailable','Your activity and balance are preserved. Invitation verification can be retried.');return r;}
/** Called only AFTER the original Stars fulfillment/refund committed. Reward
 * failure must never roll back/duplicate a legitimate payment. Durable receipt
 * + original referral terms allow a duplicate callback/membership read to retry. */
export async function reconcileReferralPurchase(db:SupabaseClient,owner:number,enabled:unknown){if(enabled!==true&&enabled!=='true')return;try{const r=await db.rpc('luna4_reward_referral_purchase',{p_owner:owner});if(r.error&&r.error.code!=='PGRST202')console.error('[Luna referrals]',{code:'purchase_reward_pending'});}catch{console.error('[Luna referrals]',{code:'purchase_reward_pending'});}}
