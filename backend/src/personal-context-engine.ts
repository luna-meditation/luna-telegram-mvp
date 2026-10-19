import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {calculateDateNumerology} from './luna-intelligence-numerology.js';
import {calculateDateOnlySun} from './luna30-astrology-engine.js';
import {personalMemoryOverview,potentiallySensitive,selectRelevantMemories,selectRelevantReflections,type PersonalMemory} from './personal-memory-policy.js';
import type {PersonalProfile,CalculatedPersonalContext} from './personalization-policy.js';
import {companionPreference} from './companion-policy.js';
import {reflectionKey,reflectionChoice} from './personal-reflection.js';

export type PersonalBirthSource={id:string;source:'birth_profile'|'personal_profile';date:string;time:string|null;place:string|null;updatedAt:string;revision?:number};
export type PersonalBirthResolution={selected:PersonalBirthSource|null;selectionRequired:boolean;available:boolean};
/** One resolver for the portrait, numerology and conversational context. The
 * canonical self profile wins; an older date-only profile is not a second
 * competing record. No birth input is inferred from a conversation. */
export async function resolvePersonalBirth(db:SupabaseClient,owner:number,chartId?:string):Promise<PersonalBirthResolution>{
 if(!Number.isSafeInteger(owner)||owner<=0)throw new FoundationError(403,'owner_required','Open Luna inside Telegram.');
 let selectedId:string|undefined;
 if(chartId){const chart=await db.from('luna30_chart_cache').select('profile_id').eq('telegram_id',owner).eq('id',chartId).maybeSingle();if(chart.error)throw new FoundationError(503,'context_unavailable','Could not verify the selected chart.');if(!chart.data)throw new FoundationError(404,'chart_not_found','Reopen your saved chart.');selectedId=chart.data.profile_id;}
 let query=db.from('luna30_birth_profiles').select('id,birth_date,birth_time,location,revision,updated_at').eq('telegram_id',owner).eq('subject_kind','self');
 if(selectedId)query=query.eq('id',selectedId);
 const result=await query.order('updated_at',{ascending:false}).limit(2);
 if(result.error)throw new FoundationError(503,'context_unavailable','Could not load your saved birth profile.');
 if(result.data?.length===1){const p=result.data[0];return{available:true,selectionRequired:false,selected:{id:p.id,source:'birth_profile',date:p.birth_date,time:p.birth_time?.slice(0,5)??null,place:typeof p.location?.label==='string'?p.location.label:null,updatedAt:p.updated_at,revision:p.revision}};}
 if(result.data?.length||selectedId)return{available:Boolean(result.data?.length),selectionRequired:Boolean(result.data?.length),selected:null};
 const legacy=await db.from('luna_personal_profiles').select('birth_date,birth_time,birth_place,updated_at').eq('telegram_id',owner).maybeSingle();
 if(legacy.error)throw new FoundationError(503,'context_unavailable','Could not verify your saved birth details.');
 const p=legacy.data;
 return{available:Boolean(p?.birth_date),selectionRequired:false,selected:p?.birth_date?{id:'personal-profile',source:'personal_profile',date:p.birth_date,time:p.birth_time?.slice(0,5)??null,place:p.birth_place,updatedAt:p.updated_at}:null};
}
export function birthContextAvailability(birth:PersonalBirthResolution){return{available:birth.available,selectionRequired:birth.selectionRequired,...(birth.selected?{source:birth.selected.source,sourceId:birth.selected.id,hasDate:true,hasTime:Boolean(birth.selected.time),hasPlace:Boolean(birth.selected.place),updatedAt:birth.selected.updatedAt}:{})};}
export function numerologyFromBirth(birth:PersonalBirthResolution,asOf:string){
 if(!birth.selected)return{calculated:false as const,requiresPersonalProfile:!birth.available,requiresSelection:birth.selectionRequired};
 return{calculated:true as const,source:{type:birth.selected.source==='birth_profile'?'confirmed_self_birth_profile':'confirmed_date_only_profile',id:birth.selected.id},...calculateDateNumerology(birth.selected.date,asOf)};
}
/** One bounded projection for chat, Tarot and saved personal products. Sources
 * are authoritative records; symbolic data and reflections never become facts.
 * Raw birth inputs are deliberately not included in the provider projection. */
export function assemblePersonalIntelligence(input:{profile:PersonalProfile;rows:PersonalMemory[];birth:PersonalBirthResolution;query:string;asOf?:string;includeCalculated?:boolean;artifact?:{kind:'natal'|'tarot';id:string}}):PersonalProfile{
 const {profile,rows,birth,query}=input;if(!profile.ai_context_consent)return profile;
 let calculated:CalculatedPersonalContext|undefined;
 if(input.includeCalculated&&companionPreference(rows).symbolicAiContext&&personalMemoryOverview(query)==='all'&&birth.selected){
  const numbers=calculateDateNumerology(birth.selected.date,input.asOf??new Date().toISOString().slice(0,10)),sun=calculateDateOnlySun(birth.selected.date);
  const en=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'],ru=['Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец','Козерог','Водолей','Рыбы'];
  calculated={kind:'calculated_symbolic',source:{id:birth.selected.id,updatedAt:birth.selected.updatedAt},numerology:{version:numbers.version,asOf:numbers.asOf,lifePath:numbers.lifePath,birthday:numbers.birthday,personalYear:numbers.personalYear,periodTimeZone:numbers.periodTimeZone},sun:{signs:sun.sunSigns.map(n=>en[n]),signsRu:sun.sunSigns.map(n=>ru[n]),precision:sun.precision,engineVersion:sun.engine.version},limitations:'Date-only symbolism, not verified personality traits, a complete natal chart, a current transit forecast, or evidence about other people.'};
 }
 const artifact=input.artifact,key=artifact?reflectionKey(artifact.kind,artifact.id):null;
 const feedback=artifact?rows.filter(row=>row.memory_key===key&&row.confirmation_status==='confirmed'&&!row.is_sensitive&&row.memory_kind==='symbolic').flatMap(row=>{const choice=reflectionChoice(row);return choice&&['resonates','partly','not_me'].includes(choice)?[{kind:artifact.kind,referenceId:artifact.id,choice:choice as 'resonates'|'partly'|'not_me',updatedAt:row.updated_at}]:[];}).slice(0,1):[];
 return{...profile,preferences:potentiallySensitive(profile.preferences)?'':profile.preferences,known_birth:birthContextAvailability(birth),confirmed_memories:selectRelevantMemories(rows,query),saved_reflections:selectRelevantReflections(rows,query),...(feedback.length?{confirmed_feedback:feedback}:{}),...(calculated?{calculated_symbolic:calculated}:{})};
}
