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
export function conversationEntryQuestion(entry:OpeningEntry,language:ExperienceLanguage,dismissed=false){return dismissed?(language==='ru'?'Что для тебя сейчас важнее всего?':'What matters most to you right now?'):entry.question;}
/** Stable IDs identify the same opening before and after the first saved turn. */
export function conversationOpening(entry:OpeningEntry,language:ExperienceLanguage,dismissed=false){
 const question=conversationEntryQuestion(entry,language,dismissed);
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

/** Local entry actions are supported product paths, not generated capabilities. */
export function companionEntryQuestion(language:ExperienceLanguage,birthAvailable:boolean){
 return birthAvailable
  ? language==='ru'?'Хочешь исследовать свой портрет, посмотреть карты на день или разобраться в том, что сейчас чувствуешь?':'Would you like to explore your portrait, draw cards for today, or make sense of how you feel?'
  : language==='ru'?'Какая у тебя дата рождения? Напиши дату, например 24.06.1992: начнём с первого штриха к твоему портрету. Можно и без даты — расскажи, что сейчас волнует.':'When were you born? Share a date, for example 1992-06-24, and we can begin a first reflection on your portrait. You can also skip it and tell me what is on your mind.';
}
export function companionGreeting(language:ExperienceLanguage,audience:'new'|'returning',name?:string|null){
 if(audience==='new')return language==='en'?'Hi, I’m Luna. I’m here to help you understand yourself — what supports you, what gets in the way, and what matters to you.':'Привет, я Луна. Я рядом, чтобы помочь тебе лучше понимать себя: что даёт опору, что мешает и что важно именно тебе.';
 const chosen=name?.trim().slice(0,60);return language==='en'?`Hi${chosen?', '+chosen:''}. I’m here.`:`Привет${chosen?', '+chosen:''}. Я рядом.`;
}

/** Only explicit work-product requests are redirected here. Talking about a
 * career, money anxiety, a difficult colleague or a personal choice stays in
 * the conversation. This uses the existing free capability-answer handler. */
export function companionCapabilityBoundary(message:string):'personal_companion'|'date_only_chart'|null{
 const workProduct=/\b(?:write|create|build|make|design|generate|develop|prepare)\b.{0,65}\b(?:marketing funnel|sales funnel|(?:paid )?(?:advertising|ad) campaign|business plan|sales copy|production code|python script|investment portfolio)\b|(?:напиши|создай|сделай|разработай|составь|подготовь).{0,65}(?:маркетингов\p{L}*\s+воронк|воронк\p{L}*\s+продаж|рекламн\p{L}*\s+кампани|бизнес[ -]план|продающ\p{L}*\s+текст|код\s+на\s+(?:python|javascript|питон)|инвестиционн\p{L}*\s+портфел)/iu;
 // A negated deliverable is often exactly the user's request for reflection.
 const withoutProduct=/\b(?:not|without|don'?t|do not)\b.{0,35}\b(?:business plan|marketing|campaign|code|portfolio)\b|(?:не\s+(?:нужен|нужна|надо|давай|пиши|делай)|без).{0,35}(?:бизнес|маркетинг|реклам|код|портфел)/iu;
 if(workProduct.test(message)&&!withoutProduct.test(message))return 'personal_companion';
 const dateOnly=/\b(?:only|just)\s+(?:my\s+|a\s+|the\s+)?(?:birth\s+)?date\b|(?:только|одн\p{L}*).{0,12}дат\p{L}*\s+рожд|дат\p{L}*\s+рожд.{0,90}(?:врем\p{L}*\s+и\s+мест\p{L}*\s+пока\s+не|без\s+врем|врем\p{L}*\s+не\s+знаю)/iu;
 const capabilityQuestion=/\bwhat\b.{0,25}\b(?:can|available|possible)\b|что.{0,12}(?:можно|доступно)|какие.{0,20}(?:возможности|расч[её]ты)/iu;
 return dateOnly.test(message)&&capabilityQuestion.test(message)?'date_only_chart':null;
}
