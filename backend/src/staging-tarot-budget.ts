import {env} from './config.js';
import {supabase} from './db.js';
import {requestLunaResponse} from './luna/ai-provider.js';
import {stagingAiMeterRecord} from './staging-ai-meter.js';

const stagingRef='funvzpmpbgazsisehiru';
export function qaTarotEnabled(telegramId:number){
 const staging=env.STAGING_MODE&&env.STAGING_HOST==='netlify'&&env.FEATURE_AI_CENTRAL_EXPERIENCE&&env.FEATURE_TAROT_SPREAD_AI_QA
  &&env.STAGING_SUPABASE_PROJECT_REF===stagingRef&&new URL(env.SUPABASE_URL).hostname===`${stagingRef}.supabase.co`
  &&telegramId===env.STAGING_TAROT_AI_QA_OWNER_ID&&Boolean(env.STAGING_TAROT_AI_QA_GRANT_ID)
  &&env.AI_CHAT_MODEL==='gpt-5-mini';
 const release=!env.STAGING_MODE&&env.FEATURE_AI_CENTRAL_EXPERIENCE&&env.FEATURE_TAROT_RELEASE_AI_QA
  &&new URL(env.SUPABASE_URL).hostname==='vkcdtasbdoeilgfucoax.supabase.co'
  &&telegramId===158467796&&telegramId===env.RELEASE_TAROT_AI_QA_OWNER_ID&&Boolean(env.RELEASE_TAROT_AI_QA_GRANT_ID)
  &&env.AI_CHAT_MODEL==='gpt-5-mini';
 return staging||release;
}
export function qaTarotLimits(telegramId:number){
 // Separate owner exception, not a global configuration/quota reset.
 return {daily:qaTarotEnabled(telegramId)?Math.max(8,env.TAROT_AI_DAILY_LIMIT):env.TAROT_AI_DAILY_LIMIT,
  global:qaTarotEnabled(telegramId)?Math.max(8,env.TAROT_AI_GLOBAL_DAILY_LIMIT):env.TAROT_AI_GLOBAL_DAILY_LIMIT};
}
export function qaTarotTransport(telegramId:number,clientReadingId:string,transport=requestLunaResponse):typeof requestLunaResponse{
 return async(body,signal)=>{
  if(!qaTarotEnabled(telegramId))throw new Error('qa_not_authorized');
  const request=body as {model?:string;max_output_tokens?:number;tools?:unknown;store?:boolean};
  // Byte-level upper bound avoids a tokenizer dependency. Only plain text, no tools.
  // <=16,000 input bytes + 2,048 framing tokens, <=3,600 output tokens:
  // conservative reservation $0.012 at the pinned standard GPT-5-mini rates.
  if(request.model!=='gpt-5-mini'||request.tools||request.store!==false||!Number.isInteger(request.max_output_tokens)
   ||request.max_output_tokens!<1||request.max_output_tokens!>3600||Buffer.byteLength(JSON.stringify(body),'utf8')>16000)throw new Error('qa_request_bounds');
  const args={p_grant_id:(env.STAGING_MODE?env.STAGING_TAROT_AI_QA_GRANT_ID:env.RELEASE_TAROT_AI_QA_GRANT_ID)!,p_telegram_id:telegramId,p_client_reading_id:clientReadingId};
  const reserved=await supabase.rpc('reserve_luna24_qa_ai_call',args);
  if(reserved.error||reserved.data?.acquired!==true)throw new Error('qa_budget_limit');
  // On transport failure/unknown usage leave the full reservation held. Never retry.
  const response=await transport({...request,service_tier:'default'},signal);
  if(response.ok){
   const payload:unknown=await response.clone().json();const meter=stagingAiMeterRecord(payload);
   if(meter?.estimated_cost!==null&&meter?.estimated_cost!==undefined){
    const actual=Math.ceil(meter.estimated_cost*1000000);
    if(actual<=12000){const settled=await supabase.rpc('settle_luna24_qa_ai_call',{...args,p_actual_microusd:actual});if(settled.error||settled.data!==true)throw new Error('qa_budget_settlement_failed');}
   }
  }
  return response;
 };
}
