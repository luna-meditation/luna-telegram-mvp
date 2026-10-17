import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {createAstrologyService} from './luna30-astrology-service.js';

// An explicit UI action, not a model write tool or a paid generation. Existing
// owner-scoped messages hold the state; chart caches remain authoritative.
export const astrologyWorkflowInput=z.object({requestId:z.string().uuid(),conversationId:z.string().uuid().optional(),kind:z.enum(['natal','compatibility']),language:z.enum(['en','ru']),firstProfileId:z.string().uuid().optional(),secondProfileId:z.string().uuid().optional()}).strict().superRefine((v,c)=>{if(v.secondProfileId&&(!v.firstProfileId||v.kind!=='compatibility'||v.firstProfileId===v.secondProfileId))c.addIssue({code:'custom',message:'Select two different profiles'});if(v.firstProfileId&&v.kind==='compatibility'&&!v.secondProfileId)c.addIssue({code:'custom',message:'Select the second profile'});});
const fields='id,conversation_id,request_id,role,content,metadata,created_at';
export function createAstrologyWorkflowService(db:SupabaseClient,enabled:()=>boolean){
 const astrology=createAstrologyService(db,enabled);
 const fail=()=>new FoundationError(503,'context_unavailable','Your conversation remains saved.');
 async function conversation(owner:number,id:string){const r=await db.from('ai_conversations').select('id').eq('telegram_id',owner).eq('id',id).eq('status','active').maybeSingle();if(r.error)throw fail();if(!r.data)throw new FoundationError(404,'conversation_not_found','Conversation not found.');}
 return {async open(owner:number,body:unknown){
  const input=astrologyWorkflowInput.parse(body);if(!enabled())throw new FoundationError(404,'feature_disabled','Astrology is unavailable.');
  // Verifies release flags and owner access even when merely opening selectors.
  const {profiles}=await astrology.list(owner);
  const prior=await db.from('ai_messages').select(fields).eq('telegram_id',owner).eq('id',input.requestId).maybeSingle();if(prior.error)throw fail();
  const id=prior.data?.conversation_id??input.conversationId??input.requestId;
  if(input.conversationId&&id!==input.conversationId)throw new FoundationError(409,'context_conflict','Open the original conversation.');
  if(prior.data){await conversation(owner,id);const w=prior.data.metadata?.astrologyWorkflow;if(!w||w.kind!==input.kind)throw new FoundationError(409,'context_conflict','This action already exists.');if(w.state==='ready'){if(input.firstProfileId&&(w.firstProfileId!==input.firstProfileId||w.secondProfileId!==input.secondProfileId))throw new FoundationError(409,'context_conflict','Start a new comparison to select different profiles.');return{conversationId:id,message:prior.data};}}
  else if(input.conversationId)await conversation(owner,id);
  else{const title=input.kind==='compatibility'?(input.language==='ru'?'Совместимость':'Compatibility'):(input.language==='ru'?'Моя натальная карта':'My natal chart');const r=await db.from('ai_conversations').upsert({id,telegram_id:owner,title,language:input.language},{onConflict:'id',ignoreDuplicates:true});if(r.error)throw fail();await conversation(owner,id);}
  // An explicit request for "my chart" authorizes the one unambiguous self
  // profile, not an arbitrary first profile or somebody else's saved data.
  if(input.kind==='natal'&&!input.firstProfileId){const personal=profiles.filter(p=>p.subject_kind==='self');if(personal.length===1)input.firstProfileId=personal[0].id;}
  const workflow:Record<string,unknown>={version:1,kind:input.kind,state:'selecting'};let attachment:Record<string,string>|null=null;
  if(input.firstProfileId){
   if(!profiles.some(p=>p.id===input.firstProfileId)||input.secondProfileId&&!profiles.some(p=>p.id===input.secondProfileId))throw new FoundationError(404,'birth_profile_not_found','Select one of your saved profiles.');
   const first=await astrology.calculate(owner,input.firstProfileId),second=input.secondProfileId?await astrology.calculate(owner,input.secondProfileId):null;
   if(second)await astrology.compatibility(owner,first.chart.id,second.chart.id);
   Object.assign(workflow,{state:'ready',firstProfileId:input.firstProfileId,...(input.secondProfileId?{secondProfileId:input.secondProfileId}:{}),firstChartId:first.chart.id,...(second?{secondChartId:second.chart.id}:{})});
   attachment={chartId:first.chart.id,...(second?{secondChartId:second.chart.id}:{})};
  }
  const metadata={astrologyWorkflow:workflow,...(attachment?{astrology:attachment}:{contextReset:true})};
  const content=input.language==='ru'?(attachment?'Рассчитанный контекст сохранён в этом разговоре.':'Выберите профили для расчёта. Личные данные остаются в вашем аккаунте.'):(attachment?'The calculated context is saved in this conversation.':'Choose profiles to calculate. Private details stay in your account.');
  const r=prior.data?await db.from('ai_messages').update({metadata,content}).eq('telegram_id',owner).eq('id',input.requestId).contains('metadata',{astrologyWorkflow:{state:'selecting'}}):await db.from('ai_messages').upsert({id:input.requestId,telegram_id:owner,conversation_id:id,request_id:'astrology:'+input.requestId,role:'assistant',content,metadata},{onConflict:'id',ignoreDuplicates:true});if(r.error)throw fail();
  const saved=await db.from('ai_messages').select(fields).eq('telegram_id',owner).eq('id',input.requestId).maybeSingle();if(saved.error||!saved.data)throw fail();
  const w=saved.data.metadata?.astrologyWorkflow;if(!w||w.kind!==input.kind||attachment&&(w.firstChartId!==attachment.chartId||w.secondChartId!==attachment.secondChartId))throw new FoundationError(409,'context_conflict','The selected context changed. Reopen this conversation.');
  return{conversationId:id,message:saved.data};
 }};
}
