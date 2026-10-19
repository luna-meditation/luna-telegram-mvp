import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {FoundationError} from './foundation-error.js';
import {toolOperationId} from './luna40-actions.js';
import {cosmosDomainSummary} from './luna42-cosmos-domain.js';
import {potentiallySensitive,containsCredential,type PersonalMemory} from './personal-memory-policy.js';
import {companionSettingsKey,companionPreference} from './companion-policy.js';
import {createHash} from 'node:crypto';
import {dailyEntryVersion,localCalendarDate,solarDailyReflection,type DailyPersonalEntry} from './daily-personal-entry.js';
import type {readPersonalPortrait} from './personal-portrait.js';
import {astrologyEngineMetadata} from './luna30-astrology-engine.js';
export {companionSettingsKey,companionPreference} from './companion-policy.js';
type Data={profile:{display_name?:string|null;ai_context_consent:boolean};memoryEnabled:boolean;memories:PersonalMemory[]};
type StarterMeta={version:1;operationId:string;state:'selected'|'displayed'|'responded'|'dismissed'|'expired';reason:'welcome'|'confirmed_goal';sourceId:string|null;sourceRevision:number|null;selectedAt:string;expiresAt:string};
export function selectCompanionCandidate(data:Data,previous:StarterMeta[],now:number){
 if(!data.memoryEnabled||!data.profile.ai_context_consent||!companionPreference(data.memories).inAppFollowUps)return null;
 const valid=data.memories.filter(m=>m.category==='goals'&&m.confirmation_status==='confirmed'&&m.memory_kind==='fact'&&!m.is_sensitive&&m.memory_key!==companionSettingsKey&&!containsCredential(m.memory_value)&&!potentiallySensitive(m.memory_value)&&now-Date.parse(m.updated_at)<30*86400000);
 return valid.sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).find(m=>!previous.some(p=>p.sourceId===m.id&&(p.state==='dismissed'||now-Date.parse(p.selectedAt)<7*86400000)))??null;
}
export function companionMessage(language:'en'|'ru',name:string|null,candidate:PersonalMemory|null){
 const en=language==='en',chosen=name?.trim().slice(0,60),greeting=en?`Hi${chosen?', '+chosen:''}.`:`Привет${chosen?', '+chosen:''}.`;
 if(candidate){const focus=cosmosDomainSummary(candidate.memory_value).slice(0,180);return greeting+'\n\n'+(en?`You chose to keep this goal in view: “${focus}”. Would it help to return to it today, or is something else more important?`:`Ты выбрал(а) сохранить эту цель: «${focus}». Хочешь вернуться к ней сегодня или сейчас важнее другое?`);}
 return greeting+'\n\n'+(en?'I’m Luna. We can explore what matters to you, reflect through Tarot or your birth chart, or simply talk. What would feel useful today?':'Я Луна. Можем разобраться в том, что тебя волнует, исследовать Таро или твою карту рождения — или просто поговорить. Что сейчас будет полезно?');
}
/** Reuse existing owner-bound conversation/message storage. No second memory
 * store, no private text in telemetry, no provider call and no external push. */
