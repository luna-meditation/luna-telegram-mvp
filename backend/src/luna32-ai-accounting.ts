import {AsyncLocalStorage} from 'node:async_hooks';import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {readLuna32Settings,successfulAiLimit} from './luna32-runtime.js';
import {stagingAiMeterRecord} from './staging-ai-meter.js';
import {readCommercialAllowance,reserveCommercialAllowance,settleCommercialAllowance} from './luna34-allowances.js';
type Operation={db:SupabaseClient;owner:number;key:string;lease:string;calls:number;limit:number;commercial?:boolean;allowanceVersion?:string;allowanceId?:string|null;adminQuota?:boolean;prepaid?:boolean;readingOrder?:{id:string;kind:'single'|'three'|'five'}};
const operationContext=new AsyncLocalStorage<Operation>();
export const currentAiSafetyLimit=()=>operationContext.getStore()?.commercial||operationContext.getStore()?.adminQuota||operationContext.getStore()?.prepaid?500:undefined;
export function providerCostCeiling(body:unknown){
 const value=body as {model?:string;max_output_tokens?:number;store?:boolean;service_tier?:string};
 if(!['gpt-5-mini','gpt-5-mini-2025-08-07'].includes(value.model??'')||!Number.isSafeInteger(value.max_output_tokens)||value.max_output_tokens!<512||value.max_output_tokens!>8192||value.store!==false)throw new FoundationError(503,'ai_budget_unsupported','This provider configuration is not approved for generation.');
 const bytes=Buffer.byteLength(JSON.stringify(body),'utf8');if(bytes>96000)throw new FoundationError(413,'ai_context_too_large','Select a smaller context.');
 // UTF-8 bytes plus overhead conservatively bound input tokens. Include all
 // reasoning/output tokens, tool schemas and the default (non-priority) tier.
 return Math.ceil((bytes+1024)*0.25+value.max_output_tokens!*2);
}
async function verifyPaidReading(db:SupabaseClient,owner:number,key:string,order:NonNullable<Operation['readingOrder']>,bound=false){
 if(!key.startsWith('tarot:'))throw new FoundationError(403,'reading_order_mismatch','Use the original reading purchase.');
 const result=await db.from('luna_reading_orders').select('status,kind,client_reading_id').eq('telegram_id',owner).eq('id',order.id).maybeSingle();
 if(result.error)throw new FoundationError(503,'order_unavailable','Your purchase is preserved.');
 // Reservation binds an ENTITLED order. Only successful result settlement
 // changes it to CONSUMED. Requiring that final status before dispatch made
 // every genuine paid draw fail while the old unit fixture invented success.
 const row=result.data;if(!row||row.kind!==order.kind||!['entitled','consumed'].includes(row.status)||row.client_reading_id!==null&&row.client_reading_id!==key.slice(6)||bound&&(row.status!=='entitled'||row.client_reading_id!==key.slice(6)))throw new FoundationError(403,'reading_order_mismatch','Use the original owned reading purchase.');
}
export async function withAiOperation<T>(db:SupabaseClient,owner:number,key:string,task:()=>Promise<T>,success:(result:T)=>boolean=()=>true,options?:{readingOrder?:Operation['readingOrder']}):Promise<T>{
 if(process.env.LUNA32_ENABLED!=='true'){if(process.env.LUNA34_COMMERCIAL_QUOTAS_ENABLED==='true')throw new FoundationError(503,'ai_accounting_required','Commercial allowances require the verified global cost guard.');return task();}
 const {env}=await import('./config.js');
 const parent=operationContext.getStore();if(parent){if(parent.owner!==owner)throw new FoundationError(403,'context_owner_mismatch','This context is private.');return task();}
 const cfg=await readLuna32Settings(db);
 const user=await db.from('users').select('lifetime_access,active_until').eq('telegram_id',owner).maybeSingle();if(user.error||!user.data)throw new FoundationError(503,'access_unavailable','Could not verify your access.');
 let paid=user.data.lifetime_access||Date.parse(user.data.active_until??'')>Date.now();
 if(!paid&&env.LUNA30_PREMIUM_ENTITLEMENTS_ENABLED){const period=await db.from('luna30_entitlement_periods').select('id').eq('telegram_id',owner).is('revoked_at',null).lte('period_start',new Date().toISOString()).gt('period_end',new Date().toISOString()).limit(1).maybeSingle();if(period.error)throw new FoundationError(503,'access_unavailable','Could not verify your access.');paid=Boolean(period.data);}
 const administrative=env.FEATURE_ADMIN_V4_MUTATIONS?await (await import('./luna40-grants.js')).readAdminGrants(db,owner):null;
 const context:Operation={db,owner,key,lease:randomUUID(),calls:0,adminQuota:env.FEATURE_ADMIN_V4_MUTATIONS,limit:successfulAiLimit(cfg,Boolean(paid||administrative?.active),{free:env.AI_MAX_MESSAGES_PER_DAY,premium:env.AI_PREMIUM_MAX_MESSAGES_PER_DAY})};
 const prepaid=key.startsWith('deep:')?'deep_analysis':key.startsWith('portrait:')?'personal_portrait':key.startsWith('compatibility:')?'compatibility_report':null;
 if(prepaid){const purchase=await db.from('luna43_seed_purchases').select('state').eq('telegram_id',owner).eq('id',key.slice(key.indexOf(':')+1)).eq('product',prepaid).maybeSingle();if(purchase.error||purchase.data?.state!=='processing')throw new FoundationError(403,'paid_analysis_required','A confirmed owned analysis is required.');context.prepaid=true;context.adminQuota=false;context.limit=500;}
 if(options?.readingOrder){await verifyPaidReading(db,owner,key,options.readingOrder);context.prepaid=true;context.readingOrder=options.readingOrder;context.adminQuota=false;context.limit=500;}
 if(!context.prepaid&&env.LUNA34_COMMERCIAL_QUOTAS_ENABLED){const allowance=await readCommercialAllowance(db,owner);if(allowance.enabled){context.commercial=true;context.allowanceVersion=allowance.contractVersion;context.limit=500;}}
 let completed=false;
 try{return await operationContext.run(context,async()=>{const result=await task();completed=success(result);return result;});}
 finally{if(context.calls){const result=await db.rpc('luna32_finish_ai_operation',{p_owner:owner,p_operation:key,p_lease:context.lease,p_success:completed});if(result.error)console.error('[Luna AI accounting]',{code:'operation_settlement_failed',lease:context.lease});if(context.adminQuota&&!context.commercial){const settled=await db.rpc('luna40_finish_quota',{p_owner:owner,p_operation:key,p_lease:context.lease,p_success:completed});if(settled.error)console.error('[Luna AI accounting]',{code:'admin_quota_settlement_failed',lease:context.lease});}}if(context.allowanceId){const settled=await settleCommercialAllowance(db,owner,context.allowanceId,key,completed&&context.calls>0,{version:context.allowanceVersion,lease:context.lease});if(settled.error)console.error('[Luna AI accounting]',{code:'allowance_settlement_failed',lease:context.lease});}}
}
export function guardedProviderTransport(transport:(body:unknown,signal:AbortSignal)=>Promise<Response>){
 return async(body:unknown,signal:AbortSignal)=>{
  if(process.env.LUNA32_ENABLED!=='true')return transport(body,signal);
  const op=operationContext.getStore();if(!op)throw new FoundationError(503,'ai_accounting_context_missing','This AI action is unavailable.');
  const ceiling=providerCostCeiling(body);const maxCalls=op.key.startsWith('chat:')&&process.env.FEATURE_LUNA_INTELLIGENCE==='true'?3:2;if(op.calls>=maxCalls)throw new FoundationError(503,'ai_tool_round_limit','This turn reached its bounded tool limit.');
  // A confirmed purchase replaces the ordinary answer/included allowance; it
  // is not an extra charge. Verify that the existing draw RPC bound it to this
  // exact reading before dispatch, not merely that a pending order exists.
  if(op.readingOrder)await verifyPaidReading(op.db,op.owner,op.key,op.readingOrder,true);
  const id=randomUUID(),index=op.calls+1;
  const args={p_owner:op.owner,p_operation:op.key,p_lease:op.lease,p_call:index,p_attempt:id,p_model:(body as {model:string}).model,p_ceiling:ceiling,p_limit:op.limit};
  const reserve=await (op.adminQuota&&!op.commercial?op.db.rpc('luna40_reserve_ai_attempt',args):op.db.rpc('luna32_reserve_ai_attempt',args));
  if(reserve.error||!reserve.data)throw new FoundationError(503,'ai_budget_unavailable','Generation is temporarily unavailable; saved results remain available.');
  const status=reserve.data.status;
  if(status!=='reserved')throw new FoundationError(['daily_limit','attempt_limit'].includes(status)?429:status==='in_progress'?409:503,status==='daily_limit'?'quota_exhausted':status==='attempt_limit'?'ai_attempt_limit':status==='in_progress'?'request_in_progress':status==='already_completed'?'ai_result_already_saved':'ai_global_budget','New AI generation is paused. Saved results and non-AI features remain available.');
  op.calls=index;let settled=false,dispatched=false;
  const settle=async(cost:number|null,input:number|null,cached:number|null,output:number|null,state:string)=>{
   const result=await op.db.rpc('luna32_settle_ai_attempt',{p_owner:op.owner,p_attempt:id,p_cost:cost,p_input:input,p_cached:cached,p_output:output,p_status:state});
   if(result.error||result.data!==true)throw new FoundationError(503,'ai_accounting_failed','Usage could not be verified.');settled=true;
  };
  try{
   // Lease ownership precedes the quota hold. A duplicate/crashed old worker
   // cannot release another worker's in-flight commercial allowance.
   if(op.commercial&&index===1&&op.allowanceId===undefined)op.allowanceId=await reserveCommercialAllowance(op.db,op.owner,op.key,{version:op.allowanceVersion,lease:op.lease});
   dispatched=true;
   const response=await transport({...body as object,service_tier:'default'},signal);
   if(!response.ok){
    // Without verifiable usage, never infer that an HTTP error was unbilled.
    // An operator can reconcile the conservative hold against provider billing.
    await settle(null,null,null,null,'http_'+response.status);return response;
   }
   // Own the provider stream exactly once. Metering must never hand a disturbed
   // stream to chat/Tarot/report consumers (observed in the production runtime).
   const responseBody=await response.text();
   const payload=JSON.parse(responseBody),meter=stagingAiMeterRecord(payload);
   if(!meter||meter.estimated_cost===null){await settle(null,null,null,null,'unverified_usage');throw new FoundationError(503,'ai_usage_unverified','Provider usage could not be verified.');}
   const cached=payload.usage?.input_tokens_details?.cached_tokens??0,cost=Math.ceil(meter.estimated_cost*1000000);
   await settle(cost,meter.input_tokens,cached,meter.output_tokens,String(payload.status??'unknown').slice(0,40));
   if(cost>ceiling)throw new FoundationError(503,'ai_cost_overrun','Generation paused for review.');
   return new Response(responseBody,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(error){if(!settled){try{if(dispatched)await settle(null,null,null,null,'unknown_outcome');else await settle(0,0,0,0,'not_dispatched');}catch{/* Reserved cost remains held; never silently release unknown spend. */}}throw error;}
 };
}
