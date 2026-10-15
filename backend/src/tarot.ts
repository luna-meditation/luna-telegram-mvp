import {z} from 'zod';
import {supabase} from './db.js';
import {env} from './config.js';
import {FoundationError} from './personalization.js';
import {getAiPersonalProfile as getPersonalProfile} from './personal-memory.js';
import {tarotInputSchema,tarotRequestHash,buildTarotAiRequest,interpretationSchema,type TarotInput,type TarotInterpretation} from './tarot-policy.js';
import {requestLunaResponse,responseOutputText} from './luna/ai-provider.js';
import {safetyCategory} from './luna-ai-policy.js';
import {stagingAiMeterRecord,type StagingAiMeterRecord} from './staging-ai-meter.js';
import {randomInt} from 'node:crypto';
import {tarotCatalog} from './tarot-policy.js';
import {qaTarotEnabled,qaTarotLimits,qaTarotTransport} from './staging-tarot-budget.js';
export const readingFields='id,client_reading_id,card_id,orientation,intention,question,language,interpretation,status,fallback_reason,created_at,updated_at'+(env.FEATURE_DAILY_CARD_V2||env.FEATURE_TAROT_SPREADS?',reading_kind,cards':'');
export type StoredReading={id:string;client_reading_id:string;card_id:string;orientation:'upright'|'reversed';intention:'general'|'love'|'career'|'growth';question:string;language:'en'|'ru';interpretation:TarotInterpretation|null;status:'local'|'processing'|'ready'|'fallback'|'safety';fallback_reason:string|null;created_at:string;updated_at:string};
export async function generateTarot(input:TarotInput,profile:Parameters<typeof buildTarotAiRequest>[1],transport=requestLunaResponse,onMeter?:(meter:StagingAiMeterRecord)=>Promise<void>,style:'single'|'daily'='single'){
 const request=buildTarotAiRequest(input,profile,env.AI_CHAT_MODEL,env.TAROT_AI_MAX_OUTPUT_TOKENS);
 if(style==='daily')request.instructions+='\nThis is a DAILY CARD, not a requested prediction. Write 100–180 words TOTAL across all six fields in the requested language. Summary: an expressive short heading and one personal reflection. Give a grounded practical thought and exactly one meaningful question. No repeated points, no need to fill every section with multiple sentences.';
 const response=await transport(request,AbortSignal.timeout(env.AI_REQUEST_TIMEOUT_MS));
 if(!response.ok)throw new Error('provider_error');
 const payload=await response.json();
 const meter=stagingAiMeterRecord(payload);
 if(meter&&onMeter)await onMeter(meter);
 // Staging cost evidence only: never log questions, context, responses or keys.
 if(env.STAGING_MODE){
  const value=payload as {model?:unknown;service_tier?:unknown;usage?:{input_tokens?:unknown;output_tokens?:unknown;input_tokens_details?:{cached_tokens?:unknown}}};
  const count=(item:unknown)=>typeof item==='number'&&Number.isSafeInteger(item)&&item>=0?item:null;
  const label=(item:unknown)=>typeof item==='string'&&/^[a-zA-Z0-9._-]{1,80}$/.test(item)?item:null;
  console.info('[Luna staging Tarot usage]',{model:label(value.model),serviceTier:label(value.service_tier),inputTokens:count(value.usage?.input_tokens),cachedInputTokens:count(value.usage?.input_tokens_details?.cached_tokens),outputTokens:count(value.usage?.output_tokens)});
 }
 const text=responseOutputText(payload);if(!text)throw new Error('invalid_response');
 return interpretationSchema.parse(JSON.parse(text));
}
export async function saveTarotReading(telegramId:number,body:unknown,maintenance?:{excludePersonalContext:true;transport:typeof requestLunaResponse;onMeter:(meter:StagingAiMeterRecord)=>Promise<void>}){
 const input=tarotInputSchema.parse(body);
 const safety=safetyCategory(input.question);
 const qaOnly=env.STAGING_MODE&&env.FEATURE_TAROT_SPREAD_AI_QA;
 const canGenerate=input.generate&&env.FEATURE_TAROT_AI&&Boolean(env.OPENAI_API_KEY)&&!safety&&(!qaOnly||qaTarotEnabled(telegramId));
 const limits=qaTarotLimits(telegramId);
 const {data,error}=await supabase.rpc('reserve_luna_tarot_reading',{p_telegram_id:telegramId,p_client_reading_id:input.clientReadingId,p_request_hash:tarotRequestHash(input),p_card_id:input.cardId,p_orientation:input.orientation,p_intention:input.intention,p_question:input.question,p_language:input.language,p_generate:canGenerate,p_daily_limit:limits.daily,p_global_limit:limits.global});
 if(error||!data)throw new FoundationError(503,'history_unavailable','Reading history is unavailable.');
 return completeReservedReading(telegramId,input,data as TarotReservation,maintenance);
}
type TarotReservation={status:string;acquired:boolean;reading?:StoredReading};
type TarotMaintenance={excludePersonalContext:true;transport:typeof requestLunaResponse;onMeter:(meter:StagingAiMeterRecord)=>Promise<void>};
async function completeReservedReading(telegramId:number,input:TarotInput,reserved:TarotReservation,maintenance?:TarotMaintenance,style:'single'|'daily'='single'){
 const safety=safetyCategory(input.question);
 const canGenerate=input.generate&&env.FEATURE_TAROT_AI&&Boolean(env.OPENAI_API_KEY)&&!safety;
 if(reserved.status==='conflict')throw new FoundationError(409,'reading_conflict','The saved reading cannot be changed.');
 if(reserved.status==='deleted'||reserved.status==='already_attempted')throw new FoundationError(410,'reading_deleted','This reading was removed.');
 if(!reserved.reading)throw new FoundationError(503,'history_unavailable','Reading is unavailable.');
 let reading=reserved.reading;
 if(!reserved.acquired&&reading.status==='processing'&&Date.now()-Date.parse(reading.updated_at)>120000){
  const stale=await supabase.from('luna_tarot_readings').update({status:'fallback',fallback_reason:'interrupted',updated_at:new Date().toISOString()}).eq('telegram_id',telegramId).eq('id',reading.id).eq('status','processing').select(readingFields).returns<StoredReading[]>().maybeSingle();
  if(stale.error)throw new FoundationError(503,'history_unavailable','Reading is unavailable.');if(!stale.data)throw new FoundationError(410,'reading_deleted','This reading was removed.');reading=stale.data as StoredReading;
 }
 if(reserved.acquired){
  let interpretation:TarotInterpretation|null=null;let status:StoredReading['status']='fallback';let reason:string|null='provider_error';
  try{const profile=!maintenance?.excludePersonalContext&&env.FEATURE_PERSONALIZATION?await getPersonalProfile(telegramId,input.intention+' '+input.question):null;const baseTransport=maintenance?.transport??requestLunaResponse;const transport=env.STAGING_MODE&&env.FEATURE_TAROT_SPREAD_AI_QA?qaTarotTransport(telegramId,input.clientReadingId,baseTransport):baseTransport;interpretation=await generateTarot(input,profile,transport,maintenance?.onMeter??(async meter=>{
   // Meter every actual response, including invalid/incomplete AI output. No text or preferences.
   const {error:meterError}=await supabase.from('ai_usage').upsert({...meter,telegram_id:telegramId,request_id:`tarot:${input.clientReadingId}`},{onConflict:'telegram_id,request_id'});
   if(meterError)throw new Error('usage_save_failed');
  }),style);status='ready';reason=null;}catch{/* Retain charged reservation on timeout: no automatic paid retry. Never log question/key. */}
  const result=await supabase.from('luna_tarot_readings').update({interpretation,status,fallback_reason:reason,updated_at:new Date().toISOString()}).eq('telegram_id',telegramId).eq('id',reading.id).eq('status','processing').select(readingFields).returns<StoredReading[]>().maybeSingle();
  if(result.error)throw new FoundationError(503,'reading_save_failed','Could not save the interpretation. Do not regenerate this reading.');
  if(!result.data)throw new FoundationError(410,'reading_deleted','This reading was removed.');
  reading=result.data as StoredReading;
 }else if(safety&&reading.status==='local'){
  const result=await supabase.from('luna_tarot_readings').update({status:'safety',fallback_reason:safety,updated_at:new Date().toISOString()}).eq('telegram_id',telegramId).eq('id',reading.id).eq('status','local').select(readingFields).returns<StoredReading[]>().maybeSingle();
  if(result.error)throw new FoundationError(503,'reading_save_failed','Could not save this reading.');
  if(!result.data)throw new FoundationError(410,'reading_deleted','This reading was removed.');reading=result.data as StoredReading;
 }
 return {reading,reason:reserved.status==='limit'?'daily_limit':input.generate&&!canGenerate&&!safety?'ai_unavailable':null};
}
export async function openDailyTarot(telegramId:number,body:unknown){
 if(!env.FEATURE_DAILY_CARD_V2)throw new FoundationError(404,'feature_disabled','Daily card is unavailable.');
 const request=z.object({language:z.enum(['en','ru']),generate:z.boolean().default(false),expectedDay:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict().refine(v=>!v.generate||Boolean(v.expectedDay)).parse(body);
 const candidate=tarotCatalog[randomInt(tarotCatalog.length)];
 const canGenerate=request.generate&&env.FEATURE_TAROT_AI&&Boolean(env.OPENAI_API_KEY);
 const {data,error}=await supabase.rpc('reserve_luna_daily_card',{p_telegram_id:telegramId,p_card_id:candidate.id,p_orientation:randomInt(2)?'reversed':'upright',p_language:request.language,p_generate:canGenerate,p_daily_limit:env.TAROT_AI_DAILY_LIMIT,p_global_limit:env.TAROT_AI_GLOBAL_DAILY_LIMIT,p_expected_day:request.expectedDay??null});
 if(error||!data)throw new FoundationError(503,'daily_unavailable','Could not open your daily card.');
 const value=data as TarotReservation&{day:string;resetsAt:string};
 if(value.status==='day_changed')throw new FoundationError(409,'daily_changed','A new daily card is available.');
 if(!value.reading)throw new FoundationError(value.status==='deleted'?410:503,value.status==='deleted'?'reading_deleted':'daily_unavailable','The daily card is unavailable.');
 // Never send the new random candidate to AI after an idempotent reservation.
 const r=value.reading;const input=tarotInputSchema.parse({clientReadingId:r.client_reading_id,cardId:r.card_id,orientation:r.orientation,intention:r.intention,question:r.question,language:r.language,generate:request.generate});
 const result=await completeReservedReading(telegramId,input,value,undefined,'daily');
 return {...result,day:value.day,resetsAt:value.resetsAt,timezone:'UTC' as const};
}
export async function listTarotReadings(telegramId:number,offset:unknown){
 const start=z.coerce.number().int().min(0).max(10000).parse(offset??0);
 const {data,error}=await supabase.from('luna_tarot_readings').select(readingFields).eq('telegram_id',telegramId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+19).returns<StoredReading[]>();
 if(error)throw new FoundationError(503,'history_unavailable','Reading history is unavailable.');return {readings:data as StoredReading[],nextOffset:data.length===20?start+20:null};
}
export async function getTarotReading(telegramId:number,id:unknown){
 const {data,error}=await supabase.from('luna_tarot_readings').select(readingFields).eq('telegram_id',telegramId).eq('id',z.string().uuid().parse(id)).returns<StoredReading[]>().maybeSingle();
 if(error)throw new FoundationError(503,'history_unavailable','Reading history is unavailable.');if(!data)throw new FoundationError(404,'reading_not_found','Reading not found.');return data as StoredReading;
}
export async function deleteTarotReading(telegramId:number,id:unknown){
 const {error}=await supabase.from('luna_tarot_readings').delete().eq('telegram_id',telegramId).eq('id',z.string().uuid().parse(id));
 if(error)throw new FoundationError(503,'history_unavailable','Could not delete this reading.');
}