export function createCompanionEngine(db:SupabaseClient,load:(owner:number)=>Promise<Data>,options?:{portrait:(owner:number,localDate:string)=>ReturnType<typeof readPersonalPortrait>}){
 return{
  async open(owner:number,raw:unknown,now=new Date()){
   const input=z.object({operationId:z.string().uuid(),language:z.enum(['en','ru']),conversationId:z.string().uuid().optional(),entryOnly:z.boolean().optional(),timeZone:z.string().max(100).refine(value=>{try{localCalendarDate(new Date(),value);return true;}catch{return false;}},'Use a valid IANA timezone.').default('UTC')}).strict().parse(raw);
   if(!Number.isSafeInteger(owner)||owner<=0)throw new FoundationError(403,'owner_required','Open Luna inside Telegram.');
   if(input.entryOnly){
    // Only an empty entry may request this projection. Never append a daily
    // greeting to an ongoing thread and never create an empty conversation.
    if(input.conversationId)return{conversationId:null,message:null};
    const data=await load(owner),localDate=localCalendarDate(now,input.timeZone),en=input.language==='en';
    const allowed=data.memoryEnabled&&data.profile.ai_context_consent,settings=companionPreference(data.memories);
    const portrait=allowed&&options?await options.portrait(owner,localDate):null;
    const sun=portrait?.chart?.facts.planets.find(p=>p.planet.toLowerCase()==='sun'),english=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    const reflection=portrait&&settings.dailyAstrology?solarDailyReflection({language:input.language,localDate,sunSigns:sun?sun.signs.map(value=>english.indexOf(value)):portrait.dateOnlySun?.sunSigns??[],source:sun?'saved_chart':'date_only_sun'}):null;
    const name=allowed?data.profile.display_name?.trim().slice(0,60):null;
    const key=createHash('sha256').update(JSON.stringify({owner,localDate,timeZone:input.timeZone,language:input.language,epoch:portrait?.persistence.state==='saved'?portrait.persistence.sourceEpoch:null,birthVersion:portrait?.persistence.state==='saved'?portrait.persistence.sectionDigests.astrology:null,version:dailyEntryVersion,calculationVersion:astrologyEngineMetadata.version})).digest('hex');
    let candidate=!reflection?selectCompanionCandidate(data,[],now.getTime()):null;
    if(candidate){const past=await db.from('ai_messages').select('metadata').eq('telegram_id',owner).eq('role','assistant').contains('metadata',{companionStarter:{sourceId:candidate.id}}).order('created_at',{ascending:false}).limit(20);if(past.error)throw new FoundationError(503,'companion_unavailable','Could not verify your follow-up preference.');candidate=selectCompanionCandidate(data,(past.data??[]).map(row=>row.metadata.companionStarter as StarterMeta),now.getTime());}
    const question=reflection?'':candidate?(en?`You chose to keep this goal in view: “${cosmosDomainSummary(candidate.memory_value).slice(0,140)}”. Is that what you would like to talk about, or is something else more important today?`:`У тебя есть сохранённая цель: «${cosmosDomainSummary(candidate.memory_value).slice(0,140)}». Хочешь поговорить о ней или сегодня важнее другое?`):portrait?.birth.available?(en?'What would you like to explore today?':'Что тебе хочется исследовать сегодня?'):(en?'We can simply talk, or explore your personal portrait together — no form required. What matters to you today?':'Можем просто поговорить или вместе исследовать твой личный портрет — без анкеты. Что для тебя сейчас важно?');
    const entry:DailyPersonalEntry={version:1,key,localDate,timeZone:input.timeZone,greeting:en?`Hi${name?', '+name:''}. I’m here.`:`Привет${name?', '+name:''}. Я рядом.`,question,reflection,birthAvailable:Boolean(portrait?.birth.available),hasBirthTime:Boolean(portrait?.birth.hasTime),contextReflectionAllowed:allowed&&settings.symbolicAiContext};
    return{conversationId:null,message:null,entry};
   }
   const day=now.toISOString().slice(0,10),id=toolOperationId(owner,day,'companion.daily','v1');
   const prior=await db.from('ai_messages').select('id,conversation_id,request_id,role,content,metadata,created_at').eq('telegram_id',owner).eq('id',id).maybeSingle();if(prior.error)throw new FoundationError(503,'companion_unavailable','Could not verify the conversation starter.');
   if(prior.data){const meta=prior.data.metadata?.companionStarter as StarterMeta|undefined;return meta?.operationId===input.operationId?{conversationId:prior.data.conversation_id,message:prior.data,cached:true}:{conversationId:null,message:null,cooldownUntil:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString()};}
   const data=await load(owner),previous=await db.from('ai_messages').select('metadata').eq('telegram_id',owner).eq('role','assistant').contains('metadata',{companionStarter:{version:1}}).order('created_at',{ascending:false}).limit(100);
   if(previous.error)throw new FoundationError(503,'companion_unavailable','Could not verify earlier follow-ups.');
   const history=(previous.data??[]).map(m=>m.metadata.companionStarter as StarterMeta),candidate=selectCompanionCandidate(data,history,now.getTime());
   // Returning to an ongoing conversation should not start another generic
   // welcome. Only a permitted relevant follow-up after a quiet interval may
   // be appended to that exact owner-bound thread.
   if(input.conversationId){
    const selected=await db.from('ai_conversations').select('id,status,last_message_at').eq('telegram_id',owner).eq('id',input.conversationId).maybeSingle();
    if(selected.error)throw new FoundationError(503,'companion_unavailable','Could not verify the conversation.');
    if(!selected.data||selected.data.status!=='active')throw new FoundationError(404,'conversation_not_found','Reopen your conversation.');
    if(!candidate||!selected.data.last_message_at||now.getTime()-Date.parse(selected.data.last_message_at)<12*3600000)return{conversationId:null,message:null,cooldownUntil:new Date(now.getTime()+12*3600000).toISOString()};
   }
   const conversationId=input.conversationId??toolOperationId(owner,day,'companion.conversation','v1'),meta:StarterMeta={version:1,operationId:input.operationId,state:'selected',reason:candidate?'confirmed_goal':'welcome',sourceId:candidate?.id??null,sourceRevision:candidate?.revision??null,selectedAt:now.toISOString(),expiresAt:new Date(now.getTime()+86400000).toISOString()};
   const conversation=await db.from('ai_conversations').upsert({id:conversationId,telegram_id:owner,title:input.language==='ru'?'Разговор с Луной':'A conversation with Luna',language:input.language},{onConflict:'id',ignoreDuplicates:true});if(conversation.error)throw new FoundationError(503,'companion_unavailable','Could not open the conversation.');
   const content=companionMessage(input.language,data.profile.display_name??null,candidate),saved=await db.from('ai_messages').upsert({id,conversation_id:conversationId,telegram_id:owner,role:'assistant',content,metadata:{companionStarter:meta}},{onConflict:'id',ignoreDuplicates:true}).select('id,conversation_id,request_id,role,content,metadata,created_at').single();
   // ignoreDuplicates may return no representation when another opening won
   // the primary-key race. Read the owner-bound durable winner, never insert a
   // second greeting or treat an empty representation as a failed save.
   let winner=saved.data;
   if(!winner){const reread=await db.from('ai_messages').select('id,conversation_id,request_id,role,content,metadata,created_at').eq('telegram_id',owner).eq('id',id).maybeSingle();if(reread.error||!reread.data)throw new FoundationError(503,'companion_unavailable','Could not save the conversation starter.');winner=reread.data;}
   if(winner.metadata?.companionStarter?.operationId!==input.operationId)return{conversationId:null,message:null,cooldownUntil:meta.expiresAt};
   return{conversationId:winner.conversation_id,message:winner,cached:!saved.data};
  },
  async acknowledge(owner:number,id:string,raw:unknown){
   z.string().uuid().parse(id);const {state}=z.object({state:z.enum(['displayed','responded','dismissed'])}).strict().parse(raw);
   const found=await db.from('ai_messages').select('metadata').eq('telegram_id',owner).eq('id',id).maybeSingle();if(found.error||!found.data?.metadata?.companionStarter)throw new FoundationError(404,'starter_not_found','This starter is unavailable.');
   const metadata=found.data.metadata,prior=metadata.companionStarter as StarterMeta;
   if(['responded','dismissed','expired'].includes(prior.state))return{state:prior.state};
   const next=Date.parse(prior.expiresAt)<Date.now()?'expired':state;
   const saved=await db.from('ai_messages').update({metadata:{...metadata,companionStarter:{...prior,state:next}}}).eq('telegram_id',owner).eq('id',id).contains('metadata',{companionStarter:{operationId:prior.operationId,state:prior.state}}).select('id');
   if(saved.error||!saved.data?.length)throw new FoundationError(409,'starter_changed','Refresh this conversation before retrying.');return{state:next};
  }
 };
}
