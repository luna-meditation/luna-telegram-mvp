/** A deterministic personal reflection, never a current-transit forecast. */
export const dailyEntryVersion='luna-product-v2-reflection-v1';
export type DailyPersonalEntry={version:1;key:string;localDate:string;timeZone:string;language?:'en'|'ru';greeting:string;question:string;audience?:'new'|'returning';reflection:null|{text:string;basis:string;source:'saved_chart'|'date_only_sun'|'confirmed_goal';calculationVersion:string};birthAvailable:boolean;hasBirthTime:boolean;contextReflectionAllowed:boolean};
export function localCalendarDate(now:Date,timeZone:string){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(name=>parts.find(p=>p.type===name)!.value).join('-');
}
const reflections={en:[
 'You could begin one thing you have been putting off with a step small enough to take today. Starting does not commit you to doing everything at once.',
 'Give one useful routine a little room today. It could be eating without rushing or leaving a pause between tasks.',
 'If several ideas are competing for your attention, choose one to explore for ten minutes. You can return to the others later.',
 'It is possible to care about someone without taking responsibility for everything they feel. Leave a little room for what you need, too.',
 'Try giving one idea a voice before deciding whether anyone will approve of it. You could first share it with someone you trust or write it down for yourself.',
 'Choose one thing that would be good enough for today. Finishing a small useful task can matter more than getting every detail right.',
 'In one conversation, you could say what you need before trying to find a compromise. Listening and having your own voice can go together.',
 'There may be a question you do not need to settle immediately. You can notice what you feel without forcing a final answer today.',
 'A small experiment can tell you more than another long list of possibilities. Try something you can easily change your mind about.',
 'Make one plan a little kinder to yourself: fewer steps, a realistic time, or permission to ask for help. A plan should support you.',
 'You can make room for an idea of your own without working everything out alone. Consider who could help you think it through.',
 'Give one feeling or idea a concrete place: a few written lines, a sketch, or a quiet walk. You do not need to explain it perfectly.'
],ru:[
 'Можно начать одно отложенное дело с шага, который реально сделать сегодня. Начало не обязывает сразу доводить всё до конца.',
 'Оставь немного места для простой привычки, которая тебя поддерживает: поесть без спешки или сделать паузу между делами.',
 'Если идей много, выбери одну и удели ей десять минут. К остальным можно вернуться позже.',
 'Можно заботиться о близком человеке, не отвечая за все его чувства. Пусть останется немного места и для твоих потребностей.',
 'Попробуй дать своей идее прозвучать до того, как решишь, одобрят ли её другие. Можно сначала записать её для себя или поделиться с тем, кому доверяешь.',
 'Выбери одно дело, которое сегодня достаточно сделать хорошо, без требования идеала. Небольшой законченный шаг тоже имеет значение.',
 'В одном разговоре можно сначала назвать свою потребность, а потом искать компромисс. Слышать другого и сохранять свой голос вполне совместимо.',
 'Не на каждый вопрос нужен окончательный ответ прямо сейчас. Можно заметить свои чувства и оставить решение до более ясного момента.',
 'Небольшая проба может дать больше ясности, чем ещё один список возможностей. Выбери то, что легко попробовать и так же легко изменить.',
 'Сделай один план бережнее к себе: меньше шагов, реалистичный срок или возможность попросить о помощи. План должен тебя поддерживать.',
 'Для собственной идеи не обязательно разбираться во всём в одиночку. Подумай, с кем можно спокойно её обсудить.',
 'Дай одному чувству или замыслу конкретное место: несколько строк, рисунок или спокойную прогулку. Необязательно сразу находить идеальные слова.'
]};
export function solarDailyReflection(input:{language:'en'|'ru';localDate:string;sunSigns:number[];source:'saved_chart'|'date_only_sun'}){
 const indices=[...new Set(input.sunSigns)].filter(n=>Number.isInteger(n)&&n>=0&&n<12);if(indices.length!==1)return null;
 const en=input.language==='en';
 return {text:reflections[input.language][indices[0]],basis:en?(input.source==='saved_chart'?'A reflection inspired by your saved birth chart, not a forecast.':'A reflection from your saved birth date, not a full chart or forecast.'):(input.source==='saved_chart'?'Размышление по сохранённой карте рождения, не прогноз.':'Размышление по сохранённой дате рождения, не полная карта и не прогноз.'),source:input.source,calculationVersion:dailyEntryVersion};
}
