import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {FoundationError} from './foundation-error.js';
import {luna4EconomyVersion} from './luna4-economy-policy.js';
const benefits=z.object({standard:z.number().int().min(0).max(10000),three:z.number().int().min(0).max(10000),deep:z.number().int().min(0).max(10000),premiumMeditations:z.boolean(),basicPortrait:z.boolean()}).strict();
const contractSchema=z.discriminatedUnion('paid',[
 z.object({paid:z.literal(false),preserveLegacy:z.literal(false),kind:z.literal('free')}),
 z.object({paid:z.literal(true),preserveLegacy:z.boolean(),kind:z.enum(['weekly','monthly','annual','lifetime','legacy_fixed_term']),contractVersion:z.literal(luna4EconomyVersion).optional(),contractRevision:z.number().int().nonnegative().optional(),periodId:z.string().uuid().optional(),periodKey:z.string().optional(),until:z.string().nullable().optional(),allowances:benefits.optional(),window:z.object({start:z.string(),end:z.string(),index:z.number().int().nonnegative(),scope:z.enum(['subscription_week','billing_month'])}).optional()})
]).superRefine((value,ctx)=>{if(value.paid&&!value.preserveLegacy&&(!value.contractVersion||!value.allowances||!value.window||!value.periodId||!value.periodKey))ctx.addIssue({code:'custom',message:'Verified finite contract required.'});});
export type ContractBenefits=z.infer<typeof contractSchema>;
export async function readContractBenefits(db:SupabaseClient,owner:number,required=false):Promise<ContractBenefits|null>{
 const result=await db.rpc('luna4_membership_contract',{p_owner:owner});
 // Backwards compatible ONLY when an old database truly lacks the new RPC.
 // Permissions, malformed snapshots and network failures never grant access.
 if(result.error?.code==='PGRST202'&&!required)return null;
 const parsed=contractSchema.safeParse(result.data);if(result.error||!parsed.success)throw new FoundationError(503,'membership_unavailable','Your subscription is preserved; its original benefits could not be verified.');
 return parsed.data;
}
