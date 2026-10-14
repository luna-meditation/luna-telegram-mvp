import {z} from 'zod';
import {supabase} from './db.js';
import {env} from './config.js';
import {FoundationError,getPersonalProfile} from './personalization.js';
import {tarotInputSchema,tarotRequestHash,buildTarotAiRequest,interpretationSchema,type TarotInput,type TarotInterpretation} from './tarot-policy.js';
import {requestLunaResponse,responseOutputText} from './luna/ai-provider.js';
import {safetyCategory} from './luna-ai-policy.js';
import {stagingAiMeterRecord,type StagingAiMeterRecord} from './staging-ai-meter.js';
export const readingFields='id,client_reading_id,card_id,orientation,intention,question,language,interpretation,status,fallback_reason,created_at,updated_at';
export type StoredReading={id:string;client_reading_id:string;card_id:string;orientation:'upright'|'reversed';intention:'general'|'love'|'career'|'growth';question:string;language:'en'|'ru';interpretation:TarotInterpretation|null;status:'local'|'processing'|'ready'|'fallback'|'safety';fallback_reason:string|null;created_at:string;updated_at:string};
export async function generateTarot(input:TarotInput,profile:Parameters<typeof buildTarotAiRequest>[1],transport=requestLunaResponse,onMeter?:(meter:StagingAiMeterRecord)=>Promise<void>){
 const response=await transport(buildTarotAiRequest(input,profile,env.AI_CHAT_MODEL,env.TAROT_AI_MAX_OUTPUT_TOKENS),AbortSignal.timeout(env.AI_REQUEST_TIMEOUT_MS));
 if(!response.ok)throw new Error('provider_error');
 const payload=await response.json();
 const meter=env.STAGING_MODE||onMeter?stagingAiMeterRecord(payload):null;
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
 const canGenerate=input.generate&&env.FEATURE_TAROT_AI&&Boolean(env.OPENAI_API_KEY)&&!safety;
 const {data,error}=await supabase.rpc('reserve_luna_tarot_reading',{p_telegram_id:telegramId,p_client_reading_id:input.clientReadingId,p_request_hash:tarotRequestHash(input),p_card_id:input.cardId,p_orientation:input.orientation,p_intention:input.intention,p_question:input.question,p_language:input.language,p_generate:canGenerate,p_daily_limit:env.TAROT_AI_DAILY_LIMIT,p_global_limit:env.TAROT_AI_GLOBAL_DAILY_LIMIT});
 if(error||!data)throw new FoundationError(503,'history_unavailable','Reading history is unavailable.');
 const reserved=data as {status:string;acquired:boolean;reading?:StoredReading};
 if(reserved.status==='conflict')throw new FoundationError(409,'reading_conflict','The saved reading cannot be changed.');
 if(reserved.status==='deleted'||reserved.status==='already_attempted')throw new FoundationError(410,'reading_deleted','This reading was removed.');
 if(!reserved.reading)throw new FoundationError(503,'history_unavailable','Reading is unavailable.');
 let reading=reserved.reading;
 if(!reserved.acquired&&reading.status==='processing'&&Date.now()-Date.parse(reading.updated_at)>120000){
  const stale=await supabase.from('luna_tarot_readings').update({status:'fallback',fallback_reason:'interrupted',updated_at:new Date().toISOString()}).eq('telegram_id',telegramId).eq('id',reading.id).eq('status','processing').select(readingFields).maybeSingle();
  if(stale.error)throw new FoundationError(503,'history_unavailable','Reading is unavailable.');if(!stale.data)throw new FoundationError(410,'reading_deleted','This reading was removed.');reading=stale.data as StoredReading;
 }
 if(reserved.acquired){
  let interpretation:TarotInterpretation|null=null;let status:StoredReading['status']='fallback';let reason:string|null='provider_error';
  try{const profile=!maintenance?.excludePersonalContext&&env.FEATURE_PERSONALIZATION?await getPersonalProfile(telegramId):null;interpretation=await generateTarot(input,profile,maintenance?.transport??requestLunaResponse,maintenance?.onMeter??(env.STAGING_MODE?async meter=>{
   await supabase.from('ai_usage').upsert({...meter,telegram_id:telegramId,request_id:`tarot:${input.clientReadingId}`},{onConflict:'telegram_id,request_id'});
  }:undefined));status='ready';reason=null;}catch{/* Retain charged reservation on timeout: no automatic paid retry. Never log question/key. */}
  const result=await supabase.from('luna_tarot_readings').update({interpretation,status,fallback_reason:reason,updated_at:new Date().toISOString()}).eq('telegram_id',telegramId).eq('id',reading.id).eq('status','processing').select(readingFields).maybeSingle();
  if(result.error)throw new FoundationError(503,'reading_save_failed','Could not save the interpretation. Do not regenerate this reading.');
  if(!result.data)throw new FoundationError(410,'reading_deleted','This reading was removed.');
  reading=result.data as StoredReading;
 }else if(safety&&reading.status==='local'){
  const result=await supabase.from('luna_tarot_readings').update({status:'safety',fallback_reason:safety,updated_at:new Date().toISOString()}).eq('telegram_id',telegramId).eq('id',reading.id).eq('status','local').select(readingFields).maybeSingle();
  if(result.error)throw new FoundationError(503,'reading_save_failed','Could not save this reading.');
  if(!result.data)throw new FoundationError(410,'reading_deleted','This reading was removed.');reading=result.data as StoredReading;
 }
 return {reading,reason:reserved.status==='limit'?'daily_limit':input.generate&&!canGenerate&&!safety?'ai_unavailable':null};
}
export async function listTarotReadings(telegramId:number,offset:unknown){
 const start=z.coerce.number().int().min(0).max(10000).parse(offset??0);
 const {data,error}=await supabase.from('luna_tarot_readings').select(readingFields).eq('telegram_id',telegramId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+19);
 if(error)throw new FoundationError(503,'history_unavailable','Reading history is unavailable.');return {readings:data as StoredReading[],nextOffset:data.length===20?start+20:null};
}
export async function getTarotReading(telegramId:number,id:unknown){
 const {data,error}=await supabase.from('luna_tarot_readings').select(readingFields).eq('telegram_id',telegramId).eq('id',z.string().uuid().parse(id)).maybeSingle();
 if(error)throw new FoundationError(503,'history_unavailable','Reading history is unavailable.');if(!data)throw new FoundationError(404,'reading_not_found','Reading not found.');return data as StoredReading;
}
export async function deleteTarotReading(telegramId:number,id:unknown){
 const {error}=await supabase.from('luna_tarot_readings').delete().eq('telegram_id',telegramId).eq('id',z.string().uuid().parse(id));
 if(error)throw new FoundationError(503,'history_unavailable','Could not delete this reading.');
}
