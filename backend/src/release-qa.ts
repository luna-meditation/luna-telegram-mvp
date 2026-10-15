import {createHash} from 'node:crypto';
import {env} from './config.js';
import {supabase} from './db.js';
import {saveTarotReading,getTarotReading} from './tarot.js';
import {requestLunaResponse} from './luna/ai-provider.js';
import {boundedQaRequest} from './release-qa-policy.js';
import {qaTarotEnabled} from './staging-tarot-budget.js';
import {openChatTarot,revealChatTarot,hydrateLunaTarotMessages} from './luna24-chat.js';
/** No HTTP entrypoint, no synthetic Telegram credentials, no automatic retries. */
export async function runAuthorizedReleaseQa(){
 if(!env.RELEASE_QA_TAROT_ENABLED)return;
 const user=env.RELEASE_QA_TAROT_TELEGRAM_ID,client=env.RELEASE_QA_TAROT_CLIENT_ID;
 if(env.STAGING_MODE||new URL(env.SUPABASE_URL).hostname!=='vkcdtasbdoeilgfucoax.supabase.co'||!user||!client||!env.FEATURE_TAROT_HISTORY||!env.FEATURE_TAROT_AI||env.AI_CHAT_MODEL!=='gpt-5-mini'||!env.OPENAI_API_KEY)throw new Error('Release QA preflight rejected');
 const fingerprint=async()=>{
  const results=await Promise.all(['users','moon_gardens','luna_personal_profiles'].map(table=>supabase.from(table).select('*').eq('telegram_id',user).maybeSingle()));
  if(results.some(r=>r.error)||!results[0].data)throw new Error('Release QA preservation check unavailable');
  return createHash('sha256').update(JSON.stringify(results.map(r=>r.data))).digest('hex');
 };
 const before=await fingerprint();let calls=0,actualCost:number|null=null;
 if(env.FEATURE_TAROT_RELEASE_AI_QA){
  if(user!==158467796||!qaTarotEnabled(user)||!env.FEATURE_TAROT_SPREADS)throw new Error('Release spread QA denied');
  const input={clientReadingId:client,kind:'three',intention:'growth',question:'Какой небольшой шаг поможет яснее обозначить свой следующий приоритет?',language:'ru'};
  const opened=await openChatTarot(user,input);let message=opened.message;
  for(let index=0;index<3;index++)message=(await revealChatTarot(user,client,{index})).message;
  const hydrated=await hydrateLunaTarotMessages(user,[message]);
  const state=(hydrated[0].metadata as {tarot?:{reading?:{id:string;status:string;interpretation:unknown}}})?.tarot;
  const reading=state?.reading;
  const cached=await openChatTarot(user,input);
  const usage=await supabase.from('ai_usage').select('estimated_cost').eq('telegram_id',user).eq('request_id',`tarot:${client}`).maybeSingle();
  const claim=await supabase.from('luna24_qa_ai_calls').select('actual_microusd,settled_at').eq('grant_id',env.RELEASE_TAROT_AI_QA_GRANT_ID!).eq('client_reading_id',client).maybeSingle();
  if(before!==await fingerprint()||usage.error||claim.error||!claim.data?.settled_at||reading?.status!=='ready'||!reading.interpretation||!cached.message||claim.data.actual_microusd>20000)throw new Error('Release spread QA failed; no retry permitted');
  console.info('[Luna release QA]',{status:'PASS',kind:'three',cachedReopen:true,preservedUserGardenProfile:true,estimatedCostUsd:usage.data?.estimated_cost,readingId:reading.id,conversationId:opened.conversationId});
  return;
 }
 const input={clientReadingId:client,cardId:'the-star',orientation:'upright',intention:'growth',question:'Какой небольшой осознанный шаг поможет мне спокойнее двигаться к своей цели?',language:'ru',generate:true};
 const result=await saveTarotReading(user,input,{excludePersonalContext:true,transport:async(body,signal)=>{
  if(++calls>1)throw new Error('Release QA repeat blocked');
  const {request}=boundedQaRequest(body);return requestLunaResponse(request,signal);
 },onMeter:async meter=>{
  actualCost=meter.estimated_cost;
  const recorded=await supabase.from('ai_usage').upsert({...meter,telegram_id:user,request_id:`tarot:${client}`},{onConflict:'telegram_id,request_id'});
  if(recorded.error)throw new Error('Release QA metering unavailable');
 }});
 const reopened=await getTarotReading(user,result.reading.id);
 const cached=await saveTarotReading(user,input);
 if(before!==await fingerprint())throw new Error('Release QA preservation mismatch');
 if(result.reading.status!=='ready'||!reopened.interpretation||JSON.stringify(reopened.interpretation)!==JSON.stringify(cached.reading.interpretation)||calls>1||actualCost!==null&&actualCost>0.01)throw new Error('Release QA failed; no retry permitted');
 console.info('[Luna release QA]',{status:'PASS',providerCalls:calls,cachedReopen:true,preservedUserGardenProfile:true,estimatedCostUsd:actualCost,readingId:reopened.id});
}
