/** Shared zero-provider entries. A finite topic is context, never an access grant. */
export const guidedTopics = ['relationships', 'work', 'direction', 'self'] as const;
export type GuidedTopic = typeof guidedTopics[number];
export type ExperienceLanguage = 'en' | 'ru';
const directions = {
 relationships: {
  en: {label:'Relationships',acknowledgement:'Let’s make room for what is happening between you and someone important.',question:'What happened recently that you would like to understand better?'},
  ru: {label:'Отношения',acknowledgement:'Давай разберёмся в том, что происходит между тобой и важным для тебя человеком.',question:'Что случилось недавно и в чём тебе хочется разобраться?'}
 },
 work: {
  en: {label:'Work & money',acknowledgement:'We can untangle the situation and find one practical next step.',question:'What feels most pressing about work or money right now?'},
  ru: {label:'Работа и деньги',acknowledgement:'Можем разобраться в ситуации и найти один посильный следующий шаг.',question:'Что сейчас больше всего беспокоит в работе или деньгах?'}
 },
 direction: {
  en: {label:'Life direction',acknowledgement:'You don’t have to work out your whole future at once.',question:'What choice or uncertainty has been on your mind lately?'},
  ru: {label:'Куда двигаться',acknowledgement:'Необязательно решать всё своё будущее сразу.',question:'Какой выбор или неопределённость занимает твои мысли сейчас?'}
 },
 self: {
  en: {label:'Understanding myself',acknowledgement:'We can start with something you have actually noticed about yourself.',question:'What recent reaction or feeling would you like to understand better?'},
  ru: {label:'Понять себя',acknowledgement:'Начнём с того, что ты уже замечаешь в себе.',question:'В какой своей недавней реакции или чувстве тебе хочется разобраться?'}
 }
} as const;
export function guidedDirection(topic:GuidedTopic,language:ExperienceLanguage){return directions[topic][language];}
export function isGuidedTopic(value:unknown):value is GuidedTopic{return typeof value==='string'&&guidedTopics.some(topic=>topic===value);}
export type OpeningEntry={key:string;greeting:string;question:string;language?:ExperienceLanguage;audience?:'new'|'returning';contextReflectionAllowed?:boolean;reflection:null|{text:string;basis:string}};
/** Stable IDs identify the same opening before and after the first saved turn. */
export function conversationOpening(entry:OpeningEntry,language:ExperienceLanguage,dismissed=false){
 const question=dismissed?(language==='ru'?'Что для тебя сейчас важнее всего?':'What matters most to you right now?'):entry.question;
 return [entry.greeting,...(!dismissed&&entry.reflection?[entry.reflection.text]:[]),question].filter(Boolean).map((content,index)=>({id:`opening:${entry.key}:${index}`,content,index,...(!dismissed&&entry.reflection&&index===1?{basis:entry.reflection.basis}:{} )}));
}
export function conversationEntryRows(entry:OpeningEntry|null,language:ExperienceLanguage,dismissed=false,topic?:GuidedTopic,topicLanguage=language){
 const opening=entry?conversationOpening(entry,entry.language??language,dismissed):[];
 const direction=topic?guidedDirection(topic,topicLanguage):null;
 return [
  ...opening.map(row=>({role:'assistant',...row,excludeFromAi:Boolean(row.basis&&!entry?.contextReflectionAllowed)})),
  ...(direction?[{role:'user',content:direction.label,index:opening.length,excludeFromAi:false},{role:'assistant',content:direction.acknowledgement+' '+direction.question,index:opening.length+1,excludeFromAi:false}]:[])
 ];
}
export const companionExperiencePolicy = `GUIDED COMPANION: Resolve short replies from the last question and concrete situation; do not restart. A chosen direction is context, not a personal fact. Ask at most one relevant question when needed; otherwise offer one useful small next step. Respect stopping or changing topic. Never force a disclosure, tool or paid action. Use only current authorized memory and let a returning user choose whether to continue. A natal reflection is not today's transit forecast. Avoid internal labels, generic filler and invented history. Never claim an action was saved or executed without a verified result.`;
