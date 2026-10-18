/** Local semantic fallback. No extra AI call, no private question as a title. */
export function consultationTitle(message:string,language:'en'|'ru',suggested?:string|null){
 const en=language==='en';
 const topics:Array<[RegExp,string,string]>=[
  [/совместим|compatib|two charts/i,'Compatibility reflection','О совместимости'],
  [/меркур|mercury/i,'Mercury & communication','Меркурий и общение'],
  [/таро|tarot|these cards|this card|расклад|эту карту/i,'Tarot reflection','Размышление с Таро'],
  [/натальн|астролог|birth chart|natal|astrolog/i,'My celestial portrait','Мой звёздный портрет'],
  [/сна|уснуть|сном|sleep|bedtime/i,'A calmer evening','Спокойный вечер'],
  [/дых|breath/i,'Finding my rhythm','Мой спокойный ритм'],
  [/медитац|meditat/i,'Choosing a practice','Подбираем практику'],
  [/трев|anxious|anxiety|overwhelm/i,'Making room for calm','Больше спокойствия'],
  [/отношен|relationship|partner/i,'Understanding relationships','Разобраться в отношениях'],
  [/dream|сновид|приснил/i,'Exploring a dream','Исследование сна']
 ];
 const clean=suggested?.replace(/\s+/g,' ').trim();
 if(clean&&clean.length<=48&&clean.split(' ').length<=7&&!/[{}\[\]\n]/.test(clean)&&!/^luna(?: ai)?$/i.test(clean))return clean;
 const topic=topics.find(([pattern])=>pattern.test(message));return topic?(en?topic[1]:topic[2]):en?'A moment to reflect':'Время для себя';
}
/** An automatic title can evolve at most once/day, only after a meaningful
 * topic change. Never overwrite a title the user has renamed. No model call. */
export function intelligenceTitleUpdate(input:{current:string;previous?:{value:string;updatedAt:string};message:string;language:'en'|'ru';userTurns:number;now:number}){
 const next=consultationTitle(input.message,input.language),updatedAt=new Date(input.now).toISOString();
 if(!input.current)return{value:next,updatedAt};
 if(!input.previous||input.current!==input.previous.value||input.userTurns<4||input.now-Date.parse(input.previous.updatedAt)<86400000||next===input.current||['A moment to reflect','Время для себя'].includes(next))return null;
 return{value:next,updatedAt};
}
