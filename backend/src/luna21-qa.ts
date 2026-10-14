import {createHash,randomInt} from 'node:crypto';
import {env} from './config.js';
import {supabase} from './db.js';
import {generateTarot,getTarotReading} from './tarot.js';
import {generateTarotSpread} from './tarot-spreads.js';
import {tarotCatalog,tarotRequestHash,tarotInputSchema} from './tarot-policy.js';
import {spreadInputSchema,spreadRequestHash} from './tarot-spread-policy.js';
import {requestLunaResponse} from './luna/ai-provider.js';
import type {StagingAiMeterRecord} from './staging-ai-meter.js';
/** Owner-authorized one-off job. No HTTP entry, no fake Telegram data, no billing. */
export async function runLuna21Qa(){
 if(!env.LUNA21_QA_ENABLED)return;
 const user=env.LUNA21_QA_TELEGRAM_ID,run=env.LUNA21_QA_RUN_ID;
 if(!user||!run||env.STAGING_MODE||new URL(env.SUPABASE_URL).hostname!=='vkcdtasbdoeilgfucoax.supabase.co'||env.AI_CHAT_MODEL!=='gpt-5-mini'||!env.OPENAI_API_KEY||!env.FEATURE_TAROT_HISTORY||!env.FEATURE_TAROT_AI||!env.FEATURE_DAILY_CARD_V2)throw new Error('Luna 2.1 QA preflight rejected');
 const fingerprint=async()=>{const rows=await Promise.all(['users','moon_gardens','luna_personal_profiles'].map(t=>supabase.from(t).select('*').eq('telegram_id',user).maybeSingle()));if(rows.some(r=>r.error)||!rows[0].data)throw new Error('QA preservation unavailable');return createHash('sha256').update(JSON.stringify(rows.map(r=>r.data))).digest('hex');};
 const before=await fingerprint();let spent=0,calls=0;const results=[];
 // Availability check is non-generative and bill-free. Never expose key or body.
 const available=await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(env.AI_CHAT_MODEL)}`,{headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(15000)});
 if(!available.ok)throw new Error('QA model availability preflight failed');
 // Durable one-off grant marker. A container restart cannot run three more calls.
 const claim=await supabase.from('luna_tarot_attempts').insert({telegram_id:user,client_reading_id:run});
 if(claim.error){if(claim.error.code==='23505'){console.info('[Luna 2.1 authorized QA]',{status:'ALREADY_RESERVED',providerCalls:0});return;}throw new Error('QA claim unavailable');}
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
  const hex=createHash('sha256').update(`luna21:${run}:${kind}`).digest('hex');
  let client=`${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
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
   if(JSON.stringify(reopened.interpretation)!==JSON.stringify(interpretation))throw new Error('QA cache mismatch');
   results.push({kind,readingId:id,costUsd:cost,cachedReopen:true});
  }catch(error){await supabase.from('luna_tarot_readings').update({status:'fallback',fallback_reason:'qa_interrupted',updated_at:new Date().toISOString()}).eq('telegram_id',user).eq('id',id).eq('status','processing');throw error;}
 }
 if(before!==await fingerprint())throw new Error('QA preservation mismatch');
 console.info('[Luna 2.1 authorized QA]',{status:'PASS',providerCalls:calls,estimatedCostUsd:spent,preservedProfileBalanceEntitlement:true,results});
}
