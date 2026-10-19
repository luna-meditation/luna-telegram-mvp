import {z} from 'zod';
import {env} from './config.js';
import {supabase} from './db.js';
import {FoundationError} from './personalization.js';
import {getAiPersonalProfile as getPersonalProfile} from './personal-memory.js';
import {spreadInputSchema,spreadRequestHash,buildSpreadAiRequest,spreadInterpretationSchema,spreadPositions,type SpreadInput} from './tarot-spread-policy.js';
import {requestLunaResponse,responseOutputText} from './luna/ai-provider.js';
import {stagingAiMeterRecord,type StagingAiMeterRecord} from './staging-ai-meter.js';
import {safetyCategory} from './luna-ai-policy.js';
import {readingFields,type StoredReading} from './tarot.js';
import {generateTarot} from './tarot.js';
import {tarotInputSchema,tarotRequestHash,type TarotInput} from './tarot-policy.js';
import {qaTarotEnabled,qaTarotLimits,qaTarotTransport} from './staging-tarot-budget.js';
import {validateTarotV2} from './tarot-interpretation-v2.js';
import {neutralRussianInterpretation} from './luna/russian-address.js';
import {permittedPersonalContext} from './personalization-policy.js';
import {withAiOperation} from './luna32-ai-accounting.js';
import {readLuna32Settings,hasBetaFeature} from './luna32-runtime.js';
import {reserveContractTarot} from './luna4-tarot.js';
export async function generateTarotSpread(input:SpreadInput,profile:Parameters<typeof buildSpreadAiRequest>[1],transport=requestLunaResponse,onMeter?:(meter:StagingAiMeterRecord)=>Promise<void>){
 const response=await transport(buildSpreadAiRequest(input,profile,env.AI_CHAT_MODEL),AbortSignal.timeout(env.AI_REQUEST_TIMEOUT_MS));
 if(!response.ok)throw new Error('provider_error');const payload=await response.json(),meter=stagingAiMeterRecord(payload);if(meter&&onMeter)await onMeter(meter);
 const text=responseOutputText(payload);if(!text)throw new Error('invalid_response');
 const result=spreadInterpretationSchema.parse(neutralRussianInterpretation(JSON.parse(text),input.language,permittedPersonalContext(profile),input.question));
 if('version' in result)return validateTarotV2(result,input.cards.map((c,i)=>({...c,position:spreadPositions[input.language][input.kind][i]})));
 if(result.cardInsights.length!==input.cards.length||result.cardInsights.some((c,i)=>c.cardId!==input.cards[i].cardId))throw new Error('wrong_spread_cards');
 return result;
}
export async function saveTarotSpread(telegramId:number,body:unknown){
 if(!env.FEATURE_TAROT_SPREADS)throw new FoundationError(404,'feature_disabled','Spreads are unavailable.');
 const parsed=z.object({reading:spreadInputSchema,orderId:z.string().uuid().optional()}).strict().parse(body);
 return withAiOperation(supabase,telegramId,'tarot:'+parsed.reading.clientReadingId,()=>saveExtendedReading(telegramId,parsed.reading,spreadRequestHash(parsed.reading),parsed.orderId),result=>result.reading.status==='ready',parsed.orderId?{readingOrder:{id:parsed.orderId,kind:parsed.reading.kind}}:undefined);
}
export async function savePaidSingleTarot(telegramId:number,body:unknown){
 if(!env.FEATURE_TAROT_PAID_READINGS)throw new FoundationError(404,'feature_disabled','This offer is unavailable.');
 const parsed=z.object({reading:tarotInputSchema,orderId:z.string().uuid()}).strict().parse(body),r=parsed.reading;
 return withAiOperation(supabase,telegramId,'tarot:'+r.clientReadingId,()=>saveExtendedReading(telegramId,{...r,kind:'single',cards:[{cardId:r.cardId,orientation:r.orientation}]},tarotRequestHash(r),parsed.orderId),result=>result.reading.status==='ready',{readingOrder:{id:parsed.orderId,kind:'single'}});
}
async function saveExtendedReading(telegramId:number,input:SpreadInput|(TarotInput&{kind:'single';cards:Array<{cardId:string;orientation:'upright'|'reversed'}>}),requestHash:string,orderId?:string){
 // Explicit QA-only adapter: separate pinned staging/release grants and limits.
 // No entitlement changes or wallet calls; release access is owner-only.
 const betaSettings=env.LUNA32_ENABLED?await readLuna32Settings(supabase):null;
 const freeBeta=Boolean(betaSettings&&hasBetaFeature(betaSettings,'tarot'));
 const freeQa=(qaTarotEnabled(telegramId)||freeBeta)&&input.kind!=='single';
 const limits=qaTarotLimits(telegramId);
 if(env.LUNA32_ENABLED)limits.daily=500;
 const safety=safetyCategory(input.question),generate=input.generate&&env.FEATURE_TAROT_AI&&Boolean(env.OPENAI_API_KEY)&&!safety&&(env.FEATURE_PREMIUM_V2||env.FEATURE_TAROT_PAID_READINGS||freeQa);
 const {data,error}=await reserveContractTarot(supabase,{p_telegram_id:telegramId,p_client_reading_id:input.clientReadingId,p_request_hash:requestHash,p_kind:input.kind,p_cards:input.cards,p_intention:input.intention,p_question:input.question,p_language:input.language,p_generate:generate,p_order_id:env.FEATURE_TAROT_PAID_READINGS?orderId??null:null,p_premium_allowed:env.FEATURE_PREMIUM_V2,p_daily_limit:env.LUNA32_ENABLED?500:env.FEATURE_PREMIUM_V2||env.FEATURE_TAROT_PAID_READINGS?10:env.TAROT_AI_DAILY_LIMIT,p_global_limit:env.TAROT_AI_GLOBAL_DAILY_LIMIT},env.LUNA34_COMMERCIAL_QUOTAS_ENABLED);
 if(error||!data)throw new FoundationError(503,'history_unavailable','Could not save this reading.');
 let reserved=data as {status:string;acquired:boolean;reading?:StoredReading};
 if(freeQa&&generate&&reserved.reading?.status==='local'&&!reserved.acquired){
  const qa=await supabase.rpc('reserve_luna_tarot_reading',{p_telegram_id:telegramId,p_client_reading_id:input.clientReadingId,p_request_hash:requestHash,p_card_id:input.cards[0].cardId,p_orientation:input.cards[0].orientation,p_intention:input.intention,p_question:input.question,p_language:input.language,p_generate:true,p_daily_limit:limits.daily,p_global_limit:limits.global});
  if(qa.error||!qa.data)throw new FoundationError(503,'history_unavailable','Your reading remains saved.');reserved=qa.data as typeof reserved;
 }
 if(!reserved.reading)throw new FoundationError(reserved.status==='conflict'?409:410,'reading_unavailable','This reading cannot be changed.');
 let reading=reserved.reading;
 if(safety&&reading.status==='local'){
  const saved=await supabase.from('luna_tarot_readings').update({status:'safety',fallback_reason:safety,updated_at:new Date().toISOString()}).eq('telegram_id',telegramId).eq('id',reading.id).eq('status','local').select(readingFields).returns<StoredReading[]>().maybeSingle();
  if(saved.error||!saved.data)throw new FoundationError(503,'reading_save_failed','Could not save this reading.');
  return {reading:saved.data,reason:'safety'};
 }
 if(!reserved.acquired&&reading.status==='processing'&&Date.now()-Date.parse(reading.updated_at)>120000){
  const stale=await supabase.rpc('settle_luna_tarot_spread',{p_telegram_id:telegramId,p_client_reading_id:input.clientReadingId,p_status:'fallback',p_interpretation:null});
  if(stale.error||!stale.data)throw new FoundationError(503,'history_unavailable','Your reading remains saved.');reading=stale.data as StoredReading;
 }
 if(reserved.acquired){
  let interpretation:unknown=null,status='fallback';
  try{const profile=env.FEATURE_PERSONALIZATION?await getPersonalProfile(telegramId,input.intention+' '+input.question):null;const meter=async(value:StagingAiMeterRecord)=>{const {error:e}=await supabase.from('ai_usage').upsert({...value,telegram_id:telegramId,request_id:`tarot:${input.clientReadingId}`},{onConflict:'telegram_id,request_id'});if(e)throw new Error('usage_save_failed');};const transport=!freeBeta&&qaTarotEnabled(telegramId)?qaTarotTransport(telegramId,input.clientReadingId):requestLunaResponse;interpretation=input.kind==='single'?await generateTarot(input,profile,transport,meter):await generateTarotSpread(input,profile,transport,meter);status='ready';}catch{/* No implicit retries or additional debit. */}
  const update=await supabase.rpc('settle_luna_tarot_spread',{p_telegram_id:telegramId,p_client_reading_id:input.clientReadingId,p_status:status,p_interpretation:interpretation});
  if(update.error||!update.data)throw new FoundationError(503,'reading_save_failed','Your reading is saved. Please reopen it.');reading=update.data as StoredReading;
 }
 return {reading,reason:reserved.status==='access_required'||input.generate&&!generate&&!safety?'access_required':reserved.status==='limit'?'daily_limit':safety?'safety':null};
}
