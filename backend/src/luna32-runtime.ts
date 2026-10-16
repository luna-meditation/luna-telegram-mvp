import type {SupabaseClient} from '@supabase/supabase-js';import {z} from 'zod';
import {FoundationError} from './foundation-error.js';
export const betaFeatures=['ai','tarot','astrology','meditations','breathwork','dreams'] as const;
export const runtimeSettingsSchema=z.object({public_beta:z.boolean(),beta_starts_at:z.string().nullable(),beta_expires_at:z.string().nullable(),beta_features:z.array(z.enum(betaFeatures)),free_daily_limit:z.number().int().positive().max(200).nullable(),premium_daily_limit:z.number().int().positive().max(500).nullable(),monthly_cap_microusd:z.number().int().nonnegative(),legacy_monthly_cost_microusd:z.number().int().nonnegative(),baseline_month:z.string().nullable(),cost_baseline_verified:z.boolean(),generation_enabled:z.boolean()});
export type RuntimeSettings=z.infer<typeof runtimeSettingsSchema>;
export function betaEntitlement(settings:RuntimeSettings,now=Date.now()){
 const start=Date.parse(settings.beta_starts_at??''),end=Date.parse(settings.beta_expires_at??'');
 return {active:settings.public_beta&&Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&now<end,startsAt:settings.beta_starts_at,expiresAt:settings.beta_expires_at,features:settings.beta_features,source:'promotion' as const,autoCharge:false as const};
}
export async function readLuna32Settings(db:SupabaseClient){
 const {data,error}=await db.from('luna32_runtime_settings').select('*').eq('id',true).single();
 const parsed=runtimeSettingsSchema.safeParse(data);if(error||!parsed.success)throw new FoundationError(503,'beta_configuration_unavailable','Beta configuration could not be verified.');return parsed.data;
}
export function hasBetaFeature(settings:RuntimeSettings,feature:typeof betaFeatures[number],now=Date.now()){return betaEntitlement(settings,now).active&&settings.beta_features.includes(feature);}
export function successfulAiLimit(settings:RuntimeSettings,paidPremium:boolean,fallback:{free:number;premium:number}){return paidPremium?settings.premium_daily_limit??fallback.premium:settings.free_daily_limit??fallback.free;}
