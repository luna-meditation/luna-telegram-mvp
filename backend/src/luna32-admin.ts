import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {readLuna32Settings} from './luna32-runtime.js';
import {FoundationError} from './foundation-error.js';
// Owner-approved ceiling, not an editable provider account billing limit.
export const approvedMonthlyAiCapUsd=100;
const update=z.object({monthlyCapUsd:z.number().finite().min(0).max(approvedMonthlyAiCapUsd).optional(),freeDailyLimit:z.number().int().min(1).max(200).optional(),premiumDailyLimit:z.number().int().min(1).max(500).optional(),generationEnabled:z.boolean().optional(),publicBeta:z.boolean().optional(),betaStartsAt:z.string().datetime().optional(),betaExpiresAt:z.string().datetime().optional()}).strict().refine(v=>Object.keys(v).length>0);
export function createLuna32Admin(db:SupabaseClient){return{
 async read(){const settings=await readLuna32Settings(db),month=new Date().toISOString().slice(0,7)+'-01';const totals=await db.from('luna32_ai_month_totals').select('held_cost_microusd,spent_cost_microusd').eq('month',month).maybeSingle();if(totals.error)throw new FoundationError(503,'ai_budget_unavailable','Budget status is unavailable.');return{settings,month,approvedCapUsd:approvedMonthlyAiCapUsd,heldUsd:Number(totals.data?.held_cost_microusd??0)/1e6,spentUsd:Number(totals.data?.spent_cost_microusd??0)/1e6,baselineUsd:settings.baseline_month===month?settings.legacy_monthly_cost_microusd/1e6:0};},
 async update(raw:unknown){const v=update.parse(raw),current=await readLuna32Settings(db);const row={...current,...(v.monthlyCapUsd!==undefined?{monthly_cap_microusd:Math.floor(v.monthlyCapUsd*1e6)}:{}),...(v.freeDailyLimit!==undefined?{free_daily_limit:v.freeDailyLimit}:{}),...(v.premiumDailyLimit!==undefined?{premium_daily_limit:v.premiumDailyLimit}:{}),...(v.generationEnabled!==undefined?{generation_enabled:v.generationEnabled}:{}),...(v.publicBeta!==undefined?{public_beta:v.publicBeta}:{}),...(v.betaStartsAt?{beta_starts_at:v.betaStartsAt}:{}),...(v.betaExpiresAt?{beta_expires_at:v.betaExpiresAt}:{})};
  if(row.public_beta&&(!(Date.parse(row.beta_starts_at??'')<Date.parse(row.beta_expires_at??''))||Date.parse(row.beta_expires_at??'')<=Date.now()))throw new FoundationError(400,'beta_window_required','Set a future end date for promotional access.');
  if(row.generation_enabled&&(!row.cost_baseline_verified||!row.baseline_month||row.monthly_cap_microusd<=0||row.baseline_month>new Date().toISOString().slice(0,7)+'-01'))throw new FoundationError(409,'ai_budget_unconfigured','Verify the cost baseline before enabling generation.');
  // Never replay a stale generation_enabled=true value when an operator only
  // changes a quota: a concurrent provider-overrun circuit breaker must win.
  const delta={...(v.monthlyCapUsd!==undefined?{monthly_cap_microusd:row.monthly_cap_microusd}:{}),...(v.freeDailyLimit!==undefined?{free_daily_limit:row.free_daily_limit}:{}),...(v.premiumDailyLimit!==undefined?{premium_daily_limit:row.premium_daily_limit}:{}),...(v.generationEnabled!==undefined?{generation_enabled:row.generation_enabled}:{}),...(v.publicBeta!==undefined?{public_beta:row.public_beta}:{}),...(v.betaStartsAt?{beta_starts_at:row.beta_starts_at}:{}),...(v.betaExpiresAt?{beta_expires_at:row.beta_expires_at}:{}),updated_at:new Date().toISOString()};
  const result=await db.from('luna32_runtime_settings').update(delta).eq('id',true);if(result.error)throw new FoundationError(503,'ai_budget_unavailable','Could not update runtime settings.');return this.read();
 }
};}
