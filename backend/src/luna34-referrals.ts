import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {createReferralCode,referralLink,signedReferralCode} from './luna30-referral-policy.js';
import {recordFunnel} from './luna35-funnel.js';
export function createLuna34Referrals(db:SupabaseClient,config:{enabled:boolean;botUsername:string}){
 const unavailable=()=>new FoundationError(503,'referrals_unavailable','Invitations are unavailable. Your balance is unchanged.');
 async function settings(){if(!config.enabled)return null;const r=await db.from('luna34_commercial_settings').select('referrals_enabled,rewards_enabled,checkout_enabled,owner_approved,live_payment_verified').eq('id',true).single();if(r.error)throw unavailable();return r.data?.referrals_enabled&&r.data.owner_approved?r.data:null;}
 return {
  async attribute(owner:number,startParam:string|undefined){const code=signedReferralCode(startParam);if(!code||!await settings())return {status:'disabled'};const r=await db.rpc('luna34_attribute_referral',{p_owner:owner,p_signed_code:code});if(r.error)throw unavailable();return r.data;},
  async qualify(owner:number,kind:'meditation'|'breath'|'tarot',evidence:string){if(!await settings())return {status:'disabled',awarded:0};const r=await db.rpc('luna34_qualify_referral',{p_owner:owner,p_kind:kind,p_evidence:evidence});if(r.error)throw unavailable();return r.data;},
  async dashboard(owner:number,create=false){const cfg=await settings();if(!cfg)return {enabled:false,link:null,total:0,pending:0,qualified:0,rewarded:0,seedsEarned:0,monthlyCap:5,rewardsEnabled:false,onboardingRequired:false};
   if(create){const r=await db.from('luna30_referral_codes').upsert({telegram_id:owner,code:createReferralCode()},{onConflict:'telegram_id',ignoreDuplicates:true});if(r.error)throw unavailable();}
   const [code,rows,incoming,onboarding]=await Promise.all([db.from('luna30_referral_codes').select('code,disabled_at').eq('telegram_id',owner).maybeSingle(),db.from('luna30_referrals').select('state,qualified_at').eq('referrer_id',owner),db.from('luna30_referrals').select('state').eq('referee_id',owner).maybeSingle(),db.from('luna34_referral_onboarding').select('completed_at').eq('telegram_id',owner).maybeSingle()]);
   if(code.error||rows.error||incoming.error||onboarding.error)throw unavailable();const rewarded=rows.data?.filter(r=>r.state==='rewarded').length??0;
   return {enabled:true,link:code.data&&!code.data.disabled_at?referralLink(config.botUsername,code.data.code):null,total:rows.data?.length??0,pending:rows.data?.filter(r=>r.state==='pending').length??0,qualified:rows.data?.filter(r=>r.qualified_at!==null).length??0,rewarded,seedsEarned:rewarded*30,monthlyCap:5,rewardsEnabled:cfg.rewards_enabled&&cfg.checkout_enabled&&cfg.live_payment_verified,onboardingRequired:incoming.data?.state==='pending'&&!onboarding.data};
  },
  async finishOnboarding(owner:number){if(!await settings())return {completed:false};const r=await db.from('luna34_referral_onboarding').upsert({telegram_id:owner},{onConflict:'telegram_id',ignoreDuplicates:true});if(r.error)throw unavailable();await recordFunnel(db,owner,'onboarding_completed','first','verified');return {completed:true};}
 };
}
