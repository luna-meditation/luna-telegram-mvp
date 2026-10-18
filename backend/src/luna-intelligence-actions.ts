import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {toolOperationId} from './luna40-actions.js';
import {resolveLunaDestination,type NavigationAvailability,type LunaDestinationId} from './luna41-navigation.js';
import {intelligenceActionInputs,type IntelligenceCommand} from './luna-intelligence-policy.js';
import {isIntelligenceAttachment,type IntelligenceActionId,type IntelligenceAttachment,type IntelligenceLanguage,type IntelligenceMetadata} from './luna-intelligence-contract.js';

type Usage={limit:number;remaining:number;resetAt:string};
type Eligibility={allowed:boolean;source:string;required:number;shortfall:number};
type Options={features:NavigationAvailability&{central:boolean;spreads:boolean};usage:(owner:number)=>Promise<Usage>;eligibility:(owner:number,kind:'single'|'three'|'five')=>Promise<Eligibility>;recommendMeditation?:(owner:number,message:string,language:IntelligenceLanguage)=>Promise<{id:string;title:string}>;safety?:(language:IntelligenceLanguage,category:'self_harm'|'medical_emergency'|'violence')=>string};
export type PreparedIntelligenceAction={action:IntelligenceActionId;attachment:IntelligenceAttachment|null;navigation:{destination:LunaDestinationId;operationId:string}|null;content:string};
const fields='id,conversation_id,request_id,role,content,metadata,created_at';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unavailable=()=>new FoundationError(503,'action_unavailable','The requested action is still available to retry.');
export function createIntelligenceActionService(db:SupabaseClient,options:Options){
 async function owned(owner:number,id:string){const r=await db.from('ai_conversations').select('id').eq('telegram_id',owner).eq('id',id).eq('status','active').maybeSingle();if(r.error)throw unavailable();if(!r.data)throw new FoundationError(404,'conversation_not_found','Open the original conversation.');}
 return {
  async prepare(owner:number,requestId:string,language:IntelligenceLanguage,command:IntelligenceCommand,sourceMessageId?:string):Promise<PreparedIntelligenceAction>{
   if(!Number.isSafeInteger(owner)||owner<=0)throw new FoundationError(403,'owner_required','Open Luna inside Telegram.');
   intelligenceActionInputs[command.action].parse(command.input);
   if(!options.features.central)throw new FoundationError(404,'feature_disabled','This action is unavailable.');
   const operationId=toolOperationId(owner,requestId,command.action,JSON.stringify(command.input));
   const base={version:1 as const,id:operationId,operationId,action:command.action,status:'AUTHORIZED' as const,access:'user_action' as const};
   let attachment:IntelligenceAttachment|null=null,navigation:PreparedIntelligenceAction['navigation']=null,content='';
   const en=language==='en';
   if(command.action==='safety.support'){
    const p=intelligenceActionInputs['safety.support'].parse(command.input);if(!options.safety)throw unavailable();content=options.safety(language,p.category);
   }else if(command.action==='meditation.recommend'){
    const p=intelligenceActionInputs['meditation.recommend'].parse(command.input);if(!options.recommendMeditation)throw unavailable();const chosen=await options.recommendMeditation(owner,p.goal,language);attachment={...base,type:'meditation',payload:{meditationId:chosen.id}};content=en?`Here is ${chosen.title}. Tap its card to open the player or check available access. Playback starts only when you choose Play.`:`Вот «${chosen.title}». Нажми на карточку, чтобы открыть плеер или проверить доступ. Аудио начнётся только после нажатия Play.`;
   }else if(command.action==='tarot.start'){
    const p=intelligenceActionInputs['tarot.start'].parse(command.input);
    if(!options.features.tarot_history||p.kind&&p.kind!=='single'&&!options.features.spreads)throw new FoundationError(404,'spreads_unavailable','This spread is unavailable.');
    const eligibility=await options.eligibility(owner,p.kind??'single');
    attachment={...base,type:'tarot_reading',access:eligibility.required>0?'confirmation_required':'user_action',payload:{stage:'choose',kind:p.kind,clientReadingId:toolOperationId(owner,requestId,'tarot.draw',JSON.stringify({kind:p.kind})),intention:p.intention,question:p.question,...(sourceMessageId?{originMessageId:sourceMessageId}:{})}};
    content=p.kind?(en?`Choose ${p.kind==='five'?5:p.kind==='three'?3:1} ${p.kind==='single'?'card':'cards'} below. Your reading stays in this conversation.`:`Выбери ${p.kind==='five'?'пять карт':p.kind==='three'?'три карты':'одну карту'} ниже. Расклад останется в этом разговоре.`):(en?'Choose the spread below. There is no need to leave this conversation.':'Выбери расклад ниже — переходить на другой экран не нужно.');
   }else if(command.action==='breathing.start'){
    const p=intelligenceActionInputs['breathing.start'].parse(command.input);attachment={...base,type:'breathing_session',payload:p};
    content=en?'Start whenever you are ready. Pause or stop at any time.':'Начни, когда будет удобно. Можно поставить на паузу или остановиться в любой момент.';
   }else if(command.action==='settings.language'||command.action==='cosmos.open'||command.action==='journal.open'||command.action==='navigation.open'){
    const destination=command.action==='navigation.open'?intelligenceActionInputs['navigation.open'].parse(command.input).destination:command.action==='settings.language'?'language':command.action==='cosmos.open'?'cosmos':'journal';
    const item=resolveLunaDestination(destination,options.features);if(!item)throw new FoundationError(404,'destination_unavailable','This destination is unavailable.');
    navigation={destination,operationId};content=en?`Open ${item.en} below.`:`Открой раздел «${item.ru}» кнопкой ниже.`;
   }else if(command.action==='capability.unavailable'){
    const p=intelligenceActionInputs['capability.unavailable'].parse(command.input);
    content=p.capability==='file_generation'?(en?'I cannot create a downloadable file in Luna yet. I can help organize the content here so you can copy it.':'Пока я не умею создавать скачиваемые файлы внутри Luna. Могу помочь со структурой и содержанием здесь, чтобы ты мог их скопировать.'):(en?'Luna does not have a verified calculation engine for that system yet. We can explore your calculated Western chart or reflect without inventing a calculation.':'В Luna пока нет проверенного расчётного модуля для этой системы. Можем обсудить рассчитанную западную карту или поразмышлять без выдуманных расчётов.');
   }else throw new FoundationError(422,'action_handler_required','Use the verified application control for this action.');
   if(attachment&&!isIntelligenceAttachment(attachment))throw new FoundationError(503,'action_payload_invalid','The action could not be verified.');
   return{action:command.action,attachment,navigation,content};
  },
  async message(owner:number,input:{requestId:string;conversationId?:string;message:string;language:IntelligenceLanguage},command:IntelligenceCommand){
   if(!Number.isSafeInteger(owner)||owner<=0)throw new FoundationError(403,'owner_required','Open Luna inside Telegram.');
   const id=toolOperationId(owner,input.requestId,'intelligence.assistant','{}'),hash=digest({conversationId:input.conversationId??null,message:input.message,language:input.language,action:command.action,input:command.input});
   const prior=await db.from('ai_messages').select(fields).eq('telegram_id',owner).eq('id',id).maybeSingle();if(prior.error)throw unavailable();
   if(prior.data){await owned(owner,prior.data.conversation_id);if(prior.data.metadata?.intelligence?.requestHash!==hash)throw new FoundationError(409,'action_conflict','Retry the original action or start a new request.');return{conversationId:prior.data.conversation_id,message:prior.data,duplicate:true,requestState:'completed' as const,...await options.usage(owner)};}
   if(input.conversationId)await owned(owner,input.conversationId);
   const prepared=await this.prepare(owner,input.requestId,input.language,command,id);
   const conversationId=input.conversationId??toolOperationId(owner,input.requestId,'intelligence.conversation','{}');
   if(!input.conversationId){const r=await db.from('ai_conversations').upsert({id:conversationId,telegram_id:owner,title:command.action==='tarot.start'?(input.language==='ru'?'Расклад с Луной':'Tarot with Luna'):command.action==='breathing.start'?(input.language==='ru'?'Минута спокойствия':'A moment of calm'):(input.language==='ru'?'Разговор с Луной':'A conversation with Luna'),language:input.language},{onConflict:'id',ignoreDuplicates:true});if(r.error)throw unavailable();await owned(owner,conversationId);}
   const metadata:IntelligenceMetadata={version:1,requestHash:hash,action:command.action,attachments:prepared.attachment?[prepared.attachment]:[]};
   const user=await db.from('ai_messages').upsert({id:toolOperationId(owner,input.requestId,'intelligence.user','{}'),telegram_id:owner,conversation_id:conversationId,request_id:input.requestId,role:'user',content:input.message},{onConflict:'id',ignoreDuplicates:true});if(user.error)throw unavailable();
   const saved=await db.from('ai_messages').upsert({id,telegram_id:owner,conversation_id:conversationId,request_id:input.requestId,role:'assistant',content:prepared.content,metadata:{intelligence:metadata,contextReset:true,...(command.action==='safety.support'?{safetyState:command.input.category}:{}),...(prepared.navigation?{navigation:prepared.navigation}:{}),...(prepared.attachment?.type==='meditation'?{recommendedMeditationId:prepared.attachment.payload.meditationId,meditationAction:{type:'meditation_card',meditationId:prepared.attachment.payload.meditationId}}:{}),...(prepared.attachment?.type==='breathing_session'?{breathing:prepared.attachment.payload,resolvedIntent:'breathing'}:{})}},{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw unavailable();
   const result=await db.from('ai_messages').select(fields).eq('telegram_id',owner).eq('id',id).maybeSingle();if(result.error||!result.data||result.data.metadata?.intelligence?.requestHash!==hash)throw unavailable();
   await db.from('ai_conversations').update({last_message_at:result.data.created_at}).eq('telegram_id',owner).eq('id',conversationId);
   return{conversationId,message:result.data,duplicate:false,requestState:'completed' as const,...await options.usage(owner)};
  }
 };
}
