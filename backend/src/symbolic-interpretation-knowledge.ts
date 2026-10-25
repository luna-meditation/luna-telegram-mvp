/** Versioned editorial conventions, not scientific personality assertions.
 * These references never calculate positions, draw cards or assign traits. */
import {z} from 'zod';
export const interpretationKnowledgeVersion='luna-symbolic-reflection-1.0';
export const numerologyThemes:Record<number,{en:string;ru:string}>={
 1:{en:'Initiative and choosing a direction. Where would one independent step help?',ru:'Инициатива и выбор направления. Где поможет один самостоятельный шаг?'},
 2:{en:'Cooperation and listening. Which need could you express more clearly?',ru:'Сотрудничество и умение слышать. О какой потребности стоит сказать яснее?'},
 3:{en:'Expression and creativity. What would you like to put into words or make?',ru:'Выражение и творчество. Что хочется сформулировать или создать?'},
 4:{en:'Structure and consistency. Which small routine would support your goal?',ru:'Структура и последовательность. Какая небольшая привычка поддержит твою цель?'},
 5:{en:'Change and exploration. What could you try without abandoning what matters?',ru:'Перемены и исследование. Что можно попробовать, не отказываясь от важного?'},
 6:{en:'Care and responsibility. Where is the boundary between helping and overcommitting?',ru:'Забота и ответственность. Где проходит граница между помощью и перегрузкой?'},
 7:{en:'Reflection and learning. What needs a closer look before you decide?',ru:'Размышление и обучение. Что стоит изучить внимательнее перед решением?'},
 8:{en:'Resources and responsibility. What is within your control, and what is not?',ru:'Ресурсы и ответственность. Что находится в твоей власти, а что нет?'},
 9:{en:'Completion and perspective. What is worth keeping, and what can you let go?',ru:'Завершение и широкий взгляд. Что стоит сохранить, а что можно отпустить?'},
 11:{en:'An editorial master-number theme of inspiration and sensitivity; not a special ability or diagnosis.',ru:'Традиционная тема мастер-числа: вдохновение и восприимчивость. Не особая способность и не диагноз.'},
 22:{en:'An editorial master-number theme of turning an idea into a workable structure, not guaranteed achievement.',ru:'Традиционная тема мастер-числа: превращать идею в рабочую структуру. Не гарантия достижений.'},
 33:{en:'An editorial master-number theme of care and teaching, not an obligation to save others.',ru:'Традиционная тема мастер-числа: забота и передача опыта. Не обязанность спасать других.'}
};
export const planetSymbolism={sun:'identity and chosen direction',moon:'familiarity and emotional needs',mercury:'communication and learning',venus:'values and connection',mars:'initiative and boundaries',jupiter:'expansion and meaning',saturn:'limits and responsibility',uranus:'change and autonomy',neptune:'imagination and uncertainty',pluto:'intensity and transformation'} as const;
export const aspectSymbolism={conjunction:'combined emphasis; not automatically harmonious',sextile:'a possible avenue for cooperation, not a guaranteed outcome',square:'a possible tension requiring conscious coordination',trine:'a possible ease or shared rhythm, not guaranteed agreement',opposition:'contrasting needs that may call for perspective and negotiation'} as const;
const planetRu:Record<keyof typeof planetSymbolism,string>={sun:'Самоопределение и выбранное направление',moon:'Привычное и эмоциональные потребности',mercury:'Общение и обучение',venus:'Ценности и близость',mars:'Инициатива и границы',jupiter:'Расширение опыта и смысл',saturn:'Ограничения и ответственность',uranus:'Перемены и самостоятельность',neptune:'Воображение и неопределённость',pluto:'Интенсивность и преобразование'};
const aspectRu:Record<keyof typeof aspectSymbolism,string>={conjunction:'Общий акцент; не обязательно гармония',sextile:'Возможность сотрудничества, а не гарантированный результат',square:'Возможное напряжение, требующее осознанного согласования',trine:'Возможная лёгкость или общий ритм, а не гарантированное согласие',opposition:'Разные потребности, которые могут требовать смены перспективы и обсуждения'};
export const knowledgeLookupInput=z.object({domain:z.enum(['numerology','astrology','tarot']),language:z.enum(['en','ru']),keys:z.array(z.string().min(1).max(40)).max(12).default([]),framework:z.string().min(1).max(80).optional()}).strict();
export const knowledgeFrameworks={numerology:'pythagorean_date',astrology:'western_tropical_whole_sign',tarot:'luna_saved_spread'} as const;
export type InterpretationKnowledgeRecord={id:string;version:string;domain:'numerology'|'astrology'|'tarot';framework:string;language:'en'|'ru';evidenceClass:'symbolic_convention';authority:'existing_product_content';key:string;text:string;source:{path:string;version:string}};
/** Direct lookup of existing shipped editorial content. No ingestion, private
 * data, calculations, provider request or independently running knowledge agent. */
