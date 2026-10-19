import type {PersonalMemory} from './personal-memory-policy.js';
import type {PersonalProfile} from './personalization-policy.js';
import {containsCredential} from './personal-memory-policy.js';
import {cosmosDomainSummary} from './luna42-cosmos-domain.js';

export const portraitSections=['essence','strengths','motivations','relationships','direction','growth','discoveries'] as const;
export type PortraitSection=typeof portraitSections[number];
export type PortraitPersistence={state:'saved';revision:number;sourceEpoch:number;createdAt:string;cached:boolean;sectionDigests:Record<string,string>}|{state:'unavailable'};
export type PortraitEvidence={id:string;text:string;kind:'user_fact'|'user_reflection'|'symbolic_reflection';source:string;createdAt:string;updatedAt:string;private:boolean};
export type PersonalPortrait={version:1;sections:Record<PortraitSection,PortraitEvidence[]>;interests:string[];completion:{provided:number;total:number};timeline:Array<{id:string;at:string;kind:PortraitEvidence['kind'];source:string;text:string}>;memoryPermission:boolean};
const eligible=(row:PersonalMemory)=>row.confirmation_status==='confirmed'&&!containsCredential(row.memory_value);
const portraitText=(row:PersonalMemory)=>row.memory_key.startsWith('cosmos_')?cosmosDomainSummary(row.memory_value):row.memory_key.startsWith('luna_feedback_')?row.memory_value.replace(/ \[(?:breath|meditation|natal|tarot):[a-f0-9-]+;[a-z_]+\]$/i,''):row.memory_value;
/** A traceable projection, not a psychological classifier. Strengths are only
 * explicit user-labelled observations; zodiac signs never assign traits. */
export function buildPersonalPortrait(input:{memories:PersonalMemory[];profile:Pick<PersonalProfile,'interests'|'ai_context_consent'>;memoryEnabled:boolean;hasBirth:boolean}):PersonalPortrait{
 const sections:PersonalPortrait['sections']={essence:[],strengths:[],motivations:[],relationships:[],direction:[],growth:[],discoveries:[]};
 const rows=input.memories.filter(eligible).filter(row=>row.memory_key!=='companion_settings'&&row.memory_key!=='meet_interests').sort((a,b)=>b.updated_at.localeCompare(a.updated_at)||a.id.localeCompare(b.id));
 for(const row of rows){
  const item:PortraitEvidence={id:row.id,text:portraitText(row),kind:row.memory_kind==='symbolic'?(row.source_type==='user_saved_ai_reflection'?'symbolic_reflection':'user_reflection'):'user_fact',source:row.source_type,createdAt:row.created_at,updatedAt:row.updated_at,private:row.is_sensitive};
  const key=row.memory_key.toLocaleLowerCase();let section:PortraitSection;
  if(row.category==='reflections')section='discoveries';
  else if(/(?:^|_)(?:strengths?|сильные_стороны|таланты)(?:_|$)/u.test(key))section='strengths';
  else if(key==='cosmos_relationships'||key==='cosmos_social'||row.category==='life_context')section='relationships';
  else if(key==='cosmos_growth'||/(?:growth|развити|навык)/u.test(key))section='growth';
  else if(row.category==='goals')section='direction';
  else if(/(?:values?|motivat|ценност|мотивац)/u.test(key))section='motivations';
  else section='essence';
  if(sections[section].length<8)sections[section].push(item);
 }
 // Progress follows the six visible chapters, not hidden source categories.
 // Interests are optional preferences, not proof of a personality chapter.
 const total=6,provided=Number(sections.essence.length>0)+Number(sections.strengths.length>0)+Number(sections.relationships.length>0)+Number(sections.direction.length+sections.motivations.length+sections.growth.length>0)+Number(input.hasBirth)+Number(sections.discoveries.length>0);
 return{version:1,sections,interests:input.profile.interests,completion:{provided,total},memoryPermission:input.profile.ai_context_consent&&input.memoryEnabled,timeline:rows.slice(0,8).map(row=>({id:row.id,at:row.updated_at,kind:row.memory_kind==='symbolic'?(row.source_type==='user_saved_ai_reflection'?'symbolic_reflection':'user_reflection'):'user_fact',source:row.source_type,text:portraitText(row)}))};
}
