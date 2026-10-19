import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
/** Advance existing progress/watermarks but do not mint legacy free rewards
 * once the owner-approved replacement reward policy is enabled. */
export const legacySeedReward=(amount:number,rewardsV2:boolean)=>rewardsV2?0:amount;
/** The caller is an already authenticated Telegram backend operation. No owner,
 * amount, date or reward eligibility is accepted from the browser. */
export function createLuna4Rewards(db:SupabaseClient,enabled:()=>boolean){return{
 async welcome(owner:number){if(!enabled())return{status:'disabled',awarded:0};const r=await db.rpc('luna4_claim_welcome',{p_owner:owner});if(r.error||!r.data)throw new FoundationError(503,'welcome_reward_unavailable','The account is saved. Its reward can be checked again without a second grant.');return r.data as{status:string;awarded:number;additionalMessages?:number};},
 async checkin(owner:number,id:string){if(!enabled())return{status:'disabled',awarded:0};const r=await db.rpc('luna4_reward_checkin',{p_owner:owner,p_source:id});if(r.error||!r.data)throw new FoundationError(503,'checkin_reward_unavailable','The check-in is saved. Its reward can be checked again without a second grant.');return r.data as{status:string;awarded:number;bonus?:number;timezone?:'UTC'};}
};}