export function retrieveInterpretationKnowledge(raw:unknown){
 const input=knowledgeLookupInput.parse(raw),framework=knowledgeFrameworks[input.domain];
 const result=(status:'found'|'not_found'|'framework_unavailable',sources:InterpretationKnowledgeRecord[],truncated=false)=>({status,version:interpretationKnowledgeVersion,domain:input.domain,framework,language:input.language,evidenceClass:'symbolic_convention' as const,sources,truncated,calculated:false,personalFacts:false});
 if(input.framework&&input.framework!==framework)return result('framework_unavailable',[]);
 const tarotRules=input.language==='ru'?{positions:'Используй точные сохранённые позиции, не предполагая схему прошлого, настоящего и будущего.',synthesis:'Связывай выпавшие карты с исходным вопросом.',reversed:'Перевёрнутое положение — способ символического прочтения, а не плохой исход.'}:{positions:'Read the exact saved positions, not an assumed past/present/future layout.',synthesis:'Connect the drawn cards to the actual question.',reversed:'Reversed is an interpretive orientation, not a bad outcome.'};
 const entries:Array<[string,string]>=input.domain==='numerology'?Object.entries(numerologyThemes).map(([key,value])=>[key,value[input.language]]):input.domain==='astrology'?[...Object.entries(planetSymbolism).map(([key,text])=>[key,input.language==='ru'?planetRu[key as keyof typeof planetRu]:text] as [string,string]),...Object.entries(aspectSymbolism).map(([key,text])=>[key,input.language==='ru'?aspectRu[key as keyof typeof aspectRu]:text] as [string,string])]:Object.entries(tarotRules);
 const wanted=new Set(input.keys),matched=entries.filter(([key])=>!wanted.size||wanted.has(key));
 const sources:InterpretationKnowledgeRecord[]=[];let size=2;
 for(const [key,text] of matched){
  const record:InterpretationKnowledgeRecord={id:`luna-knowledge:${input.domain}:${key}:${input.language}`,version:interpretationKnowledgeVersion,domain:input.domain,framework,language:input.language,evidenceClass:'symbolic_convention',authority:'existing_product_content',key,text,source:{path:'backend/src/symbolic-interpretation-knowledge.ts',version:interpretationKnowledgeVersion}};
  const bytes=JSON.stringify(record).length+1;if(sources.length===6||size+bytes>4000)break;sources.push(record);size+=bytes;
 }
 return result(sources.length?'found':'not_found',sources,sources.length<matched.length);
}
export function interpretationReferences(kind:'numerology'|'natal'|'compatibility'|'tarot'){
 return{version:interpretationKnowledgeVersion,nature:'traditional_symbolic_not_scientific',source:kind==='numerology'?'Documented Pythagorean date convention; arithmetic comes from the versioned date engine':kind==='tarot'?'The saved 78-card Luna catalog and the exact selected spread positions':'Western tropical/whole-sign editorial conventions; Astronomy Engine supplies positions only',...(kind==='numerology'?{themes:numerologyThemes}:kind==='tarot'?{rules:['Read the exact positions, not an assumed past/present/future layout.','Connect the drawn cards to the actual question.','Reversed is an interpretive orientation, not a bad outcome.']}:{planetSymbolism,aspectSymbolism}),boundary:'Conventions offer questions, not established facts about a person, hidden feelings, diagnoses or predictions.'};
}
