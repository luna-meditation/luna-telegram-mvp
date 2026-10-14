import {createHash,randomInt} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {env} from './config.js';
import {supabase} from './db.js';
import {generateTarot,getTarotReading} from './tarot.js';
import {generateTarotSpread} from './tarot-spreads.js';
import {tarotCatalog,tarotRequestHash,tarotInputSchema} from './tarot-policy.js';
import {spreadInputSchema,spreadRequestHash} from './tarot-spread-policy.js';
import {requestLunaResponse} from './luna/ai-provider.js';
import type {StagingAiMeterRecord} from './staging-ai-meter.js';
export const qaCacheMatches=(expected:unknown,actual:unknown)=>isDeepStrictEqual(expected,actual);
export function qaUsedBudget(rows:Array<{estimated_cost:unknown;request_status:string;model:string}>){
 if(rows.length>3||rows.some(r=>r.request_status!=='success'||!r.model.startsWith('gpt-5-mini')||r.estimated_cost===null||!Number.isFinite(Number(r.estimated_cost))||Number(r.estimated_cost)<0))throw new Error('QA prior cost cannot be verified');
 const spent=rows.reduce((n,r)=>n+Number(r.estimated_cost),0);if(spent>.03)throw new Error('QA prior budget exceeded');return {spent,calls:rows.length};
}
function qaClient(run:string,kind:string){const hex=createHash('sha256').update(`luna21:${run}:${kind}`).digest('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;}
/** Owner-authorized one-off job. No HTTP entry, no fake Telegram data, no billing. */
export async function runLuna21Qa(){
 if(!env.LUNA21_QA_ENABLED)return;
 const user=env.LUNA21_QA_TELEGRAM_ID,run=env.LUNA21_QA_RUN_ID;
 if(!user||!run||env.STAGING_MODE||new URL(env.SUPABASE_URL).hostname!=='vkcdtasbdoeilgfucoax.supabase.co'||env.AI_CHAT_MODEL!=='gpt-5-mini'||!env.OPENAI_API_KEY||!env.FEATURE_TAROT_HISTORY||!env.FEATURE_TAROT_AI||!env.FEATURE_DAILY_CARD_V2)throw new Error('Luna 2.1 QA preflight rejected');
 const fingerprint=async()=>{const rows=await Promise.all(['users','moon_gardens','luna_personal_profiles'].map(t=>supabase.from(t).select(t==='users'?'telegram_id,lifetime_access,active_until,free_used,journey_status_rank':'*').eq('telegram_id',user).maybeSingle()));if(rows.some(r=>r.error)||!rows[0].data)throw new Error('QA preservation unavailable');return createHash('sha256').update(JSON.stringify(rows.map(r=>r.data))).digest('hex');};
 const before=await fingerprint();let spent=0,calls=0;const results=[];
 // Availability check is non-generative and bill-free. Never expose key or body.
 const available=await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(env.AI_CHAT_MODEL)}`,{headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(15000)});
 if(!available.ok)throw new Error('QA model availability preflight failed');
 // Durable one-off grant marker. A container restart cannot run three more calls.
 const claim=await supabase.from('luna_tarot_attempts').insert({telegram_id:user,client_reading_id:run});
 if(claim.error){if(claim.error.code==='23505'){if(!env.LUNA21_QA_RESUME){console.info('[Luna 2.1 authorized QA]',{status:'ALREADY_RESERVED',providerCalls:0});return;}}else throw new Error('QA claim unavailable');}
 const grant=await supabase.from('luna_tarot_attempts').select('created_at').eq('telegram_id',user).eq('client_reading_id',run).single();
 if(grant.error||!grant.data||grant.data.created_at.slice(0,10)!==new Date().toISOString().slice(0,10))throw new Error('QA grant day changed; no resume');
 const daily=await supabase.from('luna_daily_cards').select('client_reading_id').eq('telegram_id',user).eq('reading_day',grant.data.created_at.slice(0,10)).maybeSingle();
 if(daily.error)throw new Error('QA daily registry unavailable');
 const ids=[qaClient(run,'three'),qaClient(run,'five'),...(daily.data?[daily.data.client_reading_id]:[])].map(c=>`tarot:${c}`);
 const prior=await supabase.from('ai_usage').select('estimated_cost,request_status,model').eq('telegram_id',user).in('request_id',ids).gte('created_at',grant.data.created_at);
 if(prior.error)throw new Error('QA prior meter unavailable');({spent,calls}=qaUsedBudget(prior.data??[]));
 const previousCalls=calls;
 const transport:typeof requestLunaResponse=async(body,signal)=>{
  if(!body||typeof body!=='object')throw new Error('QA request refused');
  const value=body as Record<string,unknown>,limit=Number(value.max_output_tokens);
  if(!Number.isSafeInteger(limit)||limit<1||limit>3600)throw new Error('QA token limit refused');
  const request={...value,service_tier:'default',max_output_tokens:limit};
  const inputUpperBound=Buffer.byteLength(JSON.stringify(request));
  const maximumCost=(inputUpperBound*.25+request.max_output_tokens*2)/1000000;
  if(calls>=3||inputUpperBound>12000||spent+maximumCost>.03)throw new Error('QA budget refused');
  calls++;return requestLunaResponse(request,signal);
 };
 for(const kind of ['daily','three','five'] as const){
  let client=qaClient(run,kind);
  const existing=await supabase.from('luna_tarot_readings').select('id,status,request_hash').eq('telegram_id',user).eq('client_reading_id',client).maybeSingle();
  if(existing.error)throw new Error('QA storage unavailable');
  if(existing.data){if(existing.data.status!=='ready')throw new Error('QA interrupted; no retry allowed');results.push({kind,readingId:existing.data.id,cached:true});continue;}
  const pool=[...tarotCatalog];const size=kind==='daily'?1:kind==='three'?3:5;
  let cards=Array.from({length:size},()=>{const card=pool.splice(randomInt(pool.length),1)[0];return {cardId:card.id,orientation:randomInt(2)?'reversed' as const:'upright' as const};});
  const common={clientReadingId:client,intention:kind==='daily'?'general' as const:'growth' as const,question:kind==='daily'?'':kind==='three'?'What small mindful step could help me move toward my goal with more calm?':'Какой небольшой осознанный шаг поможет мне спокойнее двигаться к своей цели?',language:kind==='three'?'en' as const:'ru' as const,generate:true};
  let single=tarotInputSchema.parse({...common,...cards[0]});const spread=kind==='daily'?null:spreadInputSchema.parse({...common,kind,cards});
  const requestHash=spread?spreadRequestHash(spread):tarotRequestHash(single);
  const reserved=kind==='daily'
   ?await supabase.rpc('reserve_luna_daily_card',{p_telegram_id:user,p_card_id:cards[0].cardId,p_orientation:cards[0].orientation,p_language:common.language,p_generate:true,p_daily_limit:10,p_global_limit:env.TAROT_AI_GLOBAL_DAILY_LIMIT,p_expected_day:new Date().toISOString().slice(0,10)})
   :await supabase.rpc('reserve_luna_tarot_reading',{p_telegram_id:user,p_client_reading_id:client,p_request_hash:requestHash,p_card_id:cards[0].cardId,p_orientation:cards[0].orientation,p_intention:common.intention,p_question:common.question,p_language:common.language,p_generate:true,p_daily_limit:10,p_global_limit:env.TAROT_AI_GLOBAL_DAILY_LIMIT});
  if(reserved.error||!reserved.data)throw new Error('QA reservation unavailable');
  const reservation=reserved.data as {acquired:boolean;reading?:{id:string;status:string;client_reading_id:string;card_id:string;orientation:'upright'|'reversed';language:'en'|'ru';intention:string;question:string}};
  if(kind==='daily'&&reservation.reading){
   const r=reservation.reading;client=r.client_reading_id;cards=[{cardId:r.card_id,orientation:r.orientation}];
   single=tarotInputSchema.parse({clientReadingId:client,...cards[0],language:r.language,intention:r.intention,question:r.question,generate:true});
   if(!reservation.acquired&&r.status==='ready'){await getTarotReading(user,r.id);results.push({kind,readingId:r.id,cached:true});continue;}
  }
  if(!reservation.acquired||!reservation.reading)throw new Error('QA reservation denied; no retry');
  const id=reservation.reading.id;let cost:number|null=null;
  const meter=async(value:StagingAiMeterRecord)=>{if(value.estimated_cost===null)throw new Error('Unknown QA cost');cost=value.estimated_cost;spent+=cost;const result=await supabase.from('ai_usage').upsert({...value,telegram_id:user,request_id:`tarot:${client}`},{onConflict:'telegram_id,request_id'});if(result.error||spent>.03)throw new Error('QA cost tracking failed');};
  try{
   const interpretation=spread?await generateTarotSpread(spread,null,transport,meter):await generateTarot(single,null,transport,meter,'daily');
   const saved=await supabase.from('luna_tarot_readings').update({status:'ready',interpretation,reading_kind:kind,cards,updated_at:new Date().toISOString()}).eq('telegram_id',user).eq('id',id).eq('status','processing');if(saved.error)throw new Error('QA result save failed');
   const reopened=await getTarotReading(user,id);
   if(!qaCacheMatches(reopened.interpretation,interpretation))throw new Error('QA cache mismatch');
   results.push({kind,readingId:id,costUsd:cost,cachedReopen:true});
  }catch(error){await supabase.from('luna_tarot_readings').update({status:'fallback',fallback_reason:'qa_interrupted',updated_at:new Date().toISOString()}).eq('telegram_id',user).eq('id',id).eq('status','processing');throw error;}
 }
 if(before!==await fingerprint())throw new Error('QA preservation mismatch');
 console.info('[Luna 2.1 authorized QA]',{status:'PASS',providerCalls:calls,newProviderCalls:calls-previousCalls,estimatedCostUsd:spent,preservedProfileBalanceEntitlement:true,results});
}
