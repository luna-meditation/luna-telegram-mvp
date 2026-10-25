import {z} from 'zod';
import type {PersonalPortrait,PortraitEvidence} from './personal-portrait-policy.js';

export const portraitDiscussionSections=['overview','essence','strengths','motivations','relationships','direction','growth','discoveries','astrology'] as const;
export type PortraitDiscussionSection=typeof portraitDiscussionSections[number];
export const portraitMemoryReference=z.object({id:z.string().uuid(),updatedAt:z.string().datetime({offset:true})}).strict();
export type PortraitMemoryReference=z.infer<typeof portraitMemoryReference>;
export function discoveryReferenceFromRecent(rows:Array<{role?:string;metadata?:unknown}>){
 for(const row of [...rows].reverse()){
  if(row.role!=='assistant')continue;
  const parsed=z.object({portraitDiscussion:z.object({section:z.literal('discoveries'),sources:z.array(portraitMemoryReference.extend({kind:z.enum(['user_fact','user_reflection','symbolic_reflection'])})).length(1)})}).safeParse(row.metadata);
  if(parsed.success)return parsed.data.portraitDiscussion.sources[0];
  if(row.metadata&&typeof row.metadata==='object'&&(row.metadata as {contextReset?:unknown}).contextReset===true)return null;
 }
 return null;
}
export const portraitDiscussionInput=z.object({operationId:z.string().uuid(),section:z.enum(portraitDiscussionSections),language:z.enum(['en','ru']),memory:portraitMemoryReference.optional()}).strict().refine(value=>!value.memory||value.section==='discoveries','Choose a discovery in its own section.');
const questions:Record<PortraitDiscussionSection,{en:string;ru:string}>={
 overview:{en:'What feels most important to understand about yourself right now?',ru:'Что сейчас важнее всего понять о себе?'},
 essence:{en:'In which recent situation did you feel most like yourself?',ru:'В какой недавней ситуации получилось больше всего почувствовать себя собой?'},
 strengths:{en:'What did you handle well recently, even if it seemed small?',ru:'С чем тебе недавно удалось хорошо справиться, даже если это кажется мелочью?'},
 motivations:{en:'Which part of what you do gives you energy, rather than just approval?',ru:'Что в твоих занятиях даёт тебе энергию, а не только одобрение других?'},
 relationships:{en:'What would you like to be understood better in an important relationship?',ru:'В каких важных отношениях тебе хотелось бы больше понимания и в чём именно?'},
 direction:{en:'Which of your goals feels genuinely important right now, and why?',ru:'Какая из твоих целей сейчас по-настоящему важна — и почему?'},
 growth:{en:'Which recurring situation would you like to understand better?',ru:'Какую повторяющуюся ситуацию хочется лучше понять?'},
 discoveries:{en:'Which saved reflection still resonates, and what would you change in it today?',ru:'Какое сохранённое открытие всё ещё откликается, а что хочется в нём изменить?'},
 astrology:{en:'What would you like to explore through astrology: identity, relationships or direction?',ru:'Что хочется исследовать через астрологию: характер, отношения или направление?'}
};
/** A zero-provider contextual opening. No inferred traits, hidden sales,
 * automatic consent, or use of sensitive memories in a proactive question. */
export function selectedPortraitDiscovery(portrait:PersonalPortrait,reference:PortraitMemoryReference){
 return portrait.memoryPermission?portrait.sections.discoveries.find(item=>item.id===reference.id&&item.updatedAt===reference.updatedAt&&!item.private):undefined;
}
export function portraitDiscussionOpening(portrait:PersonalPortrait,section:PortraitDiscussionSection,language:'en'|'ru',reference?:PortraitMemoryReference){
 const rows=section==='overview'?[...portrait.sections.direction,...portrait.sections.essence]:section==='astrology'?[]:portrait.sections[section];
 const selected=reference?selectedPortraitDiscovery(portrait,reference):undefined;
 if(reference&&(!selected||section!=='discoveries'))throw new Error('discovery_changed');
 const evidence=selected?[selected]:portrait.memoryPermission?rows.filter(item=>!item.private&&item.kind==='user_fact').slice(0,1):[];
 const item=evidence[0],symbolic=item?.kind!=='user_fact',lead=item?(language==='ru'?`${symbolic?'Ты сохранил(а) символическое размышление':'В твоей подтверждённой записи'}: «${item.text.slice(0,reference?500:220)}».`:`${symbolic?'You chose to keep this symbolic reflection':'You chose to save'}: “${item.text.slice(0,reference?500:220)}”.`):'';
 const question=reference?(language==='ru'?'Что в этом наблюдении полезно тебе сейчас, а что хочется уточнить?':'What feels useful in this observation today, and what would you like to clarify?'):questions[section][language];
 return{content:[lead,question].filter(Boolean).join('\n\n'),sources:evidence.map((value:PortraitEvidence)=>({id:value.id,updatedAt:value.updatedAt,kind:value.kind})),section,question};
}
