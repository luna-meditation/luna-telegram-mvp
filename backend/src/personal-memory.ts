import {supabase} from './db.js';
import {env} from './config.js';
import {getPersonalProfile,FoundationError} from './personalization.js';
import {memoryWriteSchema,canonicalMemoryKey,normalizedMemoryValue,potentiallySensitive,containsCredential,type PersonalMemory} from './personal-memory-policy.js';
import {resolvePersonalBirth,assemblePersonalIntelligence} from './personal-context-engine.js';
const fields='id,category,memory_key,memory_value,confirmation_status,memory_kind,is_sensitive,source_type,source_message_id,revision,created_at,updated_at,confirmed_at';
// Reuse canonical profile metadata as a privacy boundary, without deleting chat history.
export async function advanceMemoryContextBoundary(owner:number){
 if(!env.FEATURE_PERSONAL_MEMORY)return;
 const updated_at=new Date().toISOString();
 const changed=await supabase.from('luna_personal_profiles').update({updated_at}).eq('telegram_id',owner).select('telegram_id');
 if(changed.error)throw new FoundationError(503,'memory_unavailable','Could not update memory privacy boundary.');
 if(changed.data?.length)return;
 // A user can manage memory before optional profile setup. Persist only the cutoff.
 const inserted=await supabase.from('luna_personal_profiles').insert({telegram_id:owner,updated_at});
 if(inserted.error?.code==='23505'){
  const raced=await supabase.from('luna_personal_profiles').update({updated_at}).eq('telegram_id',owner).select('telegram_id');
  if(!raced.error&&raced.data?.length)return;
 } else if(!inserted.error)return;
 throw new FoundationError(503,'memory_unavailable','Could not update memory privacy boundary.');
}
export async function getMemoryContextBoundary(owner:number){if(!env.FEATURE_PERSONAL_MEMORY)return undefined;const {data,error}=await supabase.from('luna_personal_profiles').select('updated_at').eq('telegram_id',owner).maybeSingle();if(error)throw new FoundationError(503,'memory_unavailable','Could not verify memory privacy boundary.');return data?.updated_at as string|undefined;}
export async function listPersonalMemories(owner:number){const {data,error}=await supabase.from('user_memories').select(fields).eq('telegram_id',owner).eq('is_active',true).order('updated_at',{ascending:false}).limit(200);if(error)throw new FoundationError(503,'memory_unavailable','Memory is unavailable.');return (data??[]) as PersonalMemory[];}
export async function getUniverse(owner:number){const [memories,profile,{data:user}]=await Promise.all([listPersonalMemories(owner),getPersonalProfile(owner),supabase.from('users').select('first_name,language_code,profile_goals,ai_memory_enabled').eq('telegram_id',owner).maybeSingle()]);return {memories,profile,identity:user?{firstName:user.first_name,language:user.language_code,goals:user.profile_goals??[]}:null,memoryEnabled:Boolean(user?.ai_memory_enabled),contextConsent:profile.ai_context_consent};}
export async function writePersonalMemory(owner:number,body:unknown,id?:string){
 const input=memoryWriteSchema.parse(body);if(/^(name|display_name|preferred_name|language|имя|обращение)$/i.test(canonicalMemoryKey(input.key)))throw new FoundationError(422,'use_profile','Update your chosen name or language in the canonical profile.');
 if(containsCredential(input.value))throw new FoundationError(422,'credentials_forbidden','Never store credentials in personal memory.');
 if(id&&!input.revision)throw new FoundationError(409,'revision_required','Refresh before editing.');if(potentiallySensitive(input.key+' '+input.value)&&!input.sensitiveConsent)throw new FoundationError(422,'sensitive_consent_required','Sensitive information requires separate explicit consent.');
 let sourceType='user_entered',sourceId:string|null=null;
 if(input.sourceMessageId){const {data,error}=await supabase.from('ai_messages').select('id,role,content').eq('telegram_id',owner).eq('id',input.sourceMessageId).maybeSingle();if(error||!data)throw new FoundationError(404,'source_not_found','Source message not found.');if(data.role!=='user'&&(input.category!=='reflections'||input.kind!=='symbolic'))throw new FoundationError(422,'inference_not_fact','AI text may only be saved as a symbolic reflection.');sourceType=data.role==='user'?'user_message':'user_saved_ai_reflection';sourceId=data.id;}
 const existing=await listPersonalMemories(owner),key=canonicalMemoryKey(input.key);if(!id&&existing.length>=200)throw new FoundationError(429,'memory_limit','Review existing memory before adding more.');if(existing.some(r=>r.id!==id&&(canonicalMemoryKey(r.memory_key)===key||(r.category===input.category&&normalizedMemoryValue(r.memory_value)===normalizedMemoryValue(input.value)))))throw new FoundationError(409,'memory_conflict','This memory or topic exists. Edit that entry instead.');
 const now=new Date().toISOString(),row={category:input.category,memory_key:key,memory_value:input.value,confirmation_status:input.confirmed?'confirmed':'pending',memory_kind:input.kind,is_sensitive:input.sensitiveConsent||potentiallySensitive(input.key+' '+input.value),source_type:sourceType,source_message_id:sourceId,confirmed_at:input.confirmed?now:null,confidence:input.confirmed?1:0,updated_at:now,revision:(input.revision??0)+1};
 await advanceMemoryContextBoundary(owner);
 const query=id?supabase.from('user_memories').update(row).eq('telegram_id',owner).eq('id',id).eq('revision',input.revision!):supabase.from('user_memories').insert({...row,telegram_id:owner});
 const {data,error}=await query.select(fields).maybeSingle();if(error?.code==='23505')throw new FoundationError(409,'memory_conflict','This memory exists.');if(error)throw new FoundationError(503,'memory_unavailable','Could not save memory.');if(!data)throw new FoundationError(409,'memory_changed','This memory was removed or changed. Refresh and try again.');return data as PersonalMemory;
}
export async function removePersonalMemory(owner:number,id?:string){await advanceMemoryContextBoundary(owner);let query=supabase.from('user_memories').delete().eq('telegram_id',owner);if(id)query=query.eq('id',id);const {data,error}=await query.select('id');if(error)throw new FoundationError(503,'memory_unavailable','Could not delete memory.');return{deleted:data?.length??0};}
export async function getAiPersonalProfile(owner:number,query='',options:{calculatedOverview?:boolean;artifact?:{kind:'natal'|'tarot';id:string}}={}){
 const savedProfile=await getPersonalProfile(owner);
 const profile=env.FEATURE_PERSONAL_MEMORY?{...savedProfile,preferences:potentiallySensitive(savedProfile.preferences)?'':savedProfile.preferences}:savedProfile;
 if(!env.FEATURE_PERSONAL_MEMORY||!env.AI_MEMORY_ENABLED||!profile.ai_context_consent)return profile;
 const {data:user,error}=await supabase.from('users').select('ai_memory_enabled').eq('telegram_id',owner).maybeSingle();if(error||!user?.ai_memory_enabled)return profile;
 try{const [rows,birth]=await Promise.all([listPersonalMemories(owner),resolvePersonalBirth(supabase,owner)]);return assemblePersonalIntelligence({profile,rows,birth,query,includeCalculated:options.calculatedOverview,artifact:options.artifact});}catch{return {...profile,preferences:''};}
}
