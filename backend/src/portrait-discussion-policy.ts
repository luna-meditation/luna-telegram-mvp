import {z} from 'zod';
import type {PersonalPortrait,PortraitEvidence} from './personal-portrait-policy.js';

export const portraitDiscussionSections=['overview','essence','strengths','motivations','relationships','direction','growth','discoveries','astrology'] as const;
export type PortraitDiscussionSection=typeof portraitDiscussionSections[number];
export const portraitDiscussionInput=z.object({operationId:z.string().uuid(),section:z.enum(portraitDiscussionSections),language:z.enum(['en','ru'])}).strict();
const questions:Record<PortraitDiscussionSection,{en:string;ru:string}>={
 overview:{en:'What feels most important to understand about yourself right now?',ru:'Что сейчас важнее всего понять о себе?'},
 essence:{en:'In which recent situation did you feel most like yourself?',ru:'В какой недавней ситуации ты больше всего чувствовал(а) себя собой?'},
 strengths:{en:'What did you handle well recently, even if it seemed small?',ru:'С чем тебе недавно удалось хорошо справиться, даже если это кажется мелочью?'},
 motivations:{en:'Which part of what you do gives you energy, rather than just approval?',ru:'Что в твоих занятиях даёт тебе энергию, а не только одобрение других?'},
 relationships:{en:'What would you like to be understood better in an important relationship?',ru:'В каких важных отношениях тебе хотелось бы больше понимания и в чём именно?'},
 direction:{en:'What is one small step you would genuinely want to take this week?',ru:'Какой небольшой шаг тебе действительно хочется сделать на этой неделе?'},
 growth:{en:'What would you like to try differently, without demanding perfection from yourself?',ru:'Что тебе хотелось бы попробовать иначе, не требуя от себя идеального результата?'},
 discoveries:{en:'Which saved reflection still resonates, and what would you change in it today?',ru:'Какое сохранённое открытие всё ещё откликается, а что ты сейчас в нём изменил(а) бы?'},
 astrology:{en:'Would you like to explore your calculated chart or start with your optional birth date?',ru:'Хочешь исследовать рассчитанную карту или начать с необязательной даты рождения?'}
};
/** A zero-provider contextual opening. No inferred traits, hidden sales,
 * automatic consent, or use of sensitive memories in a proactive question. */
export function portraitDiscussionOpening(portrait:PersonalPortrait,section:PortraitDiscussionSection,language:'en'|'ru'){
 const rows=section==='overview'?[...portrait.sections.direction,...portrait.sections.essence]:section==='astrology'?[]:portrait.sections[section];
 const evidence=portrait.memoryPermission?rows.filter(item=>!item.private&&item.kind==='user_fact').slice(0,1):[];
 const item=evidence[0],lead=item?(language==='ru'?`Ты сохранил(а): «${item.text.slice(0,220)}».`:`You chose to save: “${item.text.slice(0,220)}”.`):'';
 return{content:[lead,questions[section][language]].filter(Boolean).join('\n\n'),sources:evidence.map((value:PortraitEvidence)=>({id:value.id,updatedAt:value.updatedAt,kind:value.kind})),section,question:questions[section][language]};
}
